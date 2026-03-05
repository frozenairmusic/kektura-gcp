import type { IScrapeTarget } from './types';

// ─── GPX download base URL ────────────────────────────────────────────────────

/**
 * Base URL from which GPX files are downloaded.
 * Overridable via the `GPX_BASE_URL` environment variable (useful for local testing).
 */
export const GPX_BASE_URL = process.env.GPX_BASE_URL ?? 'https://turistaterkepek.hu/kekturahu/gpx/nagyszakasz';

// ─── Trail segment counts ─────────────────────────────────────────────────────

/**
 * Known number of segments for each trail.
 * Update these values if new segments are added to a trail.
 */
export const TRAIL_SEGMENT_COUNTS = {
  okt: 27,
  ak: 13,
  rpddk: 11,
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Generates the ordered list of subpage URLs for a given trail.
 *
 * URL pattern: `https://www.kektura.hu/<trail>-szakasz/<trail>-<nn>`
 * where `<nn>` is a zero-padded segment number starting at `01`.
 */
function segmentUrls(trail: string, count: number,
): string[] {
  return Array.from(
    {
      length: count,
    },
    (_, i) => {
      const n = `${i + 1}`.padStart(2, '0');

      return `https://www.kektura.hu/${trail}-szakasz/${trail}-${n}`;
    });
}

// ─── Scrape targets ───────────────────────────────────────────────────────────

/**
 * Ordered list of trail segment pages to scrape on each function invocation.
 * Subpage URLs are pre-computed from {@link TRAIL_SEGMENT_COUNTS} — no
 * listing-page fetch is required at runtime.
 */
export const SCRAPE_TARGETS: IScrapeTarget[] = [
  {
    trail: 'okt',
    subpageUrls: segmentUrls('okt', TRAIL_SEGMENT_COUNTS.okt,
    ),
  },
  {
    trail: 'ak',
    subpageUrls: segmentUrls('ak', TRAIL_SEGMENT_COUNTS.ak,
    ),
  },
  {
    trail: 'rpddk',
    subpageUrls: segmentUrls('rpddk', TRAIL_SEGMENT_COUNTS.rpddk,
    ),
  },
];

// ─── Filename regex ───────────────────────────────────────────────────────────

/**
 * Regular expression matching GPX filenames produced by kektura.hu.
 *
 * Capture groups:
 * 1. Trail identifier — `okt` | `ak` | `rpddk`
 * 2. Zero-padded segment number — `\d{2}`
 * 3. File date — `\d{8}` (`YYYYMMDD`)
 *
 * @example `"okt_01_20251107.gpx"`, `"ak_13_20251107.gpx"`, `"rpddk_11_20251008.gpx"`
 *
 * @remarks No `g` flag — callers construct `new RegExp(GPX_FILENAME_REGEX.source, 'gi')`
 * to get a fresh stateless instance each time, avoiding `lastIndex` mutation bugs.
 */
export const GPX_FILENAME_REGEX = /\b(okt|ak|rpddk)_(\d{2})_(\d{8})\.gpx\b/i;

// ─── Concurrency limits ───────────────────────────────────────────────────────

/** Maximum number of subpages fetched in parallel within a single trail. */
export const SUBPAGE_CONCURRENCY = 7;

/** Maximum number of GPX files downloaded and stored in parallel within a single trail. */
export const DOWNLOAD_CONCURRENCY = 7;
