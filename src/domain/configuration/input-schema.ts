/**
 * Shape validation for the untrusted arguments a Server Action receives -
 * `docs/REVIEW-DETAILED.md` BUG-07.
 *
 * `zod` was a declared dependency that **nothing imported** (`grep -rn
 * "from 'zod'" src` → 0 matches) while `ARCHITECTURE.md` §2 named it as the
 * validation layer: "One schema reused for client hints and server
 * enforcement." That combination is worse than either choice on its own,
 * because the next contributor reasonably assumes the validation exists.
 * The audit offered "use it or drop it"; §2 already says use it, so this is
 * that, and this module is the one place it lives.
 *
 * Next's own guidance is the reason it matters
 * (`node_modules/next/dist/docs/01-app/02-guides/server-actions.md`,
 * "Security"): every exported function in a `'use server'` module is a
 * public HTTP endpoint, and "Treat `FormData`, query parameters, and headers
 * as untrusted." Before this, `addToCart(productSlug, selections,
 * acknowledgedWarnings, quantity)` destructured `selections` straight into a
 * Prisma `create` and spread `acknowledgedWarnings` into a `String[]` column
 * with no element count, no length cap and no allow-list - a direct POST
 * could write arbitrary strings of arbitrary size.
 *
 * **This is a shape check, not a business check.** Whether a `designId`
 * names a design this product actually offers is `resolveOptions`' job
 * (SEC-03); whether a `thicknessMm` belongs to this product type at all is
 * `findSelectionOutsideProductType`'s (BUG-06); whether the text fits the
 * engraving is `validatePersonalization`'s. What happens here is only:
 * *could this value plausibly be one of ours, and is it bounded?*
 */

import { z } from 'zod';

import { FEASIBILITY_CODES } from '@/domain/feasibility/rules';

/**
 * A hard ceiling on engraved text, independent of any
 * `PersonalizationSpec`. The spec's own `maxCharacters` is the real limit
 * and is much smaller - but `evaluatePersonalization` returns no issues at
 * all when a product has no spec row, which is how unbounded text reached
 * the database and the order snapshot (BUG-06). This is the floor under
 * that hole: generous enough never to argue with a real limit, small enough
 * that the string cannot be used as storage.
 */
export const MAX_PERSONALIZATION_TEXT_LENGTH = 1_000;

/**
 * `evaluateFeasibility` can return at most a handful of findings for one
 * configuration, and only some require acknowledgement. Sixteen is far
 * above anything reachable and far below anything worth storing.
 */
export const MAX_ACKNOWLEDGED_WARNINGS = 16;

/**
 * Every id in this application is a `cuid()` - 25 characters. The bound is
 * deliberately loose rather than exact: a stricter pattern would couple this
 * module to Prisma's id strategy, and the value is looked up against the
 * database immediately afterwards anyway. The point is to reject a megabyte,
 * not to re-implement `cuid`.
 */
const id = z.string().min(1).max(64);

const millimetres = z.number().int().positive().max(100_000);

export const selectionsSchema = z.object({
  designId: id.nullable(),
  customUploadId: id.nullable(),
  materialId: id.nullable(),
  widthMm: millimetres.nullable(),
  heightMm: millimetres.nullable(),
  thicknessMm: millimetres.nullable(),
  finishId: id.nullable(),
  // Constrained by a Postgres enum on the way in and checked against the
  // product's real offered variants by `resolveOptions`; bounded here only.
  installationVariant: z.string().min(1).max(64).nullable(),
  personalizationText: z.string().max(MAX_PERSONALIZATION_TEXT_LENGTH).nullable(),
  fontId: id.nullable(),
});

export const acknowledgedWarningsSchema = z
  .array(z.enum(FEASIBILITY_CODES))
  .max(MAX_ACKNOWLEDGED_WARNINGS);

/**
 * Both parsers return `null` on failure rather than throwing or returning
 * zod's issue list. Nothing downstream can act on *why* the shape was
 * wrong: the UI cannot produce a malformed payload, so a caller that sends
 * one is either a bug or a crafted request, and both get the same generic
 * rejection. Returning a plain `null` also keeps zod out of every call
 * site's type signature.
 */
export function parseSelections(value: unknown): z.infer<typeof selectionsSchema> | null {
  const result = selectionsSchema.safeParse(value);
  return result.success ? result.data : null;
}

export function parseAcknowledgedWarnings(value: unknown): readonly string[] | null {
  const result = acknowledgedWarningsSchema.safeParse(value);
  return result.success ? result.data : null;
}
