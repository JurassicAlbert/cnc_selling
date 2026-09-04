/**
 * Staff-facing copy for `/panel/*` - kept separate from `site.ts`/
 * `messages.ts` (customer-facing) per `docs/ARCHITECTURE.md` §16A's framing
 * of the panel as "a separate visual world from the storefront." Still
 * subject to `scripts/check-polish-literals.mjs`.
 */

import type {
  DesignRightsStatus,
  FinishKind,
  GrainDirection,
  InstallationVariantCode,
  MaterialFamily,
  OrderStatus,
  PaymentMethod,
  ProductTypeCode,
  ReviewStatus,
  ShipmentStatus,
  SupportRequestStatus,
  UploadKind,
} from '@/generated/prisma/enums';
import { countPl } from '@/domain/text/plural';

export const ADMIN = {
  navDashboardPl: 'Panel główny',
  navGroupSalesPl: 'Sprzedaż',
  navGroupCatalogPl: 'Katalog',
  navGroupContentPl: 'Treść',
  navGroupSystemPl: 'System',
  navOrdersPl: 'Zamówienia',
  navCustomersPl: 'Klienci',
  navDesignReviewPl: 'Weryfikacja projektów',
  navCategoriesPl: 'Kategorie',
  navProductsPl: 'Produkty',
  navMaterialsPl: 'Materiały',
  navFinishesPl: 'Wykończenia',
  navDesignsPl: 'Wzory',
  navCollectionsPl: 'Kolekcje',
  navExternalPatternResourcesPl: 'Zewnętrzne wzory',
  navProductCollectionsPl: 'Kolekcje produktów',
  navDeliveryMethodsPl: 'Metody dostawy',
  navPaymentMethodsPl: 'Metody płatności',
  navSupportRequestsPl: 'Zgłoszenia kontaktowe',
  navProductionPl: 'Produkcja',
  navFaqPl: 'FAQ',
  navStaticPagesPl: 'Strony',
  navBlogPl: 'Blog',
  navReviewsPl: 'Opinie',
  navSettingsPl: 'Ustawienia',
  navPricingPl: 'Cennik',
  navWarehousePl: 'Magazyn',
  navAuditLogPl: 'Dziennik zdarzeń',
  logoutPl: 'Wyloguj się',

  dashboardHeadingPl: 'Panel główny',
  dashboardKpiOrdersTodayPl: 'Zamówienia dzisiaj',
  dashboardKpiOrders7dPl: 'Zamówienia (7 dni)',
  dashboardKpiOrders30dPl: 'Zamówienia (30 dni)',
  dashboardKpiRevenueNetPl: 'Przychód netto (30 dni)',
  dashboardKpiRevenueGrossPl: 'Przychód brutto (30 dni)',
  dashboardKpiAovPl: 'Średnia wartość zamówienia',
  dashboardKpiAwaitingPaymentPl: 'Oczekują na płatność',
  dashboardKpiDesignsAwaitingReviewPl: 'Projekty do weryfikacji',
  dashboardKpiOrdersInProductionPl: 'Zamówienia w produkcji',
  dashboardDateRangeFromPl: 'Od',
  dashboardDateRangeToPl: 'Do',
  dashboardDateRangeApplyPl: 'Zastosuj',
  dashboardRevenueChartTitlePl: 'Przychód w czasie',
  dashboardRevenueNetLabelPl: 'Netto',
  dashboardRevenueGrossLabelPl: 'Brutto',
  dashboardOrdersByStatusChartTitlePl: 'Zamówienia wg statusu',
  dashboardOrdersLabelPl: 'Zamówienia',
  dashboardTopEntitiesChartTitlePl: 'Najlepiej sprzedające się',
  dashboardTopProductsPl: 'Produkty',
  dashboardTopDesignsPl: 'Wzory',
  dashboardTopMaterialsPl: 'Materiały',
  dashboardTopEntitiesEmptyPl: 'Brak danych sprzedażowych w wybranym zakresie.',
  dashboardProductionLoadTitlePl: 'Obciążenie produkcji',

  globalSearchTriggerPl: 'Szukaj (Ctrl+K)',
  globalSearchPlaceholderPl: 'Szukaj zamówień, klientów, wzorów, produktów…',
  globalSearchHintPl: 'Zacznij pisać, aby wyszukać.',
  globalSearchNoResultsPl: 'Brak wyników.',
  globalSearchOrdersHeadingPl: 'Zamówienia',
  globalSearchCustomersHeadingPl: 'Klienci',
  globalSearchDesignsHeadingPl: 'Wzory',
  globalSearchProductsHeadingPl: 'Produkty',

  savePl: 'Zapisz',
  cancelPl: 'Anuluj',
  addPl: 'Dodaj',
  removePl: 'Usuń',
  activatePl: 'Aktywuj',
  deactivatePl: 'Dezaktywuj',
  activeLabelPl: 'Aktywna',
  inactiveLabelPl: 'Nieaktywna',
  duplicatePl: 'Duplikuj',
  bulkClearSelectionPl: 'Wyczyść zaznaczenie',
  previewAsCustomerPl: 'Zobacz jako klient',
  productPreviewBannerPl: 'Podgląd administratora - ta odsłona strony nie jest liczona jako wizyta klienta.',

  csvImportHeadingPl: 'Import z pliku CSV',
  csvImportColumnsHintPl: 'Oczekiwane kolumny w pierwszym wierszu',
  csvImportFieldFilePl: 'Plik CSV',
  csvImportButtonPl: 'Importuj',
  csvImportPendingPl: 'Importowanie…',
  csvImportSkippedHeadingPl: 'Pominięte wiersze',
  csvImportColumnRowPl: 'Wiersz',
  csvImportColumnSlugPl: 'Slug',
  csvImportColumnReasonPl: 'Powód',

  categoriesHeadingPl: 'Kategorie',
  categoriesNewPl: 'Nowa kategoria',
  categoriesEmptyPl: 'Brak kategorii. Dodaj pierwszą, aby rozpocząć budowę katalogu.',
  categoriesColumnNamePl: 'Nazwa',
  categoriesColumnSlugPl: 'Identyfikator URL',
  categoriesColumnProductsPl: 'Produkty',
  categoriesColumnStatusPl: 'Status',
  categoryNotFoundPl: 'Nie znaleziono kategorii.',
  categoryFieldSlugPl: 'Identyfikator URL (slug)',
  categoryFieldNamePl: 'Nazwa',
  categoryFieldDescPl: 'Opis',
  categoryFieldSeoTitlePl: 'Tytuł SEO',
  categoryFieldSeoDescPl: 'Opis SEO',
  categoryFieldImageUrlPl: 'Adres URL zdjęcia',
  categoryFieldSortOrderPl: 'Kolejność wyświetlania',

  productsHeadingPl: 'Produkty',
  productsNewPl: 'Nowy produkt',
  productsEmptyPl: 'Brak produktów. Dodaj pierwszy, aby pojawił się w sklepie.',
  productsFilteredEmptyPl: 'Brak produktów spełniających wybrane kryteria. Spróbuj zmienić filtry.',
  productsFilterCategoryPl: 'Kategoria',
  productsFilterTypePl: 'Typ',
  productsColumnNamePl: 'Nazwa',
  productsColumnSlugPl: 'Identyfikator URL',
  productsColumnCategoryPl: 'Kategoria',
  productsColumnStatusPl: 'Status',
  productNotFoundPl: 'Nie znaleziono produktu.',

  productFieldSlugPl: 'Identyfikator URL (slug)',
  productFieldTypeCodePl: 'Typ produktu',
  productFieldCategoryPl: 'Kategoria',
  productFieldNamePl: 'Nazwa',
  productFieldShortDescPl: 'Krótki opis',
  productFieldLongDescPl: 'Pełny opis',
  productFieldCareInstructionsPl: 'Instrukcje pielęgnacji',
  productFieldInstallationInfoPl: 'Informacje o montażu',
  productFieldMaterialNotesPl: 'Uwagi o materiale',
  productFieldSeoTitlePl: 'Tytuł SEO',
  productFieldSeoDescPl: 'Opis SEO',
  productFieldBasePricePl: 'Cena bazowa (zł)',
  productFieldMinPricePl: 'Cena minimalna (zł)',
  productFieldProductionDaysMinPl: 'Czas realizacji od (dni)',
  productFieldProductionDaysMaxPl: 'Czas realizacji do (dni)',
  productFieldMinWidthPl: 'Min. szerokość (mm)',
  productFieldMaxWidthPl: 'Maks. szerokość (mm)',
  productFieldMinHeightPl: 'Min. wysokość (mm)',
  productFieldMaxHeightPl: 'Maks. wysokość (mm)',
  productFieldAllowsCustomSizePl: 'Umożliwia dowolny wymiar',
  productFieldRequiresExactSizePl: 'Wymaga podania dokładnego wymiaru',
  productFieldSortOrderPl: 'Kolejność wyświetlania',

  productSectionCorePl: 'Dane podstawowe',
  productSectionDimensionsPl: 'Wymiary i cena',
  productSectionPresetSizesPl: 'Gotowe rozmiary',
  productSectionThicknessesPl: 'Grubości',
  productSectionMaterialsPl: 'Dostępne materiały',
  productSectionDesignsPl: 'Przypisane wzory',
  productSectionInstallVariantsPl: 'Warianty montażu',
  productSectionImagesPl: 'Zdjęcia',

  presetSizeFieldWidthPl: 'Szerokość (mm)',
  presetSizeFieldHeightPl: 'Wysokość (mm)',
  presetSizeFieldLabelPl: 'Etykieta',
  presetSizesEmptyPl: 'Brak zdefiniowanych gotowych rozmiarów.',

  thicknessFieldMmPl: 'Grubość (mm)',
  thicknessFieldLabelPl: 'Etykieta',
  thicknessFieldPriceFactorPl: 'Mnożnik ceny (%)',
  thicknessesEmptyPl: 'Brak zdefiniowanych grubości.',

  materialCompatFieldMaterialPl: 'Materiał',
  materialCompatFieldPriceFactorPl: 'Mnożnik ceny (%)',
  materialCompatEmptyPl: 'Żaden materiał nie jest jeszcze przypisany.',

  designAssignFieldDesignPl: 'Wzór',
  designAssignFieldSurchargePl: 'Dopłata (zł)',
  designAssignEmptyPl: 'Żaden wzór nie jest jeszcze przypisany.',

  installVariantFieldCodePl: 'Wariant',
  installVariantFieldNamePl: 'Nazwa',
  installVariantFieldDescPl: 'Opis',
  installVariantFieldReceivesPl: 'Co otrzymuje klient',
  installVariantFieldDiagramUrlPl: 'Adres URL diagramu',
  installVariantFieldMaxThicknessPl: 'Maks. grubość podkładu (mm)',
  installVariantFieldPriceFactorPl: 'Mnożnik ceny (%)',
  installVariantsEmptyPl: 'Brak zdefiniowanych wariantów montażu.',

  imageFieldAltPl: 'Tekst alternatywny (alt)',
  imageUploadPl: 'Dodaj zdjęcie',
  fileChoosePl: 'Wybierz plik',
  imageSetPrimaryPl: 'Ustaw jako główne',
  imagePrimaryLabelPl: 'Główne',
  imagesEmptyPl: 'Brak zdjęć.',

  ordersHeadingPl: 'Zamówienia',
  ordersFilterStatusPl: 'Status',
  ordersFilterPaymentStatusPl: 'Status płatności',
  ordersFilterSearchPl: 'Numer zamówienia lub e-mail',
  ordersFilterAnyPl: 'Wszystkie',
  ordersFilterApplyPl: 'Filtruj',
  ordersEmptyPl: 'Brak zamówień spełniających kryteria.',
  ordersColumnNumberPl: 'Numer',
  ordersColumnCustomerPl: 'Klient',
  ordersColumnStatusPl: 'Status',
  ordersColumnPaymentPl: 'Płatność',
  ordersColumnTotalPl: 'Kwota',
  ordersColumnDatePl: 'Data',

  orderNotFoundPl: 'Nie znaleziono zamówienia.',
  orderBuyerHeadingPl: 'Dane zamawiającego',
  orderDeliveryHeadingPl: 'Dostawa',
  orderCourierNoteLabelPl: 'Uwagi dla kuriera',
  orderInternalShipmentNoteLabelPl: 'Uwagi wewnętrzne o przesyłce',
  orderProductionNotesHeadingPl: 'Notatki produkcyjne',
  orderProductionNotesEmptyPl: 'Brak notatek.',
  orderEventsHeadingPl: 'Historia statusów',
  orderMarkPaidPl: 'Oznacz jako opłacone',
  orderMarkPaidDonePl: 'Opłacone',
  orderCancelNoteLabelPl: 'Notatka (wymagana przy anulowaniu)',
  orderCancelConfirmTitlePl: 'Anulować zamówienie?',
  orderCancelConfirmMessagePl: 'Tej operacji nie można cofnąć - status „Anulowane” jest ostateczny.',
  orderCancelConfirmButtonPl: 'Tak, anuluj zamówienie',
  orderTransitionNotePl: 'Notatka (opcjonalna)',
  orderDesignBlockedPl: 'Projekt klienta oczekuje na weryfikację - nie można przejść dalej, dopóki nie zostanie zatwierdzony.',

  designReviewHeadingPl: 'Weryfikacja projektów',
  designReviewEmptyPl: 'Brak projektów oczekujących na weryfikację.',
  designReviewColumnFilePl: 'Plik',
  designReviewColumnCustomerPl: 'Klient',
  designReviewColumnDatePl: 'Data przesłania',
  designReviewNotFoundPl: 'Nie znaleziono projektu.',
  designReviewOriginalFilePl: 'Pobierz oryginalny plik',
  designReviewWarningsHeadingPl: 'Ostrzeżenia automatyczne',
  designReviewNoWarningsPl: 'Brak ostrzeżeń.',
  designReviewCommentsHeadingPl: 'Komentarze',
  designReviewCommentLabelPl: 'Nowy komentarz (widoczny dla klienta)',
  designReviewProductionMethodLabelPl: 'Metoda produkcji',
  designReviewApprovePl: 'Zatwierdź',
  designReviewRequestChangesPl: 'Poproś o zmiany',
  designReviewRejectPl: 'Odrzuć',

  materialsHeadingPl: 'Materiały',
  materialsNewPl: 'Nowy materiał',
  materialsEmptyPl: 'Brak materiałów. Dodaj pierwszy, aby móc przypisać go do produktów.',
  materialsColumnNamePl: 'Nazwa',
  materialsColumnFamilyPl: 'Rodzina',
  materialsColumnStatusPl: 'Status',
  materialNotFoundPl: 'Nie znaleziono materiału.',
  materialFieldSlugPl: 'Identyfikator URL (slug)',
  materialFieldNamePl: 'Nazwa',
  materialFieldFamilyPl: 'Rodzina materiału',
  materialFieldShortDescPl: 'Krótki opis',
  materialFieldCharacteristicsPl: 'Charakterystyka',
  materialFieldImagePl: 'Zdjęcie',
  materialFieldImageReplacePl: 'Nowe zdjęcie (opcjonalnie, zastąpi obecne)',
  materialFieldPricePl: 'Cena za m² (zł)',
  materialFieldDensityPl: 'Gęstość (kg/m³)',
  materialFieldDensityHelperPl: 'Do wyliczenia realnej wagi przesyłki.',
  materialFieldMaxSheetWidthPl: 'Maks. szerokość arkusza (mm)',
  materialFieldMaxSheetHeightPl: 'Maks. wysokość arkusza (mm)',
  materialFieldMinLineWidthPl: 'Min. szerokość linii (µm)',
  materialFieldMinDetailSpacingPl: 'Min. odstęp detali (µm)',
  materialFieldMinTextHeightPl: 'Min. wysokość tekstu (µm)',
  materialFieldGrainDirectionPl: 'Kierunek usłojenia',
  materialFieldSupportsCncPl: 'Obsługuje CNC',
  materialFieldSupportsLaserPl: 'Obsługuje laser',
  materialFieldNaturalVariablePl: 'Naturalna zmienność (rysunek, sęki, kolor)',
  materialFieldSortOrderPl: 'Kolejność wyświetlania',
  materialFinishesHeadingPl: 'Zgodne wykończenia',
  materialFinishesEmptyPl: 'Żadne wykończenie nie jest jeszcze przypisane.',
  materialFinishFieldPl: 'Wykończenie',

  finishesHeadingPl: 'Wykończenia',
  finishesNewPl: 'Nowe wykończenie',
  finishesEmptyPl: 'Brak wykończeń. Dodaj pierwsze, aby móc przypisać je do materiałów.',
  finishesColumnNamePl: 'Nazwa',
  finishesColumnKindPl: 'Rodzaj',
  finishesColumnStatusPl: 'Status',
  finishNotFoundPl: 'Nie znaleziono wykończenia.',
  finishFieldSlugPl: 'Identyfikator URL (slug)',
  finishFieldNamePl: 'Nazwa',
  finishFieldKindPl: 'Rodzaj wykończenia',
  finishFieldDescPl: 'Opis',
  finishFieldImagePl: 'Zdjęcie',
  finishFieldImageReplacePl: 'Nowe zdjęcie (opcjonalnie, zastąpi obecne)',
  finishFieldPricePl: 'Cena za m² (zł)',
  finishFieldSetupFeePl: 'Opłata przygotowawcza (zł)',
  finishFieldExtraDaysMinPl: 'Dodatkowy czas od (dni)',
  finishFieldExtraDaysMaxPl: 'Dodatkowy czas do (dni)',
  finishFieldSortOrderPl: 'Kolejność wyświetlania',

  collectionsHeadingPl: 'Kolekcje',
  collectionsNewPl: 'Nowa kolekcja',
  collectionsEmptyPl: 'Brak kolekcji. Dodaj pierwszą, aby pogrupować wzory.',
  collectionsColumnNamePl: 'Nazwa',
  collectionsColumnDesignsPl: 'Wzory',
  collectionsColumnStatusPl: 'Status',
  collectionNotFoundPl: 'Nie znaleziono kolekcji.',
  collectionFieldSlugPl: 'Identyfikator URL (slug)',
  collectionFieldNamePl: 'Nazwa',
  collectionFieldDescPl: 'Opis',
  collectionFieldSortOrderPl: 'Kolejność wyświetlania',

  designsHeadingPl: 'Wzory',
  designsNewPl: 'Nowy wzór',
  designsEmptyPl: 'Brak wzorów. Dodaj pierwszy, aby móc przypisać go do produktów.',
  designsColumnCodePl: 'Kod',
  designsColumnNamePl: 'Nazwa',
  designsColumnRightsPl: 'Prawa',
  designsColumnStatusPl: 'Status',
  designNotFoundPl: 'Nie znaleziono wzoru.',
  designSectionCorePl: 'Dane podstawowe',
  designSectionProductionPl: 'Metadane produkcyjne',
  designSectionRightsPl: 'Prawa i pochodzenie',
  designFieldSlugPl: 'Identyfikator URL (slug)',
  designFieldCodePl: 'Kod (stały identyfikator na hali)',
  designFieldNamePl: 'Nazwa',
  designFieldDescPl: 'Opis',
  designFieldCollectionPl: 'Kolekcja',
  designFieldCollectionNonePl: '- brak -',
  designFieldTagsPl: 'Tagi (oddzielone przecinkami)',
  designFieldThumbnailPl: 'Miniatura',
  designFieldThumbnailReplacePl: 'Nowa miniatura (opcjonalnie, zastąpi obecną)',
  designFieldPreviewPl: 'Obraz podglądu',
  designFieldPreviewReplacePl: 'Nowy obraz podglądu (opcjonalnie, zastąpi obecny)',
  designFieldReferenceWidthPl: 'Szerokość referencyjna (mm)',
  designFieldMinLineWidthPl: 'Min. szerokość linii (µm)',
  designFieldMinDetailSpacingPl: 'Min. odstęp detali (µm)',
  designFieldMinEngraveDepthPl: 'Min. głębokość grawerowania (µm)',
  designFieldRecommendedMethodPl: 'Zalecana metoda produkcji',
  designFieldMinRecommendedWidthPl: 'Min. zalecana szerokość (mm)',
  designFieldMaxRecommendedWidthPl: 'Maks. zalecana szerokość (mm)',
  designFieldDetailLevelPl: 'Poziom szczegółowości (1–5)',
  designFieldMachiningTimePl: 'Czas obróbki (tysięczne minuty/m²)',
  designFieldRightsStatusPl: 'Status praw',
  designFieldSourceArtistPl: 'Autor',
  designFieldSourceTitlePl: 'Tytuł źródłowy',
  designFieldSourceYearPl: 'Rok powstania',
  designFieldArtistDeathYearPl: 'Rok śmierci autora',
  designFieldSourceRefPl: 'Źródło / odnośnik',
  designFieldRightsNotesPl: 'Uwagi dot. praw',
  designFieldSortOrderPl: 'Kolejność wyświetlania',
  designFieldFeaturedPl: 'Wzór wyróżniony',
  designMaterialsHeadingPl: 'Zgodne materiały',
  designMaterialsEmptyPl: 'Żaden materiał nie jest jeszcze przypisany - brak wpisów oznacza, że dostępny jest każdy materiał dopuszczony przez produkt.',
  designMaterialFieldPl: 'Materiał',

  productionHeadingPl: 'Produkcja',
  productionCapacityAreaLabelPl: 'Zajęta powierzchnia w kolejce',
  productionCapacityMinutesLabelPl: 'Czas maszynowy w kolejce',
  productionCapacityWeeklyLabelPl: 'Tygodniowa pojemność',
  productionCapacityUnconfiguredPl: 'Tygodniowa pojemność nie jest jeszcze skonfigurowana (Ustawienia).',
  productionQueueEmptyPl: 'Brak zamówień w tej sekcji.',
  productionColumnOrderPl: 'Zamówienie',
  productionColumnCustomerPl: 'Klient',
  productionColumnModulesPl: 'Moduły',
  productionColumnAreaPl: 'Powierzchnia (m²)',

  orderManifestHeadingPl: 'Manifest modułów',
  orderManifestEmptyPl: 'Ten produkt nie jest podzielony na moduły.',
  orderManifestColumnCodePl: 'Kod',
  orderManifestColumnSizePl: 'Wymiary (mm)',
  orderManifestColumnOrderPl: 'Kolejność produkcji',
  orderBriefLinkPl: 'Karta produkcyjna (do druku)',
  orderPackingListLinkPl: 'Lista pakowania (do druku)',

  productionBriefHeadingPl: 'Karta produkcyjna',
  productionBriefNotAFilePl: 'Karta produkcyjna - nie jest to plik produkcyjny CNC/laserowy.',
  productionBriefPrintPl: 'Drukuj',
  productionBriefOrderLabelPl: 'Zamówienie',
  productionBriefProductLabelPl: 'Produkt',
  productionBriefDesignLabelPl: 'Kod wzoru',
  productionBriefMaterialLabelPl: 'Materiał',
  productionBriefFinishLabelPl: 'Wykończenie',
  productionBriefSizeLabelPl: 'Wymiary',
  productionBriefThicknessLabelPl: 'Grubość',
  productionBriefPersonalizationLabelPl: 'Personalizacja',
  productionBriefModulesHeadingPl: 'Moduły',

  packingListHeadingPl: 'Lista pakowania',
  packingListNotAShippingLabelPl: 'Lista pakowania - nie jest to etykieta wysyłkowa ani list przewozowy.',
  packingListRecipientHeadingPl: 'Adres dostawy',
  packingListItemsHeadingPl: 'Elementy do spakowania',
  packingListColumnItemPl: 'Element',
  packingListColumnDetailsPl: 'Szczegóły',
  packingListColumnQuantityPl: 'Ilość szt.',
  packingListColumnCheckPl: 'Spakowano',
  packingListTotalPiecesPl: 'Łączna liczba elementów do spakowania',
  packingListPackedByLabelPl: 'Spakował(a) (imię i nazwisko, data)',

  faqHeadingPl: 'FAQ',
  faqNewPl: 'Nowe pytanie',
  faqEmptyPl: 'Brak pytań. Dodaj pierwsze, aby pojawiło się na stronie FAQ.',
  faqColumnQuestionPl: 'Pytanie',
  faqColumnStatusPl: 'Status',
  faqFieldQuestionPl: 'Pytanie',
  faqFieldAnswerPl: 'Odpowiedź',
  faqFieldSortOrderPl: 'Kolejność wyświetlania',

  externalPatternResourcesHeadingPl: 'Zewnętrzne źródła wzorów',
  externalPatternResourcesNewPl: 'Nowy zasób',
  externalPatternResourcesEmptyPl: 'Brak zasobów. Dodaj pierwszy, aby pojawił się na stronie Wzory.',
  externalPatternResourcesColumnNamePl: 'Nazwa',
  externalPatternResourcesColumnSourcePl: 'Źródło',
  externalPatternResourcesColumnStatusPl: 'Status',
  externalPatternResourcesFieldNamePl: 'Nazwa',
  externalPatternResourcesFieldUrlPl: 'Adres URL',
  externalPatternResourcesFieldDescPl: 'Opis (opcjonalnie)',
  externalPatternResourcesFieldSourceLabelPl: 'Etykieta źródła (np. „3axis.co”)',
  externalPatternResourcesFieldSortOrderPl: 'Kolejność wyświetlania',

  productCollectionsHeadingPl: 'Kolekcje produktów',
  productCollectionsNewPl: 'Nowa kolekcja',
  productCollectionsEmptyPl: 'Brak kolekcji. Dodaj pierwszą, aby pojawiła się na stronie /kolekcje.',
  productCollectionColumnNamePl: 'Nazwa',
  productCollectionColumnProductCountPl: 'Liczba produktów',
  productCollectionColumnStatusPl: 'Status',
  productCollectionFieldSlugPl: 'Identyfikator URL (slug)',
  productCollectionFieldNamePl: 'Nazwa',
  productCollectionFieldDescPl: 'Opis',
  productCollectionFieldImageUrlPl: 'Adres URL zdjęcia (opcjonalnie)',
  productCollectionFieldSortOrderPl: 'Kolejność wyświetlania',
  productCollectionItemsHeadingPl: 'Produkty w kolekcji',
  productCollectionItemsEmptyPl: 'Brak produktów w tej kolekcji.',
  productCollectionItemsFieldProductPl: 'Produkt',
  productCollectionItemsFieldSortOrderPl: 'Kolejność',

  deliveryMethodsHeadingPl: 'Metody dostawy',
  deliveryMethodsNewPl: 'Nowa metoda',
  deliveryMethodsEmptyPl: 'Brak metod dostawy. Dodaj pierwszą, aby pojawiła się w koszyku.',
  deliveryMethodColumnNamePl: 'Nazwa',
  deliveryMethodColumnPricePl: 'Cena',
  deliveryMethodColumnStatusPl: 'Status',
  deliveryMethodFieldNamePl: 'Nazwa',
  deliveryMethodFieldDescPl: 'Opis',
  deliveryMethodFieldCarrierPl: 'Przewoźnik (opcjonalnie)',
  deliveryMethodFieldPricePl: 'Cena (zł)',
  deliveryMethodFieldFreeThresholdPl: 'Próg darmowej dostawy (zł, opcjonalnie)',
  deliveryMethodFieldFreeThresholdHelperPl: 'Powyżej tej wartości zamówienia (netto) dostawa tą metodą jest darmowa. Zostaw puste, jeśli nigdy nie jest darmowa.',
  deliveryMethodFieldDaysMinPl: 'Czas dostawy od (dni)',
  deliveryMethodFieldDaysMaxPl: 'Czas dostawy do (dni)',
  deliveryMethodFieldTrackingAvailablePl: 'Śledzenie przesyłki dostępne',
  deliveryMethodFieldRequiresPickupPointPl: 'Wymaga wyboru paczkomatu/punktu odbioru',
  deliveryMethodFieldSortOrderPl: 'Kolejność wyświetlania',
  /**
   * 2026-08-30 (`docs/AUDIT-2026-08-30.md` §20). The panel showed an
   * editable "Cena" and nothing else, while for a tiered carrier that field
   * is never what a customer is charged - the brackets below are. The copy
   * has to say so plainly, or the screen stays misleading even with the
   * editor added.
   */
  deliveryTiersHeadingPl: 'Progi wagowe (cennik przewoźnika)',
  deliveryTiersIntroPl:
    'Jeśli metoda ma progi wagowe, to one decydują o cenie dostawy - naliczany jest najtańszy próg, w którym mieszczą się waga i wymiary zamówienia. Pole „Cena” powyżej działa wtedy wyłącznie jako wartość zapasowa i nie jest naliczane klientowi.',
  deliveryTiersEmptyPl:
    'Brak progów wagowych - ta metoda nalicza stałą cenę z pola „Cena” powyżej. Dodaj progi, aby wyceniać dostawę według rzeczywistego cennika przewoźnika.',
  deliveryTierFieldLabelPl: 'Nazwa progu',
  deliveryTierFieldMaxWeightKgPl: 'Waga do (kg)',
  deliveryTierFieldPricePlnPl: 'Cena (zł)',
  deliveryTierFieldMaxWidthMmPl: 'Maks. szer. (mm)',
  deliveryTierFieldMaxHeightMmPl: 'Maks. wys. (mm)',
  deliveryTierFieldMaxDepthMmPl: 'Maks. gł. (mm)',
  deliveryTierDimensionsHelperPl:
    'Wymiary wypełnij tylko przy realnym ograniczeniu fizycznym, np. skrytce paczkomatu. Puste = brak limitu wymiarów dla tego progu.',
  deliveryTierNoDimensionLimitPl: 'bez limitu wymiarów',

  paymentMethodsHeadingPl: 'Metody płatności',
  paymentMethodsNewPl: 'Nowa metoda',
  paymentMethodsEmptyPl: 'Brak metod płatności. Dodaj pierwszą, aby pojawiła się w koszyku.',
  paymentMethodColumnNamePl: 'Nazwa',
  paymentMethodColumnProviderPl: 'Dostawca',
  paymentMethodColumnConnectedPl: 'Połączona',
  paymentMethodColumnStatusPl: 'Status',
  paymentMethodFieldNamePl: 'Nazwa',
  paymentMethodFieldDescPl: 'Opis',
  paymentMethodFieldProviderPl: 'Dostawca',
  paymentMethodFieldSortOrderPl: 'Kolejność wyświetlania',
  paymentMethodConnectedYesPl: 'Połączona - dostępna w kasie',
  paymentMethodConnectedNoPl: 'Niepołączona - nie jest jeszcze dostępna w kasie',
  paymentMethodConnectedHelperPl:
    'To pole jest ustawiane wyłącznie przez rzeczywistą integrację techniczną, nie z tego formularza - dzięki temu żadna metoda płatności nie może zostać omyłkowo „włączona” bez faktycznego podłączenia.',

  shipmentHeadingPl: 'Wysyłka',
  shipmentSavePl: 'Zapisz wysyłkę',
  shipmentFieldStatusPl: 'Status',
  shipmentFieldCarrierPl: 'Przewoźnik',
  shipmentFieldTrackingNumberPl: 'Numer przesyłki',
  shipmentFieldShippedAtPl: 'Data nadania',
  shipmentFieldEstimatedDeliveryAtPl: 'Przewidywana data dostawy',
  shipmentFieldDeliveredAtPl: 'Data dostarczenia',
  shipmentFieldCustomerNotesPl: 'Uwagi widoczne dla klienta',
  shipmentFieldIssueDescriptionPl: 'Opis problemu (wewnętrzny i widoczny dla klienta)',
  shipmentFieldIssueResolutionPl: 'Rozwiązanie problemu (wewnętrzne)',
  shipmentFieldInternalNotesPl: 'Notatki wewnętrzne',
  shipmentManualNoticePl: 'Status jest ustawiany ręcznie - brak integracji z API przewoźnika w tym projekcie.',

  supportRequestsHeadingPl: 'Zgłoszenia kontaktowe',
  supportRequestsEmptyPl: 'Brak zgłoszeń kontaktowych.',
  supportRequestColumnSubjectPl: 'Temat',
  supportRequestColumnEmailPl: 'E-mail',
  supportRequestColumnOrderPl: 'Zamówienie',
  supportRequestColumnStatusPl: 'Status',
  supportRequestColumnCreatedAtPl: 'Data zgłoszenia',
  supportRequestFieldEmailPl: 'E-mail',
  supportRequestFieldNamePl: 'Imię i nazwisko',
  supportRequestFieldMessagePl: 'Wiadomość',
  supportRequestFieldStatusPl: 'Status',
  supportRequestFieldAdminNotesPl: 'Notatki wewnętrzne',
  supportRequestSavePl: 'Zapisz',
  supportRequestOrderContextPl: 'Dotyczy zamówienia',
  supportRequestNoOrderContextPl: 'Zgłoszenie ogólne (bez powiązanego zamówienia)',

  staticPagesHeadingPl: 'Strony',
  staticPagesNewPl: 'Nowa strona',
  staticPagesEmptyPl: 'Brak stron. Dodaj pierwszą, aby pojawiła się pod adresem /strony/...',
  staticPagesColumnTitlePl: 'Tytuł',
  staticPagesColumnSlugPl: 'Identyfikator URL',
  staticPagesColumnStatusPl: 'Status',
  staticPageFieldSlugPl: 'Identyfikator URL (slug)',
  staticPageFieldTitlePl: 'Tytuł',
  staticPageFieldBodyPl: 'Treść',
  staticPageFieldSeoTitlePl: 'Tytuł SEO',
  staticPageFieldSeoDescPl: 'Opis SEO',
  staticPageFieldSortOrderPl: 'Kolejność wyświetlania',

  blogPostsHeadingPl: 'Blog',
  blogPostsNewPl: 'Nowy wpis',
  blogPostsEmptyPl: 'Brak wpisów. Dodaj pierwszy, aby uruchomić bloga.',
  blogPostsColumnTitlePl: 'Tytuł',
  blogPostsColumnSlugPl: 'Identyfikator URL',
  blogPostsColumnStatusPl: 'Status',
  blogPostsColumnPublishedPl: 'Publikacja',
  blogPostPublishedLabelPl: 'Opublikowany',
  blogPostDraftLabelPl: 'Wersja robocza',
  blogPostScheduledLabelPl: 'Zaplanowany',
  blogPostFieldSlugPl: 'Identyfikator URL (slug)',
  blogPostFieldTitlePl: 'Tytuł',
  blogPostFieldShortDescPl: 'Krótki opis (na liście i w kartach)',
  blogPostFieldBodyPl: 'Treść',
  blogPostFieldSeoTitlePl: 'Tytuł SEO',
  blogPostFieldSeoDescPl: 'Opis SEO',
  blogPostFieldImageUrlPl: 'Adres URL obrazu wyróżniającego',
  blogPostFieldSortOrderPl: 'Kolejność wyświetlania',
  blogPostFieldPublishedAtPl: 'Data publikacji',
  blogPostPublishedAtHintPl: 'Puste pole = wersja robocza, niewidoczna publicznie. Data w przyszłości = zaplanowana publikacja.',

  reviewsHeadingPl: 'Opinie',
  reviewsEmptyPl: 'Brak opinii.',
  reviewsFilterStatusPl: 'Status',
  reviewsColumnOrderPl: 'Zamówienie',
  reviewsColumnAuthorPl: 'Autor',
  reviewsColumnRatingPl: 'Ocena',
  reviewsColumnBodyPl: 'Treść',
  reviewsColumnDatePl: 'Data',
  reviewApprovePl: 'Zatwierdź',
  reviewRejectPl: 'Odrzuć',

  customersHeadingPl: 'Klienci',
  customersFilterSearchPl: 'Imię i nazwisko lub e-mail',
  customersEmptyPl: 'Brak klientów spełniających kryteria.',
  customersColumnNamePl: 'Imię i nazwisko',
  customersColumnEmailPl: 'E-mail',
  customersColumnOrdersPl: 'Zamówienia',
  customersColumnRegisteredPl: 'Data rejestracji',
  customerAnonymizedChipPl: 'Zanonimizowany',
  customerNotFoundPl: 'Nie znaleziono klienta.',

  customerProfileHeadingPl: 'Dane klienta',
  customerFieldEmailPl: 'E-mail',
  customerFieldPhonePl: 'Telefon',
  customerFieldRegisteredPl: 'Data rejestracji',
  customerOrdersHeadingPl: 'Zamówienia',
  customerOrdersEmptyPl: 'Brak zamówień.',
  customerConfigurationsHeadingPl: 'Zapisane konfiguracje',
  customerConfigurationsEmptyPl: 'Brak zapisanych konfiguracji.',
  customerFilesHeadingPl: 'Przesłane pliki',
  customerFilesEmptyPl: 'Brak przesłanych plików.',
  customerFilesColumnNamePl: 'Nazwa',
  customerFilesColumnKindPl: 'Rodzaj',
  customerFilesColumnSizePl: 'Rozmiar',
  customerFilesColumnDatePl: 'Data',

  customerRodoHeadingPl: 'RODO',
  customerExportLinkPl: 'Pobierz dane (RODO)',
  customerAnonymizeHeadingPl: 'Anonimizacja konta',
  customerAnonymizeWarningPl:
    'Nieodwracalne: dane osobowe klienta zostaną usunięte, a konto nie będzie już dostępne. Historia zamówień pozostanie zachowana zgodnie z przepisami rachunkowymi.',
  customerAnonymizeNoteLabelPl: 'Notatka (wymagana)',
  customerAnonymizeButtonPl: 'Zanonimizuj konto',
  customerAnonymizeConfirmTitlePl: 'Zanonimizować konto?',
  customerAnonymizeConfirmMessagePl: 'Tej operacji nie można cofnąć. Dane osobowe klienta zostaną trwale usunięte.',
  customerAnonymizeConfirmButtonPl: 'Tak, zanonimizuj konto',
  customerAnonymizedNoticePl: 'Konto zanonimizowane',
  // Shown to STAFF in place of the form (SEC-04). Says who can do it rather
  // than only that they cannot, so the reader knows what to do next.
  customerAnonymizeAdminOnlyPl: 'Anonimizację konta może wykonać tylko administrator.',

  auditLogHeadingPl: 'Dziennik zdarzeń',
  auditLogFilterEntityPl: 'Encja',
  auditLogFilterActionPl: 'Akcja',
  auditLogFilterSearchPl: 'E-mail osoby lub identyfikator rekordu',
  auditLogEmptyPl: 'Brak zdarzeń spełniających kryteria.',
  auditLogColumnDatePl: 'Data',
  auditLogColumnActorPl: 'Kto',
  auditLogColumnEntityPl: 'Encja',
  auditLogColumnActionPl: 'Akcja',
  auditLogColumnDiffPl: 'Szczegóły',
  auditLogNoDiffPl: '-',

  activityTimelineHeadingPl: 'Historia zmian',
  activityTimelineEmptyPl: 'Brak zarejestrowanych zmian dla tego rekordu.',

  settingsHeadingPl: 'Ustawienia',
  settingsStoreSectionHeadingPl: 'Sklep',
  settingsFieldBankAccountNumberPl: 'Numer konta bankowego',
  settingsFieldBankAccountHolderPl: 'Odbiorca przelewu',
  settingsFieldShippingRatePl: 'Stawka wysyłki (zł) - nieużywana',
  settingsFieldShippingRateHelperPl: 'Zastąpione przez „Metody dostawy” (P9 faza 5) - ta wartość nie jest już używana przy składaniu zamówienia i pozostaje tylko dla zgodności wstecznej.',
  settingsSavedNoticePl: 'Zapisano.',

  settingsAnalyticsSectionHeadingPl: 'Dane analityczne',
  settingsAnalyticsRetentionNoticePl: 'Zdarzenia analityczne (AnalyticsEvent) są przechowywane przez 12 miesięcy. Nie istnieje jeszcze automatyczne, zaplanowane czyszczenie - to działanie trzeba uruchomić ręcznie.',
  settingsAnalyticsPrunableCountPl: (count: number) =>
    `Zdarzenia starsze niż 12 miesięcy do usunięcia: ${countPl(count, { one: 'zdarzenie', few: 'zdarzenia', many: 'zdarzeń' })}.`,
  settingsAnalyticsPruneButtonPl: 'Wyczyść stare dane analityczne',
  settingsAnalyticsPruneConfirmTitlePl: 'Usunąć stare dane analityczne?',
  settingsAnalyticsPruneConfirmMessagePl: 'Ta operacja jest nieodwracalna - usunięte zdarzenia analityczne nie mogą zostać przywrócone.',
  settingsAnalyticsPruneConfirmButtonPl: 'Usuń',
  settingsAnalyticsPrunedNoticePl: (count: number) => `Usunięto ${countPl(count, { one: 'zdarzenie', few: 'zdarzenia', many: 'zdarzeń' })}.`,
  settingsPersonnelLinkPl: 'Personel',
  settingsEmailTemplatesLinkPl: 'Szablony e-mail',

  staffHeadingPl: 'Personel',
  staffEmptyPl: 'Brak kont personelu.',
  staffColumnNamePl: 'Imię i nazwisko',
  staffColumnEmailPl: 'E-mail',
  staffColumnRolePl: 'Rola',
  staffInviteHeadingPl: 'Zaproś nowego pracownika',
  staffInviteFieldNamePl: 'Imię i nazwisko',
  staffInviteFieldEmailPl: 'E-mail',
  staffInviteFieldRolePl: 'Rola',
  staffInviteSubmitPl: 'Zaproś',
  staffInviteHintPl: 'Nowy pracownik zaloguje się kodem e-mail na stronie logowania - nie ustawia się dla niego hasła.',
  staffRevokeButtonPl: 'Cofnij dostęp',
  staffRoleAdminPl: 'Administrator',
  staffRoleStaffPl: 'Pracownik',

  emailTemplatesHeadingPl: 'Szablony e-mail',
  emailTemplatesColumnKeyPl: 'Szablon',
  emailTemplateFieldSubjectPl: 'Temat',
  emailTemplateFieldBodyPl: 'Treść',
  emailTemplatePlaceholdersHintPl: 'Dostępne znaczniki',
  emailTemplateKeyOrderConfirmationPl: 'Potwierdzenie zamówienia',
  emailTemplateKeyVerificationOtpPl: 'Kod weryfikacyjny',
  emailTemplateKeyOrderStatusUpdatePl: 'Zmiana statusu zamówienia',

  pricingHeadingPl: 'Cennik',
  pricingIntroPl:
    'Stawki poniżej wpływają na wycenę każdej konfiguracji na całej stronie. Każdy zapis tworzy nową wersję - nic nie jest edytowane w miejscu, a istniejące zamówienia pozostają przy swojej wersji cennika na zawsze.',
  pricingActiveVersionLabelPl: 'Aktywna wersja',
  pricingColumnVersionPl: 'Wersja',
  pricingColumnStatusPl: 'Status',
  pricingColumnPublishedPl: 'Opublikowano',
  pricingColumnNotePl: 'Notatka',
  pricingStatusActivePl: 'Aktywna',
  pricingStatusDraftPl: 'Wersja robocza',
  pricingStatusArchivedPl: 'Archiwalna',
  pricingNewDraftHeadingPl: 'Nowa wersja cennika',
  pricingFieldMachineRateCncPl: 'Stawka maszynowa CNC (zł)',
  pricingFieldMachineRateLaserPl: 'Stawka maszynowa laser (zł)',
  pricingFieldModuleSurchargePl: 'Dopłata za dodatkowy moduł (zł)',
  pricingFieldVatRatePl: 'Stawka VAT (%)',
  pricingFieldNotePl: 'Notatka (widoczna tylko w panelu)',
  pricingPackagingTiersHeadingPl: 'Progi pakowania',
  pricingPackagingTiersHintPl:
    'Każda konfiguracja jest dopasowywana do pierwszego pasującego progu (kolejność ma znaczenie). Ostatni próg musi być „bez limitu” (puste pola maks. powierzchni i maks. modułów) - inaczej duża konfiguracja nie znajdzie pasującego progu i wycena się nie powiedzie.',
  pricingFieldTierMaxAreaPl: 'Maks. powierzchnia (m²)',
  pricingFieldTierMaxModulesPl: 'Maks. liczba modułów',
  pricingFieldTierPricePl: 'Cena (zł)',
  pricingTierNoLimitPl: 'bez limitu',
  pricingAddTierPl: 'Dodaj próg',
  pricingRemoveTierPl: 'Usuń próg',
  pricingRemoveTierBlockedPl: 'Musi zostać co najmniej jeden próg - ostatni pełni rolę „bez limitu”.',
  pricingSaveDraftPl: 'Zapisz jako wersję roboczą',
  pricingDraftCreatedNoticePl: 'Utworzono wersję roboczą. Przejrzyj symulację przed publikacją.',
  pricingSimulatorHeadingPl: 'Symulacja cen',
  pricingSimulatorIntroPl:
    'Rzeczywiste ceny 3 referencyjnych produktów, przeliczone tą samą logiką co sklep - przed i po zmianie stawek.',
  pricingSimulatorLoadingPl: 'Obliczanie…',
  pricingSimulatorErrorPl: 'Nie udało się przeliczyć symulacji.',
  pricingSimulatorColumnProductPl: 'Produkt',
  pricingSimulatorColumnCurrentPl: 'Aktualna cena',
  pricingSimulatorColumnDraftPl: 'Nowa cena',
  pricingSimulatorColumnDeltaPl: 'Różnica',
  pricingSimulatorUnpriceablePl: 'nie udało się wycenić',
  pricingPublishPl: 'Publikuj tę wersję',
  pricingPublishBlockedHintPl: 'Poczekaj na wynik symulacji przed publikacją.',
  pricingPublishConfirmTitlePl: 'Opublikować tę wersję cennika?',
  pricingPublishConfirmPl: 'Ta zmiana natychmiast wpłynie na ceny w całym sklepie. Tej operacji nie można cofnąć - poprzednio aktywna wersja przestanie obowiązywać.',
  pricingPublishConfirmButtonPl: 'Tak, opublikuj',
  pricingAlreadyActivePl: 'Ta wersja jest już aktywna.',
  pricingBackToListPl: 'Wróć do listy wersji',
} as const;

