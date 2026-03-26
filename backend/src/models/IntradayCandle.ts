import mongoose, { Schema, Document } from 'mongoose';

export interface IIntradayCandle extends Document {
    instrument_key: string;
    symbol: string;
    timestamp: Date;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    interval: string;
}

const IntradayCandleSchema: Schema = new Schema({
    instrument_key: { type: String, required: true },
    symbol: { type: String, required: true },
    timestamp: { type: Date, required: true },
    open: { type: Number, required: true },
    high: { type: Number, required: true },
    low: { type: Number, required: true },
    close: { type: Number, required: true },
    volume: { type: Number, required: true },
    interval: { type: String, required: true, default: '5minute' }
});

// Compound index for fast querying and prevent duplicates
IntradayCandleSchema.index({ symbol: 1, timestamp: 1, interval: 1 }, { unique: true });

export default mongoose.model<IIntradayCandle>('IntradayCandle', IntradayCandleSchema);
