import mongoose, { Schema, Document } from 'mongoose';

export interface ISignal extends Document {
    symbol: string;
    type: 'CONTINUATION' | 'REVERSAL';
    direction: 'LONG' | 'SHORT';
    date: Date;
    entryPrice: number;
    stopLoss: number;
    takeProfit: number;
    status: 'OPEN' | 'CLOSED';
    exitPrice?: number;
    exitReason?: 'TP' | 'SL' | 'SQUARE_OFF' | 'TRAILING_SL';
    pnl?: number;
    pnlPercentage?: number;
    metrics: {
        irs: number;
        relVol: number;
        gap: number;
    };
}

const SignalSchema: Schema = new Schema({
    symbol: { type: String, required: true },
    type: { type: String, enum: ['CONTINUATION', 'REVERSAL'], required: true },
    direction: { type: String, enum: ['LONG', 'SHORT'], required: true },
    date: { type: Date, required: true },
    entryPrice: { type: Number, required: true },
    stopLoss: { type: Number, required: true },
    takeProfit: { type: Number, required: true },
    status: { type: String, enum: ['OPEN', 'CLOSED'], default: 'OPEN' },
    exitPrice: { type: Number },
    exitReason: { type: String, enum: ['TP', 'SL', 'SQUARE_OFF', 'TRAILING_SL'] },
    pnl: { type: Number },
    pnlPercentage: { type: Number },
    metrics: {
        irs: { type: Number },
        relVol: { type: Number },
        gap: { type: Number }
    }
}, { timestamps: true });

// Ensure one continuation trade per day per stock
SignalSchema.index({ date: 1, symbol: 1, type: 1 }, { unique: true });

// Automatically expire trade logs older than 45 days
// MongoDB TTL indexes run in the background (not immediate to-the-second).
SignalSchema.index({ createdAt: 1 }, { expireAfterSeconds: 45 * 24 * 60 * 60 });

export default mongoose.model<ISignal>('Signal', SignalSchema);
