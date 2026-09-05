import 'dotenv/config';

import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { registerAccount } from './register';
import { prisma } from '../../src/server/db/client';

/**
 * `docs/AI-CHECKLIST.md` ADMIN-01 - the admin lists truncated silently.
 *
 * `listOrdersForAdmin` took the newest 100 rows and stopped: no cursor, no
 * total, and nothing on screen saying so. With 259 orders in the database,
 * 159 were unreachable and the screen looked entirely normal. The audit log -
 * §16A.2's record of who changed what - forgot everything past its 200th
 * entry the same way.
 *
 * The repository half is covered by `tests/integration/admin-pagination.test.ts`
 * and the arithmetic by `tests/unit/pagination.test.ts`. What only a browser
 * can show is the two things that make it usable rather than merely correct:
 * that the page says how much of the list it is showing, and that the grid's
 * own next-page control really reaches the next page - which now means a
 * navigation and a fresh server render, not slicing an array the browser
 * already holds.
 *
 * **These specs seed their own rows.** The first version read whatever the
 * database happened to hold and skipped when there was too little - so the
 * moment ARCH-03 pointed the suite at a freshly reset test database, all four
 * silently skipped. Coverage that evaporates exactly when the environment
 * gets cleaner is worse than none. Seeding also makes every number below
 * exact, which reading a live count could never be: the rest of the suite is
 * placing real orders and writing real audit rows while these run.
 *
 * Imports `test` from `./fixtures` because it registers an account.
 */

const PASSWORD = 'correcthorse123';
const PAGE_SIZE = 25;
/** Past the old hundred-row cap, so the last page is one that used to be unreachable. */
const SEEDED_ORDERS = 110;
const SEEDED_AUDIT_ROWS = 30;

/**
 * Promoting an account is the one thing no UI path can do for itself - the
 * same approach `warehouse.spec.ts` and `admin-authz.spec.ts` already use.
 */
async function signInAsAdmin(page: Page): Promise<string> {
  const email = `test-admin-pagination-${crypto.randomUUID()}@example.test`;

  await registerAccount(page, { name: 'E2E Pagination Admin', email, password: PASSWORD });

  await prisma.user.update({ where: { email }, data: { role: 'ADMIN' } });
  return email;
}

async function seedOrders(prefix: string): Promise<void> {
  await prisma.order.createMany({
    data: Array.from({ length: SEEDED_ORDERS }, (_unused, index) => ({
      // Zero-padded, because the admin search matches an order number by
      // prefix and these need a stable order.
      orderNumber: `${prefix}${String(index).padStart(4, '0')}`,
      accessToken: `${prefix}${crypto.randomUUID()}`,
      paymentMethod: 'BANK_TRANSFER' as const,
      email: `${prefix}buyer@example.test`,
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
      // Distinct timestamps: the list is ordered by `createdAt`, and ties
      // would make "page 5" non-deterministic.
      createdAt: new Date(Date.UTC(2026, 0, 1) + index * 60_000),
    })),
  });
}

test('rows past the old hundred-row cap are reachable, and the page says how many there are', async ({ page }) => {
  const email = await signInAsAdmin(page);
  const prefix = `e2e-pag-${crypto.randomUUID().slice(0, 8)}-`;

  try {
    await seedOrders(prefix);

    // Filtered to this spec's own orders, so every number below is exact
    // however many real orders the rest of the suite places while it runs.
    const listUrl = (pageNumber: number) =>
      `/panel/zamowienia?search=${encodeURIComponent(prefix)}&page=${pageNumber}&perPage=${PAGE_SIZE}`;

    await page.goto(listUrl(1));
    const main = page.getByRole('main');
    const summary = main.getByText(/^Pokazano /);

    // The line ADMIN-01 asked for. Its absence is what turned a limit into a
    // bug: staff had no way to know they were seeing a subset.
    await expect(summary).toHaveText(`Pokazano 1-25 z ${SEEDED_ORDERS}`, { timeout: 15_000 });

    // The grid's own control, not a hand-built URL: this is the path a person
    // actually takes, and past the hundredth row it used to do nothing,
    // because there was no page two at all.
    await main.getByRole('button', { name: /nast/i }).first().click();
    await expect(page).toHaveURL(/[?&]page=2/, { timeout: 15_000 });
    await expect(summary).toHaveText(`Pokazano 26-50 z ${SEEDED_ORDERS}`);
    // And the filter survived paging - losing it here would be its own bug.
    await expect(page).toHaveURL(new RegExp(`search=${prefix}`));

    // The rows the old code could never return.
    await page.goto(listUrl(5));
    await expect(summary).toHaveText(`Pokazano 101-110 z ${SEEDED_ORDERS}`, { timeout: 15_000 });
    await expect(main.locator('.MuiDataGrid-row')).toHaveCount(SEEDED_ORDERS - 100);
  } finally {
    await prisma.order.deleteMany({ where: { orderNumber: { startsWith: prefix } } });
    await prisma.user.deleteMany({ where: { email } });
  }
});

test('the audit log pages without a grid, and keeps its filter while doing it', async ({ page }) => {
  const email = await signInAsAdmin(page);
  const entity = `E2EPag${crypto.randomUUID().slice(0, 8)}`;

  try {
    await prisma.auditLog.createMany({
      data: Array.from({ length: SEEDED_AUDIT_ROWS }, (_unused, index) => ({
        actorEmail: `${entity}@example.test`,
        entity,
        entityId: String(index),
        action: 'update',
        createdAt: new Date(Date.UTC(2026, 0, 1) + index * 60_000),
      })),
    });

    await page.goto(`/panel/dziennik-zdarzen?entity=${entity}`);
    const main = page.getByRole('main');
    const summary = main.getByText(/^Pokazano /);

    await expect(summary).toHaveText(`Pokazano 1-25 z ${SEEDED_AUDIT_ROWS}`, { timeout: 15_000 });
    // Page one has nowhere back to go, so there is no link rather than a
    // disabled one - there is no such thing as a disabled anchor.
    await expect(main.getByRole('link', { name: 'Poprzednia strona' })).toHaveCount(0);

    await main.getByRole('link', { name: 'Następna strona' }).click();
    await expect(page).toHaveURL(/[?&]page=2/, { timeout: 15_000 });
    await expect(summary).toHaveText(`Pokazano 26-30 z ${SEEDED_AUDIT_ROWS}`);
    await expect(main.getByRole('link', { name: 'Poprzednia strona' })).toBeVisible();
    // The entity filter came with it; without that, page two would be page
    // two of every audit row in the database.
    await expect(page).toHaveURL(new RegExp(`entity=${entity}`));
  } finally {
    await prisma.auditLog.deleteMany({ where: { entity } });
    await prisma.user.deleteMany({ where: { email } });
  }
});
