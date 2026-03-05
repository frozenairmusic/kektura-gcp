// ─── Environment setup (must happen before any module is loaded) ─────────────
process.env.GPX_BASE_URL = 'https://test-gpx.example.com/gpx';

// ─── Module mocks ─────────────────────────────────────────────────────────────
// @google-cloud/storage is imported transitively by storage.ts — mock it to
// prevent initialisation errors in environments without GCP credentials.
jest.mock('@google-cloud/storage');

// ─── Imports ──────────────────────────────────────────────────────────────────
import * as fs from 'fs';
import * as path from 'path';
import MockAdapter from 'axios-mock-adapter';
import type { IStorageAdapter } from '../src/storage';
import type { Metadata } from '../src/types';
import { LocalStorageAdapter } from '../src/storage';
import { fetchSubpageUrls, extractGpxLinks, downloadGpxFile, http } from '../src/scraper';
import { htmlWithLinks, htmlWithPlainText, makeTempDir } from './helpers';

const axiosMock = new MockAdapter(http);

beforeEach(() => {
  jest.clearAllMocks();
  axiosMock.reset();
});

// ═════════════════════════════════════════════════════════════════════════════
// fetchSubpageUrls
// ═════════════════════════════════════════════════════════════════════════════
describe(
  'fetchSubpageUrls', () => {
    const LISTING_URL = 'https://kektura.hu/okt-szakaszok';
    const PATTERN     = /\/okt-szakasz\//i;

    test(
      'returns absolute subpage URLs matching the pattern', async () => {
        axiosMock.onGet(LISTING_URL).reply(
          200, htmlWithLinks(
            'https://www.kektura.hu/okt-szakasz/okt-01',
            'https://www.kektura.hu/okt-szakasz/okt-02',
            'https://www.kektura.hu/other-page',
          ),
        );
        const urls = await fetchSubpageUrls(
          LISTING_URL, PATTERN,
        );
        expect(urls).toHaveLength(2);
        expect(urls[0]).toBe('https://www.kektura.hu/okt-szakasz/okt-01');
        expect(urls[1]).toBe('https://www.kektura.hu/okt-szakasz/okt-02');
      },
    );

    test(
      'resolves relative hrefs against the listing page origin', async () => {
        axiosMock.onGet(LISTING_URL).reply(
          200, htmlWithLinks('/okt-szakasz/okt-20'),
        );
        const urls = await fetchSubpageUrls(
          LISTING_URL, PATTERN,
        );
        expect(urls).toHaveLength(1);
        expect(urls[0]).toBe('https://kektura.hu/okt-szakasz/okt-20');
      },
    );

    test(
      'deduplicates repeated links', async () => {
        axiosMock.onGet(LISTING_URL).reply(
          200, htmlWithLinks(
            '/okt-szakasz/okt-01',
            '/okt-szakasz/okt-01',
          ),
        );
        expect(await fetchSubpageUrls(
          LISTING_URL, PATTERN,
        )).toHaveLength(1);
      },
    );

    test(
      'returns empty array when no links match the pattern', async () => {
        axiosMock.onGet(LISTING_URL).reply(
          200, '<html><body><p>no links</p></body></html>',
        );
        expect(await fetchSubpageUrls(
          LISTING_URL, PATTERN,
        )).toEqual([]);
      },
    );

    test(
      'throws when the HTTP request fails', async () => {
        axiosMock.onGet(LISTING_URL).networkError();
        await expect(fetchSubpageUrls(
          LISTING_URL, PATTERN,
        )).rejects.toThrow();
      },
    );
  },
);

