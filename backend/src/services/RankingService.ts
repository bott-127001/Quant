import Candle from '../models/Candle';
import Symbol from '../models/Symbol';
import EliteStock from '../models/EliteStock';
import cron from 'node-cron';

class RankingService {
    /**
     * The Heart of the Elite 10: Point System Ranking
     */
    public async calculateElite10() {
        console.log('--- Phase 4: Starting Elite 10 Ranking Engine ---');
        
        // 1. Get Nifty 50 Index Returns (The Benchmark)
        const niftyCandles = await Candle.find({ symbol: 'NIFTY_50' }).sort({ timestamp: 1 }).lean();
        if (niftyCandles.length < 100) {
            console.error(`--- Insufficient Data: Found ${niftyCandles.length} Nifty candles, need at least 100. ---`);
            throw new Error(`Insufficient Nifty 50 data (${niftyCandles.length}/100). Please click the main SYNC button and wait for it to finish.`);
        }
        
        const indexReturns = this.calculateReturns(niftyCandles);
        const niftyTimestamps = niftyCandles.map(c => c.timestamp.getTime());

        // 2. Calculate Beta & Correlation for all symbols
        const stockList = await Symbol.find({ segment: 'NSE_EQ' }).lean();
        const results: any[] = [];

        for (const stock of stockList) {
            const stockCandles = await Candle.find({ symbol: stock.symbol }).sort({ timestamp: 1 }).lean();
            if (stockCandles.length < 100) {
                console.warn(`Skipping ${stock.symbol}: Not enough data.`);
                continue;
            }

            // Align stock returns with Index timestamps for mathematical accuracy
            const alignedReturns = this.alignAndCalculateReturns(stockCandles, niftyTimestamps, indexReturns);
            
            if (alignedReturns.stock.length < 50) continue;

            const beta = this.calculateBeta(alignedReturns.stock, alignedReturns.index);
            const correlation = this.calculateCorrelation(alignedReturns.stock, alignedReturns.index);

            results.push({
                symbol: stock.symbol,
                beta,
                correlation
            });
        }

        // 3. APPLY POINT SYSTEM
        // Sort by Beta (Highest gets 50 points)
        results.sort((a, b) => b.beta - a.beta);
        results.forEach((res, idx) => res.betaPoints = results.length - idx);

        // Sort by Correlation (Lowest gets 50 points)
        results.sort((a, b) => a.correlation - b.correlation);
        results.forEach((res, idx) => res.correlationPoints = results.length - idx);

        // Calculate Final Strength
        results.forEach(res => res.totalPoints = res.betaPoints + res.correlationPoints);

        // 4. Final Rank & Select Top 10
        results.sort((a, b) => b.totalPoints - a.totalPoints);
        const top10 = results.slice(0, 10);

        // 5. Save to MongoDB
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        await EliteStock.deleteMany({}); // Clear all previous results to keep only current Elite 10
        
        const eliteDocs = top10.map((res, idx) => ({
            symbol: res.symbol,
            date: today,
            beta: res.beta,
            correlation: res.correlation,
            betaPoints: res.betaPoints,
            correlationPoints: res.correlationPoints,
            totalPoints: res.totalPoints,
            rank: idx + 1
        }));

        await EliteStock.insertMany(eliteDocs);

        console.log('--- Elite 10 Selection Complete ---');
        console.table(top10.map(r => ({
            Symbol: r.symbol,
            Points: r.totalPoints,
            Beta: r.beta.toFixed(2),
            Corr: r.correlation.toFixed(2)
        })));

        return top10;
    }

    private calculateReturns(candles: any[]) {
        const returns = [];
        for (let i = 1; i < candles.length; i++) {
            const ret = (candles[i].close - candles[i-1].close) / candles[i-1].close;
            returns.push(ret);
        }
        return returns;
    }

    private alignAndCalculateReturns(stockCandles: any[], indexTimestamps: number[], indexReturns: number[]) {
        const stockMap = new Map();
        stockCandles.forEach(c => stockMap.set(c.timestamp.getTime(), c.close));

        const alignedStockReturns = [];
        const alignedIndexReturns = [];

        // Skip the first timestamp as we need t-1 for returns
        for (let i = 1; i < indexTimestamps.length; i++) {
            const currentTime = indexTimestamps[i];
            const prevTime = indexTimestamps[i-1];

            if (stockMap.has(currentTime) && stockMap.has(prevTime)) {
                const stockRet = (stockMap.get(currentTime) - stockMap.get(prevTime)) / stockMap.get(prevTime);
                alignedStockReturns.push(stockRet);
                alignedIndexReturns.push(indexReturns[i-1]);
            }
        }

        return { stock: alignedStockReturns, index: alignedIndexReturns };
    }

    private calculateBeta(stockReturns: number[], indexReturns: number[]) {
        const meanIndex = indexReturns.reduce((a, b) => a + b, 0) / indexReturns.length;
        let covariance = 0;
        let varianceIndex = 0;

        const meanStock = stockReturns.reduce((a, b) => a + b, 0) / stockReturns.length;

        for (let i = 0; i < stockReturns.length; i++) {
            covariance += (stockReturns[i] - meanStock) * (indexReturns[i] - meanIndex);
            varianceIndex += Math.pow(indexReturns[i] - meanIndex, 2);
        }

        return varianceIndex === 0 ? 0 : covariance / varianceIndex;
    }

    private calculateCorrelation(stockReturns: number[], indexReturns: number[]) {
        const meanStock = stockReturns.reduce((a, b) => a + b, 0) / stockReturns.length;
        const meanIndex = indexReturns.reduce((a, b) => a + b, 0) / indexReturns.length;

        let num = 0;
        let denStock = 0;
        let denIndex = 0;

        for (let i = 0; i < stockReturns.length; i++) {
            const dS = stockReturns[i] - meanStock;
            const dI = indexReturns[i] - meanIndex;
            num += (dS * dI);
            denStock += dS * dS;
            denIndex += dI * dI;
        }

        const denominator = Math.sqrt(denStock * denIndex);
        return denominator === 0 ? 0 : num / denominator;
    }

    /**
     * Automated Scheduler: Runs daily at 08:45 AM IST (P4)
     */
    public startAutomatedRanking() {
        console.log('--- Ranking Scheduler Started (08:45 IST) ---');
        cron.schedule('45 8 * * 1-5', async () => {
            try {
                await this.calculateElite10();
            } catch (err: any) {
                console.error('Automated Ranking Failed:', err.message);
            }
        }, {
            timezone: "Asia/Kolkata"
        });
    }
}

export default new RankingService();
