/**
 * Real, structurally-correct Regulamin and Polityka prywatności content —
 * P6 Part E, replacing the "w przygotowaniu" stub both pages carried since
 * P0. Not final, publishable legal text: business-identifying fields
 * (company name, registered address, NIP, contact email) are placeholders,
 * marked `[DO UZUPEŁNIENIA: ...]` rather than invented, the same
 * `TODO_PRICING`-style honesty this project already applies to placeholder
 * numbers elsewhere (`prisma/seed.ts`'s header comment). A qualified Polish
 * e-commerce lawyer still needs to review the real thing before launch
 * (`docs/ARCHITECTURE.md` §17) — this is the real STRUCTURE (RODO clauses,
 * the custom-goods withdrawal exemption, complaint/rękojmia process) with
 * that one category of fact deliberately left open, not filled in with
 * something fake.
 *
 * The custom-goods withdrawal exemption (`art. 38 pkt 3`) is cited with the
 * exact same wording as `SITE.checkoutWithdrawalExemptionTextPl` — one
 * legal claim, stated once, not two independently-drifting copies.
 */

export const LEGAL_BUSINESS_NAME_PLACEHOLDER = '[DO UZUPEŁNIENIA: nazwa i forma prawna sprzedawcy]';
export const LEGAL_BUSINESS_ADDRESS_PLACEHOLDER = '[DO UZUPEŁNIENIA: adres siedziby]';
export const LEGAL_BUSINESS_NIP_PLACEHOLDER = '[DO UZUPEŁNIENIA: NIP]';
export const LEGAL_BUSINESS_REGON_PLACEHOLDER = '[DO UZUPEŁNIENIA: REGON]';
export const LEGAL_CONTACT_EMAIL_PLACEHOLDER = '[DO UZUPEŁNIENIA: adres e-mail kontaktowy]';

export type LegalSection = {
  readonly headingPl: string;
  readonly paragraphsPl: readonly string[];
};

