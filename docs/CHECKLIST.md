# CNC Selling — Implementation Checklist

Reviewed item by item before the project is considered finished (brief §40–41).
`[ ]` not started · `[~]` in progress · `[x]` done and verified by a passing test or manual check.

**Last verified: 2026-08-25** — `npm test` 369/369 green, `npm run typecheck` clean, `npm run build`
clean, `npm run lint` clean, `npm run e2e` 6/6 green against a production build (desktop + mobile),
Lighthouse SEO 100/100, on Node v22.15.0 / TypeScript 7.0.2 / Vitest 4.1.11 / Prisma 7.9.1 /
Next.js 16.3.2 / MUI 9.3.1 / Biome 2.5.10 / opentype.js 2.0.0. **P0 is complete. P2 is functionally
complete and its storefront was redesigned 2026-08-24** to match the owner's actual intent for
"minimalistic" (restraint in style, not content — see `docs/HANDOVER.md` §9g) — real
category/product/material photography, a hero animation, trust badges, filters, and search all now
live. Still open: the homepage's narrative sections (hero *copy*, craftsmanship, reviews, FAQ —
needs the owner's words, reviews needs real customers), and LCP on mobile (see the P2 Lighthouse
note further down). **P3 (the configurator) is functionally complete** — step machine,
compatibility/pricing/feasibility server wiring, the first real MUI client island, a sticky
always-visible price bar, font-backed personalization, and a persistent 2D preview are all built
and browser-verified (`docs/HANDOVER.md` §9i/§9j/§9k); the 2D preview and cart-persistence items
in the P3 list below are now closed by P5. **P5 (cart, checkout, order) was built 2026-08-24/25**
in one pass — real guest sessions (a genuine, session-catching bug found and fixed: a `Secure`
cookie silently dropped by WebKit over plain HTTP), real NIP/postal-code validation, a real atomic
order-creation transaction with a race-free per-month order-number counter, real immutable order
snapshots (verified by mutating a live catalogue row and confirming an existing order's display
didn't change), and a real guest order-lookup/confirmation flow — see `docs/HANDOVER.md` §9l for
the full account, including what's honestly still deferred (shipping rates and guest-cart-merge-
on-login, both blocked on phases that haven't started, not skipped by choice).

---

## P0 — Foundation

- [x] Repo initialised, TypeScript `strict: true` — TS strict + `noUncheckedIndexedAccess` verified green (TS 7.0.2); git repo pushed to github.com/JurassicAlbert/cnc_selling
- [x] Vitest configured, `npm test` runs — 11 files / 298 tests green, ~1-2 s (verified 2026-08-23)
- [x] Playwright configured, desktop + mobile projects — `playwright.config.ts` (`desktop-chromium` + `mobile-safari`), one smoke test (`tests/e2e/shell.spec.ts`) green on both projects (verified 2026-08-23)
- [x] Docker Postgres for local dev and tests — `docker-compose.yml` running (Postgres 16, separate dev and test databases, `unaccent` in both, verified via `psql`); published on host port **5433**, not 5432 — a native Postgres install already owns 5432 on this machine
- [x] Prisma schema + first migration applies cleanly — 33 models; `npm run db:deploy` applied `20260823000000_init` to a live database, all 34 tables + `_prisma_migrations` confirmed via `\dt`, hand-written CHECK constraints and the `PricingSettings_single_active` partial unique index confirmed present (verified 2026-08-23)
- [x] Seed script structure in place — `prisma/seed.ts`, `npm run db:seed`, verified against both the dev and test databases (2026-08-23). `MachineSettings` (real 600×500×100mm), `PricingSettings` v1 (`TODO_PRICING` placeholders, append-only), the first `ADMIN` from `SEED_ADMIN_EMAIL`. **Now also seeds real catalogue content** — see the P2 item below, updated the same day once the owner gave the real category list
- [x] MUI theme implemented (palette, typography, radius, shadows, no uppercase buttons) — `src/ui/theme/theme.ts`, exact §2.1 palette/shape/shadow overrides, `plPL` locale; verified in a real browser (`#FAF8F5` background, Fraunces h1, no button uppercase transform, no elevation shadow) (verified 2026-08-23)
- [x] CSS-variables theme so RSC pages consume brand tokens — `cssVariables: true`; `src/ui/primitives/{Container,Section,Heading,Text}.tsx` are RSC-safe and consume `--mui-palette-*`/`--mui-font-*` tokens directly, verified rendering correctly with no Emotion shipped to the Server Component tree (verified 2026-08-23)
- [x] RSC / client-island boundary documented and enforced — every page under `(marketing)`/`(shop)` is a Server Component with no `@mui/material` import, enforced via a deliberate violation (added a `@mui/material` import to the marketing page, confirmed `npm run lint` errors, reverted). No client island exists yet — the original P0 proof-of-concept (`ThemeShowcaseButton`) was retired 2026-08-23 once real pages replaced the scaffold; **the theme provider itself is also no longer mounted globally**, see the P2 Lighthouse note below — the first real island arrives with P3's configurator
- [x] Lint rule: no Polish string literals inside components — `scripts/check-polish-literals.mjs`, verified with a deliberate violation (caught and reported correctly, reverted) (verified 2026-08-23)
- [x] Lint rule: no `@mui/material` imports in `(marketing)` / `(shop)` server components — `biome.json`'s `overrides` + `noRestrictedImports`, verified with a deliberate violation (verified 2026-08-23)
- [x] Prisma row → domain mapper (`src/server/mapping/to-domain.ts`) with unit tests — 35 assertions including an end-to-end priced derivation; a renamed column breaks compilation instead of changing a price
- [x] `src/content/pl/` module wired up — `messages.ts` used by the domain tests; `site.ts` is consumed by the real homepage, category, and product pages (P2)

**Resolved 2026-08-23: switched from ESLint to Biome.** `typescript-eslint` (a
hard dependency of `eslint-config-next`) does not support TypeScript 7 — a
version guard baked into `@typescript-eslint/parser` itself, tracked upstream
at [typescript-eslint#10940](https://github.com/typescript-eslint/typescript-eslint/issues/10940),
unresolved. Rather than downgrading TypeScript or waiting on an unscheduled
upstream fix, the owner chose Biome: its own Rust-based parser is unrelated to
`typescript-eslint`, so the incompatibility doesn't apply. `biome.json`
reimplements the `@mui/material` import restriction natively via `overrides`
+ `noRestrictedImports`; the Polish-literal check became a small standalone
script (`scripts/check-polish-literals.mjs`) rather than a Biome GritQL
plugin, since that plugin system is still new and the check itself needs no
AST. Trade-off accepted knowingly: Biome has no direct equivalent of
`@next/eslint-plugin-next`'s Next.js-specific rules. Full detail in
`docs/HANDOVER.md` §9c.

## P1 — Domain core (pure, tests first)

- [x] `domain/money` — grosze arithmetic, VAT, half-up rounding, formatting
- [x] Polish pluralization helper, tested at 1 / 2 / 5 / 12 / 22 / 25
- [x] `domain/dimensions` — min, max, exact bounds, aspect ratio, zero, negative, non-integer
- [x] `domain/compatibility` — product↔material, material↔finish, design↔product, design↔material — 17 assertions (`src/domain/compatibility/resolve.ts`), including the "empty DesignMaterial rows means unrestricted, not restricted-to-nothing" rule
- [x] `domain/modules` — split algorithm, exact boundary, sliver avoidance, min module clamp, remainder distribution, infeasible case, grain rotation rule
- [x] `domain/pricing` — every component isolated, rounding at .5, min-price clamp, quantity, version pinning
- [x] `domain/personalization` — length, lines, glyph coverage, Polish diacritics, empty, whitespace-only, emoji
- [x] `domain/feasibility` — thin line at scale, detail level vs size, min text height, boundary equality, notices, machine thickness limit (`THICKNESS_EXCEEDS_MACHINE`, added 2026-08-23 using D7's real 100mm Z-clearance, boundary mutation-tested)
- [x] `domain/configuration` — step machine, invalid step order, unknown option, incomplete config — `src/domain/configuration/steps.ts`, 30 assertions (`tests/unit/configuration.test.ts`); step lists are §5's table verbatim for all 7 product types, `isStepEnterable`/`checkStepEntry` enforce "every prior step satisfied, not just the immediately preceding one", `checkStepAppliesToProductType` rejects e.g. a THICKNESS selection on WALL_ART. Pure — resolves step order only, not which options are valid (`domain/compatibility` still owns that)
- [x] `domain/order-status` — legal and illegal transitions, design-review gate, actor permission — 22 assertions (`src/domain/order-status/transitions.ts`); the transition graph is this project's own design (ARCHITECTURE.md didn't fully specify one), documented in the module's header comment
- [x] Full unit suite green with no DB and no framework imports — 298 assertions, no Next/Prisma/I/O imports (verified 2026-08-23)

## P2 — Catalogue

- [x] Seed data: materials, finishes, designs, 5 products, preset sizes, installation variants — real categories confirmed by the owner 2026-08-23: `loft`, `amulety-i-bransoletki`, `gres`, `panele-podlogowe`, `obrazy-drewniane` (each with one representative product), plus `inne` as an intentionally-empty catch-all. `LOFT_FURNITURE` and `JEWELRY` added to `ProductTypeCode` (migration `20260823020000_add_loft_and_jewelry_product_types`) — neither of the original five types fit. 2 materials (oak, white gres), 1 finish (oiling), 1 placeholder design, 1 installation variant (gres). Verified idempotent (reran seed twice, row counts unchanged) and checked directly via `psql`. **Still placeholder:** every price (`TODO_PRICING`, D4) and the one design's artwork/installation diagram (still on-brand SVGs — see `prisma/seed.ts`'s header on why those two specifically stay that way). **Updated 2026-08-24:** every category/material/product photo is now real, freely-licensed stock photography (Unsplash), sourced per category subject rather than a generic SVG placeholder — an explicit owner decision for the redesign pass, still swapped for real photography before launch, source URLs recorded in `prisma/seed.ts`
- [x] Homepage — hero, categories, how it's made, materials, craftsmanship, details, patterns, reviews, FAQ, CTA — **redesigned 2026-08-24** (`src/app/(marketing)/page.tsx`): hero (headline/subcopy/CTA + `OrbitIconHero`, a pure-CSS orbiting-icon animation replacing a photo per the owner's request), a real `TrustBadgeStrip` (4 true claims about this business, not generic retail badges), a `CategoryTile` grid with real photos, and one honest "Nasze produkty" grid (all 5 real products — not the reference template's four parallel "curated" carousels, which would imply catalogue depth that doesn't exist at 5 SKUs). "How it's made", craftsmanship narrative, and FAQ are still deliberately unbuilt — they need the owner's actual words. Reviews are still deliberately unbuilt for a stronger reason: brief/§16A.1 module 9 explicitly forbids authoring a testimonial in a customer's name, and no real customer submissions exist — no star ratings anywhere in the redesign either, same reasoning
- [x] Category pages at the specified Polish slugs — `src/app/(shop)/[category]/page.tsx`, all 6 real category slugs verified live (`/loft`, `/amulety-i-bransoletki`, `/gres`, `/panele-podlogowe`, `/obrazy-drewniane`, `/inne`), `generateStaticParams` from the DB, empty-category state verified on `/inne`, Polish 404 for an unknown slug. **Redesigned 2026-08-24:** added a real material-filter + sort sidebar (`CategoryFilterForm`, a native zero-client-JS `<form method="get">` — no MUI, no hydration cost on an otherwise-static page) and switched the product grid to the new `ProductCard`. Honestly scoped: with 0-1 products per category today there's little to actually filter, but it's real and correctly wired, not decoration
- [x] Product pages — photos, detail shots, variants, description, material, dimensions, production time, starting price, installation info, care instructions, material notes — `src/app/(shop)/produkt/[slug]/page.tsx`, all fields verified live including the gres product's installation variant (added after noticing the seeded copy referenced "warianty montażu" with nothing actually displaying them); "detail shots" is one photo per product today since that's all that's seeded, not a built gallery limit. **Redesigned 2026-08-24:** intro restructured to an image-left/info-right layout (quick-fact chips, price, a CTA anchor scrolling to the configurator) — the configurator itself and everything below it (materials/dimensions/care/installation sections) is untouched, verified by re-running the same browser click-throughs P3 already established
- [x] Real product search — new, 2026-08-24: `src/app/(shop)/szukaj/page.tsx` + `searchActiveProducts` (`src/server/repositories/products.ts`), built on `matchesPl`/`foldPl` (P1's diacritic-insensitive matching, unused by any page until now). A real search box in `SiteHeader`, not a decorative icon — browser-verified end to end: typed "bransoletka" in the header, submitted, got the real bracelet product back; a query with no matches ("dąb", which doesn't diacritic-fold-match "Dębowy") correctly shows the honest no-results state instead of nothing or an error
- [x] All navigation works, no broken links — `SiteHeader` (real category links, every page) + homepage category cards + product cards + breadcrumbs; verified end-to-end with a real Playwright click-through (home → category → product), not just visual inspection
- [x] `generateMetadata` per page from DB fields — category and product pages pull `seoTitlePl`/`seoDescPl` from the DB; homepage metadata is static since there's no site-settings record to pull from
- [x] Canonical URLs — homepage, category, and product pages all set `alternates.canonical`; confirmed absolute and correct after fixing a missing `metadataBase` (Next warned about it on the first build)
- [x] Open Graph with real product imagery — real seeded image URLs, resolved to absolute via `metadataBase`; "real" images are still the D5 placeholders, the OG mechanism itself is real
- [x] Schema.org Product + Offer (PLN) — verified via `JSON.parse` on the actual rendered `<script>` tag, not just visual inspection
- [ ] Schema.org FAQPage — not built; no FAQ content exists yet to attach it to (see the homepage line above)
- [x] BreadcrumbList on catalogue pages — one `Breadcrumbs` component renders both the visible trail and the JSON-LD from the same data, so they can't drift apart; verified via `JSON.parse` on the rendered output
- [x] `sitemap.ts` generated from the DB — verified live at `/sitemap.xml`: 1 homepage entry + 6 categories + 5 products, all real slugs
- [x] `robots.ts` — verified live at `/robots.txt`, references the real sitemap URL
- [x] Catalogue pages server-rendered (no client-side data fetch for content) — true by construction: confirmed zero `'use client'` directives anywhere under `src/app/(shop)`, `src/app/(marketing)`, `src/ui/primitives`, or `src/server`
- [~] Lighthouse SEO ≥ 95, LCP acceptable on mobile — **SEO: 100/100**, desktop and mobile, both a category and a product page, met and verified. **LCP: improved, not clearly "acceptable" yet** — see the note below the table; a real architectural bug was found and fixed along the way, which is the more important result of running this audit at all

