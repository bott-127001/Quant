import mongoose, { Schema, Document } from 'mongoose';

export interface ICandle extends Document {
    instrument_key: string;
    symbol: string;
    timestamp: Date;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    interval: string; // e.g., '1minute', '5minute', 'day'
}

const CandleSchema: Schema = new Schema({
    instrument_key: { type: String, required: true, index: true },
    symbol: { type: String, required: true, index: true },
    timestamp: { type: Date, required: true, index: true },
    open: { type: Number, required: true },
    high: { type: Number, required: true },
    low: { type: Number, required: true },
    close: { type: Number, required: true },
    volume: { type: Number, required: true },
    interval: { type: String, required: true, index: true }
});

// Compound index for efficient querying of time-series data
CandleSchema.index({ instrument_key: 1, timestamp: -1 });

export default mongoose.model<ICandle>('Candle', CandleSchema);
