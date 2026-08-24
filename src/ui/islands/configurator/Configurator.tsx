'use client';

/**
 * The configurator — ARCHITECTURE.md §7.1's step machine, wired to real
 * data. The first real MUI client island in this codebase (see
 * `docs/HANDOVER.md` §9e for why `ThemeRegistry` was pulled out of the root
 * layout specifically so this could exist without taxing every other page).
 *
 * State ownership, deliberately split three ways:
 *   - `selections`  — what the customer has picked. Local React state, and
 *     the URL query string, so refresh and back/forward both work (brief
 *     §36) without yet needing a persisted `Configuration` row — that is a
 *     further piece (cart integration, P5), not built in this pass.
 *   - `snapshot`    — steps, resolved options, price, feasibility. NEVER
 *     computed here. Every change re-requests it from the
 *     `getConfiguratorSnapshot` Server Action (§10.2: prices are
 *     server-authoritative, full stop).
 *   - `stepIndex`   — which step is showing. Gated by `isStepEnterable` so
 *     typing a URL for a step whose prerequisites are missing cannot open it.
 *
 * Not yet built, honestly: quantity (belongs to the cart, P5), the 2D
 * preview (§7.3), font-backed personalization (no `Font` row exists yet —
 * see `prisma/seed.ts`'s header on why one was not fabricated), and
 * `CUSTOM_UPLOAD` (P4's upload pipeline). Add-to-cart renders disabled with
 * an honest label rather than doing nothing silently.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import Step from '@mui/material/Step';
import StepButton from '@mui/material/StepButton';
import Stepper from '@mui/material/Stepper';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import {
  checkConfigurationComplete,
  EMPTY_SELECTIONS,
  isStepEnterable,
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
  dimensionMessage,
  feasibilityMessage,
  numericInputMessage,
  personalizationMessage,
  unavailabilityReasonMessage,
} from '@/content/pl/messages';
import { SITE } from '@/content/pl/site';
import { Text } from '@/ui/primitives/Text';
import type {
  ConfiguratorOptionData,
  OptionAvailability,
} from '@/server/configurator/resolve-options';
import { getConfiguratorSnapshot } from '@/server/actions/configurator';
import type { ConfiguratorSnapshot } from '@/server/actions/configurator';

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
  /** „Produkt obejmuje blat. Nogi nie są w zestawie." and similar — shown in the summary too (§12). */
  readonly materialNotesPl: string | null;
  /** Floor/panel products: no preset sizes, and a mandatory acknowledgement in the summary (§11). */
  readonly requiresExactSize: boolean;
  readonly dimensionEnvelope: {
    readonly minWidthMm: number;
    readonly maxWidthMm: number;
    readonly minHeightMm: number;
    readonly maxHeightMm: number;
  };
};

