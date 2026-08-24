'use server';

/**
 * Cart mutations. Every action re-derives ownership from the guest session
 * cookie (or, once P6 exists, a real user id) — never from an id trusted in
 * the request — per `docs/ARCHITECTURE.md` §16.1: "Every Server Action
 * re-derives the actor from the session. No id is ever trusted from the
 * request body."
 *
 * `addToCart`/`updateCartItemConfiguration` re-validate and re-price
 * server-side exactly like `getConfiguratorSnapshot` does (§10.2: prices
 * are never trusted from the client) — the selections a customer submits
 * are re-checked against the real catalogue, never taken on faith.
 */

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';

import { checkConfigurationComplete } from '@/domain/configuration/steps';
import type { Selections } from '@/domain/configuration/steps';
import { prisma } from '@/server/db/client';
import type { Prisma } from '@/generated/prisma/client';
import type { InstallationVariantCode } from '@/generated/prisma/enums';
import { getConfiguratorProductData } from '@/server/repositories/configurator';
import { priceConfiguration } from '@/server/configurator/price-configuration';
import { stepsForProductType } from '@/domain/configuration/steps';
import {
  isValidSignedSessionValue,
  mintSignedSessionValue,
  requireSessionSecret,
} from '@/server/session/guest-session';
import { GUEST_SESSION_COOKIE_NAME } from '@/server/session/read-guest-session';

const GUEST_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;

/**
 * Prisma's JSON input type isn't structurally compatible with the plain
 * `readonly`-heavy domain types (`ModuleLayout`, `PriceBreakdown`,
 * `FeasibilityFinding[]`) even though every value is genuinely
 * JSON-serializable — this makes that intentional double-cast a single,
 * named, auditable spot instead of an unchecked `as never` scattered
 * through the file (which would silently accept ANY type, JSON-safe or
 * not).
 */
function toJsonInput<T>(value: T): Prisma.InputJsonValue {
  return value as unknown as Prisma.InputJsonValue;
}

async function ensureGuestSessionToken(): Promise<string> {
  const store = await cookies();
  const secret = requireSessionSecret();
  const existing = store.get(GUEST_SESSION_COOKIE_NAME)?.value;
  if (existing !== undefined && isValidSignedSessionValue(existing, secret)) {
    return existing;
  }
  const fresh = mintSignedSessionValue(secret);
  store.set(GUEST_SESSION_COOKIE_NAME, fresh, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: GUEST_COOKIE_MAX_AGE_SECONDS,
  });
  return fresh;
}

export type AddToCartResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: 'CONFIGURATION_INVALID' };

/**
 * Re-runs the exact same server-side validation `getConfiguratorSnapshot`
 * does — this function never trusts that a customer's browser only ever
 * submitted a valid, priced, acknowledged configuration.
 */
async function priceAndValidate(
  productSlug: string,
  selections: Selections,
): Promise<
  | { readonly ok: false }
  | {
      readonly ok: true;
      readonly data: NonNullable<Awaited<ReturnType<typeof getConfiguratorProductData>>>;
      readonly pricing: Extract<
        Awaited<ReturnType<typeof priceConfiguration>>,
        { status: 'priced' }
      >;
    }
> {
  const data = await getConfiguratorProductData(productSlug);
  if (data === null) {
    return { ok: false };
  }
  const steps = stepsForProductType(data.typeCode);
  if (!checkConfigurationComplete(steps, selections).ok) {
    return { ok: false };
  }

  const material = selections.materialId === null ? null : (data.materialsById.get(selections.materialId) ?? null);
  const design = selections.designId === null ? null : (data.designsById.get(selections.designId) ?? null);
  const finish = selections.finishId === null ? null : (data.finishesById.get(selections.finishId) ?? null);
  const thickness =
    selections.thicknessMm === null ? null : (data.thicknessesByMm.get(selections.thicknessMm) ?? null);
  const installationVariant =
    selections.installationVariant === null
      ? null
      : (data.installVariantsByCode.get(selections.installationVariant) ?? null);
  const font = selections.fontId === null ? null : (data.fontsById.get(selections.fontId) ?? null);

  if (material === null || design === null) {
    return { ok: false };
  }

  const pricing = priceConfiguration(
    {
      product: data.product,
      material,
      design,
      finish,
      thickness,
      installationVariant,
      personalizationSpec: data.personalizationSpec,
      font,
      machine: data.machine,
      pricing: data.pricing,
    },
    selections,
    1,
  );

  if (pricing.status !== 'priced' || pricing.blockingError) {
    return { ok: false };
  }

  return { ok: true, data, pricing };
}

