import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { llmProviderId } from '@a-rss/shared';

// One entry per provider the user has configured. Keys are AES-256-GCM encrypted with
// USER_SECRETS_KEY (see services/userSecrets.ts); model/baseUrl are optional overrides.
const llmCredentialSchema = new Schema(
  {
    apiKeyEnc: { type: String, default: null },
    model: { type: String, default: null },
    baseUrl: { type: String, default: null },
  },
  { _id: false },
);

const llmSettingsSchema = new Schema(
  {
    provider: { type: String, enum: llmProviderId.options, default: 'anthropic' },
    credentials: { type: Map, of: llmCredentialSchema, default: () => new Map() },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, default: null },
    googleSub: { type: String, default: null, index: true, sparse: true },
    appleSub: { type: String, default: null, index: true, sparse: true },
    displayName: { type: String, default: null },
    llm: { type: llmSettingsSchema, default: () => ({}) },
  },
  { timestamps: true },
);

export type UserDoc = HydratedDocument<InferSchemaType<typeof userSchema>>;
export const User = model('User', userSchema);
