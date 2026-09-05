/**
 * SEC-10 - found 2026-08-31 while verifying SEC-04 in a real browser.
 *
 * `/panel/klienci/[id]/eksport` is a GET route handler with a **side
 * effect**: it builds the customer's full RODO Art. 15 export and writes an
 * `AuditLog` row with `action: 'export'`. It was linked from the customer
 * page with `next/link`, and Next prefetches `<Link>` targets - so merely
 * opening a customer's page fired
 *
 *   GET /panel/klienci/<id>/eksport?_rsc=… → 200
 *
 * with nobody clicking anything. Observed directly in the network log, and
 * confirmed in the database: a single page view left one export row behind,
 * attributed to the staff member who had only looked at the page.
 *
 * The harm is not wasted work. `ARCHITECTURE.md` §16A.2 invariant 4 makes
 * the audit log the record of what happened - and it was recording RODO
 * exports that nobody performed. A compliance record that reports accesses
 * which never occurred is worse than no record, because it will be believed.
 *
 * Two layers, both asserted here: the link is a plain `<a>` (the convention
 * `/api/plik/[fileId]` already follows in `weryfikacja/[designId]/page.tsx`,
 * so this was the odd one out rather than a new idea), and the route itself
 * refuses a prefetch. The refusal runs before the session read, which is
 * both correct - nothing should happen for a speculative request - and what
 * makes it testable: `getSession()` reads `next/headers` and would throw
 * outside a request scope.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { GET } from '@/app/(admin)/panel/klienci/[id]/eksport/route';

const CUSTOMER_ID = 'test-customer-id';

function context() {
  return { params: Promise.resolve({ id: CUSTOMER_ID }) };
}

describe('the RODO export route refuses speculative requests', () => {
  it.each(['next-router-prefetch', 'Next-Router-Prefetch'])(
    'returns 404 for a request carrying %s, without touching the session',
    async (header) => {
      const request = new Request(`http://localhost/panel/klienci/${CUSTOMER_ID}/eksport`, {
        headers: { [header]: '1' },
      });

      // No request scope here at all: reaching `getSession()` would throw,
      // so a passing assertion also proves the guard runs first.
      const response = await GET(request, context());

      expect(response.status).toBe(404);
    },
  );

  it('also refuses the `purpose: prefetch` form some clients send', async () => {
    const request = new Request(`http://localhost/panel/klienci/${CUSTOMER_ID}/eksport`, {
      headers: { purpose: 'prefetch' },
    });

    expect((await GET(request, context())).status).toBe(404);
  });
});

describe('the export link is not a prefetched Link', () => {
  // Mechanical, like `server-action-boundary.test.ts`: the route guard makes
  // a prefetch harmless, but the request should not be made at all, and
  // nothing else in the codebase would notice a `<Link>` creeping back.
  it('renders the export as a plain anchor', () => {
    const page = readFileSync(
      fileURLToPath(new URL('../../src/app/(admin)/panel/klienci/[id]/page.tsx', import.meta.url)),
      'utf8',
    );

    const exportLine = page.split('\n').find((line) => line.includes('/eksport'));
    expect(exportLine, 'no line references the export route').toBeDefined();
    expect(String(exportLine)).toContain('<a ');
    expect(String(exportLine)).not.toContain('<Link');
  });
});