export async function addToCart(
  productSlug: string,
  selections: Selections,
  acknowledgedWarnings: readonly string[],
  quantity: number,
): Promise<AddToCartResult> {
  const validated = await priceAndValidate(productSlug, selections);
  if (!validated.ok) {
    return { ok: false, code: 'CONFIGURATION_INVALID' };
  }
  const { data, pricing } = validated;
  const sessionToken = await ensureGuestSessionToken();

  const configuration = await prisma.configuration.create({
    data: {
      sessionToken,
      productId: data.productId,
      designId: selections.designId,
      materialId: selections.materialId,
      finishId: selections.finishId,
      thicknessMm: selections.thicknessMm,
      widthMm: selections.widthMm,
      heightMm: selections.heightMm,
      installVariant: selections.installationVariant as InstallationVariantCode | null,
      personalizationText: selections.personalizationText,
      fontId: selections.fontId,
      moduleCount: pricing.moduleLayout.totalModules,
      moduleLayout: toJsonInput(pricing.moduleLayout),
      priceBreakdown: toJsonInput(pricing.priceBreakdown),
      priceGrossGrosze: pricing.priceBreakdown.unitGrossGrosze,
      warnings: toJsonInput(pricing.feasibility),
      acknowledgedWarnings: [...acknowledgedWarnings],
      pricingVersion: pricing.priceBreakdown.pricingVersion,
      isComplete: true,
    },
  });

  const cart = await prisma.cart.upsert({
    where: { sessionToken },
    create: { sessionToken },
    update: {},
  });

  await prisma.cartItem.create({
    data: { cartId: cart.id, configurationId: configuration.id, quantity },
  });

  revalidatePath('/koszyk');
  return { ok: true };
}

async function requireOwnedCartItem(cartItemId: string) {
  const store = await cookies();
  const sessionToken = store.get(GUEST_SESSION_COOKIE_NAME)?.value;
  if (sessionToken === undefined || !isValidSignedSessionValue(sessionToken, requireSessionSecret())) {
    return null;
  }
  const cartItem = await prisma.cartItem.findFirst({
    where: { id: cartItemId, cart: { sessionToken } },
    select: { id: true, configurationId: true, cart: { select: { sessionToken: true } } },
  });
  return cartItem;
}

/**
 * `formData` as the trailing parameter — not a plain `quantity: number` —
 * so this can be bound with `.bind(null, cartItemId)` and used directly as
 * a `<form action>` on the cart page's own per-row quantity form, the same
 * zero-client-JS pattern as `CategoryFilterForm`.
 */
export async function updateCartItemQuantity(cartItemId: string, formData: FormData): Promise<void> {
  const quantity = Number(formData.get('quantity'));
  if (!Number.isInteger(quantity) || quantity < 1) {
    return;
  }
  const owned = await requireOwnedCartItem(cartItemId);
  if (owned === null) {
    return;
  }
  await prisma.cartItem.update({ where: { id: cartItemId }, data: { quantity } });
  revalidatePath('/koszyk');
}

export async function removeCartItem(cartItemId: string): Promise<void> {
  const owned = await requireOwnedCartItem(cartItemId);
  if (owned === null) {
    return;
  }
  await prisma.cartItem.delete({ where: { id: cartItemId } });
  revalidatePath('/koszyk');
}

