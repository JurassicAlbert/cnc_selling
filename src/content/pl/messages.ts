/**
 * Every customer-visible string in one place.
 *
 * The domain layer returns CODES, never text. This file turns codes into
 * Polish. That separation is what makes "review the Polish copy" a review of
 * a handful of files rather than a crawl through every component, and it is
 * what a lint rule can enforce.
 *
 * Nothing here may be an English fallback. A missing message is a bug, not a
 * reason to render an enum name at a customer.
 */

import type { ConfigurationErrorCode } from '@/domain/configuration/steps';
import type { DimensionIssue } from '@/domain/dimensions/dimensions';
import type { FeasibilityFinding } from '@/domain/feasibility/rules';
import type { PersonalizationIssue } from '@/domain/personalization/validate';
import type { ParseErrorCode } from '@/domain/text/numeric-input';
import type { UploadWarning } from '@/domain/upload/inspect';
import type { UnavailabilityReason } from '@/server/configurator/resolve-options';
import type { DesignReviewStatus, OrderStatus, ShipmentStatus, SupportRequestStatus } from '@/generated/prisma/enums';
import { formatMmAsCentimetres } from '@/domain/text/numeric-input';
import { countPl } from '@/domain/text/plural';
import { NOUNS } from '@/domain/text/nouns';
import { JOINERY } from '@/content/pl/joinery';

function cm(mm: number): string {
  return `${formatMmAsCentimetres(mm)} cm`;
}

function mm(value: number): string {
  return `${new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 2 }).format(value)} mm`;
}

export function dimensionMessage(issue: DimensionIssue): string {
  switch (issue.code) {
    case 'WIDTH_NOT_INTEGER':
    case 'HEIGHT_NOT_INTEGER':
      return 'Podaj wymiar jako liczbę, na przykład 62,5.';
    case 'WIDTH_NOT_POSITIVE':
    case 'HEIGHT_NOT_POSITIVE':
      return 'Wymiar musi być większy od zera.';
    case 'WIDTH_BELOW_MIN':
      return `Minimalna szerokość dla tego produktu to ${cm(issue.limit ?? 0)}.`;
    case 'WIDTH_ABOVE_MAX':
      return `Maksymalna szerokość dla tego produktu to ${cm(issue.limit ?? 0)}.`;
    case 'HEIGHT_BELOW_MIN':
      return `Minimalna wysokość dla tego produktu to ${cm(issue.limit ?? 0)}.`;
    case 'HEIGHT_ABOVE_MAX':
      return `Maksymalna wysokość dla tego produktu to ${cm(issue.limit ?? 0)}.`;
    case 'ASPECT_RATIO_TOO_NARROW':
      return 'Ten kształt jest zbyt wąski. Zwiększ szerokość lub zmniejsz wysokość.';
    case 'ASPECT_RATIO_TOO_WIDE':
      return 'Ten kształt jest zbyt szeroki. Zmniejsz szerokość lub zwiększ wysokość.';
  }
}

export function feasibilityMessage(finding: FeasibilityFinding): string {
  switch (finding.code) {
    case 'LINE_TOO_THIN':
      return `Przy tym rozmiarze linie wzoru mają ${mm(Number(finding.params.effectiveLineWidthMm))}. Dla wybranego materiału minimalna szerokość linii to ${mm(Number(finding.params.requiredMm))}. Wybierz większy rozmiar lub inny materiał.`;
    case 'DETAIL_SPACING_TOO_TIGHT':
      return `Przy tym rozmiarze detale wzoru byłyby zbyt blisko siebie. Dla wybranego materiału minimalny odstęp to ${mm(Number(finding.params.requiredMm))}.`;
    case 'DESIGN_TOO_DETAILED':
      return `Wybrany wzór jest bardzo szczegółowy. Dla tego rozmiaru zalecamy format od ${cm(Number(finding.params.recommendedMinWidthMm))} szerokości.`;
    case 'MODULAR_BUILD':
      return `Ten produkt zostanie wykonany z kilku precyzyjnie łączonych elementów — ${countPl(Number(finding.params.moduleCount), NOUNS.module)}. Ułatwia to transport i montaż, a gotowy wzór tworzy jedną całość.`;
    case 'NATURAL_VARIATION':
      return 'To drewno naturalne. Rysunek słojów, odcień i sęki różnią się w każdym egzemplarzu — Twój produkt będzie jedyny w swoim rodzaju.';
    case 'FLOOR_MATCH_NOT_GUARANTEED':
      return 'Dokładne dopasowanie odcienia do istniejącej podłogi może nie być możliwe. Drewno naturalne różni się partiami, a kolor zmienia się z czasem.';
    case 'THICKNESS_EXCEEDS_MACHINE':
      return `Wybrana grubość (${mm(Number(finding.params.thicknessMm))}) przekracza możliwości naszej maszyny — maksymalnie ${mm(Number(finding.params.maxThicknessMm))}. Wybierz mniejszą grubość.`;
    // Prepared but disabled — see src/domain/joinery/yato-yane.ts. Nothing
    // in evaluateFeasibility produces this code today; this case exists
    // only so the switch stays exhaustive over FeasibilityCode.
    case 'JOINED_PANEL_YATO_YANE':
      return `Ten blat zostanie złożony z ${countPl(Number(finding.params.moduleCount), NOUNS.module)} połączonych techniką „${JOINERY.yatoYaneNamePl}”. ${JOINERY.yatoYaneShortDescPl}`;
  }
}

