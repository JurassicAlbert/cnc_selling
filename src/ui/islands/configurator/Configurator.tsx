'use client';

/**
 * The configurator — ARCHITECTURE.md §7.1's step machine, wired to real
 * data. The first real MUI client island in this codebase (see
 * `docs/HANDOVER.md` §9e for why `ThemeRegistry` was pulled out of the root
 * layout specifically so this could exist without taxing every other page).
 *
 * **2026-08-28 redesign, direct owner feedback**: "wzory powinny być w
 * produkcie do wyboru tak jak kolor koszulki, tak samo typ drewna i sposób
 * zachowania" (patterns/wood type/finish should be choosable in the product
 * like a t-shirt color) — this used to be a `Stepper`-gated wizard showing
 * exactly one step at a time behind "Wstecz"/"Dalej". Every applicable
 * section now renders simultaneously on one page — DESIGN/MATERIAL/FINISH
 * as real image swatches (`ImageSwatchGroup`, using photography that was
 * already fetched — `MaterialOptionRow.imageUrl`/`DesignOptionRow.
 * previewUrl`/the newly-added `FinishOptionRow.imageUrl` — just never
 * rendered as one), SIZE/PERSONALIZATION/CUSTOM_UPLOAD as their existing
 * inputs, SUMMARY always visible at the bottom. No step index, no
 * `Stepper`/`StepButton` at all.
 *
 * The domain-level narrowing this used to lean on step-locking for turns
 * out to already handle "no forced order" correctly on its own:
 * `resolve-options.ts`'s `ResolvedOptionAvailability` is recomputed fresh
 * from whatever `selections` currently holds on every change — before a
 * material is picked, `finishes` is genuinely empty (nothing to enumerate,
 * a material's own join table is the only source of which finishes apply),
 * which the existing `OptionStep`/section already renders as an honest
 * "not available yet" notice with zero new code. DESIGN/MATERIAL entries
 * were already individually gated (`isAvailable`/`reason` per entry, not
 * per section) — that mechanism is exactly what a real swatch picker needs,
 * unchanged.
 *
 * State ownership, deliberately split three ways (unchanged by the
 * redesign above — this is presentation-only, no state/domain logic moved):
 *   - `selections`  — what the customer has picked. Local React state, and
 *     the URL query string, so refresh and back/forward both work (brief
 *     §36).
 *   - `snapshot`    — steps, resolved options, price, feasibility. NEVER
 *     computed here. Every change re-requests it from the
 *     `getConfiguratorSnapshot` Server Action (§10.2: prices are
 *     server-authoritative, full stop).
 *
 * Not yet built, honestly: quantity (belongs to the cart, P5), the 2D
 * preview (§7.3 — `ConfiguratorPreview` covers material/design overlay,
 * not a full render).
 */

import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';

import {
  checkConfigurationComplete,
  EMPTY_SELECTIONS,
  type Selections,
  type StepCode,
} from '@/domain/configuration/steps';
import type { FeasibilityCode } from '@/domain/feasibility/rules';
import { formatPln } from '@/domain/money/money';
import { countPersonalizationCharacters } from '@/domain/personalization/validate';
import type { PersonalizationIssue } from '@/domain/personalization/validate';
import { formatMmAsCentimetres, parseCentimetresToMm } from '@/domain/text/numeric-input';
import {
  COPY,
  customerDesignStatusMessage,
  dimensionMessage,
  feasibilityMessage,
  numericInputMessage,
  personalizationMessage,
  unavailabilityReasonMessage,
  uploadErrorMessage,
  uploadWarningMessage,
} from '@/content/pl/messages';
import type { UploadErrorCode } from '@/content/pl/messages';
import { SITE } from '@/content/pl/site';
import { UPLOAD } from '@/content/pl/upload';
import { maxUploadSizeBytes } from '@/domain/upload/inspect';
import type { UploadWarning } from '@/domain/upload/inspect';
import { DisabledExplanation } from '@/ui/primitives/DisabledExplanation';
import { Text } from '@/ui/primitives/Text';
import type {
  ConfiguratorOptionData,
  OptionAvailability,
} from '@/server/configurator/resolve-options';
import { getConfiguratorSnapshot } from '@/server/actions/configurator';
import type { ConfiguratorSnapshot } from '@/server/actions/configurator';
import { addToCart, updateCartItemConfiguration } from '@/server/actions/cart';
import { uploadCustomDesign } from '@/server/actions/upload';
import type { OwnedCustomerDesignListItem } from '@/server/repositories/customer-designs';
import type { UploadCustomDesignResult } from '@/server/actions/upload';
import { ConfiguratorPreview } from './ConfiguratorPreview';
import { ImageSwatchGroup } from './ImageSwatchGroup';
import type { SwatchEntry } from './ImageSwatchGroup';
import { readSelectionsFromSearch, writeSelectionsToSearch } from './selections-url';

