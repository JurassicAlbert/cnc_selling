# CNC Selling — Implementation Checklist

Reviewed item by item before the project is considered finished (brief §40–41).
`[ ]` not started · `[~]` in progress · `[x]` done and verified by a passing test or manual check.

**Last verified: 2026-08-23** — `npm test` 298/298 green, `npm run typecheck` clean, on Node v22.15.0 /
TypeScript 7.0.2 / Vitest 4.1.11 / Prisma 7.9.1. P1 is now genuinely complete (all 7 modules from
ARCHITECTURE.md §22). `domain/compatibility` and `domain/order-status` were correctly left unchecked
here all along — the overstatement was `docs/HANDOVER.md`'s prose claiming P1 "is complete and
delivered", which this checklist never actually agreed with. The P0 data layer is running (Docker
Postgres up, migration applied). The Next.js app shell is not started.

---

## P0 — Foundation

- [x] Repo initialised, TypeScript `strict: true` — TS strict + `noUncheckedIndexedAccess` verified green (TS 7.0.2); git repo pushed to github.com/JurassicAlbert/cnc_selling
- [x] Vitest configured, `npm test` runs — 9 files / 252 tests green, ~1 s (verified 2026-08-23)
- [ ] Playwright configured, desktop + mobile projects
- [x] Docker Postgres for local dev and tests — `docker-compose.yml` running (Postgres 16, separate dev and test databases, `unaccent` in both, verified via `psql`); published on host port **5433**, not 5432 — a native Postgres install already owns 5432 on this machine
- [x] Prisma schema + first migration applies cleanly — 33 models; `npm run db:deploy` applied `20260823000000_init` to a live database, all 34 tables + `_prisma_migrations` confirmed via `\dt`, hand-written CHECK constraints and the `PricingSettings_single_active` partial unique index confirmed present (verified 2026-08-23)
- [x] Seed script structure in place — `prisma/seed.ts`, `npm run db:seed`, verified against both the dev and test databases (2026-08-23). Deliberately structural only: `MachineSettings` (real 600×500×100mm), `PricingSettings` v1 (`TODO_PRICING` placeholders, append-only — reruns never touch it once created), the first `ADMIN` from `SEED_ADMIN_EMAIL`. **No catalogue content** — that's the P2 item below, and needs the owner's product/material/design decisions, not invented copy
- [ ] MUI theme implemented (palette, typography, radius, shadows, no uppercase buttons)
- [ ] CSS-variables theme so RSC pages consume brand tokens
- [ ] RSC / client-island boundary documented and enforced
- [ ] Lint rule: no Polish string literals inside components
- [ ] Lint rule: no `@mui/material` imports in `(marketing)` / `(shop)` server components
- [x] Prisma row → domain mapper (`src/server/mapping/to-domain.ts`) with unit tests — 35 assertions including an end-to-end priced derivation; a renamed column breaks compilation instead of changing a price
- [~] `src/content/pl/` module wired up — `messages.ts` exists and is used by the domain tests; no app consumes it yet

## P1 — Domain core (pure, tests first)

- [x] `domain/money` — grosze arithmetic, VAT, half-up rounding, formatting
- [x] Polish pluralization helper, tested at 1 / 2 / 5 / 12 / 22 / 25
- [x] `domain/dimensions` — min, max, exact bounds, aspect ratio, zero, negative, non-integer
- [x] `domain/compatibility` — product↔material, material↔finish, design↔product, design↔material — 17 assertions (`src/domain/compatibility/resolve.ts`), including the "empty DesignMaterial rows means unrestricted, not restricted-to-nothing" rule
- [x] `domain/modules` — split algorithm, exact boundary, sliver avoidance, min module clamp, remainder distribution, infeasible case, grain rotation rule
- [x] `domain/pricing` — every component isolated, rounding at .5, min-price clamp, quantity, version pinning
- [x] `domain/personalization` — length, lines, glyph coverage, Polish diacritics, empty, whitespace-only, emoji
- [x] `domain/feasibility` — thin line at scale, detail level vs size, min text height, boundary equality, notices, machine thickness limit (`THICKNESS_EXCEEDS_MACHINE`, added 2026-08-23 using D7's real 100mm Z-clearance, boundary mutation-tested)
- [ ] `domain/configuration` — step machine, invalid step order, unknown option, incomplete config
- [x] `domain/order-status` — legal and illegal transitions, design-review gate, actor permission — 22 assertions (`src/domain/order-status/transitions.ts`); the transition graph is this project's own design (ARCHITECTURE.md didn't fully specify one), documented in the module's header comment
- [x] Full unit suite green with no DB and no framework imports — 298 assertions, no Next/Prisma/I/O imports (verified 2026-08-23)