export function personalizationMessage(issue: PersonalizationIssue): string {
  switch (issue.code) {
    case 'TEXT_EMPTY':
      return 'Wpisz treść, która ma zostać wykonana.';
    case 'TEXT_TOO_LONG':
      return `Maksymalna długość to ${countPl(issue.limit ?? 0, NOUNS.character)}. Wpisano ${issue.actual ?? 0}.`;
    case 'TOO_MANY_LINES':
      return `Maksymalna liczba wierszy to ${issue.limit ?? 0}.`;
    case 'EMOJI_NOT_SUPPORTED':
      return 'Emoji nie mogą zostać wykonane. Użyj liter, cyfr i znaków interpunkcyjnych.';
    case 'UNSUPPORTED_CHARACTER':
      return `Wybrany krój pisma nie zawiera znaku „${issue.character ?? ''}”. Wybierz inny krój, aby zachować poprawną pisownię.`;
    case 'TEXT_TOO_SMALL_FOR_FONT':
      return `Ten tekst może być zbyt drobny do precyzyjnego wykonania w wybranym kroju. Minimalna wysokość to ${mm(issue.limit ?? 0)}.`;
    case 'TEXT_TOO_SMALL_FOR_MATERIAL':
      return `Ten tekst może być zbyt drobny dla wybranego materiału. Minimalna wysokość to ${mm(issue.limit ?? 0)}.`;
  }
}

export function uploadWarningMessage(warning: UploadWarning): string {
  switch (warning.code) {
    case 'LOW_RESOLUTION':
      return `Rozdzielczość przesłanego pliku jest niższa niż zalecana (${warning.params.effectiveDpi} DPI zamiast ${warning.params.thresholdDpi} DPI). Wydruk/grawer może wyjść mniej ostry.`;
    case 'VERY_LOW_RESOLUTION':
      return `Rozdzielczość przesłanego pliku jest wyraźnie za niska (${warning.params.effectiveDpi} DPI zamiast ${warning.params.thresholdDpi} DPI). Zalecamy przesłanie pliku w wyższej rozdzielczości.`;
    case 'ASPECT_MISMATCH':
      return 'Proporcje przesłanego pliku różnią się od proporcji wybranego produktu. Plik zostanie dopasowany/przycięty — sprawdź podgląd przed złożeniem zamówienia.';
  }
}

/**
 * Covers every failure code either `uploadCustomDesign`
 * (`server/actions/upload.ts`) or `reuploadCustomDesign`
 * (`server/actions/design-review.ts`) can return. A plain string union
 * here rather than importing each action's own error-code type —
 * `messages.ts` otherwise only imports from `domain/*` (plus one
 * existing exception, `UnavailabilityReason` from
 * `server/configurator/resolve-options`); duplicating this short,
 * stable list of codes keeps this file from depending on three
 * different server-action modules for one switch statement.
 */
export type UploadErrorCode =
  | 'NO_FILE'
  | 'CONSENT_REQUIRED'
  | 'RATE_LIMITED'
  | 'NOT_OWNED'
  | 'ILLEGAL_TRANSITION'
  | 'ACTOR_NOT_PERMITTED'
  | 'EMPTY_FILE'
  | 'UNSUPPORTED_TYPE'
  | 'FILE_TOO_LARGE'
  | 'CORRUPTED_FILE'
  | 'PDF_CONTAINS_ACTIVE_CONTENT';

function megabytes(bytes: number): string {
  return `${new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 1 }).format(bytes / (1024 * 1024))} MB`;
}