const ORDER_STATUS_LABELS_PL: Record<OrderStatus, string> = {
  NEW: 'Nowe',
  AWAITING_PAYMENT: 'Oczekuje na płatność',
  DESIGN_REVIEW: 'Weryfikacja projektu',
  CONFIRMED: 'Potwierdzone',
  IN_PRODUCTION: 'W produkcji',
  FINISHING: 'Wykończenie',
  READY_TO_SHIP: 'Gotowe do wysyłki',
  SHIPPED: 'Wysłane',
  COMPLETED: 'Zrealizowane',
  CANCELLED: 'Anulowane',
};

export function adminOrderStatusLabel(status: OrderStatus): string {
  return ORDER_STATUS_LABELS_PL[status];
}

const PRODUCTION_METHOD_LABELS_PL: Record<string, string> = {
  CNC_CARVE: 'Frezowanie CNC',
  CNC_ENGRAVE: 'Grawer CNC',
  LASER_ENGRAVE: 'Grawer laserowy',
  MIXED: 'Metoda mieszana',
  MANUAL_PREP: 'Przygotowanie ręczne',
};

export function adminProductionMethodLabel(method: string): string {
  return PRODUCTION_METHOD_LABELS_PL[method] ?? method;
}

const PRODUCT_TYPE_LABELS_PL: Record<ProductTypeCode, string> = {
  WALL_ART: 'Obraz ścienny',
  TABLE_TOP: 'Blat stołu',
  KITCHEN_TILE: 'Kafelek kuchenny',
  FLOOR_ELEMENT: 'Element podłogowy',
  CUSTOM: 'Produkt niestandardowy (własny plik)',
  LOFT_FURNITURE: 'Meble loft',
  JEWELRY: 'Biżuteria',
};

