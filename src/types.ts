// ─── Domain types ─────────────────────────────────────────────────────────────

/** A section between two consecutive stamp-point groups within a segment. */
export interface ISection {
  /** Name of the starting stamp-point group (city / location). */
  from: string;
  /** Name of the ending stamp-point group (city / location). */
  to: string;
  /** Trail distance in kilometres (rounded to 2 decimal places). */
  distance_km: number;
  /** Cumulative elevation gain in metres (rounded to integer). */
  elevation_gain_m: number;
  /** Cumulative elevation loss in metres (rounded to integer). */
  elevation_loss_m: number;
}

/** Metadata stored for a single trail segment. */
export interface ISegmentMeta {
  /** Date of the most recently downloaded GPX file in `YYYYMMDD` format. */
  last_updated: string;
  /** Filename of the most recently downloaded GPX file. */
  filename: string;
  /** Segment code, e.g. `"OKT-01"`. */
  code?: string;
  /** Segment title (from–to), e.g. `"Írott-kő - Sárvár"`. */
  title?: string;
  /** Total segment distance as shown on kektura.hu, e.g. `"72,5 km"`. */
  distance?: string;
  /** Elevation gain / loss as shown on kektura.hu, e.g. `"570 m / 1290 m"`. */
  elevation?: string;
  /** Walking time as shown on kektura.hu, e.g. `"18 óra 50 perc"`. */
  walking_time?: string;
  /** Number of stamp locations in the segment. */
  stamp_count?: string;
  /** Sections between stamp-point groups, computed from the GPX track. */
  sections?: ISection[];
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

/** Segment info scraped from a kektura.hu subpage. */
export interface ISegmentInfo {
  /** Segment code, e.g. `"OKT-01"`. */
  code: string;
  /** Segment title (from–to), e.g. `"Írott-kő - Sárvár"`. */
  title: string;
  /** Total segment distance, e.g. `"72,5 km"`. */
  distance: string;
  /** Elevation gain / loss, e.g. `"570 m / 1290 m"`. */
  elevation: string;
  /** Walking time, e.g. `"18 óra 50 perc"`. */
  walking_time: string;
  /** Number of stamp locations, e.g. `"9"`. */
  stamp_count: string;
}

/** Result of scraping a single trail subpage. */
export interface ISubpageResult {
  /** GPX file links found on the page. */
  links: IGpxLink[];
  /** Segment info extracted from the page (if available). */
  info?: ISegmentInfo;
}

/** Aggregated scrape results for an entire trail (all subpages combined). */
export interface IScrapeResult {
  /** All GPX file links found across the trail's subpages. */
  links: IGpxLink[];
  /** Segment info keyed by segment number, e.g. `"01"`. */
  segmentInfoMap: Map<string, ISegmentInfo>;
}

/** Configuration for a single scrape target. */
export interface IScrapeTarget {
  /** Trail identifier used as the top-level key in `metadata.json`, e.g. `"okt"`. */
  trail: string;
  /**
   * Ordered list of subpage URLs to fetch and scan for GPX links.
   * Generated from {@link TRAIL_SEGMENT_COUNTS} in `config.ts`.
   */
  subpageUrls: string[];
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
