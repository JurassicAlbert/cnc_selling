/**
 * Guest-cart-merge-on-login - P6 Part B, `docs/HANDOVER.md`'s P5 checklist
 * item this was blocked on until real accounts existed. Called once, right
 * after a successful login/register/OTP sign-in, with the just-authenticated
 * `userId` and whatever guest `sessionToken` cookie (if any) was active for
 * this visit.
 *
 * `Cart.userId` is `@unique` - a user can only ever have one cart - so the
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
 * `sessionToken` - `CartItem` -> `Configuration` ownership already flows
 * through the cart itself once merged, and `create-order.ts` already accepts
 * `userId: string | null` untouched, so nothing downstream needs every
 * `Configuration` retroactively stamped with `userId`.
 */

import { clampCartQuantity } from '@/domain/cart/quantity';
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

    // Line by line, not one `updateMany`, because the two carts can hold
    // the SAME configuration - a customer who added a product logged-out
    // and had already added it logged-in.
    //
    // That case used to produce two identical lines in the merged cart.
    // Once `@@unique([cartId, configurationSignature])` existed to stop
    // identical lines (2026-08-30), the bulk move started violating it
    // instead - and because this runs inside the login transaction, the
    // customer who had it could no longer log in at all. Both problems have
    // the same fix: fold the quantities together.
    const guestItems = await tx.cartItem.findMany({
      where: { cartId: guestCart.id },
      select: { id: true, quantity: true, configurationSignature: true },
    });
    const userItems = await tx.cartItem.findMany({
      where: { cartId: userCart.id },
      select: { id: true, quantity: true, configurationSignature: true },
    });
    const userItemBySignature = new Map(userItems.map((item) => [item.configurationSignature, item]));

    for (const guestItem of guestItems) {
      const existing = userItemBySignature.get(guestItem.configurationSignature);
      if (existing === undefined) {
        await tx.cartItem.update({ where: { id: guestItem.id }, data: { cartId: userCart.id } });
        continue;
      }
      // Quantities add rather than one side winning: both were real
      // choices the customer made, and neither should silently vanish
      // because they happened to log in. Clamped, so the merge can never
      // put a line past the limit every other path enforces.
      await tx.cartItem.update({
        where: { id: existing.id },
        data: { quantity: clampCartQuantity(existing.quantity + guestItem.quantity) },
      });
      await tx.cartItem.delete({ where: { id: guestItem.id } });
    }

    await tx.cart.delete({ where: { id: guestCart.id } });
  });
}
