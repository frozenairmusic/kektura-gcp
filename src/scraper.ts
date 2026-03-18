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

/**
 * Extract segment info (code, title, distance, elevation, walking time,
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

  return {
    code,
    title,
    distance: fields.get('táv') ?? '',
    elevation: fields.get('szint + / -') ?? '',
    walking_time: fields.get('menetidő') ?? '',
    stamp_count: fields.get('bélyegzőhelyek') ?? '',
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
