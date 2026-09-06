import { User } from '../models/user.js';
import { logger } from './logger.js';

/**
 * One-shot, idempotent data migrations run on boot (after Mongo connects, before Agenda).
 * Uses the native collection because Mongoose strict mode would drop writes to fields that
 * are no longer in the schema.
 */
export async function runStartupMigrations(): Promise<void> {
  await migrateAnthropicKeyToLlmCredentials();
}

// Before multi-provider support the Anthropic key lived at `anthropicApiKeyEnc`. Move it
// into `llm.credentials.anthropic` (unless one is already there) and drop the old field.
async function migrateAnthropicKeyToLlmCredentials(): Promise<void> {
  const users = User.collection;
  const copied = await users.updateMany(
    { anthropicApiKeyEnc: { $type: 'string' }, 'llm.credentials.anthropic.apiKeyEnc': { $in: [null] } },
    [
      {
        $set: {
          'llm.provider': { $ifNull: ['$llm.provider', 'anthropic'] },
          'llm.credentials.anthropic.apiKeyEnc': '$anthropicApiKeyEnc',
          'llm.credentials.anthropic.model': { $ifNull: ['$llm.credentials.anthropic.model', null] },
          'llm.credentials.anthropic.baseUrl': null,
        },
      },
    ],
  );
  const dropped = await users.updateMany({ anthropicApiKeyEnc: { $exists: true } }, { $unset: { anthropicApiKeyEnc: '' } });
  if (copied.modifiedCount > 0 || dropped.modifiedCount > 0) {
    logger.info(
      { copied: copied.modifiedCount, dropped: dropped.modifiedCount },
      'migrated anthropicApiKeyEnc → llm.credentials.anthropic',
    );
  }
}
