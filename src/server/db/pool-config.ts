/**
 * `pg.Pool` defaults to `max: 10` and `idleTimeoutMillis: 10_000` - it
 * closes an idle connection after just 10s and opens a fresh one on the
 * next query. During a normal dev session, where requests land more than
 * 10s apart far more often than not, that's thousands of connect/close
 * cycles over a day. On Windows each cycle leaves the local ephemeral
 * port in TIME_WAIT for several minutes, and enough of them piling up
 * against a single fixed destination (127.0.0.1:5433) can make a later
 * `connect()` fail with EADDRINUSE - seen 2026-08-26, see
 * `docs/HANDOVER.md` §9r. A longer idle timeout and a smaller pool cut
 * that churn rate substantially; this app never needs 10 concurrent
 * connections anyway.
 */
export const DB_POOL_MAX_CONNECTIONS = 5;
export const DB_POOL_IDLE_TIMEOUT_MS = 60_000;
