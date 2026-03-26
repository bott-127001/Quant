import Signal, { ISignal } from '../models/Signal';
import IntradayCandle from '../models/IntradayCandle';

class TradeManagementService {
    /**
     * Managed active trades: Checks targets, stop losses, and handles trailing SL
     */
    public async manageOpenTrades() {
        const today = new Date();
        today.setHours(0,0,0,0);

        const openSignals = await Signal.find({ status: 'OPEN', date: today });
        if (openSignals.length === 0) return;

        console.log(`--- Managing ${openSignals.length} Active Trades ---`);

        for (const signal of openSignals) {
            const latestPrice = await IntradayCandle.findOne({ symbol: signal.symbol }).sort({ timestamp: -1 }).lean();
            if (!latestPrice) continue;

            await this.checkExits(signal, latestPrice.close);
        }
    }

    /**
     * Force close all trades at 03:15 PM
     */
    public async squareOffAll() {
        const today = new Date();
        today.setHours(0,0,0,0);

        const openSignals = await Signal.find({ status: 'OPEN', date: today });
        if (openSignals.length === 0) return;

        console.log('--- 03:15 PM: FORCED SQUARE OFF INITIATED ---');

        for (const signal of openSignals) {
            const latestPrice = await IntradayCandle.findOne({ symbol: signal.symbol }).sort({ timestamp: -1 }).lean();
            const exitPrice = latestPrice ? latestPrice.close : signal.entryPrice;

            await this.closeSignal(signal, exitPrice, 'SQUARE_OFF');
        }
    }

    private async checkExits(signal: ISignal, currentPrice: number) {
        let isClosed = false;
        let exitReason: 'TP' | 'SL' | 'SQUARE_OFF' | 'TRAILING_SL' | undefined;

        // 1. Check Technical Exits
        if (signal.direction === 'LONG') {
            if (currentPrice >= signal.takeProfit) {
                isClosed = true;
                exitReason = 'TP';
            } else if (currentPrice <= signal.stopLoss) {
                isClosed = true;
                exitReason = 'SL';
            }
        } else { // SHORT
            if (currentPrice <= signal.takeProfit) {
                isClosed = true;
                exitReason = 'TP';
            } else if (currentPrice >= signal.stopLoss) {
                isClosed = true;
                exitReason = 'SL';
            }
        }

        if (isClosed && exitReason) {
            await this.closeSignal(signal, currentPrice, exitReason);
            return;
        }

        // 2. Trailing SL Logic (Only for CONTINUATION Snippets)
        if (signal.type === 'CONTINUATION') {
            const profitPct = signal.direction === 'LONG' 
                ? ((currentPrice - signal.entryPrice) / signal.entryPrice) * 100
                : ((signal.entryPrice - currentPrice) / signal.entryPrice) * 100;

            // If profit hits 1%, move SL to Entry Price (Breakeven)
            if (profitPct >= 1.0 && signal.stopLoss !== signal.entryPrice) {
                console.log(`🛡️ TRAILING SL: ${signal.symbol} moved to Breakeven (${signal.entryPrice})`);
                signal.stopLoss = signal.entryPrice;
                await signal.save();
            }
        }
    }

    private async closeSignal(signal: ISignal, exitPrice: number, reason: 'TP' | 'SL' | 'SQUARE_OFF' | 'TRAILING_SL') {
        const pnl = signal.direction === 'LONG' 
            ? exitPrice - signal.entryPrice 
            : signal.entryPrice - exitPrice;
        
        const pnlPct = (pnl / signal.entryPrice) * 100;

        signal.status = 'CLOSED';
        signal.exitPrice = exitPrice;
        signal.exitReason = reason;
        signal.pnl = pnl;
        signal.pnlPercentage = pnlPct;

        await signal.save();

        console.log(`✅ TRADE CLOSED: ${signal.symbol} | Result: ${pnlPct.toFixed(2)}% | Reason: ${reason}`);
    }
}

export default new TradeManagementService();
