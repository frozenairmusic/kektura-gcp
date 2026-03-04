// ─── Environment setup (must happen before any module is loaded) ─────────────
process.env.GPX_BASE_URL = 'https://test-gpx.example.com/gpx';

// ─── Module mocks ─────────────────────────────────────────────────────────────
jest.mock('@google-cloud/functions-framework', () => ({ http: jest.fn() }));
jest.mock('@google-cloud/storage');

// ─── Imports ──────────────────────────────────────────────────────────────────
import * as fs   from 'fs';
import * as path from 'path';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { Storage } from '@google-cloud/storage';
import type * as ff from '@google-cloud/functions-framework';
import { syncGpxFiles } from '../src/index';
import { htmlWithLinks, makeTempDir, mockReq, mockRes } from './helpers';

// ─── GCS mock chain setup ─────────────────────────────────────────────────────
const MockedStorage = Storage as jest.MockedClass<typeof Storage>;

const gcsMock = {
  save:     jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
  delete:   jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
  download: jest.fn(),
  file:     jest.fn(),
  bucket:   jest.fn(),
};
gcsMock.file.mockReturnValue({
  save:     gcsMock.save,
  delete:   gcsMock.delete,
  download: gcsMock.download,
});
gcsMock.bucket.mockReturnValue({ file: gcsMock.file });
MockedStorage.mockImplementation(() => ({ bucket: gcsMock.bucket }) as unknown as Storage);

const axiosMock = new MockAdapter(axios);

beforeEach(() => {
  jest.clearAllMocks();
  gcsMock.file.mockReturnValue({
    save:     gcsMock.save,
    delete:   gcsMock.delete,
    download: gcsMock.download,
  });
  gcsMock.bucket.mockReturnValue({ file: gcsMock.file });
  gcsMock.save.mockResolvedValue(undefined);
  gcsMock.delete.mockResolvedValue(undefined);
  axiosMock.reset();
  delete process.env.GCS_BUCKET_NAME;
  delete process.env.LOCAL_OUTPUT_DIR;
});

