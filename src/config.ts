import type { IScrapeTarget } from './types';

// ─── GPX download base URL ────────────────────────────────────────────────────

export const GPX_BASE_URL = process.env.GPX_BASE_URL ??
  'https://turistaterkepek.hu/kekturahu/gpx/nagyszakasz';

// ─── Scrape targets ───────────────────────────────────────────────────────────
//
// When `subpagePattern` is set the listing page is crawled first; each matching
// subpage is then scraped for GPX links (two-step flow).

export const SCRAPE_TARGETS: IScrapeTarget[] = [
  {
    trail: 'okt',
    url: 'https://kektura.hu/okt-szakaszok',
    subpagePattern: /\/okt-szakasz\//i 
  },
  {
    trail: 'ak',
    url: 'https://kektura.hu/ak-szakaszok',
    subpagePattern: /\/ak-szakasz\//i 
  },
  {
    trail: 'rpddk',
    url: 'https://kektura.hu/rpddk-szakaszok',
    subpagePattern: /\/rpddk-szakasz\//i 
  },
];

// ─── Filename regex ───────────────────────────────────────────────────────────
//
// Matches:  okt_01_20251107.gpx  |  ak_13_20251107.gpx  |  rpddk_11_20251008.gpx
// Groups:   [1] trail  [2] segment (zero-padded)  [3] date (YYYYMMDD)

export const GPX_FILENAME_REGEX = /\b(okt|ak|rpddk)_(\d{2})_(\d{8})\.gpx\b/gi;
