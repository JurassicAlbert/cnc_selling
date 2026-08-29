/**
 * Staff order mutations. Split the same way `design-review.ts`'s
 * `find*`/`require*` pair is: `applyOrderStatusTransition`/`applyMarkOrderPaid`
 * take the staff actor as an explicit parameter (real DB logic, callable
 * directly from an integration test), while `transitionOrderStatus`/
 * `markOrderPaid` — the actual Server Actions the UI calls — derive it via
 * `requireStaffSession()`, which reads `next/headers` and therefore only
 * works inside a real request (P4's `cookies()`-outside-request-scope
 * lesson, confirmed again for Better Auth in P6).
 */

import { revalidatePath } from 'next/cache';

import { checkOrderStatusTransition } from '@/domain/order-status/transitions';
import type { OrderStatus } from '@/domain/order-status/transitions';
import { orderStatusMessage } from '@/content/pl/messages';
import { prisma } from '@/server/db/client';
import { requireStaffSession } from '@/server/auth/session';
import type { CurrentSession } from '@/server/auth/session';
import { writeAuditLog } from '@/server/audit/write-audit-log';
import { mailer } from '@/server/mail/mailer';

export type TransitionOrderStatusResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly detail: string };

export async function applyOrderStatusTransition(
  staff: CurrentSession,
  orderNumber: string,
  toStatus: OrderStatus,
  notePl: string | null,
): Promise<TransitionOrderStatusResult> {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    select: {
      id: true,
      status: true,
      email: true,
      items: { select: { customerDesign: { select: { status: true } } } },
    },
  });
  if (order === null) {
    return { ok: false, detail: 'Zamówienie nie istnieje.' };
  }

  const hasUnapprovedCustomDesign = order.items.some(
    (item) => item.customerDesign !== null && item.customerDesign.status !== 'APPROVED',
  );

  const transition = checkOrderStatusTransition({
    fromStatus: order.status,
    toStatus,
    actorType: 'staff',
    hasUnapprovedCustomDesign,
  });
  if (!transition.ok) {
    return { ok: false, detail: transition.detail };
  }

  // The only "backwards" move this graph allows (`transitions.ts`'s header
  // comment: every other edge only moves forward or to a terminal status) —
  // a note is mandatory here, optional everywhere else.
  if (toStatus === 'CANCELLED' && (notePl === null || notePl.trim().length === 0)) {
    return { ok: false, detail: 'Anulowanie zamówienia wymaga podania notatki.' };
  }

  // The status is re-asserted in the WHERE clause, not just checked above
  // (`docs/AUDIT-2026-08-30.md` P1-6). Read-then-write left a real gap: two
  // staff clicks — or one double-click — both passed the
  // `checkOrderStatusTransition` check, both wrote, and the order got two
  // `OrderEvent` rows, two audit entries and two customer emails for one
  // real change. Matching zero rows means someone else moved this order
  // first, which is a rejection, not a silent success.
  const applied = await prisma.$transaction(async (tx) => {
    const updated = await tx.order.updateMany({
      where: { id: order.id, status: order.status },
      data: { status: toStatus },
    });
    if (updated.count === 0) {
      return false;
    }
    await tx.orderEvent.create({
      data: {
        orderId: order.id,
        fromStatus: order.status,
        toStatus,
        actorType: 'staff',
        actorId: staff.userId,
        actorEmail: staff.email,
        notePl,
      },
    });
    return true;
  });
  if (!applied) {
    return { ok: false, detail: 'Status tego zamówienia zmienił się w międzyczasie — odśwież stronę i spróbuj ponownie.' };
  }
  await writeAuditLog({
    actor: staff,
    entity: 'Order',
    entityId: order.id,
    action: 'transition',
    diff: { fromStatus: order.status, toStatus, notePl },
  });

  // Fire-and-forget, after the transaction has committed — same reasoning
  // as `create-order.ts`'s own order-confirmation send: a mailer failure
  // must never undo a status change that has already, correctly, happened.
  void mailer
    .send('order-status-update', order.email, { orderNumber, statusPl: orderStatusMessage(toStatus) })
    .catch(() => {
      // Logged inside the mailer itself; nothing else to do here.
    });

  return { ok: true };
}

export async function transitionOrderStatus(
  orderNumber: string,
  toStatus: OrderStatus,
  notePl: string | null,
): Promise<TransitionOrderStatusResult> {
  const staff = await requireStaffSession();
  const result = await applyOrderStatusTransition(staff, orderNumber, toStatus, notePl);
  if (result.ok) {
    revalidatePath(`/panel/zamowienia/${orderNumber}`);
    revalidatePath('/panel/zamowienia');
  }
  return result;
}

export type MarkOrderPaidResult = { readonly ok: true } | { readonly ok: false; readonly detail: string };

export async function applyMarkOrderPaid(staff: CurrentSession, orderNumber: string): Promise<MarkOrderPaidResult> {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    select: { id: true, paymentMethod: true, paymentStatus: true },
  });
  if (order === null) {
    return { ok: false, detail: 'Zamówienie nie istnieje.' };
  }
  if (order.paymentMethod !== 'BANK_TRANSFER') {
    return { ok: false, detail: 'To zamówienie nie jest opłacane przelewem.' };
  }
  if (order.paymentStatus === 'PAID') {
    return { ok: false, detail: 'To zamówienie jest już oznaczone jako opłacone.' };
  }

  // Conditional, so the check above and this write are one atomic step
  // (`docs/AUDIT-2026-08-30.md` P1-6). Without it a double-clicked button
  // had both calls pass the check and both write, leaving two audit
  // entries for one real state change. Zero rows means the other click
  // already did it — the same honest "already paid" answer as above.
  const updated = await prisma.order.updateMany({
    where: { id: order.id, paymentStatus: { not: 'PAID' } },
    data: { paymentStatus: 'PAID' },
  });
  if (updated.count === 0) {
    return { ok: false, detail: 'To zamówienie jest już oznaczone jako opłacone.' };
  }
  await writeAuditLog({
    actor: staff,
    entity: 'Order',
    entityId: order.id,
    action: 'update',
    diff: { paymentStatus: { from: order.paymentStatus, to: 'PAID' } },
  });

  return { ok: true };
}

export async function markOrderPaid(orderNumber: string): Promise<MarkOrderPaidResult> {
  const staff = await requireStaffSession();
  const result = await applyMarkOrderPaid(staff, orderNumber);
  if (result.ok) {
    revalidatePath(`/panel/zamowienia/${orderNumber}`);
    revalidatePath('/panel/zamowienia');
  }
  return result;
}
