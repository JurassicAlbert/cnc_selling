/**
 * Static site chrome - copy that isn't a translation of a domain code (that
 * is `messages.ts`'s job) but also isn't a component-local string literal,
 * which the lint rule in `scripts/check-polish-literals.mjs` forbids
 * everywhere under `src/app` and `src/ui`.
 *
 * `catalogue*` entries are real, functional UI chrome for the category/
 * product pages built on the seeded catalogue - labels and structure, not
 * the product descriptions themselves (those come from the database, seeded
 * in `prisma/seed.ts`, and are their own kind of placeholder - see that
 * file's header comment). `home*` is the homepage's own SEO metadata -
 * technical copy, not the hero/craftsmanship/reviews/FAQ narrative content
 * ARCHITECTURE.md §22 describes, which is still unbuilt (see
 * `src/app/(marketing)/page.tsx`'s header comment for why).
 */

import { countPl } from '@/domain/text/plural';

export const SITE = {
  homeSeoTitlePl: 'RYT - meble i akcesoria z grawerem',
  homeSeoDescPl:
    'Meble, biżuteria i wykończenia wnętrz z drewna i gresu, z personalizowanym grawerem.',

  catalogueHomeLinkPl: 'Strona główna',
  catalogueStartingPricePrefixPl: 'od',
  /**
   * Shown instead of a price when `Product.startingPriceGrossGrosze` is
   * null - a product whose cost genuinely cannot be known before the
   * customer's own artwork exists. Never a zero, never a fallback to the
   * internal net clamp (`docs/REVIEW-DETAILED.md` BUG-02).
   */
  catalogueIndividualQuotePl: 'Wycena indywidualna',
  catalogueProductionTimeLabelPl: 'Czas realizacji',
  catalogueProductionTimeUnitPl: 'dni roboczych',
  catalogueDimensionsLabelPl: 'Wymiary',
  catalogueMaterialsLabelPl: 'Dostępne materiały',
  catalogueCareInstructionsLabelPl: 'Pielęgnacja',
  catalogueInstallationInfoLabelPl: 'Informacje o montażu',
  catalogueInstallationVariantsLabelPl: 'Warianty montażu',
  catalogueMaterialNotesLabelPl: 'Ważne informacje',
  catalogueAvailableDesignsLabelPl: 'Dostępne wzory',
  // Empty states get a way forward, not just a statement of absence - a
  // customer who lands here should not have to reach for the back button to
  // find out what to do next (2026-08-30 copy pass).
  catalogueEmptyCategoryPl:
    'W tej kategorii nie ma jeszcze produktów. Zajrzyj do pozostałych kategorii albo napisz do nas - wykonujemy też projekty na indywidualne zamówienie.',
  catalogueCategoryNotFoundPl: 'Nie znaleziono takiej kategorii.',
  catalogueProductNotFoundPl: 'Nie znaleziono takiego produktu.',
  catalogueViewProductPl: 'Zobacz produkt',
  catalogueCategoriesHeadingPl: 'Kategorie',
  cardPersonalizationBadgePl: 'Grawer',

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
  configuratorStepBlockedPrefixPl: 'Najpierw uzupełnij krok:',
  configuratorNextBlockedPl: 'Uzupełnij ten krok, aby przejść dalej.',
  configuratorPersonalizationUnavailablePl:
    'Ten produkt nie oferuje jeszcze personalizacji tekstem. Ten krok można pominąć.',
  configuratorPersonalizationLabelPl: 'Tekst do wygrawerowania',
  // 2026-08-29, owner feedback: personalization becomes a very small,
  // disabled-for-now stub - the real character limit still shown, so it
  // never overpromises what the product will actually allow once enabled.
  configuratorPersonalizationComingSoonPl: (maxCharacters: number) =>
    `Wkrótce dostępne - do ${maxCharacters} znaków`,
  configuratorFontLabelPl: 'Krój pisma',
  configuratorFontRequiredPl: 'Wybierz krój pisma, aby sprawdzić, czy wpisany tekst może zostać wykonany.',
  configuratorPreviewHeadingPl: 'Podgląd',
  configuratorPreviewEmptyPl: 'Wybierz materiał, aby zobaczyć podgląd.',
  configuratorPreviewCaptionPl:
    'Wizualizacja poglądowa złożona z rzeczywistych zdjęć materiału i wzoru zastępczego - ostateczny wygląd produktu może się różnić.',
  configuratorPriceLabelPl: 'Cena',
  configuratorPriceCalculatingPl: 'Obliczanie ceny…',
  configuratorPriceUnavailablePl: 'Podaj wymiary, aby zobaczyć cenę.',
  configuratorPriceUnavailableGenericPl: 'Cena niedostępna dla tej konfiguracji.',
  /**
   * The sticky bar's version of `configuratorOptionUnavailablePl`. That one
   * is a full sentence in an `Alert`; this sits in a one-line fixed bar next
   * to the word "Cena", so it has to be short enough not to wrap on a phone.
   *
   * It exists because the bar is a *second* price surface. UX-21 first
   * withheld the price only in the summary panel, and the bar - the more
   * prominent of the two, pinned to the bottom of every screen - carried on
   * showing the figure. Found on the browser check, 2026-09-04.
   */
  configuratorPriceWithdrawnPl: 'Wariant niedostępny',
  configuratorModuleCountLabelPl: 'Liczba elementów',
  configuratorAcknowledgeRequiredPl: 'Potwierdzam, że rozumiem powyższą informację.',
  configuratorBlockedPl: 'Ta konfiguracja nie może zostać wykonana. Zmień wybór powyżej.',
  configuratorAddToCartPl: 'Dodaj do koszyka',
  configuratorSaveChangesPl: 'Zapisz zmiany',
  configuratorAddToCartErrorPl:
    'Nie udało się dodać do koszyka. Sprawdź wybory powyżej i spróbuj ponownie.',
  /**
   * `docs/REVIEW-DETAILED.md` SEC-03. Reached when a link, a saved project
   * or a bookmark still names something we have since withdrawn - our
   * change, not the customer's error, so the copy neither blames them nor
   * leaves them guessing which of six choices is the problem.
   */
  configuratorOptionUnavailablePl:
    'Wybrany wzór, materiał lub wykończenie nie jest już dostępny - prawdopodobnie wycofaliśmy go od czasu zapisania tej konfiguracji. Wybierz inny wariant powyżej.',
  configuratorProductionDaysLabelPl: 'Czas realizacji',
  configuratorClearedFinishPl:
    'Wybrane wykończenie zostało wyczyszczone, ponieważ nie jest dostępne dla nowo wybranego materiału.',
  configuratorClearedThicknessPl:
    'Wybrana grubość została wyczyszczona, ponieważ nie mieści się w wybranym sposobie montażu.',
  configuratorUploadChooseFilePl: 'Wybierz plik (JPG, PNG, SVG lub PDF)',
  configuratorUploadSubmitPl: 'Prześlij projekt',
  configuratorUploadSubmittingPl: 'Przesyłanie…',
  configuratorUploadSuccessPl: 'Projekt został przesłany.',
  // Short form for the CUSTOM_UPLOAD accordion band's collapsed-header
  // summary - the full sentence above already appears once inside the
  // band's own success `Alert`; repeating it verbatim in the header too
  // made `getByText('Projekt został przesłany.')` match twice in the e2e
  // suite (a real ambiguity, not just a test artifact) once the header
  // started echoing the selection back, same "Colour: Blue" pattern every
  // other band uses.
  configuratorUploadDoneLabelPl: 'Plik przesłany',
  configuratorUploadIpConsentLabelPl: 'Akceptuję powyższe oświadczenie',
  configuratorUploadReplacePl: 'Prześlij inny plik',
  // P9 phase 2 - reusing an already-uploaded design from "Moje wzory" instead of uploading fresh.
  configuratorUploadReuseHeadingPl: 'Masz już zapisany wzór? Możesz go użyć zamiast przesyłać nowy plik.',
  configuratorUploadReuseSelectLabelPl: 'Zapisane wzory',
  configuratorUploadReuseButtonPl: 'Użyj tego wzoru',
  configuratorUploadReuseOrNewPl: 'lub prześlij nowy plik poniżej',
  configuratorUploadReuseSuccessPl: 'Wybrano zapisany wzór.',
  configuratorCustomPriceEstimatePl:
    'Podana cena to wstępny szacunek (materiał, wykończenie, cena bazowa). Ostateczna wycena, uwzględniająca złożoność Twojego projektu, zostanie potwierdzona podczas weryfikacji projektu.',

  // Homepage hero - real claims about how this business actually operates,
  // not generic retail trust-badge copy. No "free shipping"/"money-back
  // guarantee" claims: nothing has confirmed either exists yet.
  heroHeadlinePl: 'Meble i dodatki z grawerem, wykonane na wymiar',
  heroSubcopyPl:
    'Projektujemy i wykonujemy unikalne przedmioty z drewna i gresu - od stołków loftowych po biżuterię - z precyzyjnym grawerem CNC i laserowym.',
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
  filterApplyPl: 'Pokaż wyniki',
  sortLabelPl: 'Sortuj',
  sortRelevancePl: 'Kolejność domyślna',
  sortPriceAscPl: 'Cena: od najniższej',
  sortPriceDescPl: 'Cena: od najwyższej',

  searchPlaceholderPl: 'Szukaj produktów…',
  searchButtonLabelPl: 'Szukaj',
  searchResultsHeadingPl: 'Wyniki wyszukiwania',
  searchResultsForPl: 'Wyniki dla',
  searchNoResultsPl:
    'Nic nie pasuje do tej frazy. Spróbuj krótszego hasła albo przejrzyj kategorie w menu.',
  // A bare 'type something' tells a customer nothing about what this search
  // actually indexes. Real examples do.
  searchEmptyQueryPl: 'Wpisz, czego szukasz - np. „obraz”, „dąb” albo „bransoletka”.',
  /*
    UX-23's category selector, attached to the search field. „Wszystkie
    kategorie" is a real option, not a placeholder: it is what the field
    searches when nobody narrows it.
  */
  /*
    2026-09-04: the category list stopped being a search filter and became
    quick access to a category page - owner request, "wyszukiwanie dobrze
    sobie radzi bez tego". So it is named for what it does now.
  */
  searchCategoryMenuPl: 'Kategorie',
  // Shown when the selector was used without a phrase - a legitimate
  // request ("show me what is in here"), so it gets its own line rather
  // than being described as a search for nothing.
  searchCategoryOnlyPl: 'Wszystko w kategorii',
  searchInCategoryPl: 'w kategorii',
  // The category in the selector no longer exists or has been deactivated -
  // a stale bookmark. Says so, rather than silently widening the search back
  // to the whole catalogue.
  searchCategoryGonePl:
    'Wybrana kategoria nie jest już dostępna. Wyszukaj ponownie we wszystkich kategoriach.',

  /*
    The checkout step rail - owner request 2026-09-04, arrangement from
    `template.getbazaar.io`, which shows „1. Cart / 2. Details / 3. Payment /
    4. Review".

    Three here rather than four, and the second one named for what actually
    happens on it. The shop has three pages in this flow; the payment method
    is chosen on the order form and the transfer is made in the customer's
    own bank, because no payment provider is integrated (`OPEN_ITEMS.md` §1).
    A „Płatność" step would be pointing at a page that does not exist.
  */
  checkoutStepCartPl: 'Koszyk',
  checkoutStepDetailsPl: 'Dane i płatność',
  checkoutStepConfirmationPl: 'Potwierdzenie',
  checkoutStepsLabelPl: 'Etapy zamówienia',
  checkoutStepDonePl: 'ukończony',
  checkoutStepCurrentPl: 'bieżący',

  cartHeadingPl: 'Koszyk',
  cartEmptyPl: 'Twój koszyk jest pusty.',
  cartContinueShoppingPl: 'Przeglądaj produkty',
  // UX-23's summary panel says this before checkout rather than letting the
  // customer find out at the next step that the figure was not the total.
  cartShippingAtCheckoutPl: 'Koszt dostawy poznasz w kolejnym kroku, po wybraniu sposobu wysyłki.',
  cartKeepShoppingHeadingPl: 'Przeglądaj dalej',
  cartQuantityLabelPl: 'Ilość',
  cartRemovePl: 'Usuń',
  /*
    „Aktualizuj", „Duplikuj" and „Edytuj" were removed here on 2026-09-05
    (UX-05/BUG-09), after the owner's 2026-09-04 instruction took the three
    controls off the cart card and left the constants behind unused.
    Deliberately deleted rather than kept "in case": a label still sitting in
    the content file is how a removed control gets re-added by someone who
    finds it and assumes it belongs somewhere. `CartContents.tsx`'s header
    records what the removal cost.
  */
  // 2026-08-29, cart UI/UX pass - real MUI stepper + a hard per-line cap
  // ("żeby nie było sytuacji w której klient kupuje 10000 sztuk produktu").
  cartQuantityDecreasePl: 'Zmniejsz ilość',
  cartQuantityIncreasePl: 'Zwiększ ilość',
  cartQuantityMaxNoticePl: (max: number) => `Maksymalnie ${max} szt. na jedną pozycję. Większe zamówienia - napisz do nas.`,
  cartItemsCountPl: (count: number) => `${count} ${count === 1 ? 'produkt' : count < 5 ? 'produkty' : 'produktów'} w koszyku`,
  cartSubtotalLabelPl: 'Suma',
  cartCheckoutCtaPl: 'Przejdź do zamówienia',
  cartIncompleteNoticePl:
    'Ta konfiguracja nie może już zostać wykonana w tej formie - edytuj ją przed złożeniem zamówienia.',

  checkoutHeadingPl: 'Zamówienie',
  /*
    Owner request, 2026-09-04: the order form should offer to fill itself
    from the account when someone is signed in, and point a guest at
    registration rather than making them type everything by hand.

    The copy is careful about what is actually on offer. There is no address
    on a `User` - the account holds a name, an email and an optional phone -
    so the address half comes from the customer's own last order, and the
    button says so. „Twój zapisany adres" would be describing a feature this
    shop does not have.
  */
  checkoutPrefillButtonPl: 'Uzupełnij moimi danymi',
  checkoutPrefillWithAddressPl:
    'Wpiszemy dane z Twojego konta oraz adres z ostatniego zamówienia. Wszystko możesz poprawić przed wysłaniem.',
  checkoutPrefillNoAddressPl:
    'Wpiszemy imię, nazwisko i e-mail z Twojego konta. Adresu jeszcze u nas nie masz - podasz go poniżej, a przy kolejnym zamówieniu podpowiemy go sami.',
  checkoutPrefillDonePl: 'Uzupełniliśmy formularz. Sprawdź dane i popraw, jeśli coś się zmieniło.',
  checkoutGuestHeadingPl: 'Masz już konto?',
  checkoutGuestBodyPl:
    'Zaloguj się, a wpiszemy Twoje dane za Ciebie. Możesz też złożyć zamówienie bez konta - wystarczy wypełnić formularz poniżej.',
  checkoutGuestLoginPl: 'Zaloguj się',
  checkoutGuestRegisterPl: 'Załóż konto',
  checkoutBuyerSectionHeadingPl: 'Dane zamawiającego',
  checkoutEmailLabelPl: 'E-mail',
  checkoutPhoneLabelPl: 'Telefon',
  checkoutFirstNameLabelPl: 'Imię',
  checkoutLastNameLabelPl: 'Nazwisko',
  checkoutInvoiceSectionHeadingPl: 'Dane do faktury (opcjonalnie)',
  checkoutCompanyNameLabelPl: 'Nazwa firmy',
  checkoutNipLabelPl: 'NIP',
  checkoutAddressSectionHeadingPl: 'Adres dostawy',
  checkoutStreetLabelPl: 'Ulica i numer',
  checkoutPostalCodeLabelPl: 'Kod pocztowy',
  checkoutCityLabelPl: 'Miejscowość',
  checkoutDeliverySectionHeadingPl: 'Sposób dostawy',
  checkoutNoDeliveryMethodsPl: 'Obecnie żadna metoda dostawy nie jest dostępna. Skontaktuj się z nami, aby dokończyć zamówienie.',
  checkoutDeliveryEstimateLabelPl: 'Przewidywany czas dostawy:',
  checkoutDeliveryEstimateUnitPl: 'dni roboczych',
  checkoutDeliveryMethodInvalidPl: 'Wybrana metoda dostawy jest już niedostępna - wybierz inną i spróbuj ponownie.',
  checkoutPickupPointLabelPl: 'Wybierz paczkomat lub punkt odbioru',
  checkoutPickupPointSearchPl: 'Wpisz miasto lub kod pocztowy',
  checkoutPickupPointNoneFoundPl: 'Brak punktów dla podanej frazy - spróbuj innego miasta.',
  checkoutPickupPointInvalidPl: 'Wybierz punkt odbioru z listy, aby kontynuować - wybrany punkt jest nieprawidłowy lub nie został jeszcze wybrany.',
  checkoutPickupPointRequiredHintPl: 'Wybierz punkt odbioru powyżej, aby złożyć zamówienie.',
  /** §16.1's per-IP order-creation limit. Says plainly that nothing was charged, because that is a customer's first worry here. */
  checkoutRateLimitedPl:
    'Zbyt wiele prób złożenia zamówienia w krótkim czasie. Nic nie zostało obciążone - odczekaj chwilę i spróbuj ponownie. Jeśli to pomyłka, napisz do nas.',
  /**
   * `docs/REVIEW-DETAILED.md` SEC-03. Deliberately not the generic
   * "nieprawidłowa konfiguracja": the overwhelmingly likely cause is that
   * we withdrew something after this cart was filled, which is our doing,
   * not the customer's mistake - so the copy says so and names the fix.
   */
  checkoutOptionUnavailablePl:
    'Jedna z pozycji w koszyku zawiera wzór, materiał lub wykończenie, którego już nie oferujemy. Otwórz koszyk i zmień tę pozycję („Edytuj"), aby dokończyć zamówienie.',
  checkoutPickupPointSampleNoticePl:
    'Lista jest wstępna, nie w pełni aktualna - jeśli nie widzisz Twojego miasta lub konkretnego punktu, napisz do nas po złożeniu zamówienia, a ustalimy to indywidualnie.',
  checkoutDeliveryInfeasibleTagPl: 'Niedostępne dla Twojego koszyka',
  checkoutDeliveryMatchedTierPl: (label: string) => `Rozmiar/waga: ${label}`,
  checkoutFreeShippingAppliedPl: 'Darmowa dostawa - Twoje zamówienie kwalifikuje się do darmowej wysyłki tą metodą.',
  checkoutCourierNoteLabelPl: 'Uwagi dla kuriera (opcjonalnie)',
  // The closing mark here was a straight `"` against an opening `„` - the
  // Polish pair is „…”, and a mismatched one is visible to any Polish
  // reader (2026-08-30 typography pass).
  checkoutCourierNoteHelperPl: 'Np. kod do bramy, piętro, „zostawić u sąsiada” - trafi na etykietę przesyłki.',
  checkoutInternalNoteLabelPl: 'Uwagi dla nas (opcjonalnie)',
  checkoutInternalNoteHelperPl: 'Coś, co powinniśmy wiedzieć o wysyłce - widoczne tylko dla naszego zespołu.',
  checkoutOrderSummaryHeadingPl: 'Podsumowanie zamówienia',
  orderAwaitingPaymentNoticePl:
    'Czekamy na Twoją wpłatę - dane do przelewu znajdziesz poniżej. Możesz wrócić na tę stronę w dowolnym momencie, aby je sprawdzić.',
  orderCancelledNoticePl: 'To zamówienie zostało anulowane. Jeśli masz pytania, napisz do nas przez formularz poniżej.',
  checkoutPaymentMethodInvalidPl: 'Wybrana metoda płatności jest już niedostępna - wybierz inną i spróbuj ponownie.',
  checkoutNoPaymentMethodsPl: 'Obecnie żadna metoda płatności nie jest dostępna. Skontaktuj się z nami, aby dokończyć zamówienie.',
  checkoutPaymentSectionHeadingPl: 'Płatność',
  checkoutPaymentBankTransferPl: 'Przelew bankowy',
  checkoutPaymentContactArrangedPl: 'Ustalę szczegóły indywidualnie',
  checkoutSubtotalLabelPl: 'Suma produktów',
  checkoutShippingLabelPl: 'Dostawa',
  checkoutTermsLabelPl: 'Akceptuję regulamin sklepu.',
  checkoutWithdrawalExemptionTextPl:
    'Przyjmuję do wiadomości, że produkty wykonywane na indywidualne zamówienie, według moich specyfikacji, nie podlegają zwrotowi w ramach 14-dniowego prawa odstąpienia od umowy (art. 38 pkt 3 ustawy z dnia 30 maja 2014 r. o prawach konsumenta).',
  checkoutSubmitPl: 'Złóż zamówienie',
  /**
   * Shown when a second, parallel checkout of the same cart won the race
   * (`docs/AUDIT-2026-08-30.md` P0-2). The reassurance is the important
   * part: nothing was charged twice, and the order that DID go through is
   * findable - so this must never read like a generic failure.
   */
  checkoutCartChangedPl:
    'To zamówienie zostało już złożone w innym oknie lub na innej karcie. Nic nie zostało policzone dwa razy - sprawdź swoje zamówienia lub wiadomość e-mail z potwierdzeniem.',
  checkoutEmptyCartRedirectPl: 'Twój koszyk jest pusty - wróć do koszyka, aby dodać produkty.',
  checkoutGenericErrorPl: 'Nie udało się złożyć zamówienia. Sprawdź dane powyżej i spróbuj ponownie.',

  orderConfirmationHeadingPl: 'Zamówienie przyjęte',
  orderItemsHeadingPl: 'Zamówione produkty',
  orderDeliveryMethodHeadingPl: 'Sposób dostawy',
  orderNumberLabelPl: 'Numer zamówienia',
  /*
    BUG-04. The confirmation used to show item lines, a divider and „Do
    zapłaty", with nothing in between - so the lines did not add up to the
    total and nothing said why.

    Labels reused from the checkout page rather than invented, so the
    document a customer pays from reads the same as the page they paid on.
    `orderVatIncludedPl` is stated rather than itemised: every price on this
    site is gross, and a Polish consumer confirmation has to say so.
  */
  orderVatIncludedPl: (vat: string) => `W tym VAT: ${vat}`,
  orderFreeShippingPl: 'Gratis',
  orderTotalLabelPl: 'Do zapłaty',
  orderBankTransferHeadingPl: 'Dane do przelewu',
  orderBankTransferTitlePl: 'Tytuł przelewu',
  orderBankTransferAccountLabelPl: 'Numer konta',
  // "Nie zawiera go to potwierdzenie" is grammatical but inverted in a way
  // no one says out loud; a customer reading it while trying to pay has to
  // parse it twice.
  orderBankTransferAccountPendingPl:
    'Numer konta prześlemy osobno - e-mailem lub przy kontakcie z Tobą. Nie ma go w tym potwierdzeniu.',
  orderContactArrangedNoticePl: 'Skontaktujemy się, aby ustalić szczegóły zamówienia.',
  orderShipmentHeadingPl: 'Wysyłka',
  orderShipmentStatusLabelPl: 'Status',
  orderShipmentCarrierLabelPl: 'Przewoźnik',
  orderShipmentTrackingNumberLabelPl: 'Numer przesyłki',
  orderShipmentShippedAtLabelPl: 'Data nadania',
  orderShipmentEstimatedDeliveryLabelPl: 'Przewidywana data dostawy',
  orderShipmentDeliveredAtLabelPl: 'Data dostarczenia',
  orderShipmentIssueLabelPl: 'Zgłoszony problem',
  orderShipmentManualNoticePl:
    'Status przesyłki jest aktualizowany ręcznie przez nasz zespół, a nie pobierany automatycznie od przewoźnika - może nie odzwierciedlać zmian z ostatnich godzin.',
  orderShipmentNotYetPreparedPl: 'Paczka nie została jeszcze przygotowana do wysyłki.',
  orderEmailFollowUpNoticePl: 'Potwierdzenie zamówienia zostanie przesłane e-mailem.',
  orderNotFoundPl: 'Nie znaleziono takiego zamówienia.',
  orderLookupHeadingPl: 'Sprawdź status zamówienia',
  orderLookupOrderNumberLabelPl: 'Numer zamówienia',
  orderLookupTokenLabelPl: 'Kod dostępu',
  orderLookupSubmitPl: 'Sprawdź',
  orderLookupIntroPl: 'Podaj numer zamówienia i kod dostępu z e-maila z potwierdzeniem, aby zobaczyć jego status.',
  orderLookupOrderNumberHelperPl: 'W formacie 2026/08/0042 - znajdziesz go w e-mailu z potwierdzeniem.',
  orderLookupTokenHelperPl: 'Długi ciąg znaków z linku w e-mailu z potwierdzeniem zamówienia.',
  orderLookupAccountAlternativePl: 'Masz konto? Sprawdź w swoich zamówieniach',

  /*
    UX-23's topbar. The reference layout puts a shipping promotion here; we
    have no such offer, and inventing one would be a claim the shop cannot
    keep. This says two things that are already true and already stated
    elsewhere on the site (`trustMadeToOrderTitlePl`,
    `trustEngravingTitlePl`), in one line.
  */
  topbarNotePl: 'Wykonujemy na zamówienie, z personalizacją grawerem.',
  /*
    The strip's links, corrected 2026-09-04 on owner feedback: "navbar nad
    navbarem dotyczy mediów fb insta itd nie podstron". It used to carry FAQ
    and Kontakt, which is what the main navigation and the footer are for.

    Each one renders only when the owner has configured that profile in
    `/panel/ustawienia`. These are the accessible names for the icons, which
    are `aria-hidden` and would otherwise leave the links unnamed.
  */
  socialNavLabelPl: 'Nasze profile w mediach społecznościowych',
  socialFacebookPl: 'Facebook',
  socialInstagramPl: 'Instagram',
  socialTiktokPl: 'TikTok',
  socialYoutubePl: 'YouTube',

  footerCategoriesHeadingPl: 'Kategorie',
  footerInfoHeadingPl: 'Informacje',
  footerSearchLinkPl: 'Szukaj produktów',
  footerTermsLinkPl: 'Regulamin',
  footerPrivacyLinkPl: 'Polityka prywatności',
  footerCopyrightPl: 'RYT',
  footerTaglinePl: 'Precyzja CNC. Ciepło rzemiosła.',
  footerBlogLinkPl: 'Blog',
  footerPatternsLinkPl: 'Wzory',
  footerCollectionsLinkPl: 'Kolekcje',
  footerContactLinkPl: 'Kontakt',

  legalTermsHeadingPl: 'Regulamin',
  legalPrivacyHeadingPl: 'Polityka prywatności',

  // The burger's accessible name. Never rendered as visible text: below
  // 900px the control is the icon alone, so a screen reader is the only
  // consumer of this string.
  headerMenuTogglePl: 'Menu',
  /*
    BUG-28. The first thing a keyboard reaches on every page. Names the
    destination rather than the mechanism ("Przejdź do treści", not "Pomiń
    nawigację"): the person using it wants the content, and telling them what
    they are skipping is less useful than telling them where they land.
  */
  skipToContentPl: 'Przejdź do treści',
  /*
    BUG-29. A storefront page carries three `nav` landmarks - this one, the
    category bar and the breadcrumbs - and a screen reader's landmark list
    read "navigation, navigation, Kategorie". The unlabelled one was the main
    menu, which is the one somebody jumping by landmark is looking for.
  */
  headerMainNavPl: 'Menu główne',
  /*
    BUG-27. The visible count is a small circle beside the cart icon, marked
    `aria-hidden` because it repeats a number the link already carries - which
    left the link announced as „Koszyk 709,16 zł", with no way for a blind
    customer to know whether it held one item or nine. This is that number, in
    words, for the accessibility tree only.

    Three Polish forms, not two: 1 produkt, 2 produkty, 5 produktów. See
    `domain/text/plural.ts` - `n === 1 ? a : b` is simply wrong here.
  */
  cartItemCountPl: (count: number): string =>
    countPl(count, { one: 'produkt', few: 'produkty', many: 'produktów' }),
  headerAccountLinkPl: 'Moje konto',
  headerLoginLinkPl: 'Zaloguj się',
  headerLogoutPl: 'Wyloguj się',
  // 2026-08-29, owner request - real navbar restructure: a "Produkty"
  // dropdown (every category) plus real "O nas"/"FAQ" entries.
  headerProductsMenuPl: 'Produkty',
  headerFaqLinkPl: 'FAQ',
  // 2026-08-29: "Kolekcje" becomes a dropdown too, same shape as "Produkty".
  headerCollectionsMenuPl: 'Kolekcje',
  headerAllCollectionsLinkPl: 'Wszystkie kolekcje',

  authLoginHeadingPl: 'Logowanie',
  authRegisterHeadingPl: 'Rejestracja',
  authEmailLabelPl: 'Adres e-mail',
  authPasswordLabelPl: 'Hasło',
  authNameLabelPl: 'Imię i nazwisko',
  authLoginSubmitPl: 'Zaloguj się',
  authRegisterSubmitPl: 'Załóż konto',
  authNoAccountPl: 'Nie masz jeszcze konta?',
  authSwitchToRegisterPl: 'Zarejestruj się',
  authHaveAccountPl: 'Masz już konto?',
  authSwitchToLoginPl: 'Zaloguj się',
  authOrDividerPl: 'lub',
  authTabPasswordPl: 'Hasło',
  authTabOtpPl: 'Kod e-mail',
  authOtpRequestSubmitPl: 'Wyślij kod logowania e-mailem',
  authOtpCodeLabelPl: 'Kod logowania',
  authOtpSubmitPl: 'Zaloguj kodem',
  authOtpSentNoticePl: 'Wysłaliśmy kod logowania na podany adres e-mail. Sprawdź skrzynkę.',
  authGenericErrorPl: 'Coś poszło nie tak. Spróbuj ponownie.',

  accountNavOrdersPl: 'Zamówienia',
  accountNavConfigurationsPl: 'Zapisane projekty',
  accountNavDesignsPl: 'Moje wzory',
  accountOrdersHeadingPl: 'Moje zamówienia',
  accountOrdersEmptyPl: 'Nie masz jeszcze żadnych zamówień.',
  accountOrdersEmptyActionPl: 'Przejdź do sklepu',
  accountOrdersItemCountPl: (count: number) => `${count} poz.`,
  accountConfigurationsHeadingPl: 'Moje zapisane projekty',
  accountConfigurationsEmptyPl: 'Nie masz jeszcze żadnych zapisanych konfiguracji.',
  accountConfigurationsEmptyActionPl: 'Skonfiguruj produkt',
  accountViewAllPl: 'Zobacz wszystkie',
  accountOverviewGreetingPl: 'Witaj',
  accountOverviewOrdersEmptyPl: 'Nie masz jeszcze żadnych zamówień.',
  accountOverviewDesignsSummaryPl: (uploaded: number, favorites: number) =>
    `Przesłane pliki: ${uploaded} · Ulubione wzory: ${favorites}`,
  accountOverviewHelpSummaryOpenPl: (count: number) => `Otwarte zgłoszenia: ${count}`,
  accountOverviewHelpSummaryNonePl: 'Brak zgłoszeń.',
  accountOverviewShipmentLabelPl: 'Wysyłka',

  // P9 phase 2 - the standalone "moje wzory" upload/reuse library, moved
  // out of being tied to any one product's configurator flow.
  accountDesignsHeadingPl: 'Moje wzory',
  accountDesignsIntroPl:
    'Wszystkie pliki przesłane przez Ciebie jako własny projekt. Możesz dodać nowy wzór albo użyć zapisanego przy konfigurowaniu dowolnego produktu, który na to pozwala.',
  accountDesignsEmptyPl: 'Nie masz jeszcze żadnych przesłanych wzorów.',
  accountDesignsUploadHeadingPl: 'Prześlij nowy wzór',
  accountDesignsTitleFieldLabelPl: 'Nazwa wzoru (opcjonalnie)',
  accountDesignsTitleFieldPlaceholderPl: 'np. Logo firmy',
  accountDesignsUploadedAtLabelPl: 'Przesłano',
  accountDesignsUntitledPl: 'Bez nazwy',
  accountFavoriteDesignsHeadingPl: 'Ulubione wzory',
  accountFavoriteDesignsEmptyPl: 'Nie masz jeszcze ulubionych wzorów.',
  accountFavoriteDesignsBrowseLinkPl: 'Przeglądaj kolekcje',
  accountConfigurationEditPl: 'Edytuj',
  accountConfigurationAddToCartPl: 'Dodaj do koszyka',
  accountConfigurationDeletePl: 'Usuń',

  // P9 continuation, 2026-08-28 - the customer-visible half of the design
  // review "dyskusja" (`DesignReviewComment.authorType` has always been
  // "staff" | "customer", but no page ever showed it to the customer).
  designDetailBackToListPl: 'Wróć do listy wzorów',
  designDetailStatusLabelPl: 'Status',
  designDetailDiscussionHeadingPl: 'Dyskusja o tym projekcie',
  designDetailDiscussionEmptyPl: 'Brak komentarzy. Jeśli masz pytanie o ten projekt, napisz poniżej.',
  designDetailCommentStaffLabelPl: 'Zespół',
  designDetailCommentCustomerLabelPl: 'Ty',
  designDetailReplyLabelPl: 'Nowa wiadomość',
  designDetailReplySubmitPl: 'Wyślij',
  designDetailReplyEmptyErrorPl: 'Wpisz treść wiadomości.',
  designDetailReplyErrorPl: 'Nie udało się wysłać wiadomości. Spróbuj ponownie.',
  designDetailNotFoundPl: 'Nie znaleziono takiego wzoru.',
  designDetailNeedsChangesNoticePl: 'Ten projekt wymaga poprawy - sprawdź komentarze poniżej i prześlij poprawiony plik.',

  consentBannerTextPl:
    'Używamy niezbędnych plików cookie do działania koszyka i logowania oraz - za Twoją zgodą - plików analitycznych, które pomagają nam ulepszać sklep.',
  consentBannerAcceptPl: 'Akceptuję',
  consentBannerDeclinePl: 'Tylko niezbędne',

  routeLoadingPl: 'Ładowanie…',

  errorPageHeadingPl: 'Coś poszło nie tak',
  /**
   * Deliberately does NOT restate the heading. The error panels previously
   * paired `errorPageHeadingPl` ("Coś poszło nie tak") with
   * `COPY.genericServerError`, which opens with the same four words - so
   * the page read "Coś poszło nie tak / Coś poszło nie tak. Spróbuj…".
   * Caught by looking at a rendered error page, not at the strings
   * (2026-08-30). `COPY.genericServerError` stays as-is: it is still right
   * where it appears alone, without a heading above it.
   */
  errorPageBodyPl:
    'Wystąpił nieoczekiwany błąd po naszej stronie - nie po Twojej. Spróbuj ponownie za chwilę, a jeśli problem się powtarza, napisz do nas.',
  errorPageRetryPl: 'Spróbuj ponownie',
  errorPageCorrelationIdLabelPl: 'Numer błędu',
  errorPageCorrelationIdHelpPl: 'Podaj ten numer, jeśli napiszesz do nas o tym błędzie - pozwoli nam szybko znaleźć, co się stało.',
  /**
   * The catch-all 404 (`src/app/not-found.tsx`). Deliberately offers real
   * ways onward rather than only announcing the failure - an error page
   * with no exit is a dead end (`docs/AUDIT-2026-08-30.md` P2-10).
   */
  notFoundHeadingPl: 'Nie znaleziono takiej strony',
  notFoundBodyPl: 'Strona, której szukasz, nie istnieje albo została przeniesiona.',
  notFoundHomeCtaPl: 'Wróć na stronę główną',
  notFoundCollectionsCtaPl: 'Zobacz kolekcje',
  notFoundContactCtaPl: 'Napisz do nas',

  blogHeadingPl: 'Blog',
  blogSeoTitlePl: 'Blog - RYT',
  blogSeoDescPl: 'Artykuły o rzemiośle, materiałach i personalizacji grawerem.',
  blogEmptyStatePl: 'Wpisy pojawią się tutaj wkrótce.',
  blogPublishedLabelPl: 'Opublikowano',
  blogReadMorePl: 'Czytaj dalej',
  blogPostNotFoundPl: 'Nie znaleziono takiego wpisu.',
  homeBlogHeadingPl: 'Z naszego bloga',
  blogViewAllPl: 'Zobacz wszystkie posty',

  patternsHeadingPl: 'Wzory',
  patternsSeoTitlePl: 'Wzory - RYT',
  patternsSeoDescPl: 'Przeglądaj nasze gotowe wzory do grawerowania CNC, a także zewnętrzne, darmowe źródła wzorów.',
  patternsIntroPl:
    'Poniżej znajdziesz wzory z naszej oferty, które można wybrać przy konfiguracji wybranych produktów. Możesz też przesłać własny projekt - zapisane wzory znajdziesz na koncie w sekcji „Moje wzory”.',
  patternsEmptyPl: 'Wzory pojawią się tutaj wkrótce.',
  patternsAvailableOnLabelPl: 'Dostępny w:',
  patternsNotAssignedPl: 'Obecnie niedostępny w żadnym zamawianym produkcie.',
  patternsFavoritePl: 'Dodaj do ulubionych',
  patternsUnfavoritePl: 'Usuń z ulubionych',
  patternsFavoriteLoginRequiredPl: 'Zaloguj się, aby dodać do ulubionych',
  patternsExternalHeadingPl: 'Zewnętrzne źródła wzorów',
  patternsExternalIntroPl:
    'To linki do niezależnych, zewnętrznych serwisów z darmowymi wzorami do grawerowania i cięcia CNC. Nie są to nasze materiały - każdy link prowadzi do strony innego dostawcy, gdzie obowiązują jego własne zasady korzystania i licencje.',
  patternsExternalBadgePl: 'zasób zewnętrzny',
  patternsFeaturedBadgePl: 'Wyróżniony',
  // 2026-08-29: real category-filter chips above the grid - DesignCollection groupings, seeded in prisma/seed.ts's DESIGN_COLLECTION_SEEDS.
  patternsAllCategoriesPl: 'Wszystkie',
  patternsExternalEmptyPl: 'Obecnie nie mamy poleconych zewnętrznych źródeł wzorów.',

  collectionsHeadingPl: 'Kolekcje',
  collectionsSeoTitlePl: 'Kolekcje - RYT',
  collectionsSeoDescPl: 'Gotowe, samodzielnie zaprojektowane kolekcje produktów z grawerem - dostępne od ręki, bez konieczności konfiguracji.',
  collectionsIntroPl:
    'To gotowe, samodzielnie zaprojektowane przez nas zestawienia produktów - nie są tworzone na indywidualne zamówienie klienta. Możesz je po prostu przeglądać i zamawiać, tak jak każdy inny produkt w sklepie.',
  collectionsEmptyPl: 'Kolekcje pojawią się tutaj wkrótce.',
  collectionsBadgePl: 'gotowa kolekcja',
  collectionNotFoundPl: 'Nie znaleziono takiej kolekcji.',
  collectionEmptyProductsPl: 'W tej kolekcji nie ma jeszcze żadnych produktów.',

  faqHeadingPl: 'Najczęściej zadawane pytania',
  faqSeoTitlePl: 'Najczęściej zadawane pytania - RYT',
  faqSeoDescPl: 'Odpowiedzi na najczęstsze pytania o zamówienia, personalizację i realizację.',
  faqEmptyStatePl: 'Pytania pojawią się tutaj wkrótce.',
  homeFaqHeadingPl: 'Najczęściej zadawane pytania',
  faqViewAllPl: 'Zobacz wszystkie pytania',

  staticPageNotFoundPl: 'Nie znaleziono takiej strony.',

  homeReviewsHeadingPl: 'Opinie klientów',
  reviewFormHeadingPl: 'Zostaw opinię',
  reviewFormAuthorNameLabelPl: 'Twoje imię (widoczne publicznie)',
  reviewFormRatingLabelPl: 'Ocena (1–5)',
  reviewFormBodyLabelPl: 'Treść opinii',
  reviewFormSubmitPl: 'Wyślij opinię',
  reviewFormThankYouPl: 'Dziękujemy za opinię! Zostanie opublikowana po weryfikacji.',
  reviewAlreadySubmittedPl: 'Opinia dla tego zamówienia została już przesłana.',
  reviewLinkPl: 'Zostaw opinię o tym zamówieniu',

  // 2026-08-29, owner request - a real "O nas" (About us) page for the new
  // navbar. Written from facts already established elsewhere in this
  // project (RYT, CNC/laser precision + real craftsmanship, wood + gres,
  // real 4-axis CNC, personalization) - nothing invented.
  aboutHeadingPl: 'O nas',
  aboutSeoTitlePl: 'O nas - RYT',
  aboutSeoDescPl: 'Poznaj RYT - pracownię łączącą precyzję CNC z rzemiosłem w drewnie i gresie.',
  aboutIntroPl:
    'RYT to pracownia łącząca precyzję maszyn CNC z rzemieślniczym wykończeniem. Każdy grawer, każdy detal i każdy element powstaje na realnym sprzęcie - 4-osiowym centrum CNC - nie jest to grafika generowana ani prefabrykat z katalogu.',
  aboutCraftHeadingPl: 'Jak pracujemy',
  aboutCraftBodyPl:
    'Pracujemy w drewnie (dąb, świerk, modrzew, sosna) i gresie, łącząc grawer laserowy i frezowanie CNC. 4-osiowe centrum pozwala nam wychodzić poza płaski grawer - w stronę reliefu, ryflowania i form przestrzennych, które dopiero zaczynamy wprowadzać do oferty.',
  aboutMaterialsHeadingPl: 'Materiał ma znaczenie',
  aboutMaterialsBodyPl:
    'Drewno naturalne - usłojenie, odcień i sęki różnią się w każdym egzemplarzu, dlatego każdy gotowy produkt jest w pewnym sensie niepowtarzalny. Gres wybieramy tam, gdzie liczy się odporność na wilgoć i jednolita powierzchnia.',
  aboutPersonalizationHeadingPl: 'Personalizacja',
  aboutPersonalizationBodyPl:
    'Wiele naszych produktów można personalizować grawerowanym tekstem. Każde zamówienie na indywidualne zlecenie sprawdzamy pod kątem wykonalności, zanim trafi do produkcji.',

  contactHeadingPl: 'Kontakt',
  contactSeoTitlePl: 'Kontakt - RYT',
  contactSeoDescPl: 'Masz pytanie dotyczące zamówienia, dostawy lub oferty? Napisz do nas.',
  contactIntroPl: 'Masz pytanie? Napisz do nas - odpowiadamy najszybciej, jak to możliwe, na podany adres e-mail.',
  contactFormEmailLabelPl: 'E-mail',
  contactFormNameLabelPl: 'Imię i nazwisko (opcjonalnie)',
  contactFormSubjectLabelPl: 'Temat',
  contactFormMessageLabelPl: 'Wiadomość',
  contactFormSubmitPl: 'Wyślij wiadomość',
  contactFormThankYouPl: 'Dziękujemy za wiadomość. Odpowiemy najszybciej, jak to możliwe, na podany adres e-mail.',
  contactOrderContextHeadingPl: 'Masz pytanie o to zamówienie?',
  contactOrderContextIntroPl: 'Napisz do nas w sprawie tego konkretnego zamówienia - Twoja wiadomość zostanie od razu z nim powiązana.',

  // P9 continuation, 2026-08-28 - "informacje kontaktowe i pomoc do firmy"
  // (owner feedback): a real account-section home for the customer's own
  // past support requests, not just a blind submission form.
  accountNavHelpPl: 'Pomoc',
  accountHelpHeadingPl: 'Pomoc i kontakt',
  accountHelpIntroPl: 'Tutaj znajdziesz swoje dotychczasowe zgłoszenia oraz możesz napisać do nas w nowej sprawie.',
  accountHelpRequestsHeadingPl: 'Twoje zgłoszenia',
  accountHelpRequestsEmptyPl: 'Nie masz jeszcze żadnych zgłoszeń.',
  accountHelpNewRequestHeadingPl: 'Nowe zgłoszenie',
  accountHelpOrderContextPl: 'Dotyczy zamówienia',
} as const;
