import { createReadStream } from 'node:fs';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';

import type { FileStorage, StoredFileStream } from '@/server/storage/file-storage';

/**
 * Dev/MVP implementation of `FileStorage`, writing into `/uploads-dev/`
 * at the repo root - already gitignored (`.gitignore`'s `/uploads-dev/`
 * predates this file, confirming it's the intended target). Not meant
 * for production (no redundancy, no CDN, single-instance-only) - that's
 * `file-storage.ts`'s documented, deliberate gap, not an oversight here.
 */

const UPLOADS_ROOT = path.resolve(process.cwd(), 'uploads-dev');

/**
 * Storage keys are generated server-side (`crypto.randomUUID()` at the
 * call site) and never derived from user input, but this is still the
 * layer responsible for refusing to touch the filesystem outside its own
 * root - a defense-in-depth check, not a trust boundary this class
 * assumes some other layer already enforced perfectly.
 */
const SAFE_KEY_PATTERN = /^[a-zA-Z0-9_-]+$/;

/** ENOENT is "not there", which every reader here reports as absence rather than as a failure. */
function isMissing(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

function resolveKeyPath(key: string): string {
  if (!SAFE_KEY_PATTERN.test(key)) {
    throw new Error(`Refusing to store/read an unsafe storage key: ${JSON.stringify(key)}`);
  }
  return path.join(UPLOADS_ROOT, key);
}

class LocalDiskStorage implements FileStorage {
  async put(key: string, data: Buffer): Promise<void> {
    await mkdir(UPLOADS_ROOT, { recursive: true });
    await writeFile(resolveKeyPath(key), data);
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      return await readFile(resolveKeyPath(key));
    } catch (error) {
      if (isMissing(error)) {
        return null;
      }
      throw error;
    }
  }

  /**
   * SEC-09. `stat` first, then a read stream: the size is needed for
   * `Content-Length` anyway, and it is also how a missing file is detected
   * before a stream exists to clean up. `createReadStream` on a path that
   * disappears reports the error asynchronously, on the stream, which is far
   * harder for a caller to turn into a clean 404.
   *
   * `resolveKeyPath` runs before `stat`, so an unsafe key is refused here
   * exactly as it is for `get` and `put` - the path-resolving layer is where
   * that check belongs, whatever the caller did first.
   */
  async getStream(key: string): Promise<StoredFileStream | null> {
    const filePath = resolveKeyPath(key);
    let sizeBytes: number;
    try {
      sizeBytes = (await stat(filePath)).size;
    } catch (error) {
      if (isMissing(error)) {
        return null;
      }
      throw error;
    }

    // `Readable.toWeb` gives the `ReadableStream` a `Response` body wants,
    // and keeps the backpressure - a slow client throttles the disk read
    // rather than filling memory with what it has not collected yet.
    const body = Readable.toWeb(createReadStream(filePath)) as ReadableStream<Uint8Array>;
    return { body, sizeBytes };
  }

  async getSignedUrl(): Promise<string> {
    throw new Error(
      'LocalDiskStorage.getSignedUrl is not implemented - every file is served through the authorizing /api/plik/[fileId] route instead; see file-storage.ts\'s header.',
    );
  }

  async delete(key: string): Promise<void> {
    await rm(resolveKeyPath(key), { force: true });
  }

  /*
    `stat`, not `get`. This used to read the entire file and throw the bytes
    away to answer a yes/no question - the same defect as SEC-09's route, in
    its silliest form.
  */
  async exists(key: string): Promise<boolean> {
    try {
      await stat(resolveKeyPath(key));
      return true;
    } catch (error) {
      if (isMissing(error)) {
        return false;
      }
      throw error;
    }
  }
}

export const storage: FileStorage = new LocalDiskStorage();
