import axios from 'axios';
import * as cheerio from 'cheerio';
import type { IGpxLink } from './types';
import type { IStorageAdapter } from './storage';
import { GPX_BASE_URL, GPX_FILENAME_REGEX } from './config';

// ─── Subpage discovery ────────────────────────────────────────────────────────

/**
 * Fetch a listing page and return all unique <a href> URLs whose href matches
 * `subpagePattern`. Relative hrefs are resolved against the listing page origin.
 */
export async function fetchSubpageUrls(
  pageUrl: string,
  subpagePattern: RegExp,
): Promise<string[]> {
  const response = await axios.get<string>(pageUrl, {
    timeout: 20_000,
    headers: { 'User-Agent': 'KekturaGpxScraper/1.0' },
  });

  const $ = cheerio.load(response.data);
  const pageOrigin = new URL(pageUrl).origin;
  const seen = new Set<string>();
  const urls: string[] = [];

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    if (!subpagePattern.test(href)) return;
    try {
      const fullUrl = new URL(href, pageOrigin).href;
      if (!seen.has(fullUrl)) {
        seen.add(fullUrl);
        urls.push(fullUrl);
      }
    } catch {
      // ignore unparseable hrefs
    }
  });

  return urls;
}

// ─── GPX link extraction ──────────────────────────────────────────────────────

/**
 * Fetch an HTML page and return all unique GPX entries found in <a href> values
 * and the raw HTML source (some sites render links as plain text).
 */
export async function extractGpxLinks(pageUrl: string): Promise<IGpxLink[]> {
  const response = await axios.get<string>(pageUrl, {
    timeout: 20_000,
    headers: { 'User-Agent': 'KekturaGpxScraper/1.0' },
  });

  const $ = cheerio.load(response.data);
  const seen = new Set<string>();
  const links: IGpxLink[] = [];

  // Search every <a> href attribute for GPX filenames
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    for (const match of href.matchAll(new RegExp(GPX_FILENAME_REGEX.source, 'gi'))) {
      const key = match[0].toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        links.push({
          trail: match[1].toLowerCase(),
          segment: match[2],
          date: match[3],
          filename: key 
        });
      }
    }
  });

  // Fallback: scan the full HTML body for GPX filenames (plain-text or JS vars)
  const rawHtml = $.html();
  for (const match of rawHtml.matchAll(new RegExp(GPX_FILENAME_REGEX.source, 'gi'))) {
    const key = match[0].toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      links.push({
        trail: match[1].toLowerCase(),
        segment: match[2],
        date: match[3],
        filename: key 
      });
    }
  }

  return links;
}

// ─── GPX download + store ─────────────────────────────────────────────────────

/**
 * Download a GPX file from the configured base URL and hand it to the adapter.
 */
export async function downloadGpxFile(
  trail: string,
  filename: string,
  adapter: IStorageAdapter,
): Promise<void> {
  const sourceUrl = `${GPX_BASE_URL}/${filename}`;
  console.log(`  Downloading ${sourceUrl}`);
  const response = await axios.get<ArrayBuffer>(sourceUrl, {
    responseType: 'arraybuffer',
    timeout: 30_000,
  });
  await adapter.writeGpx(trail, filename, Buffer.from(response.data));
}
