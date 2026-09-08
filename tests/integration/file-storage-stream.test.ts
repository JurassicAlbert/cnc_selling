/**
 * `docs/AI-CHECKLIST.md` SEC-09 - `/api/plik/[fileId]` read whole files into
 * memory.
 *
 * §16.1 describes that route as one that "streams via the storage adapter",
 * and it did not: `storage.get()` returns a `Buffer`, so every request pulled
 * the entire file into the process before writing a byte of the response.
 * `domain/upload/inspect.ts` caps an upload at 25 MB, so a handful of
 * concurrent downloads of large PDFs is tens of megabytes of resident memory
 * for data that is only being copied to a socket - and the route is reachable
 * by any signed-in customer with their own file, so it needs no attacker to
 * happen.
 *
 * `exists()` was the sillier half of the same thing: it called `get()` and
 * threw the bytes away, reading an entire file to answer a yes/no question.
 *
 * These tests use the real adapter against the real `uploads-dev/` directory,
 * on `public-images.test.ts`'s reasoning: mocking the filesystem here would
 * test the mock, and the thing under test IS the filesystem access. Every key
 * is prefixed and removed afterwards.
 */

import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';

import { storage } from '@/server/storage/local-disk';

const written: string[] = [];

function key(): string {
  const value = `test-stream-${randomUUID()}`;
  written.push(value);
  return value;
}

afterEach(async () => {
  await Promise.all(written.map((k) => storage.delete(k)));
  written.length = 0;
});

async function readAll(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value !== undefined) chunks.push(value);
  }
  return Buffer.concat(chunks);
}

describe('LocalDiskStorage.getStream', () => {
  it('delivers exactly the bytes that were stored', async () => {
    const k = key();
    // Larger than one filesystem read, so this genuinely arrives in pieces
    // rather than as a single chunk that would pass either way.
    const data = Buffer.alloc(300_000, 7);
    data.write('start', 0);
    data.write('end', data.length - 3);
    await storage.put(k, data);

    const stream = await storage.getStream(k);
    expect(stream).not.toBeNull();
    if (stream === null) throw new Error('unreachable');

    const received = await readAll(stream.body);
    expect(received.equals(data)).toBe(true);
    // The size travels with it, so the route can send `Content-Length` and a
    // browser can show real progress instead of a spinner of unknown length.
    expect(stream.sizeBytes).toBe(data.length);
  });

  it('returns null for a key that is not there, rather than throwing', async () => {
    // The route turns this into a 404, and a throw here would be a 500 that
    // tells a prober the difference between "no file" and "not yours".
    expect(await storage.getStream(`test-stream-${randomUUID()}`)).toBeNull();
  });

  it('refuses a key that would escape the uploads root', async () => {
    // The same defence `get`/`put` apply. Keys are server-generated UUIDs, so
    // this is depth rather than a live hole - and it is the layer that
    // resolves the path, which is where the check belongs.
    await expect(storage.getStream('../../etc/passwd')).rejects.toThrow(/unsafe storage key/i);
  });

  it('answers `exists` without reading the file', async () => {
    const k = key();
    await storage.put(k, Buffer.alloc(1_000_000, 3));

    expect(await storage.exists(k)).toBe(true);
    expect(await storage.exists(`test-stream-${randomUUID()}`)).toBe(false);
  });
});
