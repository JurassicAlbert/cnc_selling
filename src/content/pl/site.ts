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

  configuratorHeadingPl: 'Skonfiguruj produkt',
  configuratorStepDesignPl: 'Wzór',
  configuratorStepMaterialPl: 'Materiał',
  configuratorStepSizePl: 'Wymiary',
  configuratorStepThicknessPl: 'Grubość',
  configuratorStepFinishPl: 'Wykończenie',
  configuratorStepInstallationVariantPl: 'Sposób montażu',
  configuratorStepPersonalizationPl: 'Personalizacja',
  configuratorStepCustomUploadPl: 'Twój projekt',
  configuratorStepSummaryPl: 'Podsumowanie',
  configuratorBackPl: 'Wstecz',
  configuratorNextPl: 'Dalej',
  configuratorWidthLabelPl: 'Szerokość (cm)',
  configuratorHeightLabelPl: 'Wysokość (cm)',
  configuratorNoOptionsPl: 'Ta opcja nie jest jeszcze dostępna dla wybranej konfiguracji.',
  configuratorPersonalizationUnavailablePl:
    'Ten produkt nie oferuje jeszcze personalizacji tekstem. Ten krok można pominąć.',
  configuratorPersonalizationLabelPl: 'Tekst do wygrawerowania',
  configuratorFontLabelPl: 'Krój pisma',
  configuratorFontRequiredPl: 'Wybierz krój pisma, aby sprawdzić, czy wpisany tekst może zostać wykonany.',
  configuratorPriceLabelPl: 'Cena',
  configuratorPriceCalculatingPl: 'Obliczanie ceny…',
  configuratorPriceUnavailablePl: 'Podaj wymiary, aby zobaczyć cenę.',
  configuratorPriceUnavailableGenericPl: 'Cena niedostępna dla tej konfiguracji.',
  configuratorModuleCountLabelPl: 'Liczba elementów',
  configuratorAcknowledgeRequiredPl: 'Potwierdzam, że rozumiem powyższą informację.',
  configuratorBlockedPl: 'Ta konfiguracja nie może zostać wykonana. Zmień wybór powyżej.',
  configuratorCartNotBuiltPl:
    'Dodawanie do koszyka nie jest jeszcze dostępne — ten krok zostanie uruchomiony w kolejnym etapie budowy sklepu.',
  configuratorProductionDaysLabelPl: 'Czas realizacji',
  configuratorClearedFinishPl:
    'Wybrane wykończenie zostało wyczyszczone, ponieważ nie jest dostępne dla nowo wybranego materiału.',
  configuratorClearedThicknessPl:
    'Wybrana grubość została wyczyszczona, ponieważ nie mieści się w wybranym sposobie montażu.',

  // Homepage hero — real claims about how this business actually operates,
  // not generic retail trust-badge copy. No "free shipping"/"money-back
  // guarantee" claims: nothing has confirmed either exists yet.
  heroHeadlinePl: 'Meble i dodatki z grawerem, wykonane na wymiar',
  heroSubcopyPl:
    'Projektujemy i wykonujemy unikalne przedmioty z drewna i gresu — od stołków loftowych po biżuterię — z precyzyjnym grawerem CNC i laserowym.',
  heroCtaPl: 'Zobacz kategorie',

  trustMadeToOrderTitlePl: 'Wykonanie na zamówienie',
  trustMadeToOrderDescPl: 'Każdy produkt wykonujemy indywidualnie',
  trustEngravingTitlePl: 'Personalizacja grawerem',
  trustEngravingDescPl: 'Twój wzór, Twój tekst',
  trustPaymentTitlePl: 'Płatność przelewem',
  trustPaymentDescPl: 'Bezpieczne rozliczenie bankowe',
  trustContactTitlePl: 'Kontakt bezpośredni',
  trustContactDescPl: 'Pytania? Napisz do nas',

  homeProductsHeadingPl: 'Nasze produkty',

  filterMaterialLabelPl: 'Materiał',
  filterAllMaterialsPl: 'Wszystkie materiały',
  filterApplyPl: 'Filtruj',
  sortLabelPl: 'Sortuj',
  sortRelevancePl: 'Domyślnie',
  sortPriceAscPl: 'Cena: od najniższej',
  sortPriceDescPl: 'Cena: od najwyższej',

  searchPlaceholderPl: 'Szukaj produktów…',
  searchButtonLabelPl: 'Szukaj',
  searchResultsHeadingPl: 'Wyniki wyszukiwania',
  searchResultsForPl: 'Wyniki dla',
  searchNoResultsPl: 'Nie znaleziono produktów pasujących do wyszukiwania.',
  searchEmptyQueryPl: 'Wpisz szukaną frazę.',
} as const;
