'use client';

/*
  Extracted from `Configurator.tsx` for `docs/AI-CHECKLIST.md` ARCH-02, which
  finished on 2026-09-05. Moved verbatim - same bodies, same props, same
  behaviour - along seams that already existed. The state model stays in
  `Configurator.tsx`, which is what the item asks for.
*/

import { Alert, Button, Checkbox, CircularProgress, FormControlLabel, Typography } from '@mui/material';

import { SITE } from '@/content/pl/site';
import { COPY, dimensionMessage, feasibilityMessage, personalizationMessage } from '@/content/pl/messages';
import { formatPln } from '@/domain/money/money';
import type { FeasibilityCode } from '@/domain/feasibility/rules';
import type { Selections } from '@/domain/configuration/steps';
import type { ConfiguratorOptionData } from '@/server/configurator/resolve-options';
import type { ConfiguratorSnapshot } from '@/server/actions/configurator';
import type { PricingRejectionCode } from '@/server/configurator/validate-and-price';

export function SummaryStep({
  snapshot,
  selections,
  unavailableSelection,
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
  /** UX-21 - computed by the parent so this panel and the sticky bar cannot disagree. */
  readonly unavailableSelection: keyof Selections | null;
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
  readonly addToCartError: PricingRejectionCode | null;
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
    unavailableSelection === null &&
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

      {/* 2026-08-29 second follow-up, owner feedback: "dymki" (alert
          bubbles) shouldn't carry information that isn't actually a
          reactive per-selection warning. NATURAL_VARIATION is true for
          every selection of a natural-variable material regardless of size
          - real product specification, not something the customer needs
          to acknowledge or react to - so it renders as a plain caption
          below instead of a boxed `Alert`. Everything else here (line
          width, detail spacing, and anything requiring acknowledgement)
          stays a real `Alert`: those genuinely depend on the current
          material/size/design combination and can genuinely block
          production. */}
      {pricing.feasibility
        .filter((finding) => finding.code !== 'NATURAL_VARIATION')
        .map((finding) => (
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
      {pricing.feasibility
        .filter((finding) => finding.code === 'NATURAL_VARIATION')
        .map((finding) => (
          <Typography key={finding.code} variant="caption" color="text.secondary">
            {feasibilityMessage(finding)}
          </Typography>
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

      {unavailableSelection === null ? (
        <div style={{ font: 'var(--mui-font-h4)' }}>
          {SITE.configuratorPriceLabelPl}: {formatPln(pricing.priceBreakdown.unitGrossGrosze)}
        </div>
      ) : (
        /*
          No price at all, rather than a struck-through or greyed one. The
          figure is real arithmetic for a configuration the shop will not
          sell, and showing it - in any styling - is the thing BUG-02 was
          about: never put a number in front of a customer that you are not
          prepared to honour.
        */
        <Alert severity="warning">{SITE.configuratorOptionUnavailablePl}</Alert>
      )}

      {!isComplete && <Alert severity="warning">{SITE.configuratorBlockedPl}</Alert>}

      {addToCartError !== null && (
        <Alert severity={addToCartError === 'OPTION_UNAVAILABLE' ? 'warning' : 'error'}>
          {addToCartError === 'OPTION_UNAVAILABLE'
            ? SITE.configuratorOptionUnavailablePl
            : SITE.configuratorAddToCartErrorPl}
        </Alert>
      )}

      <Button variant="contained" disabled={!canProceed || addToCartPending} onClick={onAddToCart} sx={{ alignSelf: 'flex-start' }}>
        {isEditMode ? SITE.configuratorSaveChangesPl : SITE.configuratorAddToCartPl}
      </Button>
    </div>
  );
}
