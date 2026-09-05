/**
 * The shape of `OrderItem.snapshot` - shared between `create-order.ts`
 * (which writes it) and `repositories/orders.ts` (which reads it back for
 * the confirmation page), so the two can never silently drift apart. Real
 * display strings (`productNamePl`, `designNamePl`, ...), not ids - the
 * whole point of a snapshot is surviving a later catalogue rename, per
 * `OrderItem.snapshot`'s own schema comment: "Rendering an order NEVER
 * joins to a live catalogue row."
 */

import type { ModuleLayout } from '@/domain/modules/split';
import type { PriceBreakdown } from '@/domain/pricing/types';

export type OrderItemSnapshot = {
  readonly productNamePl: string;
  readonly designNamePl: string | null;
  readonly designCode: string | null;
  readonly materialNamePl: string | null;
  readonly finishNamePl: string | null;
  readonly fontNamePl: string | null;
  readonly widthMm: number | null;
  readonly heightMm: number | null;
  readonly thicknessMm: number | null;
  readonly installationVariant: string | null;
  readonly personalizationText: string | null;
  readonly moduleLayout: ModuleLayout;
  readonly priceBreakdown: PriceBreakdown;
  /**
   * Not derivable from `priceBreakdown` (which keeps the resulting
   * `machiningGrosze` cost, never the raw rate or which machine it used) -
   * captured separately for the admin production-capacity view (P7b).
   * `null` for `CUSTOM` products: no catalogue design, machining time
   * genuinely unknown until staff reviews the upload (same reasoning
   * `PricingInput.design`'s own doc comment states). Added 2026-08-27;
   * orders placed before this carry no value here, honestly, not a
   * backfilled guess.
   */
  readonly machiningMilliMinutesPerM2: number | null;

  /*
    Added 2026-09-05 for `docs/REVIEW-DETAILED.md` BUG-19, which is §6.8's own
    specification of this snapshot: "product name **and slug** ... material
    name **and family** ... **estimated production days**", plus
    `materialNotesPl` (§12 requires the confirmation to render it) and the
    installation variant's Polish name and „Co otrzymujesz" line (§6.5 says
    both go into the snapshot; only the bare enum code was stored, so
    rendering it in Polish meant either a live catalogue lookup - the one
    thing a snapshot exists to prevent - or printing `ON_TOP` at a customer).

    **Optional, not nullable, and that distinction is deliberate.** Every
    order placed before today has these keys genuinely absent from its stored
    JSON, so `undefined` is the truth and `| null` would be a claim the data
    does not support. `machiningMilliMinutesPerM2` above is typed `| null` and
    is really `undefined` on old rows - which is how `admin-production.ts`
    came to crash on `moduleLayout.totalModules` and take down the production
    queue for every order. Marking these optional makes every reader handle
    the absence, because TypeScript will not let them do otherwise.

    Not backfillable: the catalogue rows they would have come from have moved
    on, which is the whole argument for capturing them now rather than later.
  */

  /** What `productNamePl` cannot do: survive a rename and still identify the product. */
  readonly productSlug?: string;
  /** §6.8. Production keys off this - wood is not gres. */
  readonly materialFamilyCode?: string | null;
  /** The lead time quoted at the moment of ordering, not the one we advertise today. */
  readonly productionDaysMin?: number;
  readonly productionDaysMax?: number;
  /** §12: „Produkt obejmuje blat. Nogi nie są w zestawie." and similar. */
  readonly materialNotesPl?: string | null;
  /** §6.5's „Co otrzymujesz", in Polish, so the confirmation never has to look it up. */
  readonly installationVariantNamePl?: string | null;
  readonly installationVariantReceivesPl?: string | null;
};