export function adminProductTypeLabel(type: ProductTypeCode): string {
  return PRODUCT_TYPE_LABELS_PL[type];
}

const INSTALLATION_VARIANT_LABELS_PL: Record<InstallationVariantCode, string> = {
  ON_TOP: 'Montaż na istniejącym kafelku',
  OVERLAY: 'Cienka nakładka',
  REPLACEMENT: 'Wymiana kafelka',
};

export function adminInstallationVariantLabel(code: InstallationVariantCode): string {
  return INSTALLATION_VARIANT_LABELS_PL[code];
}

const MATERIAL_FAMILY_LABELS_PL: Record<MaterialFamily, string> = {
  SOLID_WOOD: 'Drewno lite',
  PLYWOOD: 'Sklejka',
  MDF: 'MDF',
  CERAMIC: 'Ceramika',
  LEATHER: 'Skóra',
  OTHER: 'Inne',
};

export function adminMaterialFamilyLabel(family: MaterialFamily): string {
  return MATERIAL_FAMILY_LABELS_PL[family];
}

const GRAIN_DIRECTION_LABELS_PL: Record<GrainDirection, string> = {
  NONE: 'Brak (dowolny obrót)',
  LENGTHWISE: 'Wzdłużny',
};

export function adminGrainDirectionLabel(direction: GrainDirection): string {
  return GRAIN_DIRECTION_LABELS_PL[direction];
}

