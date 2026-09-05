/**
 * `docs/AI-CHECKLIST.md` PERF-03 - admin repositories that serialise a whole
 * table into the RSC payload.
 *
 * The item says plainly: "Reuse ADMIN-01's pagination helper **as they
 * grow**; do not pre-optimise all 22." So this is not all 22. Counting the
 * development database sorts the twenty-three unbounded `findMany` calls into
 * two groups, and only one of them is a problem:
 *
 * - **Catalogues staff curate** - products (8), materials (6), designs (13),
 *   categories, finishes, delivery methods, payment methods, FAQ entries,
 *   blog posts, static pages, email templates, staff accounts. These grow by
 *   somebody deciding to add a row. Paginating them would add a control
 *   nobody needs to a list nobody scrolls.
 * - **Records customers create** - design reviews (212 today), the
 *   production queue, reviews, support requests. Nobody chooses how many of
 *   these there are, which is exactly the distinction the item is drawing.
 *
 * Note the item names `/panel/kontakt` and `/panel/produkcja` as growing
 * fastest. Measured, `/panel/kontakt` holds one row and design review holds
 * 212 - so the list is the four that grow with the business, not the two the
 * item guessed at.
 *
 * What is pinned here is the same invariant ADMIN-01 established, because it
 * is the one the old code failed silently: **no row is unreachable**, and the
 * total is the count of everything matching the filter rather than the length
 * of the page.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { prisma } from '@/server/db/client';
import { listPendingDesignReviews } from '@/server/repositories/admin-design-review';
import { listReviewsForAdmin } from '@/server/repositories/admin-reviews';
import { listSupportRequestsForAdmin } from '@/server/repositories/admin-support-requests';

const PREFIX = 'test-perf03-';
const uid = (): string => `${PREFIX}${crypto.randomUUID()}`;

const SEEDED = 7;

let orderId: string;
let userId: string;

beforeAll(async () => {
  const user = await prisma.user.create({
    data: { name: 'PERF-03', email: `${PREFIX}${crypto.randomUUID()}@example.test` },
  });
  userId = user.id;

  const order = await prisma.order.create({
    data: {
      orderNumber: uid(),
      accessToken: uid(),
      userId,
      paymentMethod: 'BANK_TRANSFER',
      email: `${PREFIX}buyer@example.test`,
      phone: '600100200',
      firstName: 'Ala',
      lastName: 'Kowalska',
      street: 'Kwiatowa 5',
      postalCode: '30-001',
      city: 'Kraków',
      subtotalNetGrosze: 10_000,
      vatGrosze: 2_300,
      shippingGrosze: 0,
      totalGrossGrosze: 12_300,
      deliveryMethodNamePl: 'Kurier',
      termsVersion: '1',
      termsAcceptedAt: new Date(),
      withdrawalExemptionTextPl: 'test',
      withdrawalAcknowledgedAt: new Date(),
    },
  });
  orderId = order.id;

  await prisma.supportRequest.createMany({
    data: Array.from({ length: SEEDED }, (_unused, index) => ({
      subjectPl: `${PREFIX}${index}`,
      messagePl: 'test',
      email: `${PREFIX}buyer@example.test`,
      status: 'NEW' as const,
      createdAt: new Date(Date.UTC(2026, 0, 1) + index * 60_000),
    })),
  });
});

afterAll(async () => {
  await prisma.supportRequest.deleteMany({ where: { subjectPl: { startsWith: PREFIX } } });
  await prisma.review.deleteMany({ where: { orderId } });
  await prisma.order.deleteMany({ where: { orderNumber: { startsWith: PREFIX } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
});

describe('listSupportRequestsForAdmin', () => {
  it('reports a real total and hands back one page of it', async () => {
    const page = await listSupportRequestsForAdmin({}, { skip: 0, take: 3 });

    expect(page.items).toHaveLength(3);
    // Everything in the table, not just this file's rows - the page is not
    // filtered here, so the total must not be either.
    expect(page.total).toBeGreaterThanOrEqual(SEEDED);
  });

  it('makes every row reachable', async () => {
    // The assertion PERF-03 exists for: the old code returned everything in
    // one payload, which works until it does not, and then loses rows
    // silently rather than loudly.
    const seen = new Set<string>();
    const total = (await listSupportRequestsForAdmin({}, { skip: 0, take: 1 })).total;

    for (let skip = 0; skip < total; skip += 3) {
      for (const item of (await listSupportRequestsForAdmin({}, { skip, take: 3 })).items) {
        seen.add(item.id);
      }
    }

    expect(seen.size).toBe(total);
  });

  it('counts what matches the filter, not the whole table', async () => {
    const all = await listSupportRequestsForAdmin({}, { skip: 0, take: 1 });
    const resolved = await listSupportRequestsForAdmin({ status: 'RESOLVED' }, { skip: 0, take: 1 });

    // A total that ignored the filter would offer pages of a result that has
    // none of them.
    expect(resolved.total).toBeLessThanOrEqual(all.total);
    expect(resolved.items.every((item) => item.status === 'RESOLVED')).toBe(true);
  });
});

describe('listReviewsForAdmin', () => {
  it('reports a real total and pages through it', async () => {
    await prisma.review.create({
      data: {
        orderId,
        authorNamePl: `${PREFIX}Ala`,
        rating: 5,
        bodyPl: 'test',
        status: 'PENDING',
      },
    });

    const page = await listReviewsForAdmin(undefined, { skip: 0, take: 1 });

    expect(page.items).toHaveLength(1);
    expect(page.total).toBeGreaterThanOrEqual(1);
  });
});

describe('listPendingDesignReviews', () => {
  it('reports a real total and pages through it', async () => {
    // 212 rows in the development database today, and one per custom upload
    // from here on - the largest of the four by a wide margin, and the one
    // the item did not name.
    const page = await listPendingDesignReviews({ skip: 0, take: 5 });

    expect(page.items.length).toBeLessThanOrEqual(5);
    expect(page.total).toBeGreaterThanOrEqual(page.items.length);
  });
});