**Lighthouse found a real bug, 2026-08-23: the theme provider was shipping the
full MUI + Emotion + React client runtime to every page, including pages with
zero interactive MUI components — exactly the R3 risk `ARCHITECTURE.md` §23
names, which the RSC/island lint rule only half-covers (it stops `@mui/material`
*imports* in server components; it never stopped the theme *wrapper* around
them).** First mobile audit on `/produkt/stolek-loftowy-z-grawerem`: performance
74/100, LCP 3.8s, TBT 500ms, Speed Index 3.9s, ~410KB transferred including
~154KB of MUI/Emotion/React JS chunks — on a page with no `@mui/material`
import anywhere in its own tree. Fixed by extracting the theme's CSS custom
properties into a plain stylesheet (`src/app/theme-vars.css`, values read live
off a rendered page, not guessed) and removing `ThemeRegistry` — MUI's actual
client provider — from the root layout entirely. Verified the page renders
byte-identically first (same background color, same font, same weight, via
`getComputedStyle`). Re-audit: performance 85/100, LCP 3.4s, TBT 320ms, Speed
Index 1.3s, ~376KB transferred.

**LCP barely moved (3.8s → 3.4s) because it was never mostly a MUI problem** —
the same two largest JS chunks (70KB, 44KB) are still present after removing
`ThemeRegistry` entirely; they are Next.js's own framework runtime, not MUI's.
The real remaining weight is four self-hosted web font files (~198KB: two
subsets — `latin` and `latin-ext` — × two families, Fraunces and Inter, all
genuinely requested because real Polish text like "Stołek" and "łoftowy" spans
both subsets in the same sentence). That is close to unavoidable for two full
type families with correct Polish diacritic support, which is itself a
non-negotiable requirement (`ARCHITECTURE.md` §17.1). Lighthouse's default
mobile profile also simulates a deliberately pessimistic mid-tier-phone/slow-4G
baseline, not median real-world conditions — the field data (real users) for a
Polish audience on typical LTE/wifi is very likely meaningfully better than
this lab number. Recorded honestly rather than either declared "fixed" or
left unexamined: **the architectural bug is fixed and confirmed; the
remaining LCP number is a font-payload and lab-methodology question, not
solved, and worth revisiting once real product photography (D5) changes the
page weight anyway.** `ThemeRegistry` still exists, still correct, reserved
for the first real interactive island (P3).

