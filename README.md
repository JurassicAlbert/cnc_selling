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
| `src/domain/modules` | Splitting an oversize product into aligned modules |
| `src/domain/pricing` | The single source of truth for what a configuration costs |
| `src/domain/personalization` | Engraving text length, lines, and real font glyph coverage |
| `src/domain/feasibility` | Errors, warnings and notices about what can actually be made |
| `src/domain/order-status` | Legal order status transitions, actor permission, the design-review gate |
| `src/content/pl` | Every customer-visible Polish string |

**Half of P0, the data layer** — the Prisma schema, the first migration, local
Postgres, and the mapper between them.

| File | What it is |
|---|---|
| `prisma/schema.prisma` | 33 models. The header comment states the unit rules the whole file obeys |
| `prisma/migrations/20260823000000_init` | Initial SQL, including hand-written `CHECK` constraints Prisma cannot express |
| `docker-compose.yml` | Postgres 16, bound to localhost, with a separate test database |
| `src/server/mapping/to-domain.ts` | Prisma rows → domain inputs. Micrometres to millimetres, basis points to ratios, nullable rows to neutral values |

There is no Next.js app, no MUI theme and no seed data yet.

---

## Getting set up

```powershell
cd C:\Projects\cnc_selling

# Dependencies, and the generated Prisma client (postinstall).
npm install

# The database. Requires Docker Desktop to be running.
npm run db:up
npm run db:deploy      # applies the initial migration

npm test               # 298 assertions across eleven files, about a second
npm run typecheck      # TypeScript strict, noUncheckedIndexedAccess, no emit
```

`npm test` and `npm run typecheck` need no database — every test in `tests/unit`
is pure. `.env` is only needed once you talk to Postgres; copy `.env.example`.

```powershell
npm run test:watch     # re-run on save
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

- **P0 completion** — Next.js 16 app shell, MUI v9 theme, the RSC/island lint
  rules, Playwright config. The schema, migration and Docker Postgres are
  already in.
- **P2** — catalogue: seed data, category and product pages as Server
  Components, SEO metadata, sitemap.
- **P3** — the configurator.

Full phasing in `docs/ARCHITECTURE.md` §22.