const STEP_LABEL: Record<StepCode, string> = {
  DESIGN: SITE.configuratorStepDesignPl,
  MATERIAL: SITE.configuratorStepMaterialPl,
  SIZE: SITE.configuratorStepSizePl,
  THICKNESS: SITE.configuratorStepThicknessPl,
  FINISH: SITE.configuratorStepFinishPl,
  INSTALLATION_VARIANT: SITE.configuratorStepInstallationVariantPl,
  PERSONALIZATION: SITE.configuratorStepPersonalizationPl,
  CUSTOM_UPLOAD: SITE.configuratorStepCustomUploadPl,
  SUMMARY: SITE.configuratorStepSummaryPl,
};

/** Fixed at 1 — quantity belongs to the cart (P5), not the configurator. */
const QUANTITY = 1;

type ConfiguratorProps = {
  readonly productSlug: string;
  readonly options: ConfiguratorOptionData;
  /** „Produkt obejmuje blat. Nogi nie są w zestawie.” and similar — shown in the summary too (§12). */
  readonly materialNotesPl: string | null;
  /** Floor/panel products: no preset sizes, and a mandatory acknowledgement in the summary (§11). */
  readonly requiresExactSize: boolean;
  readonly dimensionEnvelope: {
    readonly minWidthMm: number;
    readonly maxWidthMm: number;
    readonly minHeightMm: number;
    readonly maxHeightMm: number;
  };
  /** The "Preview as customer" admin feature's `?podglad=1` flag, passed down so every `getConfiguratorSnapshot` call (not just the page's own initial SSR fetch) can keep bypassing the `isActive` gate. Re-verified server-side on every call — see `getConfiguratorSnapshot`'s own doc comment. */
  readonly isPreview?: boolean;
  /** P9 phase 2: the customer's own previously-uploaded designs, offered as a "reuse" alternative to uploading fresh on `CUSTOM_UPLOAD`. Server-fetched once on the product page — always passed, even for products with no such step, since it's cheap and simpler than a per-product-type check at the call site. */
  readonly savedDesigns?: readonly OwnedCustomerDesignListItem[];
};