**The 2026-08-24 storefront redesign found four more real bugs**, none of
them guessed — full detail in `docs/HANDOVER.md` §9h:

1. `@mui/icons-material` icons are `"use client"` and Emotion-styled
   internally; using one in a plain Server Component (no `ThemeRegistry`
   above it) produced a genuine React hydration mismatch. `SiteHeader`
   renders on every page, so the fix couldn't be "wrap it in
   `ThemeRegistry`" — that reintroduces the exact §9e regression. Replaced
   with `src/ui/icons/` — plain inline SVGs using the same path data,
   zero Emotion dependency, still real Material Design icons.
2. An inline `style={{ gridTemplateColumns: '1fr' }}` cannot be overridden
   by any stylesheet rule, media queries included — inline styles always
   win the CSS cascade. Three "responsive" two-column layouts (homepage
   hero, category sidebar, PDP intro) silently never became two columns at
   any viewport width until the base rule was moved into the `<style>`
   block alongside its override.
3. `CategoryTile`/`ProductCard` set both an `alt` on the image and a
   separate visible text label inside the same link, giving screen readers
   a duplicated accessible name ("Loft Loft") — caught by a Playwright
   locator that, not coincidentally, matched it for the same reason a
   screen reader would find it redundant. Fixed by making the image `alt`
   decorative (`alt=""`) since the visible label already does the job.
