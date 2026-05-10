import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

const DEFAULT_POLL_INTERVAL_MS = 30 * 60_000; // 30 minutes

const sourceSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    feedUrl: { type: String, required: true, trim: true },
    siteUrl: { type: String, default: null },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    /** True when the user manually set the title; pollSource will then leave the
     *  title alone instead of replacing it with the feed's `<title>` on every poll. */
    titleOverridden: { type: Boolean, default: false },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', default: null, index: true },
    etag: { type: String, default: null },
    lastModified: { type: String, default: null },
    lastPolledAt: { type: Date, default: null },
    pollIntervalMs: { type: Number, default: DEFAULT_POLL_INTERVAL_MS },
    bypassStrategy: {
      type: String,
      enum: ['default', 'ladder', 'googlebot', 'wayback', 'archive_ph', 'none'],
      default: 'default',
    },
  },
  { timestamps: true },
);

sourceSchema.index({ userId: 1, feedUrl: 1 }, { unique: true });

export type SourceDoc = HydratedDocument<InferSchemaType<typeof sourceSchema>>;
export const Source = model('Source', sourceSchema);
