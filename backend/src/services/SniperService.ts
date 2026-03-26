import Signal from '../models/Signal';
import Config from '../models/Config';

class SniperService {
    /**
     * Evaluates a stock against Phase 6: Continuation Sniper Logic
     */
    public async evaluateContinuation(
        stockData: {
            symbol: string,
            price: number,
            irs: number,
            relVol: number,
            gap: number,
            indexGap: number,
            low915: number,
            high915: number
        }
    ) {
        const { symbol, price, irs, relVol, gap, indexGap, low915, high915 } = stockData;
        const config = await Config.findOne().lean() || await Config.create({});

        // 0. Toggle Check
        if (!config.toggles.sniperEnabled) return null;
        
        // 1. Threshold Checks (Dynamic)
        const isIrsValid = Math.abs(irs) > config.continuation.irsThreshold;
        const isRelVolValid = relVol > config.continuation.relVolThreshold;
        const isGapValid = Math.abs(gap) < config.continuation.gapMax;

        if (!isIrsValid || !isRelVolValid || !isGapValid) return null;

        // 2. Alignment Rule: Sign(Stock Gap) == Sign(IRS Direction)
        const direction = irs > 0 ? 'LONG' : 'SHORT';
        const isAligned = (gap > 0 && direction === 'LONG') || (gap < 0 && direction === 'SHORT');
        
        if (!isAligned) return null;

        // 3. Index Guard: Index must not be gapping against your trade
        const isIndexCounterGapping = (direction === 'LONG' && indexGap < -0.2) || (direction === 'SHORT' && indexGap > 0.2);
        if (isIndexCounterGapping) return null;

        // 4. Calculate SL and TP
        const sl = direction === 'LONG' ? low915 : high915;
        const tp = direction === 'LONG' ? price * 1.02 : price * 0.98;

        // 5. Create Signal
        const today = new Date();
        today.setHours(0,0,0,0);

        try {
            const newSignal = new Signal({
                symbol,
                type: 'CONTINUATION',
                direction,
                date: today,
                entryPrice: price,
                stopLoss: sl,
                takeProfit: tp,
                status: 'OPEN',
                metrics: { irs, relVol, gap }
            });

            await newSignal.save();
            this.logSignal(newSignal);
            return newSignal;
        } catch (error) {
            return null;
        }
    }

    /**
     * Evaluates a stock against Phase 7: Reversal Income Logic
     */
    public async evaluateReversal(
        stockData: {
            symbol: string,
            currentPrice: number,
            currentIrs: number,
            snapshotIrs: number,
            gap: number,
            adrCoverage: number,
            dayHigh: number,
            dayLow: number
        }
    ) {
        const { symbol, currentPrice, currentIrs, snapshotIrs, gap, adrCoverage, dayHigh, dayLow } = stockData;
        const config = await Config.findOne().lean() || await Config.create({});
        const today = new Date();
        today.setHours(0,0,0,0);

        // 0. Toggle & Eligibility Check
        if (!config.toggles.reversalEnabled) return null;
        const existingSignal = await Signal.findOne({ symbol, date: today, type: 'CONTINUATION' }).lean();
        if (existingSignal) return null;

        // 1. Static Thresholds (Dynamic)
        const isIrsExtreme = Math.abs(currentIrs) > config.reversal.irsThreshold;
        const isExhausted = adrCoverage > config.reversal.adrThreshold;
        const isSignificantGap = Math.abs(gap) > config.reversal.gapMin;

        if (!isIrsExtreme || !isExhausted || !isSignificantGap) return null;

        // 2. Flattening Trigger (Dynamic)
        let direction: 'LONG' | 'SHORT' = currentIrs > 0 ? 'SHORT' : 'LONG';
        let isFlattening = false;

        if (direction === 'SHORT') {
            isFlattening = currentIrs <= (snapshotIrs - config.reversal.flatteningThreshold);
        } else {
            isFlattening = currentIrs >= (snapshotIrs + config.reversal.flatteningThreshold);
        }

        if (!isFlattening) return null;

        // 3. Calculate SL & TP
        const sl = direction === 'SHORT' ? dayHigh * 1.003 : dayLow * 0.997;
        const tp = direction === 'SHORT' ? currentPrice * 0.99 : currentPrice * 1.01;

        try {
            const newSignal = new Signal({
                symbol,
                type: 'REVERSAL',
                direction,
                date: today,
                entryPrice: currentPrice,
                stopLoss: sl,
                takeProfit: tp,
                status: 'OPEN',
                metrics: { irs: currentIrs, relVol: 0, gap }
            });

            await newSignal.save();
            this.logSignal(newSignal);
            return newSignal;
        } catch (error) {
            return null;
        }
    }

    private logSignal(signal: any) {
        console.log('\n*****************************************');
        console.log(`🚀 ${signal.type} SIGNAL: ${signal.direction} ${signal.symbol} @ ${signal.entryPrice}`);
        console.log(`SL: ${signal.stopLoss.toFixed(2)} | TP: ${signal.takeProfit.toFixed(2)}`);
        if (signal.type === 'REVERSAL') {
            console.log(`Metrics: IRS ${signal.metrics.irs.toFixed(2)}% | Gap ${signal.metrics.gap.toFixed(2)}%`);
        }
        console.log('*****************************************\n');
    }
}

export default new SniperService();