export const REGULAMIN_SECTIONS: readonly LegalSection[] = [
  {
    headingPl: '§1 Sprzedawca i definicje',
    paragraphsPl: [
      `Sprzedawcą jest ${LEGAL_BUSINESS_NAME_PLACEHOLDER}, z siedzibą pod adresem ${LEGAL_BUSINESS_ADDRESS_PLACEHOLDER}, NIP: ${LEGAL_BUSINESS_NIP_PLACEHOLDER}, REGON: ${LEGAL_BUSINESS_REGON_PLACEHOLDER}, adres e-mail: ${LEGAL_CONTACT_EMAIL_PLACEHOLDER} („Sprzedawca”).`,
      'Sklep internetowy dostępny pod niniejszą domeną („Sklep”) umożliwia składanie zamówień na produkty z drewna i gresu wykonywane na indywidualne zamówienie, w tym z personalizowanym grawerem CNC lub laserowym („Produkty”).',
      'Klientem może być zarówno konsument w rozumieniu art. 22¹ Kodeksu cywilnego, jak i przedsiębiorca.',
    ],
  },
  {
    headingPl: '§2 Składanie zamówień',
    paragraphsPl: [
      'Zamówienie składa się poprzez skonfigurowanie wybranego Produktu w konfiguratorze Sklepu (materiał, wymiary, wykończenie, personalizacja lub własny projekt graficzny), dodanie go do koszyka i wypełnienie formularza zamówienia.',
      'Cena Produktu jest przeliczana i wiążąco potwierdzana dopiero na etapie finalizacji zamówienia — cena widoczna wcześniej w konfiguratorze ma charakter orientacyjny do chwili tego potwierdzenia.',
      'Złożenie zamówienia jest równoznaczne z akceptacją niniejszego Regulaminu.',
    ],
  },
  {
    headingPl: '§3 Ceny i płatność',
    paragraphsPl: [
      'Ceny podane w Sklepie są cenami brutto, wyrażonymi w złotych polskich (PLN), i nie zawierają kosztów dostawy, które są wskazywane odrębnie przed złożeniem zamówienia.',
      'Płatność następuje przelewem bankowym na numer konta przekazany Klientowi po złożeniu zamówienia, lub w sposób indywidualnie ustalony kontaktowo — zgodnie z wyborem dokonanym przy składaniu zamówienia.',
    ],
  },
  {
    headingPl: '§4 Realizacja zamówienia',
    paragraphsPl: [
      'Każdy Produkt jest wykonywany indywidualnie po złożeniu zamówienia — czas realizacji podany przy danym Produkcie liczony jest od potwierdzenia zamówienia (a w przypadku Produktów z własnym projektem graficznym — od zaakceptowania projektu do produkcji).',
      'Projekty graficzne przesyłane przez Klienta podlegają weryfikacji technicznej przed przyjęciem do produkcji; Sprzedawca może poprosić o korektę lub zaproponować zmiany, jeśli projekt w przesłanej postaci nie nadaje się do wykonania.',
    ],
  },
  {
    headingPl: '§5 Prawo odstąpienia od umowy',
    paragraphsPl: [
      'Konsumentowi przysługuje prawo odstąpienia od umowy zawartej na odległość w terminie 14 dni bez podawania przyczyny, z zastrzeżeniem poniższego wyjątku.',
      'Przyjmuję do wiadomości, że produkty wykonywane na indywidualne zamówienie, według moich specyfikacji, nie podlegają zwrotowi w ramach 14-dniowego prawa odstąpienia od umowy (art. 38 pkt 3 ustawy z dnia 30 maja 2014 r. o prawach konsumenta) — dotyczy to każdego Produktu skonfigurowanego indywidualnie (wymiar, materiał, wykończenie, personalizacja lub własny projekt) w Sklepie.',
    ],
  },
  {
    headingPl: '§6 Reklamacje',
    paragraphsPl: [
      `Sprzedawca odpowiada wobec Klienta będącego konsumentem za zgodność Produktu z umową na zasadach określonych w Kodeksie cywilnym i ustawie o prawach konsumenta. Reklamację można zgłosić na adres ${LEGAL_CONTACT_EMAIL_PLACEHOLDER}, opisując wadę i oczekiwany sposób jej usunięcia.`,
      'Sprzedawca ustosunkuje się do reklamacji w terminie 14 dni od jej otrzymania.',
    ],
  },
  {
    headingPl: '§7 Dane osobowe',
    paragraphsPl: [
      'Zasady przetwarzania danych osobowych Klientów opisane są w Polityce prywatności.',
    ],
  },
  {
    headingPl: '§8 Postanowienia końcowe',
    paragraphsPl: [
      'W sprawach nieuregulowanych niniejszym Regulaminem zastosowanie mają przepisy prawa polskiego, w tym Kodeksu cywilnego oraz ustawy o prawach konsumenta.',
      'Konsument ma możliwość skorzystania z pozasądowych sposobów rozpatrywania reklamacji i dochodzenia roszczeń, w tym za pośrednictwem platformy ODR Unii Europejskiej (ec.europa.eu/consumers/odr).',
    ],
  },
];

