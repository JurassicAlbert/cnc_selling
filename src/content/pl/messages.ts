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
import { formatMmAsCentimetres } from '@/domain/text/numeric-input';
import { countPl } from '@/domain/text/plural';
import { NOUNS } from '@/domain/text/nouns';

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
      return `Ten produkt zostanie wykonany z kilku precyzyjnie łączonych elementów — ${countPl(Number(finding.params.moduleCount), NOUNS.module)}. Ułatwia to transport i montaż, a gotowy wzór tworzy jedną całość.`;
    case 'NATURAL_VARIATION':
      return 'To drewno naturalne. Rysunek słojów, odcień i sęki różnią się w każdym egzemplarzu — Twój produkt będzie jedyny w swoim rodzaju.';
    case 'FLOOR_MATCH_NOT_GUARANTEED':
      return 'Dokładne dopasowanie odcienia do istniejącej podłogi może nie być możliwe. Drewno naturalne różni się partiami, a kolor zmienia się z czasem.';
    case 'THICKNESS_EXCEEDS_MACHINE':
      return `Wybrana grubość (${mm(Number(finding.params.thicknessMm))}) przekracza możliwości naszej maszyny — maksymalnie ${mm(Number(finding.params.maxThicknessMm))}. Wybierz mniejszą grubość.`;
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
      return 'Emoji nie mogą zostać wykonane. Użyj liter, cyfr i znaków interpunkcyjnych.';
    case 'UNSUPPORTED_CHARACTER':
      return `Wybrany krój pisma nie zawiera znaku „${issue.character ?? ''}". Wybierz inny krój, aby zachować poprawną pisownię.`;
    case 'TEXT_TOO_SMALL_FOR_FONT':
      return `Ten tekst może być zbyt drobny do precyzyjnego wykonania w wybranym kroju. Minimalna wysokość to ${mm(issue.limit ?? 0)}.`;
    case 'TEXT_TOO_SMALL_FOR_MATERIAL':
      return `Ten tekst może być zbyt drobny dla wybranego materiału. Minimalna wysokość to ${mm(issue.limit ?? 0)}.`;
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

export function numericInputMessage(code: ParseErrorCode): string {
  switch (code) {
    case 'EMPTY':
      return 'Podaj wymiar.';
    case 'NOT_A_NUMBER':
      return 'Podaj wymiar jako liczbę, na przykład 62,5.';
    case 'MULTIPLE_SEPARATORS':
      return 'Podaj wymiar z jednym przecinkiem, na przykład 62,5.';
    case 'OUT_OF_RANGE':
      return 'Ten wymiar jest poza dopuszczalnym zakresem.';
  }
}

/** Copy that appears verbatim rather than in response to a code. */
export const COPY = {
  tableTopLegsNotIncluded: 'Produkt obejmuje blat. Nogi nie są w zestawie.',
  customDesignNeedsReview: 'Projekt może wymagać ręcznej korekty przed produkcją.',
  floorFinalDimensions:
    'Podaję ostateczne wymiary. Produkt zostanie wykonany na wymiar i nie wymaga docinania.',
  designStatusPending: 'Projekt oczekuje na weryfikację.',
  designStatusApproved: 'Projekt został zaakceptowany.',
  designStatusNeedsChanges: 'Projekt wymaga poprawy.',
  designStatusRejected: 'Projekt nie może zostać wykonany.',
  orderReceived: 'Zamówienie zostało przyjęte.',
  orderInProduction: 'Zamówienie jest w produkcji.',
  orderShipped: 'Zamówienie zostało wysłane.',
  genericServerError:
    'Coś poszło nie tak. Spróbuj ponownie za chwilę. Jeśli problem się powtarza, skontaktuj się z nami.',
  priceChanged:
    'Cena tej konfiguracji uległa zmianie. Odśwież stronę, aby zobaczyć aktualną kwotę.',
} as const;
