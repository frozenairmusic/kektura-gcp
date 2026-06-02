import axios from 'axios';
import * as cheerio from 'cheerio';
import type { IGpxLink, ISegmentInfo, ISubpageResult } from './types';
import type { IStorageAdapter } from './storage';
import { GPX_BASE_URL, GPX_FILENAME_REGEX } from './config';

// ─── Shared HTTP client ───────────────────────────────────────────────────────

/**
 * Shared Axios instance used for all outgoing HTTP requests.
 *
 * Centralises timeout and `User-Agent` configuration.
 * Exported so tests can attach `axios-mock-adapter` to intercept calls.
 */
export const http = axios.create({
  timeout: 45_000,
  headers: {
    'User-Agent': 'KekturaGpxScraper/1.0',
  },
});

// ─── Segment info extraction ──────────────────────────────────────────────────

/** Parse "14 óra 40 perc" → 880 (total minutes), or 0 if not parseable. */
function parseDuration(raw: string): number {
  const hoursMatch = raw.match(/(\d+)\s*óra/i);
  const minsMatch = raw.match(/(\d+)\s*perc/i);
  const hours = hoursMatch ? parseInt(hoursMatch[1], 10) : 0;
  const mins = minsMatch ? parseInt(minsMatch[1], 10) : 0;

  return hours * 60 + mins;
}

/** Parse "58,5 km" → 58.5, or undefined if not parseable. */
function parseDistance(raw: string): number | undefined {
  const match = raw.match(/([\d,.]+)\s*km/i);
  if (!match) {
    return undefined;
  }

  return parseFloat(match[1].replace(',', '.'));
}

/** Parse "205 m / 195 m" → `{ elevation_gain: 205, elevation_loss: 195 }`. */
function parseElevation(raw: string): { elevation_gain?: number;
  elevation_loss?: number } {
  const match = raw.match(/(\d+)\s*m\s*\/\s*(\d+)\s*m/i);
  if (!match) {
    return {};
  }

  return {
    elevation_gain: parseInt(match[1], 10),
    elevation_loss: parseInt(match[2], 10),
  };
}

/**
 * Extract segment info (code, title, distance, elevation, duration,
 * stamp count) from a parsed kektura.hu subpage.
 */
function extractSegmentInfo($: cheerio.CheerioAPI): ISegmentInfo | undefined {
  const code = $('h1').first().text().trim();
  const title = $('div.szakasz-title').first().text().trim();

  if (!code || !title) {
    return undefined;
  }

  const fields = new Map<string, string>();

  $('div.item').each((_, el) => {
    const name = $(el).find('div.name').first().text().trim().toLowerCase();
    const value = $(el).find('div.value').first().text().trim();

    if (name && value && !fields.has(name)) {
      fields.set(name, value);
    }
  });

  const {
    elevation_gain, elevation_loss,
  } = parseElevation(fields.get('szint + / -') ?? '');

  return {
    code,
    title,
    distance: parseDistance(fields.get('táv') ?? ''),
    elevation_gain,
    elevation_loss,
    duration: parseDuration(fields.get('menetidő') ?? ''),
    stamp_count: parseInt(fields.get('bélyegzőhelyek') ?? '', 10) || undefined,
  };
}

// ─── GPX link extraction ──────────────────────────────────────────────────────

/**
 * Fetch an HTML page and return all unique GPX entries found in the raw HTML
 * source, plus segment info (title, distance, etc.) when available.
 */
export async function extractGpxLinks(pageUrl: string): Promise<ISubpageResult> {
  const response = await http.get<string>(pageUrl);

  const $ = cheerio.load(response.data);
  const seen = new Set<string>();
  const links: IGpxLink[] = [];

  // `$.html()` serialises the full document, covering href attributes, plain
  // text, and any other occurrence of a GPX filename in one pass.
  const re = new RegExp(GPX_FILENAME_REGEX.source, 'gi');

  for (const match of $.html().matchAll(re)) {
    const key = match[0].toLowerCase();

    if (!seen.has(key)) {
      seen.add(key);
      links.push({
        trail: match[1].toLowerCase(),
        segment: match[2],
        date: match[3],
        filename: key,
      });
    }
  }

  return {
    links,
    info: extractSegmentInfo($),
  };
}

// ─── GPX download + store ─────────────────────────────────────────────────────

/**
 * Download a GPX file from the configured base URL and hand it to the adapter.
 */
export async function downloadGpxFile(trail: string,
  filename: string,
  adapter: IStorageAdapter,
): Promise<Buffer> {
  const sourceUrl = `${GPX_BASE_URL}/${filename}`;
  console.log(`  Downloading ${sourceUrl}`);

  const response = await http.get<ArrayBuffer>(sourceUrl, {
    responseType: 'arraybuffer',
  });

  const data = Buffer.from(response.data);
  await adapter.writeGpx(trail, filename, data);

  return data;
}

// ─── Trail listing page ───────────────────────────────────────────────────────

/**
 * Fetch the trail listing page and return segment subpage URLs extracted from
 * `data-url` attributes on table rows.
 *
 * Listing page URL: `https://www.kektura.hu/<trail>-szakaszok/`
 */
export async function scrapeSegmentUrls(trail: string): Promise<string[]> {
  const listingUrl = `https://www.kektura.hu/${trail}-szakaszok/`;
  const response = await http.get<string>(listingUrl);
  const $ = cheerio.load(response.data);

  const urls: string[] = [];
  $('[data-url]').each((_, el) => {
    const raw = ($(el).attr('data-url') ?? '').trim();
    if (!raw) {
      return;
    }
    const url = /^https?:\/\//i.test(raw) ?
      raw :
      `https://www.kektura.hu${raw.startsWith('/') ? raw : `/${raw}`}`;
    urls.push(url);
  });

  return urls;
}
