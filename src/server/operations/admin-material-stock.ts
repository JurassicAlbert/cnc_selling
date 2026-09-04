/**
 * Warehouse writes. Owner request, 2026-09-04.
 *
 * `ADMIN`, not `STAFF`, and the same doubled gate SEC-04 established: the
 * wrapper calls `requireAdminSession()`, which is what a real request meets,
 * and each `apply*` calls `refuseUnlessAdmin` as its first statement, because
 * the wrapper reads `next/headers` and no test in this repository can reach
 * it.
 *
 * The reason for ADMIN is what these rows contain: purchase prices and
 * suppliers. That is the shop's cost base, not production information. Reads
 * stay `STAFF` (`repositories/material-stock.ts`), because an operator does
 * need to know what is on the shelf. Nothing in §16.3 settles this, so it is
 * a judgement call recorded rather than assumed.
 */

import { revalidatePath } from 'next/cache';

import { requireAdminSession } from '@/server/auth/session';
import type { CurrentSession } from '@/server/auth/session';
import { writeAuditLog } from '@/server/audit/write-audit-log';
import { prisma } from '@/server/db/client';
import { refuseUnlessAdmin } from './admin-only';

export type StockBatchInput = {
  readonly materialId: string;
  readonly widthMm: number;
  readonly heightMm: number;
  readonly thicknessMm: number;
  readonly quantity: number;
  readonly purchasePriceGrosze: number;
  readonly supplierNamePl: string;
  readonly supplierUrl: string;
  readonly notePl: string;
};

export type StockMutationResult =
  | { readonly ok: true; readonly id: string }
  | { readonly ok: false; readonly detail: string };

function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * The same invariants the database CHECK constraints enforce, checked here so
 * the operator gets a sentence instead of a Prisma error. The constraints stay
 * as well: a validation that only exists in application code is one crafted
 * request away from not existing.
 */
function validate(input: StockBatchInput): string | null {
  const positiveIntegers: readonly (readonly [string, number])[] = [
    ['Szerokość', input.widthMm],
    ['Wysokość', input.heightMm],
    ['Grubość', input.thicknessMm],
  ];
  for (const [label, value] of positiveIntegers) {
    if (!Number.isInteger(value) || value <= 0) {
      return `${label} musi być liczbą całkowitą większą od zera.`;
    }
  }
  if (!Number.isInteger(input.quantity) || input.quantity < 0) {
    return 'Liczba płyt musi być liczbą całkowitą nieujemną.';
  }
  if (!Number.isInteger(input.purchasePriceGrosze) || input.purchasePriceGrosze < 0) {
    return 'Cena zakupu musi być liczbą całkowitą nieujemną.';
  }
  return null;
}

export async function applyCreateStockBatch(
  admin: CurrentSession,
  input: StockBatchInput,
): Promise<StockMutationResult> {
  const refusal = refuseUnlessAdmin(admin);
  if (refusal !== null) {
    return refusal;
  }

  const issue = validate(input);
  if (issue !== null) {
    return { ok: false, detail: issue };
  }

  const material = await prisma.material.findUnique({ where: { id: input.materialId }, select: { id: true } });
  if (material === null) {
    return { ok: false, detail: 'Nie znaleziono materiału.' };
  }

  const batch = await prisma.materialStock.create({
    data: {
      materialId: input.materialId,
      widthMm: input.widthMm,
      heightMm: input.heightMm,
      thicknessMm: input.thicknessMm,
      quantity: input.quantity,
      purchasePriceGrosze: input.purchasePriceGrosze,
      supplierNamePl: blankToNull(input.supplierNamePl),
      supplierUrl: blankToNull(input.supplierUrl),
      notePl: blankToNull(input.notePl),
    },
  });
  await writeAuditLog({
    actor: admin,
    entity: 'MaterialStock',
    entityId: batch.id,
    action: 'create',
    diff: { ...input },
  });

  return { ok: true, id: batch.id };
}

export async function createStockBatch(input: StockBatchInput): Promise<StockMutationResult> {
  const admin = await requireAdminSession();
  const result = await applyCreateStockBatch(admin, input);
  if (result.ok) {
    revalidatePath('/panel/magazyn');
    revalidatePath(`/panel/magazyn/${input.materialId}`);
  }
  return result;
}

/**
 * Adjusting the count is its own operation rather than a general update,
 * because it is the one that happens daily: boards get used. `updateMany` with
 * the bound in the WHERE clause, not a read followed by a write, for the
 * reason BUG-05 recorded - two operators marking the same batch used must not
 * lose one of the decrements.
 */
export async function applyAdjustStockQuantity(
  admin: CurrentSession,
  batchId: string,
  delta: number,
): Promise<StockMutationResult> {
  const refusal = refuseUnlessAdmin(admin);
  if (refusal !== null) {
    return refusal;
  }
  if (!Number.isInteger(delta) || delta === 0) {
    return { ok: false, detail: 'Zmiana liczby płyt musi być niezerową liczbą całkowitą.' };
  }

  const affected =
    delta > 0
      ? await prisma.materialStock.updateMany({
          where: { id: batchId },
          data: { quantity: { increment: delta } },
        })
      : await prisma.materialStock.updateMany({
          // The guard belongs in the WHERE clause: stock cannot go negative,
          // and a concurrent decrement must fail rather than wrap.
          where: { id: batchId, quantity: { gte: -delta } },
          data: { quantity: { decrement: -delta } },
        });

  if (affected.count === 0) {
    return { ok: false, detail: 'Nie znaleziono partii lub na stanie jest zbyt mało płyt.' };
  }

  await writeAuditLog({
    actor: admin,
    entity: 'MaterialStock',
    entityId: batchId,
    action: 'update',
    diff: { quantityDelta: delta },
  });
  return { ok: true, id: batchId };
}

export async function adjustStockQuantity(batchId: string, delta: number): Promise<void> {
  const admin = await requireAdminSession();
  const result = await applyAdjustStockQuantity(admin, batchId, delta);
  if (result.ok) {
    revalidatePath('/panel/magazyn');
  }
}

export async function applyDeleteStockBatch(
  admin: CurrentSession,
  batchId: string,
): Promise<StockMutationResult> {
  const refusal = refuseUnlessAdmin(admin);
  if (refusal !== null) {
    return refusal;
  }
  // `deleteMany`, not `delete`: two operators removing the same batch is a
  // no-op for the loser, not a 500.
  const affected = await prisma.materialStock.deleteMany({ where: { id: batchId } });
  if (affected.count === 0) {
    return { ok: false, detail: 'Nie znaleziono partii.' };
  }
  await writeAuditLog({ actor: admin, entity: 'MaterialStock', entityId: batchId, action: 'delete' });
  return { ok: true, id: batchId };
}

export async function deleteStockBatch(batchId: string): Promise<void> {
  const admin = await requireAdminSession();
  const result = await applyDeleteStockBatch(admin, batchId);
  if (result.ok) {
    revalidatePath('/panel/magazyn');
  }
}
