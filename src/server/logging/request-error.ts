import type { LogContext } from '@/server/logging/logger';

/**
 * What an SSR error is allowed to say about itself in a log line.
 *
 * `docs/AI-CHECKLIST.md` BUG-36. One render died with `TypeError: Cannot read
 * properties of null (reading 'namePl')`, once in 114 tests, and has never
 * been reproduced. The reason it could not be chased is that the only trace
 * was a stack reading `at ignore-listed frames` and a digest nobody wrote
 * down: **which route rendered it, and on what URL, was not in the log at
 * all.** `onRequestError` is handed exactly those facts, so the next
 * occurrence names itself instead of starting another investigation from
 * nothing.
 *
 * **Separated from `instrumentation.ts` so it can be tested.** The hook
 * itself is called by the framework and cannot reasonably be exercised from
 * a unit test; deciding what is safe to log is a pure function and is the
 * part that can actually go wrong.
 *
 * ## What is deliberately dropped
 *
 * `logging/logger.ts` states plainly that it redacts nothing and that
 * choosing safe values is the caller's job, and §16.1 is „No PII in logs
 * beyond user id". An error reporter is the easiest place to break both by
 * accident, because the framework hands it the whole request.
 *
 * - **Headers, entirely.** `request.headers` carries the session cookie on
 *   every signed-in request, and an `authorization` header where one is used.
 *   Logging the request object as given is the obvious implementation and it
 *   would put live session tokens into every aggregator this ever ships to.
 * - **Query string values.** A path is not automatically safe: the emailed
 *   order link carries a one-time token (`checkout.spec.ts` exists to keep it
 *   out of the address bar), and the configurator puts a whole selection in
 *   the query. The **keys** are kept, because „this request carried a
 *   `token`" is exactly what makes an error diagnosable, and the values are
 *   dropped.
 *
 * The error object itself is passed through untouched - `logger.ts` expands
 * any `Error` to `name`/`message`/`stack`, which is the stack this item
 * needed and never got.
 */

/**
 * The shape `onRequestError` is given. Declared locally so this stays
 * testable without the framework.
 *
 * **`headers` is `unknown` on purpose**, and it is the type expressing the
 * rule rather than a comment asking for it: nothing in this module may read
 * them, so nothing here is allowed to know their shape. Widening it to match
 * Next's own `Dict<string | string[]>` would have silenced the same type
 * error while quietly making the session cookie readable.
 */
export type RequestErrorRequest = {
  readonly path: string;
  readonly method: string;
  readonly headers?: unknown;
};

export type RequestErrorContext = {
  readonly routerKind: 'Pages Router' | 'App Router';
  readonly routePath: string;
  readonly routeType: 'render' | 'route' | 'action' | 'proxy';
  readonly renderSource?: 'react-server-components' | 'react-server-components-payload' | 'server-rendering';
  readonly revalidateReason?: 'on-demand' | 'stale' | undefined;
  readonly renderType?: 'dynamic' | 'dynamic-resume';
};

/**
 * The digest, when there is one.
 *
 * The Next docs are explicit that the value reaching this hook „might not be
 * the original error instance thrown, as it may be processed by React" and
 * that `digest` is how to identify the real one - so it is read defensively
 * rather than assumed. The caught value is typed `unknown` for the same
 * reason: a reporter that throws while reporting turns one failed render into
 * two, and the second has no handler at all.
 */
function digestOf(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'digest' in error) {
    const { digest } = error as { digest?: unknown };
    return digest === undefined || digest === null ? undefined : String(digest);
  }
  return undefined;
}

/**
 * The parameter names, without any of the values.
 *
 * Built with `URLSearchParams` rather than by splitting on `&` and `=`. The
 * hand-rolled version keeps the half before the first `=`, which quietly
 * leaves the tail of any value that itself contains one - base64 padding, for
 * instance - sitting in the log.
 */
function queryKeysOf(path: string): string[] {
  const separator = path.indexOf('?');
  if (separator === -1) {
    return [];
  }
  return [...new URLSearchParams(path.slice(separator + 1)).keys()];
}

function pathnameOf(path: string): string {
  const separator = path.indexOf('?');
  return separator === -1 ? path : path.slice(0, separator);
}

export function describeRequestError(
  error: unknown,
  request: RequestErrorRequest,
  context: RequestErrorContext,
): LogContext {
  return {
    error,
    digest: digestOf(error),
    method: request.method,
    path: pathnameOf(request.path),
    queryKeys: queryKeysOf(request.path),
    routePath: context.routePath,
    routeType: context.routeType,
    routerKind: context.routerKind,
    renderSource: context.renderSource,
    renderType: context.renderType,
    revalidateReason: context.revalidateReason,
  };
}
