/**
 * `FileStorage { put, get, getSignedUrl, delete, exists }` -
 * `docs/ARCHITECTURE.md` §14's own interface, verbatim. Local disk is the
 * only implementation this pass ships (`local-disk.ts`) - an S3-compatible
 * adapter is prod's job, not built here, same "interface real, one honest
 * implementation" pattern as `src/server/mail/mailer.ts`'s `Mailer`.
 *
 * This app never actually calls `getSignedUrl` in its real request path:
 * every file is served through the authorizing `/api/plik/[fileId]` route
 * (§16.1 - "storage keys are never exposed, no public bucket"), which does
 * its own ownership check before touching storage at all. A pre-signed URL
 * that bypasses that route would contradict the app's whole access model,
 * so it exists on the interface for parity with the spec's stated shape
 * (and so a future S3 adapter can implement it if a genuine use case shows
 * up), but `LocalDiskStorage.getSignedUrl` throws rather than returning
 * something that looks like it works but isn't actually wired to anything.
 */

/**
 * A file the caller can forward without holding it.
 *
 * `sizeBytes` travels with the stream because the only way to learn it
 * otherwise is to read the whole thing, which is the problem being solved -
 * and without it a response cannot carry `Content-Length`, so a browser
 * downloading a 25 MB PDF shows a spinner of unknown length.
 */
export type StoredFileStream = {
  readonly body: ReadableStream<Uint8Array>;
  readonly sizeBytes: number;
};

export interface FileStorage {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  /**
   * SEC-09, and the one member here that is not in §14's verbatim list.
   *
   * §14 names `{ put, get, getSignedUrl, delete, exists }`; §16.1 says the
   * file route "streams via the storage adapter". Those two cannot both be
   * satisfied - `get` returns a `Buffer`, so a route built on it reads the
   * entire file into the process before writing a byte. The interface is what
   * gives, because §16.1 describes the behaviour a customer gets and §14
   * describes a shape. `ARCHITECTURE.md` §14 records the addition.
   *
   * `null` for a missing key, never a throw: the route turns that into the
   * same 404 an unauthorised request gets, and a throw would be a 500 that
   * tells a prober the two apart.
   */
  getStream(key: string): Promise<StoredFileStream | null>;
  getSignedUrl(key: string): Promise<string>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}