export function uploadErrorMessage(code: UploadErrorCode, params?: Record<string, number>): string {
  switch (code) {
    case 'NO_FILE':
      return 'Wybierz plik do przesłania.';
    case 'CONSENT_REQUIRED':
      return 'Musisz zaakceptować oświadczenie o prawach do przesłanego pliku.';
    case 'RATE_LIMITED':
      return 'Zbyt wiele przesłanych plików w krótkim czasie. Spróbuj ponownie za godzinę.';
    case 'NOT_OWNED':
      return 'Nie znaleziono tego projektu.';
    case 'ILLEGAL_TRANSITION':
    case 'ACTOR_NOT_PERMITTED':
      return 'Tego projektu nie można teraz przesłać ponownie.';
    case 'EMPTY_FILE':
      return 'Przesłany plik jest pusty.';
    case 'UNSUPPORTED_TYPE':
      return 'Nieobsługiwany format pliku. Akceptujemy JPG, PNG, SVG i PDF.';
    case 'FILE_TOO_LARGE':
      return params?.actualBytes !== undefined && params.maxBytes !== undefined
        ? `Plik ma ${megabytes(params.actualBytes)} — maksymalny dopuszczalny rozmiar to ${megabytes(params.maxBytes)}. Zmniejsz plik i spróbuj ponownie.`
        : 'Plik jest za duży.';
    case 'CORRUPTED_FILE':
      return 'Nie udało się odczytać pliku. Sprawdź, czy nie jest uszkodzony, i spróbuj ponownie.';
    case 'PDF_CONTAINS_ACTIVE_CONTENT':
      return 'Ten plik PDF zawiera treści, których nie możemy zaakceptować. Prześlij plik bez elementów aktywnych (skryptów, akcji).';
  }
}

export function configurationErrorMessage(code: ConfigurationErrorCode): string {
  switch (code) {
    case 'STEP_INDEX_OUT_OF_RANGE':
      return 'Ten krok konfiguracji nie istnieje. Wróć do początku konfiguratora.';
    case 'STEP_NOT_YET_ENTERABLE':
      return 'Uzupełnij poprzednie kroki, zanim przejdziesz dalej.';
    case 'STEP_NOT_IN_PRODUCT_TYPE':
      return 'Ta opcja nie dotyczy wybranego produktu.';
    case 'CONFIGURATION_INCOMPLETE':
      return 'Konfiguracja nie jest jeszcze kompletna. Uzupełnij wszystkie wymagane kroki.';
  }
}

/**
 * Why one configurator option is shown disabled instead of hidden —
 * ARCHITECTURE.md §7.2: "a disabled option with a reason teaches the
 * customer the rule." Not a P1 domain code — it comes from
 * `server/configurator/resolve-options.ts`, which combines the already
 * domain-tested compatibility rules with real product rows — but it is
 * exactly the kind of customer-visible code this file exists to translate.
 */
export function unavailabilityReasonMessage(reason: UnavailabilityReason): string {
  switch (reason) {
    case 'MATERIAL_NOT_OFFERED':
      return 'Ten materiał jest obecnie niedostępny.';
    case 'EXCLUDED_BY_DESIGN':
      return 'Niedostępny dla wybranego wzoru.';
    case 'DESIGN_NOT_OFFERED':
      return 'Ten wzór jest obecnie niedostępny.';
    case 'EXCLUDED_BY_MATERIAL':
      return 'Niedostępny dla wybranego materiału.';
    case 'FINISH_NOT_OFFERED':
      return 'To wykończenie jest obecnie niedostępne.';
    case 'THICKNESS_EXCEEDS_INSTALLATION_VARIANT':
      return 'Zbyt duża grubość dla wybranego sposobu montażu.';
  }
}

export type CheckoutFieldIssueCode =
  | 'EMAIL_REQUIRED'
  | 'EMAIL_INVALID'
  | 'FIRST_NAME_REQUIRED'
  | 'LAST_NAME_REQUIRED'
  | 'PHONE_REQUIRED'
  | 'PHONE_INVALID'
  | 'NIP_INVALID'
  | 'STREET_REQUIRED'
  | 'POSTAL_CODE_INVALID'
  | 'CITY_REQUIRED'
  | 'PAYMENT_METHOD_REQUIRED'
  | 'DELIVERY_METHOD_REQUIRED'
  | 'TERMS_NOT_ACCEPTED'
  | 'WITHDRAWAL_NOT_ACKNOWLEDGED';

