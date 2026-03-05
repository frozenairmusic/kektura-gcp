// ─── Domain types ─────────────────────────────────────────────────────────────

/** Metadata stored for a single trail segment. */
export interface ISegmentMeta {
  /** Date of the most recently downloaded GPX file in `YYYYMMDD` format. */
  last_updated: string;
  /** Filename of the most recently downloaded GPX file. */
  filename: string;
}

/** All segments for one trail, keyed by zero-padded segment number string. */
export type TrailMeta = Record<string, ISegmentMeta>;

/**
 * Root metadata object persisted as `metadata.json`.
 * Top-level keys are trail identifiers (e.g. `"okt"`, `"ak"`, `"rpddk"`).
 */
export type Metadata = Record<string, TrailMeta>;

/** A single GPX file reference extracted from a trail subpage. */
export interface IGpxLink {
  /** Trail identifier, e.g. `"okt"`. */
  trail: string;
  /** Zero-padded segment number as a string, e.g. `"01"`. */
  segment: string;
  /** File date in `YYYYMMDD` format, used to detect updates. */
  date: string;
  /** GPX filename on the download server, e.g. `"okt_01_20251107.gpx"`. */
  filename: string;
}

/** Configuration for a single scrape target. */
export interface IScrapeTarget {
  /** Trail identifier used as the top-level key in `metadata.json`, e.g. `"okt"`. */
  trail: string;
  /** URL of the listing page (or a direct page when `subpagePattern` is omitted). */
  url: string;
  /**
   * When present the listing page is crawled first; every `<a href>` matching
   * this pattern is treated as a subpage that is then scraped for GPX links.
   */
  subpagePattern?: RegExp;
}

/** Describes a single error collected during a scrape or download run. */
export interface IScraperError {
  /** URL of the page that caused the error, if applicable. */
  source?: string;
  /** GPX filename that caused the error, if applicable. */
  filename?: string;
  /** Human-readable error message. */
  error: string;
}

/** Aggregated counters and details returned by the Cloud Run Function. */
export interface IScraperResults {
  /** Trail–segment keys of newly added GPX files, e.g. `"okt_01"`. */
  added: string[];
  /** Trail–segment keys of updated (replaced) GPX files. */
  updated: string[];
  /** Trail–segment keys that were already up to date. */
  unchanged: string[];
  /** Errors collected during the run (non-fatal — other files are still processed). */
  errors: IScraperError[];
}