/** Deep-copies the `Configuration` row — a duplicate is a second independent draft, not a quantity bump. */
export async function duplicateCartItem(cartItemId: string): Promise<void> {
  const owned = await requireOwnedCartItem(cartItemId);
  if (owned === null) {
    return;
  }
  const original = await prisma.configuration.findUniqueOrThrow({ where: { id: owned.configurationId } });
  const copy = await prisma.configuration.create({
    data: {
      sessionToken: original.sessionToken,
      userId: original.userId,
      productId: original.productId,
      designId: original.designId,
      customDesignId: original.customDesignId,
      materialId: original.materialId,
      finishId: original.finishId,
      thicknessMm: original.thicknessMm,
      widthMm: original.widthMm,
      heightMm: original.heightMm,
      installVariant: original.installVariant,
      personalizationText: original.personalizationText,
      fontId: original.fontId,
      moduleCount: original.moduleCount,
      moduleLayout: toJsonInput(original.moduleLayout),
      priceBreakdown: toJsonInput(original.priceBreakdown),
      priceGrossGrosze: original.priceGrossGrosze,
      warnings: toJsonInput(original.warnings),
      acknowledgedWarnings: original.acknowledgedWarnings,
      pricingVersion: original.pricingVersion,
      isComplete: original.isComplete,
    },
  });
  const cartItem = await prisma.cartItem.findUniqueOrThrow({ where: { id: cartItemId } });
  await prisma.cartItem.create({
    data: { cartId: cartItem.cartId, configurationId: copy.id, quantity: cartItem.quantity },
  });
  revalidatePath('/koszyk');
}

/**
 * `Configuration` carries its own `sessionToken` (§16.1: "`Configuration`...
 * access requires... matching guest `sessionToken`") — checked directly,
 * not via a `CartItem` join. The "Edytuj" link on the cart page encodes the
 * `Configuration` id, not the `CartItem` id, precisely so this can be
 * verified this way.
 */
async function requireOwnedConfiguration(configurationId: string): Promise<boolean> {
  const store = await cookies();
  const sessionToken = store.get(GUEST_SESSION_COOKIE_NAME)?.value;
  if (sessionToken === undefined || !isValidSignedSessionValue(sessionToken, requireSessionSecret())) {
    return false;
  }
  const configuration = await prisma.configuration.findFirst({
    where: { id: configurationId, sessionToken },
    select: { id: true },
  });
  return configuration !== null;
}

export async function updateCartItemConfiguration(
  configurationId: string,
  productSlug: string,
  selections: Selections,
  acknowledgedWarnings: readonly string[],
): Promise<AddToCartResult> {
  const owned = await requireOwnedConfiguration(configurationId);
  if (!owned) {
    return { ok: false, code: 'CONFIGURATION_INVALID' };
  }
  const validated = await priceAndValidate(productSlug, selections);
  if (!validated.ok) {
    return { ok: false, code: 'CONFIGURATION_INVALID' };
  }
  const { pricing } = validated;

  await prisma.configuration.update({
    where: { id: configurationId },
    data: {
      designId: selections.designId,
      materialId: selections.materialId,
      finishId: selections.finishId,
      thicknessMm: selections.thicknessMm,
      widthMm: selections.widthMm,
      heightMm: selections.heightMm,
      installVariant: selections.installationVariant as InstallationVariantCode | null,
      personalizationText: selections.personalizationText,
      fontId: selections.fontId,
      moduleCount: pricing.moduleLayout.totalModules,
      moduleLayout: toJsonInput(pricing.moduleLayout),
      priceBreakdown: toJsonInput(pricing.priceBreakdown),
      priceGrossGrosze: pricing.priceBreakdown.unitGrossGrosze,
      warnings: toJsonInput(pricing.feasibility),
      acknowledgedWarnings: [...acknowledgedWarnings],
      pricingVersion: pricing.priceBreakdown.pricingVersion,
      isComplete: true,
    },
  });

  revalidatePath('/koszyk');
  return { ok: true };
}
