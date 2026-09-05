/**
 * The Polish label for each configurator step.
 *
 * Its own module because three of the components ARCH-02 moved out of
 * `Configurator.tsx` read it, and a shared constant that lives inside one of
 * its own consumers is an import cycle waiting to happen.
 */

import { SITE } from '@/content/pl/site';
import type { StepCode } from '@/domain/configuration/steps';

export const STEP_LABEL: Record<StepCode, string> = {
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

/** Fixed at 1 - quantity belongs to the cart (P5), not the configurator. */
