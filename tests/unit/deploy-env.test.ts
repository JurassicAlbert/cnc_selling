import { describe, expect, it } from 'vitest';

import { DEPLOY_ENV, checkDeployEnv } from '../../scripts/deploy-env.mjs';

/**
 * The production environment manifest, and the preflight that reads it.
 *
 * Written before the deploy script itself, because "deploy all missing
 * configs" is only meaningful if something knows what the full set is. The
 * code reads **18** distinct variables and `.env.example` documented 15, so
 * the set was already drifting while it lived only in people's heads.
 *
 * **The preflight refuses; it does not repair.** Several of these values are
 * things only the owner can supply - Przelewy24's merchant credentials, a
 * Resend key, the bank account number - and inventing a placeholder that lets
 * a deploy proceed is exactly the „no fake functionality" line in `AGENTS.md`.
 * A missing payment credential must stop a release, not be filled in with
 * something that looks plausible.
 *
 * Three of the rules here are not about presence at all but about values that
 * are individually dangerous in production, and they are the reason this is a
 * tested module rather than a `grep` in a shell script.
 */

describe('the manifest itself', () => {
  it('covers every variable the application actually reads', () => {
    /*
      The list is the output of grepping `process.env.X` across `src/`,
      `prisma/`, `scripts/` and `next.config.ts` on 2026-09-16. It is pinned
      here so that adding a new `process.env` read without deciding whether
      production needs it fails a test rather than a deployment.
    */
    const READ_BY_THE_CODE = [
      'CSP_MODE',
      'DATABASE_URL',
      'EMAIL_FROM',
      'MAIL_DEV_LOG_SECRETS',
      'NEXT_PUBLIC_SITE_URL',
      'NEXT_SERVER_ACTIONS_ENCRYPTION_KEY',
      'P24_API_KEY',
      'P24_CRC',
      'P24_MERCHANT_ID',
      'P24_POS_ID',
      'P24_SANDBOX',
      'RESEND_API_KEY',
      'SEED_ADMIN_EMAIL',
      'SERVER_ACTIONS_ALLOWED_ORIGINS',
      'SESSION_SECRET',
      'TEST_DATABASE_URL',
    ];

    const named = DEPLOY_ENV.map((entry) => entry.name);
    for (const variable of READ_BY_THE_CODE) {
      expect(named, `${variable} is read by the code but absent from the manifest`).toContain(variable);
    }
  });

  it('gives every entry a reason a human can act on', () => {
    // A manifest that says "DATABASE_URL: required" tells an operator
    // nothing they did not already know. Each entry has to say what breaks.
    for (const entry of DEPLOY_ENV) {
      expect(entry.why.length, `${entry.name} has no usable explanation`).toBeGreaterThan(30);
    }
  });
});

/** A production environment with nothing wrong with it, as a baseline to break. */
const GOOD = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://cnc:realpassword@db:5432/cnc_selling?schema=public',
  SESSION_SECRET: 'FJv8slm2QwErTyUiOpAsDfGhJkLzXcVb',
  BETTER_AUTH_SECRET: 'zXcVbNmAsDfGhJkLqWeRtYuIoP123456',
  SEED_ADMIN_EMAIL: 'owner@rytdesign.pl',
  NEXT_PUBLIC_SITE_URL: 'https://rytdesign.pl',
  NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
  SERVER_ACTIONS_ALLOWED_ORIGINS: 'rytdesign.pl',
};

