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

**Phase P1, the pure domain layer, is complete and delivered.** It has no
Next.js, no Prisma, no database and no I/O. Every rate and limit is passed in
as an argument.

```
src/domain/money/money.ts              grosze arithmetic, basis-point factors, VAT, half-up rounding
src/domain/text/plural.ts              Polish three-form plurals via Intl.PluralRules
src/domain/text/nouns.ts               countable noun table (moduł/moduły/modułów ...)
src/domain/text/numeric-input.ts       comma-decimal parsing, cm -> integer mm, dimension formatting
src/domain/text/collation.ts           Polish sort order, diacritic folding, search matching
src/domain/dimensions/dimensions.ts    size envelopes, aspect ratio, invalid input
src/domain/modules/split.ts            modular splitting, layout, production order
src/domain/pricing/types.ts            PricingInput / PriceBreakdown contract
src/domain/pricing/calculate.ts        the single source of truth for price
src/domain/personalization/validate.ts text length, lines, real font glyph coverage
src/domain/feasibility/rules.ts        errors / warnings / notices about manufacturability
src/content/pl/messages.ts             every customer-visible Polish string
tests/unit/*.test.ts                   9 files, 252 assertions
```

**The data layer landed on 2026-08-23** and is the first half of P0:

```
prisma/schema.prisma                   33 models, validated; see the header comment for the unit rules
prisma/migrations/20260823000000_init  initial SQL, generated offline, NOT YET APPLIED
prisma.config.ts                       Prisma 7 keeps the datasource URL here, not in the schema
docker-compose.yml                     Postgres 16, dev + test databases, localhost-only
docker/postgres-init/01-databases.sql  creates cnc_selling_test and the unaccent extension
.env.example                           DATABASE_URL / TEST_DATABASE_URL
src/server/mapping/to-domain.ts        Prisma rows -> domain inputs. The seam. Unit-tested.
tests/unit/mapping.test.ts             35 assertions, including a full priced derivation
```

Also present: `package.json` (test toolchain + Prisma, no app dependencies
yet), `tsconfig.json`, `vitest.config.ts` (with the `@/` -> `src/` alias),
`.gitignore`, `README.md`.

`src/generated/prisma` is the generated client. It is gitignored, rebuilt by
`npm install` (postinstall) or `npm run prisma:generate`, and never edited.

**Everything else does not exist yet.** No `src/app/`, no `src/ui/`, no Next.js
config, no seed data, no app dependencies installed. The database has never
been started: the migration is written but unapplied.

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
| ~~D4~~ | ~~Real material prices per m², machine rate per minute, module surcharge, packaging tiers~~ | **Resolved 2026-08-23: seed `TODO_PRICING` placeholders**, clearly marked, swapped before launch. Not written yet — needs the seed script (P2) |
| D5 | Product photography — available, or placeholders? | Clearly-marked placeholders, swapped before launch |
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

**D4, resolved 2026-08-23: seed `TODO_PRICING` placeholders**, invented
plausible round numbers, never shown to a customer, swapped before launch.
Not implemented yet — no seed script exists (P2, "Seed data: materials,
finishes, designs, 5 products…" in `docs/ARCHITECTURE.md` §22), and writing
one is a bigger task than resolving the pricing question. What it unblocks:
`prisma/seed.ts` can now be written without waiting on real numbers.

D7 and D4 were the two that made the difference between a structurally
correct engine and one that produces meaningful złoty; both are now resolved,
and P2 seed work is unblocked.

## 10. Working style the owner expects

Be direct. Flag genuine risks rather than agreeing pleasantly — the previous
session's most useful contributions were catching that MUI fights SEO on the
storefront, that "no admin panel" left no honest way to approve designs, and
that three Polish-locale assumptions were wrong. If something in this handover
looks mistaken, say so.
