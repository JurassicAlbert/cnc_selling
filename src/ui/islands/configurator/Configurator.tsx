'use client';

/**
 * The configurator - ARCHITECTURE.md §7.1's step machine, wired to real
 * data. The first real MUI client island in this codebase (see
 * `docs/HANDOVER.md` §9e for why `ThemeRegistry` was pulled out of the root
 * layout specifically so this could exist without taxing every other page).
 *
 * **2026-08-28 redesign, direct owner feedback**: "wzory powinny być w
 * produkcie do wyboru tak jak kolor koszulki, tak samo typ drewna i sposób
 * zachowania" (patterns/wood type/finish should be choosable in the product
 * like a t-shirt color) - this used to be a `Stepper`-gated wizard showing
 * exactly one step at a time behind "Wstecz"/"Dalej". Every applicable
 * section rendered simultaneously on one page instead, no step index, no
 * `Stepper`/`StepButton` at all.
 *
 * **2026-08-29 follow-up, direct owner feedback**: DESIGN/MATERIAL/FINISH/
 * SIZE moved again - out of the accordion entirely into a compact MUI
 * `Breadcrumbs` trail at the top ("Wzór: … › Materiał: … › Wymiary: …"),
 * each crumb opening a `Menu` (DESIGN/MATERIAL/FINISH - a real dropdown
 * list) or a `Popover` (SIZE - two plain fields). Only DESIGN's dropdown
 * shows an image (the pattern's own transparent-PNG-style artwork, shown
 * bare with no card/circle behind it - "pattern should be more like png
 * without background not some div block"); MATERIAL/FINISH are text-only
 * lists - "you don't need to visualize the wood size or look". THICKNESS/
 * INSTALLATION_VARIANT/PERSONALIZATION/CUSTOM_UPLOAD stay as accordion
 * bands below (`ConfigSection`) - none of them are a simple "pick one from
 * a photographed list" the way the four breadcrumb steps are.
 *
 * The domain-level narrowing this used to lean on step-locking for turns
 * out to already handle "no forced order" correctly on its own:
 * `resolve-options.ts`'s `ResolvedOptionAvailability` is recomputed fresh
 * from whatever `selections` currently holds on every change - before a
 * material is picked, `finishes` is genuinely empty (nothing to enumerate,
 * a material's own join table is the only source of which finishes apply),
 * which the existing `OptionStep`/`TextMenuItem` already renders as an
 * honest "not available yet" notice with zero new code. DESIGN/MATERIAL
 * entries were already individually gated (`isAvailable`/`reason` per
 * entry, not per step) - that mechanism is exactly what a real dropdown
 * needs, unchanged.
 *
 * **2026-08-29 second follow-up, direct owner feedback**: "The price for
 * the product should be clear, no waiting for configure... we have price" -
 * `selections` no longer starts at `EMPTY_SELECTIONS`. `computeDefaultSelections`
 * fills DESIGN/MATERIAL/FINISH/SIZE with the product's own real first
 * catalogue entries on mount (see its own doc comment), so a price is
 * already in flight on first render; changing material or finish afterwards
 * re-fetches and updates it the same way any other change always has -
 * "no waiting for configure" turned out to be a defaults problem, not a
 * new mechanism. SIZE itself is now picked from a real `ProductPresetSize`
 * dropdown (owner: "realne dostępne rozmiary predefiniowane, a nie
 * wpisywane przez klienta") instead of typed centimetres, except for
 * `requiresExactSize` products, which keep the typed `Popover` - an exact,
 * per-installation measurement is the entire point of that flag, not a UI
 * preference to design around. `ConfiguratorPreview` (the material+design
 * photo composite) is gone entirely - owner: "nie pokazujemy żadnych
 * symulacji materiałów, rozmiarów" (no material/size simulations) - the
 * product's own real photography already shows what the customer gets.
 *
 * State ownership, deliberately split three ways (unchanged by the
 * redesign above - this is presentation-only, no state/domain logic moved):
 *   - `selections`  - what the customer has picked. Local React state, and
 *     the URL query string, so refresh and back/forward both work (brief
 *     §36).
 *   - `snapshot`    - steps, resolved options, price, feasibility. NEVER
 *     computed here. Every change re-requests it from the
 *     `getConfiguratorSnapshot` Server Action (§10.2: prices are
 *     server-authoritative, full stop).
 *
 * Not yet built, honestly: quantity (belongs to the cart, P5).
 */

import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import CheckIcon from '@mui/icons-material/Check';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import Link from '@mui/material/Link';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Popover from '@mui/material/Popover';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';