export function Configurator({
  productSlug,
  options,
  materialNotesPl,
  requiresExactSize,
  dimensionEnvelope,
}: ConfiguratorProps) {
  const router = useRouter();
  const [selections, setSelections] = useState<Selections>(EMPTY_SELECTIONS);
  const [stepIndex, setStepIndex] = useState(0);
  const [snapshot, setSnapshot] = useState<ConfiguratorSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [acknowledged, setAcknowledged] = useState<ReadonlySet<FeasibilityCode>>(new Set());
  const [exactSizeAcknowledged, setExactSizeAcknowledged] = useState(false);
  const [clearedNotice, setClearedNotice] = useState<string | null>(null);
  const [widthInput, setWidthInput] = useState('');
  const [heightInput, setHeightInput] = useState('');
  const [widthError, setWidthError] = useState<string | null>(null);
  const [heightError, setHeightError] = useState<string | null>(null);
  const hydrated = useRef(false);
  const initialStepResolved = useRef(false);
  const stepsRef = useRef<readonly StepCode[]>([]);

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
  }, [applyUrlSelections]);

  // The browser's own Back/Forward buttons change the URL without any of
  // our own effects running — `router.replace` never pushes a history
  // entry, so this fires only when navigation actually happened elsewhere
  // (leaving and returning to this URL, or Next reusing a cached instance
  // of this route). Without this listener the address bar changes but the
  // rendered configurator does not, which is exactly the bug brief §36
  // flags as "browser back button during configuration".
  useEffect(() => {
    function onPopState() {
      const restored = applyUrlSelections(window.location.search);
      initialStepResolved.current = true;
      setStepIndex(furthestEnterable(stepsRef.current, restored));
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [applyUrlSelections]);

  // Every change re-fetches steps/options/price from the server. Never
  // computed locally — this is the entire point of §10.2.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getConfiguratorSnapshot(productSlug, selections, QUANTITY).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (result.ok) {
        setSnapshot(result.snapshot);
        // On the very first snapshot after a URL-restored refresh, resume at
        // the furthest step the restored selections actually reach, instead
        // of always landing back on step 1 with the answers merely intact.
        if (!initialStepResolved.current) {
          initialStepResolved.current = true;
          setStepIndex(furthestEnterable(result.snapshot.steps, selections));
        }
      }
    });
    const query = writeSelectionsToSearch(selections);
    router.replace(query.length > 0 ? `?${query}` : '?', { scroll: false });
    return () => {
      cancelled = true;
    };
  }, [selections, productSlug, router]);

  const steps = snapshot?.steps ?? [];
  stepsRef.current = steps;

  // A selection change can invalidate a downstream step's prerequisites — if
  // the customer is currently sitting past the furthest step still
  // reachable, pull them back rather than leaving them on a step whose
  // requirements no longer hold (§7.1: never silently keep an incompatible
  // state, but a step "going dark" under the customer is the same class of
  // problem for navigation as it is for a cleared selection).
  useEffect(() => {
    if (steps.length === 0) return;
    if (!isStepEnterable(steps, stepIndex, selections)) {
      setStepIndex(furthestEnterable(steps, selections));
    }
  }, [steps, stepIndex, selections]);

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

  if (steps.length === 0) {
    return loading ? (
      <CircularProgress size={24} />
    ) : (
      <Alert severity="error">{SITE.catalogueProductNotFoundPl}</Alert>
    );
  }

  const currentStep = steps[stepIndex] as StepCode;
  const canGoNext =
    stepIndex < steps.length - 1 && isStepEnterable(steps, stepIndex + 1, selections);
  const canGoBack = stepIndex > 0;
  const selectedInstallVariant =
    selections.installationVariant === null
      ? null
      : (options.installVariants.find((v) => v.code === selections.installationVariant) ?? null);

  return (
    <>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 72 }}>
      <Stepper nonLinear activeStep={stepIndex} alternativeLabel>
        {steps.map((step, index) => (
          <Step key={step} completed={isStepEnterable(steps, index + 1, selections)}>
            <StepButton
              disabled={!isStepEnterable(steps, index, selections)}
              onClick={() => setStepIndex(index)}
            >
              {STEP_LABEL[step]}
            </StepButton>
          </Step>
        ))}
      </Stepper>

      {clearedNotice !== null && (
        <Alert severity="info" onClose={() => setClearedNotice(null)}>
          {clearedNotice}
        </Alert>
      )}

      <div style={{ minHeight: 160 }}>
        {currentStep === 'DESIGN' && (
          <OptionStep
            title={STEP_LABEL.DESIGN}
            entries={snapshot?.availability.designs ?? []}
            selectedId={selections.designId}
            onSelect={(id) => setSelections((prev) => ({ ...prev, designId: id }))}
          />
        )}

        {currentStep === 'MATERIAL' && (
          <OptionStep
            title={STEP_LABEL.MATERIAL}
            entries={snapshot?.availability.materials ?? []}
            selectedId={selections.materialId}
            onSelect={selectMaterial}
          />
        )}

        {currentStep === 'FINISH' && (
          <OptionStep
            title={STEP_LABEL.FINISH}
            entries={snapshot?.availability.finishes ?? []}
            selectedId={selections.finishId}
            onSelect={(id) => setSelections((prev) => ({ ...prev, finishId: id }))}
          />
        )}

        {currentStep === 'INSTALLATION_VARIANT' && (
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
        )}

        {currentStep === 'THICKNESS' && (
          <OptionStep
            title={STEP_LABEL.THICKNESS}
            entries={snapshot?.availability.thicknesses ?? []}
            selectedId={selections.thicknessMm === null ? null : String(selections.thicknessMm)}
            onSelect={(id) => setSelections((prev) => ({ ...prev, thicknessMm: Number(id) }))}
          />
        )}

        {currentStep === 'SIZE' && (
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
        )}

        {currentStep === 'PERSONALIZATION' && (
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
        )}

        {currentStep === 'CUSTOM_UPLOAD' && (
          <Alert severity="info">{SITE.configuratorNoOptionsPl}</Alert>
        )}

        {currentStep === 'SUMMARY' && (
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
          />
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button disabled={!canGoBack} onClick={() => setStepIndex((i) => i - 1)}>
          {SITE.configuratorBackPl}
        </Button>
        {currentStep !== 'SUMMARY' && (
          <Button variant="contained" disabled={!canGoNext} onClick={() => setStepIndex((i) => i + 1)}>
            {SITE.configuratorNextPl}
          </Button>
        )}
      </div>
    </div>
    <StickyPriceBar snapshot={snapshot} loading={loading} />
    </>
  );
}

