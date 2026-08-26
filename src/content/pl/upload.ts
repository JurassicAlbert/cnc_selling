/**
 * Real Polish copy for the customer-upload / IP-consent flow
 * (`ARCHITECTURE.md` §13.2). `ipDeclarationVersion`/`ipDeclarationTextPl`
 * are stored verbatim on every `CustomerDesign` row at the moment of
 * consent — not just a boolean — so a later wording change never
 * silently rewrites what a past customer actually agreed to (schema
 * comment on `CustomerDesign`, §6.9). Bumping `ipDeclarationVersion`
 * here is how that wording change gets recorded; existing consent
 * records keep whatever version/text they were given at the time.
 */
export const UPLOAD = {
  ipDeclarationVersion: 'v1',
  ipDeclarationTextPl:
    'Oświadczam, że przesłany plik jest mojego autorstwa lub posiadam prawa i zgody niezbędne do jego wykorzystania w celu wykonania zamówionego produktu. Ponoszę odpowiedzialność za treść przesłanego pliku.',
} as const;