describe('checkDeployEnv - what must be present', () => {
  it('passes a complete production environment', () => {
    const result = checkDeployEnv(GOOD, { target: 'production' });

    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('names every missing required variable at once, not one per run', () => {
    /*
      One-at-a-time reporting turns a first deploy into a guessing game:
      fix a variable, re-run, discover the next. An operator should be able
      to fill them all in from a single output.
    */
    const result = checkDeployEnv({ NODE_ENV: 'production' }, { target: 'production' });

    expect(result.ok).toBe(false);
    const missing = result.errors.join(' ');
    expect(missing).toContain('DATABASE_URL');
    expect(missing).toContain('SESSION_SECRET');
    expect(missing).toContain('NEXT_PUBLIC_SITE_URL');
    expect(missing).toContain('NEXT_SERVER_ACTIONS_ENCRYPTION_KEY');
    expect(result.errors.length).toBeGreaterThan(4);
  });

  it('does not require the test database in production', () => {
    const result = checkDeployEnv(GOOD, { target: 'production' });
    expect(result.errors.join(' ')).not.toContain('TEST_DATABASE_URL');
  });
});

describe('checkDeployEnv - values that are dangerous rather than missing', () => {
  it('refuses MAIL_DEV_LOG_SECRETS in production', () => {
    /*
      This is the one that would actually hurt. `mailer.ts` puts the rendered
      subject line in the log behind this flag, and the one-time login code is
      in that subject - `docs/REVIEW-DETAILED.md` SEC-02. The code guards it
      with `NODE_ENV !== 'production'` as well, so this is belt and braces,
      but a deploy that sets it has misunderstood something and should be
      stopped and told why.
    */
    const result = checkDeployEnv({ ...GOOD, MAIL_DEV_LOG_SECRETS: '1' }, { target: 'production' });

    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/MAIL_DEV_LOG_SECRETS/);
  });

  it('refuses a secret still set to the CI placeholder', () => {
    // `.github/workflows/ci.yml` uses `ci-only-not-a-secret` and says so.
    // Copying the workflow's env block into a server is an easy mistake and
    // a total authentication bypass.
    const result = checkDeployEnv(
      { ...GOOD, SESSION_SECRET: 'ci-only-not-a-secret' },
      { target: 'production' },
    );

    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/SESSION_SECRET/);
  });

  it('refuses a secret short enough to be guessable', () => {
    const result = checkDeployEnv({ ...GOOD, SESSION_SECRET: 'short' }, { target: 'production' });

    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/SESSION_SECRET/);
  });

  it('refuses a plain-http site URL in production', () => {
    // Every absolute URL in an email is built from this, and the cookies are
    // `Secure`. http here means login silently fails in a browser.
    const result = checkDeployEnv(
      { ...GOOD, NEXT_PUBLIC_SITE_URL: 'http://rytdesign.pl' },
      { target: 'production' },
    );

    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/NEXT_PUBLIC_SITE_URL/);
  });

  it('refuses an encryption key that is not base64 of a valid AES length', () => {
    /*
      Next's own requirement, read from its self-hosting guide: base64, and
      16, 24 or 32 bytes. A wrong one does not fail at boot - it fails later,
      intermittently, as "Failed to find Server Action" on a cart button.
    */
    const tooShort = checkDeployEnv(
      { ...GOOD, NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: Buffer.alloc(8, 1).toString('base64') },
      { target: 'production' },
    );
    expect(tooShort.ok).toBe(false);
    expect(tooShort.errors.join(' ')).toMatch(/NEXT_SERVER_ACTIONS_ENCRYPTION_KEY/);

    const notBase64 = checkDeployEnv(
      { ...GOOD, NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: 'definitely not base64!!' },
      { target: 'production' },
    );
    expect(notBase64.ok).toBe(false);
  });
});

describe('checkDeployEnv - things that are missing on purpose', () => {
  it('warns about unconfigured email rather than failing the deploy', () => {
    /*
      `docs/OPEN_ITEMS.md` items 1 and 10: the owner has not supplied a Resend
      key or the payment credentials yet, and said on 2026-09-16 to leave them
      parked. A site that cannot send email is degraded, not broken - orders
      still record - so this must not block a release. It must also never be
      silent, because "why did no confirmation arrive" is otherwise a long
      afternoon.
    */
    const result = checkDeployEnv(GOOD, { target: 'production' });

    expect(result.ok).toBe(true);
    expect(result.warnings.join(' ')).toMatch(/RESEND_API_KEY/);
  });

  it('warns about unconfigured payment rather than failing the deploy', () => {
    const result = checkDeployEnv(GOOD, { target: 'production' });

    expect(result.ok).toBe(true);
    expect(result.warnings.join(' ')).toMatch(/P24_/);
  });

  it('stops warning once they are supplied', () => {
    const configured = {
      ...GOOD,
      RESEND_API_KEY: 're_realkey',
      EMAIL_FROM: 'sklep@rytdesign.pl',
      P24_MERCHANT_ID: '12345',
      P24_POS_ID: '12345',
      P24_CRC: 'abcdef',
      P24_API_KEY: 'key',
    };

    const result = checkDeployEnv(configured, { target: 'production' });

    expect(result.warnings.join(' ')).not.toMatch(/RESEND_API_KEY/);
    expect(result.warnings.join(' ')).not.toMatch(/P24_MERCHANT_ID/);
  });
});
