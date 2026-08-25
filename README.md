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
| `src/domain/joinery` | The Yato-yane panel-joining technique — prepared, not yet enabled; see below |
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
| `src/ui/islands/configurator/ConfiguratorPreview.tsx` | The 2D preview (§7.3) — real material photo + design artwork composited, personalization text rendered in the exact chosen font file via the Font Loading API, real module seams |

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
feasibility. Personalization is real too, as of 2026-08-24: a genuine font
(Inter, self-hosted, real cmap-parsed Polish glyph coverage — never assumed)
backs a live text field with real validation, not a placeholder notice — see
`docs/HANDOVER.md` §9j. A persistent 2D preview is also live, same day: a
real material photo, the seeded design's real artwork, the personalization
text rendered in the exact chosen font file, and real module seam lines —
composited from real data throughout, with an honest on-page caption about
what is and isn't final — see `docs/HANDOVER.md` §9k.

A Lighthouse audit while building this caught a real bug: the MUI theme
provider was wrapping every page from the root layout, shipping ~154KB of
client JS to pages with zero interactive MUI components. Fixed — see
`docs/HANDOVER.md` §9e before reintroducing `ThemeRegistry` at the root.

**P5, cart/checkout/order — built 2026-08-24/25.** A customer can actually
buy something now: a real signed guest session (the first cookie-writing
code in this codebase), a real cart with edit/duplicate/remove/quantity, a
real checkout with NIP-checksum/postal-code validation and the real
custom-goods withdrawal-right disclosure, a real atomic order-creation
transaction with a race-free per-year-month order number, real immutable
order snapshots (verified by mutating a live catalogue row and confirming
an existing order's display didn't change), and real guest order
lookup/confirmation. See `docs/HANDOVER.md` §9l for the full account,
including two real bugs an e2e test caught (a `Secure` cookie silently
dropped by Safari/WebKit over plain HTTP, and a validation-error form
losing everything the customer had already typed) and what's honestly
still deferred: real shipping rates and a real bank account number (both
need P7's admin panel to exist first — no such data exists anywhere in
this system, and a fabricated bank account number specifically would be a
real-world harm, not just an ordinary placeholder) and guest-cart-merge-
on-login (needs P6's auth to exist first).

| File | What it is |
|---|---|
| `src/server/session/` | The signed guest session cookie — HMAC, not just random bytes (§9l on why) |
| `src/server/repositories/cart.ts`, `src/server/actions/cart.ts` | Cart reads and mutations — every price/module-layout cached on `Configuration`, never re-derived on view |
| `src/server/orders/create-order.ts` | The one atomic order-creation transaction — re-price, compare, snapshot, insert, clear the cart |
| `src/server/actions/checkout.ts`, `src/ui/islands/checkout/CheckoutForm.tsx` | The checkout form — real Polish field validation, `useActionState`, no client JS beyond that one island |
| `src/domain/checkout/validate.ts` | Real NIP checksum, postal code, phone — pure, unit-tested |
| `src/server/mail/mailer.ts` | The real `Mailer` interface, honestly unconfigured — never fakes a sent email |
| `tests/e2e/checkout.spec.ts` | Add-to-cart → cart → checkout → confirmation, end to end, both browser projects |

**A second design pass — 2026-08-25.** The owner's follow-up feedback that
the storefront still looked "too minimalistic" turned out to mean four
concrete things at once: no real weight in the nav, search buried in the
nav row instead of its own section, a flat page background, and cards
with no shadow or hover state — plus there was no footer anywhere. All
four are fixed: a real spacing/shadow/radius token set in
`theme-vars.css`, a header with an icon mark and a working cart link, a
`SearchBar` as its own section, real shadow/hover/radius on every
product/category card, and a real `Footer` — category links, search, and
two honest "in preparation" stub pages (`/regulamin`,
`/polityka-prywatnosci`) rather than invented legal text or dead links.
Separately, `src/domain/joinery` prepares (but does not enable) a larger
loft-table format joined from multiple panels via a real Japanese joint
(Yato-yane, a grooved-edge spline) — schema fields, domain logic and
customer-facing copy all exist and are tested, but nothing in the app
calls any of it yet; `Product.supportsPanelJoinery` is `false` on every
seeded product. See `docs/HANDOVER.md` §9m for the full account,
including a real inline-style-beats-media-query bug the mobile footer
caught.

---

## Getting set up

```powershell
cd C:\Projects\cnc_selling

# Dependencies, and the generated Prisma client (postinstall).
npm install

# The database. Requires Docker Desktop to be running.
npm run db:up
npm run db:deploy      # applies the initial migration

npm test               # 369 assertions across fourteen files, about a second
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
configurator, is functionally complete** — step machine, server-side
compatibility/pricing/feasibility, the first real MUI client island, font-
backed personalization, and the 2D preview are all built and browser-
verified; see `docs/HANDOVER.md` §9f/§9j/§9k. **P5, cart/checkout/order, is
built** (§9l) — a customer can genuinely place an order today, guest
checkout only. See `docs/CHECKLIST.md` for the itemised state of every
phase. Next:

- **P4, upload & design review** — not started. The one real infrastructure
  decision it needs first: where uploaded files actually live (local disk
  vs. an object store), since nothing about the review workflow can be
  built without a real storage adapter behind it.
- **P6, accounts** — not started. Needed before "guest cart merges into
  user cart on login" (a real P5 checklist item, currently blocked on
  exactly this) can be closed.
- **P7, admin panel** — not started. Needed before shipping rates and a
  real bank account number can be anything but the placeholders P5 uses
  today; see `docs/ARCHITECTURE.md`'s note near §16A for the Materio
  direction already recorded for when this starts.
- **P2's remaining piece** — the homepage's hero/craftsmanship/reviews/FAQ
  sections, once real content exists for them.

Full phasing in `docs/ARCHITECTURE.md` §22.
