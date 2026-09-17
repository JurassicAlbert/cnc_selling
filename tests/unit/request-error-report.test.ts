import { describe, expect, it } from 'vitest';

import { describeRequestError } from '@/server/logging/request-error';

/**
 * `docs/AI-CHECKLIST.md` BUG-36.
 *
 * One SSR render died with `TypeError: Cannot read properties of null
 * (reading 'namePl')` inside an `Array.map`, once in 114 tests, and has never
 * been reproduced since. Four mechanisms are ruled out in that entry and the
 * one piece of circumstantial evidence it reasoned from turned out to belong
 * to a different bug entirely (BUG-37).
 *
 * **So the useful move is the one that worked for T-36: stop trying to catch
 * it and make the next occurrence say what it is.** Today the only trace is a
 * stack with `at ignore-listed frames` and a digest nobody recorded - which
 * route rendered it, and on what URL, is simply not in the log.
 * `onRequestError` (Next 15+, `instrumentation.ts`) carries exactly that:
 * `context.routePath`, `context.routeType`, `request.path` and the digest.
 *
 * **These tests are about what must NOT reach the log.** `logging/logger.ts`
 * says so in its own header - „Nothing here redacts anything. Whatever a
 * caller puts in `context` is what lands in the log, so deciding what is safe
 * to pass is the caller's job, every time" - and §16.1 is „No PII in logs
 * beyond user id". An error reporter is the easiest place in a codebase to
 * violate both by accident, because the framework hands it the entire
 * request, headers and all.
 *
 * Two things are genuinely dangerous here and both are pinned below:
 *
 * - **Headers.** `onRequestError` is handed `request.headers`, which on any
 *   signed-in request contains the session cookie. Logging the request object
 *   wholesale is the obvious implementation and it would put a live session
 *   token in every log aggregator the project ever ships to.
 * - **The query string.** This is the one that is easy to miss. A path is not
 *   automatically safe: `checkout.spec.ts` exists because the emailed order
 *   link carries a one-time token, and the configurator puts the whole
 *   selection in the query. So the *keys* are kept, because knowing a request
 *   carried `token` is exactly what makes an error diagnosable, and the
 *   *values* are dropped.
 */

const REQUEST = {
  path: '/koszyk/zamowienie?token=live-secret-abc123&d=cmt123',
  method: 'GET',
  headers: {
    cookie: 'better-auth.session_token=SECRET-SESSION-VALUE',
    authorization: 'Bearer SECRET-BEARER',
    'user-agent': 'Mozilla/5.0',
  },
};

const CONTEXT = {
  routerKind: 'App Router' as const,
  routePath: '/app/(shop)/koszyk/zamowienie/page',
  routeType: 'render' as const,
  renderSource: 'react-server-components' as const,
  revalidateReason: undefined,
  renderType: 'dynamic' as const,
};

/** Everything the report could possibly say, flattened, so a leak anywhere is caught. */
function reportAsText(report: Record<string, unknown>): string {
  return JSON.stringify(report);
}

describe('describeRequestError - what it records', () => {
  it('names the route, which is the whole point', () => {
    const error = Object.assign(new TypeError("Cannot read properties of null (reading 'namePl')"), {
      digest: '1234567890',
    });

    const report = describeRequestError(error, REQUEST, CONTEXT);

    // The three facts BUG-36 needed and did not have.
    expect(report.routePath).toBe('/app/(shop)/koszyk/zamowienie/page');
    expect(report.digest).toBe('1234567890');
    expect(report.path).toBe('/koszyk/zamowienie');
    // And the error itself, which `logger.ts` expands to name/message/stack.
    expect(report.error).toBe(error);
  });

  it('records the routing context that tells a render from an action', () => {
    const report = describeRequestError(new Error('x'), REQUEST, CONTEXT);

    expect(report.routeType).toBe('render');
    expect(report.renderSource).toBe('react-server-components');
    expect(report.method).toBe('GET');
  });
});

describe('describeRequestError - what it must never record', () => {
  it('drops headers entirely, session cookie and all', () => {
    const report = describeRequestError(new Error('x'), REQUEST, CONTEXT);

    const text = reportAsText(report);
    expect(text).not.toContain('SECRET-SESSION-VALUE');
    expect(text).not.toContain('SECRET-BEARER');
    expect(text).not.toContain('Mozilla');
    // Not even the container, so a later change cannot start filling it.
    expect(report).not.toHaveProperty('headers');
  });

  it('keeps query KEYS and drops query VALUES', () => {
    const report = describeRequestError(new Error('x'), REQUEST, CONTEXT);

    const text = reportAsText(report);
    // The value of a one-time order token must not survive.
    expect(text).not.toContain('live-secret-abc123');
    // But knowing the request carried a token is what makes it diagnosable.
    expect(report.queryKeys).toEqual(['token', 'd']);
  });

  it('does not leak a value through a malformed query either', () => {
    /*
      The obvious way to implement key extraction is to split on "&" and "="
      and keep the first half. A value containing "=" would then survive in
      the tail, which is exactly the shape a base64 token has.
    */
    const report = describeRequestError(new Error('x'), { ...REQUEST, path: '/x?t=aGVsbG8=&u=a=b' }, CONTEXT);

    const text = reportAsText(report);
    expect(text).not.toContain('aGVsbG8');
    expect(text).not.toContain('a=b');
    expect(report.queryKeys).toEqual(['t', 'u']);
  });
});

describe('describeRequestError - things it is handed that are not errors', () => {
  it('survives a thrown value that is not an Error', () => {
    /*
      The docs are explicit: "The caught value is typed as `unknown`. Narrow
      it before reading properties like `message` or `digest`." A reporter
      that throws while reporting turns one failed render into two, and the
      second one has no handler at all.
    */
    const report = describeRequestError('just a string', REQUEST, CONTEXT);

    expect(report.error).toBe('just a string');
    expect(report.digest).toBeUndefined();
    expect(report.routePath).toBe('/app/(shop)/koszyk/zamowienie/page');
  });

  it('survives a path with no query at all', () => {
    const report = describeRequestError(new Error('x'), { ...REQUEST, path: '/o-nas' }, CONTEXT);

    expect(report.path).toBe('/o-nas');
    expect(report.queryKeys).toEqual([]);
  });
});
