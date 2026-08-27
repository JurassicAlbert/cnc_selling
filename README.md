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
found and fixed. **The reviews and FAQ homepage sections were wired to real
data in P7b slice 5 (2026-08-27)** — each renders nothing at all when its
query is empty, never a fabricated testimonial or an empty heading; see
below and `docs/HANDOVER.md` §9z5. The homepage's remaining *narrative*
sections (hero copy, craftsmanship) still aren't built — they need the
owner's actual words. A working configurator exists on every product page — step machine,
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
still deferred: real shipping rates and a real bank account number — both
need P7's admin panel to exist first, no such data exists anywhere in
this system, and a fabricated bank account number specifically would be a
real-world harm, not just an ordinary placeholder. (Guest-cart-merge-on-
login, also listed as blocked here originally, is built — see P6 below.)

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
caught. A same-day follow-up (`docs/HANDOVER.md` §9n) beautified the cards
further — a real category-icon badge on every card, and a "Grawer" pill
that appears only on the three products that genuinely have personalization
enabled, not every card — added a faint sitewide grain texture so the
background isn't a flat single color, and gave the footer a short authored
tagline beside its description. **A third same-day pass**
(`docs/HANDOVER.md` §9o) went further on all three: a bolder blueprint-
grid background texture, a permanent gradient tint on every section plus
a few real decorative corner accents, product cards now show real
production-time/size-range facts and a material chip, and a new `/blog`
section exists as a real, working scaffold — schema, pages, sitemap entry
— with zero fabricated posts; it shows an honest "coming soon" state until
a real one is added. **A fourth same-day pass** (`docs/HANDOVER.md` §9p)
replaced that blueprint-grid texture with a hexagonal "material tile"
motif — mixed outline hexagons and icon-centered tiles concentrated at
section edges, fading toward content, gone entirely on mobile — added the
homepage blog section that was missing, and seeded 4 real placeholder
posts (wood care, the CNC/laser process, materials, personalization) so
both it and `/blog` show real content instead of the empty state. Two
real CSS bugs were found and fixed along the way — full account in §9p.
**A fifth pass** (`docs/HANDOVER.md` §9q, 2026-08-26) replaced every
photo used in hex decoration with 5 original engraved-line-art
illustrations (`src/ui/primitives/engravings.tsx`) so decoration never
duplicates the real photos already on categories/products/blog; rebuilt
the hero's hex visual as one real honeycomb tessellation revealing a
single illustration; reworked `OrbitIconHero` into 3 genuinely distinct
orbits and moved it into its own footer column. Still deferred, on
purpose: the mosaic's illustration becoming a real photo with genuine
scroll-linked parallax — real client-side work this codebase doesn't
have yet, needs its own design pass (§9q's "explicitly NOT done" note).

**P6, accounts & polish — built 2026-08-26.** Real user accounts (Better
Auth — email+password and passwordless email-OTP, chosen over the brief's
literal Auth.js v5 because that library is still beta with no verified
Prisma 7 support), guest-cart-merge-on-login (the P5 checklist item this
was blocked on), order history, saved configurations, a real `Mailer`
adapter over Resend, a first-party RODO consent banner gating real
`AnalyticsEvent` writes, real Regulamin/Polityka prywatności content
(business-identity fields honestly marked as placeholders, not invented),
and sitewide loading/empty/error states including a root error boundary
with a correlation id. The bigger, less visible part: every
`UploadedFile`/`CustomerDesign`/`Configuration`/`Cart` ownership check was
extended from `sessionToken`-only to `userId` **or** `sessionToken` —
§16.1 always specified this, but `userId` was always `null` in practice
until real accounts existed. See `docs/HANDOVER.md` §9x for the full
account, including a hand-authored migration (never `prisma migrate dev`
in this project — §9u/§9x explain why) and a real error-mapping bug found
live in the browser, not by code review.

**P7a, admin panel operational minimum — built 2026-08-27.** Not the full
P7 scope — this project's own `docs/ARCHITECTURE.md` §16A.6 and decision D2b
say the shop launches on P7a alone, with the rest of the panel (catalogue
CRUD, dashboards, `@mui/x-data-grid`) built afterward against a proven
schema. `/panel/*`, gated by role (`STAFF`/`ADMIN` only — a `CUSTOMER`
genuinely gets a 404, not a redirect): a real order list and detail view
with staff-driven status transitions (built on the order-status state
machine that already existed from P5, not reimplemented), marking a
bank-transfer order paid, and a design-review queue with approve/request-
changes/reject. Every mutation writes to `AuditLog` — the model existed
since before P6 but nothing had ever written to it until now. See
`docs/HANDOVER.md` §9y for the full account, including why `middleware.ts`
doesn't exist in this Next.js version (renamed to `proxy.ts`) and why the
panel is the one part of this app built in real MUI components rather than
this codebase's usual CSS-variable convention.

**P7b, catalogue admin (slice 1 of several) — built 2026-08-27.** P7b is
built as vertical slices too, not one pass (§16A.6) — the owner chose
categories + products first. Real CRUD for both (soft-delete only, per
§16A.2 — both are FK targets), plus every one of a product's six related
tables: preset sizes, thicknesses, material compatibility, design
assignment, installation variants, and photo upload (a new, genuinely
public storage adapter, `src/server/storage/public-images.ts` —
deliberately not the same private path customer uploads use). This slice
lets staff associate existing materials/designs to a product, not author
new ones — that's materials/finishes CRUD and designs/collections CRUD,
each a later slice. See `docs/HANDOVER.md` §9z, including a second
`revalidatePath`-in-the-wrong-half mistake caught immediately by the new
integration tests.

**P7b, materials & finishes CRUD (slice 2) — built 2026-08-27.** The
authoring side slice 1 deliberately skipped: `/panel/materialy` and
`/panel/wykonczenia`, real CRUD for `Material`/`Finish`, plus the
`MaterialFinish` compatibility toggle between them. Both models require a
real image (unlike `Category`'s nullable one), so create can't succeed
without a genuine uploaded photo. Also fixed a real, previously-shipped
bug: `<Button component={Link}>` — the standard MUI-in-Next.js styled-link
pattern, used identically on all four `/panel/*` list pages — only
happened to serialize correctly by accident of stale dev-server state; a
routine restart broke all four identically. Fixed by nesting `Button`
inside `Link` instead of passing `Link` as a prop value. See
`docs/HANDOVER.md` §9z2 for the full account, including why this pattern
should now be treated as suspect anywhere else it appears in this
codebase.

**P7b, designs & collections CRUD (slice 3) — built 2026-08-27.**
`/panel/wzory` and `/panel/kolekcje` — authoring for the engraved-artwork
catalogue, including the rights-status/provenance fields the brief treats
as load-bearing. `Design.thumbnailUrl`/`previewUrl` are both required and
distinct, so create takes two genuinely separate uploaded images, not one
derived from the other. New designs default to `REQUIRES_PERMISSION`
(never silently sellable, §12) — backed by an actual regression test, not
just a form default, since the real enforcement (`APPROVED_COMMERCIAL`/
`PUBLIC_DOMAIN`-only) already existed pre-P7. See `docs/HANDOVER.md` §9z3.

**P7b, production queue (slice 4) — built 2026-08-27.** Read-only, unlike
the previous three slices — `/panel/produkcja` (queue grouped by status,
capacity view against `MachineSettings.weeklyCapacityMinutes`, which had
sat unused in the schema since P0) and a printable production brief
(`/panel/zamowienia/[orderNumber]/karta-produkcyjna`, explicitly labelled
not a CNC/laser file). Added one real field, `OrderItemSnapshot.
machiningMilliMinutesPerM2`, since `PriceBreakdown` only ever kept the
resulting cost, never the raw rate — orders placed before this ship show
no machine-minutes contribution, honestly, not backfilled. Live
verification caught a real `NaN` in the capacity total from exactly that
gap (old snapshots have the field genuinely absent, not `null`) — fixed
and reverified. See `docs/HANDOVER.md` §9z4.

**P7b, content: FAQ, static pages, real reviews (slice 5) — built
2026-08-27.** The first slice with no pre-existing schema — `Faq`,
`StaticPage`, and `Review` are genuinely new models, added via a hand-
authored migration. `/panel/faq` and `/panel/strony` are soft-delete-only
CRUD; public `/faq` (with a real Schema.org `FAQPage` block) and
`/strony/[slug]` (chosen over `/[slug]` deliberately, to avoid colliding
with `(shop)/[category]`) render the active rows. Reviews needed a real
submission source before there was anything honest to moderate, so before
building it the owner was asked directly whether to build a minimal real
flow or defer reviews — chose to build it: one `Review` per genuine
`COMPLETED` `Order`, submitted by the customer (guest via the order's
`accessToken`, or logged-in via session), landing `PENDING` and invisible
on the storefront until staff approve it in `/panel/opinie` — whose
actions file contains exactly one mutation, status change, so nothing in
the codebase can author or edit a testimonial in a customer's name
(§16A.1 module 9). Live-verified end to end: a real order walked through
every status to `COMPLETED`, a real review submitted, confirmed pending
and hidden, approved, confirmed live on the homepage, second submission
on the same order refused. See `docs/HANDOVER.md` §9z5.

**P7b, customers + RODO tooling (slice 6) — built 2026-08-27.** No schema
migration — `User.anonymizedAt` had sat unused since before P7, and `Order`
already denormalizes its own `email`/`firstName`/`lastName`, so preserving
order records was already true of the schema. `/panel/klienci` (list +
detail, scoped to real customer accounts only) reuses the existing
customer-facing order-history and saved-configuration queries directly
rather than rebuilding them. RODO export is a genuine downloadable JSON
file from a real route handler; anonymization scrubs identity fields and
revokes sign-in (deletes `Session`/`Account` rows) while leaving orders
and configurations untouched, matching the legal copy's own RODO clause.
Live verification caught a real bug: `requireStaffSession()`'s
`notFound()`/`redirect()` calls don't work inside a Route Handler (only
Server Components/Actions have a boundary for them) — fixed by using
`getSession()` directly, the same way `/api/plik/[fileId]` already had to.
See `docs/HANDOVER.md` §9z6.

**P7b, settings (slice 7) — built 2026-08-27.** Closes three real
placeholders: the hardcoded `SHIPPING_FLAT_GROSZE` constant, the "we'll
send the account number separately" bank-details text, and `User.role`'s
own `input: false` comment noting staff have to be invited from a panel
that didn't exist until now. Inviting staff needed no password-setting
flow at all — Better Auth's existing OTP sign-in path already works for
any `User` row regardless of whether it has an `Account`, so
`/panel/ustawienia/personel` just creates the row; the new staffer signs
in with a code, exactly like a real customer already can. That screen is
the first in the panel gated `ADMIN`-only (`requireAdminSession()`, new),
not just staff. Bank details and the shipping rate are a `StoreSettings`
singleton now read everywhere the old constant/placeholder text was.
Email templates are a genuine new capability: `EmailTemplate` rows
DB-override `mailer.ts`'s hardcoded subject/body, falling back to the
original hardcoded copy when unconfigured — `renderSubjectAndText` itself
is untouched, still the seed source and the safe fallback. Live-verified
end to end, including a real invite → OTP sign-in → ADMIN-only 404 →
revoke → lockout round trip, and a real template edit picked up by the
live `mailer` singleton. See `docs/HANDOVER.md` §9z7.

**P7b, audit log viewer (slice 8) — built 2026-08-27. P7b is complete.**
No schema, no new writes — `AuditLog` and `writeAuditLog()` have existed
since P7a, and every mutation across every slice since has been writing
to it; this is purely the read side. `/panel/dziennik-zdarzen` is
filterable by entity (a dropdown populated from what's actually been
logged, self-updating as future work adds new entities, never a
hardcoded list that would go stale), action, and a search box matching
either the actor's email or a record id. Diffs render as plain
`JSON.stringify` — honest, since `AuditLog.diff` has no fixed shape
across a dozen different entities, and a per-entity formatter would be
real scope beyond what this slice asks for. Live-verified against the
genuine, complete mutation history this entire session's admin work
produced — real actors, real diffs, real timestamps, filters composing
correctly together. See `docs/HANDOVER.md` §9z8.

**P7c, global search (slice 1) — built 2026-08-27.** First slice of the
23-item admin UX-polish list, picked as the starting point because it's
the one standalone feature — everything else in that list depends on
migrating the panel's tables to `@mui/x-data-grid` first, or is a
cross-cutting polish pass over screens already built. Ctrl/⌘+K opens a
command palette (a client island mounted once in the panel layout) that
searches orders, customers, designs, and products in parallel, reusing
each entity's own existing admin list query — two of the four
(`listDesignsForAdmin`/`listProductsForAdmin`) gained an optional,
backward-compatible `search` filter for this; the other two already had
one. The Server Action re-derives `requireStaffSession()` itself, the
first *read* in the panel that needed the same "don't trust the caller"
discipline every mutation already has, since it's invoked via
`fetch`-as-you-type rather than rendered inside an already-gated page.
Live-verified finding a real order, customer, design, and product by
typing a real fragment of each, and navigating to each one's real detail
page. See `docs/HANDOVER.md` §9z9.

**P7c, `@mui/x-data-grid` adoption (slice 2) — built 2026-08-27.** The
foundation most of the rest of the 23-item list depends on — bulk
actions, inline editing, column persistence, and keyboard nav in grids
all need a real `DataGrid`, not a plain MUI `<Table>`. A genuinely new
dependency (`@mui/x-data-grid`, MIT/Community), unlike everything else
added this session — but it's the architecture doc's own documented plan,
not a shortcut. Scoped to one grid, `/panel/zamowienia`, rather than a
sweeping rewrite of all ~15 admin list pages; the rest come one slice at
a time. MUI core's `plPL` locale turned out to already be wired in
`theme.ts` from earlier work, just never exercised — only the DataGrid
locale needed adding alongside it, confirmed live via the real Polish
pagination footer. Live-verifying the grid's row-click surfaced a real,
pre-existing bug: order numbers contain literal `/`, and every admin-side
link to an order detail page built its `href` by interpolating the raw
string, producing a broken multi-segment path — invisible until now
because every prior live-verification navigated there via a manually
encoded URL, never an actual click. Fixed at every site with the same
`encodeURIComponent` the customer-facing order-history page already used
correctly. See `docs/HANDOVER.md` §9z10.

**P7c, `DataGrid` on the catalogue list pages (slice 3) — built
2026-08-27.** Extends slice 2's pattern to six list pages at once —
Kategorie, Produkty, Materiały, Wykończenia, Wzory, Kolekcje — grouped
because they turned out to be genuinely identical in shape (heading + a
"new" button, an optional filter field or two, a 3-4 column table with
one link column and 1-2 status chips), the same reasoning P7b used to
bundle materials+finishes into one slice. Introduced a shared
`EntityDataGrid` primitive this time rather than six more hand-rolled
copies of slice 2's `OrdersDataGrid` — worth the small abstraction once
the boilerplate (row click → navigate, row id, pagination defaults)
showed up a second time on genuinely homogeneous pages; each entity's own
thin file only defines its columns, the one piece that actually differs.
No `encodeURIComponent` needed here, unlike Orders — these six entities
all navigate by a plain slash-free `cuid`. Live-verified two pages end to
end (including Produkty's real filter form and empty state) and
spot-checked the other four rendering real, correctly-labelled rows. See
`docs/HANDOVER.md` §9z11.

**P7c, `DataGrid` on the remaining navigate-to-detail lists (slice 4) —
built 2026-08-27.** Extends `EntityDataGrid` to Klienci, FAQ, Strony, and
Weryfikacja — a third reuse of slice 3's primitive with no changes to it.
Deliberately does *not* touch the other five remaining `<Table>` pages:
Opinie and Personel have per-row action buttons with no detail page to
navigate to; Produkcja's rows link to a different entity's (an order's)
detail page, not their own; Szablony e-mail is a fixed two-row list where
`DataGrid` chrome adds nothing; Dziennik zdarzeń's diff column holds
variable-height JSON that doesn't suit a fixed-row-height grid. Each is a
real design decision for its own future slice, recorded in
`docs/CHECKLIST.md` so it reads as deliberate, not forgotten. See
`docs/HANDOVER.md` §9z12.

**P7c, `DataGrid` with per-row actions (slice 5) — built 2026-08-27.**
Covers two of the three still-deferred pages — Opinie and Personel —
both driven by per-row action buttons (approve/reject a review; revoke a
staff member) rather than a click-to-navigate row, a genuinely different
shape from `EntityDataGrid`'s own. Two small, standalone `DataGrid`
wrappers instead of forcing that primitive to support a case it wasn't
built for. The real `<form action={...}>` mutations underneath — the
same zero-extra-JS pattern every action in this codebase uses — moved
into a grid cell completely unchanged. Live-verified against real
mutations, not just rendering: rejected then re-approved the one genuine
review from P7b slice 5 (restored to its real prior state before
finishing), and invited/revoked a real disposable test staff account.
See `docs/HANDOVER.md` §9z13.

**P7c, raw-HTML-form cleanup (slice 6) — built 2026-08-27.** Direct owner
feedback: any form in the panel should use real MUI, not raw HTML. Two
raw `<button>`s became `Button`; six raw `<input type="file">`s became a
new shared `FileInputButton` — MUI's own documented pattern of a real
`Button component="label"` wrapping a visually-hidden (not
`display:none`, so it stays accessible) native file input. See
`docs/HANDOVER.md` §9z14.

**P7c, Dashboard + Materio-style visual shell (slice 7) — built
2026-08-27.** The big one: a real Dashboard landing page at `/panel`
(9 KPI stat cards, `@mui/x-charts` revenue/orders-by-status/top-entities
charts, a date-range picker, production load) built together with a
Materio-style visual shell — a second, admin-only theme
(`adminTheme.ts`, real elevation and an accent palette, unlike the
storefront's deliberately flattened one) and a grouped icon-led sidebar
(`AdminSidebarNav.tsx`) — per the owner's explicit direction to build
both together rather than redo the chrome twice. Researched the real
Materio template first (Next 14 + MUI 5 + Tailwind + ApexCharts) and
deliberately adopted only its structure/visual language, in real MUI
throughout. Hit and fixed a genuine, non-obvious Next.js bug twice along
the way — a real MUI `Theme` object (or a function-valued `sx` prop)
crashes if it crosses a Server→Client Component boundary as a prop — now
recorded as a general lesson. See `docs/HANDOVER.md` §9z15.

**P7c, persisted dense grids + dashboard click-through (slice 8) — built
2026-08-27.** A new `useGridPreferences` hook (`localStorage`-backed)
wired into all 13 admin grid components: real `density` (compact by
default, a toolbar toggle up to comfortable — MUI's default toolbar
needed both `showToolbar` *and* `slots={{toolbar: GridToolbar}}`
together to actually show the density control, confirmed live) plus
persisted sort/column-visibility, replacing every grid's old hardcoded
row height. Every Dashboard stat card now links through to its records
— Orders gained `dateFrom`/`dateTo` filtering (the repository already
supported it, just never wired at the page level). Caught and fixed a
real test-flakiness bug along the way: the Dashboard KPI tests asserted
absolute counts against an intentionally-unscoped, shared test database
— rewritten as before/after deltas, race-proof under `npm test`'s
parallel file execution. See `docs/HANDOVER.md` §9z16.

**Fix: STAFF/ADMIN land on `/panel` after sign-in, not `/moje-konto` —
2026-08-27.** Found live by the owner: signing in with a real staff OTP
landed on the plain customer account page with no indication `/panel`
was a separate destination. Now does one extra role lookup and
redirects accordingly — not a read off Better Auth's own sign-in
result, since `signInEmailOTP`'s returned `user` doesn't carry the
custom `role` field (caught by `tsc`), unlike `signInEmail`/
`signUpEmail`'s. See `docs/HANDOVER.md` §9z17.

**P7c, inline editing for cheap fields (slice 9) — built 2026-08-27.**
Availability toggle and sort order, editable directly in the grid, on
the 6 catalogue entities. Availability is a `Switch` (single click,
matching "toggle" — MUI's own boolean-column editing needs a
double-click-then-checkbox, clunky for this); sort order is a real
`editable`/`processRowUpdate` number column. Reused the `setXActive`/
`setXAvailable` actions already built in P7b (never wired into a grid
before); added the matching `setXSortOrder` per entity. Found and fixed
a real, pre-existing determinism bug along the way: `orderBy: {
sortOrder: 'asc' }` alone has no tiebreaker, so materials sharing
`sortOrder: 0` (unseeded dev data) rendered in a different order on
every refresh — added `id` as a secondary sort key across all 6 list
queries. See `docs/HANDOVER.md` §9z18.

**P8, pricing admin (versioned rates, mandatory simulator) — built
2026-08-27, autonomously.** The single largest concrete gap left in the
whole panel: there was no way to change `PricingSettings` (machine
rates, module surcharge, VAT, packaging tiers) through the UI at all
before this. `/panel/ceny`, ADMIN only. Genuinely never edits a version
in place — every save is a brand new row, and a real publish workflow
atomically swaps which one is active. The price simulator reuses the
*exact* functions the live storefront configurator calls
(`getConfiguratorProductData`/`priceConfiguration`) against 3 real
seeded products, not a reimplementation — live-verified doubling the
CNC rate and watching two rate-sensitive products move and a third
stay at exactly 0,00 zł, a real differentiated result. Caught a real
research mistake before it shipped: packaging tiers looked unused at
first grep, but are genuinely wired in and **throw** on an unmatched
configuration size — added a real safety validation (the last tier
must be a genuine catch-all) that didn't exist before. The
"existing orders unaffected" invariant has a real test that proves it
directly against a seeded order, not just an architectural claim. See
`docs/HANDOVER.md` §9z19.

**Transactional order-status emails (P6's last open item) — built
2026-08-27, autonomously.** One generic `'order-status-update'` mail
template, DB-editable through the existing Szablony e-mail screen,
fired after every real staff order-status transition — customers now
get notified in Polish as their order actually progresses, not just at
checkout. Uses the real customer-facing status label
(`orderStatusMessage()`), not the staff-facing one. Deliberately
excludes the staff's free-text transition note from the email (never
vetted as customer-safe) rather than silently forwarding it. Live-
verified: a real transition produced a real logged send to the order's
real customer email. See `docs/HANDOVER.md` §9z20.

**Soft-delete invariant, audited and proven — built 2026-08-27,
autonomously.** `docs/CHECKLIST.md`'s "soft delete enforced for
entities referenced by orders" was true by construction already, but
unchecked — a real DB-level test now proves it: hard-deletes a
`Material` a real order's snapshot references and confirms the order's
stored price/data is byte-identical afterward. See `docs/HANDOVER.md`
§9z21.

**Blog admin CRUD — built 2026-08-27, autonomously.** `/panel/blog`,
mirroring `admin-static-pages.ts`'s already-proven pattern (staff-gated,
no hard delete, plain-text image URL). The one new piece: `publishedAt`
is now actually settable from the UI — `null` = draft, a future date =
scheduled, a past date + active = live — matching semantics `blog.ts`'s
public query already had but only the seed script could previously set.
Live-verified end to end: a real disposable draft post was invisible on
the public `/blog` page, then appeared correctly once published. See
`docs/HANDOVER.md` §9z22.

---

## Getting set up

```powershell
cd C:\Projects\cnc_selling

# Dependencies, and the generated Prisma client (postinstall).
npm install

# The database. Requires Docker Desktop to be running.
npm run db:up
npm run db:deploy      # applies the initial migration

npm test               # 500 assertions across thirty-one files, unit + integration
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
checkout only. **P4, upload & design review, is built** (§9w) — the full
validation pipeline (magic bytes, SVG sanitization, PDF inspection, EXIF
stripping), IP consent, the review state machine, an authorizing
file-serving route, and a real configurator step wired into a real
seeded `CUSTOM` product; a customer can genuinely upload their own
design and check out today, verified live end to end including the
order landing in `DESIGN_REVIEW` automatically. **P6, accounts &
polish, is built** (§9x) — real accounts, guest-cart-merge-on-login,
order history, saved configurations, a real mailer, RODO consent +
legal content, and sitewide loading/empty/error states. **P7a, the admin
panel's operational minimum, is built** (§9y) — role-gated order
management with staff-driven status transitions, marking bank-transfer
orders paid, and a design-review queue, all audited. **P7b is complete**
— catalogue admin (categories + products), materials & finishes CRUD,
designs & collections CRUD, the production queue, content (FAQ, static
pages, real customer reviews), customers + RODO tooling, settings (staff
users & roles, bank details, shipping rate, email templates), and the
audit-log viewer are all built
(§9z/§9z2/§9z3/§9z4/§9z5/§9z6/§9z7/§9z8). Real shipping rates and a real
bank account number have now replaced P5's placeholders. **P7c has
started, also as vertical slices** — global search (Ctrl/⌘+K, §9z9),
`@mui/x-data-grid` on Orders (§9z10), `DataGrid` on the six catalogue
list pages (§9z11), on Klienci/FAQ/Strony/Weryfikacja (§9z12), with
per-row actions on Opinie/Personel (§9z13), raw-HTML-form cleanup
(§9z14), and the Dashboard + Materio-style visual shell — a real `/panel`
landing page with KPI stat cards and `@mui/x-charts` charts, a second
admin-only theme, and a grouped icon sidebar (§9z15) — are built, and so
is slice 8 (§9z16) — persisted dense grids (density/sort/columns via a
new `useGridPreferences` hook, `localStorage`-backed) across all 13 grid
components, and every Dashboard stat card linking through to its real,
correctly-filtered records — and slice 9 (§9z18): inline editing
(availability toggle, sort order) on the 6 catalogue grids. A related
fix (§9z17): staff/admin sign-in lands on `/panel` directly now, not
the customer account page. **P8's Dashboard module is correspondingly
checked off in `docs/CHECKLIST.md`**, except the configurator funnel
(needs a new `AnalyticsEvent` model, deliberately deferred, not silently
dropped) — and **P8's pricing admin is now built too** (§9z19):
versioned rates, a mandatory price simulator reusing the real
configurator pricing path, atomic publish, and a real test proving
existing orders stay unaffected. The **soft-delete invariant is now
proven, not just claimed** (§9z21), and **blog admin/authoring is now
built** (§9z22) — the last open item from P2's blog scaffold. See
`docs/CHECKLIST.md` for the itemised state of every phase. Next,
continuing autonomously per the owner's standing direction to close
remaining gaps toward "no missing pages, functionality, design and UI":

- **P7c, the rest of it** — three list pages still use a plain `<Table>`,
  each needing its own design: Produkcja's rows link to a different
  entity's page; Szablony e-mail is a fixed two-row list; Dziennik
  zdarzeń's diff column holds variable-height JSON `DataGrid` doesn't
  suit. Then bulk actions, saved filters, keyboard nav (J/K between
  records), and the rest of the list, one slice at a time.
- **Blog admin's own remaining piece** — not yet a 5th entity type in
  the Ctrl+K global search, a scoped follow-up.
- **P8's configurator funnel** — needs `AnalyticsEvent` + instrumenting
  every configurator step to write events, its own substantial slice.
- **P2's remaining piece** — the homepage's hero/craftsmanship narrative
  sections, still genuinely blocked on the owner's actual words (reviews
  and FAQ are now real, see above) — not something to fabricate.

Full phasing in `docs/ARCHITECTURE.md` §22.
