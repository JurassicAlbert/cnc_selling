/**
 * Pricing admin mutations - `docs/ARCHITECTURE.md` §16A.1 module 7, the
 * "highest-risk screen in the application... a mistyped rate changes every
 * price on the site." Everything here is ADMIN only (`requireAdminSession`,
 * not `requireStaffSession`), same gate as `admin-staff.ts`.
 *
 * `PricingSettings.version` is genuinely never edited in place - there is
 * no `applyUpdatePricingVersion` anywhere in this file, on purpose:
 * `applyCreatePricingDraft` always inserts a brand new row (`isActive:
 * false`, `publishedAt: null`), and `applyPublishPricingVersion` is the
 * only thing that ever flips `isActive`, atomically swapping which single
 * version is live in one `$transaction`. A draft that's never published is
 * just an inert row, same as an abandoned form.
 *
 * `simulatePricingDraft` used to be described here as "deliberately a read -
 * no DB write". As of 2026-09-08 it writes, and the change is the point:
 * BUG-34 found that module 7's "cannot be published without viewing it" rule
 * lived only in `PricingSimulator.tsx`, so a direct call to the publish
 * action skipped it entirely. A simulation now stamps `simulatedAt` on the
 * version, and `applyPublishPricingVersion` refuses without it. It is still
 * invoked from a client island rather than a gated Server Component, so it
 * still derives its own session - now an ADMIN one, matching the only page
 * that renders it.
 */

import { revalidatePath } from 'next/cache';

