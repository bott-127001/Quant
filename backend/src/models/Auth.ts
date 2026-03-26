import mongoose, { Schema, Document } from 'mongoose';

export interface IAuth extends Document {
    accessToken: string;
    refreshToken?: string;
    expiresIn: number;
    tokenType: string;
    createdAt: Date;
}

const AuthSchema: Schema = new Schema({
    accessToken: { type: String, required: true },
    refreshToken: { type: String },
    expiresIn: { type: Number, required: true },
    tokenType: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

// Calculate if the token is still valid (expire after 1 day)
AuthSchema.virtual('isValid').get(function (this: IAuth) {
    const twentyFourHours = 24 * 60 * 60 * 1000;
    return (Date.now() - this.createdAt.getTime()) < twentyFourHours;
});

export default mongoose.model<IAuth>('Auth', AuthSchema);
