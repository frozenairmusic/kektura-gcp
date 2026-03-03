// ─── Domain types ─────────────────────────────────────────────────────────────

export interface ISegmentMeta {
  last_updated: string;
  filename: string;
}

export type TrailMeta = Record<string, ISegmentMeta>;
export type Metadata = Record<string, TrailMeta>;

export interface IGpxLink {
  trail: string;
  segment: string;
  date: string;
  filename: string;
}

export interface IScrapeTarget {
  trail: string;
  url: string;
  /** Pattern matched against <a href> values on the listing page to find subpage URLs. */
  subpagePattern?: RegExp;
}

export interface IScraperError {
  source?: string;
  filename?: string;
  error: string;
}

export interface IScraperResults {
  added: string[];
  updated: string[];
  unchanged: string[];
  errors: IScraperError[];
}
