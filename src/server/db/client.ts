/**
 * The one Prisma client instance the app shares.
 *
 * Next.js hot-reloads server modules in dev without restarting the process,
 * so a naive `new PrismaClient()` at module scope creates a fresh client -
 * and a fresh connection pool - on every save. Caching it on `globalThis`
 * survives the reload; production gets a plain module-scoped singleton
 * because the module only loads once there anyway. This is the standard
 * Next.js + Prisma pattern, not something specific to this project.
 *
 * `@prisma/adapter-pg` MUST be constructed with a real `pg.Pool` *instance*,
 * never a plain config object. Passed a config object, its `connect()`
 * stores nothing as `externalPool` and creates a brand-new `pg.Pool` (plus
 * up to `max` fresh physical connections) on every single call, tearing
 * the whole thing down again via `pool.end()` on dispose - see
 * `node_modules/@prisma/adapter-pg/dist/index.js`'s `PrismaPgAdapterFactory`.
 * Prisma calls `connect()` far more often than once per process, so this
 * silently multiplied real TCP connections and was the actual cause of the
 * `EADDRINUSE` build failures - the pool-size/idle-timeout tuning below
 * (`pool-config.ts`) was real but addressed the wrong layer. Passing an
 * instance makes the factory reuse `externalPool` for every `connect()`
 * and skip tearing it down. See `docs/HANDOVER.md` §9u.
 */

import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

import { PrismaClient } from '../../generated/prisma/client';
import { DB_POOL_IDLE_TIMEOUT_MS, DB_POOL_MAX_CONNECTIONS } from './pool-config';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const pool = new Pool({
    connectionString: requireEnv('DATABASE_URL'),
    max: DB_POOL_MAX_CONNECTIONS,
    idleTimeoutMillis: DB_POOL_IDLE_TIMEOUT_MS,
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(`${name} is not set - check your .env`);
  }
  return value;
}
