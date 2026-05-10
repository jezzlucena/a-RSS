import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

const authTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    kind: { type: String, enum: ['magic', 'refresh'], required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// TTL index — Mongo auto-deletes expired tokens
authTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type AuthTokenDoc = HydratedDocument<InferSchemaType<typeof authTokenSchema>>;
export const AuthToken = model('AuthToken', authTokenSchema);
