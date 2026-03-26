import axios from 'axios';
import cron from 'node-cron';
import Auth from '../models/Auth';
import Candle from '../models/Candle';
import IntradayCandle from '../models/IntradayCandle';
import EliteStock from '../models/EliteStock';
import SymbolModel from '../models/Symbol';
import SniperService from './SniperService';
import TradeManagementService from './TradeManagementService';

class IntradayService {
    private baseUrl = 'https://api.upstox.com/v3/historical-candle/intraday';
    private isSchedulerRunning = false;
    private contextCache: Map<string, { prevClose: number, avgVol915: number, avgADR: number, lastUpdate: string }> = new Map();

    private async getAccessToken(): Promise<string> {
        const auth = await Auth.findOne().sort({ createdAt: -1 }).lean();
        if (!auth || !auth.accessToken) throw new Error('No access token found.');
        return auth.accessToken;
    }

    /**
     * Precision Scheduler: Runs every 5 mins during market hours
     */
    public startMarketHeartbeat() {
        if (this.isSchedulerRunning) return;
        this.isSchedulerRunning = true;

        console.log('--- Heartbeat Scheduler Started (09:15 - 15:30) ---');

        // Immediate run to show the table right after ranking
        this.runHeartbeat();

        // Monday to Friday every 5 minutes from 9:15 to 15:35
        cron.schedule('*/5 9-15 * * 1-5', async () => {
            const now = new Date();
            const hour = now.getHours();
            const minute = now.getMinutes();

            // 1. Check Window (09:15 to 15:30)
            const isMarketHours = (hour === 9 && minute >= 15) || (hour > 9 && hour < 15) || (hour === 15 && minute <= 30);

            if (isMarketHours) {
                await this.runHeartbeat();
            }
        }, {
            timezone: "Asia/Kolkata"
        });
    }