export function Configurator({
  productSlug,
  options,
  materialNotesPl,
  requiresExactSize,
  dimensionEnvelope,
  isPreview = false,
  savedDesigns = [],
}: ConfiguratorProps) {
  const router = useRouter();
  const [selections, setSelections] = useState<Selections>(EMPTY_SELECTIONS);
  const [snapshot, setSnapshot] = useState<ConfiguratorSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [acknowledged, setAcknowledged] = useState<ReadonlySet<FeasibilityCode>>(new Set());
  const [exactSizeAcknowledged, setExactSizeAcknowledged] = useState(false);
  const [clearedNotice, setClearedNotice] = useState<string | null>(null);
  const [widthInput, setWidthInput] = useState('');
  const [heightInput, setHeightInput] = useState('');
  const [widthError, setWidthError] = useState<string | null>(null);
  const [heightError, setHeightError] = useState<string | null>(null);
  const [editConfigurationId, setEditConfigurationId] = useState<string | null>(null);
  const [addToCartPending, setAddToCartPending] = useState(false);
  const [addToCartError, setAddToCartError] = useState(false);
  const hydrated = useRef(false);

  const applyUrlSelections = useCallback((search: string) => {
    const restored = readSelectionsFromSearch(search);
    setSelections(restored);
    setWidthInput(restored.widthMm !== null ? formatMmAsCentimetres(restored.widthMm) : '');
    setHeightInput(restored.heightMm !== null ? formatMmAsCentimetres(restored.heightMm) : '');
    setWidthError(null);
    setHeightError(null);
    return restored;
  }, []);

  // Hydrate from the URL exactly once, on mount, so a refresh or a shared
  // link resumes where the customer left off (brief §36).
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    applyUrlSelections(window.location.search);
    // A cart item's own "Edytuj" link sets this — see src/app/(shop)/koszyk.
    // Read once, at mount: switching cart items to edit is always a fresh
    // page load, never something that changes mid-session.
    setEditConfigurationId(new URLSearchParams(window.location.search).get('edit'));
  }, [applyUrlSelections]);

  // The browser's own Back/Forward buttons change the URL without any of
  // our own effects running — `router.replace` never pushes a history
  // entry, so this fires only when navigation actually happened elsewhere
  // (leaving and returning to this URL, or Next reusing a cached instance
  // of this route). Without this listener the address bar changes but the
  // rendered configurator does not, which is exactly the bug brief §36
  // flags as "browser back button during configuration". Every section is
  // always visible now, so there is no step index to restore alongside the
  // selections — just the selections themselves.
  useEffect(() => {
    function onPopState() {
      applyUrlSelections(window.location.search);
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [applyUrlSelections]);

  // Every change re-fetches steps/options/price from the server. Never
  // computed locally — this is the entire point of §10.2.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getConfiguratorSnapshot(productSlug, selections, QUANTITY, isPreview).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (result.ok) {
        setSnapshot(result.snapshot);
      }
    });
    // This is the only owner of the selection-encoding keys, but it isn't
    // the only owner of the URL — the "Preview as customer" admin feature
    // (`?podglad=1`) needs to survive every one of this effect's own
    // `router.replace` calls, not just the very first render, or a staff
    // preview would 404 the moment this effect first runs (an inactive
    // product is only visible with the flag present on every request, not
    // just the initial one).
    const params = new URLSearchParams(writeSelectionsToSearch(selections));
    const podgladParam = new URLSearchParams(window.location.search).get('podglad');
    if (podgladParam !== null) {
      params.set('podglad', podgladParam);
    }
    const query = params.toString();
    router.replace(query.length > 0 ? `?${query}` : '?', { scroll: false });
    return () => {
      cancelled = true;
    };
  }, [selections, productSlug, router, isPreview]);

  const steps = snapshot?.steps ?? [];

  // Each field commits independently on its own blur. Committing both
  // together on either blur was a real bug: tabbing from width to height
  // blurred width while height was still empty, which force-set a spurious
  // "Podaj wymiar" error on a field the customer had not even reached yet.
  const commitWidth = useCallback(() => {
    const width = parseCentimetresToMm(widthInput);
    setWidthError(width.ok ? null : numericInputMessage(width.code));
    setSelections((prev) => ({ ...prev, widthMm: width.ok ? width.mm : null }));
  }, [widthInput]);

  const commitHeight = useCallback(() => {
    const height = parseCentimetresToMm(heightInput);
    setHeightError(height.ok ? null : numericInputMessage(height.code));
    setSelections((prev) => ({ ...prev, heightMm: height.ok ? height.mm : null }));
  }, [heightInput]);

  // Clearing a dependent selection is only correct when it is ACTUALLY no
  // longer compatible — never a blanket clear on every change — and the
  // customer is told why (§7.1: "never silently keep an incompatible
  // state... the customer is told, in Polish, that it was cleared and
  // why"). Checked against the real catalogue data already on the page
  // (`options`), not guessed.
  const selectMaterial = useCallback(
    (materialId: string) => {
      if (selections.finishId === null) {
        setSelections((prev) => ({ ...prev, materialId }));
        return;
      }
      const stillOffered = options.materials
        .find((material) => material.id === materialId)
        ?.finishes.some((finish) => finish.id === selections.finishId && finish.isAvailable);
      if (stillOffered) {
        setSelections((prev) => ({ ...prev, materialId }));
        return;
      }
      setClearedNotice(SITE.configuratorClearedFinishPl);
      setSelections((prev) => ({ ...prev, materialId, finishId: null }));
    },
    [options, selections.finishId],
  );

  const selectInstallationVariant = useCallback(
    (code: string) => {
      if (selections.thicknessMm === null) {
        setSelections((prev) => ({ ...prev, installationVariant: code }));
        return;
      }
      const cap = options.installVariants.find((variant) => variant.code === code)?.maxThicknessMm;
      if (cap === null || cap === undefined || selections.thicknessMm <= cap) {
        setSelections((prev) => ({ ...prev, installationVariant: code }));
        return;
      }
      setClearedNotice(SITE.configuratorClearedThicknessPl);
      setSelections((prev) => ({ ...prev, installationVariant: code, thicknessMm: null }));
    },
    [options, selections.thicknessMm],
  );

  // Re-validates and re-prices server-side either way — §10.2 applies to
  // the cart exactly as it applies to every price shown during
  // configuration. `editConfigurationId` decides which of the two real Server
  // Actions runs; the UI difference is just the button label.
  const handleAddToCart = useCallback(async () => {
    setAddToCartPending(true);
    setAddToCartError(false);
    const result =
      editConfigurationId === null
        ? await addToCart(productSlug, selections, [...acknowledged], QUANTITY)
        : await updateCartItemConfiguration(editConfigurationId, productSlug, selections, [...acknowledged]);
    if (result.ok) {
      router.push('/koszyk');
      return;
    }
    setAddToCartPending(false);
    setAddToCartError(true);
  }, [editConfigurationId, productSlug, selections, acknowledged, router]);

  if (steps.length === 0) {
    return loading ? (
      <CircularProgress size={24} />
    ) : (
      <Alert severity="error">{SITE.catalogueProductNotFoundPl}</Alert>
    );
  }

  const selectedInstallVariant =
    selections.installationVariant === null
      ? null
      : (options.installVariants.find((v) => v.code === selections.installationVariant) ?? null);
  const selectedMaterial =
    selections.materialId === null ? null : (options.materials.find((m) => m.id === selections.materialId) ?? null);

  const designSwatches: readonly SwatchEntry[] = (snapshot?.availability.designs ?? []).map((entry) =>
    toSwatchEntry(entry, options.designs.find((d) => d.id === entry.id)?.previewUrl ?? ''),
  );
  const materialSwatches: readonly SwatchEntry[] = (snapshot?.availability.materials ?? []).map((entry) =>
    toSwatchEntry(entry, options.materials.find((m) => m.id === entry.id)?.imageUrl ?? ''),
  );
  const finishSwatches: readonly SwatchEntry[] = (snapshot?.availability.finishes ?? []).map((entry) =>
    toSwatchEntry(entry, selectedMaterial?.finishes.find((f) => f.id === entry.id)?.imageUrl ?? ''),
  );

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 40, paddingBottom: 72 }}>
        <ConfiguratorPreview
          selections={selections}
          options={options}
          dimensionEnvelope={dimensionEnvelope}
          moduleLayout={snapshot?.pricing.status === 'priced' ? snapshot.pricing.moduleLayout : null}
        />

        {clearedNotice !== null && (
          <Alert severity="info" onClose={() => setClearedNotice(null)}>
            {clearedNotice}
          </Alert>
        )}

        {steps.includes('DESIGN') && (
          <ConfigSection heading={STEP_LABEL.DESIGN} selectedLabel={selectedLabelOf(designSwatches, selections.designId)}>
            {designSwatches.length === 0 ? (
              <Alert severity="info">{SITE.configuratorNoOptionsPl}</Alert>
            ) : (
              <ImageSwatchGroup
                ariaLabel={STEP_LABEL.DESIGN}
                entries={designSwatches}
                selectedId={selections.designId}
                onSelect={(id) => setSelections((prev) => ({ ...prev, designId: id }))}
              />
            )}
          </ConfigSection>
        )}

        {steps.includes('MATERIAL') && (
          <ConfigSection heading={STEP_LABEL.MATERIAL} selectedLabel={selectedLabelOf(materialSwatches, selections.materialId)}>
            {materialSwatches.length === 0 ? (
              <Alert severity="info">{SITE.configuratorNoOptionsPl}</Alert>
            ) : (
              <ImageSwatchGroup
                ariaLabel={STEP_LABEL.MATERIAL}
                entries={materialSwatches}
                selectedId={selections.materialId}
                onSelect={selectMaterial}
              />
            )}
          </ConfigSection>
        )}

        {steps.includes('FINISH') && (
          <ConfigSection heading={STEP_LABEL.FINISH} selectedLabel={selectedLabelOf(finishSwatches, selections.finishId)}>
            {finishSwatches.length === 0 ? (
              <Alert severity="info">{SITE.configuratorNoOptionsPl}</Alert>
            ) : (
              <ImageSwatchGroup
                ariaLabel={STEP_LABEL.FINISH}
                entries={finishSwatches}
                selectedId={selections.finishId}
                onSelect={(id) => setSelections((prev) => ({ ...prev, finishId: id }))}
              />
            )}
          </ConfigSection>
        )}

        {steps.includes('SIZE') && (
          <ConfigSection heading={STEP_LABEL.SIZE} selectedLabel={null}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 320 }}>
              <TextField
                label={SITE.configuratorWidthLabelPl}
                value={widthInput}
                onChange={(e) => setWidthInput(e.target.value)}
                onBlur={commitWidth}
                error={widthError !== null}
                helperText={
                  widthError ??
                  `${formatMmAsCentimetres(dimensionEnvelope.minWidthMm)}–${formatMmAsCentimetres(dimensionEnvelope.maxWidthMm)} cm`
                }
                size="small"
              />
              <TextField
                label={SITE.configuratorHeightLabelPl}
                value={heightInput}
                onChange={(e) => setHeightInput(e.target.value)}
                onBlur={commitHeight}
                error={heightError !== null}
                helperText={
                  heightError ??
                  `${formatMmAsCentimetres(dimensionEnvelope.minHeightMm)}–${formatMmAsCentimetres(dimensionEnvelope.maxHeightMm)} cm`
                }
                size="small"
              />
              {snapshot?.pricing.status === 'dimension_invalid' && (
                <Alert severity="error">
                  {snapshot.pricing.issues.map((issue) => (
                    <div key={issue.code}>{dimensionMessage(issue)}</div>
                  ))}
                </Alert>
              )}
            </div>
          </ConfigSection>
        )}

        {steps.includes('THICKNESS') && (
          <ConfigSection heading={STEP_LABEL.THICKNESS} selectedLabel={null}>
            <OptionStep
              title={STEP_LABEL.THICKNESS}
              entries={snapshot?.availability.thicknesses ?? []}
              selectedId={selections.thicknessMm === null ? null : String(selections.thicknessMm)}
              onSelect={(id) => setSelections((prev) => ({ ...prev, thicknessMm: Number(id) }))}
            />
          </ConfigSection>
        )}

        {steps.includes('INSTALLATION_VARIANT') && (
          <ConfigSection heading={STEP_LABEL.INSTALLATION_VARIANT} selectedLabel={null}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <OptionStep
                title={STEP_LABEL.INSTALLATION_VARIANT}
                entries={options.installVariants.map((v) => ({
                  id: v.code,
                  namePl: v.namePl,
                  isAvailable: true,
                  reason: null,
                }))}
                selectedId={selections.installationVariant}
                onSelect={selectInstallationVariant}
              />
              {selectedInstallVariant !== null && (
                <div>
                  <Text muted>{selectedInstallVariant.descPl}</Text>
                  {/* biome-ignore lint/performance/noImgElement: placeholder SVGs get nothing from next/image's raster pipeline — same as Card.tsx */}
                  <img
                    src={selectedInstallVariant.diagramUrl}
                    alt={selectedInstallVariant.namePl}
                    style={{ width: '100%', maxWidth: 400, height: 'auto', display: 'block' }}
                  />
                </div>
              )}
            </div>
          </ConfigSection>
        )}

        {steps.includes('PERSONALIZATION') && (
          <ConfigSection heading={STEP_LABEL.PERSONALIZATION} selectedLabel={null}>
            <PersonalizationStep
              personalization={snapshot?.personalization ?? null}
              fonts={snapshot?.availability.fonts ?? []}
              text={selections.personalizationText ?? ''}
              fontId={selections.fontId}
              issues={snapshot?.pricing.status === 'priced' ? snapshot.pricing.personalizationIssues : []}
              fontRequired={
                snapshot?.pricing.status === 'priced' ? snapshot.pricing.personalizationFontRequired : false
              }
              onTextChange={(text) =>
                setSelections((prev) => ({ ...prev, personalizationText: text === '' ? null : text }))
              }
              onFontChange={(fontId) => setSelections((prev) => ({ ...prev, fontId }))}
            />
          </ConfigSection>
        )}

        {steps.includes('CUSTOM_UPLOAD') && (
          <ConfigSection heading={STEP_LABEL.CUSTOM_UPLOAD} selectedLabel={null}>
            <CustomUploadStep
              customerDesignId={selections.customUploadId}
              savedDesigns={savedDesigns}
              onUploaded={(customerDesignId) =>
                setSelections((prev) => ({ ...prev, customUploadId: customerDesignId }))
              }
            />
          </ConfigSection>
        )}

        <ConfigSection heading={STEP_LABEL.SUMMARY} selectedLabel={null}>
          <SummaryStep
            snapshot={snapshot}
            selections={selections}
            options={options}
            materialNotesPl={materialNotesPl}
            requiresExactSize={requiresExactSize}
            acknowledged={acknowledged}
            onAcknowledge={(code, value) =>
              setAcknowledged((prev) => {
                const next = new Set(prev);
                if (value) next.add(code);
                else next.delete(code);
                return next;
              })
            }
            exactSizeAcknowledged={exactSizeAcknowledged}
            onAcknowledgeExactSize={setExactSizeAcknowledged}
            isComplete={checkConfigurationComplete(steps, selections).ok}
            isEditMode={editConfigurationId !== null}
            onAddToCart={handleAddToCart}
            addToCartPending={addToCartPending}
            addToCartError={addToCartError}
          />
        </ConfigSection>
      </div>
      <StickyPriceBar snapshot={snapshot} loading={loading} />
    </>
  );
}

