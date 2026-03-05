import axios from 'axios';
import * as cheerio from 'cheerio';
import type { IGpxLink } from './types';
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

// ─── GPX link extraction ──────────────────────────────────────────────────────

/**
 * Fetch an HTML page and return all unique GPX entries found in the raw HTML
 * source (covers `<a href>` attributes, plain-text links, and inline JS vars).
 */
export async function extractGpxLinks(pageUrl: string): Promise<IGpxLink[]> {
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

  return links;
}

// ─── GPX download + store ─────────────────────────────────────────────────────

/**
 * Download a GPX file from the configured base URL and hand it to the adapter.
 */
export async function downloadGpxFile(trail: string,
  filename: string,
  adapter: IStorageAdapter,
): Promise<void> {
  const sourceUrl = `${GPX_BASE_URL}/${filename}`;
  console.log(`  Downloading ${sourceUrl}`);

  const response = await http.get<ArrayBuffer>(sourceUrl, {
    responseType: 'arraybuffer',
  });

  await adapter.writeGpx(trail, filename, Buffer.from(response.data),
  );
}
