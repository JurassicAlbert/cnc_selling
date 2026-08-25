/**
 * Cart reads. `Configuration`'s computed fields (`priceBreakdown`,
 * `priceGrossGrosze`, `moduleLayout`, `warnings`) are read directly off the
 * row — per the schema's own comment on that model, "Server-computed,
 * cached for display. The client never derives these" — so viewing the
 * cart never re-runs pricing. Checkout is the one place that re-prices and
 * compares (`src/server/orders/create-order.ts`), because that's the one
 * moment staleness actually matters.
 */

import { prisma } from '@/server/db/client';
import type { PriceBreakdown } from '@/domain/pricing/types';
import type { ModuleLayout } from '@/domain/modules/split';
import type { FeasibilityFinding } from '@/domain/feasibility/rules';
import type { Selections } from '@/domain/configuration/steps';

export type CartItemView = {
  readonly cartItemId: string;
  readonly configurationId: string;
  readonly quantity: number;
  readonly productSlug: string;
  readonly productNamePl: string;
  readonly imageUrl: string | null;
  readonly designNamePl: string | null;
  readonly materialNamePl: string | null;
  readonly finishNamePl: string | null;
  readonly fontNamePl: string | null;
  readonly widthMm: number | null;
  readonly heightMm: number | null;
  readonly thicknessMm: number | null;
  readonly personalizationText: string | null;
  readonly isComplete: boolean;
  readonly priceGrossGrosze: number | null;
  readonly priceBreakdown: PriceBreakdown | null;
  readonly moduleLayout: ModuleLayout | null;
  readonly warnings: readonly FeasibilityFinding[];
  readonly acknowledgedWarnings: readonly string[];
  /** The raw ids behind the display names above — rebuilds the configurator's own URL-encoded state for the "Edytuj" link, never re-derived by hand. */
  readonly selections: Selections;
  /** The `Design.code` (§6.8's order snapshot wants a stable code, not just a display name that can be edited later). */
  readonly designCode: string | null;
  readonly pricingVersion: number | null;
  /** Both null until P4's upload pipeline exists — read now so `createOrder`'s automatic DESIGN_REVIEW routing is correct the day it does. */
  readonly customDesignId: string | null;
  readonly customDesignStatus: 'PENDING_REVIEW' | 'APPROVED' | 'NEEDS_CHANGES' | 'REJECTED' | null;
};

export type CartView = {
  readonly cartId: string;
  readonly items: readonly CartItemView[];
  readonly subtotalGrossGrosze: number;
};

const EMPTY_CART: CartView = { cartId: '', items: [], subtotalGrossGrosze: 0 };

export async function findCartForRequest(params: {
  readonly userId: string | null;
  readonly sessionToken: string | null;
}): Promise<CartView> {
  const { userId, sessionToken } = params;
  if (userId === null && sessionToken === null) {
    return EMPTY_CART;
  }

  const cart = await prisma.cart.findFirst({
    where: userId !== null ? { userId } : { sessionToken },
    select: {
      id: true,
      items: {
        orderBy: { addedAt: 'asc' },
        select: {
          id: true,
          quantity: true,
          configuration: {
            select: {
              id: true,
              designId: true,
              materialId: true,
              finishId: true,
              thicknessMm: true,
              widthMm: true,
              heightMm: true,
              installVariant: true,
              personalizationText: true,
              fontId: true,
              isComplete: true,
              priceGrossGrosze: true,
              priceBreakdown: true,
              moduleLayout: true,
              warnings: true,
              acknowledgedWarnings: true,
              pricingVersion: true,
              customDesignId: true,
              product: { select: { slug: true, namePl: true, images: { where: { isPrimary: true }, select: { url: true }, take: 1 } } },
              design: { select: { namePl: true, code: true } },
              material: { select: { namePl: true } },
              finish: { select: { namePl: true } },
              font: { select: { namePl: true } },
              customDesign: { select: { status: true } },
            },
          },
        },
      },
    },
  });

  if (cart === null) {
    return EMPTY_CART;
  }

  const items: CartItemView[] = cart.items.map(({ id: cartItemId, quantity, configuration }) => ({
    cartItemId,
    configurationId: configuration.id,
    quantity,
    productSlug: configuration.product.slug,
    productNamePl: configuration.product.namePl,
    imageUrl: configuration.product.images[0]?.url ?? null,
    designNamePl: configuration.design?.namePl ?? null,
    materialNamePl: configuration.material?.namePl ?? null,
    finishNamePl: configuration.finish?.namePl ?? null,
    fontNamePl: configuration.font?.namePl ?? null,
    widthMm: configuration.widthMm,
    heightMm: configuration.heightMm,
    thicknessMm: configuration.thicknessMm,
    personalizationText: configuration.personalizationText,
    isComplete: configuration.isComplete,
    priceGrossGrosze: configuration.priceGrossGrosze,
    priceBreakdown: (configuration.priceBreakdown as PriceBreakdown | null) ?? null,
    moduleLayout: (configuration.moduleLayout as ModuleLayout | null) ?? null,
    warnings: (configuration.warnings as FeasibilityFinding[] | null) ?? [],
    acknowledgedWarnings: configuration.acknowledgedWarnings,
    designCode: configuration.design?.code ?? null,
    pricingVersion: configuration.pricingVersion,
    customDesignId: configuration.customDesignId,
    customDesignStatus: configuration.customDesign?.status ?? null,
    selections: {
      designId: configuration.designId,
      customUploadId: null,
      materialId: configuration.materialId,
      widthMm: configuration.widthMm,
      heightMm: configuration.heightMm,
      thicknessMm: configuration.thicknessMm,
      finishId: configuration.finishId,
      installationVariant: configuration.installVariant,
      personalizationText: configuration.personalizationText,
      fontId: configuration.fontId,
    },
  }));

  const subtotalGrossGrosze = items.reduce(
    (sum, item) => sum + (item.priceGrossGrosze ?? 0) * item.quantity,
    0,
  );

  return { cartId: cart.id, items, subtotalGrossGrosze };
}
