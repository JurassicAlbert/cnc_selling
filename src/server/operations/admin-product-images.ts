/** Product photo upload/reorder/alt-text/delete. Uses `public-images.ts`, not `local-disk.ts` — see that module's header for why these are a different class of file. */

import { revalidatePath } from 'next/cache';

import { prisma } from '@/server/db/client';
import { requireStaffSession } from '@/server/auth/session';
import type { CurrentSession } from '@/server/auth/session';
import { writeAuditLog } from '@/server/audit/write-audit-log';
import { deletePublicImage, savePublicImage } from '@/server/storage/public-images';

export type ActionResult = { readonly ok: true } | { readonly ok: false; readonly detail: string };

function revalidateProduct(productId: string): void {
  revalidatePath(`/panel/produkty/${productId}`);
}

export async function applyUploadProductImage(
  staff: CurrentSession,
  productId: string,
  formData: FormData,
): Promise<ActionResult> {
  const file = formData.get('file');
  const altPl = String(formData.get('altPl') ?? '').trim();
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, detail: 'Wybierz plik.' };
  }
  if (altPl.length === 0) {
    return { ok: false, detail: 'Tekst alternatywny jest wymagany.' };
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const saved = await savePublicImage('products', productId, bytes);
  if (!saved.ok) {
    return { ok: false, detail: saved.detail };
  }

  const existingCount = await prisma.productImage.count({ where: { productId } });
  await prisma.productImage.create({
    data: { productId, url: saved.url, altPl, isPrimary: existingCount === 0, sortOrder: existingCount },
  });
  await writeAuditLog({ actor: staff, entity: 'Product', entityId: productId, action: 'update', diff: { addImage: saved.url } });

  return { ok: true };
}

export async function uploadProductImage(productId: string, formData: FormData): Promise<ActionResult> {
  const staff = await requireStaffSession();
  const result = await applyUploadProductImage(staff, productId, formData);
  if (result.ok) {
    revalidateProduct(productId);
  }
  return result;
}

export async function applySetPrimaryProductImage(staff: CurrentSession, productId: string, imageId: string): Promise<void> {
  await prisma.$transaction([
    prisma.productImage.updateMany({ where: { productId }, data: { isPrimary: false } }),
    prisma.productImage.update({ where: { id: imageId }, data: { isPrimary: true } }),
  ]);
  await writeAuditLog({ actor: staff, entity: 'Product', entityId: productId, action: 'update', diff: { setPrimaryImage: imageId } });
}

export async function setPrimaryProductImage(productId: string, imageId: string): Promise<void> {
  const staff = await requireStaffSession();
  await applySetPrimaryProductImage(staff, productId, imageId);
  revalidateProduct(productId);
}

export async function applyRemoveProductImage(staff: CurrentSession, productId: string, imageId: string): Promise<void> {
  const image = await prisma.productImage.findUnique({ where: { id: imageId }, select: { url: true } });
  await prisma.productImage.delete({ where: { id: imageId } }).catch(() => undefined);
  if (image !== null) {
    await deletePublicImage(image.url);
  }
  await writeAuditLog({ actor: staff, entity: 'Product', entityId: productId, action: 'update', diff: { removeImage: imageId } });
}

export async function removeProductImage(productId: string, imageId: string): Promise<void> {
  const staff = await requireStaffSession();
  await applyRemoveProductImage(staff, productId, imageId);
  revalidateProduct(productId);
}