import { prisma } from '@/server/db/client';
import { requireAdminSession } from '@/server/auth/session';
import type { CurrentSession } from '@/server/auth/session';
import { writeAuditLog } from '@/server/audit/write-audit-log';
import { EMPTY_SELECTIONS } from '@/domain/configuration/steps';
import type { Selections } from '@/domain/configuration/steps';
import { priceConfiguration } from '@/server/configurator/price-configuration';
import type { ConfiguratorPricingData, ConfiguratorPricingResult } from '@/server/configurator/price-configuration';
import { getConfiguratorProductData } from '@/server/repositories/configurator';
import type { PricingSettingsRow } from '@/server/mapping/to-domain';
import { getActivePricingVersion, getPricingVersionByNumber, listPricingReferenceProducts, listPricingVersions } from '@/server/repositories/admin-pricing';
import type { AdminPricingVersion } from '@/server/repositories/admin-pricing';
import { refreshStartingPricesAfterCatalogueChange } from '@/server/pricing/starting-price';

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
    return `${badRate[0]} musi być liczbą całkowitą, nie mniejszą niż 0 - podano ${badRate[1]}.`;
  }
  if (!Number.isInteger(input.vatRateBp) || input.vatRateBp < 0 || input.vatRateBp > 10_000) {
    return `Stawka VAT musi być liczbą całkowitą od 0 do 10000 (punkty bazowe, 2300 = 23%) - podano ${input.vatRateBp}.`;
  }
  if (input.packagingTiers.length === 0) {
    return 'Musi istnieć co najmniej jeden próg pakowania.';
  }
  for (const [index, tier] of input.packagingTiers.entries()) {
    if (!Number.isInteger(tier.priceGrosze) || tier.priceGrosze < 0) {
      return `Próg pakowania #${index + 1}: cena musi być liczbą całkowitą, nie mniejszą niż 0 - podano ${tier.priceGrosze}.`;
    }
  }
  // packagingGroszeFor (src/server/mapping/to-domain.ts) evaluates tiers in
  // order and THROWS if none matches - "no matching tier is an error rather
  // than a zero," deliberately, per that function's own comment. A draft
  // whose last row isn't a real catch-all could crash real checkout pricing
  // the moment a customer configures something outside every bounded tier.
  // Real safety validation, not decoration.
  const lastTier = input.packagingTiers[input.packagingTiers.length - 1];
  if (lastTier === undefined || lastTier.maxAreaM2 !== null || lastTier.maxModules !== null) {
    return 'Ostatni próg pakowania musi być progiem "bez limitu" (puste pola maks. powierzchni i maks. modułów) - inaczej duża konfiguracja nie znajdzie pasującego progu i wycena się nie powiedzie.';
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
  /*
    BUG-34. §16A.1 module 7's "cannot be published without viewing it" was
    enforced by `disabled={result === null}` in `PricingSimulator.tsx` and
    nowhere else, so a direct call to the server action - every export of a
    `'use server'` module is a public endpoint - published without anyone
    seeing what it would do to prices.

    Checked against the row, not against a token or a flag the caller sends:
    the only thing that can set `simulatedAt` is a simulation that actually
    ran and returned rows. Versions are immutable once created, so a review
    of version N can never be stale, which is what makes a stored fact the
    right shape for this rule rather than a session-scoped one.

    In the panel this costs nothing: the simulator runs on mount, so opening
    the version *is* the review.
  */
  if (draft.simulatedAt === null) {
    return {
      ok: false,
      detail: 'Nie można opublikować wersji, której nikt nie zasymulował. Otwórz stronę tej wersji, poczekaj na tabelę porównania cen, a potem publikuj.',
    };
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

  // Publishing rates moves every price on the site, so the advertised
  // "od X zł" on every card is stale the instant this commits.
  await refreshStartingPricesAfterCatalogueChange();

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
 * How many products the comparison table prices. Three, as before - enough
 * to show that a rate moved more than one pricing path, few enough to read
 * at a glance on the screen that gates a publish.
 *
 * The products themselves come from `listPricingReferenceProducts`, which
 * reads the live catalogue. This used to be three hard-coded slugs, and two
 * of them had been retired with their categories by the time anyone looked -
 * see that function's own comment for what that cost.
 */
const REFERENCE_PRODUCT_COUNT = 3;

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

/**
 * The draft's own numbers, all of them.
 *
 * **`packagingTiers` used to be taken from `base` - the currently active
 * version - and that made the table lie.** `packagingGrosze` is added into
 * the unit net price in `domain/pricing/calculate.ts`, so a draft that
 * changed only the packaging table simulated as „no change" on the one
 * screen whose entire job is to say what publishing will do. Found while
 * fixing BUG-34, and worse than BUG-34: an interlock that forces you to look
 * at the wrong number is not a safeguard.
 *
 * `packagingTiers` is `unknown` on `AdminPricingVersion` because the column
 * is JSON; `packagingGroszeFor` takes `unknown` and validates it at the point
 * of use, and `validateDraftInput` has already rejected a tier table without
 * a real catch-all row, so nothing is being trusted here that was not checked
 * when the draft was created.
 *
 * `version` stays the base's: it is only an identifier on the row, and this
 * is not a version anyone can price an order under - it exists for the length
 * of one comparison.
 */
function toDraftPricingRow(draft: AdminPricingVersion, base: PricingSettingsRow): PricingSettingsRow {
  return {
    version: base.version,
    machineRateCncGrosze: draft.machineRateCncGrosze,
    machineRateLaserGrosze: draft.machineRateLaserGrosze,
    moduleSurchargeGrosze: draft.moduleSurchargeGrosze,
    vatRateBp: draft.vatRateBp,
    packagingTiers: draft.packagingTiers as PricingSettingsRow['packagingTiers'],
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

/**
 * Splitting this into an `apply*(actor, …)` half is BUG-34's other
 * consequence. It was a plain `simulatePricingDraft` with the session check
 * inline, which is the one shape in this codebase an integration test cannot
 * call - and a rule that cannot be tested is a rule that will not hold. Now
 * it matches every other operation here.
 *
 * **It writes.** That is the change: a simulation is no longer only a read,
 * it is the record that somebody looked, and `applyPublishPricingVersion`
 * refuses without it. The stamp keeps the FIRST reviewer rather than the
 * latest, because the question the record answers is "did anyone review this
 * version before it went live", and the first answer to that is the one that
 * matters. Only recorded when the simulation actually produced a table: an
 * error is not a review.
 */
export async function applySimulatePricingDraft(admin: CurrentSession, version: number): Promise<SimulatePricingResult> {
  const draft = await getPricingVersionByNumber(version);
  if (draft === null) {
    return { ok: false, detail: 'Wersja cennika nie istnieje.' };
  }

  const references = await listPricingReferenceProducts(REFERENCE_PRODUCT_COUNT);

  const rows = await Promise.all(
    references.map(async ({ slug, namePl }): Promise<PricingSimulationRow> => {
      const data = await getConfiguratorProductData(slug);
      const selections = referenceSelectionsFor(data);
      if (data === null || selections === null) {
        // The name comes from the reference query, never from the slug: a
        // row reading „stolek-loftowy-z-grawerem" was how the old hard-coded
        // set announced it had rotted, to nobody.
        return { slug, namePl, currentGrossGrosze: null, draftGrossGrosze: null, status: 'unpriceable' };
      }

      // `referenceSelectionsFor` only returns non-null when it found a real
      // materialId in `data.materialsById`, so this lookup cannot miss -
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

  /*
    `updateMany` with `simulatedAt: null` in the WHERE rather than a read
    then a write: two admins opening the same version at once would both see
    null and both write, and the second would overwrite the first reviewer.
    One statement, and the database decides.
  */
  await prisma.pricingSettings.updateMany({
    where: { version, simulatedAt: null },
    data: { simulatedAt: new Date(), simulatedByEmail: admin.email },
  });

  return { ok: true, rows };
}

export async function simulatePricingDraft(version: number): Promise<SimulatePricingResult> {
  /*
    ADMIN, not STAFF. It was `requireStaffSession` while this was a pure read,
    which was already looser than the only page that calls it
    (`/panel/ceny/[version]` is `requireAdminSession`) and than this module's
    own header rule. Now that a simulation is what unlocks a publish, a STAFF
    member's look would satisfy an interlock meant for an admin's, so the gate
    matches the rule it now guards.
  */
  const admin = await requireAdminSession();
  return applySimulatePricingDraft(admin, version);
}
