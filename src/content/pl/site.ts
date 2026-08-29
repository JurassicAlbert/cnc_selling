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
  homeSeoTitlePl: 'RYT — meble i akcesoria z grawerem',
  homeSeoDescPl:
    'Meble, biżuteria i wykończenia wnętrz z drewna i gresu, z personalizowanym grawerem.',

  catalogueHomeLinkPl: 'Strona główna',
  catalogueStartingPricePrefixPl: 'od',
  catalogueProductionTimeLabelPl: 'Czas realizacji',
  catalogueProductionTimeUnitPl: 'dni roboczych',
  catalogueDimensionsLabelPl: 'Wymiary',
  catalogueMaterialsLabelPl: 'Dostępne materiały',
  catalogueCareInstructionsLabelPl: 'Pielęgnacja',
  catalogueInstallationInfoLabelPl: 'Informacje o montażu',
  catalogueInstallationVariantsLabelPl: 'Warianty montażu',
  catalogueMaterialNotesLabelPl: 'Ważne informacje',
  catalogueAvailableDesignsLabelPl: 'Dostępne wzory',
  catalogueEmptyCategoryPl: 'W tej kategorii nie ma jeszcze żadnych produktów.',
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
  // disabled-for-now stub — the real character limit still shown, so it
  // never overpromises what the product will actually allow once enabled.
  configuratorPersonalizationComingSoonPl: (maxCharacters: number) =>
    `Wkrótce dostępne — do ${maxCharacters} znaków`,
  configuratorFontLabelPl: 'Krój pisma',
  configuratorFontRequiredPl: 'Wybierz krój pisma, aby sprawdzić, czy wpisany tekst może zostać wykonany.',
  configuratorPreviewHeadingPl: 'Podgląd',
  configuratorPreviewEmptyPl: 'Wybierz materiał, aby zobaczyć podgląd.',
  configuratorPreviewCaptionPl:
    'Wizualizacja poglądowa złożona z rzeczywistych zdjęć materiału i wzoru zastępczego — ostateczny wygląd produktu może się różnić.',
  configuratorPriceLabelPl: 'Cena',
  configuratorPriceCalculatingPl: 'Obliczanie ceny…',
  configuratorPriceUnavailablePl: 'Podaj wymiary, aby zobaczyć cenę.',
  configuratorPriceUnavailableGenericPl: 'Cena niedostępna dla tej konfiguracji.',
  configuratorModuleCountLabelPl: 'Liczba elementów',
  configuratorAcknowledgeRequiredPl: 'Potwierdzam, że rozumiem powyższą informację.',
  configuratorBlockedPl: 'Ta konfiguracja nie może zostać wykonana. Zmień wybór powyżej.',
  configuratorAddToCartPl: 'Dodaj do koszyka',
  configuratorSaveChangesPl: 'Zapisz zmiany',
  configuratorAddToCartErrorPl:
    'Nie udało się dodać do koszyka. Sprawdź wybory powyżej i spróbuj ponownie.',
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
  // summary — the full sentence above already appears once inside the
  // band's own success `Alert`; repeating it verbatim in the header too
  // made `getByText('Projekt został przesłany.')` match twice in the e2e
  // suite (a real ambiguity, not just a test artifact) once the header
  // started echoing the selection back, same "Colour: Blue" pattern every
  // other band uses.
  configuratorUploadDoneLabelPl: 'Plik przesłany',
  configuratorUploadIpConsentLabelPl: 'Akceptuję powyższe oświadczenie',
  configuratorUploadReplacePl: 'Prześlij inny plik',
  // P9 phase 2 — reusing an already-uploaded design from "Moje wzory" instead of uploading fresh.
  configuratorUploadReuseHeadingPl: 'Masz już zapisany wzór? Możesz go użyć zamiast przesyłać nowy plik.',
  configuratorUploadReuseSelectLabelPl: 'Zapisane wzory',
  configuratorUploadReuseButtonPl: 'Użyj tego wzoru',
  configuratorUploadReuseOrNewPl: 'lub prześlij nowy plik poniżej',
  configuratorUploadReuseSuccessPl: 'Wybrano zapisany wzór.',
  configuratorCustomPriceEstimatePl:
    'Podana cena to wstępny szacunek (materiał, wykończenie, cena bazowa). Ostateczna wycena, uwzględniająca złożoność Twojego projektu, zostanie potwierdzona podczas weryfikacji projektu.',

  // Homepage hero — real claims about how this business actually operates,
  // not generic retail trust-badge copy. No "free shipping"/"money-back
  // guarantee" claims: nothing has confirmed either exists yet.
  heroHeadlinePl: 'Meble i dodatki z grawerem, wykonane na wymiar',
  heroSubcopyPl:
    'Projektujemy i wykonujemy unikalne przedmioty z drewna i gresu — od stołków loftowych po biżuterię — z precyzyjnym grawerem CNC i laserowym.',
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

  cartHeadingPl: 'Koszyk',
  cartEmptyPl: 'Twój koszyk jest pusty.',
  cartContinueShoppingPl: 'Przeglądaj produkty',
  cartQuantityLabelPl: 'Ilość',
  cartUpdateQuantityPl: 'Aktualizuj',
  cartRemovePl: 'Usuń',
  cartDuplicatePl: 'Duplikuj',
  cartEditPl: 'Edytuj',
  // 2026-08-29, cart UI/UX pass — real MUI stepper + a hard per-line cap
  // ("żeby nie było sytuacji w której klient kupuje 10000 sztuk produktu").
  cartQuantityDecreasePl: 'Zmniejsz ilość',
  cartQuantityIncreasePl: 'Zwiększ ilość',
  cartQuantityMaxNoticePl: (max: number) => `Maksymalnie ${max} szt. na jedną pozycję. Większe zamówienia — napisz do nas.`,
  cartItemsCountPl: (count: number) => `${count} ${count === 1 ? 'produkt' : count < 5 ? 'produkty' : 'produktów'} w koszyku`,
  cartSubtotalLabelPl: 'Suma',
  cartCheckoutCtaPl: 'Przejdź do zamówienia',
  cartIncompleteNoticePl:
    'Ta konfiguracja nie może już zostać wykonana w tej formie — edytuj ją przed złożeniem zamówienia.',

  checkoutHeadingPl: 'Zamówienie',
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
  checkoutDeliveryMethodInvalidPl: 'Wybrana metoda dostawy jest już niedostępna — wybierz inną i spróbuj ponownie.',
  checkoutPickupPointLabelPl: 'Wybierz paczkomat lub punkt odbioru',
  checkoutPickupPointSearchPl: 'Wpisz miasto lub kod pocztowy',
  checkoutPickupPointNoneFoundPl: 'Brak punktów dla podanej frazy — spróbuj innego miasta.',
  checkoutPickupPointInvalidPl: 'Wybierz punkt odbioru z listy, aby kontynuować — wybrany punkt jest nieprawidłowy lub nie został jeszcze wybrany.',
  checkoutPickupPointRequiredHintPl: 'Wybierz punkt odbioru powyżej, aby złożyć zamówienie.',
  checkoutPickupPointSampleNoticePl:
    'Lista jest wstępna, nie w pełni aktualna — jeśli nie widzisz Twojego miasta lub konkretnego punktu, napisz do nas po złożeniu zamówienia, a ustalimy to indywidualnie.',
  checkoutDeliveryInfeasibleTagPl: 'Niedostępne dla Twojego koszyka',
  checkoutDeliveryMatchedTierPl: (label: string) => `Rozmiar/waga: ${label}`,
  checkoutFreeShippingAppliedPl: 'Darmowa dostawa — Twoje zamówienie kwalifikuje się do darmowej wysyłki tą metodą.',
  checkoutCourierNoteLabelPl: 'Uwagi dla kuriera (opcjonalnie)',
  checkoutCourierNoteHelperPl: 'Np. kod do bramy, piętro, „zostawić u sąsiada" — trafi na etykietę przesyłki.',
  checkoutInternalNoteLabelPl: 'Uwagi dla nas (opcjonalnie)',
  checkoutInternalNoteHelperPl: 'Coś, co powinniśmy wiedzieć o wysyłce — widoczne tylko dla naszego zespołu.',
  checkoutOrderSummaryHeadingPl: 'Podsumowanie zamówienia',
  orderAwaitingPaymentNoticePl:
    'Czekamy na Twoją wpłatę — dane do przelewu znajdziesz poniżej. Możesz wrócić na tę stronę w dowolnym momencie, aby je sprawdzić.',
  orderCancelledNoticePl: 'To zamówienie zostało anulowane. Jeśli masz pytania, napisz do nas przez formularz poniżej.',
  checkoutPaymentMethodInvalidPl: 'Wybrana metoda płatności jest już niedostępna — wybierz inną i spróbuj ponownie.',
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
   * findable — so this must never read like a generic failure.
   */
  checkoutCartChangedPl:
    'To zamówienie zostało już złożone w innym oknie lub na innej karcie. Nic nie zostało policzone dwa razy — sprawdź swoje zamówienia lub wiadomość e-mail z potwierdzeniem.',
  checkoutEmptyCartRedirectPl: 'Twój koszyk jest pusty — wróć do koszyka, aby dodać produkty.',
  checkoutGenericErrorPl: 'Nie udało się złożyć zamówienia. Sprawdź dane powyżej i spróbuj ponownie.',

  orderConfirmationHeadingPl: 'Zamówienie przyjęte',
  orderItemsHeadingPl: 'Zamówione produkty',
  orderDeliveryMethodHeadingPl: 'Sposób dostawy',
  orderNumberLabelPl: 'Numer zamówienia',
  orderTotalLabelPl: 'Do zapłaty',
  orderBankTransferHeadingPl: 'Dane do przelewu',
  orderBankTransferTitlePl: 'Tytuł przelewu',
  orderBankTransferAccountLabelPl: 'Numer konta',
  orderBankTransferAccountPendingPl:
    'Numer konta do przelewu prześlemy osobno — e-mailem lub podczas kontaktu. Nie zawiera go to potwierdzenie.',
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
    'Status przesyłki jest aktualizowany ręcznie przez nasz zespół, a nie pobierany automatycznie od przewoźnika — może nie odzwierciedlać zmian z ostatnich godzin.',
  orderShipmentNotYetPreparedPl: 'Paczka nie została jeszcze przygotowana do wysyłki.',
  orderEmailFollowUpNoticePl: 'Potwierdzenie zamówienia zostanie przesłane e-mailem.',
  orderNotFoundPl: 'Nie znaleziono takiego zamówienia.',
  orderLookupHeadingPl: 'Sprawdź status zamówienia',
  orderLookupOrderNumberLabelPl: 'Numer zamówienia',
  orderLookupTokenLabelPl: 'Kod dostępu (z potwierdzenia zamówienia)',
  orderLookupSubmitPl: 'Sprawdź',

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

  headerAccountLinkPl: 'Moje konto',
  headerLoginLinkPl: 'Zaloguj się',
  headerLogoutPl: 'Wyloguj się',
  // 2026-08-29, owner request — real navbar restructure: a "Produkty"
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

  // P9 phase 2 — the standalone "moje wzory" upload/reuse library, moved
  // out of being tied to any one product's configurator flow.
  accountDesignsHeadingPl: 'Moje wzory',
  accountDesignsIntroPl:
    'Tutaj znajdziesz wszystkie pliki, które kiedykolwiek przesłałeś/przesłałaś jako własny projekt. Możesz przesłać nowy wzór lub użyć zapisanego podczas konfigurowania dowolnego produktu, który to umożliwia.',
  accountDesignsEmptyPl: 'Nie masz jeszcze żadnych przesłanych wzorów.',
  accountDesignsUploadHeadingPl: 'Prześlij nowy wzór',
  accountDesignsTitleFieldLabelPl: 'Nazwa wzoru (opcjonalnie)',
  accountDesignsTitleFieldPlaceholderPl: 'np. Logo firmy',
  accountDesignsUploadedAtLabelPl: 'Przesłano',
  accountDesignsUntitledPl: 'Bez nazwy',
  accountFavoriteDesignsHeadingPl: 'Ulubione wzory',
  accountFavoriteDesignsEmptyPl: 'Nie masz jeszcze żadnych ulubionych wzorów. Dodaj je z listy wzorów.',
  accountFavoriteDesignsBrowseLinkPl: 'Przeglądaj wzory',
  accountConfigurationEditPl: 'Edytuj',
  accountConfigurationAddToCartPl: 'Dodaj do koszyka',

  // P9 continuation, 2026-08-28 — the customer-visible half of the design
  // review "dyskusja" (`DesignReviewComment.authorType` has always been
  // "staff" | "customer", but no page ever showed it to the customer).
  designDetailBackToListPl: 'Wróć do listy wzorów',
  designDetailStatusLabelPl: 'Status',
  designDetailDiscussionHeadingPl: 'Dyskusja o tym projekcie',
  designDetailDiscussionEmptyPl: 'Brak komentarzy. Jeśli masz pytanie o ten projekt, napisz poniżej.',
  designDetailCommentStaffLabelPl: 'Zespół',
  designDetailCommentCustomerLabelPl: 'Ty',
  designDetailReplyLabelPl: 'Nowa wiadomość',
  designDetailReplySubmitPl: 'Wyślij',
  designDetailReplyEmptyErrorPl: 'Wpisz treść wiadomości.',
  designDetailReplyErrorPl: 'Nie udało się wysłać wiadomości. Spróbuj ponownie.',
  designDetailNotFoundPl: 'Nie znaleziono takiego wzoru.',
  designDetailNeedsChangesNoticePl: 'Ten projekt wymaga poprawy — sprawdź komentarze poniżej i prześlij poprawiony plik.',

  consentBannerTextPl:
    'Używamy niezbędnych plików cookie do działania koszyka i logowania oraz — za Twoją zgodą — plików analitycznych, które pomagają nam ulepszać sklep.',
  consentBannerAcceptPl: 'Akceptuję',
  consentBannerDeclinePl: 'Tylko niezbędne',

  routeLoadingPl: 'Ładowanie…',

  errorPageHeadingPl: 'Coś poszło nie tak',
  errorPageBodyPl: 'Wystąpił nieoczekiwany błąd. Spróbuj odświeżyć stronę.',
  errorPageRetryPl: 'Spróbuj ponownie',
  errorPageCorrelationIdLabelPl: 'Numer błędu',

  blogHeadingPl: 'Blog',
  blogSeoTitlePl: 'Blog — RYT',
  blogSeoDescPl: 'Artykuły o rzemiośle, materiałach i personalizacji grawerem.',
  blogEmptyStatePl: 'Wpisy pojawią się tutaj wkrótce.',
  blogPublishedLabelPl: 'Opublikowano',
  blogReadMorePl: 'Czytaj dalej',
  blogPostNotFoundPl: 'Nie znaleziono takiego wpisu.',
  homeBlogHeadingPl: 'Z naszego bloga',
  blogViewAllPl: 'Zobacz wszystkie posty',

  patternsHeadingPl: 'Wzory',
  patternsSeoTitlePl: 'Wzory — RYT',
  patternsSeoDescPl: 'Przeglądaj nasze gotowe wzory do grawerowania CNC, a także zewnętrzne, darmowe źródła wzorów.',
  patternsIntroPl:
    'Poniżej znajdziesz wzory z naszej oferty, które można wybrać przy konfiguracji wybranych produktów. Możesz też przesłać własny projekt — zapisane wzory znajdziesz na koncie w sekcji „Moje wzory”.',
  patternsEmptyPl: 'Wzory pojawią się tutaj wkrótce.',
  patternsAvailableOnLabelPl: 'Dostępny w:',
  patternsNotAssignedPl: 'Obecnie niedostępny w żadnym zamawianym produkcie.',
  patternsFavoritePl: 'Dodaj do ulubionych',
  patternsUnfavoritePl: 'Usuń z ulubionych',
  patternsFavoriteLoginRequiredPl: 'Zaloguj się, aby dodać do ulubionych',
  patternsExternalHeadingPl: 'Zewnętrzne źródła wzorów',
  patternsExternalIntroPl:
    'To linki do niezależnych, zewnętrznych serwisów z darmowymi wzorami do grawerowania i cięcia CNC. Nie są to nasze materiały — każdy link prowadzi do strony innego dostawcy, gdzie obowiązują jego własne zasady korzystania i licencje.',
  patternsExternalBadgePl: 'zasób zewnętrzny',
  patternsFeaturedBadgePl: 'Wyróżniony',
  // 2026-08-29: real category-filter chips above the grid — DesignCollection groupings, seeded in prisma/seed.ts's DESIGN_COLLECTION_SEEDS.
  patternsAllCategoriesPl: 'Wszystkie',
  patternsExternalEmptyPl: 'Obecnie nie mamy poleconych zewnętrznych źródeł wzorów.',

  collectionsHeadingPl: 'Kolekcje',
  collectionsSeoTitlePl: 'Kolekcje — RYT',
  collectionsSeoDescPl: 'Gotowe, samodzielnie zaprojektowane kolekcje produktów z grawerem — dostępne od ręki, bez konieczności konfiguracji.',
  collectionsIntroPl:
    'To gotowe, samodzielnie zaprojektowane przez nas zestawienia produktów — nie są tworzone na indywidualne zamówienie klienta. Możesz je po prostu przeglądać i zamawiać, tak jak każdy inny produkt w sklepie.',
  collectionsEmptyPl: 'Kolekcje pojawią się tutaj wkrótce.',
  collectionsBadgePl: 'gotowa kolekcja',
  collectionNotFoundPl: 'Nie znaleziono takiej kolekcji.',
  collectionEmptyProductsPl: 'W tej kolekcji nie ma jeszcze żadnych produktów.',

  faqHeadingPl: 'Najczęściej zadawane pytania',
  faqSeoTitlePl: 'Najczęściej zadawane pytania — RYT',
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

  // 2026-08-29, owner request — a real "O nas" (About us) page for the new
  // navbar. Written from facts already established elsewhere in this
  // project (RYT, CNC/laser precision + real craftsmanship, wood + gres,
  // real 4-axis CNC, personalization) — nothing invented.
  aboutHeadingPl: 'O nas',
  aboutSeoTitlePl: 'O nas — RYT',
  aboutSeoDescPl: 'Poznaj RYT — pracownię łączącą precyzję CNC z rzemiosłem w drewnie i gresie.',
  aboutIntroPl:
    'RYT to pracownia łącząca precyzję maszyn CNC z rzemieślniczym wykończeniem. Każdy grawer, każdy detal i każdy element powstaje na realnym sprzęcie — 4-osiowym centrum CNC — nie jest to grafika generowana ani prefabrykat z katalogu.',
  aboutCraftHeadingPl: 'Jak pracujemy',
  aboutCraftBodyPl:
    'Pracujemy w drewnie (dąb, świerk, modrzew, sosna) i gresie, łącząc grawer laserowy i frezowanie CNC. 4-osiowe centrum pozwala nam wychodzić poza płaski grawer — w stronę reliefu, ryflowania i form przestrzennych, które dopiero zaczynamy wprowadzać do oferty.',
  aboutMaterialsHeadingPl: 'Materiał ma znaczenie',
  aboutMaterialsBodyPl:
    'Drewno naturalne — usłojenie, odcień i sęki różnią się w każdym egzemplarzu, dlatego każdy gotowy produkt jest w pewnym sensie niepowtarzalny. Gres wybieramy tam, gdzie liczy się odporność na wilgoć i jednolita powierzchnia.',
  aboutPersonalizationHeadingPl: 'Personalizacja',
  aboutPersonalizationBodyPl:
    'Wiele naszych produktów można personalizować grawerowanym tekstem. Każde zamówienie na indywidualne zlecenie sprawdzamy pod kątem wykonalności, zanim trafi do produkcji.',

  contactHeadingPl: 'Kontakt',
  contactSeoTitlePl: 'Kontakt — RYT',
  contactSeoDescPl: 'Masz pytanie dotyczące zamówienia, dostawy lub oferty? Napisz do nas.',
  contactIntroPl: 'Masz pytanie? Napisz do nas — odpowiadamy najszybciej, jak to możliwe, na podany adres e-mail.',
  contactFormEmailLabelPl: 'E-mail',
  contactFormNameLabelPl: 'Imię i nazwisko (opcjonalnie)',
  contactFormSubjectLabelPl: 'Temat',
  contactFormMessageLabelPl: 'Wiadomość',
  contactFormSubmitPl: 'Wyślij wiadomość',
  contactFormThankYouPl: 'Dziękujemy za wiadomość. Odpowiemy najszybciej, jak to możliwe, na podany adres e-mail.',
  contactOrderContextHeadingPl: 'Masz pytanie o to zamówienie?',
  contactOrderContextIntroPl: 'Napisz do nas w sprawie tego konkretnego zamówienia — Twoja wiadomość zostanie od razu z nim powiązana.',

  // P9 continuation, 2026-08-28 — "informacje kontaktowe i pomoc do firmy"
  // (owner feedback): a real account-section home for the customer's own
  // past support requests, not just a blind submission form.
  accountNavHelpPl: 'Pomoc',
  accountHelpHeadingPl: 'Pomoc i kontakt',
  accountHelpIntroPl: 'Tutaj znajdziesz swoje dotychczasowe zgłoszenia oraz możesz napisać do nas w nowej sprawie.',
  accountHelpRequestsHeadingPl: 'Twoje zgłoszenia',
  accountHelpRequestsEmptyPl: 'Nie masz jeszcze żadnych zgłoszeń.',
  accountHelpNewRequestHeadingPl: 'Nowe zgłoszenie',
  accountHelpOrderContextPl: 'Dotyczy zamówienia',
} as const;
