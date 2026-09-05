import { describe, expect, it } from 'vitest';

import { DB_POOL_IDLE_TIMEOUT_MS, DB_POOL_MAX_CONNECTIONS } from '@/server/db/pool-config';

// Guards part of the fix for the 2026-08-26 EADDRINUSE incident
// (docs/HANDOVER.md §9t, §9u): `pg.Pool`'s 10s default idle timeout
// churned through connections fast enough to pile up thousands of
// TIME_WAIT sockets against 127.0.0.1:5433. These assertions don't
// reproduce the socket exhaustion itself - that's an OS-level condition,
// not something a unit test can see - but they stop someone from
// silently reverting the pool tuning back toward pg's churn-prone
// defaults. This was necessary but not sufficient: the actual root cause
// (§9u) was `client.ts` passing `PrismaPg` a config object instead of a
// `pg.Pool` instance, which isn't something this pure, framework-free
// test file can guard - see §9u's "Tests" note for why that fix has no
// automated regression test.
describe('db pool config', () => {
  it('keeps the idle timeout well above pg.Pool\'s 10s default', () => {
    expect(DB_POOL_IDLE_TIMEOUT_MS).toBeGreaterThanOrEqual(30_000);
  });

  it('keeps the pool small - this app never needs pg.Pool\'s default 10 connections', () => {
    expect(DB_POOL_MAX_CONNECTIONS).toBeGreaterThan(0);
    expect(DB_POOL_MAX_CONNECTIONS).toBeLessThanOrEqual(10);
  });
});
