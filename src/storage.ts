import { Storage } from '@google-cloud/storage';
import * as fs from 'fs';
import * as path from 'path';
import type { Metadata } from './types';

// ─── Interface ────────────────────────────────────────────────────────────────

export interface IStorageAdapter {
  /** Read metadata.json; returns {} when it doesn't exist yet. */
  readMetadata(): Promise<Metadata>;
  /** Persist metadata.json. */
  writeMetadata(metadata: Metadata): Promise<void>;
  /** Store a GPX file at path gpx/<trail>/<filename>. */
  writeGpx(trail: string, filename: string, data: Buffer): Promise<void>;
  /** Probe write access — throws if the storage backend is not writable. */
  checkWritable(): Promise<void>;
}

// ─── GCS adapter ─────────────────────────────────────────────────────────────

export class GcsStorageAdapter implements IStorageAdapter {
  private storage = new Storage();

  constructor(private readonly bucketName: string) { }

  async checkWritable(): Promise<void> {
    const probe = this.storage.bucket(this.bucketName).file('.write-probe');
    await probe.save('', {
      contentType: 'text/plain',
      resumable: false,
    });
    await probe.delete();
  }

  async readMetadata(): Promise<Metadata> {
    const file = this.storage.bucket(this.bucketName).file('metadata.json');
    try {
      const [contents] = await file.download();

      return JSON.parse(contents.toString('utf8')) as Metadata;
    } catch (err: unknown) {
      if ((err as { code?: number }).code === 404) {
        console.log('metadata.json not found in bucket — starting fresh.');

        return {};
      }
      throw err;
    }
  }

  async writeMetadata(metadata: Metadata): Promise<void> {
    await this.storage
      .bucket(this.bucketName)
      .file('metadata.json')
      .save(JSON.stringify(metadata, null, 2), {
        contentType: 'application/json',
        resumable: false,
      });
    console.log(`  Saved → gs://${this.bucketName}/metadata.json`);
  }

  async writeGpx(trail: string, filename: string, data: Buffer): Promise<void> {
    const destPath = `gpx/${trail}/${filename}`;
    await this.storage
      .bucket(this.bucketName)
      .file(destPath)
      .save(data, {
        contentType: 'application/gpx+xml',
        resumable: false 
      });
    console.log(`  Stored → gs://${this.bucketName}/${destPath}`);
  }
}

// ─── Local filesystem adapter ─────────────────────────────────────────────────

export class LocalStorageAdapter implements IStorageAdapter {
  constructor(private readonly outputDir: string) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  async checkWritable(): Promise<void> {
    fs.mkdirSync(this.outputDir, { recursive: true });
    const probe = path.join(this.outputDir, '.write-probe');
    fs.writeFileSync(probe, '');
    fs.unlinkSync(probe);
  }

  async readMetadata(): Promise<Metadata> {
    const filePath = path.join(this.outputDir, 'metadata.json');
    if (!fs.existsSync(filePath)) {
      console.log(`metadata.json not found in ${this.outputDir} — starting fresh.`);

      return {};
    }

    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as Metadata;
  }

  async writeMetadata(metadata: Metadata): Promise<void> {
    const filePath = path.join(this.outputDir, 'metadata.json');
    fs.writeFileSync(filePath, JSON.stringify(metadata, null, 2), 'utf8');
    console.log(`  Saved → ${filePath}`);
  }

  async writeGpx(trail: string, filename: string, data: Buffer): Promise<void> {
    const dir = path.join(this.outputDir, 'gpx', trail);
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, filename);
    fs.writeFileSync(filePath, data);
    console.log(`  Stored → ${filePath}`);
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createStorageAdapter(): IStorageAdapter {
  const localDir = process.env.LOCAL_OUTPUT_DIR;
  if (localDir) {
    console.log(`[local mode] Writing output to: ${path.resolve(localDir)}`);

    return new LocalStorageAdapter(localDir);
  }
  const bucket = process.env.GCS_BUCKET_NAME;
  if (bucket) {
    return new GcsStorageAdapter(bucket);
  }
  throw new Error(
    'Storage not configured. Set GCS_BUCKET_NAME (GCS) or LOCAL_OUTPUT_DIR (local).'
  );
}
