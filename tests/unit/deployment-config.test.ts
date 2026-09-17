import { describe, expect, it } from 'vitest';

import { readServerActionsEncryptionKey, resolveAllowedOrigins } from '@/server/security/deployment';

/**
 * `docs/AI-CHECKLIST.md` BUG-18.
 *
 * Two deployment settings that are invisible until the day they are not, and
 * both fail in the same unhelpful way: a Server Action that simply refuses.
 *
 * The encryption key is checked here the way Next itself checks it - by
 * calling the same `atob` and measuring the same decoded length - because
 * every other way of validating base64 is a guess about what the framework
 * will accept. Measured against Next 16.3.2's own
 * `server/app-render/encryption-utils.js`, which does
 * `crypto.subtle.importKey('raw', stringToUint8Array(atob(rawKey)), 'AES-GCM', …)`.
 */

/** `openssl rand -base64 32` produces exactly this shape. */
const KEY_32 = Buffer.alloc(32, 7).toString('base64');
const KEY_24 = Buffer.alloc(24, 7).toString('base64');
const KEY_16 = Buffer.alloc(16, 7).toString('base64');

describe('readServerActionsEncryptionKey', () => {
  it('accepts the three AES key sizes, which is what Next will import', () => {
    expect(readServerActionsEncryptionKey(KEY_32)).toEqual({ kind: 'valid', bytes: 32 });
    expect(readServerActionsEncryptionKey(KEY_24)).toEqual({ kind: 'valid', bytes: 24 });
    expect(readServerActionsEncryptionKey(KEY_16)).toEqual({ kind: 'valid', bytes: 16 });
  });

  it('treats unset and blank alike, because Next does', () => {
    // `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=` in an env file gives `''`, and
    // Next's `if (providedKey)` falls through to generating its own. Calling
    // that "set" would report a key that is not in use.
    expect(readServerActionsEncryptionKey(undefined)).toEqual({ kind: 'absent' });
    expect(readServerActionsEncryptionKey('')).toEqual({ kind: 'absent' });
    expect(readServerActionsEncryptionKey('   ')).toEqual({ kind: 'absent' });
  });

  it('rejects a key of the wrong length, which is what a hand-made one usually is', () => {
    const twenty = readServerActionsEncryptionKey(Buffer.alloc(20).toString('base64'));
    expect(twenty.kind).toBe('invalid');
    if (twenty.kind !== 'invalid') return;
    expect(twenty.detail).toContain('20');
  });

  it('rejects a passphrase that happens to decode, rather than trusting it', () => {
    /*
      The case that made this worth a function. `atob('not a real key')` does
      NOT throw - it drops the spaces, reads the rest as base64 and hands back
      8 bytes. So "is it base64" is not the question; "what length does Next
      end up importing" is, and the answer here is one AES rejects.
    */
    const passphrase = readServerActionsEncryptionKey('not a real key');
    expect(passphrase.kind).toBe('invalid');
  });

  it('rejects base64url, because `atob` does', () => {
    // A likely mistake: plenty of tools emit URL-safe base64 by default, and
    // `-`/`_` are not in the alphabet `atob` accepts. Next would throw at
    // runtime on the first Server Action, long after the build looked fine.
    const urlSafe = readServerActionsEncryptionKey('AAAA-_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=');
    expect(urlSafe.kind).toBe('invalid');
    if (urlSafe.kind !== 'invalid') return;
    expect(urlSafe.detail).toContain('base64');
  });
});

describe('resolveAllowedOrigins', () => {
  it('is empty when unset, so the option is left off entirely', () => {
    // An empty array is not the same as no option: the config must omit it
    // rather than declare that nothing is allowed.
    expect(resolveAllowedOrigins(undefined)).toEqual([]);
    expect(resolveAllowedOrigins('')).toEqual([]);
    expect(resolveAllowedOrigins('  ,  ,')).toEqual([]);
  });

  it('reads a comma-separated list, trimmed', () => {
    expect(resolveAllowedOrigins('proxy.example, *.proxy.example')).toEqual(['proxy.example', '*.proxy.example']);
  });

  it('drops duplicates', () => {
    expect(resolveAllowedOrigins('a.example,a.example,b.example')).toEqual(['a.example', 'b.example']);
  });

  it('strips a scheme and a trailing slash, which would otherwise never match', () => {
    /*
      Next compares this list against the `Host`/`X-Forwarded-Host` header,
      which carries no scheme. `https://proxy.example` therefore matches
      nothing, and the symptom is a Server Action rejected as cross-origin in
      production only - exactly the failure the option was added to prevent.
      Normalised rather than rejected: the intent is unambiguous.
    */
    expect(resolveAllowedOrigins('https://proxy.example/')).toEqual(['proxy.example']);
    expect(resolveAllowedOrigins('http://a.example, b.example/')).toEqual(['a.example', 'b.example']);
  });
});