4. Client-side navigation away from `/[category]` (now dynamically
   rendered — it reads `searchParams` for the filter/sort feature)
   intermittently never completed under `next dev`: the destination's RSC
   fetch returned 200, but the router never committed the URL change, with
   zero console errors. Reproduced repeatedly under `next dev`, never once
   under a production build (`next build && next start`, clicked the same
   link ten times) — a Turbopack dev-mode first-compile race, not an
   application bug, and not something a real visitor ever hits.
   `playwright.config.ts`'s `webServer` now runs the production build.

## P3 — Configurator

Started 2026-08-23. The foundation (step machine, compatibility resolution,
server-authoritative pricing/feasibility, the first real MUI client island)
is built and browser-verified end to end across three structurally different
product types (WALL_ART, KITCHEN_TILE, LOFT_FURNITURE). Several items below
are genuinely unbuilt still — marked `[ ]`, not glossed over. Full detail in
`docs/HANDOVER.md` §9f.

- [x] Step machine renders the correct steps per product type — `src/domain/configuration/steps.ts` (30 unit assertions) + `src/server/actions/configurator.ts`; browser-verified for WALL_ART (6 steps), KITCHEN_TILE (INSTALLATION_VARIANT first, 6 steps), LOFT_FURNITURE (THICKNESS included, 7 steps)
- [~] Design selection works (ready-made, collections, custom) — ready-made selection works and is browser-verified; no `DesignCollection` is seeded to exercise collections; `CUSTOM_UPLOAD` (the CUSTOM product type's equivalent) is not built — P4's upload pipeline
- [x] Only sellable designs offered (rights status filter) — `availableDesigns` already filtered `rightsStatus` (P1); confirmed live, only the one `APPROVED_COMMERCIAL` design appears
- [x] Material selection works, unavailable options disabled with a Polish reason — `resolveOptionAvailability` (`src/server/configurator/resolve-options.ts`, 9 assertions) returns every option with an `isAvailable`/`reason` pair, computed by comparing two calls to the already-tested `domain/compatibility` functions; the UI renders every option with unavailable ones `disabled` and a `title` tooltip via `unavailabilityReasonMessage`. Not browser-verified against real data — every seeded product currently has exactly one material/design/finish, so there is nothing live to disable yet; verified by fixture tests instead
- [~] Size selection — presets and custom dimensions — custom dimensions work, browser-verified, with a real bug caught and fixed live (see `docs/HANDOVER.md` §9f). No `ProductPresetSize` rows are seeded, so preset-size selection has nothing to render yet
- [x] Thickness step for tabletops and floor elements — browser-verified on the loft product (`stolek-loftowy-z-grawerem`, shares `TABLE_TOP`'s step list): "27 mm" / "40 mm" render from real `ProductThickness` rows
- [x] Finish selection filtered by material — browser-verified: oak (`dab`) offers "Olejowanie"; gres (`gres-bialy`) honestly shows "not available for this configuration yet" rather than a fake option, matching the real gap the seed script already flagged
- [~] Personalization with font selection — 2026-08-24: font selection and real cmap-parsed glyph-coverage validation are built and browser-verified end to end (`src/ui/islands/configurator/Configurator.tsx`'s new `PersonalizationStep`, `src/server/configurator/price-configuration.ts`'s `evaluatePersonalization`). A real `Font` row (Inter, `public/fonts/Inter-Variable.ttf`, Google's own OFL repository) is seeded with coverage parsed live from the actual file's cmap table every seed run (`prisma/seed.ts`'s `seedFont`), never a hardcoded JSON blob — matching the domain header's own "parsed from its cmap table at seed time" requirement. All three products whose step list includes PERSONALIZATION (loft, bracelet, wall art) now have a real, enabled `PersonalizationSpec` with this font allowed. Browser-verified: a Polish name with `ł` validates cleanly once the font is chosen; a too-long text and a genuine emoji both correctly block with the real Polish message from `personalizationMessage`; the "choose a font first" gate blocks validation (not silently skips it) until a font is picked. **Still not built:** live text *preview* — no 2D rendering exists yet (that's §7.3's preview, tracked separately below), so this closes the font/validation half of this checklist line, not the whole line
- [x] Preview updates immediately on every change — 2026-08-24: `src/ui/islands/configurator/ConfiguratorPreview.tsx`, a persistent SVG composited mockup visible from the Design step onward on every step (owner's explicit choice — see the three-question decision recorded in `docs/HANDOVER.md` §9k). Real material photo background, the seeded design's real `previewUrl` overlaid with a multiply blend, and — the one part of this that is not a placeholder at all — the customer's personalization text rendered in the exact chosen font file via the Font Loading API, loaded from the same `Font.fileUrl` `seedFont` parsed coverage from. Browser-verified: "Michał" renders with a correctly shaped `ł` composited directly onto the real oak photo, live, as the customer types
- [x] Preview shows module seams when modular — drawn directly from `ModuleLayout.modules`' real per-module `xMm`/`yMm`/`widthMm`/`heightMm` (`domain/modules/split.ts`), the same numbers pricing already uses — not re-derived or guessed. Browser-verified on the wall-art product at 1200×400mm: a real dashed seam line appears exactly at the true 2-module split
- [x] Kitchen installation variants selectable, with diagrams, as the first step — browser-verified including the diagram: selecting a variant now renders its `descPl` and `diagramUrl` (a real, honestly-labelled placeholder SVG, same convention as product photography — see `prisma/seed.ts`'s header)
- [x] Summary states plainly what the customer receives per variant — the summary now surfaces `InstallationVariant.receivesPl` for the chosen variant and `Product.materialNotesPl` verbatim; browser-verified on the loft product (materialNotesPl about the bought-in metal base) and the KITCHEN_TILE product's install-variant text
- [x] Floor/panel products require exact dimensions and the matching acknowledgement — `requiresExactSize` gates a new mandatory checkbox in the summary showing §11's exact copy (`COPY.floorFinalDimensions`, already defined, previously unused); browser-verified on the floor panel product (`panel-podlogowy-z-grawerem`) end to end: the add-to-cart button stays disabled until both this AND the `FLOOR_MATCH_NOT_GUARANTEED` feasibility warning are acknowledged, then enables
- [x] "Blat. Nogi nie są w zestawie." shown on product page, summary and confirmation — shown on the product page (P2) and now also the configurator summary (same fix as the line above — `materialNotesPl` renders in both places from the same DB field). "confirmation" (order confirmation) doesn't exist yet — no orders exist until P5
- [x] Price updates correctly on every change — browser-verified live (343,90 zł for the WALL_ART configuration built during testing)
- [x] Price computed server-side only; client never derives it — true by construction: `src/server/actions/configurator.ts` is a `'use server'` Server Action: the client only ever renders what it returns
- [x] Price breakdown available and stored — 2026-08-24: a real `Configuration` row is written on every add-to-cart (`docs/HANDOVER.md` §9l), caching the full breakdown exactly as the schema intends
- [x] Large products correctly represented as modules — 2026-08-24: the 2D preview (§9k) draws real seam lines directly from `ModuleLayout`, not just a count
- [x] Modular build framed as a feature, not a limitation — the existing `MODULAR_BUILD` Polish copy (P1) renders as an info alert, unchanged
- [x] Feasibility warnings shown, with acknowledgement where required — unit-tested (17 assertions in `tests/unit/configurator-server.test.ts`) and wired into the UI with a checkbox per warning; browser-verified live on the floor panel product: `NATURAL_VARIATION`/`MODULAR_BUILD` (notices, no acknowledgement) and `FLOOR_MATCH_NOT_GUARANTEED` (warning, real checkbox, correctly gates add-to-cart) all rendered from real data
- [x] Incompatible selections cleared explicitly with an explanation, never silently swapped — the previous version blanket-cleared finish on every material change and thickness on every installation-variant change, whether or not the old value was actually still valid; now checked conditionally against the real catalogue data and only cleared (with a dismissible Polish notice) when genuinely incompatible. Not browser-verified against real data for the same reason as the line above — one material per product today, so a material change has nothing to invalidate live yet
- [x] All configuration combinations validated server-side — every check (dimensions, feasibility, modules, pricing) runs inside the Server Action against real rows
- [x] Configuration persists across page refresh — browser-verified: the full selection round-trips through the URL, and a refresh resumes at the furthest step the restored selections actually reach (a real bug — always resetting to step 1 — was caught and fixed live)
- [x] Browser back/forward behaves correctly — a `popstate` listener now re-syncs `selections` and re-resolves the furthest reachable step whenever the URL changes outside the component's own control. Browser-verified by simulating a real back/forward URL change (`history.pushState` + a dispatched `popstate` event, exactly what the browser fires): price and module count recomputed correctly (343,90 zł → 701,84 zł, 1 → 4 modules) with no reload and zero console errors
- [x] Sticky price summary on desktop and mobile — 2026-08-24: `StickyPriceBar` in `src/ui/islands/configurator/Configurator.tsx`, `position: fixed` to the viewport bottom, visible on every step (not just Summary), reusing the previously-unwired `configuratorPriceCalculatingPl` copy for the in-flight-fetch state and a new `configuratorPriceUnavailableGenericPl` for the dimension-invalid/infeasible states. Browser-verified: price updates live from "Podaj wymiary…" → "Obliczanie ceny…" → a real server-computed amount as selections are made, confirmed via DOM `getBoundingClientRect` at both desktop and mobile viewport sizes that it stays pinned to the viewport bottom with no horizontal overflow
- [~] Configurator usable on mobile — a real, sitewide bug was found and fixed in an earlier pass: `h1`/`h2`/`h3` had no responsive sizing at all (a leftover gap from extracting static theme tokens, §9e), so a 96px heading overflowed a 375px viewport on every page, not just the configurator. Fixed with a `clamp()` fluid scale in `theme-vars.css`, verified at both 375px (no overflow) and 1280px (exactly the original 96px, zero regression). **Retried 2026-08-24 as flagged:** layout is further confirmed clean at mobile width (no horizontal overflow — `document.documentElement.scrollWidth === window.innerWidth`, checked via JS, not just a screenshot; the sticky price bar from §9i also confirmed pinned correctly at mobile width the same way). Touch-interaction click-through is still unconfirmed, but now for a specific, isolated reason, not a vague "worth a retry": the browser tool's `left_click` on an option toggle hangs for the full 30s timeout under mobile-preset touch emulation, reproduced twice across two separate sessions, both times with zero console/network errors tied to the click and the click provably never landing (target stayed unselected). Same interaction works instantly under desktop-width clicks in the same tool, same session. This isolates it to the automation tool's mouse-to-touch translation specifically, not the app — nothing here should block considering the app itself mobile-ready, but real device/manual QA before launch is still worth doing since no tool in this environment can currently drive a touch click against this page

## P4 — Upload, design review, IP

- [ ] Upload accepts JPG, PNG, SVG, PDF
- [ ] File type validated by magic bytes, not extension or declared MIME
- [ ] Size limits enforced by streamed byte count, not content-length header
- [ ] SVG sanitized (script, foreignObject, event handlers, external refs, entities)
- [ ] PDF inspected, embedded JS rejected
- [ ] Image resolution and effective DPI checked against target size
- [ ] Aspect mismatch warning with crop preview
- [ ] Filename sanitized for display; storage key opaque and unguessable
- [ ] EXIF (incl. GPS) stripped from previews
- [ ] Preview generated
- [ ] Warnings persisted and shown, incl. „Projekt może wymagać ręcznej korekty przed produkcją."
- [ ] Corrupted and zero-byte files rejected cleanly
- [ ] IP/copyright checkbox unchecked by default, enforced server-side
- [ ] Consent record stores declaration text, version, timestamp
- [ ] Review states: PENDING_REVIEW → APPROVED / NEEDS_CHANGES / REJECTED
- [ ] Illegal transitions rejected
- [ ] Re-upload after NEEDS_CHANGES returns to PENDING_REVIEW
- [ ] Staff comments visible to the customer
- [ ] Customer sees plain status, never CAM terminology
- [ ] Order cannot leave DESIGN_REVIEW with an unapproved custom design
- [ ] Customers cannot access other customers' files (404, not 403)
- [ ] Upload rate limiting

## P5 — Cart, checkout, order

Built 2026-08-24/25 in one pass, per the owner's explicit instruction not
to skip anything within P5's real scope. Full detail in `docs/HANDOVER.md`
§9l.

- [x] Cart retains complete configuration — every field a `Configuration` row has, browser- and DB-verified
- [x] Edit configuration from cart — updates the same `Configuration` row in place, round-tripped through the configurator's own URL-encoded selections state; browser-verified (`updatedAt` changed, no duplicate row)
- [x] Duplicate configuration (deep copy, not quantity) — a genuinely new `Configuration` row, browser- and DB-verified
- [x] Remove configuration — verified
- [x] Two different configurations of the same product in one cart — structural by construction (every add-to-cart is a fresh `Configuration`, never merged) and DB-verified (two distinct `configurationId`s, two `OrderItem` rows on checkout)
- [x] Quantity changes recalculate correctly — verified (701,84 zł × 3 = 2105,52 zł)
- [ ] Guest cart merges into user cart on login without loss — **blocked, not skipped**: impossible without Auth.js (P6, not started). Guest checkout is built completely and is the primary path today; the merge logic gets written once there is a login to merge on
- [x] Checkout collects buyer, invoice (NIP checksum), address, delivery — delivery is address-only (no method-choice UI): the schema has no `deliveryMethod` field and no `ShippingMethod` model, so there is exactly one implicit method at a flat placeholder rate, not a fabricated chooser
- [x] Polish postal code and phone validation — real algorithms (`domain/checkout/validate.ts`), unit-tested and browser-verified (a "98765" postal code was rejected with the real Polish message, a corrected "80-001" was accepted)
- [x] Terms and withdrawal-right acknowledgements captured — real Polish legal copy citing art. 38 pkt 3 ustawy o prawach konsumenta, stored verbatim on the `Order` row with `termsVersion` and both timestamps
- [x] Order creation is a single transaction, rolls back fully on failure — `prisma.$transaction`, the first in this codebase; the per-month order-number counter increment lives inside it specifically so a failed order never burns a number
- [x] Prices recomputed and compared at add-to-cart and at checkout — checkout re-runs `priceConfiguration` fresh for every cart item and compares against the `Configuration`'s cached price/pricing version before opening any transaction
- [x] Price mismatch rejected with a clear Polish message, never silently accepted — the existing (P1-written, finally used) `COPY.priceChanged` string
- [x] Complete configuration snapshot stored with the order — real display names (not just ids), full `PriceBreakdown`, module layout; **DB-verified directly**: renamed a live `Material` row after placing an order, reloaded the confirmation page, it still showed the original name, then reverted the rename — the same "mutate and check" rigor as the P2 Lighthouse pass, not just an architectural claim
- [x] Pricing version pinned per line — `OrderItem.pricingVersion`, verified
- [x] Order renders identically after catalogue rows are mutated — see the snapshot verification immediately above; this is the same fact, verified the same way
- [x] Order numbers unique under concurrency — the per-year-month counter table (`INSERT ... ON CONFLICT DO UPDATE ... RETURNING`, race-free by construction) has now genuinely been hit concurrently: Playwright's e2e suite runs `desktop-chromium` and `mobile-safari` checkout tests in parallel across 4 workers against the same dev database, and order numbers came out correctly sequential (0001, 0002, ... 0008 across this session's manual + automated runs), never colliding
- [x] Bank transfer details, order number as title, amount shown — verified live; the account NUMBER itself is honestly deferred ("prześlemy osobno — e-mailem lub podczas kontaktu") rather than inventing one, since no real bank account exists in this system yet (same P7-admin-config gap as shipping rates) and a fabricated account number is a real-world harm category, not just an ordinary placeholder
- [x] No fake payment confirmation anywhere — `PaymentStatus` stays `AWAITING` by construction; nothing in this pass ever sets `PAID`
- [x] Guest order lookup by number + token, constant-time comparison — `timingSafeEqual`, guarded against its own length-mismatch throw; browser-verified end to end including a deliberately wrong token, which 404s identically to a nonexistent order (§16.1's "404, not 403")
- [x] Order confirmation page and email content correct — confirmation page verified live (order items, total, bank details or contact-arranged notice); "email content" is honestly N/A today — the `Mailer` interface is real but unconfigured (no SMTP/Resend credentials exist), logs what it would have sent, and the confirmation page says so plainly rather than claiming an email went out

## P6 — Account & polish

- [ ] Order history with full original configuration and pricing
- [ ] Saved configurations
- [ ] Customer file access restricted to owner
- [ ] Mailer adapter; unconfigured mailer logs and does not claim delivery
- [ ] Transactional messages in Polish for each status
- [ ] Analytics events implemented
- [ ] Analytics fire only after consent
- [ ] Cookie/consent banner (RODO)
- [ ] Legal pages: Regulamin, Polityka prywatności, RODO clause, Prawo odstąpienia
- [ ] Withdrawal-right exemption for custom goods stated and acknowledged
- [ ] Loading states everywhere data is fetched
- [ ] Empty states (cart, orders, saved configurations, no results)
- [ ] Error states for every case in §35 of the brief
- [ ] No raw technical errors shown to customers
- [ ] Correlation id shown on server errors

## P7 — Admin panel

### P7a — operational minimum (unblocks launch)

- [ ] Role model: CUSTOMER / STAFF / ADMIN; first admin seeded
- [ ] `/panel` middleware: unauthenticated redirected, customers 404
- [ ] AuditLog model and write-on-mutation helper
- [ ] Order list with filters
- [ ] Order detail: full snapshot, line breakdown, module layout, event timeline
- [ ] Status transitions with audit and mandatory note on backwards moves
- [ ] Mark bank transfer as paid
- [ ] Design review queue: preview, warnings, original file, comments
- [ ] Approve / request changes / reject; internal production method assigned
- [ ] Design-review gate blocks production until resolved

### P7b — management

- [ ] Categories CRUD
- [ ] Products CRUD incl. dimension envelope, SEO fields, activate/deactivate
- [ ] Preset sizes, thicknesses, installation variants
- [ ] Product↔material compatibility editor
- [ ] Product↔design assignment
- [ ] Product image upload, ordering, alt text
- [ ] Designs CRUD incl. production metadata
- [ ] Design rights status + provenance fields; new designs default to non-sellable
- [ ] Design collections CRUD
- [ ] Materials CRUD incl. sheet limits, min line width, grain direction, CNC/laser flags
- [ ] Finishes CRUD
- [ ] Material↔finish compatibility matrix editor
- [ ] Customers list and detail
- [ ] RODO export and deletion (anonymise user, retain order records)
- [ ] Content: FAQ, static pages, homepage sections
- [ ] Reviews moderation — no facility to author a testimonial in a customer's name
- [ ] Production queue grouped by status, module manifest, capacity view
- [ ] Printable production brief, clearly labelled not a production file
- [ ] Settings: staff users, bank details, shipping rates, email templates
- [ ] Audit log viewer
- [ ] Soft delete enforced for entities referenced by orders

### P7c — admin UX

- [ ] MUI `plPL` locale applied to core, DataGrid and Pickers
- [ ] Global search (Ctrl/⌘+K) across orders, customers, designs, products
- [ ] Keyboard navigation in grids; J/K between records without returning to the list
- [ ] Saved filters as pinned tabs
- [ ] Bulk actions with selection toolbar
- [ ] Inline editing for cheap fields (availability, sort order)
- [ ] Column config, density and sort persisted per user
- [ ] Optimistic updates with „Cofnij" undo snackbar
- [ ] Confirmation dialogs only for irreversible actions
- [ ] Form state survives validation errors; dirty-form navigation warning
- [ ] Autosaved drafts on long forms
- [ ] Every disabled control explains why on hover
- [ ] Validation messages name the fix, not the rule
- [ ] Activity timeline on every record, from the audit log
- [ ] "Preview as customer" from every product and design
- [ ] Empty states say what to do next
- [ ] Duplicate action on products, designs, materials
- [ ] Drag-drop image upload with reordering and inline alt text
- [ ] Print views: production brief, packing list
- [ ] CSV import/export on catalogue tables
- [ ] Order and production views usable on tablet at 1024px
- [ ] Dense grid mode by default with comfortable toggle
- [ ] Every dashboard number clicks through to the records behind it
- [ ] Each admin module shipped as a working vertical slice, never UI on mock data

## P8 — Pricing admin & statistics

- [ ] Pricing screens restricted to ADMIN
- [ ] Every save creates a new PricingSettings version; nothing edited in place
- [ ] Price simulator shows before/after on reference configurations
- [ ] Publish blocked until simulation viewed
- [ ] Existing orders unchanged after a rate change (test)
- [ ] Full audit diff on every pricing change
- [ ] AnalyticsEvent model, written only for consented sessions
- [ ] 12-month pruning of analytics rows
- [ ] Dashboard KPI tiles
- [ ] Revenue and orders charts with date range
- [ ] Orders by status, top products / designs / materials
- [ ] Configurator funnel with drop-off per step
- [ ] Production load: queued m² and machine-minutes
- [ ] CSV exports

## Cross-cutting verification

- [ ] Polish used throughout the customer-facing UI
- [ ] Code identifiers, tables and tests in English throughout
- [ ] No accidental English UI strings remain
- [ ] Web fonts loaded with `latin-ext` subset — ą ć ę ł ń ó ś ź ż render everywhere
- [ ] Engraving fonts: cmap coverage parsed and stored; uncovered characters rejected
- [ ] Preview renders the same font file production uses
- [ ] Polish plurals correct at 1 / 2 / 4 / 5 / 12 / 22 / 25 / 112
- [ ] Dates use genitive month form ("23 sierpnia 2026")
- [ ] Currency formats as `1 234,56 zł`
- [ ] Numeric inputs accept comma decimals ("1,2")
- [ ] Lists sorted with Polish collation (ą after a, ł after l, ż last)
- [ ] Search is diacritic-insensitive ("dab" finds "dąb")
- [ ] Slugs transliterated, no percent-encoded diacritics
- [ ] Postal code, NIP checksum, +48 phone validated
- [ ] Address form in Polish order (street, number, postal code, city)
- [ ] Polish quotation marks „ … " in copy
- [ ] No line break after single-letter words (w, i, z, o, a)
- [~] Mobile layout verified — a real sitewide overflow bug (unresponsive h1-h3, found via the P3 mobile check) was fixed 2026-08-23, see the P3 section. Checked on the product page and configurator only, not category pages, the homepage, or the admin panel (which doesn't exist yet)
- [ ] Tablet layout verified
- [ ] Desktop layout verified
- [ ] No critical console errors
- [ ] Backend validation on every action; frontend values never trusted
- [ ] Authorization matrix fully tested
- [ ] Structured logging in place
- [ ] Backup strategy documented
- [ ] No fake payment, email, production files, or status updates anywhere in the codebase

## Edge cases (brief §36)

- [ ] Very small product
- [ ] 120 × 120 cm product
- [ ] Extremely wide product
- [ ] Extremely tall product
- [ ] Unsupported dimensions
- [ ] Thin lines
- [ ] Very small text
- [ ] Large text
- [ ] Long personalization
- [ ] Unsupported font / glyph
- [ ] High-resolution image
- [ ] Huge file
- [ ] Invalid file
- [ ] Corrupted file
- [ ] Missing design
- [ ] Unavailable material
- [ ] Unavailable finish
- [ ] Changing material after selecting size
- [ ] Changing size after personalization
- [ ] Changing design after uploading a custom file
- [ ] Changing installation concept for kitchen tile products
- [ ] Refreshing the page during configuration
- [ ] Browser back button during configuration
- [ ] Two different configurations of the same product in one cart
- [ ] Duplicate configuration
- [ ] Mobile configurator
- [ ] Tablet configurator
- [ ] Desktop configurator
