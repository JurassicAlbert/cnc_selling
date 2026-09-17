/**
 * What production needs, and what must never be set there.
 *
 * `docs/DEPLOYMENT.md` is the prose; this is the machine-readable half, and
 * it is the answer to "deploy all missing configs on the server". Before it
 * existed the full set lived only in people's heads and had already drifted:
 * the code reads 18 distinct variables and `.env.example` documented 15.
 *
 * **This module refuses; it never repairs.** Several values can only come
 * from the owner - Przelewy24's merchant credentials, a Resend key - and
 * inventing a placeholder so a deploy can proceed is precisely the "no fake
 * functionality" rule in `AGENTS.md`. A missing payment credential stops a
 * release; it does not get filled in with something plausible.
 *
 * Plain `.mjs` rather than TypeScript because it runs from a shell script on
 * a server that has no build step. It is still covered by
 * `tests/unit/deploy-env.test.ts`, which Vitest imports directly.
 */

/**
 * Secrets that exist publicly and must therefore never protect anything.
 *
 * `ci-only-not-a-secret` is what `.github/workflows/ci.yml` uses, and that
 * file explains why it is safe there. Copying a workflow's `env:` block onto
 * a server is an easy and total authentication bypass.
 */
const PUBLICLY_KNOWN_SECRETS = new Set(['ci-only-not-a-secret', 'changeme', 'secret', 'dev-secret']);

/** A secret short enough to be worth guessing. */
const MINIMUM_SECRET_LENGTH = 24;

/**
 * @typedef {Object} EnvEntry
 * @property {string} name
 * @property {'required' | 'recommended' | 'optional' | 'forbidden'} level
 * @property {string} why What breaks, in terms an operator can act on.
 * @property {(value: string) => string | null} [validate] Returns a complaint, or null when fine.
 */

/** @type {EnvEntry[]} */
export const DEPLOY_ENV = [
  {
    name: 'DATABASE_URL',
    level: 'required',
    why: 'Postgres connection string. Nothing starts without it: every page reads the catalogue.',
  },
  {
    name: 'SESSION_SECRET',
    level: 'required',
    why: 'Signs the guest cart cookie. A weak or shared value lets anyone forge another visitor\'s cart.',
    validate: secretStrength,
  },
  {
    name: 'BETTER_AUTH_SECRET',
    level: 'required',
    why: 'Signs customer and staff sessions. A known value is a complete authentication bypass.',
    validate: secretStrength,
  },
  {
    name: 'SEED_ADMIN_EMAIL',
    level: 'required',
    why: 'The first administrator account the seed creates. Without it nobody can reach /panel.',
  },
  {
    name: 'NEXT_PUBLIC_SITE_URL',
    level: 'required',
    why: 'Absolute base for links in email, canonical tags and the sitemap. Must be https: session cookies are Secure, so a http origin makes login fail silently in the browser.',
    validate: (value) =>
      value.startsWith('https://') ? null : 'must be an https:// URL - Secure cookies will not be sent over http',
  },
  {
    name: 'NEXT_SERVER_ACTIONS_ENCRYPTION_KEY',
    level: 'required',
    why: 'Encrypts Server Action closures. Next generates a fresh one per build if unset, so a restart or a second instance breaks every cart button with "Failed to find Server Action" - intermittently, which is the worst way to find out.',
    validate: aesKey,
  },
  {
    name: 'SERVER_ACTIONS_ALLOWED_ORIGINS',
    level: 'required',
    why: 'Origins allowed to invoke Server Actions from behind the reverse proxy. Wrong value means every form submission is rejected as cross-origin.',
  },
  {
    name: 'RESEND_API_KEY',
    level: 'recommended',
    why: 'Sends order confirmations, one-time login codes and design-review notices. Without it the site works and sends nothing - deliberately parked by the owner on 2026-09-16, see docs/OPEN_ITEMS.md item 1.',
  },
  {
    name: 'EMAIL_FROM',
    level: 'recommended',
    why: 'The From address on every message. Needed with RESEND_API_KEY and useless without it.',
  },
  {
    name: 'P24_MERCHANT_ID',
    level: 'optional',
    why: 'Przelewy24 merchant id. Parked by the owner; until all four P24 values exist, online payment stays unavailable and bank transfer is the only method.',
  },
  {
    name: 'P24_POS_ID',
    level: 'optional',
    why: 'Przelewy24 point-of-sale id, normally identical to the merchant id. Parked with the rest of payment.',
  },
  {
    name: 'P24_CRC',
    level: 'optional',
    why: 'Przelewy24 CRC key, used to sign and verify the payment callback. Parked with the rest of payment.',
  },
  {
    name: 'P24_API_KEY',
    level: 'optional',
    why: 'Przelewy24 REST API key for registering a transaction. Parked with the rest of payment.',
  },
  {
    name: 'P24_SANDBOX',
    level: 'optional',
    why: 'Set to 1 to talk to Przelewy24\'s sandbox instead of production. Leave unset once real credentials are in use.',
  },
  {
    name: 'CSP_MODE',
    level: 'optional',
    why: 'Set to report-only to loosen the Content-Security-Policy while diagnosing a blocked script. Leave unset in normal operation - it disables enforcement.',
  },
  {
    name: 'TEST_DATABASE_URL',
    level: 'optional',
    why: 'Used only by the integration and e2e suites. A production server has no reason to have one, and pointing it at anything real is how a test run wipes a live catalogue.',
  },
  {
    name: 'MAIL_DEV_LOG_SECRETS',
    level: 'forbidden',
    why: 'Writes the rendered email subject to the log, and the one-time login subject contains the code itself (REVIEW-DETAILED.md SEC-02). The code also refuses it when NODE_ENV is production; a deploy that sets it has misunderstood something.',
  },
];

