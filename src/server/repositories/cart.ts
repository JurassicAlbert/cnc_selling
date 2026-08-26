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
  /** Null unless the configuration is a CUSTOM product's own upload (P4). Feeds `createOrder`'s automatic DESIGN_REVIEW routing (`hasUnapprovedCustomDesign`). */
  readonly customDesignId: string | null;
  readonly customDesignStatus: 'PENDING_REVIEW' | 'APPROVED' | 'NEEDS_CHANGES' | 'REJECTED' | null;
};

export type CartView = {
  readonly cartId: string;
  readonly items: readonly CartItemView[];
  readonly subtotalGrossGrosze: number;
};

const EMPTY_CART: CartView = { cartId: '', items: [], subtotalGrossGrosze: 0 };

export type SavedConfigurationView = {
  readonly configurationId: string;
  readonly productSlug: string;
  readonly productNamePl: string;
  readonly imageUrl: string | null;
  readonly updatedAt: Date;
  readonly isComplete: boolean;
  readonly priceGrossGrosze: number | null;
  readonly selections: Selections;
  readonly acknowledgedWarnings: readonly string[];
};

/** Saved configurations (P6 Part C) — every `Configuration` a logged-in user has ever priced, not just ones currently in a cart. */
export async function listConfigurationsForUser(userId: string): Promise<readonly SavedConfigurationView[]> {
  const configurations = await prisma.configuration.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      designId: true,
      customDesignId: true,
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
      acknowledgedWarnings: true,
      updatedAt: true,
      product: { select: { slug: true, namePl: true, images: { where: { isPrimary: true }, select: { url: true }, take: 1 } } },
    },
  });

  return configurations.map((configuration) => ({
    configurationId: configuration.id,
    productSlug: configuration.product.slug,
    productNamePl: configuration.product.namePl,
    imageUrl: configuration.product.images[0]?.url ?? null,
    updatedAt: configuration.updatedAt,
    isComplete: configuration.isComplete,
    priceGrossGrosze: configuration.priceGrossGrosze,
    acknowledgedWarnings: configuration.acknowledgedWarnings,
    selections: {
      designId: configuration.designId,
      customUploadId: configuration.customDesignId,
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
}

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
      customUploadId: configuration.customDesignId,
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
