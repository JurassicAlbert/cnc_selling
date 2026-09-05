/**
 * A cart line's *identity* - what makes two additions "the same thing"
 * rather than two things (`docs/AUDIT-2026-08-30.md` P1-4).
 *
 * The rule the schema comment on `CartItem` already stated, made
 * enforceable: two DIFFERENT configurations of one product are two rows and
 * must stay two rows - a different pattern, a different material, a
 * different size, different engraved text are all genuinely different
 * products to make and to price. What did NOT follow from that, and was the
 * actual bug, is that two BYTE-IDENTICAL configurations were also two rows,
 * so a double-clicked "Dodaj do koszyka" left the customer deleting a
 * duplicate by hand.
 *
 * Every field here is one a customer can actually choose and that changes
 * what gets manufactured. Nothing derived is included: not the price, not
 * the module layout, not the feasibility warnings - those are recomputed
 * from these inputs, so including them could only ever split a line that
 * should have merged (for instance right after a price change).
 *
 * `productId` is part of it because two products can otherwise share an
 * identical, all-null selection set.
 *
 * The output is stored on `CartItem` and carries a `@@unique([cartId,
 * configurationSignature])` index, so identical lines cannot be created
 * even by two genuinely concurrent requests - the check alone would race.
 */

import type { Selections } from '@/domain/configuration/steps';

/**
 * JSON, not a joined string with a separator. Two encodings were tried and
 * the naive one was wrong in two different ways at once: a `null` marker
 * that can never appear in real data is hard to pick (the first attempt
 * used a NUL byte, which Postgres flatly refuses to store in a `text`
 * column - caught by `tests/integration/cart-operations.test.ts` on its
 * first run), and any chosen separator can appear inside a real value.
 *
 * `JSON.stringify` of a fixed-length array has neither problem: `null` and
 * `""` encode differently by construction, and every string is quoted and
 * escaped, so no value can impersonate a field boundary. It is also
 * readable in the database, which matters for a column someone will one day
 * have to debug.
 */
export function cartItemSignature(productId: string, selections: Selections): string {
  return JSON.stringify([
    productId,
    selections.designId,
    selections.customUploadId,
    selections.materialId,
    selections.finishId,
    selections.thicknessMm,
    selections.widthMm,
    selections.heightMm,
    selections.installationVariant,
    // Trimmed, because the checkout and the engraver both treat trailing
    // whitespace as nothing - but NOT case-folded: "Anna" and "ANNA" are
    // two genuinely different engravings.
    selections.personalizationText === null ? null : selections.personalizationText.trim(),
    selections.fontId,
  ]);
}