function secretStrength(value) {
  if (PUBLICLY_KNOWN_SECRETS.has(value.trim().toLowerCase())) {
    return 'is a publicly known placeholder (it appears in the CI workflow or in documentation) and protects nothing';
  }
  if (value.trim().length < MINIMUM_SECRET_LENGTH) {
    return `is only ${value.trim().length} characters; use at least ${MINIMUM_SECRET_LENGTH} (openssl rand -base64 32)`;
  }
  return null;
}

/**
 * Next's stated requirement, read from
 * `node_modules/next/dist/docs/01-app/02-guides/self-hosting.md`: base64, and
 * a valid AES length of 16, 24 or 32 bytes.
 */
function aesKey(value) {
  let decoded;
  try {
    decoded = Buffer.from(value, 'base64');
  } catch {
    return 'is not valid base64';
  }
  // Buffer.from is lenient and silently drops invalid characters, so the
  // round trip is what actually proves the string was base64.
  if (decoded.toString('base64').replace(/=+$/, '') !== value.replace(/=+$/, '')) {
    return 'is not valid base64 (generate one with: openssl rand -base64 32)';
  }
  if (![16, 24, 32].includes(decoded.length)) {
    return `decodes to ${decoded.length} bytes; AES needs 16, 24 or 32 (openssl rand -base64 32)`;
  }
  return null;
}

/**
 * Check an environment against the manifest.
 *
 * `errors` block a deploy. `warnings` do not: a site with no email key is
 * degraded but real, and the owner has parked those deliberately. Everything
 * missing is reported at once, because fix-one-rerun-discover-the-next turns
 * a first deploy into an evening.
 *
 * @param {Record<string, string | undefined>} env
 * @param {{ target: 'production' | 'staging' }} options
 */
export function checkDeployEnv(env, options) {
  const errors = [];
  const warnings = [];

  for (const entry of DEPLOY_ENV) {
    const raw = env[entry.name];
    const present = raw !== undefined && String(raw).trim() !== '';

    if (entry.level === 'forbidden') {
      if (present && String(raw).trim() !== '0' && String(raw).trim().toLowerCase() !== 'false') {
        errors.push(`${entry.name} must not be set on ${options.target}: ${entry.why}`);
      }
      continue;
    }

    if (!present) {
      if (entry.level === 'required') {
        errors.push(`${entry.name} is missing. ${entry.why}`);
      } else if (entry.level === 'recommended') {
        warnings.push(`${entry.name} is not set. ${entry.why}`);
      }
      continue;
    }

    if (entry.validate !== undefined) {
      const complaint = entry.validate(String(raw));
      if (complaint !== null) {
        errors.push(`${entry.name} ${complaint}.`);
      }
    }
  }

  // Payment is all-or-nothing: three of four credentials is a broken
  // checkout, not a partially working one, so it is worth its own line.
  const p24 = ['P24_MERCHANT_ID', 'P24_POS_ID', 'P24_CRC', 'P24_API_KEY'];
  const p24Present = p24.filter((name) => env[name] !== undefined && String(env[name]).trim() !== '');
  if (p24Present.length === 0) {
    warnings.push(
      'P24_* is not configured, so online payment (Przelewy24, BLIK, card) is unavailable and bank transfer is the only method offered. Parked by the owner; see docs/OPEN_ITEMS.md item 1.',
    );
  } else if (p24Present.length < p24.length) {
    errors.push(
      `Przelewy24 is half-configured: ${p24Present.join(', ')} set, missing ${p24.filter((n) => !p24Present.includes(n)).join(', ')}. A partial set fails at the moment a customer pays, which is the worst place to discover it.`,
    );
  }

  return { ok: errors.length === 0, errors, warnings };
}
