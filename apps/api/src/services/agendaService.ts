import Agenda, { type Job } from 'agenda';
import { env } from '../config/env.js';
import { pollSource } from '../jobs/pollSource.js';
import { processEntry } from '../jobs/processEntry.js';
import { Source } from '../models/source.js';
import { Entry } from '../models/entry.js';
import { logger } from './logger.js';

let agenda: Agenda | null = null;

const POLL_JOB = 'poll-source';
const PROCESS_JOB = 'process-entry';

const PROCESS_BACKOFF_MIN = [5, 30] as const; // attempt 1 fail → 5min; attempt 2 fail → 30min
const PROCESS_MAX_ATTEMPTS = 3;

interface ProcessJobData {
  entryId: string;
  attempt?: number;
}

export async function initAgenda(): Promise<void> {
  // One-shot migration: 12ft.io was discontinued. Sources still set to it get
  // bumped back to the default chain.
  const migrated = await Source.updateMany(
    { bypassStrategy: '12ft' },
    { $set: { bypassStrategy: 'default' } },
  );
  if (migrated.modifiedCount > 0) {
    logger.info(
      { migrated: migrated.modifiedCount },
      "migrated sources from bypassStrategy '12ft' → 'default'",
    );
  }

  agenda = new Agenda({
    db: { address: env.MONGO_URL, collection: 'agenda_jobs' },
    processEvery: '30 seconds',
    defaultLockLifetime: 5 * 60_000,
  });

  agenda.define(POLL_JOB, { concurrency: 4 }, async (job: Job) => {
    const { sourceId } = job.attrs.data as { sourceId: string };
    try {
      const result = await pollSource(sourceId);
      if (result.inserted > 0) {
        logger.info({ sourceId, inserted: result.inserted }, 'poll: new entries');
      }
      if (result.intervalChanged) {
        logger.debug(
          { sourceId, pollIntervalMs: result.pollIntervalMs },
          'poll: adjusted interval',
        );
        await schedulePoll(sourceId, result.pollIntervalMs);
      }
      if (agenda) {
        for (const id of result.insertedIds) {
          await agenda.now(PROCESS_JOB, { entryId: id, attempt: 1 } satisfies ProcessJobData);
        }
      }
    } catch (err) {
      logger.warn({ sourceId, err: (err as Error).message }, 'poll: failed');
    }
  });

  agenda.define(PROCESS_JOB, { concurrency: 2 }, async (job: Job) => {
    const data = job.attrs.data as ProcessJobData;
    const attempt = data.attempt ?? 1;
    try {
      await processEntry(data.entryId);
    } catch (err) {
      const nextAttempt = attempt + 1;
      if (nextAttempt > PROCESS_MAX_ATTEMPTS) {
        logger.warn(
          { entryId: data.entryId, attempts: attempt, err: (err as Error).message },
          'process: permanently failed',
        );
        return;
      }
      const delayMin =
        PROCESS_BACKOFF_MIN[attempt - 1] ?? PROCESS_BACKOFF_MIN[PROCESS_BACKOFF_MIN.length - 1];
      logger.info(
        { entryId: data.entryId, attempt, retryInMin: delayMin },
        'process: scheduling retry',
      );
      if (agenda) {
        await agenda.schedule(`in ${delayMin} minutes`, PROCESS_JOB, {
          entryId: data.entryId,
          attempt: nextAttempt,
        } satisfies ProcessJobData);
      }
    }
  });

  await agenda.start();

  // Schedule existing sources idempotently.
  const sources = await Source.find({});
  for (const s of sources) await schedulePoll(s.id, s.pollIntervalMs);

  // On boot, kick processing for any entries left pending from a previous run.
  const pending = await Entry.find({ processingState: 'pending' }).select('_id').limit(500);
  for (const e of pending) {
    await agenda.now(PROCESS_JOB, { entryId: e.id, attempt: 1 } satisfies ProcessJobData);
  }
}

export async function shutdownAgenda(): Promise<void> {
  if (agenda) {
    await agenda.stop();
    agenda = null;
  }
}

export async function schedulePoll(sourceId: string, pollIntervalMs: number): Promise<void> {
  if (!agenda) return;
  await agenda.cancel({ name: POLL_JOB, 'data.sourceId': sourceId });
  const minutes = Math.max(5, Math.round(pollIntervalMs / 60_000));
  await agenda.every(`${minutes} minutes`, POLL_JOB, { sourceId });
}

export async function unschedulePoll(sourceId: string): Promise<void> {
  if (!agenda) return;
  await agenda.cancel({ name: POLL_JOB, 'data.sourceId': sourceId });
}

export async function pollNow(sourceId: string): Promise<void> {
  if (!agenda) return;
  await agenda.now(POLL_JOB, { sourceId });
}

export async function processEntryNow(entryId: string): Promise<void> {
  if (!agenda) return;
  await agenda.now(PROCESS_JOB, { entryId, attempt: 1 } satisfies ProcessJobData);
}
