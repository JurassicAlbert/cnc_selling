/**
 * The shape of `OrderItem.snapshot` — shared between `create-order.ts`
 * (which writes it) and `repositories/orders.ts` (which reads it back for
 * the confirmation page), so the two can never silently drift apart. Real
 * display strings (`productNamePl`, `designNamePl`, ...), not ids — the
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
   * `machiningGrosze` cost, never the raw rate or which machine it used) —
   * captured separately for the admin production-capacity view (P7b).
   * `null` for `CUSTOM` products: no catalogue design, machining time
   * genuinely unknown until staff reviews the upload (same reasoning
   * `PricingInput.design`'s own doc comment states). Added 2026-08-27;
   * orders placed before this carry no value here, honestly, not a
   * backfilled guess.
   */
  readonly machiningMilliMinutesPerM2: number | null;
};
