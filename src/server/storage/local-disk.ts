import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { FileStorage } from '@/server/storage/file-storage';

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
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async getSignedUrl(): Promise<string> {
    throw new Error(
      'LocalDiskStorage.getSignedUrl is not implemented - every file is served through the authorizing /api/plik/[fileId] route instead; see file-storage.ts\'s header.',
    );
  }

  async delete(key: string): Promise<void> {
    await rm(resolveKeyPath(key), { force: true });
  }

  async exists(key: string): Promise<boolean> {
    return (await this.get(key)) !== null;
  }
}

export const storage: FileStorage = new LocalDiskStorage();
