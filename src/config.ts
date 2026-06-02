import type { IScrapeTarget } from './types';

// ─── GPX download base URL ────────────────────────────────────────────────────

/**
 * Base URL from which GPX files are downloaded.
 * Overridable via the `GPX_BASE_URL` environment variable (useful for local testing).
 */
export const GPX_BASE_URL = process.env.GPX_BASE_URL ?? 'https://turistaterkepek.hu/kekturahu/gpx/nagyszakasz';

// ─── Scrape targets ───────────────────────────────────────────────────────────

/**
 * Ordered list of trails to scrape on each function invocation.
 * Segment URLs are discovered dynamically from each trail's listing page.
 */
export const SCRAPE_TARGETS: IScrapeTarget[] = [
  {
    trail: 'okt',
  },
  {
    trail: 'ak',
  },
  {
    trail: 'rpddk',
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
