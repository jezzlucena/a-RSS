import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, default: null },
    googleSub: { type: String, default: null, index: true, sparse: true },
    appleSub: { type: String, default: null, index: true, sparse: true },
    displayName: { type: String, default: null },
    anthropicApiKeyEnc: { type: String, default: null },
  },
  { timestamps: true },
);

export type UserDoc = HydratedDocument<InferSchemaType<typeof userSchema>>;
export const User = model('User', userSchema);
