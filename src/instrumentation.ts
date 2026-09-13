import type { Instrumentation } from 'next';

import { logger } from '@/server/logging/logger';
import { describeRequestError } from '@/server/logging/request-error';

/**
 * Server-side error reporting.
 *
 * `docs/AI-CHECKLIST.md` BUG-36 is the reason this file exists. One SSR
 * render died with `TypeError: Cannot read properties of null (reading
 * 'namePl')` during a full e2e run, once in 114 tests, and has never been
 * reproduced. Four mechanisms are ruled out in that entry, and the one piece
 * of circumstantial evidence it reasoned from turned out to belong to a
 * different bug (BUG-37).
 *
 * **The reason it could not be chased is that almost nothing was recorded.**
 * Next prints an uncaught render error as a message, `at ignore-listed
 * frames`, and a digest - so the log says an error happened somewhere, and
 * not which route produced it or what URL was being served. Two separate
 * investigations started and stopped there.
 *
 * `onRequestError` is handed exactly the missing facts: `context.routePath`
 * (the route file), `context.routeType` (render / route / action / proxy) and
 * `request.path`. Stable since Next 15 - verified against
 * `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md`
 * rather than assumed, since this is not the Next.js in anyone's training
 * data.
 *
 * **This is instrumentation, not a fix**, and it is worth being clear about
 * that: it does not make the `TypeError` less likely. It makes the next
 * occurrence diagnosable in one sighting instead of none, which is the same
 * trade T-36 settled on after the obvious fix there made things worse.
 *
 * **It logs, it does not phone anywhere.** The Next docs' own example POSTs
 * the error to an external endpoint; that would send request paths and stack
 * traces off this machine, which is not something to add as a side effect of
 * chasing a flake. `logger.ts` writes one JSON object per line, which is what
 * an aggregator wants if one is ever put in front of it.
 *
 * What is safe to log is decided in `logging/request-error.ts` and tested in
 * `tests/unit/request-error-report.test.ts` - headers never reach the log,
 * and query strings are reduced to their keys, because the emailed order link
 * carries a one-time token.
 */
export const onRequestError: Instrumentation.onRequestError = (error, request, context) => {
  logger.error('ssr.request_error', describeRequestError(error, request, context));
};

/**
 * Deliberately empty of tracing.
 *
 * `register` is the hook an OpenTelemetry exporter would go in, and there is
 * no aggregator to export to yet. An empty one is not required - the file may
 * export only `onRequestError` - so it is left out entirely rather than
 * stubbed, which would look like something switched off rather than something
 * never set up.
 */
