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
import { formatMmAsCentimetres, parseCentimetresToMm } from '@/domain/text/numeric-input';
import {
  dimensionMessage,
  feasibilityMessage,
  numericInputMessage,
  unavailabilityReasonMessage,
} from '@/content/pl/messages';
import { SITE } from '@/content/pl/site';
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
  readonly dimensionEnvelope: {
    readonly minWidthMm: number;
    readonly maxWidthMm: number;
    readonly minHeightMm: number;
    readonly maxHeightMm: number;
  };
};

export function Configurator({ productSlug, options, dimensionEnvelope }: ConfiguratorProps) {
  const router = useRouter();
  const [selections, setSelections] = useState<Selections>(EMPTY_SELECTIONS);
  const [stepIndex, setStepIndex] = useState(0);
  const [snapshot, setSnapshot] = useState<ConfiguratorSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [acknowledged, setAcknowledged] = useState<ReadonlySet<FeasibilityCode>>(new Set());
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
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
          <Alert severity="info">{SITE.configuratorPersonalizationUnavailablePl}</Alert>
        )}

        {currentStep === 'CUSTOM_UPLOAD' && (
          <Alert severity="info">{SITE.configuratorNoOptionsPl}</Alert>
        )}

        {currentStep === 'SUMMARY' && (
          <SummaryStep
            snapshot={snapshot}
            selections={selections}
            acknowledged={acknowledged}
            onAcknowledge={(code, value) =>
              setAcknowledged((prev) => {
                const next = new Set(prev);
                if (value) next.add(code);
                else next.delete(code);
                return next;
              })
            }
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

function SummaryStep({
  snapshot,
  acknowledged,
  onAcknowledge,
  isComplete,
}: {
  readonly snapshot: ConfiguratorSnapshot | null;
  readonly selections: Selections;
  readonly acknowledged: ReadonlySet<FeasibilityCode>;
  readonly onAcknowledge: (code: FeasibilityCode, value: boolean) => void;
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

  const outstandingAcknowledgements = pricing.feasibility.filter(
    (finding) => finding.requiresAcknowledgement && !acknowledged.has(finding.code),
  );
  const canProceed = isComplete && !pricing.blockingError && outstandingAcknowledgements.length === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
    fontId: null,
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
