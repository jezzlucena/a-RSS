import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

const entrySummarySchema = new Schema(
  {
    intro: { type: String, default: null },
    bullets: { type: [String], required: true },
    model: { type: String, required: true },
    generatedAt: { type: Date, required: true },
  },
  { _id: false },
);

const entryImageSchema = new Schema(
  {
    url: { type: String, required: true },
    source: { type: String, enum: ['og', 'inline', 'placeholder'], required: true },
  },
  { _id: false },
);

const entrySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sourceId: { type: Schema.Types.ObjectId, ref: 'Source', required: true, index: true },
    guid: { type: String, required: true },
    url: { type: String, required: true },
    title: { type: String, required: true },
    publishedAt: { type: Date, required: true, index: true },
    description: { type: String, default: null },
    rawHtml: { type: String, default: null },
    summary: { type: entrySummarySchema, default: null },
    image: { type: entryImageSchema, default: null },
    processingState: {
      type: String,
      enum: ['pending', 'fetched', 'summarized', 'failed'],
      default: 'pending',
      index: true,
    },
    error: { type: String, default: null },
  },
  { timestamps: true },
);

entrySchema.index({ sourceId: 1, guid: 1 }, { unique: true });
entrySchema.index({ userId: 1, publishedAt: -1, _id: -1 });

export type EntryDoc = HydratedDocument<InferSchemaType<typeof entrySchema>>;
export const Entry = model('Entry', entrySchema);
