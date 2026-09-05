-- DOC-04. Remove the placeholder `/strony/o-nas`, which duplicated the real
-- `/o-nas` under the same "O nas - RYT" title.
--
-- Found on 2026-09-05 by reading the generated sitemap rather than the code:
-- BUG-16 had just started listing every active StaticPage, and both pages were
-- about to be advertised to crawlers. The sitemap already refuses to publish a
-- /strony/ twin of a first-class route, so nothing is broken today - this is
-- the owner's answer to the remaining question, which was whether the stub
-- should exist at all. It should not: it holds one sentence, nothing links to
-- it, and /o-nas is the real page.
--
-- Deleted rather than deactivated, which is a deliberate departure from this
-- project's usual "retire, do not destroy". That convention protects rows
-- something else references - a category with products, a material with
-- orders. A StaticPage has no dependants and this one has no content worth
-- keeping.
--
-- Conditional on the body still being the placeholder text. If somebody has
-- since written a real "O nas" here, this migration must not silently throw
-- it away - it does nothing instead, and the duplicate stays visible for a
-- human to decide about.

DELETE FROM "StaticPage"
WHERE "slug" = 'o-nas'
  AND "bodyPl" = 'Jesteśmy małą pracownią CNC specjalizującą się w meblach i dekoracjach z drewna oraz gresu.';