import {
  checkConfigurationComplete,
  isStepSatisfied,
  type ProductTypeCode,
  type Selections,
  type StepCode,
} from '@/domain/configuration/steps';
import type { FeasibilityCode } from '@/domain/feasibility/rules';
import { formatPln } from '@/domain/money/money';
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
import { DisabledExplanation } from '@/ui/primitives/DisabledExplanation';
import { Text } from '@/ui/primitives/Text';
import type {
  ConfiguratorOptionData,
  OptionAvailability,
} from '@/server/configurator/resolve-options';
// A pure module (`domain/compatibility` and plain reshaping - no Prisma, no
// Node built-ins), so it is safe to import as a real value into this client
// island. That is what lets the default selection be filtered by exactly the
// same rules the server enforces, rather than by a second copy of them.
import { findUnavailableSelection } from '@/server/configurator/resolve-options';
import { getConfiguratorSnapshot } from '@/server/actions/configurator';
import type { ConfiguratorSnapshot } from '@/server/actions/configurator';
import { addToCart, updateCartItemConfiguration } from '@/server/actions/cart';
import type { PricingRejectionCode } from '@/server/configurator/validate-and-price';
import type { OwnedCustomerDesignListItem } from '@/server/repositories/customer-designs';
import type { SwatchEntry } from './ImageSwatchGroup';
import { readSelectionsFromSearch, writeSelectionsToSearch } from './selections-url';
import { cmInputFor, computeDefaultSelections, mergeWithDefaults } from './selections';
import { CustomUploadStep } from './CustomUploadStep';
import { SizeFields } from './SizeFields';
import { StickyPriceBar } from './StickyPriceBar';

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

/** Fixed at 1 - quantity belongs to the cart (P5), not the configurator. */
const QUANTITY = 1;

/**
 * Steps rendered as breadcrumb crumbs (dropdown Menu/Popover), not
 * accordion bands. Excluded from `expandedStep`'s "open the first
 * unsatisfied step" search - an accordion band auto-opening for a step that
 * has no band any more would open nothing and silently do nothing.
 */
const BREADCRUMB_STEPS: readonly StepCode[] = ['DESIGN', 'MATERIAL', 'FINISH', 'SIZE'];

/**
 * 2026-08-29, owner feedback, verbatim: "sekcja wzorów jest do dupy... nie
 * usuwajmy tej funkcji zostawmy na przyszłość - tylko wyłącz totalnie z
 * wizualizacji i ui opcje wybierania wzorów w produktach" (the patterns
 * section isn't working out - don't remove the feature, leave it for the
 * future, just turn pattern selection off entirely from the UI). Every
 * DESIGN-related mechanism stays real and working underneath (the crumb
 * component, `computeDefaultSelections` still picks a real default design
 * so WALL_ART-style pricing keeps working, the domain step machine is
 * untouched) - flipping this one flag back to `true` is the entire
 * re-enable path, no further code changes needed.
 */
const PATTERN_SELECTION_ENABLED = false;

type ConfiguratorProps = {
  readonly productSlug: string;
  /** §5's step list is keyed on this, and  needs it to avoid defaulting a field the type has no step for (BUG-06). A plain string, so it crosses the Server->Client boundary safely. */
  readonly productTypeCode: ProductTypeCode;
  readonly options: ConfiguratorOptionData;
  /** „Produkt obejmuje blat. Nogi nie są w zestawie.” and similar - shown in the summary too (§12). */
  readonly materialNotesPl: string | null;
  /** Floor/panel products: no preset sizes, and a mandatory acknowledgement in the summary (§11). */
  readonly requiresExactSize: boolean;
  readonly dimensionEnvelope: {
    readonly minWidthMm: number;
    readonly maxWidthMm: number;
    readonly minHeightMm: number;
    readonly maxHeightMm: number;
  };
  /** The "Preview as customer" admin feature's `?podglad=1` flag, passed down so every `getConfiguratorSnapshot` call (not just the page's own initial SSR fetch) can keep bypassing the `isActive` gate. Re-verified server-side on every call - see `getConfiguratorSnapshot`'s own doc comment. */
  readonly isPreview?: boolean;
  /** P9 phase 2: the customer's own previously-uploaded designs, offered as a "reuse" alternative to uploading fresh on `CUSTOM_UPLOAD`. Server-fetched once on the product page - always passed, even for products with no such step, since it's cheap and simpler than a per-product-type check at the call site. */
  readonly savedDesigns?: readonly OwnedCustomerDesignListItem[];
};

