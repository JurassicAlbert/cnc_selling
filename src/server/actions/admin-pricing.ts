'use server';

/**
 * Pricing admin mutations — `docs/ARCHITECTURE.md` §16A.1 module 7, the
 * "highest-risk screen in the application... a mistyped rate changes every
 * price on the site." Everything here is ADMIN only (`requireAdminSession`,
 * not `requireStaffSession`), same gate as `admin-staff.ts`.
 *
 * `PricingSettings.version` is genuinely never edited in place — there is
 * no `applyUpdatePricingVersion` anywhere in this file, on purpose:
 * `applyCreatePricingDraft` always inserts a brand new row (`isActive:
 * false`, `publishedAt: null`), and `applyPublishPricingVersion` is the
 * only thing that ever flips `isActive`, atomically swapping which single
 * version is live in one `$transaction`. A draft that's never published is
 * just an inert row, same as an abandoned form.
 *
 * `simulatePricingDraft` is deliberately a read — no DB write — but still
 * requires a real staff session, since it's invoked from a client island
 * via `fetch`, not rendered inside an already-gated Server Component page
 * (same reasoning as `admin-global-search.ts`).
 */

import { revalidatePath } from 'next/cache';

import { prisma } from '@/server/db/client';
import { requireAdminSession, requireStaffSession } from '@/server/auth/session';
import type { CurrentSession } from '@/server/auth/session';
import { writeAuditLog } from '@/server/audit/write-audit-log';
import { EMPTY_SELECTIONS } from '@/domain/configuration/steps';
import type { Selections } from '@/domain/configuration/steps';
import { priceConfiguration } from '@/server/configurator/price-configuration';
import type { ConfiguratorPricingData, ConfiguratorPricingResult } from '@/server/configurator/price-configuration';
import { getConfiguratorProductData } from '@/server/repositories/configurator';
import type { PricingSettingsRow } from '@/server/mapping/to-domain';
import { getActivePricingVersion, getPricingVersionByNumber, listPricingVersions } from '@/server/repositories/admin-pricing';
import type { AdminPricingVersion } from '@/server/repositories/admin-pricing';

export type PackagingTierInput = { readonly maxAreaM2: number | null; readonly maxModules: number | null; readonly priceGrosze: number };

export type PricingDraftInput = {
  readonly machineRateCncGrosze: number;
  readonly machineRateLaserGrosze: number;
  readonly moduleSurchargeGrosze: number;
  readonly vatRateBp: number;
  readonly packagingTiers: readonly PackagingTierInput[];
  readonly notePl: string;
};

export type PricingDraftResult = { readonly ok: true; readonly version: number } | { readonly ok: false; readonly detail: string };

function validateDraftInput(input: PricingDraftInput): string | null {
  const rates: readonly [string, number][] = [
    ['Stawka CNC', input.machineRateCncGrosze],
    ['Stawka lasera', input.machineRateLaserGrosze],
    ['Dopłata modułowa', input.moduleSurchargeGrosze],
  ];
  const badRate = rates.find(([, r]) => !Number.isInteger(r) || r < 0);
  if (badRate !== undefined) {
    return `${badRate[0]} musi być liczbą całkowitą, nie mniejszą niż 0 — podano ${badRate[1]}.`;
  }
  if (!Number.isInteger(input.vatRateBp) || input.vatRateBp < 0 || input.vatRateBp > 10_000) {
    return `Stawka VAT musi być liczbą całkowitą od 0 do 10000 (punkty bazowe, 2300 = 23%) — podano ${input.vatRateBp}.`;
  }
  if (input.packagingTiers.length === 0) {
    return 'Musi istnieć co najmniej jeden próg pakowania.';
  }
  for (const [index, tier] of input.packagingTiers.entries()) {
    if (!Number.isInteger(tier.priceGrosze) || tier.priceGrosze < 0) {
      return `Próg pakowania #${index + 1}: cena musi być liczbą całkowitą, nie mniejszą niż 0 — podano ${tier.priceGrosze}.`;
    }
  }
  // packagingGroszeFor (src/server/mapping/to-domain.ts) evaluates tiers in
  // order and THROWS if none matches — "no matching tier is an error rather
  // than a zero," deliberately, per that function's own comment. A draft
  // whose last row isn't a real catch-all could crash real checkout pricing
  // the moment a customer configures something outside every bounded tier.
  // Real safety validation, not decoration.
  const lastTier = input.packagingTiers[input.packagingTiers.length - 1];
  if (lastTier === undefined || lastTier.maxAreaM2 !== null || lastTier.maxModules !== null) {
    return 'Ostatni próg pakowania musi być progiem "bez limitu" (puste pola maks. powierzchni i maks. modułów) — inaczej duża konfiguracja nie znajdzie pasującego progu i wycena się nie powiedzie.';
  }
  return null;
}

