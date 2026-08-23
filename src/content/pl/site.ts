/**
 * Static site chrome — copy that isn't a translation of a domain code (that
 * is `messages.ts`'s job) but also isn't a component-local string literal,
 * which the lint rule in `scripts/check-polish-literals.mjs` forbids
 * everywhere under `src/app` and `src/ui`.
 *
 * `catalogue*` entries are real, functional UI chrome for the category/
 * product pages built on the seeded catalogue — labels and structure, not
 * the product descriptions themselves (those come from the database, seeded
 * in `prisma/seed.ts`, and are their own kind of placeholder — see that
 * file's header comment). `home*` is the homepage's own SEO metadata —
 * technical copy, not the hero/craftsmanship/reviews/FAQ narrative content
 * ARCHITECTURE.md §22 describes, which is still unbuilt (see
 * `src/app/(marketing)/page.tsx`'s header comment for why).
 */

export const SITE = {
  homeSeoTitlePl: 'CNC Selling — meble i akcesoria z grawerem',
  homeSeoDescPl:
    'Meble, biżuteria i wykończenia wnętrz z drewna i gresu, z personalizowanym grawerem.',

  catalogueHomeLinkPl: 'Strona główna',
  catalogueStartingPricePrefixPl: 'od',
  catalogueProductionTimeLabelPl: 'Czas realizacji',
  catalogueProductionTimeUnitPl: 'dni roboczych',
  catalogueDimensionsLabelPl: 'Wymiary',
  catalogueMaterialsLabelPl: 'Dostępne materiały',
  catalogueCareInstructionsLabelPl: 'Pielęgnacja',
  catalogueInstallationInfoLabelPl: 'Informacje o montażu',
  catalogueInstallationVariantsLabelPl: 'Warianty montażu',
  catalogueMaterialNotesLabelPl: 'Ważne informacje',
  catalogueEmptyCategoryPl: 'W tej kategorii nie ma jeszcze żadnych produktów.',
  catalogueCategoryNotFoundPl: 'Nie znaleziono takiej kategorii.',
  catalogueProductNotFoundPl: 'Nie znaleziono takiego produktu.',
  catalogueViewProductPl: 'Zobacz produkt',
  catalogueCategoriesHeadingPl: 'Kategorie',
} as const;