export function Configurator({
  productSlug,
  productTypeCode,
  options,
  materialNotesPl,
  requiresExactSize,
  dimensionEnvelope,
  isPreview = false,
  savedDesigns = [],
}: ConfiguratorProps) {
  const router = useRouter();
  // 2026-08-29, owner feedback, verbatim: "The price for the product should
  // be clear, no waiting for configure... we have price" - the page must
  // show a real price the moment it loads, not an empty "Podaj wymiary"
  // placeholder. `computeDefaultSelections` fills every dimension with the
  // product's own real first catalogue entry (first design, first material,
  // that material's first available finish, its first preset size) instead
  // of starting from `EMPTY_SELECTIONS` - the snapshot effect below then
  // fires on mount exactly as it does on any later change, so the very
  // first render already has a real price in flight.
  const [selections, setSelections] = useState<Selections>(() =>
    computeDefaultSelections(options, productTypeCode),
  );
  const [snapshot, setSnapshot] = useState<ConfiguratorSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [acknowledged, setAcknowledged] = useState<ReadonlySet<FeasibilityCode>>(new Set());
  const [exactSizeAcknowledged, setExactSizeAcknowledged] = useState(false);
  const [clearedNotice, setClearedNotice] = useState<string | null>(null);
  const [widthInput, setWidthInput] = useState(() => cmInputFor(selections.widthMm));
  const [heightInput, setHeightInput] = useState(() => cmInputFor(selections.heightMm));
  const [widthError, setWidthError] = useState<string | null>(null);
  const [heightError, setHeightError] = useState<string | null>(null);
  const [editConfigurationId, setEditConfigurationId] = useState<string | null>(null);
  const [addToCartPending, setAddToCartPending] = useState(false);
  // The server's own rejection code, so the message can name what went
  // wrong (`docs/REVIEW-DETAILED.md` SEC-03) instead of one generic line.
  const [addToCartError, setAddToCartError] = useState<PricingRejectionCode | null>(null);
  // 2026-08-28, owner feedback: "wybiera się poprzez kliknięcie na band z
  // nazwą" (you select by clicking a band with the name) - each section is
  // a real MUI `Accordion`, one open at a time. `null` means every section
  // is collapsed (nothing needs the customer's attention right now, or
  // everything is already filled in).
  const [expandedStep, setExpandedStep] = useState<StepCode | null>(null);
  const expandedStepInitialized = useRef(false);
  const hydrated = useRef(false);
  // 2026-08-29, owner feedback: DESIGN/MATERIAL/FINISH/SIZE moved out of the
  // accordion entirely into a compact MUI `Breadcrumbs` trail ("Wzór: ... ›
  // Materiał: ... › Wymiary: ..."), each crumb opening a `Menu` (DESIGN/
  // MATERIAL/FINISH - a real dropdown list, not an image-swatch grid) or a
  // `Popover` (SIZE - two plain fields, no slider: "you don't need to
  // visualize the wood size or look"). One shared anchor/open-step pair
  // covers all four, since only one can be open at a time.
  const [crumbAnchor, setCrumbAnchor] = useState<HTMLElement | null>(null);
  const [openCrumbStep, setOpenCrumbStep] = useState<StepCode | null>(null);
  const openCrumb = useCallback((step: StepCode, anchor: HTMLElement) => {
    setCrumbAnchor(anchor);
    setOpenCrumbStep(step);
  }, []);
  const closeCrumb = useCallback(() => {
    setCrumbAnchor(null);
    setOpenCrumbStep(null);
  }, []);

  const applyUrlSelections = useCallback(
    (search: string) => {
      const fromUrl = readSelectionsFromSearch(search);
      const restored = mergeWithDefaults(fromUrl, computeDefaultSelections(options, productTypeCode));
      setSelections(restored);
      setWidthInput(cmInputFor(restored.widthMm));
      setHeightInput(cmInputFor(restored.heightMm));
      setWidthError(null);
      setHeightError(null);
      return restored;
    },
    [options, productTypeCode],
  );

  // Hydrate from the URL exactly once, on mount, so a refresh or a shared
  // link resumes where the customer left off (brief §36).
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    applyUrlSelections(window.location.search);
    // A cart item's own "Edytuj" link sets this - see src/app/(shop)/koszyk.
    // Read once, at mount: switching cart items to edit is always a fresh
    // page load, never something that changes mid-session.
    setEditConfigurationId(new URLSearchParams(window.location.search).get('edit'));
  }, [applyUrlSelections]);

  // The browser's own Back/Forward buttons change the URL without any of
  // our own effects running - `router.replace` never pushes a history
  // entry, so this fires only when navigation actually happened elsewhere
  // (leaving and returning to this URL, or Next reusing a cached instance
  // of this route). Without this listener the address bar changes but the
  // rendered configurator does not, which is exactly the bug brief §36
  // flags as "browser back button during configuration". Every section is
  // always visible now, so there is no step index to restore alongside the
  // selections - just the selections themselves.
  useEffect(() => {
    function onPopState() {
      applyUrlSelections(window.location.search);
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [applyUrlSelections]);

  // Every change re-fetches steps/options/price from the server. Never
  // computed locally - this is the entire point of §10.2.
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
    // the only owner of the URL - the "Preview as customer" admin feature
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

  /*
    UX-21. Whether the current selection names something the shop no longer
    offers - computed once here, for the two places that show a price.

    SEC-03 made the write path refuse such a configuration, and say so
    clearly, but only after the customer presses the button and only after
    they have already been shown a real price for it. Someone on a stale
    link, or holding a saved project after staff retired a pattern, saw
    "Cena: 709,16 zl" for something unbuyable. `getConfiguratorSnapshot`
    still prices it, deliberately: it resolves the design by map lookup and
    consults availability separately, so the figure it returns is arithmetic
    about a configuration nobody will be sold.

    `snapshot.options` is already the resolved, currently-selectable set, so
    the answer needs no extra request. `findUnavailableSelection` is the same
    function the write path uses: SEC-03 happened because the picker's rules
    and the gate's rules were two separate pieces of code that disagreed, so
    this one deliberately is not a second implementation.

    Computed in the parent rather than in `SummaryStep`, where it started.
    That was half a fix - the sticky bar is a second price surface, pinned to
    the bottom of every screen, and it went on showing the figure while the
    panel above it said the variant was withdrawn. Found on the browser
    check, 2026-09-04. One value, both surfaces, no way for them to drift.

    A null snapshot means nothing has been resolved yet, so there is nothing
    to contradict - the bar shows "Obliczanie ceny…" on its own.
  */
  const unavailableSelection =
    snapshot === null ? null : findUnavailableSelection(snapshot.options, selections);

  // Open the first section once the real step list is known - nothing to
  // open before that (would flash the wrong band on a slow connection).
  // biome-ignore lint/correctness/useExhaustiveDependencies: deliberately only re-runs once real steps arrive, not on every selections change
  useEffect(() => {
    if (steps.length === 0 || expandedStepInitialized.current) return;
    expandedStepInitialized.current = true;
    const firstUnsatisfied = steps.find(
      (step) => step !== 'SUMMARY' && !BREADCRUMB_STEPS.includes(step) && !isStepSatisfied(step, selections),
    );
    setExpandedStep(firstUnsatisfied ?? null);
  }, [steps]);

  // After a swatch/click-based selection (DESIGN/MATERIAL/FINISH/THICKNESS/
  // INSTALLATION_VARIANT/SIZE-once-both-dimensions-are-set), automatically
  // open the next still-empty band - "wybiera się poprzez kliknięcie na
  // band z nazwą": one click (or one completed field pair) both selects the
  // option and hands the customer straight to what's next, without forcing
  // a fixed order (every band can still be opened by hand at any time; this
  // is a convenience, not a gate - `isStepEnterable` no longer restricts
  // anything, same as the previous pass already established).
  // PERSONALIZATION (optional free text) deliberately never auto-advances -
  // it's the last real step before SUMMARY and there is nothing useful to
  // jump to next.
  const advanceExpandedStep = useCallback(
    (afterStep: StepCode, updatedSelections: Selections) => {
      const index = steps.indexOf(afterStep);
      const next = steps
        .slice(index + 1)
        .find((step) => step !== 'SUMMARY' && !BREADCRUMB_STEPS.includes(step) && !isStepSatisfied(step, updatedSelections));
      setExpandedStep(next ?? null);
    },
    [steps],
  );

  // Each field commits independently on its own blur. Committing both
  // together on either blur was a real bug: tabbing from width to height
  // blurred width while height was still empty, which force-set a spurious
  // "Podaj wymiar" error on a field the customer had not even reached yet.
  // Auto-advance only fires once BOTH dimensions are committed and valid
  // (`isStepSatisfied('SIZE', ...)`) - whichever field happens to complete
  // the pair, not tied to a fixed width-then-height order (the customer may
  // fill either first).
  const commitWidth = useCallback(() => {
    const width = parseCentimetresToMm(widthInput);
    setWidthError(width.ok ? null : numericInputMessage(width.code));
    const next = { ...selections, widthMm: width.ok ? width.mm : null };
    setSelections(next);
    if (isStepSatisfied('SIZE', next)) {
      advanceExpandedStep('SIZE', next);
      closeCrumb();
    }
  }, [widthInput, selections, advanceExpandedStep, closeCrumb]);

  const commitHeight = useCallback(() => {
    const height = parseCentimetresToMm(heightInput);
    setHeightError(height.ok ? null : numericInputMessage(height.code));
    const next = { ...selections, heightMm: height.ok ? height.mm : null };
    setSelections(next);
    if (isStepSatisfied('SIZE', next)) {
      advanceExpandedStep('SIZE', next);
      closeCrumb();
    }
  }, [heightInput, selections, advanceExpandedStep, closeCrumb]);

  // Clearing a dependent selection is only correct when it is ACTUALLY no
  // longer compatible - never a blanket clear on every change - and the
  // customer is told why (§7.1: "never silently keep an incompatible
  // state... the customer is told, in Polish, that it was cleared and
  // why"). Checked against the real catalogue data already on the page
  // (`options`), not guessed.
  const selectMaterial = useCallback(
    (materialId: string) => {
      if (selections.finishId === null) {
        setSelections({ ...selections, materialId });
        closeCrumb();
        return;
      }
      const stillOffered = options.materials
        .find((material) => material.id === materialId)
        ?.finishes.some((finish) => finish.id === selections.finishId && finish.isAvailable);
      if (stillOffered) {
        setSelections({ ...selections, materialId });
        closeCrumb();
        return;
      }
      setClearedNotice(SITE.configuratorClearedFinishPl);
      setSelections({ ...selections, materialId, finishId: null });
      closeCrumb();
    },
    [options, selections, closeCrumb],
  );

  const selectInstallationVariant = useCallback(
    (code: string) => {
      if (selections.thicknessMm === null) {
        const next = { ...selections, installationVariant: code };
        setSelections(next);
        advanceExpandedStep('INSTALLATION_VARIANT', next);
        return;
      }
      const cap = options.installVariants.find((variant) => variant.code === code)?.maxThicknessMm;
      if (cap === null || cap === undefined || selections.thicknessMm <= cap) {
        const next = { ...selections, installationVariant: code };
        setSelections(next);
        advanceExpandedStep('INSTALLATION_VARIANT', next);
        return;
      }
      setClearedNotice(SITE.configuratorClearedThicknessPl);
      const next = { ...selections, installationVariant: code, thicknessMm: null };
      setSelections(next);
      advanceExpandedStep('INSTALLATION_VARIANT', next);
    },
    [options, selections, advanceExpandedStep],
  );

  // Re-validates and re-prices server-side either way - §10.2 applies to
  // the cart exactly as it applies to every price shown during
  // configuration. `editConfigurationId` decides which of the two real Server
  // Actions runs; the UI difference is just the button label.
  const handleAddToCart = useCallback(async () => {
    setAddToCartPending(true);
    setAddToCartError(null);
    const result =
      editConfigurationId === null
        ? await addToCart(productSlug, selections, [...acknowledged], QUANTITY)
        : await updateCartItemConfiguration(editConfigurationId, productSlug, selections, [...acknowledged]);
    if (result.ok) {
      router.push('/koszyk');
      return;
    }
    setAddToCartPending(false);
    // `OPTION_UNAVAILABLE` gets its own message rather than the generic
    // one (`docs/REVIEW-DETAILED.md` SEC-03): it means we withdrew
    // something after this configuration was saved or shared, and "sprawdź
    // wybory powyżej" sends the customer hunting through six choices for a
    // problem that is ours.
    setAddToCartError(result.code);
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

  // DESIGN is the one breadcrumb dropdown that shows real artwork (owner:
  // "pattern should be more like png without background") - the transparent
  // pattern SVGs, shown bare with no card/circle behind them (see the
  // `<img>` inside `DesignMenuItem` below). MATERIAL/FINISH deliberately
  // stay text-only lists - owner: "you don't need to visualize the wood
  // size or look" - so they use the plain `OptionAvailability` arrays
  // directly, the same shape `OptionStep`/THICKNESS already uses, no
  // image lookup needed.
  const designSwatches: readonly SwatchEntry[] = (snapshot?.availability.designs ?? []).map((entry) =>
    toSwatchEntry(entry, options.designs.find((d) => d.id === entry.id)?.previewUrl ?? ''),
  );
  const materialOptions = snapshot?.availability.materials ?? [];
  const finishOptions = snapshot?.availability.finishes ?? [];

  const selectedThicknessLabel =
    selections.thicknessMm === null
      ? null
      : (snapshot?.availability.thicknesses.find((t) => t.id === String(selections.thicknessMm))?.namePl ?? null);
  const sizeLabel =
    selections.widthMm !== null && selections.heightMm !== null
      ? `${formatMmAsCentimetres(selections.widthMm)}×${formatMmAsCentimetres(selections.heightMm)} cm`
      : null;

  const crumbEntries: readonly { readonly step: StepCode; readonly label: string; readonly value: string | null }[] = [
    ...(PATTERN_SELECTION_ENABLED && steps.includes('DESIGN')
      ? [{ step: 'DESIGN' as const, label: STEP_LABEL.DESIGN, value: selectedLabelOf(designSwatches, selections.designId) }]
      : []),
    ...(steps.includes('MATERIAL')
      ? [{ step: 'MATERIAL' as const, label: STEP_LABEL.MATERIAL, value: selectedMaterial?.namePl ?? null }]
      : []),
    ...(steps.includes('FINISH')
      ? [
          {
            step: 'FINISH' as const,
            label: STEP_LABEL.FINISH,
            value: finishOptions.find((f) => f.id === selections.finishId)?.namePl ?? null,
          },
        ]
      : []),
    ...(steps.includes('SIZE') ? [{ step: 'SIZE' as const, label: STEP_LABEL.SIZE, value: sizeLabel }] : []),
  ];

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 72 }}>
        {clearedNotice !== null && (
          <Alert severity="info" onClose={() => setClearedNotice(null)}>
            {clearedNotice}
          </Alert>
        )}

        {(steps.includes('DESIGN') || steps.includes('MATERIAL') || steps.includes('FINISH') || steps.includes('SIZE')) && (
          <>
            {/* 2026-08-29 second follow-up, owner feedback: not MUI
                `Breadcrumbs` (a navigation-trail widget, chevron separators
                implying "you are here in a hierarchy") - each selector is
                its own separate, elevated, rounded-rectangle `Paper` chip
                with real margin between them, not one unified block - the
                same low-profile surface a `Snackbar` uses, per item, rather
                than one transient auto-hiding message ("the snackbar should
                work like list"). `flexWrap: 'wrap'` still applies - on a
                narrow viewport the row spills onto a second line instead of
                clipping the last chip off-screen. */}
            <Box
              aria-label={SITE.configuratorHeadingPl}
              sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}
            >
              {crumbEntries.map((entry) => (
                <Paper key={entry.step} elevation={2} sx={{ borderRadius: 3, px: 2, py: 1 }}>
                  <CrumbLink label={entry.label} value={entry.value} onOpen={(el) => openCrumb(entry.step, el)} />
                </Paper>
              ))}
            </Box>

            {PATTERN_SELECTION_ENABLED && (
              <Menu anchorEl={crumbAnchor} open={openCrumbStep === 'DESIGN'} onClose={closeCrumb}>
                {designSwatches.length === 0 ? (
                  <MenuItem disabled>{SITE.configuratorNoOptionsPl}</MenuItem>
                ) : (
                  designSwatches.map((entry) => (
                    <DesignMenuItem
                      key={entry.id}
                      entry={entry}
                      selected={entry.id === selections.designId}
                      onSelect={(id) => {
                        setSelections({ ...selections, designId: id });
                        closeCrumb();
                      }}
                    />
                  ))
                )}
              </Menu>
            )}

            <Menu anchorEl={crumbAnchor} open={openCrumbStep === 'MATERIAL'} onClose={closeCrumb}>
              {materialOptions.length === 0 ? (
                <MenuItem disabled>{SITE.configuratorNoOptionsPl}</MenuItem>
              ) : (
                materialOptions.map((entry) => (
                  <TextMenuItem
                    key={entry.id}
                    entry={entry}
                    selected={entry.id === selections.materialId}
                    onSelect={selectMaterial}
                  />
                ))
              )}
            </Menu>

            <Menu anchorEl={crumbAnchor} open={openCrumbStep === 'FINISH'} onClose={closeCrumb}>
              {finishOptions.length === 0 ? (
                <MenuItem disabled>{SITE.configuratorNoOptionsPl}</MenuItem>
              ) : (
                finishOptions.map((entry) => (
                  <TextMenuItem
                    key={entry.id}
                    entry={entry}
                    selected={entry.id === selections.finishId}
                    onSelect={(id) => {
                      setSelections({ ...selections, finishId: id });
                      closeCrumb();
                    }}
                  />
                ))
              )}
            </Menu>

            {/* 2026-08-29, owner feedback: real available sizes, predefined,
                rather than typed by the customer - a real dropdown of the
                product's own `ProductPresetSize` rows, same interaction as
                DESIGN/MATERIAL/FINISH. Falls back to the typed `Popover`
                only when the product genuinely has no preset list -
                `requiresExactSize` floor elements never get presets seeded
                (an exact, per-installation measurement is the whole point
                of that flag), and any other product that simply has none
                yet. */}
            {options.presetSizes.length > 0 ? (
              <Menu anchorEl={crumbAnchor} open={openCrumbStep === 'SIZE'} onClose={closeCrumb}>
                {options.presetSizes.map((preset) => (
                  <MenuItem
                    key={preset.id}
                    selected={selections.widthMm === preset.widthMm && selections.heightMm === preset.heightMm}
                    onClick={() => {
                      const next = { ...selections, widthMm: preset.widthMm, heightMm: preset.heightMm };
                      setSelections(next);
                      setWidthInput(cmInputFor(preset.widthMm));
                      setHeightInput(cmInputFor(preset.heightMm));
                      setWidthError(null);
                      setHeightError(null);
                      closeCrumb();
                    }}
                  >
                    <span style={{ flex: 1 }}>{preset.labelPl}</span>
                    {selections.widthMm === preset.widthMm && selections.heightMm === preset.heightMm && (
                      <CheckIcon fontSize="small" color="secondary" sx={{ ml: 1.5 }} />
                    )}
                  </MenuItem>
                ))}
              </Menu>
            ) : (
              <Popover
                anchorEl={crumbAnchor}
                open={openCrumbStep === 'SIZE'}
                onClose={closeCrumb}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
              >
                <Box sx={{ p: 2.5, minWidth: 240 }}>
                  <SizeFields
                    widthInput={widthInput}
                    heightInput={heightInput}
                    widthError={widthError}
                    heightError={heightError}
                    dimensionEnvelope={dimensionEnvelope}
                    onWidthChange={setWidthInput}
                    onHeightChange={setHeightInput}
                    onCommitWidth={commitWidth}
                    onCommitHeight={commitHeight}
                    dimensionIssues={snapshot?.pricing.status === 'dimension_invalid' ? snapshot.pricing.issues : []}
                  />
                </Box>
              </Popover>
            )}
          </>
        )}

        {steps.includes('THICKNESS') && (
          <ConfigSection
            step="THICKNESS"
            heading={STEP_LABEL.THICKNESS}
            selectedLabel={selectedThicknessLabel}
            expanded={expandedStep === 'THICKNESS'}
            onToggle={() => setExpandedStep((prev) => (prev === 'THICKNESS' ? null : 'THICKNESS'))}
          >
            <OptionStep
              title={STEP_LABEL.THICKNESS}
              entries={snapshot?.availability.thicknesses ?? []}
              selectedId={selections.thicknessMm === null ? null : String(selections.thicknessMm)}
              onSelect={(id) => {
                const next = { ...selections, thicknessMm: Number(id) };
                setSelections(next);
                advanceExpandedStep('THICKNESS', next);
              }}
            />
          </ConfigSection>
        )}

        {steps.includes('INSTALLATION_VARIANT') && (
          <ConfigSection
            step="INSTALLATION_VARIANT"
            heading={STEP_LABEL.INSTALLATION_VARIANT}
            selectedLabel={selectedInstallVariant?.namePl ?? null}
            expanded={expandedStep === 'INSTALLATION_VARIANT'}
            onToggle={() => setExpandedStep((prev) => (prev === 'INSTALLATION_VARIANT' ? null : 'INSTALLATION_VARIANT'))}
          >
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
                  {/* biome-ignore lint/performance/noImgElement: placeholder SVGs get nothing from next/image's raster pipeline - same as Card.tsx */}
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

        {/* 2026-08-29 second follow-up, owner feedback: hidden entirely
            when the product has no real personalization configured - the
            step being nominally present on this product TYPE
            (`stepsForProductType`) doesn't mean this specific product's own
            `PersonalizationSpec` actually exists/`isEnabled`. Showing a
            disabled stub for a feature the product will never actually get
            would be advertising something false, not "coming soon". */}
        {steps.includes('PERSONALIZATION') && snapshot?.personalization != null && (
          <PersonalizationStub maxCharacters={snapshot.personalization.maxCharacters} />
        )}

        {steps.includes('CUSTOM_UPLOAD') && (
          <ConfigSection
            step="CUSTOM_UPLOAD"
            heading={STEP_LABEL.CUSTOM_UPLOAD}
            selectedLabel={selections.customUploadId !== null ? SITE.configuratorUploadDoneLabelPl : null}
            expanded={expandedStep === 'CUSTOM_UPLOAD'}
            onToggle={() => setExpandedStep((prev) => (prev === 'CUSTOM_UPLOAD' ? null : 'CUSTOM_UPLOAD'))}
          >
            <CustomUploadStep
              customerDesignId={selections.customUploadId}
              savedDesigns={savedDesigns}
              onUploaded={(customerDesignId) => {
                const next = { ...selections, customUploadId: customerDesignId };
                setSelections(next);
                advanceExpandedStep('CUSTOM_UPLOAD', next);
              }}
            />
          </ConfigSection>
        )}

        <div>
          <Typography variant="h6" component="h3" sx={{ mb: 1.5 }}>
            {STEP_LABEL.SUMMARY}
          </Typography>
          <SummaryStep
            snapshot={snapshot}
            selections={selections}
            unavailableSelection={unavailableSelection}
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
        </div>
      </div>
      <StickyPriceBar snapshot={snapshot} loading={loading} unavailableSelection={unavailableSelection} />
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
 * One crumb of the top breadcrumb trail - "Wzór" when nothing is picked
 * yet, "Wzór: Wzór podstawowy" once it is, the same "Colour: Blue" pattern
 * the accordion bands already used. A real MUI `Link` styled as a button
 * (not a navigation link - nothing here changes the URL), so it is a real
 * `<button>` under the hood: keyboard-focusable, and exactly what
 * `getByRole('button', ...)` finds in the e2e suite.
 */
function CrumbLink({
  label,
  value,
  onOpen,
}: {
  readonly label: string;
  readonly value: string | null;
  readonly onOpen: (anchor: HTMLElement) => void;
}) {
  return (
    <Link
      component="button"
      type="button"
      underline="hover"
      onClick={(e) => onOpen(e.currentTarget)}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.25,
        font: 'var(--mui-font-body1)',
        color: value !== null ? 'text.primary' : 'primary.main',
      }}
    >
      {value !== null ? `${label}: ${value}` : label}
      <ExpandMoreIcon fontSize="inherit" />
    </Link>
  );
}

/**
 * One row of the DESIGN dropdown - the one crumb that shows real artwork.
 * 2026-08-29, owner feedback, verbatim: "pattern should be more like png
 * without background not some div block" - a bare `<img>` (not `next/image`;
 * these patterns are transparent SVGs, and `next/image` cannot optimize SVG
 * without `dangerouslyAllowSVG`, same reason the installation diagram above
 * uses a plain `<img>`), no circle/card behind it, `objectFit: contain` so
 * the transparent padding around the motif stays intact instead of being
 * cropped the way `objectFit: cover` would.
 */
function DesignMenuItem({
  entry,
  selected,
  onSelect,
}: {
  readonly entry: SwatchEntry;
  readonly selected: boolean;
  readonly onSelect: (id: string) => void;
}) {
  const item = (
    <MenuItem disabled={!entry.isAvailable} selected={selected} onClick={() => onSelect(entry.id)} sx={{ gap: 1.5 }}>
      {/* biome-ignore lint/performance/noImgElement: transparent SVG pattern art - next/image can't optimize SVG without dangerouslyAllowSVG, same precedent as the installation diagram below */}
      <img src={entry.imageUrl} alt="" width={32} height={32} style={{ objectFit: 'contain', flexShrink: 0 }} />
      <span style={{ flex: 1 }}>{entry.namePl}</span>
      {selected && <CheckIcon fontSize="small" color="secondary" />}
    </MenuItem>
  );
  return <DisabledExplanation title={entry.reasonPl ?? undefined}>{item}</DisabledExplanation>;
}

/** One row of the MATERIAL/FINISH dropdowns - text only, no image (owner: "you don't need to visualize the wood size or look"). */
function TextMenuItem({
  entry,
  selected,
  onSelect,
}: {
  readonly entry: OptionAvailability;
  readonly selected: boolean;
  readonly onSelect: (id: string) => void;
}) {
  const item = (
    <MenuItem disabled={!entry.isAvailable} selected={selected} onClick={() => onSelect(entry.id)}>
      <span style={{ flex: 1 }}>{entry.namePl}</span>
      {selected && <CheckIcon fontSize="small" color="secondary" sx={{ ml: 1.5 }} />}
    </MenuItem>
  );
  return (
    <DisabledExplanation title={entry.reason === null ? undefined : unavailabilityReasonMessage(entry.reason)}>
      {item}
    </DisabledExplanation>
  );
}

/**
 * One collapsible "band" of the configurator - a real MUI `Accordion`,
 * closed by default except the first unsatisfied step (owner feedback,
 * 2026-08-28: "wybiera się poprzez kliknięcie na band z nazwą" - you pick
 * by clicking a named band, like a t-shirt colour/size selector). The
 * band's own header always shows the current selection next to its name,
 * so a collapsed band still communicates its state at a glance.
 */
function ConfigSection({
  step,
  heading,
  selectedLabel,
  expanded,
  onToggle,
  children,
}: {
  readonly step: StepCode;
  readonly heading: string;
  readonly selectedLabel: string | null;
  readonly expanded: boolean;
  readonly onToggle: () => void;
  readonly children: ReactNode;
}) {
  return (
    <Accordion
      expanded={expanded}
      onChange={onToggle}
      disableGutters
      elevation={0}
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        '&:before': { display: 'none' },
        '&.Mui-expanded': { borderColor: 'secondary.main' },
      }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />} aria-controls={`${step}-content`} id={`${step}-header`}>
        <Typography variant="h6" component="h3">
          {heading}
          {selectedLabel !== null && (
            <Typography component="span" color="text.secondary" sx={{ ml: 1, font: 'var(--mui-font-body1)' }}>
              - {selectedLabel}
            </Typography>
          )}
        </Typography>
      </AccordionSummary>
      <AccordionDetails>{children}</AccordionDetails>
    </Accordion>
  );
}