export async function applyCreatePricingDraft(admin: CurrentSession, input: PricingDraftInput): Promise<PricingDraftResult> {
  const issue = validateDraftInput(input);
  if (issue !== null) {
    return { ok: false, detail: issue };
  }

  const versions = await listPricingVersions();
  const nextVersion = versions.reduce((max, v) => Math.max(max, v.version), 0) + 1;

  const created = await prisma.pricingSettings.create({
    data: {
      version: nextVersion,
      machineRateCncGrosze: input.machineRateCncGrosze,
      machineRateLaserGrosze: input.machineRateLaserGrosze,
      moduleSurchargeGrosze: input.moduleSurchargeGrosze,
      vatRateBp: input.vatRateBp,
      packagingTiers: input.packagingTiers,
      isActive: false,
      notePl: input.notePl.trim().length === 0 ? null : input.notePl.trim(),
    },
  });
  await writeAuditLog({ actor: admin, entity: 'PricingSettings', entityId: String(created.version), action: 'create', diff: input });

  return { ok: true, version: created.version };
}

export async function createPricingDraft(input: PricingDraftInput): Promise<PricingDraftResult> {
  const admin = await requireAdminSession();
  const result = await applyCreatePricingDraft(admin, input);
  if (result.ok) {
    revalidatePath('/panel/ceny');
  }
  return result;
}

export type PublishPricingResult = { readonly ok: true } | { readonly ok: false; readonly detail: string };

export async function applyPublishPricingVersion(admin: CurrentSession, version: number): Promise<PublishPricingResult> {
  const draft = await getPricingVersionByNumber(version);
  if (draft === null) {
    return { ok: false, detail: 'Wersja cennika nie istnieje.' };
  }
  if (draft.isActive) {
    return { ok: false, detail: 'Ta wersja jest już aktywna.' };
  }
  const previouslyActive = await getActivePricingVersion();

  await prisma.$transaction([
    prisma.pricingSettings.updateMany({ where: { isActive: true }, data: { isActive: false } }),
    prisma.pricingSettings.update({
      where: { version },
      data: { isActive: true, publishedAt: new Date(), publishedByEmail: admin.email },
    }),
  ]);

  await writeAuditLog({
    actor: admin,
    entity: 'PricingSettings',
    entityId: String(version),
    action: 'transition',
    diff: {
      activeVersion: { from: previouslyActive?.version ?? null, to: version },
      rates: {
        before: previouslyActive === null ? null : ratesOf(previouslyActive),
        after: ratesOf(draft),
      },
    },
  });

  return { ok: true };
}

export async function publishPricingVersion(version: number): Promise<PublishPricingResult> {
  const admin = await requireAdminSession();
  const result = await applyPublishPricingVersion(admin, version);
  if (result.ok) {
    revalidatePath('/panel/ceny');
    revalidatePath(`/panel/ceny/${version}`);
  }
  return result;
}

function ratesOf(v: AdminPricingVersion) {
  return {
    machineRateCncGrosze: v.machineRateCncGrosze,
    machineRateLaserGrosze: v.machineRateLaserGrosze,
    moduleSurchargeGrosze: v.moduleSurchargeGrosze,
    vatRateBp: v.vatRateBp,
  };
}

// --- Simulator --------------------------------------------------------------

/**
 * Three real seeded products, looked up by slug (not id — ids don't survive
 * a reseed). Chosen for rate sensitivity: the loft table uses CNC
 * machining and a thickness factor, the wall art and floor panel are
 * simpler single-module cases. Each priced at the product's own
 * `minWidthMm`/`minHeightMm` with its first available material/finish
 * (and design, if it has one) — deterministic and always a valid
 * configuration, no new selection logic needed.
 */
const REFERENCE_PRODUCT_SLUGS = ['obraz-drewniany-z-grawerem', 'stolek-loftowy-z-grawerem', 'panel-podlogowy-z-grawerem'] as const;