// ═════════════════════════════════════════════════════════════════════════════
// extractGpxLinks
// ═════════════════════════════════════════════════════════════════════════════
describe(
  'extractGpxLinks', () => {
    const PAGE_URL = 'https://kektura.hu/okt-szakaszok';

    test(
      'extracts GPX links from <a href> attributes', async () => {
        axiosMock.onGet(PAGE_URL).reply(
          200, htmlWithLinks(
            'https://turistaterkepek.hu/gpx/okt_01_20251107.gpx',
            'https://turistaterkepek.hu/gpx/okt_02_20251016.gpx',
          ),
        );
        const links = await extractGpxLinks(PAGE_URL);
        expect(links).toHaveLength(2);
        expect(links[0]).toEqual({
          trail: 'okt',
          segment: '01',
          date: '20251107',
          filename: 'okt_01_20251107.gpx',
        });
        expect(links[1]).toEqual({
          trail: 'okt',
          segment: '02',
          date: '20251016',
          filename: 'okt_02_20251016.gpx',
        });
      },
    );

    test(
      'falls back to scanning raw HTML body for plain-text filenames', async () => {
        axiosMock.onGet(PAGE_URL).reply(
          200,
          htmlWithPlainText('Download: rpddk_03_20241217.gpx available here.'),
        );
        const links = await extractGpxLinks(PAGE_URL);
        expect(links).toHaveLength(1);
        expect(links[0]).toEqual({
          trail: 'rpddk',
          segment: '03',
          date: '20241217',
          filename: 'rpddk_03_20241217.gpx',
        });
      },
    );

    test(
      'deduplicates identical filenames appearing in both href and body text', async () => {
        const html = '<html><body>'
      + '<a href="ak_05_20251203.gpx">ak_05_20251203.gpx</a>'
      + '</body></html>';
        axiosMock.onGet(PAGE_URL).reply(
          200, html,
        );
        const links = await extractGpxLinks(PAGE_URL);
        expect(links).toHaveLength(1);
      },
    );

    test(
      'returns an empty array when no GPX links are present', async () => {
        axiosMock.onGet(PAGE_URL).reply(
          200, '<html><body><p>No files here.</p></body></html>',
        );
        const links = await extractGpxLinks(PAGE_URL);
        expect(links).toEqual([]);
      },
    );

    test(
      'handles all three trail types (okt, ak, rpddk)', async () => {
        axiosMock.onGet(PAGE_URL).reply(
          200, htmlWithLinks(
            'okt_20_20251016.gpx',
            'ak_06_20250612.gpx',
            'rpddk_07_20251120.gpx',
          ),
        );
        const links  = await extractGpxLinks(PAGE_URL);
        const trails = links.map(l => l.trail).sort();
        expect(trails).toEqual([
          'ak',
          'okt',
          'rpddk',
        ]);
      },
    );

    test(
      'ignores links that do not match the GPX filename pattern', async () => {
        axiosMock.onGet(PAGE_URL).reply(
          200, htmlWithLinks(
            'unknown_01_20251107.gpx',
            'okt_1_20251107.gpx',
            'okt_01_2025110.gpx',
            'https://example.com/other.zip',
          ),
        );
        const links = await extractGpxLinks(PAGE_URL);
        expect(links).toEqual([]);
      },
    );

    test(
      'normalises filenames to lower-case (regex is case-insensitive)', async () => {
        axiosMock.onGet(PAGE_URL).reply(
          200, htmlWithLinks('OKT_01_20251107.GPX'),
        );
        const links = await extractGpxLinks(PAGE_URL);
        expect(links).toHaveLength(1);
        expect(links[0]).toEqual({
          trail: 'okt',
          segment: '01',
          date: '20251107',
          filename: 'okt_01_20251107.gpx',
        });
      },
    );

    test(
      'throws when the HTTP request fails', async () => {
        axiosMock.onGet(PAGE_URL).networkError();
        await expect(extractGpxLinks(PAGE_URL)).rejects.toThrow();
      },
    );
  },
);

// ═════════════════════════════════════════════════════════════════════════════
// downloadGpxFile
// ═════════════════════════════════════════════════════════════════════════════
describe(
  'downloadGpxFile', () => {
    const TRAIL    = 'okt';
    const FILENAME = 'okt_20_20251016.gpx';
    const GPX_URL  = `https://test-gpx.example.com/gpx/${FILENAME}`;
    const GPX_DATA = Buffer.from('<gpx version="1.1"></gpx>');

    let mockAdapter: IStorageAdapter;

    beforeEach(() => {
      mockAdapter = {
        checkWritable: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
        readMetadata: jest.fn(),
        writeMetadata: jest.fn<Promise<void>, [Metadata]>().mockResolvedValue(undefined),
        writeGpx: jest.fn<Promise<void>, [string, string, Buffer]>().mockResolvedValue(undefined),
      };
    });

    test(
      'downloads GPX and passes it to the adapter', async () => {
        axiosMock.onGet(GPX_URL).reply(
          200, GPX_DATA,
        );
        await downloadGpxFile(
          TRAIL, FILENAME, mockAdapter,
        );
        expect(mockAdapter.writeGpx).toHaveBeenCalledWith(
          TRAIL, FILENAME, expect.any(Buffer),
        );
      },
    );

    test(
      'passes correct trail and filename for all three trail types', async () => {
        const cases = [
          {
            trail: 'okt',
            filename: 'okt_01_20251107.gpx',
          },
          {
            trail: 'ak',
            filename: 'ak_01_20231109.gpx',
          },
          {
            trail: 'rpddk',
            filename: 'rpddk_01_20251008.gpx',
          },
        ];
        for (const {
          trail, filename,
        } of cases) {
          axiosMock.onGet(`https://test-gpx.example.com/gpx/${filename}`).reply(
            200, Buffer.from('<gpx/>'),
          );
          await downloadGpxFile(
            trail, filename, mockAdapter,
          );
          const calls = (mockAdapter.writeGpx as jest.Mock).mock.calls;
          const last  = calls[calls.length - 1] as [string, string, Buffer];
          expect(last[0]).toBe(trail);
          expect(last[1]).toBe(filename);
        }
      },
    );

    test(
      'throws when the download request fails', async () => {
        axiosMock.onGet(GPX_URL).networkError();
        await expect(downloadGpxFile(
          TRAIL, FILENAME, mockAdapter,
        )).rejects.toThrow();
      },
    );

    test(
      'throws when the adapter writeGpx fails', async () => {
        axiosMock.onGet(GPX_URL).reply(
          200, GPX_DATA,
        );
        (mockAdapter.writeGpx as jest.Mock).mockRejectedValueOnce(new Error('Write failed'));
        await expect(downloadGpxFile(
          TRAIL, FILENAME, mockAdapter,
        )).rejects.toThrow('Write failed');
      },
    );

    test(
      'with LocalStorageAdapter: writes real file to disk', async () => {
        const tmpDir = makeTempDir();
        const localAdapter = new LocalStorageAdapter(tmpDir);
        axiosMock.onGet(GPX_URL).reply(
          200, GPX_DATA,
        );
        await downloadGpxFile(
          TRAIL, FILENAME, localAdapter,
        );
        expect(fs.existsSync(path.join(
          tmpDir, 'gpx', TRAIL, FILENAME,
        ))).toBe(true);
        fs.rmSync(
          tmpDir, {
            recursive: true,
            force: true,
          },
        );
      },
    );
  },
);
