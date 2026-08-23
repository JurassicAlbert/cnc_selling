/**
 * Static site chrome — copy that isn't a translation of a domain code (that
 * is `messages.ts`'s job) but also isn't a component-local string literal,
 * which the lint rule in `eslint.config.mjs` forbids everywhere under
 * `src/app` and `src/ui`.
 *
 * Everything below is placeholder scaffolding, not real marketing copy —
 * P2 owns the actual homepage content (ARCHITECTURE.md §22), and that is
 * the owner's copy to write, not this session's to invent.
 */

export const SITE = {
  scaffoldTitlePl: 'Szablon motywu — treść tymczasowa',
  scaffoldBodyPl:
    'Ta strona istnieje wyłącznie po to, aby sprawdzić motyw, podział RSC/wyspa i konfigurację App Router. Prawdziwa treść strony głównej powstanie w fazie P2.',
  themeShowcaseButtonPl: 'Przycisk MUI (wyspa kliencka)',
} as const;