export type PricingSimulationRow = {
  readonly slug: string;
  readonly namePl: string;
  readonly currentGrossGrosze: number | null;
  readonly draftGrossGrosze: number | null;
  readonly status: 'ok' | 'unpriceable';
};

export type SimulatePricingResult =
  | { readonly ok: true; readonly rows: readonly PricingSimulationRow[] }
  | { readonly ok: false; readonly detail: string };

function toDraftPricingRow(draft: AdminPricingVersion, base: PricingSettingsRow): PricingSettingsRow {
  return {
    version: base.version,
    machineRateCncGrosze: draft.machineRateCncGrosze,
    machineRateLaserGrosze: draft.machineRateLaserGrosze,
    moduleSurchargeGrosze: draft.moduleSurchargeGrosze,
    vatRateBp: draft.vatRateBp,
    packagingTiers: base.packagingTiers,
  };
}

function referenceSelectionsFor(data: Awaited<ReturnType<typeof getConfiguratorProductData>>): Selections | null {
  if (data === null) {
    return null;
  }
  const materialId = data.materialsById.keys().next().value ?? null;
  if (materialId === null) {
    return null;
  }
  const finishId = data.finishesById.keys().next().value ?? null;
  const designId = data.designsById.keys().next().value ?? null;
  const thicknessMm = data.thicknessesByMm.keys().next().value ?? null;
  const installationVariant = data.installVariantsByCode.keys().next().value ?? null;

  return {
    ...EMPTY_SELECTIONS,
    materialId,
    finishId,
    designId,
    thicknessMm,
    installationVariant,
    widthMm: data.product.minWidthMm,
    heightMm: data.product.minHeightMm,
  };
}

function grossGrosze(result: ConfiguratorPricingResult): number | null {
  return result.status === 'priced' ? result.priceBreakdown.unitGrossGrosze : null;
}

export async function simulatePricingDraft(version: number): Promise<SimulatePricingResult> {
  await requireStaffSession(); // read-only, but still a real session check — see this file's header

  const draft = await getPricingVersionByNumber(version);
  if (draft === null) {
    return { ok: false, detail: 'Wersja cennika nie istnieje.' };
  }

  const rows = await Promise.all(
    REFERENCE_PRODUCT_SLUGS.map(async (slug): Promise<PricingSimulationRow> => {
      const data = await getConfiguratorProductData(slug);
      const selections = referenceSelectionsFor(data);
      if (data === null || selections === null) {
        return { slug, namePl: data?.namePl ?? slug, currentGrossGrosze: null, draftGrossGrosze: null, status: 'unpriceable' };
      }

      // `referenceSelectionsFor` only returns non-null when it found a real
      // materialId in `data.materialsById`, so this lookup cannot miss —
      // still handled explicitly (`unpriceable`, not a non-null assertion)
      // rather than assumed.
      const material = selections.materialId === null ? null : (data.materialsById.get(selections.materialId) ?? null);
      if (material === null) {
        return { slug, namePl: data.namePl, currentGrossGrosze: null, draftGrossGrosze: null, status: 'unpriceable' };
      }
      const design = selections.designId === null ? null : (data.designsById.get(selections.designId) ?? null);
      const finish = selections.finishId === null ? null : (data.finishesById.get(selections.finishId) ?? null);
      const thickness = selections.thicknessMm === null ? null : (data.thicknessesByMm.get(selections.thicknessMm) ?? null);
      const installationVariant =
        selections.installationVariant === null ? null : (data.installVariantsByCode.get(selections.installationVariant) ?? null);

      const basePricingData: Omit<ConfiguratorPricingData, 'pricing'> = {
        product: data.product,
        material,
        design,
        finish,
        thickness,
        installationVariant,
        personalizationSpec: null,
        font: null,
        machine: data.machine,
      };

      const current = priceConfiguration({ ...basePricingData, pricing: data.pricing }, selections, 1);
      const draftPricing = toDraftPricingRow(draft, data.pricing);
      const draftResult = priceConfiguration({ ...basePricingData, pricing: draftPricing }, selections, 1);

      return {
        slug,
        namePl: data.namePl,
        currentGrossGrosze: grossGrosze(current),
        draftGrossGrosze: grossGrosze(draftResult),
        status: current.status === 'priced' && draftResult.status === 'priced' ? 'ok' : 'unpriceable',
      };
    }),
  );

  return { ok: true, rows };
}
