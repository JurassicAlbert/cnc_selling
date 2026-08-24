# cnc_selling

Polish e-commerce for CNC-milled and laser-engraved customizable products.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full design and
[`docs/CHECKLIST.md`](docs/CHECKLIST.md) for implementation progress.

---

## What is in the repo right now

**Phase P1, the pure domain layer** — no Next.js, no network, no I/O. Just the
business rules and their tests.

That ordering is deliberate. Pricing, dimension limits, modular splitting,
personalization validation and production feasibility are the parts where a
bug costs real money, and they are all pure functions — so they can be
test-driven before a single framework dependency exists.

| Module | What it decides |
|---|---|
| `src/domain/money` | Integer-grosze arithmetic, basis-point factors, VAT, half-up rounding |
| `src/domain/text` | Polish plurals, comma decimals, collation, diacritic-insensitive search |
| `src/domain/dimensions` | Size envelopes, aspect ratios, invalid input |
| `src/domain/compatibility` | Which materials, finishes, designs and thicknesses a step actually offers |
| `src/domain/configuration` | The configurator's step machine — which steps exist per product type, and when each is enterable |
| `src/domain/modules` | Splitting an oversize product into aligned modules |
| `src/domain/pricing` | The single source of truth for what a configuration costs |
| `src/domain/personalization` | Engraving text length, lines, and real font glyph coverage |
| `src/domain/feasibility` | Errors, warnings and notices about what can actually be made |
| `src/domain/order-status` | Legal order status transitions, actor permission, the design-review gate |
| `src/content/pl` | Every customer-visible Polish string |

**P0, the foundation** — Prisma schema and migration applied to a running
Postgres, and the Next.js 16 / MUI v9 app shell.

| File | What it is |
|---|---|
| `prisma/schema.prisma` | 33 models, migrated. The header comment states the unit rules the whole file obeys |
| `docker-compose.yml` | Postgres 16, bound to localhost, with a separate test database |
| `prisma/seed.ts` | Machine limits, pricing placeholders, first admin — and the real catalogue: 6 categories, 5 products |
| `scripts/generate-placeholder-images.mjs` | On-brand placeholder SVGs — the design's artwork and the installation diagram only; category/product photos are real sourced stock now, see below |
| `src/server/mapping/to-domain.ts` | Prisma rows → domain inputs. Micrometres to millimetres, basis points to ratios, nullable rows to neutral values |
| `src/app/(shop)/`, `src/app/(marketing)/` | Real category/product pages + homepage, server-rendered from the DB |
| `src/app/theme-vars.css` | The theme as plain CSS custom properties — **not** MUI's client provider; see `docs/HANDOVER.md` §9e before changing `src/app/layout.tsx` |
| `src/ui/icons/` | Plain inline SVG icons — not `@mui/icons-material`, which is client-only and breaks in a Server Component; see `docs/HANDOVER.md` §9h |
| `playwright.config.ts` | Desktop + mobile, against a **production build** (`next build && next start`) — see `docs/HANDOVER.md` §9h for the dev-mode-only navigation race that made this necessary |
| `biome.json` | Linter + formatter (not ESLint — TypeScript 7 isn't supported by `typescript-eslint`; see `docs/HANDOVER.md` §9c) |
| `scripts/check-polish-literals.mjs` | Catches Polish copy leaking into a component instead of `src/content/pl` |

**P3, the configurator — under way.** The step machine, server-side option
resolution, and server-computed price/feasibility, plus the first real MUI
client island wired to real catalogue data.

| File | What it is |
|---|---|
| `src/domain/configuration/steps.ts` | The step machine — per-product-type step lists (§5), step-entry gating (§7.1) |
| `src/server/configurator/` | Option resolution (§7.2) and pricing/feasibility (§10) glue, fixture-tested |
| `src/server/actions/configurator.ts` | The one Server Action every selection change calls — prices are never computed client-side |
| `src/ui/islands/configurator/Configurator.tsx` | The first real MUI client island — renders inside `ThemeRegistry`, exactly what §9e reserved it for |

The catalogue is real data — `loft`, `amulety-i-bransoletki`, `gres`,
`panele-podlogowe`, `obrazy-drewniane`, plus `inne` as an empty catch-all —
with real category and product pages, SEO metadata, JSON-LD, a sitemap and
robots.txt, all generated from the DB. Prices and the one design's artwork
are still placeholders (`docs/HANDOVER.md` §9d); category/product/material
photos are real, freely-licensed stock photography as of 2026-08-24, still
swapped for real photography before launch (§9g). **The storefront was
redesigned 2026-08-24** to match the owner's actual "minimalistic" intent —
restraint in style, not content: a hero (with a pure-CSS orbiting-icon
animation in place of a photo), real trust badges, category tiles, a
filter/sort sidebar, real diacritic-insensitive search, and one honest
product grid, no fabricated reviews or ratings anywhere. See
`docs/HANDOVER.md` §9g/§9h — the latter for four more real bugs the redesign
found and fixed. The homepage's *narrative* sections (hero copy,
craftsmanship, reviews, FAQ) still aren't built — they need the owner's
actual words, and reviews specifically need real customers, not invented
ones. A working configurator exists on every product page — step machine,
real material/design/finish/thickness options, server-computed price and
feasibility — but it is a foundation, not finished: no 2D preview, no
font-backed personalization yet, and nothing is persisted to a cart. See
`docs/HANDOVER.md` §9f.

