/**
 * Guest-cart-merge-on-login — P6 Part B, `docs/HANDOVER.md`'s P5 checklist
 * item this was blocked on until real accounts existed. Called once, right
 * after a successful login/register/OTP sign-in, with the just-authenticated
 * `userId` and whatever guest `sessionToken` cookie (if any) was active for
 * this visit.
 *
 * `Cart.userId` is `@unique` — a user can only ever have one cart — so the
 * two cases are genuinely different operations, not one code path:
 *   - user has no cart yet: the guest cart's row is simply reassigned
 *     (`sessionToken: null, userId`), same row, same `CartItem`s, cheapest.
 *   - user already has a cart: every guest `CartItem` is moved onto it and
 *     the now-empty guest cart is deleted, since two `Cart` rows for one
 *     user can't coexist.
 * Both branches run inside one transaction so a crash mid-merge can never
 * leave a cart split across two rows or `CartItem`s pointing at a deleted
 * cart.
 *
 * `Configuration` rows created as a guest deliberately keep their original
 * `sessionToken` — `CartItem` -> `Configuration` ownership already flows
 * through the cart itself once merged, and `create-order.ts` already accepts
 * `userId: string | null` untouched, so nothing downstream needs every
 * `Configuration` retroactively stamped with `userId`.
 */

import { prisma } from '@/server/db/client';

export async function mergeGuestCartIntoUser(userId: string, guestSessionToken: string | null): Promise<void> {
  if (guestSessionToken === null) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    const guestCart = await tx.cart.findUnique({ where: { sessionToken: guestSessionToken } });
    if (guestCart === null) {
      return;
    }

    const userCart = await tx.cart.findUnique({ where: { userId } });

    if (userCart === null) {
      await tx.cart.update({
        where: { id: guestCart.id },
        data: { sessionToken: null, userId },
      });
      return;
    }

    await tx.cartItem.updateMany({
      where: { cartId: guestCart.id },
      data: { cartId: userCart.id },
    });
    await tx.cart.delete({ where: { id: guestCart.id } });
  });
}
