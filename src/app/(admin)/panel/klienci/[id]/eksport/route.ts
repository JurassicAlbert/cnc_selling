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

export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
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