function toSwatchEntry(entry: OptionAvailability, imageUrl: string): SwatchEntry {
  return {
    id: entry.id,
    namePl: entry.namePl,
    imageUrl,
    isAvailable: entry.isAvailable,
    reasonPl: entry.reason === null ? null : unavailabilityReasonMessage(entry.reason),
  };
}

function selectedLabelOf(entries: readonly SwatchEntry[], selectedId: string | null): string | null {
  if (selectedId === null) return null;
  return entries.find((entry) => entry.id === selectedId)?.namePl ?? null;
}

/**
 * One always-visible section of the page — heading, plus the real,
 * currently-selected value shown right next to it once there is one
 * (`selectedLabel`), the same "Color: Blue" pattern a real e-commerce
 * variant picker uses. Replaces the old single-step-at-a-time `Stepper`.
 */
function ConfigSection({
  heading,
  selectedLabel,
  children,
}: {
  readonly heading: string;
  readonly selectedLabel: string | null;
  readonly children: ReactNode;
}) {
  return (
    <div>
      <Typography variant="h6" component="h3" sx={{ mb: 1.5 }}>
        {heading}
        {selectedLabel !== null && (
          <Typography component="span" color="text.secondary" sx={{ ml: 1, font: 'var(--mui-font-body1)' }}>
            — {selectedLabel}
          </Typography>
        )}
      </Typography>
      {children}
    </div>
  );
}

