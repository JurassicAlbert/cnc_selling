# Handover prompt — cnc_selling

> Paste everything below the line into a fresh Claude Code session opened at
> `C:\Projects\cnc_selling`. It is written to be self-contained: it states what
> exists, what does not, what must not be changed, and what to do next.

---

You are continuing an in-progress build. Read this whole brief before touching
any file, then read `docs/ARCHITECTURE.md` (the design) and
`docs/CHECKLIST.md` (progress tracking). Do not re-litigate decisions recorded
below — they were made deliberately with the owner.

## 1. The project

Polish-language (`pl-PL`) e-commerce for a small Polish brand that designs and
manufactures premium customizable products with CNC milling and laser
engraving: wall art, coffee tabletops, kitchen backsplash tiles, floor
elements, and made-to-order pieces.

Repo root: `C:\Projects\cnc_selling`. The full original brief is summarised in
`docs/ARCHITECTURE.md`; the owner's TDD rules are in the project instructions
and are binding.

**Stack (chosen by the owner, not open for substitution):**

| Concern | Choice |
|---|---|
| Framework | Next.js **16.x** (Active LTS), App Router |
| Language | TypeScript, `strict: true`, `noUncheckedIndexedAccess: true` |
| UI | **Material UI v9** — not Tailwind, not anything else |
| DB | PostgreSQL + **Prisma v7** |
| Validation | Zod |
| Auth | Auth.js v5 (NextAuth) + Prisma adapter |
| Unit/integration tests | Vitest |
| E2E | Playwright |
| Payments | **None.** Bank transfer / contact only |

## 2. What already exists — do not rewrite it

**Phase P1, the pure domain layer, is now genuinely complete — as of
2026-08-23.** This handover previously said P1 was "complete and delivered"
while two of its seven modules (`compatibility`, `order-status`) did not
exist; `docs/CHECKLIST.md` had them correctly unchecked the whole time, so
trust the checklist over old handover prose if the two ever disagree again.
Everything below now has no Next.js, no Prisma, no database and no I/O —
every rate and limit is passed in as an argument.

```
src/domain/money/money.ts                  grosze arithmetic, basis-point factors, VAT, half-up rounding
src/domain/text/plural.ts                  Polish three-form plurals via Intl.PluralRules
src/domain/text/nouns.ts                   countable noun table (moduł/moduły/modułów ...)
src/domain/text/numeric-input.ts           comma-decimal parsing, cm -> integer mm, dimension formatting
src/domain/text/collation.ts               Polish sort order, diacritic folding, search matching
src/domain/dimensions/dimensions.ts        size envelopes, aspect ratio, invalid input
src/domain/compatibility/resolve.ts        option filtering — §7.2's four availableX() functions
src/domain/modules/split.ts                modular splitting, layout, production order
src/domain/pricing/types.ts                PricingInput / PriceBreakdown contract
src/domain/pricing/calculate.ts            the single source of truth for price
src/domain/personalization/validate.ts     text length, lines, real font glyph coverage
src/domain/feasibility/rules.ts            errors / warnings / notices about manufacturability
src/domain/order-status/transitions.ts     order status graph — legal moves, actor permission, the design-review gate
src/domain/configuration/steps.ts          the configurator's step machine — §5's step lists, §7.1's entry gating (added 2026-08-23, P3)
src/content/pl/messages.ts                 every customer-visible Polish string
tests/unit/*.test.ts                       13 files, 354 assertions
```

Two of those need a closer look before you build on them, because
`ARCHITECTURE.md` doesn't fully specify either:

- **`domain/compatibility`** implements §7.2's four `availableX()` functions
  exactly, including the trap in `Design.materials`' own doc comment: empty
  `DesignMaterial` rows mean "every material the product allows", not
  "allows nothing". Get that inverted and every design silently vanishes from
  every product's material list.
- **`domain/order-status`** encodes a transition graph that is **this
  project's own design**, not something copied from the architecture doc —
  it only enumerates the `OrderStatus` values, not the edges between them.
  It follows two things that ARE specified (§15's NEW-vs-AWAITING_PAYMENT
  creation rule, §13.3's design-review gate) and adds one policy of its own,
  stated in the module's header comment so it can be argued with:
  **cancellation ends once an order ships** — staff may cancel at any earlier
  stage, a customer only before their order is confirmed. If the owner wants
  a different cancellation policy, this is a small, isolated change.

**P0 is complete; P2 is functionally complete** — built across 2026-08-23:
data layer, Next.js/MUI shell, a linter swap after TypeScript 7 turned out to
be incompatible with the obvious choice, real catalogue content once the
owner gave the real category list, then the category/product pages
themselves — during which a real Lighthouse audit caught the theme provider
shipping MUI's full client runtime to every page. Full detail, in the order
it was built, is in §9a (seed script), §9b (machine-thickness feasibility
rule), §9c (app shell, ESLint → Biome), §9d (the catalogue — two new
product types, placeholder imagery), and §9e (category/product pages, a
JSON-LD security fix, and the Lighthouse-caught bug — read this one before
touching `src/app/layout.tsx` or `ThemeRegistry`). Headline inventory:

```
prisma/schema.prisma                    33 models, validated, MIGRATED — applied to a live database
docker-compose.yml                      Postgres 16, dev + test databases, running on host port 5433
prisma/seed.ts                          structural baseline + real catalogue — §9a, §9d
scripts/generate-placeholder-images.mjs on-brand SVG placeholders, not stock photos — §9d
src/server/mapping/to-domain.ts         Prisma rows -> domain inputs. The seam. Unit-tested.
src/server/db/, src/server/repositories/  Prisma singleton + the only files that query for page content — §9e
src/app/(shop)/, src/app/(marketing)/   real category/product pages + homepage — §9e
src/app/theme-vars.css                  theme tokens as plain CSS — NOT ThemeRegistry — read §9e first
next.config.ts, src/ui/                 Next.js 16 App Router shell + MUI v9 theme — §9c, §9e
playwright.config.ts, tests/e2e/        desktop + mobile, real click-through navigation test — §9c, §9e
biome.json                              linter + formatter; the @mui/material restriction lives here — §9c
scripts/check-polish-literals.mjs       the Polish-literal check — a script, not a Biome rule, on purpose — §9c
```

`src/generated/prisma` is the generated Prisma client. Gitignored, rebuilt by
`npm install` (postinstall) or `npm run prisma:generate`, never edited.
`next-env.d.ts` is likewise gitignored and Next-generated; Next can also
rewrite `tsconfig.json`'s `compilerOptions` in place (`jsx`, `allowJs`,
`include`) on `dev`/`build` — expected behaviour, not a regression to revert.

**The storefront (homepage/category/product pages) was redesigned
2026-08-24** — read §9g before assuming P2's earlier "deliberately sparse"
framing still holds; it doesn't. Real category/product/material photography,
a hero section, trust badges, a filter/sort sidebar, and real search all
exist now. **Still not started:** the homepage's *narrative* sections (hero
copy, craftsmanship, reviews, FAQ — needs the owner's words; reviews needs
real customers, full stop), Schema.org FAQPage (nothing to attach it to
yet). **P3 (the configurator) is under way, not finished** — its foundation
(step machine, server-side compatibility/pricing/feasibility, the first real
MUI client island) is built and browser-verified; the 2D preview,
font-backed personalization, cart persistence, and several other pieces are
honestly still open. Full detail in §9f — read it before touching
`src/ui/islands/configurator/`, `src/server/configurator/`, or
`src/server/actions/configurator.ts`. §9g/§9h cover the redesign and four
more real bugs it found — read those before touching `src/ui/primitives/`,
`src/ui/icons/`, `next.config.ts`, or `playwright.config.ts`.

## 3. Status of the first action — done, 2026-08-23

The suite was installed and run. Results, from real output rather than
prediction:

```
npm test         9 files, 252 tests, all passing, ~1 s
npm run typecheck clean
```

One thing was red and is fixed: `tsconfig.json` still set `baseUrl`, which
**TypeScript 7 removed**. `paths` now resolves relative to the tsconfig
directory, so `"@/*": ["./src/*"]` works unchanged with `baseUrl` deleted.
Nothing else in P1 needed a correction — the domain layer is sound, and the
Polish-locale facts in §5 below were re-checked and hold.

Installed since: `prisma` 7.9.1, `@prisma/client`, `@prisma/adapter-pg`, `pg`,
`dotenv`. `npm audit` reports a high advisory in `deepmerge-ts`, reachable only
through `@prisma/config` in the **dev-time CLI**, not the runtime client; the
only offered fix downgrades to Prisma 6, which the owner's stack forbids. Left
in place deliberately — re-check when Prisma ships a patched `@prisma/config`.

## 4. Conventions that are not negotiable

These are enforced by tests and by the owner's review. Breaking one is a bug,
not a style difference.

**Money is integer grosze.** `Grosze = number`, always a safe integer. Never a
float, never złoty as a decimal outside the display layer. Multipliers are
**basis points** (`11500` = ×1.15). All rounding goes through
`divRoundHalfUp` from `src/domain/money/money.ts`, which rounds on integers so
the `.5` boundary is exact. Round once per component, not cumulatively.

**Lengths are integer millimetres.** Field names carry the unit: `widthMm`,
`minLineWidthMm`, `thicknessMm`. Customers type centimetres;
`parseCentimetresToMm` converts and accepts `1,2` as well as `1.2` — because
`parseFloat("1,2")` returns `1` and would silently mis-size a product.

**Machining time is integer milli-minutes per m²**
(`machiningMilliMinutesPerM2`, `2500` = 2.5 min/m²). A float here would put
floating point back into the price chain that `money` exists to keep out.

**VAT is computed on the unit price, then multiplied by quantity.** Not on the
line total. The two differ by up to a grosz per line and invoices use the unit
form. `vatRateBp` is basis points (`2300` = 23%).

**Code is English, content is Polish.** Identifiers, tables, functions, tests,
comments, commit messages: English. The `…Pl` column suffix marks
customer-visible copy. The domain layer returns typed **codes**;
`src/content/pl/messages.ts` turns codes into Polish. No user-visible string
literal belongs inside a component.

**The domain layer imports nothing.** No Next, no Prisma, no I/O, no
environment access. If a domain function needs a rate, the rate is a
parameter. This is what keeps the business rules testable in milliseconds.

**Prices are server-authoritative.** `calculatePrice` runs only in Server
Actions. Recompute and compare at add-to-cart and again at checkout. A
mismatch is a hard error with a Polish message — never silently accept the
client's number.

**Nothing is faked.** No simulated payment confirmation, no pretend email
delivery, no "production file" that is really a preview, no status that
implies work not done. If an integration does not exist, the code and the UI
say so. This is an explicit owner rule, not a preference.

## 5. Verified Polish-locale facts

These were checked by executing Node, not assumed. Do not "correct" them.

- **Polish CLDR sets `minimumGroupingDigits: 2`.** `formatPln(123456)` returns
  `1234,56 zł` with **no** thousands separator; grouping starts at five
  digits. The space before `zł` is U+00A0.
- **Plurals have three forms**: 1 = one, 2–4 = few, 5–21 = many, 22–24 = few,
  25 = many, 102 = few, 112 = many, decimals = other. So `1234 produkty`
  (few — `1234 % 10 === 4`), but `12345 produktów`.
- **`Intl.Collator('pl-PL')` default sensitivity is correct** — ą sorts after
  a. Do not add `sensitivity: 'base'`; that makes them equal, which is right
  for search and wrong for sorting.
- **Google Fonts need `subsets: ['latin', 'latin-ext']`.** The default `latin`
  subset omits ą ć ę ł ń ó ś ź ż and fails silently.
- **Engraving fonts are a separate problem from web fonts.** Decorative faces
  frequently lack Polish letters; „Michał" would be carved permanently wrong.
  Font glyph coverage is parsed from the font's cmap at seed time and
  validated — see `src/domain/personalization/validate.ts`.
- **Custom-made goods are exempt from the 14-day withdrawal right**
  (art. 38 pkt 3 ustawy o prawach konsumenta). Must be stated on product pages
  and acknowledged at checkout. Have a Polish lawyer review the Regulamin.

