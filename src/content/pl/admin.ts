/**
 * Staff-facing copy for `/panel/*` — kept separate from `site.ts`/
 * `messages.ts` (customer-facing) per `docs/ARCHITECTURE.md` §16A's framing
 * of the panel as "a separate visual world from the storefront." Still
 * subject to `scripts/check-polish-literals.mjs`.
 */

import type { OrderStatus } from '@/generated/prisma/enums';

export const ADMIN = {
  navOrdersPl: 'Zamówienia',
  navDesignReviewPl: 'Weryfikacja projektów',
  logoutPl: 'Wyloguj się',

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