const PAYMENT_METHOD_LABELS_PL: Record<PaymentMethod, string> = {
  BANK_TRANSFER: 'Przelew bankowy',
  CONTACT_ARRANGED: 'Ustalenie indywidualne',
  PRZELEWY24: 'Przelewy24',
  CARD: 'Karta płatnicza',
  PAYPAL: 'PayPal',
};

export function adminPaymentMethodLabel(provider: PaymentMethod): string {
  return PAYMENT_METHOD_LABELS_PL[provider];
}

const SHIPMENT_STATUS_LABELS_PL: Record<ShipmentStatus, string> = {
  PREPARING: 'Przygotowywanie paczki',
  SHIPPED: 'Nadane',
  IN_TRANSIT: 'W drodze',
  DELIVERED: 'Dostarczone',
  ISSUE: 'Problem z przesyłką',
  RETURNED: 'Zwrócone do nadawcy',
};

export function adminShipmentStatusLabel(status: ShipmentStatus): string {
  return SHIPMENT_STATUS_LABELS_PL[status];
}

const SUPPORT_REQUEST_STATUS_LABELS_PL: Record<SupportRequestStatus, string> = {
  NEW: 'Nowe',
  IN_PROGRESS: 'W trakcie',
  RESOLVED: 'Rozwiązane',
  CLOSED: 'Zamknięte',
};

