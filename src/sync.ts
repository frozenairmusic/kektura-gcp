import { SUBPAGE_CONCURRENCY, DOWNLOAD_CONCURRENCY } from './config';
import { extractGpxLinks, downloadGpxFile } from './scraper';
import { analyzeGpx } from './analyzer';
import { toMessage } from './utils';
import type { IStorageAdapter } from './storage';
import type {
  ISegmentMeta, ISegmentInfo, IScrapeTarget, IScrapeResult, Metadata, IScraperResults, IGpxLink,
} from './types';

// ─── Trail processing pipeline ───────────────────────────────────────────────

/**
 * Scrape all subpages for a single trail, collecting GPX links and segment info.
 *
 * Subpages are fetched in batches of {@link SUBPAGE_CONCURRENCY}.
 */
async function scrapeTrailLinks(
  target: IScrapeTarget,
  results: IScraperResults,
): Promise<IScrapeResult> {
  const links: IGpxLink[] = [];
  const segmentInfoMap = new Map<string, ISegmentInfo>();

  for (let i = 0; i < target.subpageUrls.length; i += SUBPAGE_CONCURRENCY) {
    const chunk = target.subpageUrls.slice(i, i + SUBPAGE_CONCURRENCY);
    const settled = await Promise.allSettled(chunk.map(url => extractGpxLinks(url)));

    settled.forEach((result, index) => {
      const subUrl = chunk[index];

      if (result.status === 'fulfilled') {
        links.push(...result.value.links);

        if (result.value.info) {
          for (const link of result.value.links) {
            segmentInfoMap.set(link.segment, result.value.info);
          }
        }
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

  return {
    links,
    segmentInfoMap,
  };
}

/**
 * Download new / updated GPX files, analyse them, and build their metadata.
 *
 * Downloads are issued in batches of {@link DOWNLOAD_CONCURRENCY}.
 */
async function downloadSegments(
  toDownload: (IGpxLink & { isNew: boolean })[],
  metadata: Metadata,
  segmentInfoMap: Map<string, ISegmentInfo>,
  adapter: IStorageAdapter,
  results: IScraperResults,
): Promise<void> {
  for (let i = 0; i < toDownload.length; i += DOWNLOAD_CONCURRENCY) {
    const chunk = toDownload.slice(i, i + DOWNLOAD_CONCURRENCY);

    await Promise.all(chunk.map(async ({
      trail,
      segment,
      date,
      filename,
      isNew,
    }) => {
      const label = isNew ? 'NEW' : 'UPDATED';
      console.log(`  [${label}] ${filename}`);

      try {
        const gpxBuffer = await downloadGpxFile(trail, filename, adapter);

        if (!metadata[trail]) {
          metadata[trail] = {};
        }
        const sections = analyzeGpx(gpxBuffer);
        const info = segmentInfoMap.get(segment);

        metadata[trail][segment] = {
          last_updated: date,
          filename,
          ...(info && {
            code: info.code,
            title: info.title,
            distance: info.distance,
            elevation: info.elevation,
            walking_time: info.walking_time,
            stamp_count: info.stamp_count,
          }),
          sections,
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
}

/**
 * Process a single trail: scrape links, determine what to download,
 * backfill missing segment info, and download new / updated GPX files.
 *
 * @returns `true` when segment info was backfilled for unchanged segments.
 */
export async function processTrail(
  target: IScrapeTarget,
  metadata: Metadata,
  adapter: IStorageAdapter,
  results: IScraperResults,
): Promise<boolean> {
  console.log(`\nScraping trail '${target.trail}' (${target.subpageUrls.length} segment(s))`);

  const {
    links, segmentInfoMap,
  } = await scrapeTrailLinks(target, results);
  console.log(`  Found ${links.length} GPX link(s).`);

  if (!metadata[target.trail]) {
    metadata[target.trail] = {};
  }

  // Categorise links as new, updated, or unchanged
  const toDownload: (IGpxLink & { isNew: boolean })[] = [];

  for (const link of links) {
    const {
      trail,
      segment,
      date,
      filename,
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

  // Backfill segment info for unchanged segments that lack it
  let backfilled = false;

  for (const link of links) {
    const existing = metadata[target.trail]?.[link.segment];
    const info = segmentInfoMap.get(link.segment);

    if (existing && info && !existing.code) {
      existing.code = info.code;
      existing.title = info.title;
      existing.distance = info.distance;
      existing.elevation = info.elevation;
      existing.walking_time = info.walking_time;
      existing.stamp_count = info.stamp_count;
      backfilled = true;
    }
  }

  console.log(`  ${toDownload.length} file(s) to download.`);

  await downloadSegments(toDownload, metadata, segmentInfoMap, adapter, results);

  return backfilled;
}

/**
 * Backfill section analysis for segments downloaded before the analyser existed.
 *
 * @returns `true` when at least one segment was backfilled.
 */
export async function backfillSections(
  metadata: Metadata,
  adapter: IStorageAdapter,
): Promise<boolean> {
  let backfilled = false;

  for (const trailKey of Object.keys(metadata)) {
    if (trailKey === 'last_updated') {
      continue;
    }
    const trailMeta = metadata[trailKey];

    for (const seg of Object.keys(trailMeta)) {
      if (!trailMeta[seg].sections) {
        try {
          const gpxBuffer = await adapter.readGpx(trailKey, trailMeta[seg].filename);

          trailMeta[seg].sections = analyzeGpx(gpxBuffer);
          backfilled = true;
          console.log(`  Backfilled sections for ${trailKey}_${seg}`);
        } catch (err: unknown) {
          console.error(`  Failed to backfill sections for ${trailKey}_${seg}: ${toMessage(err)}`);
        }
      }
    }
  }

  return backfilled;
}
