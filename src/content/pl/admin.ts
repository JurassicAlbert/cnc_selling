/**
 * Staff-facing copy for `/panel/*` — kept separate from `site.ts`/
 * `messages.ts` (customer-facing) per `docs/ARCHITECTURE.md` §16A's framing
 * of the panel as "a separate visual world from the storefront." Still
 * subject to `scripts/check-polish-literals.mjs`.
 */

import type { InstallationVariantCode, OrderStatus, ProductTypeCode } from '@/generated/prisma/enums';

export const ADMIN = {
  navOrdersPl: 'Zamówienia',
  navDesignReviewPl: 'Weryfikacja projektów',
  navCategoriesPl: 'Kategorie',
  navProductsPl: 'Produkty',
  logoutPl: 'Wyloguj się',

  savePl: 'Zapisz',
  cancelPl: 'Anuluj',
  addPl: 'Dodaj',
  removePl: 'Usuń',
  activatePl: 'Aktywuj',
  deactivatePl: 'Dezaktywuj',
  activeLabelPl: 'Aktywna',
  inactiveLabelPl: 'Nieaktywna',

  categoriesHeadingPl: 'Kategorie',
  categoriesNewPl: 'Nowa kategoria',
  categoriesEmptyPl: 'Brak kategorii.',
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
  productsEmptyPl: 'Brak produktów.',
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
  productFieldInstallationInfoPl: 'Informacje o montażu',
  productFieldMaterialNotesPl: 'Uwagi o materiale',
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
  productSectionDimensionsPl: 'Wymiary i cena',
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
  orderProductionNotesHeadingPl: 'Notatki produkcyjne',
  orderProductionNotesEmptyPl: 'Brak notatek.',
  orderEventsHeadingPl: 'Historia statusów',
  orderMarkPaidPl: 'Oznacz jako opłacone',
  orderMarkPaidDonePl: 'Opłacone',
  orderCancelNoteLabelPl: 'Notatka (wymagana przy anulowaniu)',
  orderTransitionNotePl: 'Notatka (opcjonalna)',
  orderDesignBlockedPl: 'Projekt klienta oczekuje na weryfikację — nie można przejść dalej, dopóki nie zostanie zatwierdzony.',

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
  designReviewRequestChangesPl: 'Poproś o zmiany',
  designReviewRejectPl: 'Odrzuć',
} as const;

const ORDER_STATUS_LABELS_PL: Record<OrderStatus, string> = {
  NEW: 'Nowe',
  AWAITING_PAYMENT: 'Oczekuje na płatność',
  DESIGN_REVIEW: 'Weryfikacja projektu',
  CONFIRMED: 'Potwierdzone',
  IN_PRODUCTION: 'W produkcji',
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
