import { NextResponse } from 'next/server';

import { prisma } from '@/server/db/client';

/**
 * Liveness and readiness in one route.
 *
 * Polled by `scripts/deploy.sh` after the container is replaced, and by the
 * `restart: unless-stopped` stack around it. `docs/DEPLOYMENT.md` section 4
 * describes how a release uses it.
 *
 * **It touches the database on purpose.** A Next server answers a static
 * route long before it can serve a page, and every storefront page reads the
 * catalogue - so "the process is up" and "the site works" are different
 * claims, and only the second one is worth reporting. A healthcheck that
 * cannot tell them apart will hold a completely broken deployment up as a
 * good one, which is worse than having no healthcheck at all.
 *
 * **It says almost nothing.** Unauthenticated and reachable from the
 * internet, so no version, schema, migration state or error text: those turn
 * a healthcheck into free reconnaissance. The detail goes to the structured
 * log, where an operator can already read it.
 */

// Never prerendered, never cached. A cached healthcheck keeps reporting the
// last good answer while the thing it describes is down - precisely when
// somebody has started relying on it.
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

export async function GET(): Promise<NextResponse> {
  try {
    // The cheapest query that proves a real round trip to Postgres: no table,
    // no row, no dependence on the catalogue being seeded.
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: 'ok' }, { status: 200, headers: NO_STORE });
  } catch {
    // Deliberately swallowed rather than returned. The caller gets a 503; the
    // reason is for the logs, not for whoever is probing the endpoint.
    return NextResponse.json({ status: 'unavailable' }, { status: 503, headers: NO_STORE });
  }
}
