/**
 * The two deployment settings that only matter once there is more than one of
 * us - `docs/AI-CHECKLIST.md` BUG-18.
 *
 * Both are read by `next.config.ts`, which is why they live beside
 * `headers.ts`: that file is already the one thing the Next config imports
 * from `src/`, and both of these are security-shaped. Pure functions taking
 * values rather than reading `process.env` themselves, exactly like
 * `baseSecurityHeaders({ isProduction })`, so they can be tested without
 * touching the environment.
 *
 * **Why this is not just documentation.** Next 16.3.2 encrypts a Server
 * Function's closure variables before sending them to the client, and this
 * project binds closures everywhere (`removeCartItem.bind(null, cartItemId)`
 * and dozens like it). Without `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` the key
 * is generated per build and cached in `.next` **with an expiry**, so two
 * instances - or two rolling releases - can disagree, and every bound action
 * a client already holds fails with "Failed to find Server Action". The cart
 * buttons are the visible casualty. `self-hosting.md`'s own "Multi-Server
 * Deployments" section says this outright.
 */

/** What the environment actually gave us, and whether Next can use it. */
export type ServerActionsEncryptionKeyStatus =
  | { readonly kind: 'absent' }
  | { readonly kind: 'valid'; readonly bytes: 16 | 24 | 32 }
  | { readonly kind: 'invalid'; readonly detail: string };

const AES_KEY_BYTES = [16, 24, 32] as const;

/**
 * Check the key the way Next will, rather than the way base64 is usually
 * checked.
 *
 * Next does `crypto.subtle.importKey('raw', stringToUint8Array(atob(rawKey)),
 * 'AES-GCM', …)` (`server/app-render/encryption-utils.js`), so the only two
 * things that can go wrong are `atob` throwing and the decoded length not
 * being an AES key size. Both are checked here with `atob` itself, because a
 * hand-written base64 regex would be a guess about what the framework accepts
 * and would be wrong in both directions: `atob` strips whitespace and accepts
 * missing padding, and it rejects the URL-safe alphabet.
 *
 * The consequence of getting this wrong is not a failed build. It is a build
 * that succeeds and then throws on the first Server Action a customer
 * triggers, which is why it is worth failing early and loudly.
 */
export function readServerActionsEncryptionKey(raw: string | undefined): ServerActionsEncryptionKeyStatus {
  // Blank is absent: `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=` in an env file
  // gives `''`, and Next's own `if (providedKey)` falls through to generating
  // one. Reporting that as "set" would name a key that is not in use.
  if (raw === undefined || raw.trim().length === 0) {
    return { kind: 'absent' };
  }

  let decoded: string;
  try {
    decoded = atob(raw);
  } catch {
    return {
      kind: 'invalid',
      detail: 'it is not standard base64 (the URL-safe alphabet, with - and _, is not accepted). Generate one with: openssl rand -base64 32',
    };
  }

  const bytes = decoded.length;
  const match = AES_KEY_BYTES.find((size) => size === bytes);
  if (match === undefined) {
    return {
      kind: 'invalid',
      detail: `it decodes to ${bytes} bytes; AES needs 16, 24 or 32. Generate one with: openssl rand -base64 32`,
    };
  }

  return { kind: 'valid', bytes: match };
}

/**
 * The origins a Server Action may be invoked from, beyond this host.
 *
 * Next compares a Server Action request's `Origin` against `Host` (or
 * `X-Forwarded-Host`) and aborts on a mismatch, which is the CSRF defence
 * described in `data-security.md`. Behind a reverse proxy or a CDN that
 * rewrites the host, that check rejects legitimate requests, and there is no
 * environment variable for it - the option is config-only - so this is the
 * bridge from one to the other.
 *
 * Comma-separated, because that is what an env var can carry, and because the
 * list is short by nature.
 */
export function resolveAllowedOrigins(raw: string | undefined): readonly string[] {
  if (raw === undefined) {
    return [];
  }

  const seen = new Set<string>();
  for (const part of raw.split(',')) {
    /*
      The scheme and a trailing slash are stripped rather than rejected. The
      comparison is against a host header, which carries neither, so
      `https://proxy.example` would match nothing - and the symptom is a
      Server Action refused as cross-origin in production only, which is the
      exact failure this option exists to prevent. The intent of a pasted URL
      is not ambiguous, so it is honoured.
    */
    const value = part
      .trim()
      .replace(/^https?:\/\//i, '')
      .replace(/\/+$/, '');
    if (value.length > 0) {
      seen.add(value);
    }
  }
  return [...seen];
}