/**
 * 2026-08-29, owner feedback, verbatim: "tekst do wygrawerowania - this
 * should be very small section - disabled for now, and number of
 * characters should match with the product" - a real disabled `TextField`,
 * not a full form: the placeholder states it's not enabled yet and shows
 * this exact product's own real `PersonalizationSpec.maxCharacters`
 * (`null` - no spec at all, or one not enabled - falls back to a generic
 * "not offered" placeholder, same honesty `PersonalizationStep` used to
 * apply). No accordion band, no breadcrumb - just this one small field.
 */
function PersonalizationStub({ maxCharacters }: { readonly maxCharacters: number | null }) {
  return (
    <TextField
      label={STEP_LABEL.PERSONALIZATION}
      placeholder={
        maxCharacters !== null
          ? SITE.configuratorPersonalizationComingSoonPl(maxCharacters)
          : SITE.configuratorPersonalizationUnavailablePl
      }
      disabled
      fullWidth
      size="small"
    />
  );
}

/**
 * The SIZE crumb's popover content - two plain, precise `TextField`s.
 * 2026-08-29, owner feedback, verbatim: "you don't need to visualize the
 * wood size or look" - the previous pass's `Slider` (a visual, drag-driven
 * control) is gone; a compact popover triggered from a breadcrumb crumb has
 * no room for one anyway. Each field still commits on blur, so live
 * pricing (§10.2) is unchanged - the server round-trip fires the moment a
 * real value is typed and the field loses focus, exactly as before.
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
 * P4's real upload flow (`ARCHITECTURE.md` §13). Only the first-upload
 * path is wired here - `uploadCustomDesign`. `reuploadCustomDesign`
 * (customer re-upload after staff requests `NEEDS_CHANGES`) is real,
 * tested, and callable (`server/actions/design-review.ts`), and now has
 * its own real UI on `/moje-konto/wzory/[id]` (2026-08-28) - that event
 * happens on an existing order past checkout, not inside this pre-purchase
 * configurator.
 */

function SummaryStep({
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
