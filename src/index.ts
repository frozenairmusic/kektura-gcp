import * as ff from '@google-cloud/functions-framework';
import { createStorageAdapter } from './storage';
import { SCRAPE_TARGETS, SUBPAGE_CONCURRENCY, DOWNLOAD_CONCURRENCY } from './config';
import { extractGpxLinks, downloadGpxFile } from './scraper';
import { toMessage } from './utils';
import type { ISegmentMeta, Metadata, IScraperResults, IGpxLink } from './types';

// ─── Cloud Run Function entry point ───────────────────────────────────────────────────────────

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
  let adapter: ReturnType<typeof createStorageAdapter>;
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
  await Promise.allSettled(SCRAPE_TARGETS.map(async target => {
    console.log(`\nScraping trail '${target.trail}' (${target.subpageUrls.length} segment(s))`);

    const links: IGpxLink[] = [];

    for (let i = 0; i < target.subpageUrls.length; i += SUBPAGE_CONCURRENCY) {
      const chunk = target.subpageUrls.slice(i, i + SUBPAGE_CONCURRENCY);
      const settled = await Promise.allSettled(chunk.map(url => extractGpxLinks(url)));
      settled.forEach((result, index) => {
        const subUrl = chunk[index];
        if (result.status === 'fulfilled') {
          links.push(...result.value);
        } else {
          const message = toMessage(result.reason);
          console.error(`  Failed to scrape subpage ${subUrl}: ${message}`);
          results.errors.push({
            source: subUrl,
            error: message,
          });
        }
      });
    }

    console.log(`  Found ${links.length} GPX link(s).`);

    if (!metadata[target.trail]) {
      metadata[target.trail] = {};
    }

    const toDownload: (IGpxLink & { isNew: boolean })[] = [];

    for (const link of links) {
      const {
        trail, segment, date, filename,
      } = link;
      const existing: ISegmentMeta | undefined = metadata[trail]?.[segment];
      const isNew = existing === undefined;
      const isNewer = existing !== undefined && existing.last_updated < date;

      if (isNew || isNewer) {
        toDownload.push({
          trail,
          segment,
          date,
          filename,
          isNew,
        });
      } else {
        results.unchanged.push(`${trail}_${segment}`);
      }
    }

    console.log(`  ${toDownload.length} file(s) to download.`);

    for (let i = 0; i < toDownload.length; i += DOWNLOAD_CONCURRENCY) {
      const chunk = toDownload.slice(i, i + DOWNLOAD_CONCURRENCY);
      await Promise.all(chunk.map(async ({
        trail, segment, date, filename, isNew,
      }) => {
        const label = isNew ? 'NEW' : 'UPDATED';
        console.log(`  [${label}] ${filename}`);
        try {
          await downloadGpxFile(trail, filename, adapter);
          if (!metadata[trail]) metadata[trail] = {};
          metadata[trail][segment] = {
            last_updated: date,
            filename,
          };
          (isNew ? results.added : results.updated).push(`${trail}_${segment}`);
        } catch (err: unknown) {
          const message = toMessage(err);
          console.error(`  Failed to fetch/store ${filename}: ${message}`);
          results.errors.push({
            filename,
            error: message,
          });
        }
      }));
    }
  }));

  // Persist metadata only when something changed
  if (results.added.length > 0 || results.updated.length > 0) {
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
