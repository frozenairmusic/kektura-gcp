import * as ff from '@google-cloud/functions-framework';
import { createStorageAdapter, type IStorageAdapter } from './storage';
import { SCRAPE_TARGETS } from './config';
import { processTrail, backfillSections } from './sync';
import { toMessage } from './utils';
import type { Metadata, IScraperResults } from './types';

// ─── Cloud Run Function entry point ───────────────────────────────────────────

/**
 * Cloud Run Function — scrapes kektura.hu for new or updated GPX files and
 * syncs them to the configured storage backend.
 *
 * Responds with HTTP 200 and a JSON summary on success (individual download
 * errors are non-fatal and reported in the `details.errors` array).
 * Responds with HTTP 500 if the storage backend is unreachable or metadata
 * cannot be read.
 */
export async function syncGpxFiles(_req: ff.Request, res: ff.Response): Promise<void> {
  let adapter: IStorageAdapter;
  try {
    adapter = createStorageAdapter();
  } catch (err: unknown) {
    const message = toMessage(err);
    console.error(message);

    res.status(500).json({
      success: false,
      error: message,
    });

    return;
  }

  try {
    await adapter.checkWritable();
  } catch (err: unknown) {
    const message = toMessage(err);
    console.error(`Storage is not writable — aborting: ${message}`);

    res.status(500).json({
      success: false,
      error: `Storage write check failed: ${message}`,
    });

    return;
  }

  console.log('=== Kektura GPX scraper started ===');
  const startTime = Date.now();

  const results: IScraperResults = {
    added: [],
    updated: [],
    unchanged: [],
    errors: [],
  };

  let metadata: Metadata;
  try {
    metadata = await adapter.readMetadata();
  } catch (err: unknown) {
    const message = toMessage(err);
    console.error(`Failed to load metadata: ${message}`);

    res.status(500).json({
      success: false,
      error: `Failed to load metadata: ${message}`,
    });

    return;
  }

  // All three trails are independent — scrape them concurrently.
  const trailSettled = await Promise.allSettled(
    SCRAPE_TARGETS.map(target => processTrail(target, metadata, adapter, results)),
  );
  const trailsBackfilled = trailSettled.some(r => r.status === 'fulfilled' && r.value);

  // Backfill sections for segments downloaded before analysis was added
  const sectionsBackfilled = await backfillSections(metadata, adapter);

  // Persist metadata only when something changed
  const hasChanges = results.added.length > 0 || results.updated.length > 0 ||
    trailsBackfilled || sectionsBackfilled;

  if (hasChanges) {
    try {
      // Stamp the file-level update date so consumers know when it was last touched
      (metadata as Record<string, unknown>).last_updated = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

      await adapter.writeMetadata(metadata);
      console.log('\nmetadata.json saved.');
    } catch (err: unknown) {
      const message = toMessage(err);
      console.error(`Failed to save metadata: ${message}`);

      results.errors.push({
        source: 'metadata.json',
        error: message,
      });
    }
  }

  const duration_ms = Date.now() - startTime;
  const summary = {
    added: results.added.length,
    updated: results.updated.length,
    unchanged: results.unchanged.length,
    errors: results.errors.length,
    duration_ms,
  };

  console.log(`\n=== Done — added:${summary.added} updated:${summary.updated} unchanged:${summary.unchanged} errors:${summary.errors} duration:${duration_ms}ms ===`);

  res.status(200).json({
    success: true,
    summary,
    details: results,
  });
}

ff.http('syncGpxFiles', syncGpxFiles);
