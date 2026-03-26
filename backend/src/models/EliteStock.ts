import mongoose, { Schema, Document } from 'mongoose';

export interface IEliteStock extends Document {
    symbol: string;
    date: Date;
    beta: number;
    correlation: number;
    betaPoints: number;
    correlationPoints: number;
    totalPoints: number;
    rank: number;
}

const EliteStockSchema: Schema = new Schema({
    symbol: { type: String, required: true },
    date: { type: Date, required: true },
    beta: { type: Number, required: true },
    correlation: { type: Number, required: true },
    betaPoints: { type: Number, required: true },
    correlationPoints: { type: Number, required: true },
    totalPoints: { type: Number, required: true },
    rank: { type: Number, required: true }
});

// Index for quick retrieval of latest ranking
EliteStockSchema.index({ date: -1, rank: 1 });

export default mongoose.model<IEliteStock>('EliteStock', EliteStockSchema);
