/**
 * `FileStorage { put, get, getSignedUrl, delete, exists }` —
 * `docs/ARCHITECTURE.md` §14's own interface, verbatim. Local disk is the
 * only implementation this pass ships (`local-disk.ts`) — an S3-compatible
 * adapter is prod's job, not built here, same "interface real, one honest
 * implementation" pattern as `src/server/mail/mailer.ts`'s `Mailer`.
 *
 * This app never actually calls `getSignedUrl` in its real request path:
 * every file is served through the authorizing `/api/plik/[fileId]` route
 * (§16.1 — "storage keys are never exposed, no public bucket"), which does
 * its own ownership check before touching storage at all. A pre-signed URL
 * that bypasses that route would contradict the app's whole access model,
 * so it exists on the interface for parity with the spec's stated shape
 * (and so a future S3 adapter can implement it if a genuine use case shows
 * up), but `LocalDiskStorage.getSignedUrl` throws rather than returning
 * something that looks like it works but isn't actually wired to anything.
 */

export interface FileStorage {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  getSignedUrl(key: string): Promise<string>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}