// ═════════════════════════════════════════════════════════════════════════════
// syncGpxFiles handler
// ═════════════════════════════════════════════════════════════════════════════
describe('syncGpxFiles handler', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTempDir();
    process.env.LOCAL_OUTPUT_DIR = tmpDir;
  });

  afterEach(() => { fs.rmSync(tmpDir, {
    recursive: true,
    force: true 
  }); });

  // ── Helpers ──────────────────────────────────────────────────────────────

  function makeListingHtml(trail: string, filenames: string[]): string {
    const subpageUrls = filenames.map((_, i) =>
      `https://www.kektura.hu/${trail}-szakasz/${trail}-${String(i + 1).padStart(2, '0')}`
    );

    return htmlWithLinks(...subpageUrls);
  }

  function stubGpxDownloads(...filenames: string[]): void {
    filenames.forEach(f => axiosMock.onGet(new RegExp(f.replace('.', '\\.'))).reply(200, Buffer.from('<gpx/>')));
  }

  function mockTrailWithSubpages(trail: string, listingUrl: string, filenames: string[]): void {
    axiosMock.onGet(listingUrl).reply(200, makeListingHtml(trail, filenames));
    filenames.forEach((filename, i) => {
      const sub = `https://www.kektura.hu/${trail}-szakasz/${trail}-${String(i + 1).padStart(2, '0')}`;
      axiosMock.onGet(sub).reply(200, htmlWithLinks(filename));
    });
  }

  interface SetupOptions {
    oktLinks?: string[]; akLinks?: string[]; rpddkLinks?: string[];
    metadata?: Record<string, unknown>;
  }

  function setupScrapeMocks({
    oktLinks = [], akLinks = [], rpddkLinks = [], metadata = {} 
  }: SetupOptions = {}): void {
    fs.writeFileSync(path.join(tmpDir, 'metadata.json'), JSON.stringify(metadata));
    mockTrailWithSubpages('okt',   'https://kektura.hu/okt-szakaszok',   oktLinks);
    mockTrailWithSubpages('ak',    'https://kektura.hu/ak-szakaszok',    akLinks);
    mockTrailWithSubpages('rpddk', 'https://kektura.hu/rpddk-szakaszok', rpddkLinks);
    stubGpxDownloads(...oktLinks, ...akLinks, ...rpddkLinks);
  }

  // ── Missing storage configuration ────────────────────────────────────────
  test('returns 500 when neither GCS_BUCKET_NAME nor LOCAL_OUTPUT_DIR is set', async () => {
    delete process.env.LOCAL_OUTPUT_DIR;
    const res = mockRes();
    await syncGpxFiles(mockReq() as unknown as ff.Request, res as unknown as ff.Response);
    expect(res._status).toBe(500);
    expect(res._body).toMatchObject({ success: false });
  });

  test('returns 500 and aborts when storage write check fails', async () => {
    delete process.env.LOCAL_OUTPUT_DIR;
    process.env.GCS_BUCKET_NAME = 'test-bucket';
    gcsMock.save.mockRejectedValueOnce(new Error('Permission denied'));
    const res = mockRes();
    await syncGpxFiles(mockReq() as unknown as ff.Request, res as unknown as ff.Response);
    expect(res._status).toBe(500);
    expect(res._body).toMatchObject({ success: false, error: expect.stringContaining('write check') });
    // No HTTP listing requests should have been made
    expect(axiosMock.history.get.length).toBe(0);
  });

  test('returns non-500 when LOCAL_OUTPUT_DIR is set', async () => {
    setupScrapeMocks({});
    const res = mockRes();
    await syncGpxFiles(mockReq() as unknown as ff.Request, res as unknown as ff.Response);
    expect(res._status).not.toBe(500);
  });

  // ── New GPX files ────────────────────────────────────────────────────────
  test('adds new GPX files and writes them to the local output dir', async () => {
    setupScrapeMocks({
      oktLinks: [
        'okt_20_20251016.gpx',
        'okt_21_20251016.gpx'
      ],
      metadata: {} 
    });
    const res = mockRes();
    await syncGpxFiles(mockReq() as unknown as ff.Request, res as unknown as ff.Response);
    expect(res._status).toBe(200);
    expect((res._body as { summary: { added: number } }).summary.added).toBe(2);
    expect(fs.existsSync(path.join(tmpDir, 'gpx', 'okt', 'okt_20_20251016.gpx'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'gpx', 'okt', 'okt_21_20251016.gpx'))).toBe(true);
    const saved = JSON.parse(fs.readFileSync(path.join(tmpDir, 'metadata.json'), 'utf8'));
    expect(saved.okt['20'].last_updated).toBe('20251016');
    expect(saved.last_updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  // ── Updated GPX file ─────────────────────────────────────────────────────
  test('updates a GPX file when the scraped date is newer than stored', async () => {
    setupScrapeMocks({
      oktLinks: ['okt_01_20260101.gpx'],
      metadata: { okt: { '01': {
        last_updated: '20251107',
        filename: 'okt_01_20251107.gpx' 
      } } },
    });
    const res  = mockRes();
    await syncGpxFiles(mockReq() as unknown as ff.Request, res as unknown as ff.Response);
    const body = res._body as { summary: { updated: number; added: number } };
    expect(body.summary.updated).toBe(1);
    expect(body.summary.added).toBe(0);
  });

  // ── Unchanged GPX file ───────────────────────────────────────────────────
  test('skips GPX files whose date matches metadata and does not overwrite them', async () => {
    setupScrapeMocks({
      oktLinks: ['okt_01_20251107.gpx'],
      metadata: { okt: { '01': {
        last_updated: '20251107',
        filename: 'okt_01_20251107.gpx' 
      } } },
    });
    const res  = mockRes();
    await syncGpxFiles(mockReq() as unknown as ff.Request, res as unknown as ff.Response);
    const body = res._body as { summary: { unchanged: number; added: number; updated: number } };
    expect(body.summary.unchanged).toBe(1);
    expect(body.summary.added).toBe(0);
    expect(fs.existsSync(path.join(tmpDir, 'gpx', 'okt', 'okt_01_20251107.gpx'))).toBe(false);
  });

  // ── Listing-page fetch error resilience ────────────────────────────────
  test('records listing-page errors but continues processing other targets', async () => {
    fs.writeFileSync(path.join(tmpDir, 'metadata.json'), '{}');
    axiosMock.onGet('https://kektura.hu/okt-szakaszok').networkError();
    axiosMock.onGet('https://kektura.hu/ak-szakaszok').reply(200,
      htmlWithLinks('https://www.kektura.hu/ak-szakasz/ak-01'));
    axiosMock.onGet('https://www.kektura.hu/ak-szakasz/ak-01').reply(200,
      htmlWithLinks('ak_01_20231109.gpx'));
    axiosMock.onGet('https://kektura.hu/rpddk-szakaszok').reply(200, '<html></html>');
    stubGpxDownloads('ak_01_20231109.gpx');

    const res  = mockRes();
    await syncGpxFiles(mockReq() as unknown as ff.Request, res as unknown as ff.Response);
    const body = res._body as { summary: { errors: number; added: number } };
    expect(body.summary.errors).toBeGreaterThanOrEqual(1);
    expect(body.summary.added).toBe(1);
    expect(res._status).toBe(200);
  });

  // ── GPX fetch error resilience ───────────────────────────────────────────
  test('records GPX download errors but still processes remaining segments', async () => {
    fs.writeFileSync(path.join(tmpDir, 'metadata.json'), '{}');
    axiosMock.onGet('https://kektura.hu/okt-szakaszok').reply(200, htmlWithLinks(
      'https://www.kektura.hu/okt-szakasz/okt-01',
      'https://www.kektura.hu/okt-szakasz/okt-02',
    ));
    axiosMock.onGet('https://www.kektura.hu/okt-szakasz/okt-01').reply(200, htmlWithLinks('okt_01_20251107.gpx'));
    axiosMock.onGet('https://www.kektura.hu/okt-szakasz/okt-02').reply(200, htmlWithLinks('okt_02_20251016.gpx'));
    axiosMock.onGet('https://kektura.hu/ak-szakaszok').reply(200, '<html></html>');
    axiosMock.onGet('https://kektura.hu/rpddk-szakaszok').reply(200, '<html></html>');
    axiosMock.onGet(/okt_01_20251107\.gpx/).networkError();
    axiosMock.onGet(/okt_02_20251016\.gpx/).reply(200, Buffer.from('<gpx/>'));

    const res  = mockRes();
    await syncGpxFiles(mockReq() as unknown as ff.Request, res as unknown as ff.Response);
    const body = res._body as { summary: { errors: number; added: number } };
    expect(body.summary.errors).toBe(1);
    expect(body.summary.added).toBe(1);
  });

  // ── Mixed across trails ──────────────────────────────────────────────────
  test('correctly categorises segments across multiple trails', async () => {
    setupScrapeMocks({
      oktLinks:   ['okt_01_20251107.gpx'],
      akLinks:    ['ak_01_20260101.gpx'],
      rpddkLinks: ['rpddk_01_20251008.gpx'],
      metadata: {
        okt: { '01': {
          last_updated: '20251107',
          filename: 'okt_01_20251107.gpx' 
        } },
        ak:  { '01': {
          last_updated: '20231109',
          filename: 'ak_01_20231109.gpx'  
        } },
      },
    });
    const res  = mockRes();
    await syncGpxFiles(mockReq() as unknown as ff.Request, res as unknown as ff.Response);
    const body = res._body as { summary: { unchanged: number; updated: number; added: number; errors: number } };
    expect(body.summary.unchanged).toBe(1);
    expect(body.summary.updated).toBe(1);
    expect(body.summary.added).toBe(1);
    expect(body.summary.errors).toBe(0);
  });

  // ── Response shape ───────────────────────────────────────────────────────
  test('returns a well-formed response body', async () => {
    setupScrapeMocks({ metadata: {} });
    const res = mockRes();
    await syncGpxFiles(mockReq() as unknown as ff.Request, res as unknown as ff.Response);
    expect(res._body).toMatchObject({
      success: true,
      summary: expect.objectContaining({
        added: expect.any(Number),
        updated: expect.any(Number),
        unchanged: expect.any(Number),
        errors: expect.any(Number),
        duration_ms: expect.any(Number),
      }),
      details: expect.objectContaining({
        added: expect.any(Array),
        updated: expect.any(Array),
        unchanged: expect.any(Array),
        errors: expect.any(Array),
      }),
    });
  });
});