export function adminSupportRequestStatusLabel(status: SupportRequestStatus): string {
  return SUPPORT_REQUEST_STATUS_LABELS_PL[status];
}

const FINISH_KIND_LABELS_PL: Record<FinishKind, string> = {
  NATURAL: 'Naturalne',
  OIL: 'Olejowanie',
  HARDWAX_OIL: 'Olejowosk',
  STAIN: 'Bejcowanie',
  VARNISH: 'Lakierowanie',
};

export function adminFinishKindLabel(kind: FinishKind): string {
  return FINISH_KIND_LABELS_PL[kind];
}

const REVIEW_STATUS_LABELS_PL: Record<ReviewStatus, string> = {
  PENDING: 'Oczekująca',
  APPROVED: 'Zatwierdzona',
  REJECTED: 'Odrzucona',
};

export function adminReviewStatusLabel(status: ReviewStatus): string {
  return REVIEW_STATUS_LABELS_PL[status];
}

const DESIGN_RIGHTS_STATUS_LABELS_PL: Record<DesignRightsStatus, string> = {
  APPROVED_COMMERCIAL: 'Zatwierdzone komercyjnie',
  REQUIRES_PERMISSION: 'Wymaga zgody',
  PUBLIC_DOMAIN: 'Domena publiczna',
  CUSTOMER_SUPPLIED: 'Dostarczone przez klienta',
  RESTRICTED: 'Zastrzeżone (nigdy nieoferowane)',
};

