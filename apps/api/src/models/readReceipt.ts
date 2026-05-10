import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

const readReceiptSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    entryId: { type: Schema.Types.ObjectId, ref: 'Entry', required: true },
    feedContext: { type: String, required: true }, // 'all' | 'category:<id>' | 'source:<id>'
    readAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: false },
);

readReceiptSchema.index({ userId: 1, entryId: 1, feedContext: 1 }, { unique: true });

export type ReadReceiptDoc = HydratedDocument<InferSchemaType<typeof readReceiptSchema>>;
export const ReadReceipt = model('ReadReceipt', readReceiptSchema);
