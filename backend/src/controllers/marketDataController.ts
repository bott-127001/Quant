import { Request, Response } from 'express';
import MarketDataService from '../services/MarketDataService';
import InstrumentService from '../services/InstrumentService';
import RankingService from '../services/RankingService';
import IntradayService from '../services/IntradayService';
import Signal from '../models/Signal';
import IntradayCandle from '../models/IntradayCandle';

export const getDashboardData = async (req: Request, res: Response) => {
    try {
        const today = new Date();
        today.setHours(0,0,0,0);

        // 1. Get Nifty Context
        const nifty = await IntradayCandle.findOne({ symbol: 'NIFTY_50' }).sort({ timestamp: -1 });
        const niftyPrev = await IntradayCandle.findOne({ symbol: 'NIFTY_50' }).sort({ timestamp: 1 });
        const niftyChange = nifty && niftyPrev ? ((nifty.close - niftyPrev.open) / niftyPrev.open) * 100 : 0;

        // 2. Get Open Signals
        const signals = await Signal.find({ status: 'OPEN', date: today });

        // 3. Get Elite 10 Status (Delegated to IntradayService for data consistency)
        const elite10 = await IntradayService.getLiveHubData();

        res.json({
            nifty: {
                ltp: nifty ? nifty.close : 0,
                change: niftyChange,
                lastUpdate: nifty ? nifty.timestamp : new Date()
            },
            signals,
            elite10
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const getTradeLogs = async (req: Request, res: Response) => {
    try {
        // Retain only the last 45 days of trade logs
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 45);

        await Signal.deleteMany({ date: { $lt: cutoff } });

        const logs = await Signal.find({ date: { $gte: cutoff } }).sort({ date: -1, _id: -1 });
        res.json(logs);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const setupSymbols = async (req: Request, res: Response) => {
    try {
        console.log('--- [Manual Trigger] Setting up Symbol Master ---');
        await InstrumentService.setupSymbolMaster();
        console.log('--- Symbol Master Setup Done ---');
        res.status(200).send('Symbol master setup complete. Keys are now mapped in MongoDB.');
    } catch (error: any) {
        console.error('Setup Symbols Failed:', error.message);
        res.status(500).send({ error: error.message });
    }
};

export const triggerRollingSync = async (req: Request, res: Response) => {
    try {
        console.log('--- [Manual Trigger] Rolling Sync Started ---');
        // This handles both initial backfill and daily gap filling automatically
        MarketDataService.runRollingSync().then(() => {
            console.log('--- [Background] Rolling Sync Finished Successfully ---');
        }).catch((err) => {
            console.error('--- [Background] Rolling Sync CRASHED ---', err.message);
        });

        res.status(200).send('Optimized rolling sync started in the background (4:00 PM logic active).');
    } catch (error: any) {
        console.error('Rolling Sync Trigger Failed:', error.message);
        res.status(500).send({ error: error.message });
    }
};

export const triggerRanking = async (req: Request, res: Response) => {
    try {
        console.log('Ranking calculation triggered...');
        const results = await RankingService.calculateElite10();
        res.status(200).json({
            message: 'Ranking complete.',
            top10: results.map(r => ({ symbol: r.symbol, rank: r.rank }))
        });

        // Automatically start the live heartbeat engine after ranking
        IntradayService.startMarketHeartbeat();
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

export const triggerHeartbeat = async (req: Request, res: Response) => {
    try {
        await IntradayService.runHeartbeat();
        res.status(200).send('Heartbeat successful. Fresh intraday data synced and strategy metrics updated.');
    } catch (error: any) {
        console.error('Heartbeat Trigger Failed:', error.message);
        res.status(500).json({ error: error.message });
    }
};
