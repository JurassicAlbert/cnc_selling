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
src/content/pl/messages.ts                 every customer-visible Polish string
tests/unit/*.test.ts                       11 files, 298 assertions
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

**P0 is complete; P2's data layer has started** — built across 2026-08-23:
data layer, Next.js/MUI shell, a linter swap after TypeScript 7 turned out to
be incompatible with the obvious choice, then real catalogue content once
the owner gave the real category list. Full detail, in the order it was
built, is in §9a (seed script), §9b (the machine-thickness feasibility
rule), §9c (the app shell, and the ESLint → Biome switch), and §9d (the
catalogue — two new product types, on-brand placeholder imagery, 6
categories, 5 products). Headline inventory:

```
prisma/schema.prisma                    33 models, validated, MIGRATED — applied to a live database
docker-compose.yml                      Postgres 16, dev + test databases, running on host port 5433
prisma/seed.ts                          structural baseline + real catalogue — §9a, §9d
scripts/generate-placeholder-images.mjs on-brand SVG placeholders, not stock photos — §9d
src/server/mapping/to-domain.ts         Prisma rows -> domain inputs. The seam. Unit-tested.
next.config.ts, src/app/, src/ui/       Next.js 16 App Router shell + MUI v9 theme — §9c
playwright.config.ts, tests/e2e/        desktop + mobile, one smoke test green on both — §9c
biome.json                              linter + formatter; the @mui/material restriction lives here — §9c
scripts/check-polish-literals.mjs       the Polish-literal check — a script, not a Biome rule, on purpose — §9c
```

`src/generated/prisma` is the generated Prisma client. Gitignored, rebuilt by
`npm install` (postinstall) or `npm run prisma:generate`, never edited.
`next-env.d.ts` is likewise gitignored and Next-generated; Next can also
rewrite `tsconfig.json`'s `compilerOptions` in place (`jsx`, `allowJs`,
`include`) on `dev`/`build` — expected behaviour, not a regression to revert.

**Still not started:** category and product RSC pages (§9d explains why
that's deliberately a separate pass), `generateMetadata`, sitemap, robots —
the rest of P2's checklist items.

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

## 10. Working style the owner expects

Be direct. Flag genuine risks rather than agreeing pleasantly — the previous
session's most useful contributions were catching that MUI fights SEO on the
storefront, that "no admin panel" left no honest way to approve designs, and
that three Polish-locale assumptions were wrong. If something in this handover
looks mistaken, say so.