/**
 * Checkout field validation — not a P1 domain code (`validateNip`/
 * `validatePostalCode`/`validatePhone` in `domain/checkout/validate.ts`
 * return plain booleans, correctly, since a checksum either holds or it
 * doesn't), but exactly the kind of customer-visible translation this file
 * exists for, same as `unavailabilityReasonMessage`.
 */
export function checkoutIssueMessage(code: CheckoutFieldIssueCode): string {
  switch (code) {
    case 'EMAIL_REQUIRED':
      return 'Podaj adres e-mail.';
    case 'EMAIL_INVALID':
      return 'Podaj poprawny adres e-mail.';
    case 'FIRST_NAME_REQUIRED':
      return 'Podaj imię.';
    case 'LAST_NAME_REQUIRED':
      return 'Podaj nazwisko.';
    case 'PHONE_REQUIRED':
      return 'Podaj numer telefonu.';
    case 'PHONE_INVALID':
      return 'Podaj poprawny numer telefonu.';
    case 'NIP_INVALID':
      return 'Podaj poprawny NIP.';
    case 'STREET_REQUIRED':
      return 'Podaj ulicę i numer.';
    case 'POSTAL_CODE_INVALID':
      return 'Podaj kod pocztowy w formacie NN-NNN.';
    case 'CITY_REQUIRED':
      return 'Podaj miejscowość.';
    case 'PAYMENT_METHOD_REQUIRED':
      return 'Wybierz sposób płatności.';
    case 'DELIVERY_METHOD_REQUIRED':
      return 'Wybierz sposób dostawy.';
    case 'TERMS_NOT_ACCEPTED':
      return 'Musisz zaakceptować regulamin, aby złożyć zamówienie.';
    case 'WITHDRAWAL_NOT_ACKNOWLEDGED':
      return 'Musisz potwierdzić informację o braku prawa odstąpienia od umowy.';
  }
}

export function orderStatusMessage(status: OrderStatus): string {
  switch (status) {
    case 'NEW':
      return 'Nowe';
    case 'AWAITING_PAYMENT':
      return 'Oczekuje na płatność';
    case 'DESIGN_REVIEW':
      return 'Weryfikacja projektu';
    case 'CONFIRMED':
      return 'Potwierdzone';
    case 'IN_PRODUCTION':
      return 'W produkcji';
    case 'FINISHING':
      return 'Wykończenie';
    case 'READY_TO_SHIP':
      return 'Gotowe do wysyłki';
    case 'SHIPPED':
      return 'Wysłane';
    case 'COMPLETED':
      return 'Zrealizowane';
    case 'CANCELLED':
      return 'Anulowane';
  }
}

/** P9 phase 7 — customer-facing shipment status labels. Manually set by staff; never implies a live carrier feed. */
export function shipmentStatusMessage(status: ShipmentStatus): string {
  switch (status) {
    case 'PREPARING':
      return 'Przygotowywanie paczki';
    case 'SHIPPED':
      return 'Nadane';
    case 'IN_TRANSIT':
      return 'W drodze';
    case 'DELIVERED':
      return 'Dostarczone';
    case 'ISSUE':
      return 'Problem z przesyłką';
    case 'RETURNED':
      return 'Zwrócone do nadawcy';
  }
}

/** P9 continuation, 2026-08-28 — customer-facing support-request status labels, for `/moje-konto`. Same 4 statuses `adminSupportRequestStatusLabel` (`admin.ts`) uses staff-side, translated separately since this file is the customer-visible one. */
export function supportRequestStatusMessage(status: SupportRequestStatus): string {
  switch (status) {
    case 'NEW':
      return 'Nowe';
    case 'IN_PROGRESS':
      return 'W trakcie';
    case 'RESOLVED':
      return 'Rozwiązane';
    case 'CLOSED':
      return 'Zamknięte';
  }
}

/** Same 4 statuses as `COPY.designStatus*`, as a real function rather than a code-to-string lookup scattered at each call site — P9 phase 2's "moje wzory" library and the configurator's reuse picker both need this. */
export function customerDesignStatusMessage(status: DesignReviewStatus): string {
  switch (status) {
    case 'PENDING_REVIEW':
      return COPY.designStatusPending;
    case 'APPROVED':
      return COPY.designStatusApproved;
    case 'NEEDS_CHANGES':
      return COPY.designStatusNeedsChanges;
    case 'REJECTED':
      return COPY.designStatusRejected;
  }
}