export const PRIVACY_SECTIONS: readonly LegalSection[] = [
  {
    headingPl: 'Administrator danych',
    paragraphsPl: [
      `Administratorem danych osobowych przetwarzanych w związku z korzystaniem ze Sklepu jest ${LEGAL_BUSINESS_NAME_PLACEHOLDER}, ${LEGAL_BUSINESS_ADDRESS_PLACEHOLDER}, NIP: ${LEGAL_BUSINESS_NIP_PLACEHOLDER}. W sprawach dotyczących danych osobowych można kontaktować się pod adresem: ${LEGAL_CONTACT_EMAIL_PLACEHOLDER}.`,
    ],
  },
  {
    headingPl: 'Cele i podstawy przetwarzania',
    paragraphsPl: [
      'Dane podane przy składaniu zamówienia (imię, nazwisko, adres, e-mail, telefon, dane do faktury) przetwarzane są w celu zawarcia i wykonania umowy sprzedaży — na podstawie art. 6 ust. 1 lit. b) RODO.',
      'Dane w zamówieniach są przechowywane także w celu wypełnienia obowiązków prawnych Sprzedawcy, w szczególności rachunkowo-podatkowych — na podstawie art. 6 ust. 1 lit. c) RODO.',
      'Za odrębnie wyrażoną zgodą (widoczną na banerze zgód przy pierwszej wizycie w Sklepie) dane o odwiedzinach i interakcjach ze Sklepem mogą być przetwarzane w celach analitycznych, pomagających ulepszać ofertę — na podstawie art. 6 ust. 1 lit. a) RODO. Zgoda może zostać wycofana w każdym czasie, bez wpływu na zgodność z prawem przetwarzania dokonanego przed jej wycofaniem.',
      'Dane osoby zakładającej konto w Sklepie (imię, e-mail, historia zamówień i zapisanych konfiguracji) przetwarzane są w celu prowadzenia konta — na podstawie art. 6 ust. 1 lit. b) RODO, przez czas istnienia konta.',
      'Dane przesyłanego przez Klienta pliku graficznego oraz oświadczenie o posiadaniu praw do niego przetwarzane są w celu realizacji zamówienia z personalizacją oraz jako dowód złożonego oświadczenia — na podstawie art. 6 ust. 1 lit. b) i f) RODO.',
    ],
  },
  {
    headingPl: 'Okres przechowywania',
    paragraphsPl: [
      'Dane zamówień są przechowywane przez okres wymagany przepisami o rachunkowości (co do zasady 5 lat licząc od końca roku, w którym wystawiono dokument sprzedaży).',
      'Dane konta są przechowywane do czasu jego usunięcia przez Klienta lub Sprzedawcę; usunięcie konta („anonimizacja RODO”) nie usuwa danych już powiązanych z historycznymi zamówieniami, które muszą zostać zachowane zgodnie z przepisami o rachunkowości — dane te są wówczas zanonimizowane w zakresie, w jakim nie są już do tego niezbędne.',
    ],
  },
  {
    headingPl: 'Odbiorcy danych',
    paragraphsPl: [
      'Dane mogą być przekazywane podmiotom obsługującym Sprzedawcę technicznie i operacyjnie: dostawcy hostingu i infrastruktury, dostawcy usługi wysyłki wiadomości e-mail, przewoźnikom realizującym dostawę — wyłącznie w zakresie niezbędnym do wykonania ich usług na rzecz Sprzedawcy.',
    ],
  },
  {
    headingPl: 'Prawa osoby, której dane dotyczą',
    paragraphsPl: [
      'Klientowi przysługuje prawo dostępu do swoich danych, ich sprostowania, usunięcia, ograniczenia przetwarzania, przenoszenia danych oraz wniesienia sprzeciwu wobec przetwarzania opartego na art. 6 ust. 1 lit. f) RODO.',
      'Klientowi przysługuje prawo wniesienia skargi do Prezesa Urzędu Ochrony Danych Osobowych, jeśli uzna, że przetwarzanie jego danych narusza przepisy RODO.',
    ],
  },
  {
    headingPl: 'Pliki cookie',
    paragraphsPl: [
      'Sklep używa niezbędnych plików cookie do działania koszyka i logowania — te pliki są konieczne do funkcjonowania Sklepu i nie wymagają zgody.',
      'Za odrębną zgodą, wyrażoną na banerze zgód, Sklep może używać opcjonalnych plików/zdarzeń analitycznych. Wybór „Tylko niezbędne” na banerze zgód oznacza, że żadne opcjonalne pliki cookie ani zdarzenia analityczne nie są zapisywane.',
    ],
  },
];