export function adminDesignRightsStatusLabel(status: DesignRightsStatus): string {
  return DESIGN_RIGHTS_STATUS_LABELS_PL[status];
}

const UPLOAD_KIND_LABELS_PL: Record<UploadKind, string> = {
  CUSTOMER_DESIGN: 'Własny projekt',
  REFERENCE_PHOTO: 'Zdjęcie referencyjne',
};

export function adminUploadKindLabel(kind: UploadKind): string {
  return UPLOAD_KIND_LABELS_PL[kind];
}

const EMAIL_TEMPLATE_KEY_LABELS_PL: Record<string, string> = {
  'order-confirmation': ADMIN.emailTemplateKeyOrderConfirmationPl,
  'verification-otp': ADMIN.emailTemplateKeyVerificationOtpPl,
  'order-status-update': ADMIN.emailTemplateKeyOrderStatusUpdatePl,
};

/** Falls back to the raw key for any future `MailTemplate` this map hasn't been updated for yet - never throws. */
export function adminEmailTemplateKeyLabel(key: string): string {
  return EMAIL_TEMPLATE_KEY_LABELS_PL[key] ?? key;
}

/** Mirrors `mailer.ts`'s own `buildPlaceholders` key set - kept in sync by hand, shown as a read-only hint on the template edit screen. */
export const EMAIL_TEMPLATE_PLACEHOLDERS_PL: Record<string, readonly string[]> = {
  'order-confirmation': ['orderNumber', 'totalGrossZloty', 'paymentMethodPl'],
  'verification-otp': ['otp', 'otpPurposePl'],
  'order-status-update': ['orderNumber', 'statusPl'],
};

