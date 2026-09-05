-- Owner, 2026-09-04: "z kategorii wyłączyć na razie loft, inne to powinno
-- być zamówienie własne".
--
-- Both are data, not schema. The seed carries the same values so a fresh
-- database agrees, but the seed is idempotent and leaves existing rows alone,
-- so an already-seeded database needs this.
--
-- Nothing is deleted either way. Loft is deactivated, which is this project's
-- established "retire, do not destroy" pattern: the category, the stool, its
-- images and its compatibility rows all survive, and re-enabling is one
-- boolean. That matters because the owner said "na razie".

UPDATE "Category" SET "isActive" = false WHERE "slug" = 'loft' AND "isActive" = true;

-- "Inne" already contained exactly one product, the CUSTOM_UPLOAD "Własny
-- projekt z grawerem". Renaming it makes the label say what the category has
-- always held. The slug moves too: nothing links to /inne yet, so there is no
-- redirect to maintain, and /zamowienie-wlasne is the honest URL.
UPDATE "Category" SET
  "slug" = 'zamowienie-wlasne',
  "namePl" = 'Zamówienie własne',
  "descPl" = 'Prześlij własny projekt, a wykonamy go na wybranym materiale i w wybranym rozmiarze. Wycena indywidualna.',
  "seoTitlePl" = 'Zamówienie własne z grawerem - Twój projekt',
  "seoDescPl" = 'Prześlij własny wzór i zamów grawer na drewnie lub gresie. Wycena indywidualna.'
WHERE "slug" = 'inne';