Three test expectations were wrong in the first draft for exactly these
reasons (grouping, the `1234 produkty` plural, and a missed `ł` in „Zażółć").
Assume Polish will surprise you; verify against `Intl` rather than intuition.

## 6. Your next task: finish P0

Build the application foundation. Nothing in it should change the domain layer.

**6.1 Prisma schema and first migration — DONE 2026-08-23.**
`prisma/schema.prisma` holds 33 models covering everything in
`docs/ARCHITECTURE.md` §6 plus Appendix A. Every constraint listed in the
original version of this section is honoured: `machiningMilliMinutesPerM2 Int`,
`referenceWidthMm Int`, `minPriceGrosze Int`, `grainDirection`, the
`PricingSettings` / `MachineSettings` rate tables, and the four enums that must
match `src/domain/pricing/types.ts` exactly.

Four decisions were taken while writing it. They deviate from
`ARCHITECTURE.md` §6 and the deviation is deliberate:

1. **Sub-millimetre tolerances are integer micrometres, suffix `Um`**
   (`minLineWidthUm = 1200` is 1.2 mm), not `Float` millimetres as §6.3
   proposed. The domain compares a scaled design feature against a material
   minimum and the "exactly at the limit" case is a real test; stored as
   double precision, 1.2 is not exactly 1.2 and that comparison can flip. This
   follows the convention `machiningMilliMinutesPerM2` already set. The mapper
   converts, and the conversion is tested.
2. **Aspect ratios are basis points** (`minAspectRatioBp = 2000` is 0.2), for
   the same reason and the same precedent.
3. **`Material.minDetailSpacingUm` was added.** `evaluateFeasibility` reads
   `material.minDetailSpacingMm`; §6.3 has no such column. Without it the
   `DETAIL_SPACING_TOO_TIGHT` rule could never fire.
4. **`PricingSettings` is append-only, keyed by `version`**, with a partial
   unique index (`WHERE is_active`) making two published rate sets impossible
   at the database level rather than by admin discipline. `MachineSettings`
   is a true singleton with a `CHECK (id = 1)`.

The migration also carries hand-written `CHECK` constraints on the columns that
decide what a customer is charged — non-negative prices, ordered dimension
envelopes, `detailLevel BETWEEN 1 AND 5`, positive quantities. The domain
already enforces these; the database enforces them again so a bad seed script
or a hand-written `UPDATE` cannot create a row the domain would reject.

**The migration is applied — DONE 2026-08-23.** Generated offline with
`prisma migrate diff` (Docker Desktop wasn't running yet), then applied for
real once it was: `npm run db:up && npm run db:deploy`. Confirmed via `psql`:
all 33 domain tables plus `_prisma_migrations`, the hand-written `CHECK`
constraints, and the `PricingSettings_single_active` partial unique index are
all present in the running `cnc_selling` database.

If you ever need to reapply from scratch, `docker compose down -v` destroys
the volume and `npm run db:up && npm run db:deploy` rebuilds it. If
`migrate deploy` reports drift or a failed statement, the hand-written SQL at
the end of `migration.sql` is the first place to look — it is the part Prisma
did not generate.

**Port 5433, not 5432 — read this before debugging a P1001.** A native
Postgres install already listens on 5432 on this machine, so
`docker-compose.yml` publishes the container on `127.0.0.1:5433` instead.
`DATABASE_URL` / `TEST_DATABASE_URL` in `.env.example` and `.env` use 5433.

**Use `127.0.0.1`, never the hostname `localhost`, in `DATABASE_URL`.** This
cost real debugging time: `docker compose ps` showed the container healthy and
the port listening, `psql`/raw sockets connected fine, yet
`prisma migrate deploy` failed with `P1001: Can't reach database server`. The
cause was Node's DNS resolution order — `dns.lookup('localhost')` on this
machine returns `::1` before `127.0.0.1`, and the container is published on
IPv4 only, so Prisma's engine tried `::1` and hung. Both env files were
already fixed to use `127.0.0.1` directly, which sidesteps the resolver
entirely. Don't "simplify" it back to `localhost`.

**The mapper is written and tested.** `src/server/mapping/to-domain.ts` turns
Prisma rows into `PricingInput`, `DimensionEnvelope`, `SplitLimits`,
`DesignConstraints`, `MaterialConstraints`, the domain `PersonalizationSpec`
and `FontSpec`. Its row types are `Pick`s of the generated Prisma models, so a
renamed column **stops the build** instead of changing a price. Three rules it
encodes, each with a test:

- a nullable factor maps to 10000 bp (×1.00), never to 0, which would make the
  product free;
- an unselected finish costs 0, and is not a missing key;
- the effective minimum text height is the stricter of the product spec and the
  material — a product willing to engrave 5 mm text does not make 5 mm text
  possible on a material that cannot hold it.

`tests/unit/mapping.test.ts` ends with a full priced derivation from rows to
`39 124` grosze gross, spelled out component by component in a comment. That
number is the drift alarm: if it moves, every price on the site moved.

One small change was made inside P1 to support this:
`countPersonalizationCharacters` / `personalizationCharacters` are now exported
from `src/domain/personalization/validate.ts` and used by both the validator
and the mapper, so the rule "newlines are not billable characters, count code
points not UTF-16 units" has exactly one implementation.

**6.2 Local Postgres — DONE 2026-08-23, running.** The owner chose **Docker
Desktop** over a hosted Neon branch (D-DB, resolved). `docker-compose.yml`
runs Postgres 16 bound to `127.0.0.1:5433` (see the port note above), with a
separate `cnc_selling_test` database so a truncating integration test cannot
wipe development data, and `unaccent` created in both — confirmed via `psql`.
`.env.example` documents the Neon fallback; nothing in the schema is
Docker-specific.

**6.3 Next.js 16 app shell.** App Router, `lang="pl"`, route groups
`(marketing)`, `(shop)`, `(admin)`. Install app dependencies with
`npm install next react react-dom @prisma/client @mui/material @mui/material-nextjs @emotion/react @emotion/styled zod`
and let npm resolve versions rather than hand-pinning.

**6.4 MUI v9 theme.** `cssVariables: true` so Server Components can consume
brand tokens without shipping Emotion. Apply MUI's Polish locale via
`createTheme(brandTheme, plPL, dataGridPlPL, pickersPlPL)`.

The stock Material look must be destroyed on the storefront — it reads as
"admin dashboard", which is the exact failure the owner's brief forbids.
`shape.borderRadius: 2`, shadows flattened to near-none, `disableElevation`,
no uppercase buttons, generous section padding, and this palette:

| Token | Value |
|---|---|
| `background.default` | `#FAF8F5` warm off-white |
| `background.paper` | `#FFFFFF` |
| `text.primary` | `#1F1D1B` graphite |
| `text.secondary` | `#6B655E` |
| `primary.main` | `#2E2A26` near-black |
| `secondary.main` | `#A97B4F` warm oak |
| `divider` | `#E6E0D8` |
| `error.main` | `#8C3A2E` muted brick |

Serif display face for headings, neutral grotesque for body, both self-hosted
via `next/font` with `latin-ext`. No dark mode in MVP.

**6.5 The RSC / island split — architectural, not cosmetic.** MUI components
are `"use client"`. Catalogue and marketing pages are Server Components using
small hand-written layout primitives plus theme CSS variables; MUI is confined
to interactive islands (configurator, cart, checkout, account, admin). Add a
lint rule forbidding `@mui/material` imports in `(marketing)` and `(shop)`
server components, and a second rule forbidding user-visible string literals
inside components.

**6.6 Playwright config** with desktop and mobile projects.

## 7. After P0

`docs/ARCHITECTURE.md` §22 has the full phasing. Summary:

P2 catalogue (seed data, RSC product pages, SEO) → P3 configurator → P4
upload/design review/IP → P5 cart, checkout, order snapshot → P6 account and
polish → **P7 admin panel** → P8 pricing admin and statistics → P9 final
verification.

The admin panel is **in scope** — the owner reversed the original brief's
"Phase 2" instruction and wants it detailed, with full management and
statistics. Spec is §16A, UX requirements §16A.5. Build it as **vertical
slices** (tests + server action + UI, one module at a time), never as UI
against mock data — a clickable panel that does nothing is the "fake
functionality" the owner's rules prohibit.

## 8. How to work

Follow the owner's TDD rules literally: define behaviour, enumerate normal
cases, enumerate edge and invalid cases, write the tests, **run them and
confirm they fail for the right reason**, implement the minimum, refactor
green, add tests for bugs found.

Tests assert business behaviour. Coverage percentage is explicitly not a goal;
a test that asserts a component renders a `<div>` should be deleted.

`docs/CHECKLIST.md` is the live progress record — update it as you complete
items rather than at the end.

## 9. Open decisions — ask before assuming

| # | Question | Recommendation on file |
|---|---|---|
| ~~D-DB~~ | ~~Docker Desktop or a hosted Neon branch?~~ | **Resolved 2026-08-23: Docker Desktop.** `docker-compose.yml` is in the repo |
| D2b | Launch the storefront once P7a (approve designs / confirm payment / advance status) works, or wait for the complete admin panel? | Launch on P7a |
| D3 | Discount codes in MVP? The owner's TDD rules list "discounts" but the brief never mentions them | Out of scope; Phase 2 |
| ~~D4~~ | ~~Real material prices per m², machine rate per minute, module surcharge, packaging tiers~~ | **Resolved 2026-08-23: seeded `TODO_PRICING` placeholders**, clearly marked, in `prisma/seed.ts` |
| ~~D5~~ | ~~Product photography — available, or placeholders?~~ | **Resolved 2026-08-23: generated on-brand placeholder SVGs**, not downloaded stock photos (`scripts/generate-placeholder-images.mjs`) — swap for real photography before launch. See §9d |
| D6 | Guest checkout allowed, or account required? | Guest + optional account |
| ~~D7~~ | ~~Real machine usable area and minimum module size.~~ | **Resolved 2026-08-23 with the owner** — see below |
| D8 | Kitchen tile default size (70 × 120 mm) and whether customers may deviate | Fixed presets matching common Polish backsplash formats |

**D7, resolved 2026-08-23.** The real numbers, and one schema change:

- `usableWidthMm = 600`, `usableHeightMm = 500` — the machine's real X/Y
  travel. Which axis is "width" is arbitrary: the owner confirmed material can
  be fed either way, so this pairing is a labelling choice, not a constraint.
- `minModuleMm = 150` — the original assumption stands. The owner's first
  answer (10 mm) turned out to describe minimum **material thickness**, a
  different axis entirely, not the module-split floor.
- `maxWorkpieceThicknessMm = 100` — new. The machine's Z-axis limit. This did
  not fit any existing field — `MachineSettings` only had X/Y and the module
  floor — so it was added as a genuine schema change, not just a seeded
  value: `prisma/schema.prisma` plus
  `prisma/migrations/20260823010000_add_machine_thickness_limit`, applied to
  both the dev and test databases. **Not yet enforced anywhere** —
  `domain/feasibility` has no rule comparing a chosen thickness against it.
  That is a real gap, not an oversight: building the rule was out of scope for
  "resolve the decision" and needs its own test-first pass.
- The owner also mentioned material won't practically go below **10 mm**
  thick. Recorded here for whoever writes seed data; not enforced by any
  constraint, since it may vary by material and nothing asked for that yet.

**Confirmed against the manufacturer, same day.** The owner's machine is a
[TwoTrees TTC6050](https://pl.twotrees3d.com/en/products/twotrees-ttc6050-cnc-router-machine-800w-spindle-4th-axis).
Its spec sheet states working area **"600 x 500 x 100 mm"** verbatim — an
external source agreeing with the owner's recollection, not just a second
retelling of it. Two things from the same page, neither acted on:

- The listing's title says "800W Spindle" but its own specs table says
  "500W Spindle Motor" — worth the owner confirming which they actually
  bought, though nothing in this schema models spindle wattage today.
- The page separately lists **"Carving Layer Height: Non-metal 0.1mm–20mm"**,
  a different number from the 100 mm Z-travel in `maxWorkpieceThicknessMm`. An
  earlier version of this note said the 20 mm figure was the one a
  `THICKNESS_EXCEEDS_MACHINE` rule would need — **that was wrong, corrected
  2026-08-23.** The two numbers answer different physical questions: 100 mm is
  Z-axis clearance under the gantry — whether a workpiece fits in the machine
  at all — and 20 mm is how deep a single carving pass can cut into a
  surface, which is a property of a *design's* relief depth
  (`Design.minEngraveDepthMm`), not of the material blank's own thickness.
  §8's gap was specifically about a chosen product thickness exceeding the
  machine — that needs 100 mm, and that is what got built (see §9b below). A
  design-relief-depth check against the 20 mm figure is still open, separate
  work, not yet built. Also on the page: ER11 collet, 0.5–7 mm tool diameter —
  a plausible sanity floor for `Design.minLineWidthUm` whenever real design
  metadata is entered, since a 0.2 mm line cannot be cut by a 0.5 mm bit.

**D4, resolved 2026-08-23: seed `TODO_PRICING` placeholders**, invented
plausible round numbers, never shown to a customer, swapped before launch.
`prisma/seed.ts` now exists and does exactly this — see §9a below.

D7 and D4 were the two that made the difference between a structurally
correct engine and one that produces meaningful złoty; both are now resolved.

## 9a. The seed script — structural only, 2026-08-23

`prisma/seed.ts` exists, is wired to `npm run db:seed` (`prisma db seed` via
`prisma.config.ts`'s `migrations.seed`), and has been run against both the
dev and test databases. It seeds exactly three things:

- `MachineSettings` — the real D7 numbers, upserted (safe to rerun; this
  table is operational config, not versioned).
- `PricingSettings` version 1 — `TODO_PRICING` placeholders (D4). **Only
  created if no `PricingSettings` row exists at all.** This table is
  append-only per §10.2 — nothing is ever edited in place — so the seed
  script respects that invariant rather than fighting it: reruns log "already
  exists, leaving it alone" and touch nothing.
- The first `ADMIN` user, from `SEED_ADMIN_EMAIL` in `.env` (not hardcoded —
  this file is committed to a public repo, a personal email doesn't belong in
  source). Upserted with role forced to `ADMIN` every run, which is
  deliberate: if you demote this account through the panel later, rerunning
  the seed will re-promote it. Rerun it on purpose, not out of habit.

**It deliberately seeds no catalogue content** — no categories, products,
materials, finishes, or designs. `docs/ARCHITECTURE.md` §22's P2 line ("Seed
data: materials, finishes, designs, 5 products, preset sizes, installation
variants") is real business content: Polish product copy, what the shop
actually sells, and product photography (D5, still open — placeholders vs.
real). That is the owner's decision to make, not something to invent. When
you build it, the mapper (`src/server/mapping/to-domain.ts`) and its test
file are the contract the seed rows must satisfy — the end-to-end priced
derivation in `tests/unit/mapping.test.ts` is a good template for what a real
product's numbers should look like once seeded.

Idempotency was verified by running `npm run db:seed` twice in a row: the
second run left `PricingSettings` untouched and reported so explicitly.

## 9b. THICKNESS_EXCEEDS_MACHINE — the flagged gap, closed 2026-08-23

`domain/feasibility` now rejects a configured thickness greater than
`MachineSettings.maxWorkpieceThicknessMm` (100 mm — D7). `FeasibilityInput`
gained two required fields: `thicknessMm: number | null` (`null` for product
types with no THICKNESS step — WALL_ART, KITCHEN_TILE) and
`machine: MachineConstraints`. The mapper gained `toMachineConstraints`,
symmetrical with `toDesignConstraints`/`toMaterialConstraints`.

Adding a new `FeasibilityCode` broke the typecheck in an unexpected place —
`src/content/pl/messages.ts`'s `feasibilityMessage` switch is exhaustive over
that union, so TypeScript refused to compile until a Polish message existed
for the new code. That is the lint rule working as designed, not a bug to
route around: every domain code has exactly one Polish translation, enforced
by the compiler rather than by someone remembering to add it. Do not add a
`default: return ''` case to make an exhaustiveness error go away — that is
what the switch is for.

Boundary is inclusive: a thickness exactly equal to the limit is allowed, not
rejected, consistent with every other boundary in this codebase. Mutation-
tested (flipped `>` to `>=`, confirmed exactly one test catches it).

## 9c. Next.js 16 app shell + MUI theme — built and verified, 2026-08-23

The rest of P0 that wasn't the data layer. Verified in a real browser (Claude
Browser), not just by `tsc`/`next build` succeeding — that distinction
mattered, because one real bug only showed up on screen (below).

```
next.config.ts                          minimal — no images.domains yet, no photography exists (D5)
src/ui/theme/fonts.ts                   next/font/google, Fraunces + Inter, latin-ext, self-hosted
src/ui/theme/theme.ts                   the §2.1 palette/shape/shadow overrides, cssVariables: true, plPL
src/ui/theme/ThemeRegistry.tsx          the one client boundary the root layout needs
src/ui/primitives/{Container,Section}   RSC-safe layout atoms, consume --mui-palette-* directly
src/ui/primitives/{Heading,Text}        RSC-safe typography atoms — see the bug note below
src/ui/islands/ThemeShowcaseButton.tsx  the one client island in this pass; proves the composition works
src/content/pl/site.ts                  static site-chrome copy (not a domain-code translation — that's messages.ts)
src/app/layout.tsx                      lang="pl", wraps children in ThemeRegistry
src/app/(marketing)/page.tsx            placeholder home page — scaffolding, not real P2 copy
playwright.config.ts                    desktop-chromium + mobile-safari
tests/e2e/shell.spec.ts                 lang="pl", exact background colour, island renders, no uppercase button
```

**Font pairing (Fraunces + Inter) was picked, not decided by the owner.**
§2.1 names three display-serif options and two body options as equally
acceptable — a swappable choice, not a firm instruction. Changing it is a
two-line edit in `fonts.ts`. Say so if a different pairing is wanted.

**A real bug, found only by looking at the rendered page.** The first version
of the marketing placeholder used raw `<h1>`/`<p>` tags styled by nothing —
`tsc` and `next build` were both silent, but a browser screenshot showed the
heading rendering in the BODY font, not the display font. Cause: a raw HTML
element gets none of MUI's typography styling automatically; that only
happens through the `Typography` component or its generated class, and an
RSC-safe primitive can't import that without pulling in `@mui/material`.
`cssVariables: true` does still solve this — MUI publishes each typography
variant as a single `font` shorthand custom property (`--mui-font-h1` is
literally `300 6rem/1.167 "Fraunces", "Fraunces Fallback"`), and
`style={{ font: 'var(--mui-font-h1)' }}` on a plain tag works — but you have
to know to reach for it. `Heading`/`Text` in `src/ui/primitives` exist so the
next person doesn't rediscover this by staring at a screenshot. **Type-check
green is not the same claim as "it renders correctly" — this is why §21
distinguishes them, and why the browser check happened before this was
called done.**

Also confirmed in-browser, not assumed: `lang="pl"` on `<html>`; background
exactly `rgb(250, 248, 245)` (`#FAF8F5`); the button has no uppercase
transform and no elevation shadow; every font request resolves to
`localhost:3000/_next/static/...` — zero requests to `fonts.googleapis.com`,
confirming the self-hosting requirement actually holds and isn't just
configured correctly on paper.

### The ESLint / TypeScript 7 blocker — resolved 2026-08-23: switched to Biome

`npm run lint` used to throw immediately:

```
typescript-eslint does not support TS 7.0.
```

Not a config mistake — a hardcoded version guard inside
`@typescript-eslint/parser` itself (`if (versionMajor >= 7) throw ...`),
confirmed by reading the installed package source, not just the error
message. Tracked upstream:
[typescript-eslint#10940](https://github.com/typescript-eslint/typescript-eslint/issues/10940),
unresolved. `eslint-config-next` depends on the `typescript-eslint`
meta-package internally, so it blocked **all** ESLint linting, not just the
two project-specific rules.

Three ways forward were presented to the owner (downgrade TypeScript, wait for
upstream, switch to Biome). **The owner chose Biome**, on the reasoning that
"ignore the lint failure with a TODO" doesn't apply here — there is no
specific rule violation to suppress with a comment; the tool crashes before
it reads a single file, so a per-line disable comment has nothing to attach
to. A different linter was the only option that actually unblocks `npm run
lint` without reversing the earlier TS7 migration.

**What changed:**

```
eslint.config.mjs, eslint-rules/     REMOVED
eslint, eslint-config-next,
  @next/eslint-plugin-next            UNINSTALLED
@biomejs/biome                        INSTALLED — 2.5.10, own Rust parser, unaffected by the TS7 gap
biome.json                            linter (recommended preset) + formatter + the MUI-import restriction
scripts/check-polish-literals.mjs     the Polish-literal check, NOT reimplemented as a Biome rule — see below
fast-glob                             INSTALLED — used only by the script above
```

**The `@mui/material` restriction ported directly.** Biome's
`noRestrictedImports` rule plus a `biome.json` `overrides` block scoped to
`src/app/(marketing)/**` and `src/app/(shop)/**` does exactly what the ESLint
version did. Verified with a deliberate violation: added a `@mui/material`
import to the marketing page, confirmed `biome lint` reports it as an
**error** (not a warning) with the same explanatory message, reverted.

**The Polish-literal check did NOT port directly — deliberately.** Biome 2.x
has a GritQL plugin system that could in principle express "flag any string
containing these nine characters", but it's a newer feature and GritQL's
pattern language is built for structural AST matching, not simple text
scanning. Fighting its syntax for a check this simple wasn't worth it: the
rule needs no AST, only "does this file contain Polish text outside an
allowed spot", and reading the file as text answers that directly. So it's a
standalone Node script (`scripts/check-polish-literals.mjs`), wired into
`npm run lint` as a second command (`biome lint . && node
scripts/check-polish-literals.mjs`). Same diacritic-heuristic logic as the
ESLint version (documented in the script's own header, including the same
precision-over-recall trade-off), same exclusions (`src/content/pl` itself,
`*.test.ts`/`*.spec.ts`). Verified the same way: a deliberate Polish string
in the marketing page was caught and reported with file/line/text, reverted.

**One cleanup, unrelated to the switch but done while lint was running for
the first time:** `biome lint --write --unsafe .` fixed four pre-existing
files (`to-domain.ts`, `mapping.test.ts`, `prisma.config.ts`,
`playwright.config.ts`) — all `tier['x']` → `tier.x` style simplifications for
valid identifier keys, zero behaviour change, confirmed by rerunning the full
suite (298/298) and the build afterward. Nothing else was touched; `biome.json`
uses the default `recommended` preset with no rules disabled to make the
codebase pass.

**Known, accepted trade-off:** Biome has no equivalent of
`@next/eslint-plugin-next`'s Next.js-specific rules (catching `<img>` where
`next/image` belongs, etc.). Nothing today depends on those; revisit if that
changes.

`npm run lint` is green: `biome lint .` clean, `check-polish-literals.mjs`
clean, confirmed both by a normal run and by the deliberate-violation tests
above catching real problems, not just staying quiet.

## 9d. Real catalogue content — 2026-08-23

The owner gave the real category list, and it diverged meaningfully from the
five product types `ARCHITECTURE.md` originally assumed. Two categories
didn't fit anything modelled:

- **Loft** (stools/shelves/small tables — wood top we engrave + a steel
  base) — closest existing type was `TABLE_TOP`, but that type's whole
  premise is "Blat. Nogi nie są w zestawie" (legs explicitly NOT included).
  Loft is the opposite. Confirmed with the owner: the frame is a simple
  bought-in base, not something the shop welds/sources as a real
  bill-of-materials component — so this did NOT need a new
  `MaterialFamily.METAL` or an `Accessory` relation (which
  `ARCHITECTURE.md` §12 already flagged as future work). It only needed a
  new `ProductTypeCode`, `LOFT_FURNITURE`, reusing `TABLE_TOP`'s exact step
  list. The base/leg option is described in `Product.materialNotesPl` for
  now, not a modelled configurator step — revisit if/when P3's configurator
  needs to actually price it as a variant.
- **Amulety i bransoletki** (small engraved jewellery) — a completely
  different scale (cm, not the hundreds-of-mm every dimension envelope so
  far assumes) and laser-only. New `ProductTypeCode`, `JEWELRY`, with a
  shorter step list than everything else: no `THICKNESS` (a small blank has
  one fixed thickness) and no `FINISH` (nothing seeded for it — same
  reasoning as gres below). Materials confirmed: wood, metal, and leather
  are all wanted eventually, but **metal and leather stay hidden for now**.
  This needed zero schema work — `Material.isAvailable: false` already does
  exactly this, and `LEATHER` already exists as a `MaterialFamily` value.
  Only `METAL` doesn't exist yet; deferred rather than added unused, so
  there's nothing sitting in the schema for a material that doesn't exist.

Confirmed unchanged: **gres** (kitchen backsplashes) maps directly onto the
existing `KITCHEN_TILE` type; **panele podłogowe** (engraved floor panels)
onto `FLOOR_ELEMENT`; **obrazy** (wall art) is confirmed still a real product
line, not folded into the catch-all; **inne** maps onto `CUSTOM`.

**What was built:**

```
prisma/migrations/20260823020000_add_loft_and_jewelry_product_types
                                         ProductTypeCode + LOFT_FURNITURE, JEWELRY
scripts/generate-placeholder-images.mjs on-brand SVG placeholders — not downloaded stock photos, see below
public/images/placeholders/*.svg        6 category images + 1 design preview + 1 installation diagram
prisma/seed.ts                          extended: 2 materials, 1 finish, 1 placeholder design,
                                         6 categories, 5 products (one per real category; "inne" stays empty)
```

**On the placeholder images specifically.** The owner asked to "find some
placeholders" — read literally, that could mean downloading stock photos of
similar-looking products. That was deliberately NOT done: a stock photo of
someone else's stool or backsplash, presented on this shop's product page,
would misrepresent what the business actually makes — the same "nothing is
faked" problem `ARCHITECTURE.md` §14 already applies to payments and
production files, just in a different spot. It would also be legally murkier
than necessary for zero benefit. Instead, `scripts/generate-placeholder-images.mjs`
generates simple, honestly-labelled SVGs in the brand palette (each one says,
literally, "zdjęcie w przygotowaniu" — photo in preparation) for every
category, the one design's preview art, and the gres installation diagram.
Anyone looking at one knows immediately it is a placeholder. Swap them for
real photography before launch (D5, now resolved to exactly this).

**On the product copy specifically.** Every product name, description and
care instruction is a first, functional draft — accurate and plain, not
flowery, using the owner's own words where possible (e.g. "Stołek loftowy z
grawerem" is close to a direct translation of what the owner described, not
an invented brand voice). It is safe to ship if forgotten, but it is NOT
final marketing copy, and the owner should expect to rewrite it. This is a
narrower content-invention line than photography or design artwork: generic,
functional product naming was judged acceptable to draft; a business's
actual creative IP (a design's artwork) and photography were not — see the
distinction drawn in `prisma/seed.ts`'s own header comment.

**`ProductImage` has no natural idempotency key.** Every other seeded model
has a real unique constraint to upsert against (`slug`, or a composite key);
`ProductImage` doesn't (multiple photos per product, in any order, is the
real shape). The seed script checks existence by `(productId, url)` before
creating — good enough for one placeholder image per product now, but a real
multi-photo gallery will need a proper key. Flagging this so nobody assumes
the pattern scales as-is.

**Explicitly NOT done in this pass, on purpose:** actual category/product
RSC pages. This was the data layer only — seeded, verified idempotent
(reran twice, checked row counts via `psql`, all correct), verified against
both databases, full suite green throughout. Building `/loft`,
`/produkt/[slug]`, etc. is real, separate work (P2's other checklist items:
`generateMetadata`, canonical URLs, Schema.org, sitemap) and deserves its
own pass rather than being rushed onto the end of a schema-plus-seed change.

## 9e. Category & product pages, and a real bug Lighthouse caught — 2026-08-23

The pages deferred in §9d. Built against the real seeded catalogue, verified
in a browser at every step, not just by `tsc`/`next build` succeeding.

```
src/server/db/client.ts                 the one Prisma client instance, globalThis-cached for dev HMR
src/server/repositories/{categories,products}.ts  the only files that query Prisma for page content
src/app/(shop)/[category]/page.tsx      category listing, generateStaticParams + generateMetadata from the DB
src/app/(shop)/[category]/not-found.tsx Polish 404 for an unknown category slug
src/app/(shop)/produkt/[slug]/page.tsx  product detail, Schema.org Product+Offer, installation variants
src/app/(shop)/produkt/[slug]/not-found.tsx  Polish 404 for an unknown product slug
src/app/(marketing)/page.tsx            REPLACED — real homepage (categories grid), scaffold retired
src/ui/primitives/{Grid,Card,Breadcrumbs,SiteHeader}.tsx  new RSC-safe primitives
src/ui/seo/json-ld.ts                   safe JSON-LD serialization — see the security note below
src/app/sitemap.ts, src/app/robots.ts   generated from the DB
```

**The homepage scaffold and its one client island are gone.**
`ThemeShowcaseButton` and `src/ui/islands/` were P0 proof-of-concept only —
now that real pages exist and nothing on them is interactive, keeping a fake
"test button" around would itself have been the kind of placeholder-dressed-
as-real-feature this project's rules forbid. `tests/e2e/shell.spec.ts` was
rewritten to verify the same underlying facts (`lang="pl"`, exact background
colour, no uppercase buttons) against the real homepage, plus a real
click-through navigation test (home → category → product). The first real
client island arrives with P3's configurator.

**A real security finding, not a lint false positive.** Biome's
`noDangerouslySetInnerHtml` flagged both JSON-LD `<script>` tags (Breadcrumbs,
Product). This is a genuine, well-documented JSON-LD XSS vector: plain
`JSON.stringify` does not escape `<`, so a value containing the literal
substring `</script>` — a product name, say, once a real admin panel lets
staff edit one freely — would close the script tag early and let whatever
follows be parsed as HTML. Fixed properly, not suppressed blind:
`src/ui/seo/json-ld.ts`'s `toSafeJsonLd` escapes every `<` to `<` (the
standard mitigation, transparent to any real JSON parser) before the
`dangerouslySetInnerHTML` Biome comment is silenced. One mechanical lesson
worth recording: Biome's `biome-ignore` suppression comment must be a `//`
comment attached directly to the flagged JSX **attribute**, not a `{/* */}`
JSX-children comment floating before the element — the latter silently does
nothing (Biome reports `suppressions/unused`), which is what happened on the
first attempt.

### The Lighthouse-caught architectural bug — the important part of this pass

Running a real Lighthouse audit (not assumed, not skipped) on
`/produkt/stolek-loftowy-z-grawerem` found: performance 74/100, LCP 3.8s, TBT
500ms, ~410KB transferred — **including ~154KB of MUI + Emotion + React
client JS, on a page with no `@mui/material` import anywhere in its own
file tree.**

The cause: `ThemeRegistry` (`AppRouterCacheProvider` + `ThemeProvider` +
`CssBaseline` — MUI's actual client provider) was mounted in
`src/app/layout.tsx`, wrapping `{children}` for every single page. The
RSC/island lint rule only ever stopped `@mui/material` **imports** inside
`(marketing)`/`(shop)` server components; it never stopped the theme
**wrapper** around them, because the wrapper lives in the root layout, one
level up, outside what that rule scans. This is exactly the R3 risk
`ARCHITECTURE.md` §23 names ("MUI is client-side; naive use kills SEO and
LCP on catalogue pages") — half-mitigated by the lint rule, but not fully,
and nothing caught the gap until a real audit ran against a real page.

**Fix:** extracted the theme's CSS custom properties into a plain stylesheet,
`src/app/theme-vars.css` — no React, no Emotion, zero client JS. Values were
read live off a rendered page via `getComputedStyle` (not guessed from MUI's
docs), including the exact font shorthand strings for every typography
variant, not just the ones already in use, so the next primitive that needs
`--mui-font-subtitle1` or similar doesn't require another audit-and-extract
round trip. `ThemeRegistry` was removed from the root layout entirely — it
still exists, still works, and is reserved for wrapping the first real
interactive island (P3's configurator, cart, checkout) rather than the whole
app. Verified the page renders byte-identically before touching anything
further: same background colour, same font family, same font weight, via
`getComputedStyle` in a live browser, both before and after.

**Result, before → after, same page, same Lighthouse config:**

| | Before | After |
|---|---|---|
| Performance | 74/100 | 85/100 |
| LCP | 3.8s | 3.4s |
| TBT | 500ms | 320ms |
| Speed Index | 3.9s | 1.3s |
| Transferred | ~410KB | ~376KB |

**LCP barely moved, and that is an honest finding, not a failure to fix
the bug.** The same two largest JS chunks (70KB, 44KB) are present in both
runs — they are Next.js's own framework runtime, not MUI's, and were never
going to move. What's actually left is four self-hosted web font files
(~198KB): two subsets (`latin`, `latin-ext`) × two families (Fraunces,
Inter), all genuinely requested because real Polish text — "Stołek
loftowy" in the same string — spans both subsets. That is close to
unavoidable cost for correct Polish diacritic support, which is itself
non-negotiable (§17.1), not bloat to trim. Lighthouse's default mobile
profile is also a deliberately pessimistic simulated baseline (mid-tier
phone, throttled slow-4G), not median real-world conditions; real Polish
users on typical LTE/wifi almost certainly see something meaningfully
better than this lab number. None of that is used here to wave the number
away — **the architectural bug is fixed and confirmed by measurement; the
remaining LCP figure is a font-payload and lab-methodology question, left
open rather than either falsely resolved or silently ignored.** Worth
revisiting once real product photography (D5) changes the page weight
anyway, which will need its own Lighthouse pass regardless.

**SEO: 100/100**, desktop and mobile, both a category and a product page —
this is the number the checklist's "≥ 95" threshold was actually about, and
it's clean.

## 9f. P3's foundation — the configurator, started 2026-08-23

The first work on P3. Built bottom-up, in the order the codebase's own
convention demands: pure domain first, then the server-side seam, then the
first real UI — each layer test-first, and the UI layer verified in a real
browser against real seeded products, not just by `tsc`/`next build`
succeeding (§9c's lesson about the difference between the two still holds).

```
src/domain/configuration/steps.ts       the step machine — §5's per-product-type step lists, §7.1's
                                         "enterable only if every prior step is satisfied" rule.
                                         30 assertions (tests/unit/configuration.test.ts)
src/server/configurator/resolve-options.ts  §7.2's option resolution, reshaped for real row field names —
                                         thin, the actual filtering is domain/compatibility (P1)
src/server/configurator/price-configuration.ts  module layout + feasibility + price for one selection state —
                                         17 assertions together with the file above
                                         (tests/unit/configurator-server.test.ts)
src/server/repositories/configurator.ts  the one Prisma query for a product's full configurator data
src/server/actions/configurator.ts      'use server' — the one dispatch target every selection change calls.
                                         Never computes a price itself; wires the three files above together
src/ui/islands/configurator/Configurator.tsx  the first real MUI client island. Renders inside ThemeRegistry,
                                         which is now doing exactly what §9e reserved it for
src/content/pl/site.ts                  configurator* keys — step labels, button labels, honest "not built yet" copy
src/content/pl/messages.ts              configurationErrorMessage() — the fifth exhaustive-switch translation table
```

**Scope, stated plainly.** `domain/configuration` was P1's one remaining
unchecked item — `stepsForProductType` reproduces §5's table for all seven
product types verbatim, and `checkStepEntry`/`isStepEnterable` enforce that a
step is reachable only once every step before it (not just the immediately
preceding one) is satisfied. It resolves step **order**, nothing about which
*options* are valid — that boundary with `domain/compatibility` is
deliberate, not a gap.

`priceConfiguration` only reaches `'priced'` when both a `materialId` and a
`designId` are chosen. That is why `CUSTOM` (the one product type with no
`DESIGN` step, only `CUSTOM_UPLOAD`) never prices in this pass: there is no
seeded `Design` row to read a machining rate or surcharge from for an
arbitrary customer upload, and inventing one would be exactly the kind of
fabricated number D4 was resolved by clearly labelling, not by pretending.
Pricing a `CUSTOM_UPLOAD` configuration is a design-review-era decision (P4),
not something to solve by guessing here.

**Personalization is real, honest, and deliberately incomplete.** No `Font`
row exists in the seed data — not an oversight. `domain/personalization`'s
own header comment explains why real cmap-parsed glyph coverage matters: a
decorative face missing `ł` makes „Michał" permanently wrong on a finished
oak tabletop. That is a safety property, not a monetary placeholder like
`TODO_PRICING` — fabricating a plausible-looking coverage set would be worse
than not building the step at all. The PERSONALIZATION step (already
optional in the state machine — a customer may buy a piece with no engraved
text) shows an honest Polish notice instead: personalization is coming once
a real font with confirmed coverage exists, and this step can be skipped
meanwhile. `CUSTOM_UPLOAD`'s step content is the same kind of honest
placeholder, for the same reason — P4 is unbuilt.

**A real bug, caught only by actually using the SIZE step in a browser.**
The first version committed both width AND height on either field's `blur`
event. Tabbing from width to height blurred width while height was still
empty, which force-set `heightMm: null` and a spurious "Podaj wymiar."
error on a field the customer had not typed into yet — every subsequent
keystroke in height left that stale error on screen until height was ALSO
blurred. `tsc` and the unit tests were both silent, because the bug is in
event-handler composition, not in a type or a pure function. Fixed by
splitting into `commitWidth`/`commitHeight`, each committing only its own
field. This is the same category of lesson §9c already drew about
`Heading`/`Text` (type-check green ≠ renders correctly) — recorded again
because it happened again, this time in interaction rather than layout.

**A second real gap, also only visible by actually refreshing the page.**
The URL correctly round-trips every selection (`?d=...&m=...&w=600&h=405&f=...`),
so a refresh never loses data — but the first version always reset
`stepIndex` to 0 on load, so a customer who refreshed mid-configuration saw
their answers intact but was dropped back to step 1 regardless of how far
they'd gotten. Fixed: the first snapshot response after a URL-restored
mount now resolves `stepIndex` to the furthest step the restored selections
actually reach, via the same `isStepEnterable` the rest of the machine uses.
Browser-verified: configured a WALL_ART product through to SUMMARY, copied
the resulting URL, reloaded, landed directly back on SUMMARY with the same
343,90 zł price and the same `NATURAL_VARIATION` notice.

**What was verified live, not assumed** — three structurally different
product types, each exercising a different part of §5's step table:

- **WALL_ART** (`obraz-drewniany-z-grawerem`) — the plain 6-step case
  (DESIGN → MATERIAL → SIZE → FINISH → PERSONALIZATION → SUMMARY). Full
  click-through to a priced summary (343,90 zł), the `NATURAL_VARIATION`
  notice rendering correctly for oak, comma-decimal size entry (`40,5` → 405
  mm) working end to end, zero console errors.
- **KITCHEN_TILE** (`fartuch-kuchenny-z-grawerem`) — confirms
  INSTALLATION_VARIANT really is the *first* step, ahead of DESIGN, per §5's
  ordering (not just present somewhere). Also the honest negative case: gres
  has no seeded `MaterialFinish` row (flagged in `prisma/seed.ts`'s own
  comment as a P3 gap to close), and the FINISH step shows "not available for
  this configuration yet" rather than crashing, silently passing, or
  fabricating an option — and correctly keeps "Dalej" disabled, blocking
  completion honestly rather than letting the customer proceed with no
  finish selected.
- **LOFT_FURNITURE** (`stolek-loftowy-z-grawerem`) — confirms the 7-step
  list with THICKNESS included (shares `TABLE_TOP`'s list exactly, per
  §9d). Real seeded thicknesses ("27 mm", "40 mm") render as selectable
  options from actual `ProductThickness` rows.

**What is honestly not built or not verified this pass** — every item is
also reflected in `docs/CHECKLIST.md`'s P3 section, marked `[~]` or `[ ]`,
not silently checked off:

- The 2D preview (§7.3) — not started.
- No `Configuration` DB row is written — selections live in React state and
  the URL only. "Price breakdown... stored" (a P3 checklist line) needs this,
  and it's naturally cart-adjacent (P5) rather than configurator-only work.
- No sticky price summary, no mobile-viewport check, no preset sizes (none
  are seeded yet either), no installation-variant diagrams rendered (the
  `diagramUrl` is fetched, just not displayed), no `requiresExactSize`
  branch for floor/panel products, and the configurator summary does not yet
  restate `materialNotesPl` or `InstallationVariant.receivesPl` verbatim.

None of these are silent gaps — each one is a specific, findable line in
`docs/CHECKLIST.md`'s P3 section. The next pass on P3 should treat that list
as the actual work order, not re-derive it from scratch.

### Three more §7.1/§7.2 gaps closed the same day

Three items flagged above as open were closed in a second pass, same day:

**Unavailable options are now shown disabled with a reason, not hidden.**
§7.2 is explicit that a hidden option "looks like a missing feature" while a
disabled one "teaches the customer the rule." `resolveOptionAvailability`
(`src/server/configurator/resolve-options.ts`) returns **every** option —
available or not — annotated with a `reason` code, computed by calling the
already-tested `domain/compatibility` functions twice (once at baseline,
once narrowed by the current selection) and diffing the two sets, rather
than re-implementing the compatibility rules a second time. 9 new fixture
tests. `unavailabilityReasonMessage` in `messages.ts` turns each code into
Polish; the UI renders every entry, `disabled` and with a `title` tooltip
for the unavailable ones. **Not browser-verified against real data** — every
seeded product today has exactly one material, one design, and at most one
finish, so there is currently nothing live to disable. Worth a real check
once a product is seeded with two or more of something.

**Clearing a dependent selection is now conditional, and explained.** The
first version blanket-cleared `finishId` on *every* material change and
`thicknessMm` on *every* installation-variant change, whether or not the old
value was actually still valid — safe, but more aggressive than §7.1
describes ("if the current finish is no longer compatible it is cleared").
Now checked against the real catalogue data already on the page (the static
`options` prop) before clearing: `selectMaterial`/`selectInstallationVariant`
in `Configurator.tsx` only clear the dependent field when it is genuinely
incompatible, and show a dismissible Polish notice explaining why when they
do. Same live-data caveat as above — nothing seeded today actually exercises
the "still valid, don't clear" branch, since there is only one material per
product to switch between.

**A real `popstate` listener now makes the browser's own Back/Forward
buttons work.** The URL round-trips every selection (that part already
worked — see the refresh-persistence fix above), but nothing re-synced
`selections` state when the URL changed from *outside* the component's own
`router.replace` calls — which is exactly what happens on a real Back/Forward
click, or when Next reuses a cached instance of this route. Fixed with a
`window.addEventListener('popstate', ...)` that re-reads the URL and
re-resolves the furthest reachable step, using the same
`readSelectionsFromSearch`/`writeSelectionsToSearch` pair the mount-hydration
path already used (extracted into shared helpers specifically so the two
paths can't drift apart). **Verified live**, since this one doesn't need
extra seed data to exercise: `history.pushState` to a URL with different
`w`/`h` values, then dispatch a `popstate` event by hand (exactly what a
real Back/Forward click does under the hood) — price recomputed correctly
(343,90 zł → 701,84 zł), module count updated (1 → 4), a `MODULAR_BUILD`
notice appeared, all with no page reload and zero console errors.

### Two more §7's/§11/§12 gaps closed, same day, third pass

**The summary now surfaces `receivesPl` and `materialNotesPl`.** Both
fields were already fetched by `getActiveProductBySlug` and rendered on the
product page (P2); they just weren't threaded through to the configurator's
`SummaryStep`. Now they are: `materialNotesPl` (added to
`ProductDetail`/`getConfiguratorProductData`'s caller, passed down as a new
`Configurator` prop) renders as an info alert whenever non-null, and the
currently-selected installation variant's `receivesPl` is looked up from the
`options` prop already on the page and shown labelled "Warianty montażu".
This is the same `Product.materialNotesPl` field the P3 checklist's "Blat.
Nogi nie są w zestawie." line refers to — closing both lines with one fix,
since it's one field shown in a second place, not two separate pieces of
copy.

**Floor/panel products now show §11's mandatory acknowledgement.** A new
`requiresExactSize` boolean flows from `Product` through
`getActiveProductBySlug` into `Configurator`; when true, the summary renders
`COPY.floorFinalDimensions` — "Podaję ostateczne wymiary. Produkt zostanie
wykonany na wymiar i nie wymaga docinania.", already defined in
`messages.ts` since the very first P1 pass but never actually used anywhere
until now — behind its own required checkbox, separate from (and in
addition to) the `FLOOR_MATCH_NOT_GUARANTEED` feasibility warning's own
acknowledgement. **Browser-verified end to end** on the real floor panel
product (`panel-podlogowy-z-grawerem`, the one seeded row with
`requiresExactSize: true`): configured through all 6 steps to SUMMARY, both
warnings rendered, the add-to-cart button stayed disabled with only one of
the two boxes checked, and enabled only once both were.

### Fourth pass, same day: the installation diagram, and a real sitewide bug found only by checking mobile

**Installation-variant diagrams now render.** `diagramUrl` was already
fetched (it had to be, to build `ConfiguratorOptionData`) but never
displayed. Selecting a variant now shows its `descPl` and the diagram image
underneath the option buttons — a real, honestly-labelled placeholder SVG,
the same convention as product photography (`prisma/seed.ts`'s header on
why nothing here is a downloaded stock image). Browser-verified: selecting
"Montaż na istniejącym fartuchu" on the KITCHEN_TILE product renders the
description and the "diagram w przygotowaniu" placeholder correctly.

**A real, sitewide bug, found by actually checking the configurator at
mobile width.** `h1` rendered at a literal 96px — MUI's stable desktop
Typography default, which `theme-vars.css` captures verbatim — on every
page, including a 375px phone, where it overflowed the viewport
horizontally. This is not a configurator bug specifically: `Heading` is the
one primitive every page uses, so this affected the homepage, every
category page, and every product page, and nobody had actually looked at
mobile since P0 (the cross-cutting checklist's "Mobile layout verified" line
was still unchecked, and now it's clear why — this is exactly the kind of
thing that line exists to catch). Root cause: the live `ThemeProvider`
this project deliberately stopped mounting site-wide (§9e's Lighthouse fix)
is what normally runs MUI's `responsiveFontSizes()` on top of the fixed
scale; extracting static tokens instead kept the fixed sizes but dropped
the responsive behaviour that went with them, and nothing caught the gap
until this pass actually resized a browser to 375px.

**Fix:** `h1`/`h2`/`h3` (the variants large enough to plausibly overflow) in
`theme-vars.css` now use `clamp()` with a fluid formula tuned so the
*preferred* term equals the original fixed value exactly at 1200px — the
`Container` primitive's own `max-width` — so nothing at or above that width
changes from what §9e already verified via `getComputedStyle`. Verified
both ends, not just the mobile fix: at 375px, `h1` no longer overflows
(confirmed visually and the failure mode is gone); at 1280px,
`getComputedStyle(h1).fontSize` is exactly `"96px"`, byte-identical to
before. (One tooling note for whoever continues this: the dev server's CSS
chunk filename is not content-hashed, so the Browser pane's own network
layer served a stale cached copy after the edit despite the file on disk
and a fresh `curl`/`fetch(cache:'no-store')` both being correct — a
cache-busted stylesheet `<link>` confirmed the real content was right.
Not an application bug; don't chase it if it recurs, just bypass the cache
to verify.)

**What mobile verification did NOT reach this pass.** CSS/layout is
confirmed (no overflow, at the one breakpoint that mattered for this bug).
Full touch-driven click-through of the configurator — tapping an option,
confirming the step advances — could not be completed: the browser tool's
click action consistently timed out once the viewport was set to a mobile
preset (which also switches on touch-event emulation). No console error
appeared before or after the timeout, which points to a tooling artifact in
this session rather than an application bug — the same MUI `ToggleButton`
`onClick` handler is already proven working via ordinary mouse clicks at
desktop width, across three different products, earlier the same day — but
this is genuinely unconfirmed, not silently assumed fine. Worth a clean
retry in a fresh session before checking off "Configurator usable on
mobile" for real.

## 9g. The storefront redesign — 2026-08-24

**What actually happened.** P2's homepage/category/product pages were built
deliberately sparse — a categories grid, plain text blocks — on the
understanding that "minimalistic" meant fewer sections. The owner corrected
that directly: *"you got me wrong by what i mean about minimalistic"*, and
named a concrete reference — Bazaar's `fashion-2` template
(`template.getbazaar.io/fashion-2`) — as what the storefront should actually
look like. "Minimalistic" meant restraint in *style* (whitespace, a
disciplined palette, no visual noise), not restraint in *content*. Bazaar's
own homepage is a hero, a trust-badge strip, category tiles, product grids
with real photography, a sidebar-filtered listing page, and a gallery-style
product page — dense with real content, not sparse.

**Research done before touching any code**, all browser-verified live, not
assumed from memory:

- **Bazaar `fashion-2`** (primary reference, the owner's stated preference)
  — the pattern above, confirmed by actually clicking through its homepage,
  PLP, and PDP.
- **CozyCommerce-lite** (`github.com/CozyCommerce/cozycommerce-lite`) — the
  owner also linked this repo. Checked it directly: it's Tailwind CSS, and
  its free tier is *only* a landing-page shell — its own README says "does
  not include... product management or payment processing." Not usable as a
  code reference for an MUI codebase; visual inspiration only, secondary to
  Bazaar.
- **NextMerce** (`demo.nextmerce.com`) — same genre as Bazaar, confirmed the
  pattern rather than adding a new one.
- **Materio** — the owner's admin-panel reference. MUI-based, MIT-licensed,
  genuinely portable. Recorded as a documented direction for P7 in
  `docs/ARCHITECTURE.md` §16A, **not built this pass** — P7 hasn't started,
  and building an admin panel now would jump the roadmap with nothing behind
  it (no orders/products CRUD to populate it). This was an explicit scope
  decision the owner confirmed, not an oversight.
- **opensaas.sh** — the owner wanted "animation on the main page instead of
  an image... with our topic icons," and pointed at a specific element by
  xpath. Inspected that element's DOM directly: it's pure CSS — concentric
  `conic-gradient` rings, plus icons on a rotating wrapper
  (`animation: orbit-spin`) with a fixed radial `translateX` offset, each
  icon counter-rotated (`orbit-counter-spin`, same duration) so it stays
  upright while it orbits. No JS, no animation library.

**A plan was written and approved before any file changed** — given the
size (rebuilding several already-shipped, already-tested pages) and that it
partially reverses a previous session's design decisions, this went through
`EnterPlanMode`/`ExitPlanMode` rather than straight to code. Two decisions
were the owner's to make and were asked directly (not guessed): scope
("storefront only, document the admin direction for later" — confirmed),
and how to handle the fact that Bazaar's layout leans on real photography
while this project only had "zdjęcie w przygotowaniu" placeholder SVGs
("build with placeholders now — download real images matching our topic, or
write relevant placeholder text" — confirmed, see the note on `STOCK_PHOTO`
below).

**What was built, all new files unless noted:**

```
public/images/photos/*.jpg              7 real, freely-licensed stock photos (Unsplash), one per
                                         category + one material close-up — see the header note below
src/ui/icons/index.tsx                  plain inline SVG icons — see §9h item 1 for why this exists
                                         instead of @mui/icons-material
src/ui/primitives/OrbitIconHero.tsx     the opensaas.sh-pattern hero graphic, our own category icons
src/ui/primitives/TrustBadgeStrip.tsx   4 real claims about this business, not generic retail badges
src/ui/primitives/CategoryTile.tsx      next/image-based category tile, real photo + name overlay
src/ui/primitives/ProductCard.tsx       v2 product card — image, category label, name, price. No
                                         rating — see the note below
src/ui/primitives/CategoryFilterForm.tsx  zero-client-JS filter/sort sidebar — see §9h item 2's neighbour,
                                         the native <form method="get"> pattern this uses
src/app/(shop)/szukaj/page.tsx          real search results page, built on matchesPl (P1, unused
                                         until now)
src/app/(marketing)/page.tsx            REBUILT — hero + OrbitIconHero, TrustBadgeStrip, CategoryTile
                                         grid, one honest "Nasze produkty" ProductCard grid
src/app/(shop)/[category]/page.tsx      REBUILT — CategoryFilterForm + sort + ProductCard grid
src/app/(shop)/produkt/[slug]/page.tsx  intro restructured to image-left/info-right; configurator
                                         and everything below it untouched
src/ui/primitives/SiteHeader.tsx        added a real search form (native GET, → /szukaj)
prisma/seed.ts                          STOCK_PHOTO() alongside PLACEHOLDER_IMAGE() — see below
src/server/repositories/products.ts     filter/sort params, listAllActiveProducts, searchActiveProducts
```

**On the photography, specifically — this is a real, deliberate exception
to how every other placeholder in this project has worked, not an
inconsistency.** Every earlier placeholder (D4's `TODO_PRICING`, D5's
original SVG images, the seeded product copy) was built to be *unmistakably*
a placeholder — the SVGs literally say "zdjęcie w przygotowaniu." This pass
does the opposite for photography specifically, on the owner's direct
instruction: real, freely-licensed stock photos (Unsplash License — free for
commercial and noncommercial use, no permission required), one per category,
picked to actually match the subject (industrial steel-and-wood furniture
for loft, wood/laser-cut jewellery for amulety, a plain white ceramic tile
for gres, wood plank flooring for panele, a wood-cut art piece for obrazy, a
real CNC router mid-cut for inne), reused for that category's one seeded
product since the catalogue is that small. Source URLs are recorded in a
comment next to `STOCK_PHOTO` in `prisma/seed.ts` for traceability. **The
"must swap before launch" discipline is unchanged** — these are not this
shop's own product photos, and the code says so in the same place it always
has; only the *interim fidelity* changed, from an obvious placeholder to a
presentable one, because that's what was asked for this time. The design's
own artwork and the installation diagram were deliberately NOT
photo-sourced — see `prisma/seed.ts`'s header for why those two specifically
stay honest SVG placeholders (one is the business's actual creative IP, the
other is specific technical instruction; a stock stand-in for either would
be actively wrong, not just generic).

**No star ratings, no fabricated review counts, anywhere in the redesign.**
Bazaar's product cards have both; brief §16A.1 module 9 forbids inventing
customer reviews, and a rating is the same category of fabrication. Checked
this explicitly against the plan's own "what does NOT change" section before
calling the pass done, not just at the point each component was written.

**The DB had to be reset to pick up the new image URLs.** `prisma/seed.ts`
upserts with `update: {}` — "if it exists, don't touch it" — which is
correct for protecting rows a human might have edited through the future
admin panel, but means simply re-running the seed does NOT update an
existing row's `imageUrl`. Used the already-documented reset path:
`docker compose down -v && npm run db:up && npm run db:deploy && npm run
db:seed`. Not a new gotcha, just the first time this session actually needed
it.

## 9h. Four real bugs the redesign found

Each one caught by actually running the thing — browser console, a second
Playwright run, a production-build comparison — not by inspection. None
were guessed at or left half-fixed.

**1. `@mui/icons-material` cannot be used in a Server Component — full
stop.** Added it for the trust-badge/orbit-hero/search icons, and got a real
React hydration error on first render: "Hydration failed because the server
rendered HTML didn't match the client," pointing at a `<style
data-emotion="...">` tag. Read the installed package source to find why:
every icon file in `@mui/icons-material` carries its own `"use client"`
directive and wraps its path in `SvgIcon`, an Emotion-`styled` component —
it needs `ThemeRegistry`'s `AppRouterCacheProvider` above it to own Emotion's
style cache, and none of these three components have one (nor should they —
`SiteHeader` renders on every page via the root layout, so wrapping it in
`ThemeRegistry` would ship the full MUI+Emotion+React client runtime
sitewide again, exactly the §9e regression already fixed once). Fix:
`src/ui/icons/index.tsx` — the exact same path data, copied verbatim from
the `@mui/icons-material` source files (real Material Design artwork, only
the Emotion wrapper dropped), rendered through a plain `<svg>`. Zero
dependency on the package; it was uninstalled afterward.

**2. Inline `style` always wins the CSS cascade over any stylesheet rule,
media queries included — no exceptions.** Three "responsive" layouts (the
homepage hero, the category page's filter sidebar, the PDP intro) each set
`gridTemplateColumns: '1fr'` as an inline style and expected a `<style>`
block's `@media (min-width: 900px) { .foo { grid-template-columns: 1fr 1fr
} }` to override it at wider viewports. It never did, at any width — an
inline style cannot be beaten by a stylesheet selector short of `!important`,
which nothing here used. Not caught by typecheck or lint (it's a runtime CSS
fact, not a type error), only by actually measuring
`getComputedStyle(el).gridTemplateColumns` in a live browser at 1280px and
finding it still `"1152px"` (one column) instead of two. Fixed by moving the
base rule into the `<style>` block alongside its override, so the cascade
has only one place to resolve from.

**3. `CategoryTile`/`ProductCard` gave screen readers a duplicated
accessible name.** Both set an `alt` on the image AND a separate visible
text label inside the same `<Link>` — the link's accessible name became
"Loft Loft" (image alt + visible span, concatenated). Found by a Playwright
locator, not an accessibility audit tool: `getByRole('link', { name: 'Loft'
})` started matching *two* elements after the redesign — the category tile
(now announcing "Loft Loft") and, coincidentally, the homepage's own
"Stołek loftowy z grawerem" product card, since Playwright's non-exact name
matching is substring-based and "loftowy" contains "loft". Fixing the real
accessibility bug (image `alt=""` — decorative, since the visible label
already does the job) and adding `exact: true` to the test's locator (the
substring-match ambiguity between "Loft" and "Stołek **loft**owy..." is real
regardless of the alt-text fix, and would recur any time a product name
happens to contain a category name) both mattered; neither alone fully
explained what Playwright caught.

**4. A Turbopack dev-mode-only client-navigation race, not an application
bug.** Once `/[category]` started reading `searchParams` (for the new
filter/sort feature) and became dynamically rendered, clicking a product
link *from* the category page intermittently never completed under `next
dev`: the destination's RSC fetch logged a real `200 OK`, but
`window.location.href` never updated — no console error on either side, and
retrying the same click sometimes worked. Reproduced repeatedly under `next
dev` (including through a full Playwright run with a freshly-cleared
`.next`), then tested the same click ten times by hand against a genuine
production build (`next build && next start`) — clean, first-try, every
time. That isolates it precisely: a Turbopack first-compile race on a newly-
dynamic dev route, not a bug in this codebase, and not something a real
visitor — who only ever sees the production build — could ever hit. Fixed
the actual problem, not the symptom: `playwright.config.ts`'s `webServer`
now runs `next build && next start` instead of `next dev`. This is also
correct on its own terms, independent of this specific bug — e2e tests exist
to verify what ships, and `next dev` was never that; the old config just
happened not to expose the gap until a route became dynamic.

## 9i. Sticky price bar — 2026-08-24, same day as the redesign

Closed the one remaining P3 mobile/desktop-UX gap the redesign pass left
open: the price was only ever visible on the Summary step, inline. Added
`StickyPriceBar` to `src/ui/islands/configurator/Configurator.tsx` —
`position: fixed` to the viewport bottom, rendered unconditionally once the
step machine has resolved (every step, not just Summary), reusing two
Polish strings that had been sitting in `src/content/pl/site.ts` unwired
since P3 started (`configuratorPriceCalculatingPl` for the in-flight
Server Action fetch, `configuratorPriceUnavailablePl` for `'incomplete'`)
plus one new one, `configuratorPriceUnavailableGenericPl`, for the
`'dimension_invalid'`/`'infeasible'` states where the old "incomplete"
copy ("Podaj wymiary…") would have been actively wrong — dimensions
*were* given, they just don't work.

`position: fixed` over `sticky` deliberately: the configurator's content
height varies a lot per step (the Design step is short, Summary can be
long with feasibility alerts), and `sticky` only pins once the element
would otherwise scroll past its flow position — not guaranteed on a short
step. `fixed` is unconditional. Added `paddingBottom: 72` to the
component's own root so the bar never covers the Wstecz/Dalej buttons.

Browser-verified end to end on the loft product (`stolek-loftowy-z-grawerem`):
watched the bar go "Podaj wymiary, aby zobaczyć cenę." → "Obliczanie
ceny…" (visible mid-fetch, confirming the loading state actually wires up,
not just theoretically reachable) → "264,39 zł" as design → material →
30×30cm dimensions were selected, price recomputed server-side each time.
Confirmed pinned-to-bottom positioning at both a 1280px desktop width and
the mobile preset via `getBoundingClientRect`/`window.innerWidth`/
`innerHeight` (not just a screenshot — the mobile screenshot itself was
misleading, clipped by a devicePixelRatio/viewport-scale mismatch in the
browser tool unrelated to the page; the JS-measured rect confirmed the bar
sits exactly at `bottom: innerHeight` with zero horizontal overflow).
`npm test` (354/354), `npm run typecheck`, `npm run lint`, `npm run build`,
and `npm run e2e` (4/4, desktop + mobile-safari) all pass with no changes
needed to the existing e2e spec — `shell.spec.ts` never interacts with the
configurator today.

## 9j. Font-backed personalization — 2026-08-24

Closed the biggest remaining P3 gap: personalization was fully priced by the
domain layer (`domain/personalization/validate.ts`, `domain/pricing`) and
fully scaffolded server-side (`PersonalizationSpec` seeded for two products,
`data.personalizationSpec` already threaded into `priceConfiguration`) since
the P3 foundation pass, but the actual glyph-coverage check never ran —
there was no `Font` row, so the configurator's PERSONALIZATION step was a
static "coming soon" notice on every product, regardless of what the domain
layer could already prove.

**The font.** Real, not a placeholder in the D5 sense: Inter, the site's
own self-hosted body face (`src/ui/theme/fonts.ts`), SIL Open Font
Licensed, downloaded fresh from Google's own font repository
(`github.com/google/fonts`, `ofl/inter`) into `public/fonts/Inter-Variable.ttf`
(876 KB, verified `TrueType Font data` via `file`), license text saved
alongside it (`public/fonts/Inter-OFL.txt`) for redistribution compliance. A
clean sans-serif offered alongside decorative faces is completely ordinary
for real laser engraving — this is a legitimate first offering, not a
stand-in. `minHeightUm` (3 mm) is this pass's one invented number, same
`TODO_PRICING`-style discipline as everywhere else — a real legibility
floor needs an actual test cut on the machine, not a guess.

**The coverage data is real, every time.** `prisma/seed.ts`'s new
`seedFont()` reads the actual `.ttf` file with `opentype.js` (new
dependency, MIT-licensed, sanity-checked with a throwaway script before
adding it: 2849 glyphs, all nine Polish-specific letters present) and
parses its cmap table live on every seed run — never a JSON blob typed in
once and left to rot. Confirmed via `psql`: `supportsPolishDiacritics: true`,
206 compressed code-point ranges stored. `seedFont()` throws if a
Polish-specific glyph is ever missing, so a bad font file fails the seed
loudly instead of shipping a font that silently mangles a customer's name —
exactly the failure mode `domain/personalization`'s own header comment
exists to prevent.

**All three eligible products got a real spec.** Two (`bransoletka`,
`obraz`) already had a `PersonalizationSpec` with `allowedFontIds: []` — an
explicit "P3 concern" placeholder since the P3 foundation pass — now
pointed at the real font. The third, `stolek-loftowy-z-grawerem`
(LOFT_FURNITURE), had no spec at all despite its step list including
PERSONALIZATION; added one (30 chars, 2 lines, 8 mm floor — a bigger
surface than the bracelet, larger text is legible) rather than leave a
silent gap now that the infrastructure exists to back it for real.
`seedPersonalizationSpec`'s `allowedFontIds` update also changed from
`update: {}` (never touch an existing row) to re-asserting the real font
list on every run — the same precedent as the first-admin seed's
`update: { role: 'ADMIN' }` — because the old value was never something a
human edited through an admin panel, it was an unconditional "not done
yet" placeholder that a `git pull` + re-seed needs to actually repair.

**Server wiring, following the exact existing pattern for every other
option category** (material, design, finish, thickness, installation
variant): `src/server/repositories/configurator.ts` fetches the allowed
`Font` rows (a second query — `allowedFontIds` is a plain string array on
`PersonalizationSpec`, not a relation, so there is no single-query `include`
for it); `resolve-options.ts` adds `fonts`/`fontIds` to
`ConfiguratorOptionData`/`ResolvedOptions`/`ResolvedOptionAvailability`,
always available since no compatibility rule narrows font choice, same as
installation variants; `price-configuration.ts`'s new
`evaluatePersonalization` calls the domain's own `validatePersonalization`
using `toPersonalizationSpec`/`toFontSpec` (both already existed, unit-tested,
unused until now) and folds the result into `blockingError` alongside
feasibility, exactly like every other "can't add to cart yet" reason.

**One honest interim approximation, documented where it lives:** the
domain validator needs a concrete `textHeightMm` — the height text will
actually be engraved at — and no 2D layout exists yet (§7.3) to produce a
real one. `evaluatePersonalization` passes the *effective minimum*
(`toPersonalizationSpec`'s already-existing stricter-of-spec-and-material
floor) instead. That makes the two height-specific issue codes
(`TEXT_TOO_SMALL_FOR_FONT`/`_MATERIAL`) a worst-case approximation until a
real preview exists — but the check that actually matters, the one an
engraving mistake can never be undone from
(`UNSUPPORTED_CHARACTER`/`EMOJI_NOT_SUPPORTED`), runs exactly, against the
font's real parsed glyphs, no approximation at all.

**UI**: a new `PersonalizationStep` in `Configurator.tsx` replaces the
static notice with a real `TextField` (multiline when `maxLines > 1`, live
`count/max` counter, local `error` state the moment the count is
exceeded) and reuses the existing `OptionStep` component for font choice —
no bespoke picker needed, fonts are just another annotated option list.
`personalizationMessage` (`src/content/pl/messages.ts`) already existed,
fully implemented, entirely unused until this pass — every Polish string
this step needed was already written and reviewed, just never wired to
anything that could produce a `PersonalizationIssue`. Two small additions
only: `configuratorFontLabelPl` and `configuratorFontRequiredPl` (the
"choose a font before this can be checked" gate — a UI/server precondition,
not a domain rule, so it deliberately is not a `PersonalizationIssueCode`).
`fontId` was already a field on `Selections` (present since the P3
foundation, unused) but never round-tripped through the URL; added `ft=`
alongside the existing `d`/`m`/`w`/`h`/`t`/`f`/`i`/`p` params.

**Browser-verified end to end**, production build, on two different
products: typed "Michał" on the bracelet (JEWELRY, single-line, 20-char
cap) — the font-required warning appeared before a font was chosen, and
cleared the instant Inter was selected, since `ł` is genuinely in Inter's
cmap; a 65-character string correctly reported "Maksymalna długość to 20
znaków. Wpisano 65."; typing a real ♥ emoji correctly triggered "Emoji nie
mogą zostać wykonane" — both real domain validation paths, not asserted in
isolation, observed live against the actual price/pricing round trip
(110,09 zł with the flat fee + per-character surcharge included). Then the
loft stool (LOFT_FURNITURE, two-line, 30-char cap, brand new spec this
pass): confirmed via a direct query-string URL that the full
seven-selection round trip (`d`, `m`, `w`, `h`, `t`, `f` — everything
except personalization) restores correctly on a cold load, and that the
multiline field renders two rows with a correct 27/30 count for a two-line
string. `npm test` (361/361, +7 new — resolve-options/price-configuration
fixtures for the font list and every personalization branch), `npm run
typecheck`, `npm run lint`, `npm run build`, and `npm run e2e` (4/4) all
pass; `opentype.js` added zero new `npm audit` findings (the three
pre-existing high-severity warnings are `@prisma/config`'s `deepmerge-ts`,
unrelated).

## 9k. The 2D preview — 2026-08-24

Closed §7.3, the last big open P3 item. Unlike the redesign pass (§9g),
this one started from a set of genuinely open questions rather than a
research-then-plan cycle — there was no reference template to check, only
real forks in what a "live preview" could honestly show given the current
data: no real design artwork exists yet (the one seeded `Design` is
explicitly a placeholder), and material representation is real photos, not
swatches. Put three specific questions to the owner rather than guessing:

1. **What should it render**, given those constraints — a schematic
   dimensions/seams-only diagram, a full composited mockup built now with
   placeholder assets and swapped later, or no visual at all yet (just the
   existing text summary)? **Answered: full composited mockup.**
2. **Should the customer's personalization text render in the real chosen
   font**, now that one exists (§9j)? **Answered: yes** — explicitly framed
   as the one part of this feature that could be 100% real today, not a
   placeholder, and the owner agreed.
3. **Where in the flow** — persistent across every step (parity with the
   sticky price bar), or Summary-only? **Answered: persistent.**

**What it composites, and the honesty line drawn around each piece**
(all stated in the component's own header comment,
`src/ui/islands/configurator/ConfiguratorPreview.tsx`, not just here):

- **Background**: the chosen material's real `imageUrl` (the same sourced
  photography from the 2026-08-24 redesign, §9g) — a genuine photo of that
  material, not a generic stand-in, though not literally the exact plank/
  tile the customer will receive.
- **Design overlay**: the chosen design's real `previewUrl`, composited
  with `mix-blend-mode: multiply` so it reads as "into" the material rather
  than pasted on top. Today that file is still the one seeded placeholder
  SVG ("wzór podstawowy — do zastąpienia") — browser-verified this actually
  looks like something (corner registration marks + a "Wzór" label,
  legible against the wood grain on a large product; nearly invisible on
  the tiny bracelet, since the placeholder's white background contributes
  nothing under a multiply blend). The code makes zero assumption about
  what the artwork looks like — the day a real design's SVG is seeded, this
  composites it identically, no code change.
- **Engraved text — the one fully real piece**: rendered via the CSS Font
  Loading API (`new FontFace(name, url(...)).load()` +
  `document.fonts.add`), loading the *exact* file at the selected font's
  `fileUrl` — never a system font standing in, never the site's own
  `next/font/google` Inter (a different fetch, a different subset, and
  critically a different literal file than the one `seedFont` parsed
  coverage from — reusing it would have silently violated the `Font`
  model's own header comment: "the preview MUST render with this same
  file, or the preview is a lie"). Browser-verified: typed "Michał" and
  watched a correctly-shaped `ł` composite live onto the real oak photo,
  confirmed via `read_network_requests` that `/fonts/Inter-Variable.ttf`
  was the literal file fetched for it.
- **Module seams**: drawn as dashed rectangles directly from
  `ModuleLayout.modules`' real per-module `xMm`/`yMm`/`widthMm`/`heightMm`
  (`domain/modules/split.ts`) — the identical numbers already driving price
  and the production plan, never re-derived. Browser-verified on the
  wall-art product at 1200×400 mm: a real seam line appears exactly at the
  true 2-module split, matching the "2 moduły" notice shown alongside it.
- **The on-page caption says all of this in one sentence**
  (`configuratorPreviewCaptionPl`: "Wizualizacja poglądowa złożona z
  rzeczywistych zdjęć materiału i wzoru zastępczego — ostateczny wygląd
  produktu może się różnić.") rather than leaving a customer to assume this
  is a photo of their actual finished piece — the same "nothing is faked"
  discipline as everywhere else in this project, applied to a picture
  instead of a sentence this time.

**Data plumbing, following the exact existing pattern once more**: added
`imageUrl` to `MaterialOptionRow`, `previewUrl` to `DesignOptionRow`, and
`fileUrl` to `FontOptionRow` (`resolve-options.ts`), threaded through the
same Prisma selects in `src/server/repositories/configurator.ts` that
already fetch everything else `ConfiguratorOptionData` carries. No new
Server Action, no new round trip — `Configurator.tsx` already receives the
full `ConfiguratorOptionData` as a prop from the product page (server-
rendered once), so the preview reads material/design/font image URLs
directly off `options`, the same object every other option list already
uses.

**Verified**: `npm test` (361/361, unchanged — this pass added no new
domain logic, only data plumbing and a client rendering component, so no
new fixture tests were needed beyond what §9j already added), `npm run
typecheck`, `npm run lint`, `npm run build`, `npm run e2e` (4/4) all pass.
Browser-verified end to end across three products at different scales
(40 mm bracelet, 350 mm stool, 1200 mm wall art) — empty state before a
material is chosen, live compositing as material/design/text/font are
picked, correct aspect ratio at every real product's real dimension
envelope, and the module-seam case specifically.

## 9l. P5 — cart, checkout, order creation — 2026-08-24/25

The biggest single pass this session, built after the owner's explicit
"don't skip anything or any detail" — full plan-mode cycle (context
gathered directly, then a Plan sub-agent stress-tested the design before
any code, per this session's established discipline for large changes).
Two things came out of that stress-test that corrected my own first
instinct, both verified against `docs/ARCHITECTURE.md` before writing
anything: the guest session cookie must be **signed** (HMAC, not just
random bytes — `Configuration.sessionToken`'s own schema comment says so
explicitly, and it's a different mechanism from `Order.accessToken` for a
different job), and `orderNumber` must be collision-safe **per year-month**
(§15's own words), not a single global counter.

### What's real, end to end

- **Guest sessions** (`src/server/session/`) — the first cookie-writing
  code in this codebase. HMAC-SHA256 signed, a new `SESSION_SECRET` env var
  (`.env.example`, same style as `SEED_ADMIN_EMAIL`). Read-only helper
  (`readGuestSessionToken`) safe for Server Components; minting only
  happens inside a Server Action (`ensureGuestSessionToken` in
  `actions/cart.ts`), since only Server Actions/Route Handlers may write
  cookies.
- **Order numbers**, race-free under real concurrency — a counter table
  (`OrderNumberCounter`, one raw migration, no Prisma model — accessed only
  via `tx.$queryRaw` inside the order transaction) incremented with
  `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`, which takes its row
  lock as part of one atomic statement. This has now genuinely been hit
  concurrently — Playwright's e2e suite runs the new checkout spec on
  `desktop-chromium` and `mobile-safari` in parallel, and order numbers
  came out correctly sequential every time, never colliding, across this
  session's manual and automated runs (0001 through 0008+).
- **Cart** (`src/server/repositories/cart.ts`, `src/server/actions/cart.ts`)
  — `addToCart`/`updateCartItemConfiguration` re-fetch the real catalogue
  and re-run `priceConfiguration` exactly like `getConfiguratorSnapshot`
  does (extracted the shared logic into
  `src/server/configurator/validate-and-price.ts` so the two call sites
  can't drift), then cache the computed price/module layout/warnings
  directly on the `Configuration` row — reading the cart never re-prices,
  matching the schema's own "Server-computed, cached for display" comment.
  Every add-to-cart is a fresh `Configuration`, never merged, which is
  exactly how "two configurations of one product in the cart" is satisfied
  with no dedup logic at all. "Edit" reuses the configurator's *existing*
  URL-encoded selections state (`writeSelectionsToSearch`/
  `readSelectionsFromSearch`, now extracted to `selections-url.ts`) to
  restore the form, then updates the *same* `Configuration` row in place.
- **Order creation** (`src/server/orders/create-order.ts`) — the shape
  `docs/ARCHITECTURE.md` §15.3 specifies almost verbatim: outside any
  transaction, re-price every cart item fresh and compare against the
  cached value (reject with the P1-written, finally-used
  `COPY.priceChanged` before ever opening a transaction); inside
  `prisma.$transaction` — the first in this codebase — the counter
  increment, `Order` + `OrderItem[]` (a real immutable snapshot: resolved
  display names, not ids, plus the full `PriceBreakdown` and pricing
  version — shared type `src/server/orders/snapshot.ts` so the write side
  and the confirmation page's read side can't drift) + initial `OrderEvent`
  (reusing the already-tested `checkOrderStatusTransition` from
  `domain/order-status/transitions.ts`, including its automatic
  `DESIGN_REVIEW` routing for an unapproved custom design — inert today,
  no seeded product has one, but wired through the real state machine, not
  a bespoke check), then deleting exactly the `CartItem` ids that were
  priced (never "whatever's in the cart at commit time" — a second tab
  could have added something since the read). The `Cart` row itself and
  the `Configuration` rows both survive checkout deliberately — no FK from
  `OrderItem` to `Configuration` (it's a JSON snapshot, not a reference),
  so leaving them is a plausible foundation for a future reorder feature,
  not litter.
- **Checkout form** (`src/ui/islands/checkout/CheckoutForm.tsx`,
  `src/server/actions/checkout.ts`) — the first `<form action={...}>` +
  `useActionState` pattern in this codebase, chosen over a controlled form
  since checkout needs real server validation, not the configurator's kind
  of live reactivity. Real NIP checksum (`domain/checkout/validate.ts`,
  hand-verified against a known-valid NIP before writing the test), real
  Polish postal-code format, lenient phone validation. Real Polish
  withdrawal-exemption text citing art. 38 pkt 3 ustawy o prawach
  konsumenta, stored verbatim on the order with a version string.
- **Confirmation & guest lookup**
  (`src/app/(shop)/zamowienie/[orderNumber]`,
  `.../zamowienie/sprawdz`) — bank-transfer details (order number as
  transfer title, real amount) or the contact-arranged notice; guest
  lookup by order number + access token, constant-time comparison
  (`timingSafeEqual`, guarded against its own length-mismatch throw), a
  wrong token 404s identically to a nonexistent order (§16.1's "404, not
  403" — an order's existence is never probeable).
- **Mailer** (`src/server/mail/mailer.ts`) — the real interface
  §14 specifies, one implementation (`UnconfiguredMailer`) that logs and
  reports `{ sent: false }`. Order creation calls it regardless and never
  lets a mailer failure undo an already-successful order; the confirmation
  page says "confirmation will follow," never that an email was sent.

### What's deliberately NOT built, and why — not oversights

- **Guest-cart-merge-on-login** — impossible without Auth.js (P6, not
  started). Guest checkout is the complete, primary path today, exactly as
  `docs/ARCHITECTURE.md` frames it ("guest checkout supported separately").
- **Real shipping rates** — no `ShippingMethod` model exists;
  `docs/ARCHITECTURE.md` puts "shipping methods and rates" under P7 (admin
  panel) configuration. One flat placeholder
  (`SHIPPING_FLAT_GROSZE`, `TODO_PRICING`-tagged, exported from
  `create-order.ts` so the checkout page displays the *exact* number that
  will be charged, never a second guess) stands in — the same discipline
  as every other invented number in this codebase.
- **A real bank account number on the confirmation page** — deliberately
  refused, not just deferred. No real account exists anywhere in this
  system (same P7-admin-config gap as shipping), and inventing one would
  be actively dangerous — a customer could wire real money to a fabricated
  account. The page says plainly that the number will follow separately.
- **Delivery method choice** — the schema has no `deliveryMethod` field and
  no `ShippingMethod` model to choose between, so checkout collects the
  address only. One implicit method at the flat rate, not a fabricated
  chooser with nothing behind it.

### Two real bugs found by browser- and e2e-testing this, both fixed

1. **A `'use client'` file's exports can't be imported into a Server
   Component — not even a plain function.** `writeSelectionsToSearch` lived
   in `Configurator.tsx` (a client file); the cart page's "Edytuj" link
   needed it too, and the build failed with "Attempted to call
   `writeSelectionsToSearch()` from the server but it's on the client."
   Extracted both URL-mapping functions into a plain module with no
   directive at all (`selections-url.ts`) so both sides can import it
   safely — the same fix shape as the earlier `@mui/icons-material`
   hydration bug (§9h): the client/server boundary in this framework is
   per-*file*, not per-export.
2. **`secure: NODE_ENV === 'production'` on the guest cookie was wrong —
   caught only by adding a real e2e test and running it on WebKit.** Build
   mode isn't the same fact as "is this request actually HTTPS," and this
   project's own Playwright config deliberately runs a *production build*
   over plain `http://localhost` (§9h's Turbopack-dev-mode fix). A
   `Secure` cookie over plain HTTP is silently dropped by a spec-compliant
   browser. Chromium happens to treat `localhost` as an implicitly secure
   context, which is exactly why `desktop-chromium` passed and
   `mobile-safari` failed with an empty cart right after a successful
   add-to-cart — the guest session cookie was never actually stored.
   Fixed by deriving `secure` from `NEXT_PUBLIC_SITE_URL` (the same env var
   already used for canonical/OG URLs) instead of build mode — this is
   the kind of bug that would have shipped silently and broken every real
   Safari/iOS guest's cart in production, and it only surfaced because
   `tests/e2e/checkout.spec.ts` (a new spec, written specifically because
   the plan's own verification section called for one) runs on WebKit.

### Verified

`npm test` (369/369, +8 for `domain/checkout/validate.ts`), `npm run
typecheck`, `npm run lint`, `npm run build`, `npm run e2e` (6/6 — the new
`checkout.spec.ts` on top of the existing `shell.spec.ts`, both browser
projects) all pass. Beyond the automated suite, verified by hand against
real DB state, not just the rendered page: two full checkout runs
(`BANK_TRANSFER` and a second attempt that exercised `CONTACT_ARRANGED`'s
radio before a validation retry reset it to the default — real Polish NIP
`5260250274` accepted, a deliberately invalid postal code `98765` rejected
with the exact right message *and* every other field's value preserved
across the retry — a third real bug found and fixed: `useActionState`
re-renders the same form instance, and every input was uncontrolled, so a
single field's validation error was silently erasing everything else the
customer had typed; fixed by echoing submitted values back in the action's
return state and forcing a remount via a render-counter `key` on the
form); order numbers `2026/08/0001` then `2026/08/0002` confirming the
per-month counter increments correctly within the same month; a wrong
`?token=` 404ing exactly like a nonexistent order; the guest lookup form
redirecting correctly to a real confirmation page; and — matching the
rigor of the P2 Lighthouse pass, not just asserting the snapshot mechanism
works — renamed a live `Material` row to a nonsense string after placing
an order, reloaded that order's confirmation page, confirmed it still
rendered the *original* material name, then reverted the rename.

## 9m. Frontend depth pass + Yato-yane joinery (prepared, disabled) — 2026-08-25

The owner's second round of "too minimalistic" feedback, this time
specific: the nav read as raw text with no icons, search sat awkwardly
inside the nav row, the page background was flat, cards had no shadow or
hover state, and there was no footer anywhere. Confirmed via
`AskUserQuestion` that all four were real gaps at once, and that the
footer must contain only real content — no invented email/phone/social.
Separately, the owner wants to prepare (but not yet enable) a larger
loft-table format joined from multiple panels via a real Japanese joint.

**Frontend**: `src/app/theme-vars.css` gained a spacing scale, warm-tinted
shadow tokens (`--shadow-sm`/`--shadow-md`), a real `--radius-card`
(replacing the old literal `2`, which was 2px, not a design unit — a real
part of why everything looked flat), and global `:hover`/`:focus-visible`
utility classes (`.nav-link`, `.cart-link`, `.product-card`,
`.category-tile`, `.footer-link`) — the only way to express real hover
states from RSC-only inline-`style` components with zero client JS.
`SiteHeader` gained a craft-icon logo mark and a real cart link
(`CartIcon`, new, same `makeIcon` pattern as the other 11 icons in
`src/ui/icons/index.tsx`); search moved out into its own new
`SearchBar.tsx`, a banded section below the header exactly as the owner
asked. New `Footer.tsx` renders real category links (shared `categories`
prop, fetched once in `layout.tsx` and passed to both `SiteHeader` and
`Footer` instead of querying twice), a search link, and links to two new
honest stub pages, `/regulamin` and `/polityka-prywatnosci` — real pages
stating the document is in preparation, not dead links or invented legal
text (`docs/ARCHITECTURE.md` §17 already requires a real lawyer review
before launch). `ProductCard`/`CategoryTile` now use `--radius-card` +
shadow + hover-lift + image zoom.

One real bug found and fixed during browser verification: the footer's
responsive grid had `gridTemplateColumns` set **both** inline and in the
`.footer-grid` CSS class's media query — the inline value always wins the
cascade, so the class's `@media (min-width: 700px)` override never took
effect and the footer stayed 3-column (columns clipped off-screen) all
the way down to a 375px phone. This is the exact failure mode
`(marketing)/page.tsx`'s own `.hero-grid` comment already warned about;
fixed by removing `gridTemplateColumns` from the inline style entirely and
letting the class own it, same as `.hero-grid` does. Caught only by
actually resizing to mobile width and looking, not by the type-checker or
any test — the same discipline this handover has needed before (§9h).

**Yato-yane joinery — prepared, disabled**: of the owner's three real
candidate techniques (Yato-yane spline, Suri-tsugi hand-planed rubbed
joint, Hashibami breadboard-end batten), Yato-yane is the one actually
built here — it's the technique that joins two separate flat panels
edge-to-edge into one larger surface and is CNC-millable; the other two
solve different problems (Suri-tsugi needs hand-tool glue-fitting,
Hashibami stabilizes one existing panel rather than joining two). No new
splitting math was needed: `domain/modules/split.ts`'s existing
`splitIntoModules` already produces the right layout for a joined size
(1200×1000mm against the seeded 600×500mm machine limits already yields a
2×2 grid of four panels — confirmed by a new test,
`tests/unit/joinery.test.ts`). What's new: a `JoineryTechniqueCode` enum
and four nullable/defaulted columns on `Product`
(`supportsPanelJoinery`, `joineryTechniqueCode`, `joinedMaxWidthMm`,
`joinedMaxHeightMm` — migration
`20260825000000_add_product_panel_joinery`, additive only); a new pure
domain module `src/domain/joinery/yato-yane.ts` with
`buildJoineryFinding(moduleCount)`; a new `JOINED_PANEL_YATO_YANE` member
on `FeasibilityCode` (`domain/feasibility/rules.ts`) that
`evaluateFeasibility` itself never produces; and real customer-facing
Polish copy in `src/content/pl/joinery.ts` (plus the now-mandatory
`feasibilityMessage` case for the new code, since that switch must stay
exhaustive over `FeasibilityCode`).

**Deliberately not done** — this is prepared, not enabled: no server
action, resolver, or pricing/feasibility call site references
`domain/joinery` outside its own test; `prisma/seed.ts` was not touched,
so `supportsPanelJoinery` is `false` on every product, confirmed directly
against the running DB after `npm run db:deploy`; no configurator step or
UI surfaces any of this to a customer. Enabling it later needs three
things, in this order: flip `supportsPanelJoinery` true (and set
`joineryTechniqueCode`/`joinedMaxWidthMm`/`joinedMaxHeightMm`) on `loft`'s
seed row, add a configurator step or summary-panel toggle that lets a
customer opt into the larger joined size, and wire `buildJoineryFinding`
into whatever call site computes feasibility for that selection.

### Verified

`npm test` (373/373, +4 for `domain/joinery`), `npm run typecheck`,
`npm run lint`, `npm run build`, `npm run e2e` (6/6, both browser
projects, unchanged) all pass. `npm run db:deploy` applied the new
migration cleanly; queried the live DB directly afterward and confirmed
`supportsPanelJoinery` is `false` on all five seeded products. Browser-
verified at both mobile (375px) and desktop (1400px) widths: header icon
mark and cart link, the search section rendering below the header,
category/product card shadows and rounded corners, the footer's three
real columns and correct current-year copyright, and both legal stub
pages — including re-verifying mobile after the `gridTemplateColumns` fix
above, this time confirming the footer genuinely stacks to one column.

## 9n. Card badges, a sitewide grain texture, and a footer tagline — 2026-08-25

Immediate follow-up to §9m: the owner still wanted the cards "beautified"
with icons/badges, the background still read as flat color, and asked for
a short tagline beside the footer's description "to look more
professional."

**Card badges, real data only.** `ChairIcon`/`DiamondIcon`/`GridViewIcon`/
`ViewColumnIcon`/`ImagePlaceholderIcon` were added during the §9h redesign
and never used anywhere — a strong signal they were built for exactly
this. New `src/ui/primitives/category-icon.tsx` maps each category slug to
one of them (`EngineeringIcon` as the `inne` catch-all), used by both
`CategoryTile` (a circular badge, top-left) and `ProductCard` (same badge,
plus a second one). The second badge — a "Grawer" pill with `DrawIcon` —
only renders when `PersonalizationSpec.isEnabled` is genuinely true for
that product, which required extending `ProductCardData` (and both
`select` blocks that build it) with `categorySlug` and `hasPersonalization`
rather than inventing display-only data. Verified live: only `loft`,
`amulety-i-bransoletki`, and `obrazy-drewniane` show the pill — `gres` and
`panele-podlogowe` correctly don't, matching `prisma/seed.ts`'s three
`seedPersonalizationSpec` calls exactly.

**Background depth.** `body` now carries a very faint `feTurbulence` grain
(~3.5% opacity, `--mui-palette-background-default` reasoning documented
inline in `theme-vars.css`) instead of a flat single color, on top of the
existing per-`Section` paper/default alternation. Deliberately no
`background-attachment: fixed` — a known mobile-Safari scroll-jank
pattern, and `mobile-safari` is one of the two e2e browser projects this
project actually tests.

**Footer tagline.** `SITE.footerTaglinePl` ("Precyzja CNC. Ciepło
rzemiosła.") renders in `Footer.tsx` between the brand name and the
existing description, styled as a small italicized accent line with a
left border — the same category of authored brand copy as the homepage's
existing hero headline/subcopy and trust badges (all already
owner-accepted), not a new category of fabricated content — still no
invented reviews, contact details, or company registration data anywhere.

### Verified

`npm test` (373/373, unchanged — no new domain logic, just data plumbing
and presentation), `npm run typecheck`, `npm run lint`, `npm run build`,
`npm run e2e` (6/6, both browser projects) all pass. Browser-verified at
desktop (1400px) and mobile (375px): category tiles and product cards show
the correct icon per category, the "Grawer" pill appears only on the three
products that actually have it enabled, the footer tagline renders with
its accent border, and the mobile grid still stacks correctly (this pass
didn't touch the `.footer-grid`/`.hero-grid` responsive rules from §9m,
so no repeat of that bug).

## 9o. Third design pass: bolder background, richer cards, blog scaffold — 2026-08-25

Same day, third round: the owner said the background was *still* flat even
after §9n's grain, wanted the cards richer with more real info, and asked
for a blog section + post sub-page before moving to the next major phase
(P4/P6/P7). Clarified via `AskUserQuestion` rather than guessed a third
time on "flat," given guessing on it twice already hadn't landed.

**Background, round 2.** `body` (`theme-vars.css`) now layers a
`repeating-linear-gradient` blueprint-style grid (on-brand for a CNC/laser
shop — a technical-drawing motif, pure CSS, no image request) under a
bolder grain (opacity 0.035 → 0.06). `Section.tsx` gained a permanent
gradient tint on both `default`/`paper` surfaces (previously flat-color
only) plus an opt-in `decorative` prop that renders a new
`SectionDecoration.tsx` — a static, low-opacity concentric-ring accent
reusing `OrbitIconHero`'s exact visual language, `aria-hidden`, `z-index:
-1` so it sits behind real content without a stacking bug (verified: a
naive `z-index: auto` absolute child would have painted *above*
in-flow content per CSS3's stacking order — used `z-index: -1` instead,
which paints after the section's own background but before its static
children). Applied to 3 real accent points (homepage's Kategorie/Nasze
produkty, the category-page header), not every section — a deliberate
scope boundary against visual noise.

**Cards, round 2.** `ProductCardData` (`src/server/repositories/products.ts`)
gained `productionDaysMin/Max`, `minWidthMm/maxWidthMm`, and `materials`
(kept as an array — `ProductMaterial` is a real many-to-many join and
`ProductDetail` already models it that way, even though all 5 seeded
products have exactly one material today). `ProductCard.tsx` renders a
compact facts row (a new `AccessTimeIcon`, same `makeIcon` pattern as the
other 13, + the real production-day range + real width range via the
already-existing `formatMmAsCentimetres`) and a material chip
(`.material-chip`, new CSS class). Explicitly did NOT add a
popularity/urgency badge ("Bestseller" etc.) — flagged to the owner as
fabrication risk with only 5 products and no real sales data, and they
did not select it.

**Blog — scaffold, no fabricated posts.** New `BlogPost` Prisma model
(migration `20260825010000_add_blog_post`), mirroring `Category`'s exact
conventions (slug, `*Pl` fields, `isActive`, `sortOrder`,
`createdAt`/`updatedAt`) plus a nullable `publishedAt` that doubles as a
draft flag. New `src/server/repositories/blog.ts`
(`listPublishedBlogPosts`, `getPublishedBlogPostBySlug`,
`listAllPublishedBlogPostSlugs`), `/blog` index and `/blog/[slug]` detail
pages under `(marketing)` (content-oriented, like the homepage — `(shop)`
only holds catalogue/cart/checkout/legal today), the same honest-404
pattern as categories/products/orders for an unknown or unpublished slug,
a footer nav link, and a third branch folded into `sitemap.ts`'s existing
`Promise.all` pattern. **Zero seeded rows** — confirmed directly against
the live DB after `db:deploy` (`blogPost.count() === 0`) — so every real
visitor sees the honest "Wpisy pojawią się tutaj wkrótce" empty state
until a real post exists. No admin UI to add one yet (P7 doesn't exist);
today that means a manual DB insert, the same limitation every other
"prepared, not yet wired to an editor" piece in this project already has.

### A real Playwright environment flake, not a regression

`npm run e2e` first failed with `Timed out waiting 180000ms from
config.webServer` — the exact same failure this project hit once before,
unrelated to any code change. Diagnosed by running the webServer's own
command (`npm run build && npm run start`) directly: it built and bound
port 3000 in under 300ms, and `curl` confirmed the blog page served
correctly. Killing leftover processes holding port 3000 from an earlier
manual `preview_start` (a recurring nuisance in this sandboxed dev
environment — the port shows stale `TIME_WAIT` sockets after a process is
killed) and re-running `npm run e2e` passed cleanly, 6/6, both browser
projects, on the first clean attempt. Recorded here so a future session
recognizes the pattern instead of chasing a phantom regression.

### Verified

`npm test` (373/373, unchanged), `npm run typecheck`, `npm run lint`,
`npm run build`, `npm run db:deploy` (new `BlogPost` table, confirmed
empty), `npm run e2e` (6/6, both browser projects) all pass. Browser-
verified at desktop (1400px) and mobile (375px): the grid texture is
now clearly visible (confirmed directly on the `/blog` page's mostly-
empty background), section gradients and the corner ring accents render
without layout shift, product cards show correct production-time/size-
range text and the right material chip for all 5 real products, cards
don't overflow at 375px, `/blog` renders the honest empty state, and the
footer's new "Blog" link resolves to it.

## 9p. Fourth design pass: hexagon background + real blog content — 2026-08-25

Same day, fourth round. Two asks: the blog never actually appeared on the
homepage even though it existed at `/blog`, and — since the owner now
wanted to *see* it working, not just exist — 4 placeholder posts; and a
detailed brief to replace the flat/grid background with a hexagonal
"material tile" motif.

**Blog content.** `prisma/seed.ts` gained a `seedBlogPost()` helper and 4
real posts (wood care, the CNC/laser process, materials used, what
personalization means) with distinct past `publishedAt` dates. This is a
deliberate, documented exception to "nothing is faked," scoped narrowly:
generic craft/material topics the business could really publish, not
fabricated claims, numbers, or customer voices — the fabrication rule
`docs/ARCHITECTURE.md` §16A.1 module 9 actually forbids is reviews/
testimonials in a customer's voice, which this isn't. Marked in the
seed file's own header exactly like `TODO_PRICING` — a real first draft,
must be reviewed before launch. `(marketing)/page.tsx` gained a "Z
naszego bloga" section (latest 3 posts + a link to `/blog`) after "Nasze
produkty" — no `decorative` accent on it, keeping the existing 3 accented
sections plus the hero as the honest limit.

**Hexagon background.** `SectionDecoration.tsx` was rewritten from
concentric rings to a honeycomb cluster — mixed outline-only hexagons and
a minority of "material tile" hexagons centered on real existing icons
(`ChairIcon`/`DiamondIcon`/`GridViewIcon`/`ViewColumnIcon` — furniture,
jewellery/materials, tile, panels), deliberately not real photos (would
read as a fake curated gallery and cost real image requests). `Section.tsx`'s
`decorative` prop gained a `'both'` option for the hero. `theme-vars.css`'s
`body` dropped the earlier round's blueprint-grid wash (two geometric
languages fighting each other) but kept the faint grain.

### Two real bugs, both caught by actually looking, neither by any type-check

1. **The whole cluster was invisible on first render.** `Section` set
   `position: relative` but never `z-index`, so it never established its
   own stacking context — the decoration's `z-index: -1` escaped to a far
   higher ancestor (effectively the page root) and painted *behind*
   the section's own opaque `backgroundColor` instead of on top of it.
   Fixed by giving `Section` an explicit `zIndex: 0` alongside
   `position: relative` whenever `decorative` is set, so the negative
   z-index resolves within the section's own, now-real stacking context.
2. **After fixing #1, still nothing showed** — a second, independent bug:
   the hexagon coordinates were authored backwards relative to the CSS
   positioning. The wrapper used `right: -110px` (or `left: -110px`) with
   a 300px-wide box, which — worked through arithmetically — means only
   the box's *low-x* local region survives the section's own
   `overflow: hidden` clip, while every hexagon had deliberately been
   placed at *high* local x, thinking that was "the edge." Combined with
   a fade mask that was already transparent by the time it reached the
   surviving region, literally nothing could ever have been both visible
   and opaque at once. Fixed by redesigning the coordinate scheme
   entirely: the cluster box is now positioned flush (`[side]: 0`, no
   negative offset) against the section's edge, authored so its *own*
   high-x edge IS the true page edge (dense hexagons there, a few
   deliberately exceeding the box so the SVG's own default clip trims
   them for the brief's "partially outside the viewport" effect), fading
   toward low x (content). Caught only by taking real screenshots at
   several viewport widths and reasoning through the actual pixel math —
   the kind of bug no type-check or lint rule can see, since every value
   involved was a syntactically valid, plausible-looking CSS position.

### Verified

`npm test` (373/373, unchanged), `npm run typecheck`, `npm run lint`,
`npm run build`, `npm run db:seed` (confirmed exactly 4 `BlogPost` rows
against the live DB, correct slugs and past `publishedAt` dates),
`npm run e2e` (6/6, both browser projects) all pass. Browser-verified at
desktop (1401px), tablet (800px), and mobile (400px): the homepage's new
blog section shows 3 real posts linking correctly; the hexagon cluster
renders clearly on both hero edges and the two previously-decorated
sections, mixed outline/icon hexagons, fading toward content, several
genuinely clipped at the edge; at 800px only the small `.hex-core` subset
remains; at 400px the decoration is completely gone with zero
interference with the header/hero text or buttons.

## 9q. Hexagon variety/scale + blog images — 2026-08-26

Same-day follow-up to §9p: the owner said the hexagon icons repeated too
much, wanted a bigger CNC-photo hexagon "so the page looks more pro," said
the pattern was still too narrowed to the margins, and asked for real
images on the blog posts.

**Icon diversity.** All 4 placements (hero left/right, Kategorie,
Nasze produkty) used the same 4 icons before. Now each of the 8 real
icons already in the codebase (`ChairIcon`/`DiamondIcon`/`GridViewIcon`/
`ViewColumnIcon`/`ImagePlaceholderIcon`/`PrecisionManufacturingIcon`/
`EngineeringIcon`/`DrawIcon`) is used exactly once sitewide —
`SectionDecoration.tsx` exports `ICON_PAIRS` (one pair per placement),
and `Section`'s `decorative` prop changed from a plain string to a real
config object (`DecorativeSide`, `{ side, icons, photo? }`, or a tuple of
two for the hero) so each call site can specify its own pair instead of
everything defaulting to the same hardcoded set.

**Big CNC photo hexagon.** New `HexPhoto` (inside `SectionDecoration.tsx`)
— a real photo (`inne.jpg`, the CNC-machine category photo; `material-dab.jpg`
elsewhere) clipped to the same pointy-top hexagon shape via CSS
`clip-path`, muted with opacity + grayscale so it stays a background
accent. One in the hero, one in Kategorie — kept to 2 sitewide, not
"some" meaning "many," to stay restrained. Reuses already-fetched
photos, no new sourcing.

**Reach further into the page.** `CLUSTER_WIDTH` 260 -> 420, hex content
re-authored to span roughly local x 270-420 instead of 170-260 (further
from the true edge, deeper into the section), and the fade mask's opaque
zone extended (`black 38%` / `transparent 90%`, was `25%`/`80%`) so the
pattern doesn't vanish almost immediately.

**Blog images.** The 4 seeded posts (§9p) gained real `imageUrl`s —
reused category/material photos (`material-dab.jpg`, `inne.jpg`,
`gres.jpg`, `obrazy-drewniane.jpg`), each matched to its post's real
topic. `seedBlogPosts()`'s `update` clause now re-asserts `imageUrl` so
an existing dev database gets it repaired on the next `db:seed`, not
stuck imageless. All 3 blog surfaces (`/blog`, `/blog/[slug]`, and the
homepage teaser) now render the image.

### One more real responsive bug, same class as before

The new `HexPhoto` div wasn't given the `.hex-extra` class, so the
`@media (max-width: 899px) { .hex-extra { display: none } }` rule in
`theme-vars.css` never applied to it — the small icon/outline hexagons
correctly thinned out at tablet width, but the big CNC photo kept
showing. Fixed by adding `className="hex-extra"` to the photo wrapper
(it's a plain CSS class, applies to a `<div>` exactly the same as the
`<g>` it was written for). Caught the same way as §9p's two bugs: by
actually resizing to 800px and looking, not by any type-check.

### Verified

`npm test` (373/373, unchanged), `npm run typecheck`, `npm run lint`,
`npm run build`, `npm run e2e` (6/6, both browser projects) all pass.
Browser-verified at desktop (1401px), tablet (800px), and mobile (400px):
8 distinct icons visible across the 4 placements with no repeats, both
CNC/material photo hexagons render clipped and muted, the pattern
visibly extends further into the page without touching real text, the
photo hexagon (not just the small icon tiles) correctly disappears at
tablet width, and all 3 blog surfaces show the right image per post.

## 9r. Orbit animation moved to the footer, real multi-orbit rings, a hero hex mosaic — 2026-08-26

Same-day follow-up to §9q: the owner pointed at the hero's orbiting-icon
graphic by its exact DOM path and asked to move it under the footer, said
all the icons were animating on one single orbit (just spread around it)
and wanted real separate orbits, asked for hexes with real, on-brand
images in the hero instead of the animation ("engraved drawings... match
the design style"), and asked for more hexes generally.

**Real multi-orbit rings.** `OrbitIconHero.tsx`'s `ORBITERS` all shared
one hardcoded `RADIUS_PX`, spread only by angle — genuinely one orbit,
not several. Rewritten with `RING_RADII = [90, 130, 170]` and each
orbiter assigned a ring (2–3 per ring, 8 icons total now, all 8 real
icons from `SectionDecoration.tsx`'s set), with the static decorative
circles resized to match those exact radii — previously the drawn rings
and the orbit radius were unrelated numbers (130 vs 120/160/200), so
icons never actually traveled on the drawn paths. Inner rings spin
faster than outer ones. The whole layout is authored once at 360px and
uniformly scaled via a new `size` prop, so the footer's smaller instance
didn't need every radius re-tuned by hand.

**Moved to the footer.** `Footer.tsx`'s first column now renders
`<OrbitIconHero size={180} />` below the tagline/description — placed
inside the existing column rather than restructuring the footer's grid,
verified at desktop/tablet/mobile with no overflow.

**Hero hex mosaic, replacing the animation in the hero.** New
`HeroHexMosaic.tsx` — 3 real photos clipped to hexagons via CSS
`clip-path`, chosen specifically because they show actual visible
engraving/carving rather than a generic material or machine shot:
`obrazy-drewniane.jpg` (a real carved wood-art piece, the centerpiece),
`loft.jpg` (the stool's engraved top), `amulety-i-bransoletki.jpg` (an
engraved wood bracelet) — all three already used elsewhere on the site,
no new sourcing. Considered using the generated `wzor-podstawowy.svg`
design placeholder too, but opened the file first and found it's a
literal "podgląd wzoru w przygotowaniu" (preview in preparation) text
graphic, not actual engraved artwork — using it would have shown
placeholder text inside a decorative hex, so it was left out. Much
higher opacity (0.92–0.96) and far less grayscale (0–5%) than the
subtle edge-decoration hexagons, since this is the hero's primary visual
now, not a background accent. `Hexagon`/`HexPhoto`/`hexPoints` exported
from `SectionDecoration.tsx` for reuse rather than duplicated.

**More hexes overall.** 3 more outline hexagons added to
`SectionDecoration.tsx`'s shared set, and the homepage's blog section
(previously left undecorated for restraint) now carries its own edge
accent too (`ICON_PAIRS.blog`, reusing `produkty`'s icon pair — 8 icons
across 5 placements means one repeat is unavoidable, spaced far enough
apart on the page not to read as repetitive).

### Verified

`npm test` (373/373, unchanged), `npm run typecheck`, `npm run lint`,
`npm run build`, `npm run e2e` (6/6, both browser projects — the first
attempt hit the same stale-port `webServer` timeout as §9o; a bare retry
passed clean, no code investigation needed, matching the documented
pattern) all pass. Browser-verified at desktop, tablet (700px), and
mobile (400px): the hero shows the 3 engraved-photo hexagons plus icon/
outline accents instead of the animation, the footer's first column
shows the orbit graphic (rings + 8 icons across 3 visibly different
radii) correctly sized with no overflow at any width, and the blog
section's new edge accent renders without crowding the post cards.

## 9s. Fifth design pass: diverse engraved-art hexes, honeycomb hero mosaic, footer orbit column — 2026-08-26

Same thread, next round. Three asks: (1) the hex decorations repeated the
same 4 icons everywhere — needed real variety; (2) a bigger, more
prominent hex visual "so the page looks more pro"; (3) hex/blog imagery
shouldn't duplicate the real photos already used for categories/products.

**Original engraved-line-art illustrations** — new
`src/ui/primitives/engravings.tsx`, 5 hand-authored inline-SVG motifs
(`BotanicalEngraving`, `GeometricEngraving`, `WaveGrainEngraving`,
`CompassEngraving`, `LeafSprigEngraving`), `stroke="currentColor"` so
they tint via the parent's CSS `color`, same convention as
`src/ui/icons`. These fully replace real photos in every hex decoration
— a photo here would always duplicate one already on a category tile,
product card, or blog post (all 7 sourced stock photos are already
spread across those three surfaces), which is exactly the repetition
the owner flagged. `SectionDecoration.tsx`'s `photo?: string` prop
became `engraving?: EngravingComponent`; `ICON_PAIRS` extended to 5
placements (added `blog`), each section now gets its own icon pair +
engraving so nothing repeats within one viewport.

**`HeroHexMosaic.tsx` rewritten** — not several independent small hex
tiles (each with its own image) but one real honeycomb tessellation: 10
adjacent pointy-top hex cells (SVG `<clipPath>` = the union of all 10
polygons) with visible gaps between them, collectively revealing ONE
illustration (`BotanicalEngraving`) — the "look like one big hex made of
many small hexes, margins between hexes are fine" the owner asked for,
confirmed correct via `AskUserQuestion` before building it.

**`OrbitIconHero.tsx` reworked** — the owner said every icon was
animating on one single orbit; now 3 genuinely distinct rings
(`RING_RADII = [90, 130, 170]`, inner spinning faster than outer), 8
icons distributed across them, radii lined up with the static decorative
rings so icons visibly travel ON the drawn paths. Moved out of the hero
entirely into the footer, per the owner's explicit request — replaced in
the hero by `HeroHexMosaic`.

**Footer restructured** — the orbit animation is its own 4th grid column
(`.footer-orbit-column`, hidden below 980px so it never competes with
the 3 real content columns on narrower viewports), not nested inside the
brand column as a first pass had it — the owner explicitly asked for
this to be "a separate div... like the [other] divs," confirmed via
`AskUserQuestion` before moving it.

### A real bug found, chased down the wrong path first, then found the real one

An attempt to let `HeroHexMosaic` bleed past the hero section's bottom
edge (`Section.tsx`'s `overflow: hidden` split into `overflowX: hidden` /
`overflowY: visible`, plus an oversized absolutely-positioned SVG)
reproduced a real, serious bug: the entire page collapsed to a narrow
column at some viewport heights (1401×1000 broken, 1401×800 fine) — and,
misleadingly, reproduced identically on `/blog`, a page using none of the
new code, which briefly pointed at a viewport-height threshold in the
browser tool rather than the actual cause. Reverted the overflow-bleed
attempt (back to the original safe `overflow: hidden`) and simplified
`HeroHexMosaic` to a normal, fully-contained block element — and only
then, with `read_console_messages`, found the *real* bug: the reverted
mosaic still had a stray `height="auto"` XML attribute on an `<svg>` —
valid for CSS `height`, **not** valid for the SVG presentation attribute,
which threw `Error: <svg> attribute height: Expected length, "auto"` on
every render. Removing the attribute (an `<svg>` with a `viewBox` and
only `width` set already sizes its height from the aspect ratio — no
attribute needed) fixed it outright; the earlier "page collapses at tall
viewports" symptom was very likely React error-boundary/hydration
fallout from that one bad attribute, not a CSS layout bug at all. Real
lesson: read the console before trusting a screenshot-only diagnosis,
especially when a symptom "reproduces" somewhere it structurally
shouldn't be able to.

### Explicitly NOT done yet — real, deferred work

The owner separately asked for the mosaic's illustration to be a **real
photo** (not the generated SVG art) that **moves independently behind
the hexes on scroll** — genuine scroll-linked parallax. Not built:
real parallax needs either `background-attachment: fixed` (rejected
project-wide already, see `theme-vars.css` — mobile-Safari scroll-jank,
and this project tests on mobile-safari in e2e) or a scroll-position
listener, which would be this codebase's first client-side JS for a
purely decorative element — a real architectural decision, not a quick
addition, and not the version the owner already reviewed via
`AskUserQuestion` (a static honeycomb of one engraved illustration).
Needs its own design pass before implementation.

### Verified

`npm test` (373/373), `npm run typecheck`, `npm run lint`, `npm run
build` all pass. Browser-verified at several realistic desktop
viewports — the honeycomb mosaic, diverse icons per section, the
footer's 4th orbit column, and the wave-grain/compass/leaf-sprig
engravings on kategorie/produkty/blog all render correctly with no
console errors.

## 9t. Dev-time `EADDRINUSE` on the Postgres pool — diagnosed and mitigated — 2026-08-26

The owner pasted a runtime error: `PrismaClientKnownRequestError` from
`listActiveCategories()` wrapping `connect EADDRINUSE 127.0.0.1:5433`,
plus asked to analyze it and add tests to cover it if warranted.

**Diagnosis.** `docker ps` showed the one `cnc_selling_db` container
healthy, so the database itself was fine. `netstat -ano` told the real
story: ~2,100 sockets in `TIME_WAIT` on `127.0.0.1:5433` alone. Cause:
`src/server/db/client.ts` passed `PrismaPg` nothing but a
`connectionString`, so the underlying `pg.Pool` ran on its library
defaults — `max: 10`, `idleTimeoutMillis: 10_000`. In a real dev session,
where requests land more than 10s apart far more often than not, that
10s idle timeout means the pool closes and reopens a connection almost
every time — thousands of connect/close cycles across a day. Each closed
connection sits in `TIME_WAIT` for several minutes on Windows; enough of
them piling up against one fixed destination is what finally made a
later `connect()` fail with `EADDRINUSE`. (Checked and ruled out a
smaller cause: Windows' dyndev port range here is the full 49152–65535,
16384 ports, with only ~600 administratively excluded — not itself tight
enough to explain this without the churn.) The globalThis-cached
singleton pattern in `client.ts` (module comment, unchanged) is correct
and not implicated — this isn't multiple pools, it's one pool cycling
too fast.

**Fix.** New `src/server/db/pool-config.ts` — two named constants,
`DB_POOL_MAX_CONNECTIONS = 5` and `DB_POOL_IDLE_TIMEOUT_MS = 60_000`,
pulled out of `client.ts` specifically so they're importable without
touching Prisma/`pg` at all. `client.ts` now passes both into `PrismaPg`
alongside `connectionString`. A smaller pool and a 6x longer idle timeout
cut the connect/close rate substantially without adding latency this
app would notice.

**Tests.** The existing `vitest.config.ts` scope is explicit — "Domain
tests are pure: no DB, no network, no framework" — and this bug is a
live OS-level socket-exhaustion condition, not something a unit test can
reproduce or would want to (importing the real `client.ts` pulls in
`@prisma/adapter-pg` and the generated Prisma client, exactly the
"framework" dependency that file excludes). So no test asserts the
EADDRINUSE symptom itself. What *is* testable and pure: the tuning
values don't regress back toward `pg`'s churn-prone defaults. New
`tests/unit/db-pool-config.test.ts` imports only the two constants from
`pool-config.ts` — no DB, no network, no framework — and asserts the
idle timeout stays well above `pg`'s 10s default and the pool stays
small. It won't catch a future EADDRINUSE by itself, but it will catch
someone quietly reverting this fix.

### Verified

`npm test` (375/375 — 373 prior + 2 new), `npm run typecheck`, `npm run
lint` all pass. No dev server was running at the time (confirmed via
`Get-CimInstance Win32_Process` — nothing matching `next dev`/
`next-server`), so this pass was diagnosis + a config fix, not something
to re-verify against a live browser session; the `TIME_WAIT` backlog
itself will drain on its own once nothing keeps reopening connections
against it; a `docker restart cnc_selling_db` (or just leaving the dev
server stopped for a few minutes) clears it immediately if the owner
hits the error again before it does.

## 9u. The real cause of the `EADDRINUSE` — §9t's fix was real but addressed the wrong layer — 2026-08-26

The owner restarted Docker Desktop entirely (fresh container, "Up 47
seconds") and asked to continue. Re-running `npm run build` reproduced
`EADDRINUSE` immediately — on a completely clean container, seconds
after restart, which ruled out "stale backlog from before the restart"
and meant §9t's pool-size/idle-timeout tuning had not actually fixed
the underlying problem, just made it a bit slower to trigger.

**Diagnosis.** Added a temporary `console.error` in `createClient()`
and re-ran the build: it fired exactly 8 times (one per build worker,
as expected — the module-scoped singleton is not the problem). But
`netstat` after one failed build showed 2,122 sockets in `TIME_WAIT`
against `127.0.0.1:5433` — two orders of magnitude more than 8 pools ×
`max: 5` could ever produce if each pool's connections were actually
being reused. Read `node_modules/@prisma/adapter-pg/dist/index.js`
directly (its `.d.ts` doesn't show this): `PrismaPgAdapterFactory`'s
constructor branches on the *type* of its first argument —

```js
if (poolOrConfig instanceof pg.Pool) {
  this.externalPool = poolOrConfig;   // reused across every connect()
} else {
  this.externalPool = null;           // config object OR connection string
}
// ...
async connect() {
  const client = this.externalPool ?? new pg.Pool(this.config); // fresh pool!
  return new PrismaPgAdapter(client, this.options, async () => {
    if (this.externalPool) { /* kept alive unless disposeExternalPool */ }
    else { await client.end(); }      // torn down completely
  });
}
```

`client.ts` was calling `new PrismaPg({ connectionString, max,
idleTimeoutMillis })` — a **config object**, not a `pg.Pool` instance.
So `externalPool` was always `null`, and every single `.connect()` call
(Prisma calls this far more than once per process — effectively once
per logical operation) spun up a **brand-new `pg.Pool`** with its own up
to `max` physical connections, then fully tore it down again via
`pool.end()` on dispose. §9t's `max`/`idleTimeoutMillis` tuning was real
and not wrong, but it was tuning the settings of pools that were being
destroyed almost as fast as they were created — the size/timeout of a
pool that lives for one query barely matters.

**Fix.** `client.ts` now constructs a `pg.Pool` itself (`new Pool({
connectionString, max, idleTimeoutMillis })`, using the same
`pool-config.ts` constants from §9t) and passes that **instance** to
`new PrismaPg(pool)`. With a real `pg.Pool` instance, the factory stores
it as `externalPool` and every `connect()` call reuses the same pool —
one genuine, long-lived pool per process (matching the existing
module-scope-singleton comment's actual intent), not one per operation.

**Tests.** No new automated regression test for this specific fix.
Reasoning: proving it requires either (a) a live DB + socket-level
inspection (`netstat`), which is exactly the "no DB, no network, no
framework" scope `vitest.config.ts` rules out for this test suite, or
(b) mocking `@prisma/adapter-pg`'s internals well enough to assert
`PrismaPg` was constructed with `expect(arg).toBeInstanceOf(Pool)` —
possible, but it would test that *this file* calls the constructor
correctly, not that doing so actually prevents the bug (that requires
trusting the adapter's internals, which is exactly what got missed
before). If this regresses, it will most likely show up the same way it
did this time: `npm run build` failing with `EADDRINUSE`, not a passing
test suite hiding a broken assumption. `tests/unit/db-pool-config.test.ts`
still guards the pool-size/idle-timeout constants from §9t, which remain
correct and worth keeping even though they weren't the root cause.

### Verified

`npm run build` completed. `npm test` (375/375), `npm run typecheck`,
`npm run lint` all pass. Build-time `EADDRINUSE` reproduction was
blocked by leftover `TIME_WAIT` backlog from the pre-fix build attempts
(Windows holds these for several minutes regardless of the Docker
container restarting — that's client-side OS state, not something the
container's restart touches); see the note below on how that was
confirmed to drain before the fix could be verified against a clean
build.

## 9v. Hero mosaic, round three: real hexagon geometry, a bigger cluster, a real video loop, and a themed scrollbar — 2026-08-26

Same day, later — the owner looked at the shipped §9s/§9u hero mosaic and pushed back on three things, then two follow-ups after that.

**Round 1 — hex shape, movement proof, scrollbar.** "hex shape not honeycomb shape... I don't mean to tighten the spacing but about the shape the hexes creates." Diagnosed: the 14-cell 2-3-4-3-2 taper from §9s wasn't a valid hex-of-hexagons ring pattern at all — only "radius N" sizes (row `r` holds `2N+1-|r|` cells) actually tile into a hexagon silhouette. Rewrote `HeroHexMosaic.tsx`'s `CELLS` as a true radius-2 hexagon (rows 3-4-5-4-3, 19 cells) computed from real axial hex coordinates instead of hand-picked offsets.

Also re-litigated the parallax mechanism from §9s: `animation-timeline: view()` was correctly attached (`element.getAnimations()` showed a running effect with real progress), but its `currentTime` never advanced under this project's browser-automation tooling across repeated tests — programmatic `scrollTo` and simulated wheel scroll both left it frozen. Rather than ship an effect that couldn't be verified, replaced it with a small `requestAnimationFrame`-throttled scroll listener (`getBoundingClientRect()` → 0–1 transit progress → `translateY` in px) — this codebase's first client-side JS for a purely decorative element, a deliberate, documented exception. Directly verified moving: `translateY` measured at three different scroll positions, three different values.

Also added sitewide scrollbar theming to `theme-vars.css`: `scrollbar-color`/`scrollbar-width` for Firefox, `::-webkit-scrollbar*` for Chromium/WebKit (including mobile Safari), matching the warm cream/brown palette instead of the OS-default grey.

**Round 2 — real gap, real size.** The owner pasted the classic `background-attachment: fixed` snippet asking if it would help; declined — already rejected project-wide for mobile-Safari scroll-jank (see `theme-vars.css`'s own comment), and it doesn't fit a photo fragmented across many SVG hex clips anyway. Two real bugs instead: (1) the 19-cell layout drew each hexagon at the *same* radius used to space their centers — `sqrt(3) * r` is exactly the touching distance for two same-radius pointy-top hexagons, so there was no gap at all. Fixed by splitting `SPACING_R` (centers) from a smaller `CLIP_R` (drawn shape). (2) grew the cluster from radius 2 (19 cells) to radius 3 (37 cells) and the container from 520px to 700px so it reads as a real hero visual against the heading/subcopy/button column, not a small accent — also widened the hero grid's column ratio from `1fr 1fr` to `1fr 1.3fr` (`(marketing)/page.tsx`) so the bigger mosaic has room without starving the text column. Verified: mosaic height now ~79% of the text block's height (577px vs 729px at 1400px viewport), up from ~65% before.

**Round 3 — a real video.** The owner asked for the static photo to become a short video of the actual carving process, "keeping image properties" (same clipping/parallax). No video asset existed in the repo; asked whether they had one rather than guessing or fetching one unprompted. They provided three options — a Pexels URL, a downloaded 116MB 2160×4096 25fps MP4, and a 55MB GIF export — with a stated preference for the GIF "if better." Overrode that preference: a 55MB GIF would be a serious page-weight regression this project's Lighthouse-driven discipline wouldn't accept, and H.264 video is strictly better for a looping clip like this at any size. Re-encoded the MP4 with ffmpeg instead — cropped to the mosaic's exact aspect ratio, scaled to 960×846, 24fps, a 6s loop, H.264/yuv420p, no audio — landed at 523KB (`public/videos/hero-carving.mp4`).

Swapping `<image>` for `<video>` inside the existing SVG needed `<foreignObject>` (SVG has no native video element) — everything else (the clip-path `<g>`, the oversize-for-parallax x/y/width/height, the scroll handler's `getBoundingClientRect()`/`style.transform`) carried over unchanged, since a `<video>` behaves like any other HTML element once inside a foreignObject. `autoPlay muted loop playsInline` for autoplay-policy compliance.

**A tooling gotcha worth remembering:** after the rename `imageRef` → `videoRef`, the browser tab kept reporting `ReferenceError: imageRef is not defined` from a stale Turbopack HMR chunk — persisted identically across a `.next` cache clear *and* a full dev-server restart, because the error was actually stale console-log history from the reused browser tab, not a live error (confirmed by opening a brand-new tab, which showed zero errors against the same running server). If a console error looks impossible to reproduce given the current file contents, check whether it's stale tab history before assuming a real regression — `grep` the file for the referenced symbol first.

### Verified

`npm test` (375/375), `npm run typecheck`, `npm run lint`, `npm run build` all pass after every round. Live-verified in-browser: 37 hex cells with visible gaps forming a real hexagon silhouette; the scroll parallax `translateY` changing across multiple real scroll positions (not just attached-but-frozen); the video loop actually playing (`currentTime` advancing, `paused: false` after an explicit tab focus) and clipped correctly through the hex mosaic; the themed scrollbar's computed `scrollbar-color` resolving to the theme's actual hex values.

## 9w. P4 — upload, design review, IP consent — 2026-08-26

The next unbuilt phase in the project's own stated sequence (`docs/CHECKLIST.md` §7: P2→P3→P4→P5, with P5 explicitly allowed to jump ahead of P4). Planned via `EnterPlanMode` given the size and security sensitivity, then built as one pass: the full `ARCHITECTURE.md` §13 validation pipeline, IP consent capture, the review state machine, an authorizing file-serving route, and — per the owner's explicit scope choice (`AskUserQuestion`) — a real configurator step wired into a real product, not just exercised by tests.

### The pipeline

`src/domain/upload/inspect.ts` (pure): `maxUploadSizeBytes` (§13.1.1's size caps by MIME type), `evaluateResolution`/`evaluateAspectMismatch` (§13.1.6–7's DPI/aspect warnings, `UploadWarning[]` copying `domain/feasibility`'s `FeasibilityFinding` shape exactly), `sanitizeFilenameForDisplay`. `src/server/upload/inspect-file.ts` (the I/O half): magic-byte sniffing via `file-type` (SVG is the one format it can't sniff — detected by content instead, since it's plain text with no fixed signature), SVG sanitization via DOMPurify+jsdom, PDF inspection via `pdf-lib` + a raw-byte heuristic scan for `/JavaScript`/`/OpenAction`/`/Launch` tokens, `sharp`-based raster inspection/EXIF-stripped preview generation. `src/server/storage/local-disk.ts` implements the `FileStorage` interface (§14) against `/uploads-dev/` — the only implementation this pass ships, same "interface real, one honest gap" pattern as `Mailer`.

`src/server/actions/upload.ts`'s `uploadCustomDesign` and `src/server/actions/design-review.ts`'s `reuploadCustomDesign` run the pipeline, rate-limit (`src/server/upload/rate-limit.ts` — a plain `UploadedFile` count query, no new infra, since no rate-limit model/library exists anywhere in the spec), and write `UploadedFile` + `CustomerDesign` inside one transaction. `src/domain/design-review/transitions.ts` mirrors `order-status/transitions.ts`'s exact shape for `PENDING_REVIEW → APPROVED/NEEDS_CHANGES/REJECTED`. `/api/plik/[fileId]/route.ts` authorizes before touching storage, 404s (never 403s) on any failure, and forces `Content-Disposition: attachment` for SVGs specifically — defense in depth against ever rendering a customer SVG as this origin's own document, even a sanitized one.

**SVG sanitization, verified against a real hostile file** (`<script>`, an `onclick` handler, an external `<image href>`, a `javascript:` URI, `<foreignObject>`): every one stripped, harmless content survives. One side effect worth knowing, not a bug: DOMPurify's own default SVG tag allowlist doesn't include `<use>` at all — an uploaded SVG using `<use href="#local-id">` (a legitimate icon-sprite pattern) loses that element entirely. Left as-is: customer engraving artwork essentially never uses `<use>`, and widening the allowlist for it trades away margin on a rare case.

### The real security-boundary problem this pass had to solve

`next/headers`'s `cookies()`/`headers()` throw outside an actual Next.js request scope — confirmed empirically (a Vitest test calling `uploadCustomDesign` directly failed with "cookies was called outside a request scope"). This meant the Server Actions themselves, and any repository function that read cookies internally, could never be called directly from a test. Fixed by splitting every ownership check into a pure `find*` function taking `sessionToken` as an explicit parameter (genuinely callable from a test — real DB query, nothing else) and a thin `require*` wrapper that derives the token from cookies and delegates (`src/server/repositories/design-review.ts`) — the same shape `cart.ts`'s `verifyOwnedCustomDesign` already used, applied systematically. `cart.ts`'s own duplicate ownership query was replaced with a call to the new shared `findOwnedDesignId`.

### A new test tier

`tests/integration/` — `ARCHITECTURE.md` §21.1's "Integration: Vitest + real Postgres, transaction rollback per test," genuinely new (no integration tests existed before this pass). `tests/integration/env-setup.ts` (a Vitest `setupFiles` entry, global but harmless for `tests/unit`) overrides `DATABASE_URL` to `TEST_DATABASE_URL` *before* any test file's imports evaluate, so the app's own `prisma` singleton transparently points at `cnc_selling_test` — no dependency-injection refactor needed anywhere. `npm run db:deploy:test` (`scripts/migrate-test-db.mjs`) migrates it.

One real constraint discovered while building this: `withTestTransaction`'s rollback isolation only works for a test that writes and reads entirely through its own `tx` — a row written via `tx` inside a still-open transaction is invisible to the app's singleton `prisma` client (a different connection) until commit. `tests/integration/authz.test.ts` and `upload.test.ts` (which call real repository/domain functions using the singleton) commit for real instead, with every row prefixed `test-authz-`/etc. and an `afterEach` that deletes by prefix — the same "real database, explicit cleanup" pattern this project's e2e suite already uses. `tests/integration/design-review.test.ts` (pure `tx` throughout) uses real rollback.

45 new integration tests: `upload.test.ts` (16 — every case in §21.3's table: wrong magic bytes, oversize/exact-boundary, corrupted, zero-byte, hostile SVG, PDF-with-JS, each accepted type), `design-review.test.ts` (5 — every real transition, illegal ones write nothing, comment authorship), `authz.test.ts` (9 — owner/stranger/no-session/nonexistent for both `UploadedFile` and `CustomerDesign`, rate-limit threshold and per-session scoping), `setup.test.ts` (2 — guards the tier's own rollback foundation). Plus 26 new domain unit tests and a new Playwright e2e spec (`custom-upload.spec.ts`, green on both `desktop-chromium` and `mobile-safari`).

### Two real, pre-existing bugs this pass found (neither caused by P4, both blocking it)

**1. `CUSTOM` products could never actually be priced.** `price-configuration.ts`'s own header comment already documented this: `priceConfiguration` unconditionally required a catalog `Design` row, and `CUSTOM` (customer upload, no `DESIGN` step) never has one — `selections.designId` stays `null` forever for it, so `priceAndValidateSelections`/`getConfiguratorSnapshot` never reached `'priced'`. Found by actually trying to complete a purchase, not by inspection. Asked the owner rather than guessing a fix (`AskUserQuestion`): base-price fallback, chosen — `PricingInput.design`/`FeasibilityInput.design` both widened to accept `null` through `domain/pricing/calculate.ts` and `domain/feasibility/rules.ts` (zeroing `machiningGrosze`/`designSurchargeGrosze` rather than inventing an estimate; skipping the three design-derived feasibility findings entirely, since they depend on characteristics only a human reviewing the actual upload can know — exactly what design review is for). `configurator.ts`/`validate-and-price.ts` now only treat `design === null` as "incomplete" when the product type's own step list actually includes `DESIGN` — `CUSTOM` doesn't, so `null` is its permanent, correct state. A new summary-step notice (`configuratorCustomPriceEstimatePl`) tells the customer plainly that the price shown is a starting estimate, confirmed during design review — matches `inne`'s own category description, "wycena indywidualna."

**2. The uploaded design silently never reached checkout.** `cart.ts`'s repository (`findCartForRequest`) reconstructs `Selections` from a stored `Configuration` row for re-pricing — its own comment already flagged this: `customUploadId: null,` hardcoded, "Both null until P4's upload pipeline exists." P4 arrived and this line was never revisited. Symptom, found by actually completing a purchase: checkout re-priced with `customUploadId` missing → `CUSTOM_UPLOAD` step read as unsatisfied → `checkConfigurationComplete` failed → `priceAndValidateSelections` returned `null` → real `PRICE_CHANGED` rejection, even though nothing had actually changed. One-line fix: `customUploadId: configuration.customDesignId`.

**3. (Not a P4-caused bug, but found and fixed the same way — actually a gap in P4 itself.)** Next.js's Server Action body size defaults to 1MB, well under this pipeline's own real 25MB/5MB caps. Every test upload used during manual verification happened to be under 1MB, so this was never caught until a deliberate ~2MB synthetic file was pushed through the real UI and produced a real `UNSUPPORTED_TYPE` response from the pipeline (proving the request reached it) rather than a framework-level failure. Fixed via `next.config.ts`'s `experimental.serverActions.bodySizeLimit: '26mb'`. Without this, every upload feature here would have looked completely correct in code review and unit tests while silently rejecting most real customer photos.

### The real end-to-end proof

Seeded one real product, `wlasny-projekt-z-grawerem` ("Własny projekt z grawerem") under `inne` — that category was originally left empty (2026-08-24, "nothing concrete to describe in a catch-all yet"), and its own Polish description already promised exactly this ("Projekty nietypowe... wycena indywidualna"); P4 is what makes that description true rather than aspirational. `CUSTOM`'s step list has no `DESIGN` step, so this is the one seeded product with no `seedProductDesign` call.

Live-verified via the real dev server, not just tests: uploaded a real JPEG (via a `DataTransfer`-constructed `File` + dispatched `change`/`focusout` events — MUI's `onBlur` listens for the native `focusout` event specifically, not `blur`, which doesn't bubble; a synthetic plain `blur` event silently did nothing until switched), confirmed the real `UploadedFile`/`CustomerDesign` rows and the two files on disk (`uploads-dev/`), walked all 6 configurator steps, watched a real price compute (`246,25 zł`, base + material + finish, no machining/surcharge), added to cart, completed checkout, and confirmed the resulting order (`2026/08/0021`) **automatically landed in `DESIGN_REVIEW`** — a gate that has existed since P5 but had never once been exercised by a real `CustomerDesign` until this pass. Also verified directly: `/api/plik/[fileId]` returns 200 for the owning session, 404 for no session, 404 for a nonexistent id.

### Explicitly deferred, not built here

A staff review UI (approve/request-changes/reject) — `P7a`, not started; no admin auth/role model exists until P6 either, and building an "approve" button without real authentication behind it would be exactly the fake-functionality pattern this project's rules forbid. `reuploadCustomDesign` is real, tested, and callable, but has no UI — that event happens on an order already past checkout, which needs an order-tracking page (P6 account features) to host it; same "prepared, not wired" precedent as the Yato-yane joinery module. PDF rasterized previews (`pdf-lib` can't rasterize; a full render pipeline is a materially bigger dependency). Crop-preview UI for aspect-mismatch warnings (the warning exists; nothing in the real flow reaches a state that needs the preview yet, since `CUSTOM_UPLOAD` precedes `SIZE`).

### Verified

`npm test` (446/446 — 375 prior + 26 new domain unit + 45 new integration), `npm run typecheck`, `npm run lint`, `npm run build` all clean. `npm run e2e`: 8/9 green; the one failure (`shell.spec.ts`, unrelated to any file this pass touched) confirmed as pre-existing 4-worker parallel-load flakiness — passes reliably in isolation, fails reliably under the full 4-worker batch, with real `[WebServer] Error: The destination stream closed early` server-side errors accompanying it (resource contention against one shared server, not a client-side logic bug).

## 9x. P6 — Accounts & polish — 2026-08-26

The next phase in the project's own stated sequence. The owner asked for the full P6 scope in one pass via `AskUserQuestion` ("all from auth foundation + order history and everything in one pass"), after choosing Better Auth over the brief's literal Auth.js/NextAuth v5 (still beta, `5.0.0-beta.32`, no stable release, `@auth/prisma-adapter`'s peer range not declaring Prisma 7 support — verified via direct `npm view`, not assumed) and confirming Better Auth's own `prismaAdapter` operates at the Prisma **Client** query-API level, never touching the `PrismaPg` driver-adapter layer that caused §9u's `EADDRINUSE` bug — read directly from `node_modules/@better-auth/prisma-adapter`'s type definitions, not guessed.

### The migration

`prisma/migrate dev` cannot be used in this project (§9u/this section's own lesson, reconfirmed): it wanted to drop `OrderNumberCounter` — a real, deliberately Prisma-unmanaged table with live data, created via raw SQL, no `model` block — because its own auto-diff only sees the schema file. Hand-authored `prisma/migrations/20260826000000_better_auth_schema/migration.sql` instead: drops the old Auth.js-shaped `Account`/`Session`/`VerificationToken` (no real rows existed in any of them — nothing used auth before this), alters `User.name`/`emailVerified` to Better Auth's required non-null shapes, creates `Account`/`Session`/`Verification` matching Better Auth's exact expected schema (read directly from `node_modules/@better-auth/core/dist/db/schema/*.d.mts`'s zod schemas, not copied from NextAuth's different field-naming convention). Applied via `prisma migrate deploy` to both the dev and test databases — the second one is easy to forget and caused an actual test failure (`invalid input syntax for type timestamp: "false"`) until `npm run db:deploy:test` was run.

### The real architectural work: extending ownership from `sessionToken`-only to `userId` **or** `sessionToken`

§16.1 always said ownership requires "`userId` match **or** matching guest `sessionToken`" — before P6, `userId` was always `null` in practice (no accounts existed), so every check was silently `sessionToken`-only. `src/server/session/ownership.ts` is the new shared piece: an `Owner = {userId, sessionToken}` type, `ownerOrClauses`/`hasNoOwner` helpers, and `currentOwner()` (reads both a real Better Auth session and the guest cookie — kept alive across login on purpose, so a file uploaded before logging in stays reachable after). Every `find*`/`require*` ownership check in `design-review.ts` was changed from taking `sessionToken: string | null` to taking an `Owner`; `cart.ts`'s `requireOwnedCartItem`/`requireOwnedConfiguration`/`addToCart`/`updateCartItemConfiguration` all became owner-aware — a logged-in customer's `Cart` is now keyed by `Cart.userId` (`@unique`), not the guest cookie, with `Configuration` rows stamped with both `userId` and `sessionToken` for continuity. `upload.ts`/`design-review.ts`'s actions now stamp `userId` onto `UploadedFile`/`CustomerDesign` too. This was the single largest piece of P6 — without it, a logged-in customer's "add to cart" would have silently kept creating orphaned guest carts under the `gsid` cookie forever, defeating the entire point of accounts.

`mergeGuestCartIntoUser` (`src/server/cart/merge-guest-cart.ts`) runs once, right after a successful login/register/OTP sign-in: if the user has no `Cart` yet, the guest cart's row is reassigned (`sessionToken: null, userId`); if they already have one, every guest `CartItem` is moved onto it and the now-empty guest cart is deleted. Both branches run inside one `$transaction`.

### A real bug found live in the browser, not by code review

Every `catch (error) { if (error instanceof APIError) { return {formError: 'X'} } }` block in `src/server/actions/auth.ts` originally mapped **any** `APIError` straight to the one code that call site expected — so a registration that failed for a reason OTHER than a duplicate email (verified directly: it wasn't one — the DB had no such row) still displayed "Konto z tym adresem e-mail już istnieje." Root cause: reusing a stray dev-server process left over from earlier in the session, whose Better Auth instance had a subtly different state. Fixed properly regardless: `mapAuthError` now checks the real `error.body?.code` Better Auth returns (`'INVALID_EMAIL_OR_PASSWORD'`, `'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL'`, `'INVALID_OTP'`/`'OTP_EXPIRED'` — read from `node_modules/better-auth/dist/api/routes/*.mjs` directly) against the ONE code the call site actually expects, logging anything else instead of silently mislabeling it. A plausible-looking wrong error message is exactly the kind of bug code review alone doesn't catch — this one only surfaced by actually registering an account with a definitely-fresh email and getting a nonsensical result.

### A real, reproducible Playwright/hydration finding (not a product bug)

`LoginForm`/`RegisterForm`/`CheckoutForm` all use uncontrolled inputs (`defaultValue`, no `value` — required so `useActionState`'s remount-to-echo-server-state pattern, `CheckoutForm.tsx`'s own header, actually shows the echoed values). React reasserts an uncontrolled input's SSR'd `defaultValue` once hydration finishes on that component — confirmed directly with a throwaway debug spec: `.fill()` immediately after `page.goto('/rejestracja')` left the field empty every time, while the identical fill after a 1-second wait, or via real `keyboard.type`, did not. A fixed `waitForTimeout` was tried first in `tests/e2e/accounts.spec.ts` and was NOT reliable (still flaked once under `--repeat-each` on `mobile-safari`, where WebKit's slower JS start gives the race a wider window — the same class of pre-existing flakiness §9w's own "Verified" section already documented for a different spec). The actually deterministic fix: `fillReliably`/`checkReliably` helpers built on `expect(...).toPass()` — fill via `pressSequentially` (real keyboard events over time, not an instant CDP value-set), verify the value stuck, retry the whole thing until it does. Verified stable with `--repeat-each=3` on both browsers. `tests/e2e/custom-upload.spec.ts` hit the same underlying race independently during this session's own regression runs (pre-existing, not caused by this pass) — flagged as a follow-up task rather than fixed inline, since it's outside P6's own file scope.

### Parts D/E/F

**D (mailer):** `Mailer.send` widened from one hardcoded template to `send<T extends MailTemplate>(template: T, to, data: MailDataFor<T>)` — a real interface change (wrong data shape for a template is a compile error), not just a widened literal. `ResendMailer` calls Resend's HTTP API directly (one JSON POST, no SDK dependency) when `RESEND_API_KEY`/`EMAIL_FROM` are set; `UnconfiguredMailer` otherwise, same safe-fallback contract as before. Better Auth's `emailOTP` plugin's `sendVerificationOTP` callback calls it.

**E (RODO/legal):** `src/content/pl/legal.ts` — real, structurally-correct Regulamin/Polityka prywatności content (§1-8 terms structure; RODO administrator/cele/podstawy/okres/prawa/cookies sections), replacing the "w przygotowaniu" stub both pages carried since P0. Business-identity fields (name, address, NIP, contact email) are explicit `[DO UZUPEŁNIENIA: ...]` placeholders, not invented — same `TODO_PRICING` honesty this project already applies elsewhere; a real lawyer review is still needed before launch. A first-party `consent` cookie (deliberately a third, separate mechanism from `gsid` and Better Auth's session cookie) gates 4 of the brief's 13 named analytics events — the ones with a natural server-side trigger (`product_view`, `add_to_cart`, `checkout_started`, `purchase`); the rest fire from client-side configurator state and need a client-to-server event channel this pass didn't build. Verified live: the banner shows once, disappears and stays gone after a choice, and a real `AnalyticsEvent` row only appears in Postgres after clicking "Akceptuję."

**F (polish):** `loading.tsx` at the 7 segments with a real fetch and no closer ancestor boundary; a root `error.tsx` using Next.js 16.3's `retry` prop (not the older `reset` — checked `node_modules/next/dist/docs`'s own version-history table before writing this, per this repo's `AGENTS.md`) and §20's exact copy with `error.digest` as the correlation id. Order-history and saved-configuration empty states are new and real; cart and search already had honest ones from earlier phases.

### Verified

`npm test` (453/453 — 446 prior + 7 new integration), `npm run typecheck`, `npm run lint`, `npm run build` all clean. Live-verified in the browser: register → real session cookie → header shows "Moje konto" → order history/saved-configs empty states → logout → login with password → wrong-password shows the correct (now-fixed) error → consent banner → legal pages → a real `product_view` `AnalyticsEvent` row post-consent. `npx playwright test` (both browsers): 12/12 green in isolation/serial; the full suite showed the same "passes serially, flakes somewhat under full parallel load against one shared dev server" pattern §9w already documented — not a regression, reconfirmed by running `checkout.spec.ts` alone (passed) immediately after it failed in the parallel batch.

## 9y. P7a — Admin panel operational minimum — 2026-08-27

`docs/CHECKLIST.md`'s own P7 is explicitly split into three sub-phases, and `docs/ARCHITECTURE.md` §16A.6 plus decision D2b are explicit the shop launches on **P7a alone** ("Launch on P7a. Taking real orders while the rest of the panel is built is how you find out what the panel actually needs") — not the full P7 scope in one pass, unlike P6. This pass built exactly P7a: role gating, an audit log that actually gets written to, staff order management, and the design-review queue. P7b (catalogue/designs/materials/customers-RODO/content/production-queue/settings CRUD) and P7c (`@mui/x-data-grid` adoption, dashboards, global search, bulk actions, CSV, print views — none of it buildable without that package, which isn't installed) are deliberately not started.

### What P6 had already half-built

`AuditLog` (the model) and `User.role`/`SEED_ADMIN_EMAIL` seeding both existed before this pass — the model was defined but nothing ever wrote to it, and nothing ever read `role` for an authorization decision. The entire order-status state machine (`domain/order-status/transitions.ts` — legal edges, per-edge actor permissions, the DESIGN_REVIEW gate) also already existed from P5, fully built and (per its own module) already tested; this pass is the first thing that actually calls it from a staff-facing surface. None of that was rebuilt — `checkOrderStatusTransition` is called as-is.

### `middleware.ts` doesn't exist in this Next.js version

Checked `node_modules/next/dist/docs` before writing it, per this repo's own `AGENTS.md` rule, and it's a good thing: Next.js 16 renamed `middleware.ts` to `proxy.ts` (`export function proxy`, not `middleware`) — the old name is not a deprecated-but-working alias, it does nothing at all. `src/proxy.ts` matches `/panel/:path*` and does only the cheap half: `better-auth/cookies`'s `getSessionCookie(request)` (existence-only, no DB read, genuinely edge-safe) redirects the unauthenticated case. The real role check — `CUSTOMER` gets a genuine 404, not a redirect, not a client-rendered fake one — lives in `src/app/(admin)/panel/layout.tsx`'s `requireStaffSession()` (`src/server/auth/session.ts`), because that needs a real DB read and proxy's own docs warn that authorization must never live only in proxy (a matcher change silently drops coverage). Both halves live-verified separately, including checking the actual HTTP status code on the 404 case (`read_network_requests` showed a genuine `404 Not Found`, not a 200 serving a not-found-looking page).

### Testability required the same `find*`/`require*`-style split P4 established

`requireStaffSession()` calls `getSession()`, which reads `next/headers` — throws outside a real request, same as every other session helper in this codebase. So `admin-orders.ts`/`admin-design-review.ts`'s Server Actions are each split: `applyOrderStatusTransition`/`applyMarkOrderPaid`/`applyDesignReviewDecision` take the staff `CurrentSession` as an explicit parameter (real DB logic, directly callable from Vitest against real Postgres), while `transitionOrderStatus`/`markOrderPaid`/`decideDesignReview` — the actual exported Server Actions the UI calls — derive it via `requireStaffSession()` and delegate. First attempt at this also called `revalidatePath` inside the pure half, which fails the same way outside a request (`Invariant: static generation store missing in revalidatePath`) — moved to the outer wrapper, only on success.

### The order-status graph has no cycles

Worth stating plainly since the checklist's own wording ("mandatory note on backwards moves") implies a graph with backward edges, and this one doesn't have any — every edge in `transitions.ts` either moves forward or to the terminal `CANCELLED`. So "backwards" concretely means exactly that one edge; `applyOrderStatusTransition` requires a non-empty `notePl` only when `toStatus === 'CANCELLED'`, and the UI only renders a note field there (optional everywhere else). The status-transition buttons themselves are computed from `checkOrderStatusTransition`'s own result, not a re-derived copy of the graph — a candidate shows as a disabled, hover-explained button (§16A.5: "explain every disabled control") specifically when the only blocker is `DESIGN_REVIEW_GATE_BLOCKED`, and doesn't show at all when the actor genuinely isn't permitted on that edge.

### The design-review queue needed a staff exception to the file-serving route

`/api/plik/[fileId]` (P4) only ever checked file ownership (`requireOwnedUploadedFile`) — a design a customer uploaded is not "owned" by the staff member reviewing it, so the original file/preview would 404 for them unchanged. Extended the route to check `getSession()` first: `STAFF`/`ADMIN` get the file unconditionally, everyone else falls through to the unchanged owner check. Still 404-not-403 throughout.

### Full MUI, deliberately, unlike the rest of this app

Every other page in this codebase avoids real `@mui/material` React components (CSS variables mirroring the theme tokens instead — `ThemeRegistry` is kept OUT of the root layout on purpose, `theme-vars.css`'s own header explains the Lighthouse/LCP cost of shipping MUI+Emotion+React to pages with no interactive MUI). The panel is the one place `docs/ARCHITECTURE.md` §16A explicitly wants "Full MUI... standard Material, dense layout, no brand theming investment" — so `src/app/(admin)/panel/layout.tsx` wraps its children in `ThemeRegistry` (same pattern the configurator island already uses locally, just applied to the whole route group), and every panel page uses real `Table`/`Button`/`TextField`/`Chip` etc.

### Verified

`npm test` (464/464 — 453 prior + 11 new integration), `npm run typecheck`, `npm run lint`, `npm run build` all clean; no schema migration needed (`AuditLog` already existed). Live-verified in the browser end to end: unauthenticated → `/panel/zamowienia` redirects to `/logowanie`; logged in as the seeded admin (`SEED_ADMIN_EMAIL`, via the existing OTP path — no password exists for that seeded row) → real order list with filters → order detail → "Oznacz jako opłacone" (confirmed in Postgres: `paymentStatus: PAID` + an `AuditLog` row) → transition to `CONFIRMED` (event timeline updated with the real staff actor and timestamp) → design-review queue → approve without a production method (rejected with a real Polish message) → approve with one (confirmed in Postgres: `status: APPROVED`, `productionMethod` set, audit row) → logged in as an existing `CUSTOMER`-role account → `/panel/zamowienia` returned a genuine `404 Not Found` (checked via `read_network_requests`, not just the rendered page).

## 9z. P7b, slice 1 — Catalogue admin (categories + products) — 2026-08-27

P7b (admin panel management CRUD) is large enough — categories, products (6 related tables), designs/collections, materials/finishes, customers/RODO, content, production queue, settings — that building it in one pass, unlike P6, would contradict §16A.6's own "vertical slices, module by module" rule the owner had already confirmed for P7a. Asked which slice to build first via `AskUserQuestion`; the owner chose catalogue (categories + products) over materials/finishes/designs, settings, or customers/RODO.

### Scope: associate, not author

This slice lets staff **associate** existing materials/designs to a product (a `ProductMaterial`/`ProductDesign` row with a price factor/surcharge) — not **create** new materials or designs from scratch. Authoring those is materials/finishes CRUD and designs/collections CRUD, each its own later P7b slice. Checked row counts before committing to this scope: all 6 of `Product`'s related tables (`ProductPresetSize`/`ProductImage`/`ProductMaterial`/`ProductThickness`/`ProductDesign`/`InstallationVariant`) are real, populated data today (6 products, one per `ProductTypeCode`) — a catalogue admin that couldn't touch them would be a partial module, not a working one, so all of them got a real editor in this pass rather than deferring the "boring" ones.

### A second, genuinely public storage adapter

Customer uploads (P4's `local-disk.ts`) are deliberately private — gated behind `/api/plik/[fileId]`, "no public bucket" per §16.1. Product/category photos are the opposite: they need to be plain, publicly loadable URLs. `src/server/storage/public-images.ts` is a new, separate adapter — writes into `public/images/{products|categories}/{ownerId}/{uuid}.{ext}`, same "dev/MVP, real disk writes, not production-grade" honesty `local-disk.ts`'s own header already carries, just for a different trust boundary. Confirmed this works for this project's actual deployment model (Docker + a long-running Node server, not a serverless/immutable-build platform) before relying on it — `next dev`/`next start` both serve `public/` straight off disk on every request, so a runtime write is genuinely picked up.

### The same `revalidatePath`-in-the-wrong-half mistake as P7a, twice more

Wrote `applyXxx(staff, ...)` (pure, testable) / `xxx(...)` (real Server Action via `requireStaffSession()`) for every mutation, same split P7a established — and made the exact same mistake P7a's handover already documented: calling `revalidatePath` inside the pure half, which fails with `Invariant: static generation store missing in revalidatePath` outside a real request, exactly like `next/headers`. Caught by the new integration tests immediately (all 12 failed identically on first run), fixed the same way — moved every `revalidatePath` call into the wrapper, only on success. Worth a second entry here specifically because it recurred despite being documented once already: the lesson is "revalidatePath belongs with requireStaffSession, always, no exceptions," not "remember to check this one file."

### Verified

`npm test` (476/476 — 464 prior + 12 new integration), `npm run typecheck`, `npm run lint`, `npm run build` all clean; no schema migration needed (every table already existed). Live-verified in the browser end to end, logged in as the seeded admin: created a real category (immediately visible in the storefront nav) → created a real product under it with a preset size, a thickness, a material compatibility row, and an uploaded photo → confirmed all of it live on the real `/produkt/[slug]` page (price, dimension envelope, material, and — confirmed via `read_network_requests`, a genuine `200 OK` on `/_next/image` — the uploaded photo itself) → deactivated the product → confirmed a real `404` on the storefront (row still present in Postgres) → confirmed an `AuditLog` row for every mutation (category create, product create, preset size, thickness, material, image, deactivate). The one thing this browser tooling can't drive is a native OS file picker, so the image-upload Server Action itself was additionally proven via a small standalone script (`tsx -r dotenv/config`, calling `applyUploadProductImage` directly with a real `File` built from an on-disk JPEG) rather than skipped.

## 9z2. P7b, slice 2 — Materials & finishes CRUD — 2026-08-27

Third P7b vertical slice. Owner picked materials/finishes over designs/collections, customers+RODO, and settings, via `AskUserQuestion`. Scope is the authoring side slice 1 deliberately left out: slice 1 could only associate an EXISTING material/design to a product; this slice is `/panel/materialy` and `/panel/wykonczenia` — real CRUD for `Material` (12 editable fields) and `Finish` (9 fields), plus the `MaterialFinish` compatibility join (a plain toggle — no extra fields on that join, unlike `ProductMaterial`'s `priceFactorBp`).

### A required-image field changes the form shape

`Category.imageUrl` is nullable; `Material.imageUrl`/`Finish.imageUrl` are not (`String`, no `?`). A create form for either can't submit a half-valid record with an empty image — so unlike `admin-categories.ts`'s plain-object `CategoryFormInput`, `admin-materials.ts`/`admin-finishes.ts`'s `createMaterial`/`updateMaterial`/`createFinish`/`updateFinish` take `FormData` directly (multipart, carries the file) and extract every field from it, same shape `admin-product-images.ts`'s `uploadProductImage` already used for the one case P7b slice 1 had a file in. Update is more lenient — the file input is optional there, falling back to the existing `imageUrl` — but create's HTML `required` attribute plus a server-side check both refuse a missing file.

### A real, previously-shipped bug found by a dev-server restart, not by code review

`<Button component={Link} href="...">` — the standard MUI-in-Next.js "styled link" pattern — is used identically on all four `/panel/*` list pages (`kategorie`, `produkty`, `materialy`, `wykonczenia`). It had worked, live-verified, on `kategorie`/`produkty` during slice 1. Restarting the dev server (routine, to rule out stale HMR before debugging something unrelated) made **all four** pages fail identically: `Error: Functions cannot be passed directly to Client Components unless you explicitly expose it by marking it with "use server"`, pointing at `component={function LinkComponent}`. Passing a Client Component **reference** as a prop VALUE from a Server Component apparently only serializes correctly by accident of stale Turbopack module-cache state in a long-running dev session (this one had been up ~13 hours across P6/P7a/both P7b slices) — a fresh compile exposes the real, always-latent break. Confirmed the fix generalizes, not just papering over the symptom: replaced all four with the standard safe form (`<Link href="..."><Button variant="contained">...</Button></Link>` — Button rendered as a plain nested child, never passed as a prop value across the boundary), re-verified all four pages load correctly after the fix. **Any future `component={ClientComponentRef}` prop usage in a Server Component in this codebase should be treated as suspect** — this pattern is not reliably RSC-safe here even though it's common advice elsewhere, and a long dev session can mask it.

### Verified

`npm test` (487/487 — 476 prior + 11 new integration), `npm run typecheck`, `npm run lint`, `npm run build` all clean; no schema migration needed. Live-verified in the browser end to end (after the dev-server restart above, which is what surfaced the `component={Link}` bug in the first place — worth restarting once mid-verification rather than trusting a long-lived dev process): created a material and a finish (the actual multipart upload was proven via a standalone script — `tsx -r dotenv/config` calling `applyCreateMaterial`/`applyCreateFinish` directly, since this browser tooling cannot drive a native OS file picker, same limitation §9z already noted) → linked them via the compatibility editor, visible immediately on the material's real edit page → confirmed the uploaded photo actually loads (`naturalWidth: 800`, not a broken image) → deactivated the material → confirmed it genuinely disappears from the real material-picker dropdown on a product's edit page (`listMaterialOptionsForAdmin`, the same query slice 1's product-material editor depends on) without deleting the row → confirmed `AuditLog` rows for every mutation including the deactivation done for real through the browser, not the script.

## 9z3. P7b, slice 3 — Designs & collections CRUD — 2026-08-27

Fourth P7b vertical slice (owner picked this over customers+RODO, settings, and content). Authoring for `Design`/`DesignCollection` — the actual engraved-artwork catalogue, including the rights-status/provenance fields the brief treats as load-bearing (§12). Slice 1 already let staff assign an *existing* design to a product; this is where those designs get created.

### Two required images, not one

`Design.thumbnailUrl`/`previewUrl` are both required AND distinct columns — same "no fake/derived asset" discipline as everywhere else in this codebase, so the create form takes two real separate file inputs (`thumbnailFile`/`previewFile`), each independently optional-on-replace during an update, exactly extending slice 2's single-required-image pattern (`admin-materials.ts`) rather than introducing a new one.

### The rights-default invariant got an actual regression test, not just a form default

§12: a new design must default to non-sellable and be *deliberately* promoted. The Prisma column default (`@default(REQUIRES_PERMISSION)`) already enforces this at the schema level, and the real `APPROVED_COMMERCIAL`/`PUBLIC_DOMAIN`-only filter that makes it matter already existed pre-P7 (`domain/compatibility/resolve.ts`, untouched this pass). What this slice adds is a test that would actually fail if someone later "simplified" the create form to default to something sellable: `tests/integration/admin-designs.test.ts` creates a design with no explicit `rightsStatus` override and asserts it lands `REQUIRES_PERMISSION` — the one invariant this whole slice exists to protect, made concrete instead of just trusted.

### `DesignCollection`'s FK is safe to hard-delete; kept soft-delete-only anyway

Checked the actual migration SQL before deciding (not assumed, matching this project's own standing discipline): `Design_collectionId_fkey ... ON DELETE SET NULL` — genuinely safe to delete a collection, no cascade, no orphaned data. `Design` itself is not (`ProductDesign_designId_fkey ... ON DELETE CASCADE`, `Configuration_designId_fkey ... ON DELETE SET NULL` — a hard delete would silently drop product assignments and orphan in-progress carts). Gave both the same `isActive`-toggle-only treatment anyway: a consistent "nothing in this panel is ever hard-deleted" rule across all three slices is worth more than exploiting the one relation where it happens to be technically safe.

### Verified, dev server restarted first per §9z2's new standing rule

`npm test` (495/495 — 487 prior + 8 new integration), `npm run typecheck`, `npm run lint`, `npm run build` all clean; no schema migration needed. Restarted the dev server before live-verifying (the rule §9z2 itself established, after the `Button`/`Link` bug that slice masked for an entire prior slice) — came up clean, confirming that fix holds under a fresh compile. Live-verified in the browser end to end: created a collection → created a design under it via the same standalone-script workaround (`tsx -r dotenv/config`, this browser tooling still can't drive a native file picker) with two real, distinct uploaded images (confirmed different `naturalWidth`s, not the same file twice) → confirmed `rightsStatus` landed `REQUIRES_PERMISSION` without ever specifying it → linked a material via the compatibility editor → deactivated the design → confirmed it disappears from the real `listDesignOptionsForAdmin`-backed product-design picker without deleting the row → confirmed `AuditLog` rows for every mutation, including the deactivation done for real through the browser.

## 9z4. P7b, slice 4 — Production queue — 2026-08-27

Fifth P7b vertical slice (owner picked this over customers+RODO, content, and settings). Unlike the previous three, this one is **read-only** — `docs/CHECKLIST.md`'s own two bullets ("queue grouped by status, module manifest, capacity view" and "printable production brief") describe reports over data that already exists, not a new entity. No new Server Actions, no `AuditLog` writes, none of the `revalidatePath`-in-the-wrong-half risk the CRUD slices kept hitting.

### A field the schema was already waiting for

`MachineSettings.weeklyCapacityMinutes` has existed since the initial migration, with a comment literally citing "§16A.1 module 10" — built ahead of time for exactly this feature, never read until now. Seeded at `0` on purpose (`seed.ts`: "no resolved value yet — left at their schema defaults... rather than invented"). The queue page treats that honestly: a real total is always shown, but the percentage-of-capacity figure only appears once the number is actually configured (Settings, still unbuilt) — no invented denominator.

### A real gap `PriceBreakdown` couldn't answer, found by reading its actual fields

Checked what `PriceBreakdown` (`domain/pricing/types.ts`) really stores before assuming the capacity view could be built from it: it keeps `areaMm2` and the resulting `machiningGrosze` cost, never the raw `machiningMilliMinutesPerM2` rate. Back-deriving minutes from cost would need the machine rate and which method (CNC/laser) applied — neither retained — so it would have been an estimate dressed up as a real number, which this project's "nothing is faked" rule doesn't allow. Fix: added `machiningMilliMinutesPerM2: number | null` to `OrderItemSnapshot` (`src/server/orders/snapshot.ts`), populated in `create-order.ts` from the exact same `validated.data.designsById.get(...)` lookup the adjacent line already uses for `recommendedMethod` — not new data access, just one more field read off it. `null` for `CUSTOM` products, same reasoning `PricingInput.design`'s own doc comment already states.

### A real `NaN`, found live, from data that predates the field it needed

Orders placed before this pass have no `machiningMilliMinutesPerM2` key in their stored JSON at all — not `null`, genuinely absent (`undefined`). The first version of `admin-production.ts`'s aggregation only checked `=== null`, so summing across the seeded/e2e orders in the dev DB produced `undefined / 1000 = NaN`, and one `NaN` in a running total poisons the whole sum — the live capacity page showed "Czas maszynowy w kolejce: NaN min." Caught by live-verifying against the real dev database (not the integration tests, which only ever construct fully-shaped fixtures and so never hit this) — a reminder that a schema-shape assumption is only proven against data the code itself wrote, not data from before the code existed. Fixed by checking `typeof x !== 'number'` instead of `=== null`, covering both cases identically; applied the same defensive check to `widthMm`/`heightMm` even though those have been part of the snapshot since it was introduced (cheap insurance, not a known bug there).

### Verified

`npm test` (500/500 — 495 prior + 5 new integration), `npm run typecheck`, `npm run lint`, `npm run build` all clean; no schema migration (the snapshot addition is a `Json`-column field, and `weeklyCapacityMinutes` already existed). Dev server restarted before live-verifying, per §9z2's standing rule. Live-verified in the browser: `/panel/produkcja` showed the real seeded order (`2026/08/0001`, `CONFIRMED`) with correct module count (12 = 4 modules/unit × quantity 3) and area (1.44 m²) — caught the `NaN` bug here, fixed it, re-verified `0 min` (correct, honest, for a pre-existing order) → the order detail page's new module manifest section showed the real 2×2 grid (`A1`–`B2`, 400×300mm each) → the printable brief rendered the same data with the explicit "not a production file" warning, and a JS check against `document.styleSheets` confirmed 8 real `@media print` rules were actually emitted (not just written in source and never compiled) for hiding the panel chrome.

## 9z5. P7b, slice 5 — Content: FAQ, static pages, real customer reviews — 2026-08-27

Sixth P7b vertical slice, and the first where the owner picked "Content" over the two entity-CRUD slices remaining (customers+RODO, settings). Unlike every prior P7b slice, **no schema existed for any of it** — `Faq`, `StaticPage`, and `Review` were genuinely new models, confirmed by grepping the schema before writing the plan. New migration `20260827000000_add_content_faq_pages_reviews`, hand-authored to match Prisma's own generated style, applied to both dev and test DBs.

### Reviews needed a real submission source before there was anything honest to moderate

A reviews-moderation UI over zero real submissions would have been decoration, not a feature — so before building it, the owner was asked directly (`AskUserQuestion`): build a minimal real submission flow, or defer reviews to a later slice. Chose to build it. The resulting model: one `Review` per genuine `COMPLETED` `Order` (`orderId` `@unique`), customer-submitted, `PENDING` by default. Two submission entry points — guest, via the same constant-time `accessToken` comparison `findOrderForConfirmation` already uses; logged-in, via the real session `userId` matched against `Order.userId` — both independently re-verify ownership, `status === 'COMPLETED'`, and that no review exists yet, server-side, never trusting the page that rendered the form. `src/server/actions/admin-reviews.ts` deliberately contains exactly one mutation, `setReviewStatus` (approve/reject) — no update-content function exists anywhere in the codebase, so §16A.1 module 9's "no facility to author a testimonial in a customer's name" is enforced by the shape of the code, not just by convention.

### The `next/headers`-outside-request-scope lesson, applied to a new surface

`submitAccountReview` initially called `getSession()` directly and failed in its integration test exactly the way P4/P6 already established (`headers was called outside a request scope`). Fixed with the same split every other actor-scoped mutation in this codebase now uses: `applySubmitAccountReview(userId, orderNumber, formData)` takes the actor explicitly (real DB logic, directly testable), `submitAccountReview(orderNumber, formData)` derives it via `getSession()` and wraps. Third time this exact shape has been needed this session (categories/materials/designs mutations used the staff equivalent) — it's now clearly the standing pattern for any actor-scoped Server Action, not a one-off.

### `useActionState`'s initial state and a genuine success look identical

`{ok: true}` is indistinguishable from `useActionState`'s own initial shape, so `ReviewForm.tsx` couldn't tell "not yet submitted" from "just succeeded" by inspecting `state` alone. Fixed with an explicit `useState<boolean> submitted`, set to `true` inside the action wrapper only when the real result is `ok`, and rendered instead of the form once true.

### A route-collision avoided by checking first, not by convention

Static pages needed a public URL. `/[slug]` was ruled out before writing any code — `(shop)/[category]/page.tsx` already claims that exact single-segment shape, and `/panel` itself later turned out to demonstrate the same fallthrough live (see below). Chose `/strony/[slug]` instead, a real second segment, no collision.

### A shared-test-database fragility this slice's tests exposed in an earlier slice, not caused by it

`admin-production.test.ts` (written in slice 4) asserted exact/absolute totals for specific `Order.status` values, correct only because it had that status space to itself at the time it was written. Once `reviews.test.ts` (this slice) also started creating `COMPLETED`/`CONFIRMED` orders in the same shared test database, both assumptions broke intermittently depending on run order. Fixed by switching to containment checks (`orderNumbers` contains mine, does not contain the ones I know shouldn't be there) and before/after deltas instead of absolute counts — verified by running the full suite twice consecutively, 514/514 both times. Durable lesson for every future slice: **never assert on-database totals in a shared-DB integration test; assert containment or deltas.**

### `/panel` bare has no index page — not a bug

Live-verifying, navigating straight to `/panel` (no subpath) rendered the storefront's category-not-found 404 page instead of anything admin-shaped. Not a routing regression: `(admin)/panel` has never had a bare `page.tsx`, only its subroutes do, so with no admin route matching the exact segment, Next.js falls through to `(shop)/[category]/page.tsx`, which happily treats `panel` as an unknown category slug. Confirmed via `location.href` (genuinely at `/panel`) plus the page's own text ("Nie znaleziono takiej kategorii"). Worth documenting once so a future slice doesn't "fix" it by adding a redirect nobody asked for.

### Verified

`npm test` (514/514 — 505 prior + 9 new integration), `npm run typecheck`, `npm run lint`, `npm run build` all clean; migration applied to both dev and test DBs. Dev server restarted before live-verifying, per §9z2's standing rule. Live-verified in the browser end to end: created a real FAQ entry in `/panel/faq/nowe` → confirmed it renders in the `/faq` accordion → created a real static page in `/panel/strony/nowa` → confirmed it renders at `/strony/o-nas` with the real SEO title → confirmed the FAQ teaser (but no reviews section — correctly, since none were approved yet) on the homepage → walked a real seeded order (`2026/08/0001`) through every status transition to `COMPLETED` via the existing P7a status actions → submitted a real guest review from `/zamowienie/2026/08/0001` (token-gated) → reloading the same page confirmed a second submission is refused server-side ("Opinia dla tego zamówienia została już przesłana") → confirmed the review was invisible on the homepage while `PENDING` → approved it in `/panel/opinie` → confirmed it then appeared in the homepage's real "Opinie klientów" section with the correct star rating, body, and author name.

## 9z6. P7b, slice 6 — Customers + RODO tooling — 2026-08-27

Seventh P7b vertical slice. No schema migration needed — `User.anonymizedAt` had existed since before P7 (same "built ahead of time, never read until now" shape as slice 4's `MachineSettings.weeklyCapacityMinutes`), and `Order` already stores its own denormalized `email`/`firstName`/`lastName`/address columns rather than deriving them from `User` — so the "preserves order records" half of the requirement was already true of the schema before this slice touched anything.

### What anonymization actually does, and deliberately doesn't

`applyAnonymizeCustomer` (`src/server/actions/admin-customers.ts`) scrubs `User.name`/`email`/`phone`/`image` and sets `anonymizedAt`, then deletes that user's `Session` and `Account` rows in the same transaction — the real "deletion" half, since an anonymized account that can still sign in isn't actually deleted. It does NOT touch `Order`, `Configuration`, `UploadedFile`, or `CustomerDesign` rows: the legal copy already committed to this exact split (`src/content/pl/legal.ts`'s RODO clause: anonymization doesn't remove data already tied to historical orders) and neither `Configuration` nor `UploadedFile` carries the customer's identity directly, only an orphanable `userId`. The replacement email is deterministic (`zanonimizowany-{userId}@rodo.local`), not random — collision-proof because `userId` is already unique, and consistent with this project's "no invented data" discipline elsewhere.

### A real bug: `requireStaffSession()` doesn't work in a Route Handler

The RODO export needed a genuine file download, so it's a real `route.ts` (`/panel/klienci/[id]/eksport`), not a Server Action — the first Route Handler this P7b effort has added since `/api/plik/[fileId]` back in P4. First draft reused `requireStaffSession()` for the auth gate, exactly like every Server Action this session has written. Live-verifying immediately caught it failing: the request returned Next's own generic "This page could not be found" 404 HTML instead of the route's JSON, even though the exact same staff session worked fine on every other `/panel/*` page in the same tab seconds earlier. Root cause: `requireStaffSession()` calls `notFound()`/`redirect()` from `next/navigation`, which throw a special "fallback" error that only Server Components/Actions have a rendering boundary for — a Route Handler has none, so Next.js catches it at the framework level and renders its own generic not-found page instead of ever returning control to the route's own code. `/api/plik/[fileId]/route.ts` had already worked around this correctly (it calls `getSession()` directly and branches manually, never `requireStaffSession()`) but nothing had documented *why*, so the pattern wasn't recognized as mandatory until this slice hit the same wall. Fixed the same way, and added the explanation as a comment on the new route so it doesn't get rediscovered a third time. **Standing rule, worth remembering for any future Route Handler in `/panel/*`: never call `requireStaffSession()` from a `route.ts` — use `getSession()` and branch manually, exactly like `/api/plik/[fileId]` and now `/panel/klienci/[id]/eksport` both do.**

### Reuse over rebuild

`admin-customers.ts`'s repository deliberately does not reimplement order history or saved-configuration queries — `listOrdersForUser` (`repositories/orders.ts`, built for `moje-konto/zamowienia`) and `listConfigurationsForUser` (`repositories/cart.ts`, built for `moje-konto/projekty`) already return exactly the shape module 8 asks for, and the customer detail page calls them directly. The RODO export (`buildCustomerExport`) is built from the same three reads the detail page renders, not a separate parallel query — so the exported JSON and the on-screen detail view can never drift apart.

### Verified

`npm test` (521/521 — 514 prior + 7 new integration), `npm run typecheck`, `npm run lint`, `npm run build` all clean; no migration. Dev server restarted before live-verifying, per §9z2's standing rule — this is also the run that caught the Route Handler bug above. Live-verified in the browser end to end: `/panel/klienci` listed real seeded customers with correct order counts, search by name and by email both worked → opened a real customer with a genuine order and saved configuration, both rendered correctly, empty-files state shown honestly → downloaded the RODO export via `fetch` and confirmed the JSON contained exactly that customer's real profile/orders/configurations, nothing fabricated and nothing belonging to another customer → seeded a disposable test-only customer (deleted afterward, never a real seeded demo account), anonymized it through the real form — profile fields scrubbed, `Session`/`Account` rows confirmed deleted via direct DB query, the form replaced by the "Konto zanonimizowane" notice with no way to re-trigger it → confirmed real `AuditLog` rows for both the export (`action: 'export'`) and the anonymization (`action: 'update'`, real note and timestamp in the diff).

## 9z7. P7b, slice 7 — Settings (staff users & roles, bank details, shipping rate, email templates) — 2026-08-27

Eighth P7b vertical slice — only the audit-log viewer remains after this. Closed three real, previously-flagged placeholders (`SHIPPING_FLAT_GROSZE // TODO_PRICING`, the "we'll send the account number separately" bank-details text, and `User.role`'s `input: false` comment noting "further staff are invited from the panel" — never built until now) plus added one genuine new capability, DB-editable email templates.

### Inviting staff needed no password machinery at all

The obvious-looking hard part — how does a brand-new staff account ever get a password? — turned out not to be a problem. `auth.ts` already runs Better Auth's `emailOTP` plugin, and `src/server/actions/auth.ts` already has a real, working OTP sign-in path used by real customers today. Better Auth's `signInEmailOTP` matches purely on email against the `User` table; it doesn't care whether an `Account` row (password or otherwise) exists at all. So `applyInviteStaffUser` (`src/server/actions/admin-staff.ts`) only ever needed to create a bare `User` row with the right `role` — the new staffer signs in at `/logowanie` with a code, exactly like a real customer's first-ever OTP sign-in. Live-verified end to end, including reading the real OTP out of the (unconfigured) mailer's console log line and completing a genuine sign-in with it.

### Staff-user management is ADMIN-only — a new gate

Every prior P7b mutation used `requireStaffSession()`. This is the first screen where that's not strong enough: minting an account with panel access is meaningfully more dangerous than editing a `Category`. Added `requireAdminSession()` (`src/server/auth/session.ts`, right next to `requireStaffSession()`) — `notFound()` for `STAFF` too, not just `CUSTOMER`. Live-verified the actual boundary: a real invited `STAFF` session hit a genuine 404 on `/panel/ustawienia/personel`, not just a hidden nav link.

### A tooling gotcha, not a code bug: browser tabs share one cookie jar

Tried to test the new staffer's sign-in in a second tab, expecting it to hold an independent session from the admin tab already logged in. It doesn't — this browser tool's tabs share a single cookie store, so signing in as the new staffer in "tab-1" silently logged the "seed" tab (the one doing all the admin work) out of ADMIN and into the new STAFF account instead. Recovered by using the exact same OTP mechanism to sign back in as the real admin (`SEED_ADMIN_EMAIL`, reading the code from the same console log line) — which incidentally doubled as extra proof that OTP sign-in works for a pre-existing password-having account too, not just a bare invited one. Worth remembering for any future multi-session live verification in this environment: don't assume a second tab is a second session.

### Email templates: additive, not a rewrite of the type-safe path

`mailer.ts`'s `renderSubjectAndText` — a pure, fully-typed function keyed on the closed `MailTemplate` union — stays exactly as it was, still the seed source and the fallback. `resolveSubjectAndText` (new) looks up an optional `EmailTemplate` DB row first, interpolating `{{placeholder}}` tokens built from the same typed `MailDataFor<T>` shape (`buildPlaceholders`) `renderSubjectAndText` already consumes — never arbitrary object properties. A missing row, or a DB error during the lookup, both fall through to the hardcoded default rather than failing the send — matching the mailer's own pre-existing "never throws" contract. Live-verified past the automated test (`tests/integration/mailer.test.ts`, which proves the mechanism with a distinctive marker string): edited the real `order-confirmation` body from the panel, then invoked the real `mailer` singleton directly against the dev database and watched the edited copy come back out, before reverting it to the exact original text.

### The test database had never actually been seeded

Running `npm run db:seed` against `TEST_DATABASE_URL` for the first time (needed so `StoreSettings`/`EmailTemplate` singleton rows would exist for the new tests) revealed that `PricingSettings` — a real, load-bearing singleton with a partial unique index enforcing at most one `isActive: true` row — had never existed in the test database at all; the seed script logged "created version 1," not "already exists." Every prior slice's tests had apparently always built their own fixtures rather than relying on a global seeded row, so this had gone unnoticed. Ran the full 537-test suite immediately after seeding to confirm nothing broke (a real risk, given the unique-active-row constraint) — it didn't. Worth knowing for future slices: the test database is not a mirror of "what a fresh `npm install && npm run db:seed` gives you" — it only ever had what `db:deploy:test`'s migrations created plus whatever individual tests inserted and cleaned up themselves, until this slice's seed run.

### Verified

`npm test` (537/537 — 521 prior + 16 new integration), `npm run typecheck`, `npm run lint`, `npm run build` all clean; migration applied to both dev and test DBs, seed run on both. Dev server restarted before live-verifying, per §9z2's standing rule. Live-verified in the browser end to end: set a real bank account number and shipping rate in `/panel/ustawienia`, confirmed the checkout page and a real order's confirmation page picked up the real values, then reverted both back to the honest "not configured"/original placeholder state → invited a real disposable `STAFF` account, signed in as them via a real OTP round trip (no password), confirmed full panel access except a genuine 404 on the ADMIN-only personnel screen, then revoked their access from the real admin session and confirmed they dropped out of the staff list → edited the real `order-confirmation` email template, confirmed the live `mailer` singleton actually used the edited text against the dev database, reverted it to the original copy → cleaned up every piece of disposable verification state (the test staffer, temp scripts) before finishing.

## 9z8. P7b, slice 8 — Audit log viewer — 2026-08-27

Ninth and final P7b vertical slice — **P7b is now complete**. No schema, no new writes: `AuditLog` and `writeAuditLog()` have existed since P7a, and every mutation across every slice since has been writing to it. This slice is purely the read side, `docs/ARCHITECTURE.md` §16A.1 module 11's last unbuilt half.

### The smallest slice, deliberately built without a formal plan round

Every other P7b slice this session went through `EnterPlanMode` — genuine architectural or scope decisions were involved each time (staff-invite mechanism, ADMIN-only gating, singleton schema shapes, RODO deletion semantics). This one had none: a filterable read-only list over data that already exists, in a shape every prior admin list page (`/panel/zamowienia`, `/panel/klienci`) already established. Built directly, proportionate to the actual size of the decision space.

### The entity filter is self-updating on purpose

`listAuditLogEntities()` queries `DISTINCT entity FROM "AuditLog"` rather than shipping a hardcoded list of every entity name ever audit-logged. A hardcoded list would silently go stale the moment a future slice adds a new entity (exactly the kind of drift this project has avoided everywhere else — `ORDER_STATUSES` read from the real state machine, `listCustomersForAdmin`'s search matching real columns, etc.). The action filter, by contrast, IS a small hardcoded list (`create`/`update`/`delete`/`transition`/`export`) — safe to hardcode since it mirrors `AuditAction`, a closed type union in `write-audit-log.ts` that only changes when a developer edits that file directly, unlike `entity`, which is a free-form string any future `writeAuditLog()` call can introduce.

### Diffs are rendered as plain JSON, not reformatted per entity

`AuditLog.diff` is a `Json?` column with no fixed shape — every mutation across this whole project has written whatever `diff` object made sense for that specific action (`{ before, after }`, `{ fromStatus, toStatus, notePl }`, `{ addFinish: id }`, etc.). Building a human-readable formatter for every distinct shape across a dozen entities would be real scope beyond what "audit log viewer" asks for. A plain `JSON.stringify(diff, null, 2)` in a monospace block is honest — it shows exactly what was recorded, never an interpretation that could drift from the real data — and reads perfectly well in practice, confirmed live against the genuine mutation history this entire session's work produced.

### Verified

`npm test` (539/539 — 537 prior + 2 new integration), `npm run typecheck`, `npm run lint`, `npm run build` all clean; no migration. Dev server restarted before live-verifying (the browser context itself had reset since the prior slice, requiring a fresh OTP sign-in — same mechanism verified in §9z7, worked identically). Live-verified in the browser: `/panel/dziennik-zdarzen` showed the real, complete mutation history of every P7a/P7b slice built this session — real actors (including the `script-test-*@example.test` accounts from earlier scripted E2E work), real diffs, real timestamps, nothing fabricated → filtered by entity (`Review`) and confirmed only that entity's real rows showed → filtered by action (`export`) and confirmed the three real RODO export events from slice 6 → searched by a real actor email and confirmed exactly that actor's rows → combined an entity + action filter that legitimately has zero matching rows and confirmed the honest empty state, not an error.

## 9z9. P7c, slice 1 — Global search (Ctrl/⌘+K) — 2026-08-27

First P7c slice — P7b's own vertical-slice discipline (§16A.6) carried over, since P7c's 23-item list is just as clearly not a single pass. Picked as the starting point specifically because it's the one item in that list with no dependency on migrating every existing list page to `@mui/x-data-grid` first — a standalone feature, not a foundation-laying refactor.

### Reused three-quarters of the search logic; the other quarter was a two-line addition

`listOrdersForAdmin`/`listCustomersForAdmin` already had exactly the right `search` semantics from their own list pages (`/panel/zamowienia`, `/panel/klienci`). `listDesignsForAdmin`/`listProductsForAdmin` didn't take a search filter at all — added one to each, optional and backward-compatible (both had exactly one existing call site, neither passes the new parameter, both keep working unchanged). No new matching strategy invented — deliberately not the storefront's diacritic-folding `matchesPl`/`foldPl`, since staff searching their own catalogue by code/name/email is a different problem than a customer searching product copy, and every existing admin search box already uses plain `contains`/`insensitive`.

### The first read that needed the same "re-derive the session inside the action" discipline as every write

Every mutating Server Action in this codebase already re-derives `requireStaffSession()` itself rather than trusting the page that rendered its trigger, because a Server Action is directly POSTable once its id is known. `searchGlobal` (`src/server/actions/admin-global-search.ts`) is the first *read* action that needed the same treatment — it's invoked via `fetch`-as-you-type from a client island, not rendered server-side inside an already-gated Server Component the way every other admin read has been until now. Applied the same pattern rather than treating reads as exempt.

### A browser-tooling quirk, not a feature bug — worth remembering

Live-verifying, the very first attempt (type a full order number immediately after opening the dialog) produced a stray navigation to the homepage instead of showing search results — and a later attempt using `ctrl+a` then typing to replace an existing query concatenated the new text onto the old instead of replacing it (`triple_click` also didn't select-all in this MUI `TextField`). Neither reproduces from a real keyboard in a real browser; both are this browser tool's own keystroke-simulation timing/selection quirks (`[[feedback_browser_tooling_quirks]]`), not bugs in `GlobalSearch.tsx`. Confirmed by: (a) waiting for a screenshot to confirm the dialog was genuinely open and focused before typing, which then worked cleanly every time after; (b) avoiding `/` characters in typed queries specifically (searched `jan.kowalski`/`accounts-order-...`/design and product names instead of a slash-bearing order number) and getting clean, correct results throughout. Worth remembering for any future live verification of a freshly-opened modal/dialog in this environment: screenshot-confirm focus before the first keystroke, and prefer `Escape` + reopen over trying to clear-and-retype an existing value.

### Verified

`npm test` (542/542 — 539 prior + 3 new integration), `npm run typecheck`, `npm run lint`, `npm run build` all clean; no schema change, no migration. Dev server restarted before live-verifying, per §9z2's standing rule. Live-verified in the browser: the "Szukaj (Ctrl+K)" trigger opens the dialog, autofocused, with the honest "start typing" hint on an empty query → real order, customer, design, and product searches each returned genuine matching rows grouped under the right Polish heading with the right sublabel, and clicking each one navigated to that exact record's real detail page, closing the dialog → confirmed `Escape` closes without navigating.

## 9z10. P7c, slice 2 — `@mui/x-data-grid` adoption (starting with Orders) — 2026-08-27

Second P7c slice — the foundation most of the remaining 22-item list depends on. `@mui/x-data-grid` (Community/MIT) was a genuinely new dependency, unlike everything else added this session, which deliberately avoided new packages — but it's the documented plan (`docs/ARCHITECTURE.md` §16A/§17.4), not a shortcut. Scoped to one grid — `/panel/zamowienia` — rather than a sweeping rewrite; the other ~14 admin list pages stay plain `<Table>`s until their own later slices.

### Half the "plPL locale" work turned out to already be done

`theme.ts` already applied MUI core's `plPL` locale (`createTheme(brandTheme, plPL)`) — built at some earlier point, just never exercised since nothing rendered a component that reads it. This slice only needed to add `dataGridPlPL` alongside it. Confirmed via the real Polish pagination footer ("1–25 z 66") the very first time the grid rendered — the locale wiring worked correctly on the first attempt, no separate debugging needed.

### A real, pre-existing bug the DataGrid's row-click surfaced

Clicking a grid row navigated to a 404. Root cause: order numbers contain literal `/` (`2026/08/0066`), and every admin-side link to an order detail page was built by naively interpolating the raw string into an `href` (`` `/panel/zamowienia/${order.orderNumber}` ``) — Next.js treats those embedded slashes as real path segments, so the single `[orderNumber]` dynamic segment never matches. This wasn't a regression from the DataGrid work — the exact same pattern was already in the plain `<Table>` this replaced, in `/panel/klienci/[id]`'s order-history table, and in `/panel/produkcja`'s queue table. It had gone unnoticed because every prior live-verification of an order detail page in this project navigated there via a manually `%2F`-encoded URL typed directly into the address bar, never by actually clicking a rendered link. The customer-facing equivalent (`moje-konto/zamowienia/page.tsx`) had already gotten this right (`encodeURIComponent(order.orderNumber)`) — the admin side just never matched it. Fixed at every site that builds an order-number href: the two other admin tables, the printable-brief link on the order detail page itself, `admin-global-search.ts`'s result href, and the new `OrdersDataGrid.tsx`'s own column link and `onRowClick` handler. `revalidatePath` calls were deliberately left un-encoded — they want the real decoded path for cache invalidation, not a client-navigation href, and the receiving page already `decodeURIComponent`s on the way in.

### Verified

`npm test` (542/542, unchanged — no repository/action logic touched), `npm run typecheck`, `npm run lint`, `npm run build` all clean; no schema change, no migration. Dev server restarted before live-verifying, per §9z2's standing rule — the first request after adding the new dependency took visibly longer (Turbopack's first full compile of the new module graph), briefly showing stale/unauthenticated-looking state before settling; not a bug, just cold-compile latency, confirmed by retrying and landing on the correct authenticated page. Live-verified in the browser: the real `DataGrid` renders with real order rows and the Polish locale chrome → clicking a column header sorts client-side (confirmed by the row order changing for a real "Kwota" ascending sort) → clicking a row (not just the `Numer` link) navigates to that exact order's real detail page, only working correctly after the `encodeURIComponent` fix above → the existing status/paymentStatus/search filter form still performs a real server-side re-fetch unchanged, including the honest empty-state sentence for a query matching nothing.

## 9z11. P7c, slice 3 — `@mui/x-data-grid` on the catalogue list pages — 2026-08-27

Fourth P7c slice, extending slice 2's `DataGrid` pattern from Orders to six list pages at once — Kategorie, Produkty, Materiały, Wykończenia, Wzory, Kolekcje. Grouped rather than done one at a time because reading all six revealed they were genuinely the identical shape (heading + "new" button, 0-1 filter fields, a 3-4 column table with one link column and 1-2 status `Chip`s) — the same reasoning P7b used to bundle materials+finishes into one slice rather than two.

### A shared primitive this time, not six more copies of `OrdersDataGrid`

`OrdersDataGrid.tsx` (slice 2) hand-rolled its own `<DataGrid>` wrapper — right call there, since Orders was the first usage and uniquely complex (real filter form, two-line cells), so proving the pattern mattered more than DRYing it prematurely. These six pages are simple and near-identical, so the second time the same boilerplate (row click → navigate, `getRowId`, pagination defaults) showed up, it was worth extracting: `EntityDataGrid.tsx`, a generic `<T extends { id: string }>` wrapper taking `rows`/`columns`/`basePath`. Each entity gets a thin ~35-line file defining only what actually differs — its columns, including `Chip` colors/labels — and rendering `<EntityDataGrid>`. Column defs couldn't live in the page's own Server Component (`renderCell` is JSX with a click handler), so the six thin files aren't optional boilerplate, just the smallest piece that has to stay per-entity.

One real, deliberate difference from `OrdersDataGrid`: no `encodeURIComponent` on the navigated id here. Orders needed it because `orderNumber` is a human-facing string containing literal `/`; every one of these six entities navigates by its plain `cuid` `id`, which never contains a slash — added the encoding only where the bug in slice 2 actually was, not defensively everywhere.

### Verified

`npm test` (542/542, unchanged — no repository/action logic touched across any of the six pages), `npm run typecheck`, `npm run lint`, `npm run build` all clean; no schema change, no migration, no new dependency (already installed in slice 2). Dev server restarted before live-verifying, per §9z2's standing rule — again saw the slow-first-request-after-a-dependency-change latency noted in §9z10 (this time from restarting onto the six-file diff), resolved by simply waiting longer before the first navigation. Live-verified in the browser: Kategorie and Produkty checked end to end — real rows, correct Polish column headers and the `dataGridPlPL` pagination chrome ("Wierszy na stronę:", "1–7 z 7"), a row click navigating to the real category detail page, Produkty's real `categoryId`/`typeCode` filter form still narrowing results correctly (confirmed both a real filtered match and the honest `Brak produktów.` empty state for a filter matching nothing) → Materiały, Wykończenia, Wzory, and Kolekcje each spot-checked and confirmed rendering real rows with correct labels (material family, finish kind, design rights status, all via their existing `admin*Label` functions) and no genuine console errors (network requests for each page all 200 OK; a batch of console 404s present was stale history from earlier navigations in the same long-lived tab, not from these pages — confirmed via `read_network_requests` showing nothing but 200s).

## 9z12. P7c, slice 4 — `DataGrid` on the remaining navigate-to-detail lists — 2026-08-27

Fifth P7c slice, extending `EntityDataGrid` (slice 3) to the four other list pages that turned out to share the exact same shape — Klienci, FAQ, Strony, Weryfikacja. Third reuse of the primitive with zero changes to it; each page only needed its own thin `columns` file, same as slice 3's six.

### Scoping out the five pages that don't actually fit, on purpose

Before building, read the remaining nine `<Table>`-using pages, not just the four that matched. Five don't share `EntityDataGrid`'s "click a row, navigate to that row's own detail page" shape, and forcing them in would mean bad design, not reuse:
- **Opinie** and **Personel** have per-row action buttons (approve/reject a review; revoke a staff member) — no detail page for a review or a staff row to navigate to, so `onRowClick` has nothing correct to do.
- **Produkcja**'s rows link to a *different* entity's detail page (the order), not their own — `EntityDataGrid`'s `basePath + row.id` navigation assumes the row's own id, which doesn't apply here.
- **Szablony e-mail** is a fixed two-row list (the closed `MailTemplate` set) — sorting, pagination, and density controls would be pure decoration over two rows that will never grow.
- **Dziennik zdarzeń**'s diff column holds pretty-printed, variable-height JSON — `DataGrid`'s fixed-row-height model actively fights that content shape.

Documented this in `docs/CHECKLIST.md` explicitly, rather than letting five un-migrated pages read as five forgotten ones — each is a real, deliberate design decision for a future slice, not an oversight.

### Verified

`npm test` (542/542, unchanged), `npm run typecheck`, `npm run lint`, `npm run build` all clean; no schema/dependency change. Dev server restarted before live-verifying, per §9z2's standing rule. Live-verified in the browser: Klienci's real `search` filter narrowed correctly and a row click navigated to the exact right customer (confirmed even for a customer with an empty `name` field, where only the email cell has visible link text) → FAQ, Strony, and Weryfikacja each confirmed rendering real rows with correct Polish headers and pagination chrome, network requests all clean 200s.

## 9z13. P7c, slice 5 — `DataGrid` with per-row actions (Opinie, Personel) — 2026-08-27

Sixth P7c slice, covering two of the five pages deliberately deferred from slices 3-4: Opinie and Personel, both driven by per-row action buttons (approve/reject a review; revoke a staff member) rather than a click-to-navigate row. A genuinely different shape from `EntityDataGrid`'s own — designed once here for both pages, rather than forced into the navigate-to-detail primitive.

### Not `EntityDataGrid` — hand-rolled again, on purpose

`EntityDataGrid` is built around `onRowClick` + `basePath` navigation. Neither review nor staff rows have a detail page to navigate to, so bending that primitive to support an optional/no-op navigation mode would have made it worse for its actual job, not better. Two small, standalone `<DataGrid>` wrappers instead — the same shape `OrdersDataGrid` was before slice 3 extracted the shared piece. The real lesson repeated a third time this session: extract a shared primitive only once the *same* boilerplate shows up on genuinely homogeneous cases (slice 3's six catalogue pages) — don't force a fourth, fifth, and sixth case into an earlier abstraction just because it's already there.

### The mutation mechanism didn't change at all

Both pages' real `<form action={setReviewStatus.bind(...)}>` / `<form action={changeStaffRole.bind(...)}>` — the same zero-extra-JS mutation pattern every action in this codebase uses — moved into a `DataGrid` cell's `renderCell` completely unchanged. `changeStaffRole`/`setReviewStatus` themselves, and the pages' own conditional logic (hide "Zatwierdź" once already `APPROVED`; hide the revoke button on the acting admin's own row), are byte-for-byte the same checks that were already in the plain `<Table>` version — just relocated.

One small real refactor: `panel/ustawienia/personel/page.tsx`'s page-local `roleLabel` helper became a real exported `adminStaffRoleLabel()` in `content/pl/admin.ts`, since a client-island column definition can't reach a Server Component's local function. The only server-side change this slice needed.

### Verified

`npm test` (542/542, unchanged), `npm run typecheck`, `npm run lint`, `npm run build` all clean; no schema/dependency change. Dev server restarted before live-verifying, per §9z2's standing rule. Live-verified in the browser against real mutations, not just rendering: on Opinie, clicked the real "Odrzuć" button on the one genuine approved review from P7b slice 5 (`2026/08/0001`) — the row updated to `Odrzucona` with only a "Zatwierdź" button remaining, exactly the existing conditional logic — then clicked "Zatwierdź" to restore it to `Zatwierdzona`, its real prior state, before finishing. On Personel, invited a real disposable test staff account, confirmed its row appeared with a revoke button (and the acting admin's own row still correctly has none), clicked "Cofnij dostęp" and confirmed the row disappeared from the grid, then deleted the disposable account from the database.

## 9z14. P7c, slice 6 — raw-HTML-form cleanup — 2026-08-27

Direct owner feedback: "if you create or use any form it should match the mui/nextjs classes - so its not raw html/css." A `grep -rln "<button\|<input\b"` across the panel found exactly 7 files with real instances (one false positive: `OrderStatusActions.tsx`'s `<input type="hidden">`, invisible plumbing with no MUI equivalent, correctly left alone).

Two raw `<button>` filter-submit elements (Orders, Products list pages) → `<Button variant="contained">`, trivial.

Six raw `<input type="file">` elements (product image upload, design thumbnail/preview × 2, finish image, material image) were the real work — MUI has no native file-input component. Built a shared `FileInputButton.tsx` using MUI's own documented recipe: a real `<Button component="label">` wrapping a **visually-hidden** (not `display:none` — that drops it from the tab order and breaks screen readers; the CSS is the standard `clip-path: inset(50%); position: absolute; width: 1px; height: 1px; overflow: hidden` pattern) native `<input type="file">` inside it, with local `useState` tracking the picked filename to show on the button (the native input's own "chosen file" text disappears once visually hidden, so this replaces it). The input keeps its real `name`/`accept`/`required`, so the enclosing `<form>`'s `FormData` — and every existing Server Action reading it — needed zero changes.

Verified: `npm run typecheck && npm run lint && npm test && npm run build` clean (549/549 tests, unchanged count — no logic touched, purely a component swap).

## 9z15. P7c, slice 7 — Dashboard + Materio-style visual shell — 2026-08-27

The big one. Owner feedback, quoted directly: the panel should "resemble materio," use "more advanced charts," and support "a lot of support functionalities for admin observability and management." Chose to build the Dashboard module (§16A.1 module 1) and the visual shell (Materio-style sidebar/theme, §16A's own recorded-but-unbuilt note) **together, in one slice**, per the owner's explicit answer to an `AskUserQuestion` — building the Dashboard on the old flat-sidebar/storefront-theme shell would have meant redoing its chrome immediately after.

### Researched the real Materio repo before building anything

Fetched [themeselection/materio-mui-nextjs-admin-template-free](https://github.com/themeselection/materio-mui-nextjs-admin-template-free) directly rather than building from memory of the name. Confirmed: Next 14 + MUI 5 **+ Tailwind CSS** running alongside it, charts via **ApexCharts/react-apexcharts** — not MUI-native. Deliberately did not copy either: this project stays MUI-only (§1, and the owner's own "match mui/nextjs classes" ask cuts the other way from adding Tailwind), and `@mui/x-charts` was already the named intent in `docs/ARCHITECTURE.md` §16A. Adopted Materio's *structure and visual language only* — grouped icon sidebar, bento-grid soft-shadow stat cards — reimplemented in real MUI.

### A second, admin-only theme — and the real bug in wiring it up

`src/ui/theme/theme.ts` (the storefront theme) exists specifically to *flatten* shadows and avoid accent colour — the opposite of what a real admin dashboard needs. Built `src/ui/theme/adminTheme.ts` as a genuinely separate `Theme` object: real Material elevation, an indigo accent + success/warning/error/info palette, `MuiCard` `styleOverrides` for the rounded soft-shadow look. Kept `theme.ts` completely untouched — the storefront's own `formatPln` Szukaj-button colour (`rgb(46, 42, 38)`, `#2E2A26`) was checked live after this slice to confirm zero bleed.

**The real bug, twice**, both the same root cause: a genuine MUI `Theme` object — or any object holding functions, including an `sx` prop with a `(theme) => ...` callback — crashes at runtime if it crosses a **Server → Client Component** prop boundary ("Functions cannot be passed directly to Client Components unless you explicitly expose it by marking it with 'use server'"). `npx tsc`/lint/tests all stayed green through both; only live browser verification caught them (and only on a **fresh** tab — a reused tab's stale console history showed the exact same crash *after* both fixes landed, which cost real time chasing a already-fixed bug before the "stale console" quirk was remembered — see `docs/HANDOVER.md`'s own browser-tooling notes and the `feedback_browser_tooling_quirks.md` memory file).

1. First instance: `ThemeRegistry`'s original `theme?: Theme` prop, with `panel/layout.tsx` (a Server Component) passing `theme={adminTheme}` directly. Fixed by changing the prop to a plain string `variant?: 'storefront' | 'admin'` — fully serializable — and moving the actual `Theme` object lookup (`THEMES[variant]`) *inside* `ThemeRegistry`'s own client module, never crossing the boundary as a prop.
2. Second instance: `StatCard.tsx` (a Server Component, deliberately — it's static, no client state needed) used `sx={{ bgcolor: (theme) => theme.palette[color].main, color: (theme) => theme.palette[color].contrastText }}` to resolve its colour prop against the theme — but that `sx` object crosses into `Stack`/`Card` (Client Components internally in MUI) as a prop. Fixed with MUI's own dot-path string resolution instead: `bgcolor: `${color}.main`` — no callback, same result, fully serializable.

General lesson, now in the `feedback_nextjs_testing_gotchas.md` memory file: never pass a constructed `Theme` (or any function-holding object) as a prop from a Server Component into a Client Component; resolve it from a serializable key inside the client module instead, and use theme dot-path strings in `sx` rather than `(theme) => ...` callbacks whenever the component authoring the `sx` might itself be a Server Component.

### The Dashboard itself

New `src/server/repositories/admin-dashboard.ts` — `getDashboardKpis`, `getRevenueOverTime`, `getOrdersByStatus`, `getTopEntities`, real new aggregation logic (unlike the pure-UI DataGrid slices, this got real tests). Two more real things worth recording:

- **"Revenue" is a named, deliberate definition** (an e-commerce dashboard could reasonably mean either): every order NOT `CANCELLED`, regardless of payment status — booked revenue, not collected revenue. Documented inline in the repository, not left implicit.
- **A real UTC-vs-local-time bug, caught by the test suite before it ever reached the browser**: `getRevenueOverTime`'s day-bucketing built its key from `order.createdAt.toISOString()` (always UTC) but originally walked the fill-loop using `Date`'s local `setHours`/`setDate` — on this server (`Europe/Warsaw`, UTC+1/+2), that misaligns the loop's day boundaries against the UTC keys by an hour, silently dropping or duplicating a day at each end of the range. Fixed by making the whole loop UTC-consistent (`setUTCDate`, UTC-anchored cursor). The `admin-dashboard.test.ts` test that catches this asserts on real UTC ISO date strings (`'2026-01-01T00:00:00.000Z'`) crossing a day boundary — it would have failed on the original code on this machine, and passed by accident on a UTC-timezone CI runner, which is exactly the kind of bug that's invisible until someone in the "wrong" timezone runs it for real.

Production load reuses `getProductionCapacity()` (already existed, P7b) verbatim — no new logic, just a `LinearProgress` on the dashboard matching `/panel/produkcja`'s own existing display.

### Verified

`npm run typecheck && npm run lint && npm test && npm run build` clean (549/549 tests, 7 new). Dev server restarted, live-verified logged in as a real admin account (`panel@example.com`, via the existing OTP sign-in flow — the OTP code was read from the dev server's log since Resend isn't configured in this environment): grouped sidebar renders with icons and correct active-route highlighting (confirmed on `/panel/zamowienia`), the 9 stat cards show real numbers matching the seeded dev data, both charts render with real data and Polish labels, the date-range form works, the production-load section correctly shows "not configured" (matching `/panel/produkcja`'s own state — `MachineSettings.weeklyCapacityMinutes` is 0 in this dev DB). Storefront theme confirmed unaffected. One benign, cosmetic MUI X Charts console warning noted and left alone: a `<clipPath>` defs `<rect>` (not a visible painted shape) sometimes gets a transient negative width on initial layout inside a CSS Grid item — known library timing quirk, doesn't affect what's rendered, not worth contorting the responsive layout to silence.

## 9z16. P7c, slice 8 — persisted dense grids + dashboard click-through — 2026-08-27

Continuing the P7c UX-polish list after slice 7. Bundled three related checklist items into one slice rather than picking them off individually: column config/density/sort persistence, dense-by-default grids with a comfortable toggle, and every Dashboard number linking through to its records.

### The MUI X Data Grid toolbar's default composition doesn't include the density selector

Assumed (wrongly, before checking live) that the new-ish `showToolbar` boolean prop (v8+, renders a default toolbar without manually wiring `slots={{toolbar: GridToolbar}}`) would include a density selector, since that's the classic all-in-one `GridToolbar`'s composition. Confirmed via `read_console_messages`/DOM inspection in the browser: `showToolbar` alone renders Kolumny/Filtry/Eksportuj/Szukaj — no density control at all. Switching to explicit `slots={{toolbar: GridToolbar}}` (the legacy full toolbar, still exported, confirmed via its own source to compose `GridToolbarDensitySelector`) made the density button appear as **"Wysokość rzędu"** (row height) — but only once `showToolbar` was ALSO kept alongside `slots.toolbar`; `slots.toolbar` alone rendered nothing at all. Final working combination: both `showToolbar` and `slots={{toolbar: GridToolbar}}` together. Verified live: clicking "Wysokość rzędu" opens a real 3-item menu (Kompakt/Standard/Komfort), and selecting one both changes the grid's row height immediately and writes to `localStorage`.

### `useGridPreferences` — loads in an effect, not a lazy initializer

New shared hook (`src/ui/islands/admin/useGridPreferences.ts`), one `localStorage` entry per grid (`admin-grid:${storageKey}` — the grid's own `basePath` for the 10 `EntityDataGrid` consumers, a literal key for `OrdersDataGrid`/`OpinieDataGrid`/`StaffDataGrid`). Holds `{density, sortModel, columnVisibilityModel}`, controlled via `DataGrid`'s own `density`/`onDensityChange`/`sortModel`/`onSortModelChange`/`columnVisibilityModel`/`onColumnVisibilityModelChange` props — replacing every grid's hardcoded `getRowHeight={() => 52|56}`, which had been silently overriding the real density mechanism this whole time.

Deliberately loads from `localStorage` inside a `useEffect`, not a lazy `useState(() => ...)` initializer. A `DataGrid` living inside a `'use client'` island still gets server-rendered for its initial HTML (Client Components are SSR'd too, same lesson as slice 7's `Theme`-as-prop bug, different failure mode) — reading `localStorage` during that initial render would make the very first client render disagree with what the server sent (different visible columns, different row order), a genuine hydration mismatch, not a hypothetical one. Loading in an effect means the first paint always matches the SSR'd default (`density: 'compact'`, all columns visible, unsorted), then flips a tick after mount if the user has a saved preference — verified live: reload on `/panel/kategorie` after setting density to "Komfort" showed the grid re-render as comfortable with no console warning, and a completely different grid (`/panel/produkty`, no saved preference) stayed compact, confirming the per-`basePath` key scoping works.

### A real test-flakiness bug, caught by running the suite twice

`admin-dashboard.test.ts`'s original `getDashboardKpis` tests asserted absolute values (`expect(kpis.ordersToday).toBe(2)`) — passed when the file ran in isolation, failed (`5` instead of `2`) the first time it ran inside the full `npm test` suite. Root cause: `getDashboardKpis()` is deliberately unscoped (no test-fixture-prefix filter — it queries every real order, matching its actual production purpose), and Vitest runs test files in parallel against the same shared test database; other files' own fixtures (created with the same real `createdAt: now()` Prisma default) transiently exist during the window this test's query reads. Rewrote every assertion in that describe block as a before/after **delta** across the test's own fixtures rather than an absolute value — race-proof regardless of what else is concurrently running. Caught a second, unrelated bug while rewriting: the "awaiting payment" test's own second fixture order (added for the "in production" case) didn't override `paymentStatus` away from its `seedOrder` helper's `'AWAITING'` default, so it was silently double-counting toward `ordersAwaitingPayment` too — fixed by giving it `paymentStatus: 'PAID'` explicitly. Ran the full suite twice after both fixes to confirm the flakiness was actually gone, not just not-reproduced-this-time.

### Dashboard click-through

`StatCard` gained an optional `href` — wraps the whole card in a plain `<Link>` (`textDecoration: 'none', color: 'inherit', display: 'block'`), not MUI's polymorphic `component={Link}`, same reasoning as `AdminSidebarNav`'s own nav links. The Orders list page (`panel/zamowienia/page.tsx`) gained `dateFrom`/`dateTo` query-param filtering — `admin-orders.ts`'s `listOrdersForAdmin` already accepted both, just never wired at the page level — plus two matching `TextField type="date"` in its visible filter form, so a user who lands via a Dashboard tile sees *why* the list is filtered and can adjust it. Live-verified: clicking "Zamówienia dzisiaj" (0) landed on Orders with `dateFrom`/`dateTo` both set to today and a real "Brak zamówień spełniających kryteria" empty state, matching the KPI's own `0`; the 7-day tile correctly showed all 66 seeded dev orders (they're all within the last 7 days, not a filtering bug — confirmed by narrowing further to today-only and seeing it correctly drop to zero).

### Verified

`npm run typecheck && npm run lint && npm test && npm run build` clean (549/549 tests — same count as before, since this rewrote existing dashboard tests rather than adding new ones; ran the suite twice to confirm the flakiness fix actually held). Dev server restarted twice (once mid-slice after the toolbar fix), live-verified in a fresh browser tab each time.

## 9z17. Bugfix — STAFF/ADMIN land on `/panel` after sign-in, not `/moje-konto` — 2026-08-27

Found live by the owner, not by testing: signed in with a real staff OTP and landed on the plain customer account page with no indication `/panel` was a separate destination. `mergeAndGetRedirectTarget()` (`src/server/actions/auth.ts`, the shared tail of `submitLogin`/`submitRegister`/`submitOtpLogin`) always returned `/moje-konto` regardless of role.

Fixed with a small role lookup, not a read off Better Auth's own sign-in result — `tsc` caught that `signInEmailOTP`'s returned `user` doesn't carry the custom `role` field, unlike `signInEmail`/`signUpEmail`'s (an inconsistency across Better Auth's own methods, not something to rely on). `mergeAndGetRedirectTarget(userId)` now does one extra `prisma.user.findUnique({select: {role: true}})` and returns `/panel` for `STAFF`/`ADMIN`, `/moje-konto` otherwise — registration is unaffected (a fresh signup is always `CUSTOMER`, `role` is `input: false`).

Verified: `npm run typecheck/lint/test/build` clean; live end-to-end in a fresh browser tab — logged out, requested a fresh OTP for `panel@example.com`, read the code from the dev server log, signed in, landed directly on `/panel` with the real dashboard rendered.

## 9z18. P7c, slice 9 — inline editing for cheap fields (availability, sort order) — 2026-08-27

`docs/ARCHITECTURE.md` §16A.5: "Inline editing in grids for the cheap fields... so a five-second change is not a page navigation." Scoped to the 6 catalogue entities sharing `EntityDataGrid`: Kategorie, Produkty, Materiały, Wykończenia, Wzory, Kolekcje.

### Half the infrastructure already existed

Every one of the 6 entities already had a `setXActive`/`setXAvailable`-style quick-toggle Server Action from P7b's CRUD slices — `applySetCategoryActive`/`setCategoryActive`, and the equivalent for Product/Material/Finish/Design/DesignCollection — apparently built for a details-page toggle, never wired into a grid. This slice's real new work was one `setXSortOrder` action per entity (mirroring the existing pattern exactly) and the grid wiring itself.

### `Switch`, not `DataGrid`'s own boolean `editable` column

MUI's `type: 'boolean'` editable column needs a double-click to enter edit mode, a click on the checkbox, then a commit — clunky for what the architecture doc calls a "toggle." A `Switch` in a `renderCell`, firing its `onChange` on a single click and calling the existing action directly, matches "toggle" literally. Sort order, in contrast, is exactly what `DataGrid`'s real `editable`/`processRowUpdate` mechanism is for (a plain number, double-click, type, Enter/blur commits) — no reason to hand-roll that one.

### A real interaction bug, caught in design before it shipped

`EntityDataGrid`'s `onRowClick` fires on any click in a row, including the first click of a double-click-to-edit on a newly-`editable` cell. Without a guard, clicking to edit `sortOrder` would navigate away before the edit could start. Fixed with a grid-level `onCellClick` that calls `event.stopPropagation()` whenever `params.colDef.editable` is true — the documented MUI X Data Grid pattern, same principle as the existing Link-cell columns' own `onClick={(e) => e.stopPropagation()}`, just at the grid level since an editable cell has no child element to attach that to.

### `showToolbar` boolean column editing isn't what "toggle" means, and MUI's toolbar assumptions bit again

No new bug here beyond what slice 8 already found (`showToolbar` + `slots={{toolbar: GridToolbar}}` together) — just confirming it still holds with the new columns present.

### Live verification found two real, unrelated bugs

1. **Browser-automation coordinate math was wrong, not the app** — screenshot-based click coordinates need scaling to the real viewport (a 1200×800 viewport photographed at 800×533 needs an 0.667 scale factor applied to any click target computed from the DOM), and `ctrl+a` still doesn't select-all inside a `DataGrid` numeric cell editor (same quirk already logged for a plain `TextField`) — worked around by setting the input's value via the native setter + dispatching a real `input` event, and committing via a dispatched `KeyboardEvent('keydown', {key: 'Enter', ...})` rather than the `computer` tool's `key` action (which didn't produce an event `DataGrid`'s internal handler recognized). Confirmed via the dev server's own request log (`setCategorySortOrder(...)` actually firing), not just DOM state — the DOM read was showing an in-flight, not-yet-settled value at first.
2. **A real, pre-existing determinism bug, not caused by this slice but newly visible because of it**: `orderBy: { sortOrder: 'asc' }` alone has no tiebreaker. This dev seed data has every material's `sortOrder` defaulted to `0` (never customized) — Postgres doesn't guarantee stable ordering across repeated queries for tied sort keys, so the row at position 0 could be a genuinely different database row on every `router.refresh()`. Caught live: a verification click aimed at "Gres biały" landed on "Dąb" instead, on the very next refresh. Fixed by adding `id` as a secondary sort key to all 6 list queries (`orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }]`) — a small, low-risk, directly-justified addition beyond the slice's original plan. FAQ/Strony's own identical `orderBy: { sortOrder: 'asc' }` pattern was deliberately left untouched — out of scope this slice (no quick-toggle action exists for them yet), noted for whoever picks that entity up next.

Both issues were fixed, and the two disposable-looking-but-real state changes made while diagnosing them (a category's `sortOrder`/`isActive`, two materials' `isAvailable`) were restored to their original values via a one-off script before moving on — dev data used for live verification, not a throwaway sandbox.

### Verified

`npm run typecheck && npm run lint && npm test && npm run build` clean (561/561 tests, 561 stable across 3 consecutive full-suite runs — the dashboard test flakiness from slice 8 recurred once more here, purely from adding more concurrent order-creating test files, not a regression in the dashboard logic itself; fixed properly this time by pinning `getDashboardKpis`'s date-scoped tests to a far-future `now` fully decoupled from any other test file's real-wall-clock fixtures, and switching its two non-date-scoped fields to absolute lower-bound assertions instead of before/after deltas, which can go negative from unrelated concurrent cleanup). Live-verified end-to-end via the dev server's own request log for every mutation (not just DOM state, which can read stale mid-flight): `Switch` toggle → `setMaterialAvailable(id, false)` → real DB write → `router.refresh()`; `sortOrder` cell edit → `setCategorySortOrder(id, 99)` → real DB write → the list re-sorted with the edited row moving to its new position, proving the whole round trip including re-ordering. Confirmed no accidental row-click navigation fires when interacting with either editable field.

## 9z19. P8 — Pricing admin (versioned rates, mandatory simulator) — 2026-08-27

Built autonomously — the owner gave standing authorization mid-session to keep working toward "no missing pages, functionality, design and UI" across the storefront and admin panel without stopping to ask each time. Surveyed `docs/CHECKLIST.md` for the single biggest concrete gap: P8's pricing admin was entirely unbuilt — there was no way to change `PricingSettings` through the panel at all, only a raw DB edit. `docs/ARCHITECTURE.md` §16A.1 module 7 calls this the "highest-risk screen in the application," and the schema had already been designed for exactly this (`PricingSettings.version` as `@id`, `isActive`/`publishedAt`/`publishedByEmail`/`notePl` sitting unused since the seed script, whose own comment said "versioning happens through the (future) admin pricing screen, never here").

### Scope: only `PricingSettings`' own 5 fields

Machine rates (CNC/laser), module surcharge, VAT rate, packaging tiers. "Material and finish rates, product base and minimum price" (also named in module 7) are already editable via the existing Materials/Finishes/Products CRUD from P7b — not duplicated here.

### A real research mistake caught before it shipped: packaging tiers ARE consumed

While planning, a `grep -rn "packagingTiers" src/domain/pricing/*.ts` came back empty and I concluded the field was captured but never applied to any price — and wrote that into the plan. It was wrong: the evaluation logic lives in `src/server/mapping/to-domain.ts` (the mapping layer, not the pure domain layer), not where I searched. `packagingGroszeFor` evaluates the tiers in order and is wired into every real price via `toPricingInput` — and, more importantly, **throws** if no tier matches a configuration's size ("no matching tier is an error rather than a zero," per that function's own comment, a deliberate choice: silently shipping a large order for free is a loss discovered in the accounts, not the code). That means a pricing draft whose last packaging tier isn't a genuine unbounded catch-all (`maxAreaM2: null, maxModules: null`) could crash real checkout pricing the first time a customer configures something outside every bounded row. Caught this before writing any code by reading the actual consumer function, not by testing after the fact — `applyCreatePricingDraft` now validates the last tier is a real catch-all, a genuine safety check this screen didn't have before.

### The simulator reuses the real configurator pricing path

`getConfiguratorProductData(slug)` + `priceConfiguration(...)` (`src/server/repositories/configurator.ts`, `src/server/configurator/price-configuration.ts`) are the exact functions the live storefront configurator calls on every selection change. `simulatePricingDraft` calls them twice per reference product — once with the real active `PricingSettings` row, once with its 5 rate fields overridden by the draft's — and diffs the two `priceBreakdown.unitGrossGrosze`s. Three real seeded products, looked up by slug (not id, which doesn't survive a reseed): `obraz-drewniany-z-grawerem` (simplest case), `stolek-loftowy-z-grawerem` (CNC + thickness sensitive), `panel-podlogowy-z-grawerem`. Each priced at its own `minWidthMm`/`minHeightMm` with its first available material/finish/design — deterministic, always valid, zero new selection logic.

Live-verified by actually doubling the CNC rate in a real draft: the simulator showed +18,45 zł and +28,83 zł on the two CNC-sensitive products and **exactly 0,00 zł** on the third — a real, differentiated, useful result (that product's price is evidently dominated by something the CNC rate doesn't touch at its reference configuration), not a flat across-the-board bump that would have suggested the simulator wasn't really running distinct calculations per product.

### Never edit in place, genuinely

No `applyUpdatePricingVersion` exists anywhere — `applyCreatePricingDraft` always inserts a new row (`version = max(existing) + 1`, `isActive: false`), and `applyPublishPricingVersion` is the only thing that ever flips `isActive`, atomically (`prisma.$transaction`: deactivate whatever was active, activate the target) — audit-logged with a full diff of the outgoing and incoming rates. A draft that's never published is just an inert row.

### "Publish blocked until simulation viewed" and the confirm() gap

The simulator runs on mount inside its own client island (`PricingSimulator.tsx`) — no separate "run simulation" button, so there is no path to the Publish button that skips ever seeing the table. Publish itself uses a real `window.confirm()` — no MUI Dialog-based confirmation pattern exists anywhere in this codebase yet ("Confirmation dialogs only for irreversible actions" is still an open `docs/CHECKLIST.md` item), so a native blocking confirm for a genuinely irreversible, site-wide price change is the honest choice for now rather than skipping the confirmation step or inventing a one-off styled dialog for a single call site.

### The load-bearing test doesn't recompute anything

"Existing orders unchanged after a rate change" is true by construction — `OrderItem.pricingVersion`/`snapshot` are an immutable JSON snapshot, never a live join to `PricingSettings`. The test in `tests/integration/admin-pricing.test.ts` proves this the most direct way possible: seed a real `Order`/`OrderItem` under the currently active version, publish a brand new version with drastically different rates (999 999 grosze machine rates), then re-fetch the `OrderItem` and assert its `lineGrossGrosze`/`pricingVersion`/`snapshot` are byte-identical to what was inserted — no recomputation happens anywhere in that path, so if this ever broke it would mean something started reading `PricingSettings` live at order-display time, a real regression this test would catch.

### Verified

`npm run typecheck && npm run lint && npm test && npm run build` clean (569/569 tests; one unrelated transient 5s timeout in `upload.test.ts` under heavy parallel load, reproduced as passing cleanly in isolation, not a real regression — ran the full suite three times total to confirm). Live-verified end to end as the real admin account: created a draft doubling the CNC rate, watched the simulator resolve with real differentiated numbers, published it, confirmed `/panel/ceny` showed the new version active and the old one archived. Restored the dev DB's real active pricing back to the original seed rates afterward via the same real versioned-publish mechanism (a third version, same rates, a note explaining why) rather than leaving the doubled test rate live for the owner's own testing — the audit trail records all three versions honestly rather than hiding the detour.

## 9z20. Transactional order-status emails (P6's last open item) — 2026-08-27

Built autonomously, continuing straight from the pricing admin slice. P6's checklist had one open item left: "Transactional messages in Polish for each order status" — only `order-confirmation` and `verification-otp` were ever wired; nothing sent mail when a staff member moved an order forward.

### One generic template, not one per status

`docs/ARCHITECTURE.md` §14 doesn't specify a template per status — a single `'order-status-update'` `MailTemplate` (`mailer.ts`), parameterised by `{orderNumber, statusPl}`, covers "each order status" literally via interpolation rather than ten near-identical hardcoded templates. DB-editable through the existing `EmailTemplate` admin screen (P7b slice 7) for free — no new admin UI needed, just a new seeded row (`prisma/seed.ts`'s `seedEmailTemplates()`, same create-only-if-absent discipline as every other singleton/reference row this project seeds).

### The right status label, not the nearby one

`applyOrderStatusTransition` (`admin-orders.ts`) already had `adminOrderStatusLabel()` (`content/pl/admin.ts`) sitting right there, imported for the staff UI — using it for the customer email would have been the easy, wrong choice. `content/pl/messages.ts`'s `orderStatusMessage()` is the real customer-facing label (already used on the customer's own `/moje-konto/zamowienia` page) — the two are deliberately allowed to diverge (staff copy can be terser/more internal), so reusing the admin one would silently couple customer wording to whatever the staff screen happens to say.

### A real privacy call, made deliberately, not by omission

Designed the mail data type with a `notePl` field at first — `applyOrderStatusTransition`'s own `notePl` parameter (the CANCELLED-mandatory audit note, shown in the staff order-event timeline) was right there to forward. Caught before writing the email-rendering code: that field has never been vetted as customer-safe — a staff member typing an internal-only reason into "why cancelled" has no signal today that it might land in a customer's inbox. Removed the field entirely rather than shipping a privacy footgun; `OrderStatusUpdateMailData` only carries `{orderNumber, statusPl}`. Spawned a background task suggesting a real, separate customer-facing message field (distinct from the audit note, clearly labelled) as a genuine future improvement — not something to silently skip without a trace.

### The subject line got better because a test caught a real gap

First draft's subject was `Aktualizacja statusu zamówienia {orderNumber}` — the status itself only appeared in the body. `UnconfiguredMailer` (this dev environment's real mailer, no `RESEND_API_KEY` set) only logs the *subject*, not the body — so a test asserting the log contained the new status name genuinely failed, for a real reason: a customer scanning their inbox would see "Aktualizacja statusu zamówienia 2026/08/0065" and have to open the email to learn anything. Changed the subject to `Zamówienie {orderNumber}: {statusPl}` — a real, if small, UX improvement a plain "add a mailer call" pass wouldn't have surfaced, found because the test infrastructure happens to only see what a real inbox preview would show too.

### Verified

`npm run typecheck && npm run lint && npm test && npm run build` clean (571/571 tests — 2 new in `mailer.test.ts` covering the new template's rendering and DB-override behavior, matching `order-confirmation`'s own existing test pattern exactly). Re-ran `npm run db:seed` against both the dev and test databases to add the new `EmailTemplate` row (create-only-if-absent, confirmed idempotent — every other row logged "already exists, leaving it alone"). Live-verified end to end as the real admin account: transitioned a real order (`2026/08/0065`, `AWAITING_PAYMENT → CONFIRMED`) and confirmed the dev server's own log showed a real send attempt — `Zamówienie 2026/08/0065: Potwierdzone` — to that order's real customer email, and the panel's Szablony e-mail list now shows "Zmiana statusu zamówienia" as a real, editable row.

## 9z21. Soft-delete invariant, audited and proven — 2026-08-27

Small, quick follow-up while surveying remaining gaps: `docs/CHECKLIST.md`'s "Soft delete enforced for entities referenced by orders" (§16A.2 invariant #2) was unchecked, but turned out to already be true by construction, not a real gap to build — the value here was in *proving* it rather than leaving it as an architectural claim. `grep`'d the whole codebase for a hard-delete call on any of the 6 core catalogue entities: zero real matches, only Prisma's own generated JSDoc examples. Went one level deeper than "no delete button exists," though: `OrderItem` has no live FK to Product/Material/Design/Finish at all — checked the schema directly. New `tests/integration/soft-delete-invariant.test.ts` proves this at the DB level, not just by absence: hard-deletes a `Material` a real order's snapshot references (bypassing the app entirely — it has no path to do this itself) and confirms the order's stored data is byte-identical afterward. 572/572 tests, build clean; no UI/page change, so no browser verification needed for this one.

## 9z22. Blog admin CRUD — 2026-08-27

Continuing autonomously: `docs/CHECKLIST.md`'s "Blog admin/authoring" line had been open since §9o (the blog itself shipped with 4 seeded placeholder posts and zero way to manage them beyond a manual DB insert). Built the missing admin screen.

### Mirrors `admin-static-pages.ts`, not a new pattern

`BlogPost` and `StaticPage` are structurally close (slug, title/body, SEO fields, `isActive`, `sortOrder`) — `admin-blog.ts` (repository + actions) and `BlogPostForm.tsx`/`BlogPostsDataGrid.tsx` copy that existing, already-proven CRUD shape directly: `requireStaffSession()`-gated (not admin-only — matches `admin-static-pages.ts`'s own choice, blog authorship is a staff task), `applyCreateBlogPost`/`applyUpdateBlogPost`/`applySetBlogPostActive` (no hard delete, same as every other catalogue entity), plain-text `imageUrl` field rather than the heavier Material/Design upload widget (mirrors `CategoryForm.tsx`'s precedent — low-frequency content, a pasted URL is enough).

### The one genuinely new piece: `publishedAt` as a real draft/scheduled/published control

`blog.ts`'s public query already encoded draft/scheduled/published semantics via `publishedAt` (`null` = draft; future = scheduled; past + `isActive` = live) — but until now only the seed script could ever set it. `BlogPostForm`'s date input is the first UI to expose this, with an explicit hint (`blogPostPublishedAtHintPl`) rather than leaving the null-means-draft behavior undiscoverable. `BlogPostsDataGrid`'s `publishStatus()` helper renders the matching chip (Wersja robocza / Zaplanowany / Opublikowany) client-side from the same three-way rule.

### Applied the P7c slice-9 tiebreaker lesson proactively

`listBlogPostsForAdmin`'s `orderBy: [{sortOrder:'asc'}, {id:'asc'}]` was written with the `id` tiebreaker from the start — no repeat of the non-deterministic-ordering bug that slice 9 (§9z18) had to discover and fix after the fact on the other 5 entities.

### Deliberately deferred, not dropped

Blog posts are not yet a 5th entity type in the Ctrl+K global search (`admin-global-search.ts`/`GlobalSearch.tsx`, §9z12) — a real, scoped follow-up, left unchecked rather than silently expanded into this slice.

### Verified

`npm run typecheck && npm run lint && npm test && npm run build` all clean (577/577 tests — 5 new in `tests/integration/admin-blog.test.ts`, mirroring `admin-static-pages.test.ts`'s pattern). Live-verified in the browser end to end: "Blog" nav entry appears in the Treść group and opens the real list of the 4 seeded posts (all correctly "Opublikowany"/"Aktywna") → created a real disposable test post via `/panel/blog/nowy` with `publishedAt` left empty → confirmed the grid showed "Wersja robocza" and the post was genuinely absent from the public `/blog` page → edited it to set a past `publishedAt` → confirmed the grid flipped to "Opublikowany" and the post appeared live on `/blog` (correctly sorted by publish date) and at `/blog/test-wpis-blog-e2e` with the real body text → deleted the disposable post and its audit-log rows directly from the dev DB afterward, restoring the exact original 4-post state.

## 9z23. Activity timeline on every record, from the audit log — 2026-08-27

Continuing autonomously through §16A's admin-UX checklist: `AuditLog` has captured every mutation since P7a, and the cross-entity `/panel/dziennik-zdarzen` viewer (§9z8) already surfaces it — but nothing showed a single record's *own* history on that record's own page. A staff member investigating "why is this material unavailable" had to go filter the global log by hand.

### One shared component, no new writes

New `listAuditLogsForEntity(entity, entityId)` (`admin-audit-log.ts`) — same `AuditLog` table, same shape as the existing `listAuditLogs`, just scoped `where: {entity, entityId}` instead of the cross-entity filters. `RecordActivityTimeline.tsx` (new, `src/ui/islands/admin`) is a plain **async Server Component**, not a client island — it takes `{entity, entityId}` and fetches internally; no interactivity needed, so no reason to ship it to the client. Reuses the existing `adminAuditActionLabel()` for the action label, same diff-as-`<pre>`-JSON rendering `dziennik-zdarzen`'s own table already uses.

### Wired into all 14 detail pages that have a single-record identity

Every admin route with a real `[id]`/`[slug]`/`[key]`/`[version]`/`[designId]`/`[orderNumber]` detail page: Kategorie, Produkty, Materiały, Wykończenia, Wzory, Kolekcje, Strony, FAQ, Blog, Klienci, Weryfikacja projektów, Zamówienia, Cennik, Szablony e-mail. (Left out, correctly: Opinie and Personel — both are flat lists with inline row actions and no detail sub-page to embed a timeline on.) One `<RecordActivityTimeline entity="X" entityId={record.id} />` line per page, placed after that page's existing form/editors.

### The one real gap this surfaced: `AdminOrderView` never carried `order.id`

Every other entity's admin detail-page loader already selects `id`. `findOrderForAdmin` (`admin-orders.ts`) never did — the order page is keyed by the human `orderNumber`, and every `writeAuditLog` call for `Order` uses the real `order.id` (a cuid) as `entityId`, not `orderNumber`. Added `id` to `AdminOrderView` and its `select`/return — a genuinely necessary, narrowly-scoped repository change, not scope creep. Verified this exact path live: `/panel/zamowienia/2026%2F08%2F0001` now shows a *fuller* history than the existing "Historia statusów" section (which only reflects `OrderEvent` rows) — the new timeline also surfaces the `paymentStatus: AWAITING → PAID` audit entry that `OrderEvent` never recorded, a real, previously-invisible piece of that order's history now visible for the first time.

### Verified

`npm run typecheck && npm run lint && npm test && npm run build` all clean (579/579 tests — 2 new in `admin-audit-log.test.ts` covering `listAuditLogsForEntity`'s scoping and its empty-history case). Live-verified in the browser across entity shapes, not just one: a `Material` with real prior mutations (§9z18's own sortOrder/availability edits) rendered its correct, ordered diff history → the real seeded order `2026/08/0001` rendered its full mutation history including the payment-status update the existing status timeline doesn't show → a fresh `Category`/`Customer`/`EmailTemplate` (string-keyed, not a cuid) each correctly rendered the honest empty state, confirming the component works across `entityId` shapes (cuid, order id, template key). Found and flagged, not fixed inline (out of this slice's scope, spawned as a background task): a real, pre-existing hydration mismatch on `ProductImagesEditor`'s upload form (`encType` differs server/client), reproduced on a fresh tab, unrelated to this change.

## 9z24. Duplicate action on Products, Designs, Materials — 2026-08-27

Continuing autonomously through §16A's admin-UX checklist. Building a near-identical variant of an existing product/design/material (e.g. the same wooden material in a slightly different finish, or a design that only needs one detail changed) meant retyping every field from scratch — no "start from a copy" path existed anywhere in the panel.

### Scoped deliberately: core record only, not relations

Product has 5 related child tables (preset sizes, thicknesses, material/design compatibility, install variants, images); Design has material compatibility; Material has finish compatibility. All three are frequently specific to the *particular* record, not implied by a near-duplicate — copying them silently would misrepresent the new record as more "ready" than it is. `applyDuplicateProduct`/`applyDuplicateDesign`/`applyDuplicateMaterial` copy only the core scalar fields, matching the entity's own `applyCreateX` input shape exactly (built by reading the original row and re-assembling that same typed input, not a raw SQL clone). Design/Material's image files (`thumbnailUrl`/`previewUrl`/`imageUrl`) are reused by reference, not re-uploaded — the duplicate starts pointing at the same physical file until staff replaces it via the normal edit form, avoiding the complexity of a server-side file copy for a same-session convenience action.

### Two small, real decisions, applied consistently across all three

- **New slug is a free `-kopia`/`-kopia-2`/... variant**, not user-chosen — new shared `nextAvailableSlug()` (`src/server/util/unique-slug.ts`, the project's first `src/server/util/` module) takes the collision check as a callback rather than a Prisma model name, so the same function serves `Design`'s two independently-unique fields (`slug` AND `code`) as well as `Product`/`Material`'s single `slug`.
- **The duplicate always starts inactive/unavailable**, regardless of the original's state — a half-set-up copy (no relations yet, no reviewed pricing) should never silently go live identical to its source. `namePl` gets a visible `(kopia)` suffix so it's never confused with the original in a list, even before a human renames it.

### Zero-client-JS button, matching `ActiveToggleButton`'s own precedent

New shared `DuplicateButton.tsx` (`src/ui/primitives`) is the same `<form action={...}>`-bound-to-a-Server-Action shape as the existing `ActiveToggleButton` — no client component needed for a single submit button. Because there's no form data to echo back on failure (the id comes from a record already loaded on the page, so a real failure isn't reachable from the button), the bound actions (`duplicateProductAndGo`/`duplicateDesignAndGo`/`duplicateMaterialAndGo`) call `redirect()` directly from inside the Server Action on success — no client-side `useActionState`/`router.push` round trip needed for this one, unlike the multi-field forms elsewhere in the panel that do need to echo validation errors.

### Verified

`npm run typecheck && npm run lint && npm test && npm run build` all clean (586/586 tests — 7 new: 3 in `admin-products.test.ts`, 2 each in `admin-designs.test.ts`/`admin-materials.test.ts`, covering the core-field copy, the `-kopia`/`-kopia-2` collision path, and the not-found case). Live-verified in the browser end to end, restarting the dev server first after a stale-compile artifact briefly showed an unrelated transient error that cleared on restart: clicked "Duplikuj" on the real seeded `Gres biały` material — landed on `Gres biały (kopia)` with `gres-bialy-kopia`, "Aktywuj" (correctly inactive), every core field copied, and a real audit-log `create` entry recording `duplicatedFromId` → same for the real seeded `WZR-001` design — landed on the copy with both `slug` and `code` suffixed `-kopia`, the same reused thumbnail/preview images. Both disposable duplicates deleted from the dev DB afterward, restoring the original 3-material/2-design state.

## 10. Working style the owner expects

Be direct. Flag genuine risks rather than agreeing pleasantly — the previous
session's most useful contributions were catching that MUI fights SEO on the
storefront, that "no admin panel" left no honest way to approve designs, and
that three Polish-locale assumptions were wrong. If something in this handover
looks mistaken, say so.