const AUDIT_ACTION_LABELS_PL: Record<string, string> = {
  create: 'Utworzenie',
  update: 'Aktualizacja',
  delete: 'Usunięcie',
  transition: 'Zmiana statusu',
  export: 'Eksport',
};

/** Falls back to the raw value for any future `AuditAction` this map hasn't been updated for yet - `AuditLog.action` is a plain string column, not an enum, so this can't be exhaustive at the type level. */
export function adminAuditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS_PL[action] ?? action;
}

/** Only `STAFF`/`ADMIN` ever reach this - `listStaffUsers()` never returns a `CUSTOMER` row - but takes a plain string (matching `UserRole`'s real type) so a client-island column definition can call it without importing the enum type just for this. */
export function adminStaffRoleLabel(role: string): string {
  return role === 'ADMIN' ? ADMIN.staffRoleAdminPl : ADMIN.staffRoleStaffPl;
}

/**
 * Real Polish plural grammar for "wiersz" (row), not a naive singular/plural
 * toggle - `docs/CHECKLIST.md`'s own open item ("Polish plurals correct at
 * 1 / 2 / 4 / 5 / 12 / 22 / 25 / 112") for this one word: `wiersz` at 1,
 * `wiersze` for a trailing 2–4 EXCEPT when the last two digits are 12–14
 * (which take the "many" form instead - Polish, unlike English, doesn't
 * just split singular/plural on 1), `wierszy` otherwise (0, 5+, 11–14, ...).
 */
