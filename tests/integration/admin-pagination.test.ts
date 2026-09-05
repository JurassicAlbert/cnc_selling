/**
 * `docs/AI-CHECKLIST.md` ADMIN-01 / T-08 - "150 seeded orders; page 2 returns
 * 101-150; `total === 150`".
 *
 * The three admin lists took the newest N rows and stopped: 100 orders, 100
 * customers, 200 audit entries. No cursor, no total, and nothing on screen
 * saying a subset was being shown - so with 166 orders in the database, 66 of
 * them were simply unreachable, and the audit log, which §16A.2 keeps as a
 * compliance record, silently forgot everything past its 200th entry.
 *
 * `tests/unit/pagination.test.ts` covers the arithmetic. What is pinned here
 * is the part only a database can answer: that the second page really is the
 * rows the first page did not show, that the total is the count of everything
 * matching the filter rather than the length of the page, and - the one worth
 * having most - that **no row is unreachable**, which the original code
 * failed silently.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { prisma } from '@/server/db/client';
import { listOrdersForAdmin } from '@/server/repositories/admin-orders';
import { listAuditLogs } from '@/server/repositories/admin-audit-log';
import { listCustomersForAdmin } from '@/server/repositories/admin-customers';

const PREFIX = 'test-admin-pagination-';
const ORDER_COUNT = 150;

/**
 * A search term that matches only this file's own rows. Every spec in this
 * run shares one database, so an unfiltered list here would count whatever
 * else happens to exist - and the whole point of these assertions is that the
 * numbers are exact.
 */
const ORDER_PREFIX = `${PREFIX}o-`;

beforeAll(async () => {
  await prisma.order.createMany({
    data: Array.from({ length: ORDER_COUNT }, (_unused, index) => ({
      // Zero-padded so lexical order matches numeric order - `startsWith` is
      // how the admin search matches an order number, and the assertions
      // below need a stable, predictable sequence.
      orderNumber: `${ORDER_PREFIX}${String(index).padStart(4, '0')}`,
      accessToken: `${PREFIX}${crypto.randomUUID()}`,
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
      // Distinct timestamps, because the list is ordered by `createdAt` and
      // ties would make "page 2" non-deterministic.
      createdAt: new Date(Date.UTC(2026, 0, 1) + index * 60_000),
    })),
  });
});

afterAll(async () => {
  await prisma.order.deleteMany({ where: { orderNumber: { startsWith: PREFIX } } });
  await prisma.auditLog.deleteMany({ where: { actorEmail: { startsWith: PREFIX } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
});

describe('listOrdersForAdmin - pagination', () => {
  it('reports the real total, not the size of the page', async () => {
    const page = await listOrdersForAdmin({ search: ORDER_PREFIX }, { skip: 0, take: 25 });

    expect(page.total).toBe(ORDER_COUNT);
    expect(page.items).toHaveLength(25);
  });

  it('returns rows 101-150 on the third page of fifty', async () => {
    const page = await listOrdersForAdmin({ search: ORDER_PREFIX }, { skip: 100, take: 50 });

    expect(page.total).toBe(ORDER_COUNT);
    expect(page.items).toHaveLength(50);
    // Newest first, so skipping 100 of 150 lands on the 50 oldest.
    expect(page.items[0]?.orderNumber).toBe(`${ORDER_PREFIX}0049`);
    expect(page.items[49]?.orderNumber).toBe(`${ORDER_PREFIX}0000`);
  });

  it('makes every single row reachable', async () => {
    // The assertion ADMIN-01 exists for. The old code returned the newest 100
    // and there was no page two at all, so this is the one that would have
    // failed - and the one that fails again if a `take` ever creeps back in
    // ahead of the caller's own.
    const seen = new Set<string>();
    for (let skip = 0; skip < ORDER_COUNT; skip += 25) {
      const page = await listOrdersForAdmin({ search: ORDER_PREFIX }, { skip, take: 25 });
      for (const order of page.items) {
        seen.add(order.orderNumber);
      }
    }

    expect(seen.size).toBe(ORDER_COUNT);
  });

  it('counts what matches the filter, not the whole table', async () => {
    const all = await listOrdersForAdmin({ search: ORDER_PREFIX }, { skip: 0, take: 25 });
    const narrowed = await listOrdersForAdmin(
      { search: `${ORDER_PREFIX}0000` },
      { skip: 0, take: 25 },
    );

    expect(all.total).toBe(ORDER_COUNT);
    // A total that ignored the filter would make the grid offer six pages of
    // a one-row result.
    expect(narrowed.total).toBe(1);
  });

  it('returns an empty page rather than failing past the end', async () => {
    const page = await listOrdersForAdmin({ search: ORDER_PREFIX }, { skip: 10_000, take: 25 });

    expect(page.items).toHaveLength(0);
    // The total still tells the grid where the real data ends, so it can send
    // the reader back to a page that exists.
    expect(page.total).toBe(ORDER_COUNT);
  });
});

describe('listCustomersForAdmin - pagination', () => {
  it('reports a real total and pages through it', async () => {
    const email = `${PREFIX}c-`;
    await prisma.user.createMany({
      data: Array.from({ length: 5 }, (_unused, index) => ({
        name: `Klient ${index}`,
        email: `${email}${index}@example.test`,
      })),
    });

    const first = await listCustomersForAdmin(email, { skip: 0, take: 2 });
    const last = await listCustomersForAdmin(email, { skip: 4, take: 2 });

    expect(first.total).toBe(5);
    expect(first.items).toHaveLength(2);
    expect(last.items).toHaveLength(1);
  });
});

describe('listAuditLogs - pagination', () => {
  it('keeps the whole compliance record reachable, not just the newest entries', async () => {
    // §16A.2 keeps this as a record of who changed what. A log that forgets
    // past its 200th entry is not a record.
    const actorEmail = `${PREFIX}auditor@example.test`;
    await prisma.auditLog.createMany({
      data: Array.from({ length: 12 }, (_unused, index) => ({
        actorEmail,
        entity: `${PREFIX}Entity`,
        entityId: String(index),
        action: 'update',
        createdAt: new Date(Date.UTC(2026, 0, 1) + index * 60_000),
      })),
    });

    const page = await listAuditLogs({ entity: `${PREFIX}Entity` }, { skip: 10, take: 25 });

    expect(page.total).toBe(12);
    expect(page.items).toHaveLength(2);
  });
});