## P2 — Catalogue

- [ ] Seed data: materials, finishes, designs, 5 products, preset sizes, installation variants
- [ ] Homepage — hero, categories, how it's made, materials, craftsmanship, details, patterns, reviews, FAQ, CTA
- [ ] Category pages at the specified Polish slugs
- [ ] Product pages — photos, detail shots, variants, description, material, dimensions, production time, starting price, installation info, care instructions, material notes
- [ ] All navigation works, no broken links
- [ ] `generateMetadata` per page from DB fields
- [ ] Canonical URLs
- [ ] Open Graph with real product imagery
- [ ] Schema.org Product + Offer (PLN)
- [ ] Schema.org FAQPage
- [ ] BreadcrumbList on catalogue pages
- [ ] `sitemap.ts` generated from the DB
- [ ] `robots.ts`
- [ ] Catalogue pages server-rendered (no client-side data fetch for content)
- [ ] Lighthouse SEO ≥ 95, LCP acceptable on mobile

## P3 — Configurator

- [ ] Step machine renders the correct steps per product type
- [ ] Design selection works (ready-made, collections, custom)
- [ ] Only sellable designs offered (rights status filter)
- [ ] Material selection works, unavailable options disabled with a Polish reason
- [ ] Size selection — presets and custom dimensions
- [ ] Thickness step for tabletops and floor elements
- [ ] Finish selection filtered by material
- [ ] Personalization with font selection and live text preview
- [ ] Preview updates immediately on every change
- [ ] Preview shows module seams when modular
- [ ] Kitchen installation variants selectable, with diagrams, as the first step
- [ ] Summary states plainly what the customer receives per variant
- [ ] Floor/panel products require exact dimensions and the matching acknowledgement
- [ ] "Blat. Nogi nie są w zestawie." shown on product page, summary and confirmation
- [ ] Price updates correctly on every change
- [ ] Price computed server-side only; client never derives it
- [ ] Price breakdown available and stored
- [ ] Large products correctly represented as modules with a layout diagram
- [ ] Modular build framed as a feature, not a limitation
- [ ] Feasibility warnings shown, with acknowledgement where required
- [ ] Incompatible selections cleared explicitly with an explanation, never silently swapped
- [ ] All configuration combinations validated server-side
- [ ] Configuration persists across page refresh
- [ ] Browser back/forward behaves correctly
- [ ] Sticky price summary on desktop and mobile
- [ ] Configurator usable on mobile

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

- [ ] Cart retains complete configuration
- [ ] Edit configuration from cart
- [ ] Duplicate configuration (deep copy, not quantity)
- [ ] Remove configuration
- [ ] Two different configurations of the same product in one cart
- [ ] Quantity changes recalculate correctly
- [ ] Guest cart merges into user cart on login without loss
- [ ] Checkout collects buyer, invoice (NIP checksum), address, delivery
- [ ] Polish postal code and phone validation
- [ ] Terms and withdrawal-right acknowledgements captured
- [ ] Order creation is a single transaction, rolls back fully on failure
- [ ] Prices recomputed and compared at add-to-cart and at checkout
- [ ] Price mismatch rejected with a clear Polish message, never silently accepted
- [ ] Complete configuration snapshot stored with the order
- [ ] Pricing version pinned per line
- [ ] Order renders identically after catalogue rows are mutated
- [ ] Order numbers unique under concurrency
- [ ] Bank transfer details, order number as title, amount shown
- [ ] No fake payment confirmation anywhere
- [ ] Guest order lookup by number + token, constant-time comparison
- [ ] Order confirmation page and email content correct

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
- [ ] Mobile layout verified
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