export function csvImportSuccessMessage(created: number): string {
  return `Zaimportowano ${countPl(created, { one: 'wiersz', few: 'wiersze', many: 'wierszy' })}.`;
}

/**
 * Warehouse screens, added 2026-09-04. The vocabulary is deliberately the
 * workshop's, not the shop's: a batch is a delivery of identical boards, a
 * board is one sheet, and the price recorded is what was PAID rather than
 * what is charged.
 */
export const WAREHOUSE = {
  headingPl: 'Magazyn materiałów',
  introPl:
    'Płyty, które faktycznie masz na stanie, i ile za nie zapłacono. Na tej podstawie liczona jest minimalna cena, poniżej której produkt sprzedawany jest ze stratą.',
  columnMaterialPl: 'Materiał',
  columnBoardsPl: 'Płyty na stanie',
  columnStockValuePl: 'Wartość zakupu',
  columnCostPerM2Pl: 'Koszt za m²',
  columnChargedPerM2Pl: 'Cena katalogowa za m²',
  columnMarginPl: 'Marża',
  noStockPl: 'Brak płyt na stanie',
  marginUnknownPl: 'Nie wiadomo',
  marginNegativeNotePl: 'Poniżej kosztu zakupu',

  detailHeadingPl: 'Magazyn:',
  batchesHeadingPl: 'Partie na stanie',
  batchDimensionsPl: 'Wymiary płyty',
  batchQuantityPl: 'Liczba płyt',
  batchPricePl: 'Cena za płytę',
  batchSupplierPl: 'Dostawca',
  batchPurchasedAtPl: 'Data zakupu',
  batchNotePl: 'Notatka',
  batchEmptyPl: 'Nie zapisano jeszcze żadnej partii dla tego materiału.',

  addBatchHeadingPl: 'Dodaj partię',
  fieldWidthPl: 'Szerokość (mm)',
  fieldHeightPl: 'Wysokość (mm)',
  fieldThicknessPl: 'Grubość (mm)',
  fieldQuantityPl: 'Liczba płyt',
  fieldPricePl: 'Cena netto za jedną płytę (zł)',
  fieldSupplierNamePl: 'Dostawca',
  fieldSupplierUrlPl: 'Link do dostawcy',
  fieldNotePl: 'Notatka (nr dostawy, półka)',

  canMakeHeadingPl: 'Co możesz z tego zrobić',
  canMakeIntroPl: 'Produkty z katalogu, które zmieszczą się na tej płycie. Liczba mówi, ile sztuk wychodzi z jednej płyty przy cięciu w rzędach.',
  canMakeNonePl: 'Z tej płyty nie wychodzi żaden produkt z katalogu.',
  canMakeTooLargeHeadingPl: 'Za duże na tę płytę',
  perBoardPl: 'szt. z płyty',
  materialCostPl: 'Koszt materiału na sztukę',
  cataloguePricePl: 'Cena w sklepie od',
  noCataloguePricePl: 'Wycena indywidualna',
} as const;
/** "Zaznaczono 1 wiersz / 3 wiersze / 12 wierszy" - the bulk-actions selection toolbar's count. */
export function bulkSelectionCountMessage(count: number): string {
  return `Zaznaczono ${countPl(count, { one: 'wiersz', few: 'wiersze', many: 'wierszy' })}`;
}