export type AuthFieldIssueCode =
  | 'EMAIL_REQUIRED'
  | 'EMAIL_INVALID'
  | 'NAME_REQUIRED'
  | 'PASSWORD_REQUIRED'
  | 'PASSWORD_TOO_SHORT'
  | 'OTP_REQUIRED';

export function authIssueMessage(code: AuthFieldIssueCode): string {
  switch (code) {
    case 'EMAIL_REQUIRED':
      return 'Podaj adres e-mail.';
    case 'EMAIL_INVALID':
      return 'Podaj poprawny adres e-mail.';
    case 'NAME_REQUIRED':
      return 'Podaj imię i nazwisko.';
    case 'PASSWORD_REQUIRED':
      return 'Podaj hasło.';
    case 'PASSWORD_TOO_SHORT':
      return 'Hasło musi mieć co najmniej 8 znaków.';
    case 'OTP_REQUIRED':
      return 'Podaj kod logowania.';
  }
}

export type AuthFormErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_ALREADY_EXISTS'
  | 'OTP_INVALID'
  /** `docs/REVIEW-DETAILED.md` SEC-01 — `server/rate-limit/auth-throttle.ts` refused this attempt. */
  | 'RATE_LIMITED'
  | 'UNKNOWN';

/**
 * `retryAfterSeconds` is only meaningful for `RATE_LIMITED`, and is
 * optional so existing call sites keep compiling. Naming the actual wait
 * rather than "try again later" follows §16A.5's "validation that names the
 * fix, not the rule" — someone told it is four minutes waits; someone told
 * "later" keeps refreshing, which is the behaviour the limit exists to stop.
 */
export function authFormErrorMessage(code: AuthFormErrorCode, retryAfterSeconds?: number | null): string {
  switch (code) {
    case 'RATE_LIMITED':
      return authRateLimitMessage(retryAfterSeconds ?? null);
    case 'INVALID_CREDENTIALS':
      return 'Nieprawidłowy adres e-mail lub hasło.';
    case 'EMAIL_ALREADY_EXISTS':
      return 'Konto z tym adresem e-mail już istnieje.';
    case 'OTP_INVALID':
      return 'Nieprawidłowy lub nieaktualny kod logowania.';
    case 'UNKNOWN':
      return 'Coś poszło nie tak. Spróbuj ponownie.';
  }
}

/**
 * Deliberately says nothing about whether the account exists, whether the
 * password was close, or how many attempts remain — each of which would
 * turn the refusal itself into an oracle for the attacker it exists to stop.
 */
function authRateLimitMessage(retryAfterSeconds: number | null): string {
  if (retryAfterSeconds === null) {
    return 'Zbyt wiele prób. Odczekaj chwilę i spróbuj ponownie.';
  }
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return `Zbyt wiele prób. Spróbuj ponownie za ${countPl(minutes, NOUNS.minute)}.`;
}

export function numericInputMessage(code: ParseErrorCode): string {
  switch (code) {
    case 'EMPTY':
      return 'Podaj wymiar.';
    case 'NOT_A_NUMBER':
      return 'Podaj wymiar jako liczbę, na przykład 62,5.';
    case 'MULTIPLE_SEPARATORS':
      return 'Podaj wymiar z jednym przecinkiem, na przykład 62,5.';
    case 'OUT_OF_RANGE':
      return 'Ten wymiar jest poza dopuszczalnym zakresem.';
  }
}

/** Copy that appears verbatim rather than in response to a code. */
export const COPY = {
  tableTopLegsNotIncluded: 'Produkt obejmuje blat. Nogi nie są w zestawie.',
  customDesignNeedsReview: 'Projekt może wymagać ręcznej korekty przed produkcją.',
  floorFinalDimensions:
    'Podaję ostateczne wymiary. Produkt zostanie wykonany na wymiar i nie wymaga docinania.',
  designStatusPending: 'Projekt oczekuje na weryfikację.',
  designStatusApproved: 'Projekt został zaakceptowany.',
  designStatusNeedsChanges: 'Projekt wymaga poprawy.',
  designStatusRejected: 'Projekt nie może zostać wykonany.',
  orderReceived: 'Zamówienie zostało przyjęte.',
  orderInProduction: 'Zamówienie jest w produkcji.',
  orderShipped: 'Zamówienie zostało wysłane.',
  genericServerError:
    'Coś poszło nie tak. Spróbuj ponownie za chwilę. Jeśli problem się powtarza, skontaktuj się z nami.',
  priceChanged:
    'Cena tej konfiguracji uległa zmianie. Odśwież stronę, aby zobaczyć aktualną kwotę.',
} as const;
