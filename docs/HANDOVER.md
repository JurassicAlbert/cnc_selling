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

## 10. Working style the owner expects

Be direct. Flag genuine risks rather than agreeing pleasantly — the previous
session's most useful contributions were catching that MUI fights SEO on the
storefront, that "no admin panel" left no honest way to approve designs, and
that three Polish-locale assumptions were wrong. If something in this handover
looks mistaken, say so.
