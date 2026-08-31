/**
 * RODO Art. 15 access-request export — a genuine downloadable JSON file,
 * not a preview. Real route handler rather than a Server Action since this
 * is a plain GET producing a file, mirroring `/api/plik/[fileId]`'s own
 * shape (`NextResponse` with a real `Content-Disposition`).
 *
 * Uses `getSession()` directly, not `requireStaffSession()` — the latter's
 * `notFound()`/`redirect()` calls are for Server Components/Actions, and
 * throw a special "fallback" error Route Handlers don't have a boundary
 * for; Next.js only turns it into a generic HTML 404 page instead of this
 * route's own response. `/api/plik/[fileId]/route.ts` avoids exactly this
 * for the same reason — mirrored here, not rediscovered independently.
 */

import { NextResponse } from 'next/server';

import { getSession } from '@/server/auth/session';
import { buildCustomerExport } from '@/server/repositories/admin-customers';
import { writeAuditLog } from '@/server/audit/write-audit-log';

type RouteContext = {
  readonly params: Promise<{ readonly id: string }>;
};

/**
 * A prefetch must never reach the body of this handler. Checked **first**,
 * before the session read, because nothing at all should happen for a
 * speculative request — and because `getSession()` reads `next/headers`,
 * so guarding ahead of it is also what makes this testable
 * (`tests/unit/customer-export-route.test.ts`).
 *
 * Found 2026-08-31: the customer page linked here with `next/link`, Next
 * prefetched the target, and simply opening a customer's page produced
 * `GET …/eksport?_rsc=… → 200` plus an `AuditLog` row claiming a RODO export
 * had been performed. §16A.2 invariant 4 makes that log the record of what
 * happened; it was recording accesses that never occurred. The link is a
 * plain `<a>` now, which is the convention `/api/plik/[fileId]` already
 * followed — this guard is the second layer, for any future link that
 * forgets.
 */
function isPrefetch(request: Request): boolean {
  return (
    request.headers.get('next-router-prefetch') !== null ||
    request.headers.get('purpose') === 'prefetch'
  );
}

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  if (isPrefetch(request)) {
    return new NextResponse(null, { status: 404 });
  }

  const session = await getSession();
  if (session === null || session.role === 'CUSTOMER') {
    return new NextResponse(null, { status: 404 });
  }
  const staff = session;
  const { id } = await context.params;

  const data = await buildCustomerExport(id);
  if (data === null) {
    return new NextResponse(null, { status: 404 });
  }

  await writeAuditLog({ actor: staff, entity: 'User', entityId: id, action: 'export' });

  return new NextResponse(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="klient-${encodeURIComponent(id)}-eksport.json"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
