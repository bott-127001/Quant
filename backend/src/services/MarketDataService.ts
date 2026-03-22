import axios from 'axios';
import Auth from '../models/Auth';
import Candle from '../models/Candle';
import InstrumentService from './InstrumentService';
import cron from 'node-cron';

class MarketDataService {
    private baseUrl = 'https://api.upstox.com/v3/historical-candle';

    private async getAccessToken(): Promise<string> {
        const auth = await Auth.findOne().sort({ createdAt: -1 }).lean();
        if (!auth || !auth.accessToken) {
            throw new Error('No access token found in database. Perform login first.');
        }
        return auth.accessToken;
    }

    public async syncStockData(symbolDoc: any, interval: string = '5minute') {
        try {
            const token = await this.getAccessToken();
            const { symbol, instrument_key } = symbolDoc;

            // 1. Check for latest 5-min candle to determine Delta Sync
            const latestCandle = await Candle.findOne({ symbol, interval }).sort({ timestamp: -1 }).lean();

            let finalFromDate: Date;
            if (latestCandle) {
                finalFromDate = new Date(latestCandle.timestamp);
                console.log(`Resuming 5m sync for ${symbol} from ${finalFromDate.toISOString()}`);
            } else {
                finalFromDate = new Date();
                finalFromDate.setDate(finalFromDate.getDate() - 45); // Keep 45 days for safety
                console.log(`Starting fresh 45-day 5m backfill for ${symbol}...`);
            }

            const today = new Date();
            let currentToDate = new Date(today);

            // Upstox V3: 1-month limit for intraday data (1-15 min)
            while (currentToDate > finalFromDate) {
                let currentFromDate = new Date(currentToDate);
                currentFromDate.setMonth(currentFromDate.getMonth() - 1); // 1-month chunking (Safe for V3)
                
                if (currentFromDate < finalFromDate) {
                    currentFromDate = new Date(finalFromDate);
                }

                const toDateStr = currentToDate.toISOString().split('T')[0];
                const fromDateStr = currentFromDate.toISOString().split('T')[0];

                const url = `${this.baseUrl}/${encodeURIComponent(instrument_key)}/minutes/5/${toDateStr}/${fromDateStr}`;

                const response = await axios.get(url, {
                    headers: {
                        'Accept': 'application/json',
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (response.data && response.data.status === 'success') {
                    const candles = response.data.data.candles;
                    if (candles && candles.length > 0) {
                        const candleDocs = candles.map((c: any[]) => ({
                            instrument_key,
                            symbol,
                            timestamp: new Date(c[0]),
                            open: c[1],
                            high: c[2],
                            low: c[3],
                            close: c[4],
                            volume: c[5],
                            interval
                        }));

                        const bulkOps = candleDocs.map((doc: any) => ({
                            updateOne: {
                                filter: { instrument_key, timestamp: doc.timestamp, interval },
                                update: { $set: doc },
                                upsert: true
                            }
                        }));

                        const result = await Candle.bulkWrite(bulkOps);
                        console.log(`Synced ${candleDocs.length} (5m) candles for ${symbol} [${fromDateStr} to ${toDateStr}]. (Matched: ${result.matchedCount})`);
                    }
                } else {
                    console.warn(`Upstox V3 error for ${symbol}:`, response.data);
                    break;
                }

                // Move backward in time
                currentToDate = new Date(currentFromDate);
                
                // Rate Limiting: 1 second delay between chunks (prevents bursting)
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        } catch (error: any) {
            console.error(`V3 Sync failed for ${symbolDoc.symbol}:`, error.response?.data || error.message);
        }
    }

    /**
     * The "Golden Sync" (5-Minute Timeframe - V3 Edition)
     */
    public async runRollingSync() {
        console.log('--- Starting Optimized V3 Rolling Sync (5-Minute) ---');
        const symbols = await InstrumentService.getAllSymbols();

        if (symbols.length === 0) {
            await InstrumentService.setupSymbolMaster();
        }

        const allSymbols = await InstrumentService.getAllSymbols();
        for (const symbolDoc of allSymbols) {
            await this.syncStockData(symbolDoc, '5minute');
            
            // Rate Limiting: 1.5 second delay between symbols
            // For Nifty 50 (~102 calls), this spreads execution over ~4-5 minutes.
            // Result: ~24 calls/min (Extremely safe for 300/min and 1750/30min limits)
            await new Promise(resolve => setTimeout(resolve, 1500));
        }

        // Keep a clean 45-day window
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 45);
        await Candle.deleteMany({ timestamp: { $lt: cutoff } });

        console.log('--- V3 Rolling Sync Complete (5-Minute) ---');
    }

    /**
     * Automated Scheduler: Runs daily at 04:00 PM IST (P3)
     */
    public startRollingSyncScheduler() {
        console.log('--- Sync Scheduler Started (16:00 IST) ---');
        cron.schedule('0 16 * * 1-5', async () => {
            try {
                await this.runRollingSync();
            } catch (err: any) {
                console.error('Rolling Sync Failed:', err.message);
            }
        }, {
            timezone: "Asia/Kolkata"
        });
    }
}

export default new MarketDataService();