    /**
     * The Heartbeat: Syncs all Elite 10 + Nifty 50 intraday candles
     */
    public async runHeartbeat() {
        console.log(`--- [${new Date().toLocaleTimeString()}] Heartbeat Triggered ---`);

        try {
            const token = await this.getAccessToken();

            // 1. Get Today's Elite 10 + Nifty 50
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const eliteList = await EliteStock.find({ date: today }).sort({ rank: 1 }).lean();

            if (eliteList.length === 0) {
                console.warn('No Elite 10 found for today. Run ranking first.');
                return;
            }

            const symbolsToSync = [
                { symbol: 'NIFTY_50', instrument_key: 'NSE_INDEX|Nifty 50' },
                ...eliteList.map(e => ({ symbol: e.symbol, instrument_key: '' }))
            ];

            // Fill in instrument keys for stocks
            const symbolMaster = await SymbolModel.find({ symbol: { $in: eliteList.map(e => e.symbol) } }).lean();
            symbolsToSync.forEach(s => {
                if (s.symbol !== 'NIFTY_50') {
                    const match = symbolMaster.find(m => m.symbol === s.symbol);
                    if (match) s.instrument_key = match.instrument_key;
                }
            });

            // 2. Sync each symbol
            for (const s of symbolsToSync) {
                if (!s.instrument_key) continue;
                await this.syncIntraday(s.symbol, s.instrument_key, token);
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            // 3. SNIPER LOGIC (Check at 09:20:15 - 09:25)
            const now = new Date();
            const hour = now.getHours();
            const min = now.getMinutes();
            const sec = now.getSeconds();

            const config = (await (await import('../models/Config')).default.findOne().lean()) || { toggles: { sniperEnabled: true, reversalEnabled: true } };

            const isSniperWindow = config.toggles.sniperEnabled && (hour === 9 && min >= 20 && min < 25);
            const isReversalWindow = config.toggles.reversalEnabled && (hour === 11 && min >= 30 && min < 35);
            const isSquareOffWindow = (hour === 15 && min >= 15 && min < 20);

            // 4. Calculate Context & Strategy Dash
            await this.processStrategyAndSniper(eliteList, isSniperWindow && sec >= 15, isReversalWindow && sec >= 15);

            // 5. Manage Active Trades
            if (isSquareOffWindow) {
                await TradeManagementService.squareOffAll();
            } else {
                await TradeManagementService.manageOpenTrades();
            }

        } catch (error: any) {
            console.error('Heartbeat Core Error:', error.message);
        }
    }

    private async syncIntraday(symbol: string, instrumentKey: string, token: string) {
        try {
            const url = `${this.baseUrl}/${encodeURIComponent(instrumentKey)}/minutes/5`;
            const response = await axios.get(url, {
                headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
            });

            if (response.data?.status === 'success') {
                const candles = response.data.data.candles;
                if (!candles || candles.length === 0) return;

                const bulkOps = candles.map((c: any[]) => ({
                    updateOne: {
                        filter: { symbol, timestamp: new Date(c[0]), interval: '5minute' },
                        update: {
                            $set: {
                                instrument_key: instrumentKey,
                                symbol,
                                timestamp: new Date(c[0]),
                                open: c[1],
                                high: c[2],
                                low: c[3],
                                close: c[4],
                                volume: c[5]
                            }
                        },
                        upsert: true
                    }
                }));

                await IntradayCandle.bulkWrite(bulkOps);
            }
        } catch (err: any) {
            console.error(`Intraday fetch failed for ${symbol}:`, err.message);
        }
    }

    private async processStrategyAndSniper(eliteList: any[], shouldEvaluateSniper: boolean, shouldEvaluateReversal: boolean) {
        const nifty = await IntradayCandle.findOne({ symbol: 'NIFTY_50' }).sort({ timestamp: -1 }).lean();
        const niftyFirst5m = await IntradayCandle.findOne({ symbol: 'NIFTY_50' }).sort({ timestamp: 1 }).lean();
        const nifty1100 = await this.getSnapShotCandle('NIFTY_50', 11, 0);

        // Calculate Strategy Context (With Sunday testing fallbacks)
        const niftyReturn = nifty ? ((nifty.close - nifty.open) / nifty.open) * 100 : 0;
        const niftyReturn1100 = (nifty1100 && nifty) ? ((nifty1100.close - nifty.open) / nifty.open) * 100 : 0;

        // Calculate Index Gap for Sniper Guard (using historical prev close)
        const niftyHist = await this.getHistoricalContext('NIFTY_50');
        const indexGapPercent = niftyFirst5m && niftyHist.prevClose
            ? ((niftyFirst5m.open - niftyHist.prevClose) / niftyHist.prevClose) * 100
            : 0;

        const tableData = [];

        for (const elite of eliteList) {
            const latest = await IntradayCandle.findOne({ symbol: elite.symbol }).sort({ timestamp: -1 }).lean();
            const first5m = await IntradayCandle.findOne({ symbol: elite.symbol }).sort({ timestamp: 1 }).lean(); // 9:15 candle

            // 1. IRS Calculation (Fallback to 0 if no market data today)
            const stockReturn = (latest && latest.open) ? ((latest.close - latest.open) / latest.open) * 100 : 0;
            const irs = stockReturn - niftyReturn;

            const historicalData = await this.getHistoricalContext(elite.symbol);
            const gap = (historicalData.prevClose && first5m) ? ((first5m.open - historicalData.prevClose) / historicalData.prevClose) * 100 : 0;
            const relVol = (historicalData.avgVol915 && first5m) ? first5m.volume / historicalData.avgVol915 : 0;

            const dayHighLow = await IntradayCandle.aggregate([
                { $match: { symbol: elite.symbol } },
                { $group: { _id: null, high: { $max: "$high" }, low: { $min: "$low" } } }
            ]);
            const currentRange = dayHighLow.length > 0 ? (dayHighLow[0].high - dayHighLow[0].low) : 0;
            const adrCoverage = historicalData.avgADR ? (currentRange / historicalData.avgADR) * 100 : 0;

            // --- Phase 6: Sniper Evaluation ---
            if (shouldEvaluateSniper && latest && first5m) {
                await SniperService.evaluateContinuation({
                    symbol: elite.symbol,
                    price: latest.close,
                    irs,
                    relVol,
                    gap,
                    indexGap: indexGapPercent,
                    low915: first5m.low,
                    high915: first5m.high
                });
            }

            // --- Phase 7: Reversal Evaluation ---
            if (shouldEvaluateReversal && latest && first5m) {
                const snapshotCandle = await this.getSnapShotCandle(elite.symbol, 11, 0);
                const stockReturn1100 = (snapshotCandle && snapshotCandle.open) ? ((snapshotCandle.close - snapshotCandle.open) / snapshotCandle.open) * 100 : 0;
                const irs1100 = stockReturn1100 - niftyReturn1100;

                await SniperService.evaluateReversal({
                    symbol: elite.symbol,
                    currentPrice: latest.close,
                    currentIrs: irs,
                    snapshotIrs: irs1100,
                    gap,
                    adrCoverage,
                    dayHigh: dayHighLow.length > 0 ? dayHighLow[0].high : latest.high,
                    dayLow: dayHighLow.length > 0 ? dayHighLow[0].low : latest.low
                });
            }

            tableData.push({
                Stock: elite.symbol,
                Price: latest ? latest.close.toFixed(2) : '0.00',
                'IRS%': irs.toFixed(2) + '%',
                'Gap%': gap.toFixed(2) + '%',
                'RelVol': relVol.toFixed(2) + 'x',
                'ADR%': adrCoverage.toFixed(0) + '%',
                '9:15-Vol': first5m ? first5m.volume : 0
            });
        }

        console.log('\n--- ELITE 10 STRATEGY DASHBOARD ---');
        console.table(tableData);
        console.log(`[Context] Nifty Return: ${niftyReturn.toFixed(2)}% | Index Gap: ${indexGapPercent.toFixed(2)}%`);
        console.log('------------------------------------\n');
    }

    private async getHistoricalContext(symbol: string) {
        // Cache Check: Only recalculate once a day
        const todayStr = new Date().toISOString().split('T')[0];
        const cached = this.contextCache.get(symbol);
        if (cached && cached.lastUpdate === todayStr) {
            return cached;
        }

        // Fetch last 15 days to get 5-day averages and previous close
        const histCandles = await Candle.find({ symbol }).sort({ timestamp: -1 }).limit(1000).lean();

        if (histCandles.length === 0) return { prevClose: 0, avgVol915: 0, avgADR: 0 };

        // Group by day using a lightweight record
        const days: Record<string, any[]> = {};
        histCandles.forEach(c => {
            const date = (c.timestamp as Date).toISOString().split('T')[0];
            if (!days[date]) days[date] = [];
            days[date].push(c);
        });

        const sortedDates = Object.keys(days).sort().reverse();
        
        // Prev Day Close
        const prevClose = days[sortedDates[0]]?.slice().sort((a,b) => b.timestamp - a.timestamp)[0].close || 0;

        // Avg 9:15 Vol (using 5minute interval candles from history)
        const last5Days = sortedDates.slice(0, 5);
        let totalVol915 = 0;
        let totalADR = 0;

        last5Days.forEach(date => {
            const dayCandles = days[date] || [];
            if (dayCandles.length === 0) return;

            const candle915 = dayCandles.sort((a,b) => a.timestamp.getTime() - b.timestamp.getTime())[0];
            if (candle915) totalVol915 += candle915.volume;

            let high = -Infinity;
            let low = Infinity;
            dayCandles.forEach(c => {
                if(c.high > high) high = c.high;
                if(c.low < low) low = c.low;
            });
            totalADR += (high - low);
        });

        const result = {
            prevClose,
            avgVol915: totalVol915 / (last5Days.length || 1),
            avgADR: totalADR / (last5Days.length || 1),
            lastUpdate: todayStr
        };

        this.contextCache.set(symbol, result);
        return result;
    }

    /**
     * Extracts consistent live performance data for the Dashboard Elite 10 Table
     */
    public async getLiveHubData() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const eliteList = await EliteStock.find({ date: today }).sort({ rank: 1 }).lean();
        const nifty = await IntradayCandle.findOne({ symbol: 'NIFTY_50' }).sort({ timestamp: -1 }).lean();
        const niftyReturn = nifty ? ((nifty.close - nifty.open) / nifty.open) * 100 : 0;

        const results = [];
        for (const elite of eliteList) {
            const latest = await IntradayCandle.findOne({ symbol: elite.symbol }).sort({ timestamp: -1 }).lean();
            const first5m = await IntradayCandle.findOne({ symbol: elite.symbol }).sort({ timestamp: 1 }).lean();
            const historicalData = await this.getHistoricalContext(elite.symbol);

            const stockReturn = (latest && latest.open) ? ((latest.close - latest.open) / latest.open) * 100 : 0;
            const irs = stockReturn - niftyReturn;
            const gap = (historicalData.prevClose && first5m) ? ((first5m.open - historicalData.prevClose) / historicalData.prevClose) * 100 : 0;
            const relVol = (historicalData.avgVol915 && first5m) ? first5m.volume / historicalData.avgVol915 : 0;

            const dayHighLow = await IntradayCandle.aggregate([
                { $match: { symbol: elite.symbol } },
                { $group: { _id: null, high: { $max: "$high" }, low: { $min: "$low" } } }
            ]);
            const currentRange = dayHighLow.length > 0 ? (dayHighLow[0].high - dayHighLow[0].low) : 0;
            const adrCoverage = historicalData.avgADR ? (currentRange / historicalData.avgADR) * 100 : 0;

            results.push({
                symbol: elite.symbol,
                ltp: latest ? latest.close : 0,
                irs,
                relVol,
                adr: adrCoverage,
                gap,
                direction: latest ? (latest.close >= latest.open ? '+' : '-') : 'neutral'
            });
        }
        return results;
    }

    private async getSnapShotCandle(symbol: string, hour: number, minute: number) {
        const today = new Date();
        today.setHours(hour, minute, 0, 0);

        // Find the candle closest to this time today
        return await IntradayCandle.findOne({
            symbol,
            timestamp: { $lte: today }
        }).sort({ timestamp: -1 }).lean();
    }
}

export default new IntradayService();