A Lighthouse audit while building this caught a real bug: the MUI theme
provider was wrapping every page from the root layout, shipping ~154KB of
client JS to pages with zero interactive MUI components. Fixed — see
`docs/HANDOVER.md` §9e before reintroducing `ThemeRegistry` at the root.

---

## Getting set up

```powershell
cd C:\Projects\cnc_selling

# Dependencies, and the generated Prisma client (postinstall).
npm install

# The database. Requires Docker Desktop to be running.
npm run db:up
npm run db:deploy      # applies the initial migration

npm test               # 354 assertions across thirteen files, about a second
npm run typecheck      # TypeScript strict, noUncheckedIndexedAccess, no emit
npm run lint             # Biome + the Polish-literal check
npm run build           # Next.js production build
npm run dev             # http://localhost:3000
```

`npm test` and `npm run typecheck` need no database — every test in `tests/unit`
is pure. `.env` is only needed once you talk to Postgres; copy `.env.example`.

```powershell
npm run test:watch     # re-run on save
npm run e2e             # Playwright, desktop + mobile (installs browsers on first run)
npm run db:logs        # follow the Postgres container
npm run db:down        # stop it, keeping the data
```

---

## Conventions that are not negotiable

**Money is integer grosze.** Never a float, never złoty as a decimal outside
the display layer. Factors are basis points (`11500` = ×1.15). Rounding is
half-up, done on integers, once per component.

**Lengths are integer millimetres.** Field names carry the unit — `widthMm`,
`minLineWidthMm`. Customers type centimetres; `text/numeric-input` converts,
and it accepts `1,2` as well as `1.2` because `parseFloat("1,2")` returns `1`
and would silently mis-size a product.

**Code is English, content is Polish.** Identifiers, tables, tests and
comments in English. The domain layer returns typed codes; `src/content/pl`
turns them into Polish. No user-visible string literal belongs in a component.

**The domain layer imports nothing.** No Next, no Prisma, no I/O. If a
function in `src/domain` needs a rate, the rate is passed in. This is what
keeps the tests fast and the business rules testable without a database.

**Nothing is faked.** No simulated payment, no pretend email delivery, no
"production file" that is really a preview. If an integration does not exist
yet, the code says so.

---

## What comes next

P0 is done. P2 is functionally complete — real catalogue seeded, category
and product pages live, SEO/Schema.org/sitemap/robots all real. **P3, the
configurator, is under way** — its foundation (the step machine, server-side
compatibility/pricing/feasibility, and the first real MUI client island) is
built and browser-verified across three product types; see
`docs/HANDOVER.md` §9f and `docs/CHECKLIST.md`'s P3 section for exactly
what's done and what's still open (the 2D preview, font-backed
personalization, cart/`Configuration`-row persistence, and several smaller
items). Next:

- **P3's remaining pieces** — see the P3 checklist for the itemised list.
- **P2's remaining piece** — the homepage's hero/craftsmanship/reviews/FAQ
  sections, once real content exists for them.

Full phasing in `docs/ARCHITECTURE.md` §22.