/**
 * Pinned to the viewport bottom on every step, not just the summary — so the
 * running price is always visible while configuring, the same pattern
 * Bazaar/NextMerce use for their PDP add-to-cart bar (this session's
 * redesign reference, `docs/HANDOVER.md` §9g). `position: fixed` rather than
 * `sticky`: the configurator's own content height varies a lot between
 * steps, and `sticky` only pins once the element would otherwise scroll past
 * its normal flow position — `fixed` is unconditional on both mobile and
 * desktop. The outer `<div>`'s `paddingBottom: 72` above keeps this from
 * covering the Wstecz/Dalej buttons.
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
 * option went.
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
        <ToggleButton
          key={entry.id}
          value={entry.id}
          disabled={!entry.isAvailable}
          title={entry.reason === null ? undefined : unavailabilityReasonMessage(entry.reason)}
        >
          {entry.namePl}
        </ToggleButton>
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

      <Button variant="contained" disabled={!canProceed} title={SITE.configuratorCartNotBuiltPl}>
        {SITE.configuratorCartNotBuiltPl}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function intOrNull(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

/**
 * The two halves of the URL <-> Selections mapping, kept next to each other
 * on purpose: a field added to one and not the other is exactly how a
 * refresh silently drops data.
 */
function readSelectionsFromSearch(search: string): Selections {
  const params = new URLSearchParams(search);
  return {
    designId: params.get('d'),
    customUploadId: null,
    materialId: params.get('m'),
    widthMm: intOrNull(params.get('w')),
    heightMm: intOrNull(params.get('h')),
    thicknessMm: intOrNull(params.get('t')),
    finishId: params.get('f'),
    installationVariant: params.get('i'),
    personalizationText: params.get('p'),
    fontId: params.get('ft'),
  };
}

function writeSelectionsToSearch(selections: Selections): string {
  const params = new URLSearchParams();
  if (selections.designId !== null) params.set('d', selections.designId);
  if (selections.materialId !== null) params.set('m', selections.materialId);
  if (selections.widthMm !== null) params.set('w', String(selections.widthMm));
  if (selections.heightMm !== null) params.set('h', String(selections.heightMm));
  if (selections.thicknessMm !== null) params.set('t', String(selections.thicknessMm));
  if (selections.finishId !== null) params.set('f', selections.finishId);
  if (selections.installationVariant !== null) params.set('i', selections.installationVariant);
  if (selections.personalizationText !== null && selections.personalizationText !== '') {
    params.set('p', selections.personalizationText);
  }
  if (selections.fontId !== null) params.set('ft', selections.fontId);
  return params.toString();
}

function furthestEnterable(steps: readonly StepCode[], selections: Selections): number {
  let furthest = 0;
  for (let index = 1; index < steps.length; index++) {
    if (!isStepEnterable(steps, index, selections)) break;
    furthest = index;
  }
  return furthest;
}
