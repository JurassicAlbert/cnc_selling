/**
 * The one Prisma client instance the app shares.
 *
 * Next.js hot-reloads server modules in dev without restarting the process,
 * so a naive `new PrismaClient()` at module scope creates a fresh client —
 * and a fresh connection pool — on every save. Caching it on `globalThis`
 * survives the reload; production gets a plain module-scoped singleton
 * because the module only loads once there anyway. This is the standard
 * Next.js + Prisma pattern, not something specific to this project.
 */

import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../../generated/prisma/client';
import { DB_POOL_IDLE_TIMEOUT_MS, DB_POOL_MAX_CONNECTIONS } from './pool-config';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: requireEnv('DATABASE_URL'),
    max: DB_POOL_MAX_CONNECTIONS,
    idleTimeoutMillis: DB_POOL_IDLE_TIMEOUT_MS,
  });
  return new PrismaClient({ adapter });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(`${name} is not set — check your .env`);
  }
  return value;
}