/**
 * Pinned to the viewport bottom throughout — the running price is always
 * visible while configuring, the same pattern Bazaar/NextMerce use for
 * their PDP add-to-cart bar (this session's redesign reference,
 * `docs/HANDOVER.md` §9g). `position: fixed` rather than `sticky`: the
 * page's content height varies a lot depending on the product's own step
 * list, and `sticky` only pins once the element would otherwise scroll past
 * its normal flow position — `fixed` is unconditional on both mobile and
 * desktop. The outer `<div>`'s `paddingBottom: 72` above keeps this from
 * covering the page's last section.
 */
function StickyPriceBar({
  snapshot,
  loading,
}: {
  readonly snapshot: ConfiguratorSnapshot | null;
  readonly loading: boolean;
}) {
  let valueText: string;
  if (loading || snapshot === null) {
    valueText = SITE.configuratorPriceCalculatingPl;
  } else if (snapshot.pricing.status === 'priced') {
    valueText = formatPln(snapshot.pricing.priceBreakdown.unitGrossGrosze);
  } else if (snapshot.pricing.status === 'incomplete') {
    valueText = SITE.configuratorPriceUnavailablePl;
  } else {
    valueText = SITE.configuratorPriceUnavailableGenericPl;
  }

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 10,
        background: 'var(--mui-palette-background-paper)',
        borderTop: '1px solid var(--mui-palette-divider)',
        boxShadow: '0 -2px 12px rgba(0, 0, 0, 0.06)',
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          marginInline: 'auto',
          paddingInline: 24,
          paddingBlock: 12,
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <span style={{ font: 'var(--mui-font-body2)', color: 'var(--mui-palette-text-secondary)' }}>
          {SITE.configuratorPriceLabelPl}
        </span>
        <span style={{ font: 'var(--mui-font-h5)' }}>{valueText}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/**
 * Renders EVERY option, never just the selectable ones — ARCHITECTURE.md
 * §7.2: an unavailable option is shown disabled with a Polish reason, not
 * hidden, so the customer learns the rule instead of wondering where an
 * option went. Text-only (`ToggleButtonGroup`) — used for THICKNESS,
 * INSTALLATION_VARIANT, and font choice, none of which have a real image;
 * DESIGN/MATERIAL/FINISH use `ImageSwatchGroup` instead.
 */
function OptionStep({
  title,
  entries,
  selectedId,
  onSelect,
}: {
  readonly title: string;
  readonly entries: readonly OptionAvailability[];
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
}) {
  if (entries.length === 0) {
    return <Alert severity="info">{SITE.configuratorNoOptionsPl}</Alert>;
  }

  return (
    <ToggleButtonGroup
      value={selectedId}
      exclusive
      onChange={(_e, value: string | null) => {
        if (value !== null) onSelect(value);
      }}
      aria-label={title}
    >
      {entries.map((entry) => (
        <DisabledExplanation key={entry.id} title={entry.reason === null ? undefined : unavailabilityReasonMessage(entry.reason)}>
          <ToggleButton value={entry.id} disabled={!entry.isAvailable}>
            {entry.namePl}
          </ToggleButton>
        </DisabledExplanation>
      ))}
    </ToggleButtonGroup>
  );
}

/**
 * `personalization === null` covers three cases the same way, deliberately:
 * no `PersonalizationSpec` row at all (loft furniture, today), a spec with
 * `isEnabled: false`, and a spec with no fonts assigned yet — every one of
 * them means there is nothing real to offer, so all three fall back to the
 * same honest "not available yet, skippable" notice rather than a half-built
 * form. `docs/HANDOVER.md` documents which products actually have one.
 */
function PersonalizationStep({
  personalization,
  fonts,
  text,
  fontId,
  issues,
  fontRequired,
  onTextChange,
  onFontChange,
}: {
  readonly personalization: { readonly maxCharacters: number; readonly maxLines: number } | null;
  readonly fonts: readonly OptionAvailability[];
  readonly text: string;
  readonly fontId: string | null;
  readonly issues: readonly PersonalizationIssue[];
  readonly fontRequired: boolean;
  readonly onTextChange: (text: string) => void;
  readonly onFontChange: (fontId: string) => void;
}) {
  if (personalization === null) {
    return <Alert severity="info">{SITE.configuratorPersonalizationUnavailablePl}</Alert>;
  }

  const characterCount = countPersonalizationCharacters(text);
  const multiline = personalization.maxLines > 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 480 }}>
      <TextField
        label={SITE.configuratorPersonalizationLabelPl}
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        multiline={multiline}
        minRows={multiline ? 2 : 1}
        maxRows={multiline ? personalization.maxLines : 1}
        error={characterCount > personalization.maxCharacters}
        helperText={`${characterCount}/${personalization.maxCharacters}`}
        size="small"
      />
      <div>
        <Text muted>{SITE.configuratorFontLabelPl}</Text>
        <div style={{ marginTop: 4 }}>
          <OptionStep
            title={SITE.configuratorFontLabelPl}
            entries={fonts}
            selectedId={fontId}
            onSelect={onFontChange}
          />
        </div>
      </div>
      {fontRequired && <Alert severity="warning">{SITE.configuratorFontRequiredPl}</Alert>}
      {issues.map((issue) => (
        <Alert severity="error" key={issue.code}>
          {personalizationMessage(issue)}
        </Alert>
      ))}
    </div>
  );
}

