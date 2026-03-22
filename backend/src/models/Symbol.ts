import mongoose, { Schema, Document } from 'mongoose';

export interface ISymbol extends Document {
    symbol: string;
    instrument_key: string;
    segment: string;
    last_sync: Date | null;
}

const SymbolSchema: Schema = new Schema({
    symbol: { type: String, required: true, unique: true },
    instrument_key: { type: String, required: true, unique: true },
    segment: { type: String, default: 'NSE_EQ' },
    last_sync: { type: Date, default: null }
});

export default mongoose.model<ISymbol>('Symbol', SymbolSchema);
