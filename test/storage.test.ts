// ─── Module mocks ─────────────────────────────────────────────────────────────
jest.mock('@google-cloud/storage');

// ─── Imports ──────────────────────────────────────────────────────────────────
import * as fs from 'fs';
import * as path from 'path';
import { Storage } from '@google-cloud/storage';

import { GcsStorageAdapter, LocalStorageAdapter, createStorageAdapter } from '../src/storage';
import { makeTempDir } from './helpers';

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
  delete process.env.GCS_BUCKET_NAME;
  delete process.env.LOCAL_OUTPUT_DIR;
});

// ═════════════════════════════════════════════════════════════════════════════
// GcsStorageAdapter
// ═════════════════════════════════════════════════════════════════════════════
describe('GcsStorageAdapter', () => {
  let adapter: GcsStorageAdapter;

  beforeEach(() => { adapter = new GcsStorageAdapter('test-bucket'); });

  test('readMetadata returns parsed JSON when file exists', async () => {
    const stored = { okt: { '01': {
      last_updated: '20251107',
      filename: 'okt_01_20251107.gpx' 
    } } };
    gcsMock.download.mockResolvedValueOnce([Buffer.from(JSON.stringify(stored))]);
    const result = await adapter.readMetadata();
    expect(result).toEqual(stored);
    expect(gcsMock.bucket).toHaveBeenCalledWith('test-bucket');
    expect(gcsMock.file).toHaveBeenCalledWith('metadata.json');
  });

  test('readMetadata returns {} when file does not exist (404)', async () => {
    gcsMock.download.mockRejectedValueOnce(Object.assign(new Error('Not Found'), { code: 404 }));
    expect(await adapter.readMetadata()).toEqual({});
  });

  test('readMetadata re-throws non-404 errors', async () => {
    gcsMock.download.mockRejectedValueOnce(Object.assign(new Error('Server Error'), { code: 500 }));
    await expect(adapter.readMetadata()).rejects.toThrow('Server Error');
  });

  test('writeMetadata saves pretty-printed JSON with correct content-type', async () => {
    const metadata = { okt: { '20': {
      last_updated: '20251016',
      filename: 'okt_20_20251016.gpx' 
    } } };
    await adapter.writeMetadata(metadata);
    expect(gcsMock.file).toHaveBeenCalledWith('metadata.json');
    expect(gcsMock.save).toHaveBeenCalledWith(
      JSON.stringify(metadata, null, 2),
      expect.objectContaining({ contentType: 'application/json' })
    );
  });

  test('writeMetadata propagates GCS errors', async () => {
    gcsMock.save.mockRejectedValueOnce(new Error('Permission denied'));
    await expect(adapter.writeMetadata({})).rejects.toThrow('Permission denied');
  });

  test('writeGpx stores file at gpx/<trail>/<filename>', async () => {
    const data = Buffer.from('<gpx/>');
    await adapter.writeGpx('okt', 'okt_01_20251107.gpx', data);
    expect(gcsMock.file).toHaveBeenCalledWith('gpx/okt/okt_01_20251107.gpx');
    expect(gcsMock.save).toHaveBeenCalledWith(data, expect.objectContaining({ contentType: 'application/gpx+xml' }));
  });

  test('writeGpx propagates GCS errors', async () => {
    gcsMock.save.mockRejectedValueOnce(new Error('Upload failed'));
    await expect(adapter.writeGpx('okt', 'okt_01_20251107.gpx', Buffer.from(''))).rejects.toThrow('Upload failed');
  });

  test('checkWritable saves and deletes a probe file', async () => {
    await adapter.checkWritable();
    expect(gcsMock.file).toHaveBeenCalledWith('.write-probe');
    expect(gcsMock.save).toHaveBeenCalledWith('', expect.objectContaining({ contentType: 'text/plain' }));
    expect(gcsMock.delete).toHaveBeenCalled();
  });

  test('checkWritable propagates save errors', async () => {
    gcsMock.save.mockRejectedValueOnce(new Error('Permission denied'));
    await expect(adapter.checkWritable()).rejects.toThrow('Permission denied');
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// LocalStorageAdapter
// ═════════════════════════════════════════════════════════════════════════════
describe('LocalStorageAdapter', () => {
  let tmpDir:  string;
  let adapter: LocalStorageAdapter;

  beforeEach(() => { tmpDir = makeTempDir(); adapter = new LocalStorageAdapter(tmpDir); });
  afterEach(()  => { fs.rmSync(tmpDir, {
    recursive: true,
    force: true 
  }); });

  test('readMetadata returns {} when metadata.json does not exist', async () => {
    expect(await adapter.readMetadata()).toEqual({});
  });

  test('readMetadata returns saved metadata after writeMetadata', async () => {
    const metadata = { ak: { '01': {
      last_updated: '20231109',
      filename: 'ak_01_20231109.gpx' 
    } } };
    await adapter.writeMetadata(metadata);
    expect(await adapter.readMetadata()).toEqual(metadata);
  });

  test('writeMetadata persists pretty-printed JSON to disk', async () => {
    const metadata = { okt: { '01': {
      last_updated: '20251107',
      filename: 'okt_01_20251107.gpx' 
    } } };
    await adapter.writeMetadata(metadata);
    const raw = fs.readFileSync(path.join(tmpDir, 'metadata.json'), 'utf8');
    expect(JSON.parse(raw)).toEqual(metadata);
    expect(raw).toContain('\n');
  });

  test('writeGpx creates the file at outputDir/gpx/<trail>/<filename>', async () => {
    const data = Buffer.from('<gpx/>');
    await adapter.writeGpx('rpddk', 'rpddk_01_20251008.gpx', data);
    const filePath = path.join(tmpDir, 'gpx', 'rpddk', 'rpddk_01_20251008.gpx');
    expect(fs.existsSync(filePath)).toBe(true);
    expect(fs.readFileSync(filePath)).toEqual(data);
  });

  test('writeGpx creates nested directories automatically', async () => {
    await adapter.writeGpx('okt', 'okt_01_20251107.gpx', Buffer.from('<gpx/>'));
    expect(fs.existsSync(path.join(tmpDir, 'gpx', 'okt'))).toBe(true);
  });

  test('constructor creates the output directory if it does not exist', () => {
    const newDir = path.join(tmpDir, 'nested', 'output');
    new LocalStorageAdapter(newDir);
    expect(fs.existsSync(newDir)).toBe(true);
  });

  test('checkWritable succeeds and leaves no .write-probe file behind', async () => {
    await adapter.checkWritable();
    expect(fs.existsSync(path.join(tmpDir, '.write-probe'))).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// createStorageAdapter factory
// ═════════════════════════════════════════════════════════════════════════════
describe('createStorageAdapter', () => {
  let tmpDir: string;
  beforeEach(() => { tmpDir = makeTempDir(); });
  afterEach(()  => { fs.rmSync(tmpDir, {
    recursive: true,
    force: true 
  }); });

  test('returns LocalStorageAdapter when LOCAL_OUTPUT_DIR is set', () => {
    process.env.LOCAL_OUTPUT_DIR = tmpDir;
    expect(createStorageAdapter()).toBeInstanceOf(LocalStorageAdapter);
  });

  test('returns GcsStorageAdapter when GCS_BUCKET_NAME is set', () => {
    process.env.GCS_BUCKET_NAME = 'my-bucket';
    expect(createStorageAdapter()).toBeInstanceOf(GcsStorageAdapter);
  });

  test('prefers LOCAL_OUTPUT_DIR over GCS_BUCKET_NAME when both are set', () => {
    process.env.LOCAL_OUTPUT_DIR = tmpDir;
    process.env.GCS_BUCKET_NAME  = 'my-bucket';
    expect(createStorageAdapter()).toBeInstanceOf(LocalStorageAdapter);
  });

  test('throws when neither env var is set', () => {
    expect(() => createStorageAdapter()).toThrow();
  });
});
