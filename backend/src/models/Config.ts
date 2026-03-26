import mongoose, { Schema, Document } from 'mongoose';

export interface IConfig extends Document {
    continuation: {
        irsThreshold: number;
        relVolThreshold: number;
        gapMax: number;
    };
    reversal: {
        irsThreshold: number;
        adrThreshold: number;
        gapMin: number;
        flatteningThreshold: number;
    };
    toggles: {
        sniperEnabled: boolean;
        reversalEnabled: boolean;
        autoTrading: boolean;
    };
    updatedAt: Date;
}

const ConfigSchema: Schema = new Schema({
    continuation: {
        irsThreshold: { type: Number, default: 0.45 },
        relVolThreshold: { type: Number, default: 1.3 },
        gapMax: { type: Number, default: 0.80 }
    },
    reversal: {
        irsThreshold: { type: Number, default: 1.0 },
        adrThreshold: { type: Number, default: 80 },
        gapMin: { type: Number, default: 0.50 },
        flatteningThreshold: { type: Number, default: 0.3 }
    },
    toggles: {
        sniperEnabled: { type: Boolean, default: true },
        reversalEnabled: { type: Boolean, default: true },
        autoTrading: { type: Boolean, default: false }
    }
}, { timestamps: true });

export default mongoose.model<IConfig>('Config', ConfigSchema);
