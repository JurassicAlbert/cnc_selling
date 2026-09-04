/**
 * `docs/CHECKLIST.md`'s "Structured logging in place." Before this, the
 * handful of places that log an unexpected condition (`auth.ts`,
 * `mailer.ts`, `record-event.ts`) each called `console.error`/
 * `console.log` with an ad-hoc `[module] free-text message` string -
 * readable in a dev terminal, but useless to any real log aggregator
 * (CloudWatch, Datadog, a `journalctl`/Loki pipeline, ...), which needs a
 * parseable field (`level`, `event`) to filter and alert on, not a string
 * to regex against. This is the one place that decision gets made.
 *
 * Deliberately NOT a new dependency (pino/winston) - at 7 call sites
 * total, hand-rolling `JSON.stringify` is the same "prefer no dependency
 * unless it earns its weight" call already made for `mailer.ts`'s own
 * direct Resend HTTP call instead of pulling in an SDK. If logging volume
 * or need (levels, transports, sampling) ever grows past what this covers,
 * swapping the implementation behind this same three-function surface is
 * a contained change - every call site already goes through it.
 *
 * One JSON object per line (the industry-standard "structured log line"
 * shape), always - including in dev. Pretty-printing only in dev was
 * considered and rejected: it would mean the shape callers write against
 * is never the shape actually exercised locally.
 *
 * **Nothing here redacts anything.** Whatever a caller puts in `context`
 * is what lands in the log, so deciding what is safe to pass is the
 * caller's job, every time. That is not a theoretical concern: this
 * module's own header used to describe grepping the dev log for a
 * one-time login code, because `mailer.ts` logged the resolved subject
 * and the OTP subject contained the code - in every environment, with no
 * production guard (`docs/REVIEW-DETAILED.md` SEC-02). `mailer.ts` now
 * logs a hashed recipient tag and no rendered text, and puts the dev
 * convenience behind an explicit `MAIL_DEV_LOG_SECRETS=1` that is ignored
 * in production.
 *
 * §16.1: "No PII in logs beyond user id." Before adding a `logger.*`
 * call, look at what is actually inside the values being passed.
 */

export type LogLevel = 'info' | 'warn' | 'error';

export type LogContext = Record<string, unknown>;

/**
 * `Error` objects serialize to `{}` under plain `JSON.stringify` - `message`
 * and `stack` are non-enumerable own properties. Any `Error` (or
 * `Error`-shaped value nested in the context, e.g. `{ error }`) is expanded
 * to a plain object with `name`/`message`/`stack` so a real stack trace
 * actually reaches the log line instead of silently vanishing.
 */
function serializeValue(value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  return value;
}

function serializeContext(context: LogContext | undefined): LogContext | undefined {
  if (context === undefined) {
    return undefined;
  }
  const result: LogContext = {};
  for (const [key, value] of Object.entries(context)) {
    result[key] = serializeValue(value);
  }
  return result;
}

function emit(level: LogLevel, event: string, context?: LogContext): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...serializeContext(context),
  };
  const line = JSON.stringify(entry);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

/**
 * `event` is a stable, dot-namespaced identifier (`"mailer.resend_send_failed"`,
 * not a free-text sentence) - the field a log query actually filters on.
 * Free text and variable values (a template name, a recipient, an error)
 * belong in `context`, never interpolated into `event` itself.
 */
export const logger = {
  info(event: string, context?: LogContext): void {
    emit('info', event, context);
  },
  warn(event: string, context?: LogContext): void {
    emit('warn', event, context);
  },
  error(event: string, context?: LogContext): void {
    emit('error', event, context);
  },
};