/**
 * P4's real upload flow (`ARCHITECTURE.md` §13). Only the first-upload
 * path is wired here — `uploadCustomDesign`. `reuploadCustomDesign`
 * (customer re-upload after staff requests `NEEDS_CHANGES`) is real,
 * tested, and callable (`server/actions/design-review.ts`), and now has
 * its own real UI on `/moje-konto/wzory/[id]` (2026-08-28) — that event
 * happens on an existing order past checkout, not inside this pre-purchase
 * configurator.
 */
function CustomUploadStep({
  customerDesignId,
  savedDesigns,
  onUploaded,
}: {
  readonly customerDesignId: string | null;
  readonly savedDesigns: readonly OwnedCustomerDesignListItem[];
  readonly onUploaded: (customerDesignId: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [ipConsent, setIpConsent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<UploadErrorCode | null>(null);
  const [errorParams, setErrorParams] = useState<Record<string, number> | undefined>(undefined);
  const [warnings, setWarnings] = useState<readonly UploadWarning[]>([]);
  const [selectedSavedDesignId, setSelectedSavedDesignId] = useState('');

  const handleSubmit = async () => {
    if (file === null) {
      setError('NO_FILE');
      setErrorParams(undefined);
      return;
    }
    setPending(true);
    setError(null);
    setErrorParams(undefined);
    const formData = new FormData();
    formData.set('file', file);
    if (ipConsent) {
      formData.set('ipConsent', 'on');
    }

    // A file large enough to exceed next.config's own `serverActions.
    // bodySizeLimit` (26mb — deliberately just above the app's real 25MB
    // cap, see next.config's own comment) never reaches `uploadCustomDesign`
    // at all: Next.js rejects the request at the framework boundary and the
    // call throws instead of resolving `{ok: false}`. Found live while
    // verifying this exact upload flow — without this catch, `pending`
    // never clears and the customer is stuck on "Przesyłanie..." forever,
    // the failure visible only in the browser console. `file.size`/`file.
    // type` are already known client-side, so the same real-numbers
    // `FILE_TOO_LARGE` message can be shown immediately, no server
    // round-trip needed to know what went wrong.
    let result: UploadCustomDesignResult;
    try {
      result = await uploadCustomDesign(formData);
    } catch {
      setPending(false);
      setError('FILE_TOO_LARGE');
      const maxBytes = maxUploadSizeBytes(file.type);
      setErrorParams(maxBytes === null ? undefined : { actualBytes: file.size, maxBytes });
      return;
    }
    setPending(false);
    if (!result.ok) {
      setError(result.code);
      setErrorParams(result.params);
      return;
    }
    setWarnings(result.warnings);
    onUploaded(result.customerDesignId);
  };

  if (customerDesignId !== null) {
    // Reusing a design from `savedDesigns` is a real, previously-existing
    // row — it may already be APPROVED, not "just uploaded and pending."
    // Showing the hardcoded pending/needs-review copy for an already
    // -approved reused design would be actively wrong, not just imprecise.
    const reused = savedDesigns.find((design) => design.id === customerDesignId);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 480 }}>
        <Alert severity="success">
          {reused !== undefined ? SITE.configuratorUploadReuseSuccessPl : SITE.configuratorUploadSuccessPl}
        </Alert>
        <Text muted>{reused !== undefined ? customerDesignStatusMessage(reused.status) : COPY.designStatusPending}</Text>
        {(reused === undefined || reused.status === 'PENDING_REVIEW') && <Text muted>{COPY.customDesignNeedsReview}</Text>}
        {warnings.map((warning) => (
          <Alert severity="warning" key={warning.code}>
            {uploadWarningMessage(warning)}
          </Alert>
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 480 }}>
      {savedDesigns.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Text muted>{SITE.configuratorUploadReuseHeadingPl}</Text>
          <TextField
            select
            size="small"
            label={SITE.configuratorUploadReuseSelectLabelPl}
            value={selectedSavedDesignId}
            onChange={(e) => setSelectedSavedDesignId(e.target.value)}
          >
            {savedDesigns.map((design) => (
              <MenuItem key={design.id} value={design.id}>
                {design.titlePl ?? design.originalName} — {customerDesignStatusMessage(design.status)}
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="outlined"
            disabled={selectedSavedDesignId === ''}
            onClick={() => onUploaded(selectedSavedDesignId)}
            sx={{ alignSelf: 'flex-start' }}
          >
            {SITE.configuratorUploadReuseButtonPl}
          </Button>
          <Text muted>{SITE.configuratorUploadReuseOrNewPl}</Text>
        </div>
      )}

      <div>
        <Text muted>{SITE.configuratorUploadChooseFilePl}</Text>
        <input
          type="file"
          accept=".jpg,.jpeg,.png,.svg,.pdf,image/jpeg,image/png,image/svg+xml,application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          style={{ display: 'block', marginTop: 8 }}
        />
      </div>

      <Alert severity="info">{UPLOAD.ipDeclarationTextPl}</Alert>
      <FormControlLabel
        control={<Checkbox checked={ipConsent} onChange={(e) => setIpConsent(e.target.checked)} />}
        label={SITE.configuratorUploadIpConsentLabelPl}
      />

      {error !== null && <Alert severity="error">{uploadErrorMessage(error, errorParams)}</Alert>}

      <Button
        variant="contained"
        disabled={pending || file === null || !ipConsent}
        onClick={handleSubmit}
      >
        {pending ? SITE.configuratorUploadSubmittingPl : SITE.configuratorUploadSubmitPl}
      </Button>
    </div>
  );
}

function SummaryStep({
  snapshot,
  selections,
  options,
  materialNotesPl,
  requiresExactSize,
  acknowledged,
  onAcknowledge,
  exactSizeAcknowledged,
  onAcknowledgeExactSize,
  isComplete,
  isEditMode,
  onAddToCart,
  addToCartPending,
  addToCartError,
}: {
  readonly snapshot: ConfiguratorSnapshot | null;
  readonly selections: Selections;
  readonly options: ConfiguratorOptionData;
  readonly materialNotesPl: string | null;
  readonly requiresExactSize: boolean;
  readonly acknowledged: ReadonlySet<FeasibilityCode>;
  readonly onAcknowledge: (code: FeasibilityCode, value: boolean) => void;
  readonly exactSizeAcknowledged: boolean;
  readonly onAcknowledgeExactSize: (value: boolean) => void;
  readonly isComplete: boolean;
  readonly isEditMode: boolean;
  readonly onAddToCart: () => void;
  readonly addToCartPending: boolean;
  readonly addToCartError: boolean;
}) {
  if (snapshot === null) {
    return <CircularProgress size={24} />;
  }

  const { pricing } = snapshot;

  if (pricing.status === 'incomplete') {
    return <Alert severity="info">{SITE.configuratorPriceUnavailablePl}</Alert>;
  }
  if (pricing.status === 'infeasible') {
    return <Alert severity="error">{pricing.detail}</Alert>;
  }
  if (pricing.status === 'dimension_invalid') {
    return (
      <Alert severity="error">
        {pricing.issues.map((issue) => (
          <div key={issue.code}>{dimensionMessage(issue)}</div>
        ))}
      </Alert>
    );
  }

  const selectedVariantReceivesPl =
    selections.installationVariant === null
      ? null
      : (options.installVariants.find((v) => v.code === selections.installationVariant)
          ?.receivesPl ?? null);

  const outstandingAcknowledgements = pricing.feasibility.filter(
    (finding) => finding.requiresAcknowledgement && !acknowledged.has(finding.code),
  );
  const canProceed =
    isComplete &&
    !pricing.blockingError &&
    outstandingAcknowledgements.length === 0 &&
    (!requiresExactSize || exactSizeAcknowledged);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {selections.customUploadId !== null && (
        <Alert severity="info">{SITE.configuratorCustomPriceEstimatePl}</Alert>
      )}

      {materialNotesPl !== null && <Alert severity="info">{materialNotesPl}</Alert>}

      {selectedVariantReceivesPl !== null && (
        <div>
          <strong>{SITE.catalogueInstallationVariantsLabelPl}:</strong> {selectedVariantReceivesPl}
        </div>
      )}

      {requiresExactSize && (
        <Alert severity="warning">
          <div>{COPY.floorFinalDimensions}</div>
          <FormControlLabel
            control={
              <Checkbox
                checked={exactSizeAcknowledged}
                onChange={(e) => onAcknowledgeExactSize(e.target.checked)}
              />
            }
            label={SITE.configuratorAcknowledgeRequiredPl}
          />
        </Alert>
      )}

      {pricing.feasibility.map((finding) => (
        <Alert
          key={finding.code}
          severity={finding.severity === 'error' ? 'error' : finding.severity === 'warning' ? 'warning' : 'info'}
        >
          <div>{feasibilityMessage(finding)}</div>
          {finding.requiresAcknowledgement && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={acknowledged.has(finding.code)}
                  onChange={(e) => onAcknowledge(finding.code, e.target.checked)}
                />
              }
              label={SITE.configuratorAcknowledgeRequiredPl}
            />
          )}
        </Alert>
      ))}

      {pricing.moduleLayout.totalModules > 1 && (
        <div>
          {SITE.configuratorModuleCountLabelPl}: {pricing.moduleLayout.totalModules}
        </div>
      )}

      {pricing.personalizationFontRequired && (
        <Alert severity="warning">{SITE.configuratorFontRequiredPl}</Alert>
      )}
      {pricing.personalizationIssues.map((issue) => (
        <Alert severity="error" key={issue.code}>
          {personalizationMessage(issue)}
        </Alert>
      ))}

      <div style={{ font: 'var(--mui-font-h4)' }}>
        {SITE.configuratorPriceLabelPl}: {formatPln(pricing.priceBreakdown.unitGrossGrosze)}
      </div>

      {!isComplete && <Alert severity="warning">{SITE.configuratorBlockedPl}</Alert>}

      {addToCartError && <Alert severity="error">{SITE.configuratorAddToCartErrorPl}</Alert>}

      <Button variant="contained" disabled={!canProceed || addToCartPending} onClick={onAddToCart} sx={{ alignSelf: 'flex-start' }}>
        {isEditMode ? SITE.configuratorSaveChangesPl : SITE.configuratorAddToCartPl}
      </Button>
    </div>
  );
}
