# CNC Selling — Architecture, Data Model & Implementation Plan

**Project:** Polish e-commerce for CNC-milled / laser-engraved customizable wood & ceramic products
**Phase:** MVP (Phase 1) — no admin panel, no online payments
**Document status:** Proposal for review. No application code has been written yet.
**Date:** 2026-08-23

---

## 0. How to read this document

Sections 1–20 are **decisions**. Section 21 is the **test strategy** that governs how those decisions get implemented (TDD, per project rules). Section 22 is the **ordered implementation plan** with acceptance criteria. Sections 23–25 are **risks, exclusions, and questions I need answered before coding starts**.

Everything user-facing in the product is Polish (`pl-PL`). Everything in the codebase — identifiers, tables, tests, this document — is English. Polish strings appear in this document only as literal UI copy examples.

---

## 1. Build & test workflow

The npm registry is blocked from the two sandboxed environments (cloud container and the Cowork VM both get HTTP 403 at the egress proxy) but **works normally in your Windows PowerShell** (`npm ping` → PONG, `npm install lodash` → success). `C:\Projects\cnc_selling` is on your real disk, so the loop is:

```
Claude writes source files ──▶ C:\Projects\cnc_selling
                                       │
                          You, in PowerShell at the repo root:
                            npm install
                            npx prisma migrate dev
                            npm test
                            npm run dev
                                       │
                          You paste failures back ──▶ Claude fixes
```

**Environment notes:**

- Your Node is **v22.15.0**. Next.js 16 requires Node ≥ 20.9; you are fine. Prisma 7 wants ≥ 20.x. No upgrade needed.
- `node_modules/`, `.next/`, `.env*` are gitignored and never synced from my side — they exist only on your machine.
- I cannot run the tests myself. **Every "green" claim in this project therefore comes from output you paste back, never from my assertion.** When I say a test suite should pass, that is a prediction until you run it.
- Postgres: easiest is Docker Desktop (`docker compose up -d db`, config included in P0). If you'd rather not run Docker on Windows, a free Neon branch works and needs only a connection string.

Practical consequence for TDD: I will write the failing tests and the implementation in the same file batch, and you run them in one go. The "confirm it fails for the right reason" step in your project rules becomes *your* observation, so I will write tests whose failure message states the expected reason explicitly.

---

## 2. Stack

| Concern | Choice | Version | Rationale |
|---|---|---|---|
| Framework | Next.js (App Router) | **16.x — Active LTS** | Active LTS since 2025-10-21. 15.x is Maintenance LTS only until 2026-10-21, so starting on 15 would begin the project already on a dying branch. |
| Language | TypeScript | 5.x, `strict: true` | Non-negotiable for a pricing/constraint engine. |
| UI | Material UI | **v9** | Your choice. Heavily re-themed — see §2.1. |
| Styling engine | Emotion (MUI default) + `@mui/material-nextjs` App Router adapter | — | v9 still ships on Emotion; "remove Emotion" is on MUI's roadmap, not in v9. |
| DB | PostgreSQL | 16+ | JSONB for configuration snapshots, real numeric types, proper constraints. |
| ORM | Prisma ORM | **v7** | Typed client, migrations, good test ergonomics. |
| Validation | Zod | 3.x/4.x | One schema reused for client hints and server enforcement. **True since 2026-08-31 (BUG-07), not before** — this row described an intention nothing implemented, and `grep -rn "from 'zod'" src` returned nothing for the whole build. It now lives in exactly one module, `src/domain/configuration/input-schema.ts`, parsed at the write path's choke point. It is a **shape** check only: which options a product actually offers is `domain/compatibility`'s job (§7.2), which steps a product type has is `domain/configuration/steps`', and whether engraved text fits is `domain/personalization`'s. |
| Auth | Auth.js (NextAuth v5) + Prisma adapter | — | Email magic-link + credentials; guest checkout supported separately. |
| Images | `sharp` + `next/image` | — | Upload inspection, preview generation, responsive delivery. |
| Unit/integration tests | Vitest + Testing Library | — | Fast, ESM-native, same config for domain and component tests. |
| E2E | Playwright | — | Critical customer journeys, mobile viewport included. |
| Email | Interface + Nodemailer/Resend adapter | — | Mocked in tests; **never** claimed as delivered when unimplemented. |
| File storage | Interface + local-disk (dev) / S3-compatible (prod) | — | See §14. |
| Payments | **None in MVP** — bank transfer / contact | — | See §15.4. |

### 2.1 The MUI caveat — read this before it bites

MUI is confirmed and it is the right call — **especially now that a full admin panel is in scope**. MUI's data grids, forms, tabs and charts are exactly what an admin panel needs, and there the stock Material look is an asset rather than a liability. The caveat below applies **only to the customer-facing storefront**.

MUI is a client-side component library. Its components are `"use client"`. Your brand brief demands a premium, image-led, SEO-critical storefront. Those two facts pull in opposite directions, and the resolution has to be architectural, not cosmetic:

- **Marketing & catalogue pages** (home, category, product, FAQ, content) are **React Server Components** using a small set of hand-written layout primitives + MUI's theme tokens via CSS variables. No `@mui/material` imports in the RSC tree except statically-rendered, non-interactive components.
- **Interactive islands** (configurator, cart, checkout forms, account, upload) are client components and use MUI fully.
- **Theme is CSS-variables-first** (`cssVariables: true` in `createTheme`), so server-rendered markup can consume brand tokens without shipping Emotion to render a heading.
- **The default Material look must be destroyed.** A stock MUI site reads as "admin dashboard", which is precisely the "cheap marketplace" failure mode the brief forbids. Concretely: `shape.borderRadius: 2`, `shadows` flattened to near-none, `Button` disableElevation + no uppercase, custom serif display face for headings + neutral grotesque for body, generous `spacing(1) = 8px` rhythm with large section padding, and the palette below.

**Palette (proposal):**

| Token | Value | Use |
|---|---|---|
| `background.default` | `#FAF8F5` warm off-white | Page ground |
| `background.paper` | `#FFFFFF` | Cards, configurator surfaces |
| `text.primary` | `#1F1D1B` graphite | Body |
| `text.secondary` | `#6B655E` | Meta, helper text |
| `primary.main` | `#2E2A26` near-black | CTAs — deliberately not a colour |
| `secondary.main` | `#A97B4F` warm oak | Accents, active configurator step |
| `divider` | `#E6E0D8` | Hairlines |
| `error.main` | `#8C3A2E` muted brick | Errors — no bright red |

Dark mode is **out of scope for MVP** (a warm-paper brand site does not need it; adding it later via `colorSchemes` is cheap because of CSS variables).

---

## 3. Runtime topology

```
Browser (pl-PL)
   │
   ├── RSC pages (catalogue, content) ── cached, ISR
   ├── Client islands (configurator, cart, checkout)
   │        │
   │        └── Server Actions ── domain layer ── Prisma ── PostgreSQL
   │
   └── /api/plik/[fileId] ── authorization check ── FileStorage adapter
                                                         │
                                                  local disk (dev)
                                                  S3-compatible (prod)
```

**Hard rule:** the browser never computes a price that is trusted, never decides a constraint is satisfied, and never names a storage path. Every configurator interaction that produces a price or a validation verdict goes through a Server Action that calls the same domain functions used by the tests.

**Deployment:** Vercel (or any Node host) + managed Postgres (Neon/Supabase/RDS) + S3-compatible bucket. Nothing in the design requires Vercel specifically.

---

## 4. Repository structure

The single most important structural decision: **business logic lives in `src/domain/`, is pure TypeScript, imports nothing from Next.js or Prisma, and is unit-testable with no database.** That is what makes the TDD rules in your project instructions actually practicable.

```
cnc_selling/
├── docs/
│   ├── ARCHITECTURE.md            ← this file
│   └── CHECKLIST.md               ← §22, extracted for tracking
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts                    ← catalogue seed data (materials, finishes, designs)
├── src/
│   ├── app/
│   │   ├── (marketing)/           ← RSC: home, o-nas, faq, jak-powstaje
│   │   ├── (shop)/
│   │   │   ├── [category]/page.tsx
│   │   │   ├── produkt/[slug]/page.tsx
│   │   │   ├── konfigurator/[slug]/
│   │   │   ├── koszyk/
│   │   │   └── zamowienie/
│   │   ├── konto/                 ← account: orders, configurations, files
│   │   ├── panel/                 ← minimal operator console (see §16.3)
│   │   ├── api/
│   │   │   ├── plik/[fileId]/route.ts
│   │   │   └── upload/route.ts
│   │   ├── sitemap.ts
│   │   └── robots.ts
│   ├── domain/                    ← PURE. No Next, no Prisma, no I/O.
│   │   ├── pricing/               ← price computation + rule evaluation
│   │   ├── configuration/         ← step machine, option resolution
│   │   ├── compatibility/         ← material↔product↔design↔finish
│   │   ├── dimensions/            ← size validation, aspect ratio
│   │   ├── modules/               ← modular splitting algorithm
│   │   ├── personalization/       ← text feasibility
│   │   ├── feasibility/           ← production constraint warnings
│   │   └── money/                 ← grosz arithmetic, VAT
│   ├── server/                    ← impure: Prisma repos, actions, services
│   │   ├── repositories/
│   │   ├── actions/               ← 'use server' ONLY. Thin wrappers: derive actor, call operations, revalidate.
│   │   ├── operations/            ← the real mutation logic, incl. every applyXxx(actor, …). NO 'use server'.
│   │   ├── services/
│   │   │   ├── storage/           ← FileStorage interface + adapters
│   │   │   ├── mail/              ← Mailer interface + adapters
│   │   │   └── payment/           ← PaymentProvider interface (no impl in MVP)
│   │   └── auth/
│   ├── ui/                        ← components, theme, primitives
│   │   ├── theme/
│   │   ├── primitives/            ← RSC-safe layout atoms
│   │   └── configurator/          ← client island
│   ├── content/
│   │   └── pl/                    ← all Polish copy: messages.ts, faq.ts, errors.ts
│   └── analytics/                 ← event names + dispatcher
└── tests/
    ├── unit/                      ← mirrors src/domain
    ├── integration/               ← Prisma + actions against test DB
    ├── component/
    └── e2e/                       ← Playwright
```

**Copy rule:** no Polish string literal may appear inside a component. All of it lives in `src/content/pl/`. This is not i18n-for-translation; it is so that a copy review (checklist item "Polish customer-facing language has been reviewed") is a review of ~6 files instead of ~120 components, and so a lint rule can catch stray English UI text.

---

## 5. Domain model — the central idea

The brief lists five product categories with genuinely different configuration needs (a tabletop has thickness and "legs not included"; a kitchen tile has an installation variant; a floor element has a fit-to-existing-floor dimension capture). The naive implementation branches on category everywhere and rots within a month.

Instead:

> **A product's configurator is data, not code.** Each `Product` references a `ProductType` that declares which configuration **steps** apply, and each step's options come from compatibility rows in the database. Adding a design, a material, a finish, or a whole new size range requires **zero code changes** — a requirement stated explicitly in brief §10.

The step vocabulary is fixed and small (code knows how to render and validate each of these):

`DESIGN` · `MATERIAL` · `SIZE` · `THICKNESS` · `FINISH` · `INSTALLATION_VARIANT` · `PERSONALIZATION` · `CUSTOM_UPLOAD` · `SUMMARY`

> **Product types updated 2026-08-23** once the owner's real catalogue diverged
> from the five categories the original brief assumed. Real lineup: **loft**
> (stools/shelves/small tables — wood top we engrave + a bought-in steel
> base/leg, described in copy, not yet a modelled component — see
> `docs/HANDOVER.md`), **amulety i bransoletki** (small engraved wood
> jewellery — metal and leather variants exist in the schema already via
> `MaterialFinish`/`Material.isAvailable` but stay hidden until the owner
> unlocks them), **gres** (kitchen backsplashes — maps directly onto the
> existing `KITCHEN_TILE` type), **panele podłogowe** (engraved wooden floor
> panels — maps onto `FLOOR_ELEMENT`), **obrazy** (wall art — unchanged,
> confirmed still a real product line), and **inne** as the `CUSTOM` catch-all.
> Two new `ProductTypeCode` values were added rather than repurposing
> `TABLE_TOP`/`CUSTOM`: `LOFT_FURNITURE` and `JEWELRY`, in
> `prisma/migrations/20260823020000_add_loft_and_jewelry_product_types`.

Per product type:

| Product type | Steps |
|---|---|
| `WALL_ART` (Obrazy) | DESIGN, MATERIAL, SIZE, FINISH, PERSONALIZATION, SUMMARY |
| `TABLE_TOP` (Blaty) | DESIGN, MATERIAL, SIZE, THICKNESS, FINISH, PERSONALIZATION, SUMMARY |
| `KITCHEN_TILE` (Kafelki / Gres) | INSTALLATION_VARIANT, DESIGN, MATERIAL, SIZE, FINISH, SUMMARY |
| `FLOOR_ELEMENT` (Panele podłogowe) | MATERIAL, SIZE (required exact), THICKNESS, DESIGN, FINISH, SUMMARY |
| `CUSTOM` (Inne / Na wymiar) | CUSTOM_UPLOAD, MATERIAL, SIZE, FINISH, PERSONALIZATION, SUMMARY |
| `LOFT_FURNITURE` (Loft) | DESIGN, MATERIAL, SIZE, THICKNESS, FINISH, PERSONALIZATION, SUMMARY — identical to `TABLE_TOP`'s list; the base/leg option is product copy for now, not a step (see the note above) |
| `JEWELRY` (Amulety i bransoletki) | DESIGN, MATERIAL, SIZE, PERSONALIZATION, SUMMARY — no THICKNESS (a small blank has one fixed thickness) and no FINISH (nothing seeded for it yet) |

`CUSTOM_UPLOAD` is also injectable into any product type when the customer picks "własny projekt" at the DESIGN step.

---

## 6. Data model (Prisma schema)

Annotated. **This section is the proposal; `prisma/schema.prisma` is the
implementation and wins where the two differ** — see Appendix A for the four
deliberate deviations, and the schema's own header comment for the unit rules
it enforces.

### 6.1 Units and money — decided up front

- **All lengths are integer millimetres.** Field names carry the unit: `widthMm`, `heightMm`, `thicknessMm`. Display converts to cm. No floats anywhere near a dimension.
- **All money is integer grosze** (`Int`), field names carry it: `priceNetGrosze`. No `Float`, no JS `number` arithmetic on złoty. VAT 23% stored per line as `vatRateBp` (basis points, `2300`) so a future reduced rate doesn't require a migration.
- **Areas** are computed in mm² as `BigInt`/number and converted to m² only at the final formatting step.

Getting this wrong is the single most common source of "the total is 1 grosz off" bugs; it is fixed here by construction and enforced by tests in `domain/money`.

### 6.2 Catalogue

```prisma
model Category {
  id          String   @id @default(cuid())
  slug        String   @unique          // "obrazy-drewniane"
  namePl      String
  descPl      String   @db.Text
  seoTitlePl  String
  seoDescPl   String
  sortOrder   Int      @default(0)
  products    Product[]
}

enum ProductTypeCode {
  WALL_ART
  TABLE_TOP
  KITCHEN_TILE
  FLOOR_ELEMENT
  CUSTOM
}

model Product {
  id                String          @id @default(cuid())
  slug              String          @unique
  typeCode          ProductTypeCode
  categoryId        String
  category          Category        @relation(fields: [categoryId], references: [id])
  namePl            String
  shortDescPl       String
  longDescPl        String          @db.Text
  careInstructionsPl String         @db.Text
  installationInfoPl String?        @db.Text
  materialNotesPl   String?         @db.Text   // "Blat. Nogi nie są w zestawie."
  basePriceGrosze   Int                        // floor price before any component
  productionDaysMin Int
  productionDaysMax Int
  isActive          Boolean         @default(true)

  // dimension envelope for this product
  minWidthMm        Int
  maxWidthMm        Int
  minHeightMm       Int
  maxHeightMm       Int
  allowsCustomSize  Boolean         @default(true)
  requiresExactSize Boolean         @default(false) // floor elements: true
  minAspectRatio    Float?                          // e.g. 0.2 → forbids 20x300cm slivers
  maxAspectRatio    Float?

  presetSizes       ProductPresetSize[]
  materials         ProductMaterial[]
  designs           ProductDesign[]
  thicknesses       ProductThickness[]
  images            ProductImage[]
  personalization   PersonalizationSpec?
  installVariants   InstallationVariant[]
  @@index([categoryId, isActive])
}

model ProductPresetSize {
  id        String  @id @default(cuid())
  productId String
  product   Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  widthMm   Int
  heightMm  Int
  labelPl   String              // "30 × 40 cm"
  sortOrder Int     @default(0)
  @@unique([productId, widthMm, heightMm])
}
```

### 6.3 Materials, thickness, finishes

```prisma
enum MaterialFamily { SOLID_WOOD PLYWOOD MDF CERAMIC LEATHER OTHER }

model Material {
  id                String         @id @default(cuid())
  slug              String         @unique      // "dab"
  namePl            String                      // "Dąb"
  family            MaterialFamily
  shortDescPl       String
  characteristicsPl String         @db.Text     // grain, colour, knots
  imageUrl          String
  pricePerM2Grosze  Int
  isAvailable       Boolean        @default(true)

  // production envelope
  maxSheetWidthMm   Int                          // limits module size independently of the machine
  maxSheetHeightMm  Int
  minLineWidthMm    Float                        // e.g. 1.2 — drives feasibility warnings
  minTextHeightMm   Float
  supportsCnc       Boolean        @default(true)
  supportsLaser     Boolean        @default(true)
  isNaturalVariable Boolean        @default(true) // triggers the grain/knot disclaimer

  products          ProductMaterial[]
  finishes          MaterialFinish[]
}

model ProductMaterial {          // compatibility: which materials for which product
  productId  String
  materialId String
  priceFactorBp Int  @default(10000) // 10000 = ×1.00; per-product material premium
  product    Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  material   Material @relation(fields: [materialId], references: [id], onDelete: Cascade)
  @@id([productId, materialId])
}

model ProductThickness {
  id           String  @id @default(cuid())
  productId    String
  product      Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  thicknessMm  Int
  priceFactorBp Int    @default(10000)
  labelPl      String            // "27 mm"
  @@unique([productId, thicknessMm])
}

enum FinishKind { NATURAL OIL HARDWAX_OIL STAIN VARNISH }

model Finish {
  id               String     @id @default(cuid())
  slug             String     @unique
  namePl           String                 // "Olejowanie"
  kind             FinishKind
  descPl           String
  imageUrl         String
  pricePerM2Grosze Int
  setupFeeGrosze   Int        @default(0)
  extraDaysMin     Int        @default(0)
  extraDaysMax     Int        @default(0)
  materials        MaterialFinish[]
}

model MaterialFinish {          // compatibility: which finish on which material
  materialId String
  finishId   String
  material   Material @relation(fields: [materialId], references: [id], onDelete: Cascade)
  finish     Finish   @relation(fields: [finishId], references: [id], onDelete: Cascade)
  @@id([materialId, finishId])
}
```

### 6.4 Designs, production metadata, and rights

```prisma
enum DesignRightsStatus {
  APPROVED_COMMERCIAL     // ours / licensed for sale
  REQUIRES_PERMISSION
  PUBLIC_DOMAIN
  CUSTOMER_SUPPLIED
  RESTRICTED              // never offered
}

enum ProductionMethod { CNC_CARVE CNC_ENGRAVE LASER_ENGRAVE MIXED MANUAL_PREP }

model DesignCollection {
  id      String   @id @default(cuid())
  slug    String   @unique
  namePl  String
  descPl  String
  designs Design[]
}

model Design {
  id             String   @id @default(cuid())
  slug           String   @unique          // "linoryt-01"
  code           String   @unique          // stable human ID for production
  namePl         String
  collectionId   String?
  collection     DesignCollection? @relation(fields: [collectionId], references: [id])
  tags           String[]                  // geometric, botanical, linocut...
  thumbnailUrl   String
  previewUrl     String                    // vector/raster used by the live preview
  isActive       Boolean  @default(true)

  // production metadata (brief §10)
  minLineWidthMm      Float
  minDetailSpacingMm  Float
  minEngraveDepthMm   Float?
  recommendedMethod   ProductionMethod
  minRecommendedWidthMm  Int               // below this the design loses detail
  maxRecommendedWidthMm  Int?
  detailLevel         Int                  // 1..5, drives the "very detailed" warning

  // rights (brief §12)
  rightsStatus   DesignRightsStatus @default(APPROVED_COMMERCIAL)
  sourceArtist   String?
  sourceTitle    String?
  sourceYear     Int?
  artistDeathYear Int?
  sourceRef      String?
  rightsNotes    String?  @db.Text

  products       ProductDesign[]
  materials      DesignMaterial[]          // optional narrowing; empty = all product materials
}

model ProductDesign {
  productId String
  designId  String
  surchargeGrosze Int @default(0)
  product   Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  design    Design  @relation(fields: [designId], references: [id], onDelete: Cascade)
  @@id([productId, designId])
}

model DesignMaterial {
  designId   String
  materialId String
  design     Design   @relation(fields: [designId], references: [id], onDelete: Cascade)
  material   Material @relation(fields: [materialId], references: [id], onDelete: Cascade)
  @@id([designId, materialId])
}
```

Note `rightsStatus`: only `APPROVED_COMMERCIAL` and `PUBLIC_DOMAIN` designs are ever selectable in the configurator. `REQUIRES_PERMISSION` and `RESTRICTED` exist so a design can be catalogued without being sellable — brief §12's requirement that nothing is assumed free to reproduce is enforced by a query filter, not by discipline.

### 6.5 Kitchen installation variants

```prisma
enum InstallationVariantCode {
  ON_TOP        // element mounted on/over an existing tile
  OVERLAY       // thin overlay glued to an existing tile
  REPLACEMENT   // replaces one existing backsplash tile
}

model InstallationVariant {
  id          String @id @default(cuid())
  productId   String
  product     Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  code        InstallationVariantCode
  namePl      String     // "Nakładka na istniejący kafelek"
  descPl      String  @db.Text
  diagramUrl  String     // the simple visual explanation required by brief §4
  maxThicknessMm Int?    // OVERLAY is thickness-constrained by definition
  priceFactorBp Int @default(10000)
  @@unique([productId, code])
}
```

The three variants are modelled as first-class rows precisely because brief §4 warns that customers must never be confused about *what they are buying*. That confusion is prevented by making the variant the **first** configurator step for kitchen tiles, with a diagram and a one-line explanation of what the customer receives, plus an explicit "Co otrzymujesz" line in the summary and the order snapshot.

### 6.6 Personalization

```prisma
model PersonalizationSpec {
  id             String  @id @default(cuid())
  productId      String  @unique
  product        Product @relation(fields: [productId], references: [id], onDelete: Cascade)
  isEnabled      Boolean @default(true)
  maxChars       Int     @default(40)
  maxLines       Int     @default(2)
  minTextHeightMm Float  @default(6)
  pricePerCharGrosze Int @default(0)
  flatFeeGrosze  Int     @default(0)
  allowedFontIds String[]
}

model Font {
  id            String  @id @default(cuid())
  slug          String  @unique
  namePl        String
  fileUrl       String
  minHeightMm   Float           // this face is illegible below this height
  supportsPolishDiacritics Boolean @default(true)   // ą ć ę ł ń ó ś ź ż — non-negotiable
  isActive      Boolean @default(true)
}
```

`supportsPolishDiacritics` is a real trap: an imported decorative face without `ł` or `ż` silently renders tofu or drops the character, and the customer discovers it on a finished oak tabletop. The validator rejects any character outside the font's declared coverage.

### 6.7 Configuration, cart, order

```prisma
model Configuration {
  id             String   @id @default(cuid())
  userId         String?
  user           User?    @relation(fields: [userId], references: [id])
  sessionToken   String?             // guest ownership
  productId      String
  product        Product  @relation(fields: [productId], references: [id])

  designId       String?
  customDesignId String?             // CustomerDesign
  materialId     String?
  finishId       String?
  thicknessMm    Int?
  widthMm        Int?
  heightMm       Int?
  installVariant InstallationVariantCode?

  personalizationText String?
  fontId         String?

  // computed, server-side only, cached for display
  moduleCount    Int?
  moduleLayout   Json?               // { cols, rows, modules: [{code,w,h,x,y}] }
  priceBreakdown Json?               // PriceBreakdown, see §10
  priceGrossGrosze Int?
  warnings       Json?               // FeasibilityWarning[]
  pricingVersion Int?

  isComplete     Boolean  @default(false)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  cartItems      CartItem[]
  @@index([userId])
  @@index([sessionToken])
}

model Cart {
  id           String     @id @default(cuid())
  userId       String?    @unique
  sessionToken String?    @unique
  items        CartItem[]
  updatedAt    DateTime   @updatedAt
}

model CartItem {
  id              String        @id @default(cuid())
  cartId          String
  cart            Cart          @relation(fields: [cartId], references: [id], onDelete: Cascade)
  configurationId String
  configuration   Configuration @relation(fields: [configurationId], references: [id])
  quantity        Int           @default(1)
  addedAt         DateTime      @default(now())
}
```

Two different configurations of the same product are two `CartItem` rows pointing at two `Configuration` rows — the brief's edge case ("two different configurations of the same product in one cart") is satisfied structurally. "Duplicate configuration" deep-copies the `Configuration` row rather than incrementing quantity.

### 6.8 Order and the immutable snapshot

```prisma
enum OrderStatus {
  NEW
  AWAITING_PAYMENT
  DESIGN_REVIEW
  CONFIRMED
  IN_PRODUCTION
  FINISHING
  READY_TO_SHIP
  SHIPPED
  COMPLETED
  CANCELLED
}

enum PaymentMethod { BANK_TRANSFER CONTACT_ARRANGED }
enum PaymentStatus { AWAITING UNDERPAID PAID REFUNDED }

model Order {
  id              String   @id @default(cuid())
  orderNumber     String   @unique          // "2026/08/0042"
  userId          String?
  user            User?    @relation(fields: [userId], references: [id])
  accessToken     String   @unique          // guest order lookup, 32-byte random
  status          OrderStatus  @default(NEW)
  paymentMethod   PaymentMethod
  paymentStatus   PaymentStatus @default(AWAITING)

  // buyer — captured, never re-read from the user profile
  email           String
  phone           String?
  firstName       String
  lastName        String
  companyName     String?
  nip             String?                    // PL tax id, validated by checksum
  street          String
  postalCode      String                     // NN-NNN
  city            String
  countryCode     String   @default("PL")

  subtotalNetGrosze  Int
  vatGrosze          Int
  shippingGrosze     Int
  totalGrossGrosze   Int
  currency           String @default("PLN")

  productionNotes String?  @db.Text
  createdAt       DateTime @default(now())
  items           OrderItem[]
  events          OrderEvent[]
  @@index([userId])
  @@index([status])
}

model OrderItem {
  id               String   @id @default(cuid())
  orderId          String
  order            Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  quantity         Int
  unitNetGrosze    Int
  unitGrossGrosze  Int
  vatRateBp        Int      @default(2300)
  lineGrossGrosze  Int

  /// FULL immutable snapshot — brief §24. Never a join to live catalogue rows.
  snapshot         Json
  snapshotVersion  Int      @default(1)

  customerDesignId String?
  customerDesign   CustomerDesign? @relation(fields: [customerDesignId], references: [id])
  productionMethod ProductionMethod?
  moduleCount      Int?
}

model OrderEvent {
  id        String      @id @default(cuid())
  orderId   String
  order     Order       @relation(fields: [orderId], references: [id], onDelete: Cascade)
  fromStatus OrderStatus?
  toStatus   OrderStatus
  actorType  String                  // "system" | "staff" | "customer"
  actorId    String?
  notePl     String?
  createdAt  DateTime    @default(now())
}
```

**The snapshot is the contract.** `OrderItem.snapshot` is a self-contained JSON document containing product name and slug, design code and name, material name and family, dimensions, thickness, finish, installation variant, personalization text and font, module count and layout, the full price breakdown with the pricing version, estimated production days, and the customer design file reference. Rendering an order history entry must never require reading `Product`, `Material`, `Design` or any price rule. A test asserts exactly that: mutate every catalogue row after an order, re-render the order, expect byte-identical output.

### 6.9 Customer designs, uploads, review

```prisma
enum UploadKind { CUSTOMER_DESIGN REFERENCE_PHOTO }
enum DesignReviewStatus { PENDING_REVIEW APPROVED NEEDS_CHANGES REJECTED }

model UploadedFile {
  id            String   @id @default(cuid())
  userId        String?
  user          User?    @relation(fields: [userId], references: [id])
  sessionToken  String?
  kind          UploadKind
  storageKey    String   @unique      // opaque; never derived from the original name
  originalName  String                // sanitized, display only
  mimeType      String                // from magic-byte sniffing, not from the client
  sizeBytes     Int
  checksumSha256 String
  widthPx       Int?
  heightPx      Int?
  pageCount     Int?                  // PDF
  previewKey    String?
  createdAt     DateTime @default(now())
  design        CustomerDesign?
  @@index([userId])
  @@index([sessionToken])
}

model CustomerDesign {
  id              String   @id @default(cuid())
  fileId          String   @unique
  file            UploadedFile @relation(fields: [fileId], references: [id])
  userId          String?
  user            User?    @relation(fields: [userId], references: [id])
  sessionToken    String?
  status          DesignReviewStatus @default(PENDING_REVIEW)
  productionMethod ProductionMethod?          // decided internally, not shown raw
  autoWarnings    Json?                        // from the upload inspector
  reviewComments  DesignReviewComment[]

  /// IP consent record — brief §12
  ipConfirmedAt   DateTime?
  ipDeclarationVersion String?
  ipDeclarationTextPl  String? @db.Text        // the exact text the customer agreed to
  ipConfirmedIp   String?

  orderItems      OrderItem[]
  createdAt       DateTime @default(now())
}

model DesignReviewComment {
  id         String @id @default(cuid())
  designId   String
  design     CustomerDesign @relation(fields: [designId], references: [id], onDelete: Cascade)
  authorType String                    // "staff" | "customer"
  authorId   String?
  bodyPl     String @db.Text
  createdAt  DateTime @default(now())
}
```

Storing `ipDeclarationTextPl` verbatim (not just a boolean) is deliberate: a consent record is only evidence if it captures *what* was agreed to, and the wording will change over time.

### 6.10 Users

Standard Auth.js tables (`User`, `Account`, `Session`, `VerificationToken`) plus:

```prisma
enum UserRole { CUSTOMER STAFF ADMIN }
// on User: role UserRole @default(CUSTOMER)
```

See §16.3 for what each role may do. The first `ADMIN` is created by seed script; there is no self-service path to elevation.

---

## 7. Configurator architecture

### 7.1 Step machine

The configurator is a **finite state machine driven by the product type's step list** (§5), not a form. State shape:

```ts
type ConfiguratorState = {
  productId: string
  stepIndex: number
  steps: StepCode[]              // resolved from product type + branches
  selections: Partial<Selections>
  derived: {                     // server-authoritative, never computed client-side
    priceGrossGrosze: number | null
    breakdown: PriceBreakdown | null
    moduleLayout: ModuleLayout | null
    warnings: FeasibilityWarning[]
  }
  status: 'idle' | 'pricing' | 'error'
}
```

Rules:

- A step is **enterable** only if all prior required selections are valid.
- Changing an earlier selection **invalidates** dependent later selections rather than silently keeping an incompatible one. Concretely: changing material re-resolves finishes; if the current finish is no longer compatible it is cleared and the customer is told, in Polish, that it was cleared and why. Never silently swapped (brief §37: "Do not silently change the customer's design").
- Every selection change dispatches a Server Action that returns `{ price, breakdown, moduleLayout, warnings, clearedSelections }`. The UI renders that response; it never derives a price locally.
- **URL state:** the configurator serialises selections into the URL (`?w=1200&h=1200&m=dab&d=linoryt-01…`) and persists the `Configuration` row on a debounce. This is what makes "refresh during configuration" and "browser back button" work — two explicit edge cases in brief §36 that are almost always broken in hand-rolled configurators.

### 7.2 Option resolution

For each step, the server returns the option set already filtered by compatibility:

```
availableMaterials(product)            = ProductMaterial ∩ Material.isAvailable
                                         ∩ (design.materials if design narrows)
availableFinishes(product, material)   = MaterialFinish(material) ∩ product-allowed
availableDesigns(product, material?)   = ProductDesign ∩ Design.isActive
                                         ∩ rightsStatus ∈ {APPROVED_COMMERCIAL, PUBLIC_DOMAIN}
                                         ∩ (DesignMaterial if narrowed)
availableThicknesses(product, variant) = ProductThickness ∩ variant.maxThicknessMm
```

Unavailable options are **shown disabled with a Polish reason**, not hidden — a hidden option looks like a missing feature; a disabled one with "Niedostępne dla wybranego materiału" teaches the customer the rule.

### 7.3 Preview

2D canvas/SVG composition, per brief §18 (no 3D in MVP):

1. Material swatch texture as the base layer, scaled to the real product proportions.
2. Design SVG/PNG composited at the correct relative scale — so a detailed design on a small panel genuinely *looks* crowded, reinforcing the feasibility warning instead of contradicting it.
3. Personalization text rendered with the actual chosen font at true relative size.
4. Module seam lines overlaid when `moduleCount > 1`.
5. For kitchen tiles: the installation diagram for the chosen variant, with the tile shown in a backsplash context.

Preview updates are **optimistic and local** (instant on selection) while price and warnings arrive from the server — the preview may be approximate, the price may not.

---

## 8. Validation & feasibility engine

Three distinct concepts, deliberately kept separate because they have different consequences:

| Kind | Meaning | Effect |
|---|---|---|
| **Error** | Cannot be manufactured / invalid input | Blocks Next and add-to-cart |
| **Warning** | Manufacturable but the result may disappoint | Requires explicit acknowledgement checkbox |
| **Notice** | Informational (natural wood variation, modular build) | Displayed, no interaction |

`domain/dimensions`:

- `widthMm/heightMm` within the product envelope → else error `DIMENSION_OUT_OF_RANGE`
- aspect ratio within `[minAspectRatio, maxAspectRatio]` → else error `ASPECT_RATIO_UNSUPPORTED`
- material sheet limits vs. module size → may force more modules, never an error
- `requiresExactSize` products reject preset-only flow and demand explicit dimensions

`domain/feasibility` (brief §37) — each returns a Polish message from `content/pl/warnings.ts`:

| Rule | Condition | Message |
|---|---|---|
| `LINE_TOO_THIN` | `design.minLineWidthMm × scale < material.minLineWidthMm` | „Ten wzór wymaga minimalnej szerokości linii 1,2 mm dla wybranego materiału." |
| `DESIGN_TOO_DETAILED` | `design.detailLevel ≥ 4 && width < design.minRecommendedWidthMm` | „Wybrany wzór jest bardzo szczegółowy. Dla tego rozmiaru zalecamy większy format." |
| `TEXT_TOO_SMALL` | computed glyph height `< max(font.minHeightMm, material.minTextHeightMm)` | „Ten tekst może być zbyt drobny do precyzyjnego wykonania." |
| `MODULAR_BUILD` | `moduleCount > 1` | „Ten produkt zostanie wykonany z kilku precyzyjnie łączonych elementów." (notice, with diagram) |
| `NATURAL_VARIATION` | `material.isNaturalVariable` | Grain/colour/knot disclaimer (notice) |
| `FLOOR_MATCH` | product type `FLOOR_ELEMENT` | „Dokładne dopasowanie odcienia do istniejącej podłogi może nie być możliwe." (warning, acknowledged) |
| `UNSUPPORTED_GLYPH` | char outside font coverage | error |
| `THICKNESS_EXCEEDS_MACHINE` *(added 2026-08-23, D7)* | `thicknessMm > machine.maxWorkpieceThicknessMm` | „Wybrana grubość (…) przekracza możliwości naszej maszyny — maksymalnie (…). Wybierz mniejszą grubość." (error) |

Scale factor for `LINE_TOO_THIN`: the design's declared minimum line width is defined **at its reference width**; rendering it at `widthMm` scales all features by `widthMm / design.referenceWidthMm`. (This adds `referenceWidthMm` to `Design` — noted as a schema addendum.)

---

## 9. Modular splitting algorithm

> **D7 resolved 2026-08-23.** The figures below were the pre-launch
> assumption. The real machine, confirmed with the owner: **`usableWidthMm =
> 600`, `usableHeightMm = 500`**, `minModuleMm` kept at **150**, plus a Z-axis
> limit not covered by this section at all — `maxWorkpieceThicknessMm = 100`,
> added to `MachineSettings` in
> `prisma/migrations/20260823010000_add_machine_thickness_limit`. The machine
> is a [TwoTrees TTC6050](https://pl.twotrees3d.com/en/products/twotrees-ttc6050-cnc-router-machine-800w-spindle-4th-axis),
> whose spec sheet states "600 x 500 x 100 mm" verbatim — external
> confirmation, not just a retelling. `domain/feasibility` now enforces this
> limit as `THICKNESS_EXCEEDS_MACHINE` (§8, §9b of `docs/HANDOVER.md`). See
> `docs/HANDOVER.md` §9 for the full resolution, including one dead end (a
> "10 mm" answer that turned out to describe material thickness, not the
> module floor).

**Inputs:** `widthMm`, `heightMm`, machine usable area (`600 × 900 mm` nominal → **`580 × 880 mm` effective** after clamping and tool clearance — configurable, not hardcoded; **superseded, see note above**), material `maxSheetWidthMm/maxSheetHeightMm`, `minModuleMm` (default 150), `grainDirection`.

```
usableW = min(machine.usableWMm, material.maxSheetWidthMm)
usableH = min(machine.usableHMm, material.maxSheetHeightMm)

if (w <= usableW && h <= usableH) → 1 module, no seams

cols = ceil(w / usableW)
rows = ceil(h / usableH)

// equalise: never one full module + one 40 mm sliver
moduleW = w / cols   moduleH = h / rows

// enforce minimum module size by reducing count where possible
while (cols > 1 && w / cols < minModuleMm) cols--
while (rows > 1 && h / rows < minModuleMm) rows--

// if a module still exceeds the usable area after clamping → INFEASIBLE error
```

**Naming:** rows `A, B, C…` top→bottom, columns `1, 2, 3…` left→right → `A1 A2 / B1 B2`.
**Production order:** row-major, `A1 → A2 → B1 → B2`.
**Registration:** each module carries its offset `(xMm, yMm)` in the **global product coordinate system**, so the design is sliced from one continuous artwork and the seams align. Alignment features (dowel/domino positions) are recorded as coordinates in the layout JSON for the future production pipeline — they are *data*, not generated toolpaths.

**Edge cases with defined behaviour (each gets a test):**

- exactly at the boundary (`w == usableW`) → 1 module, not 2 (off-by-one; classic)
- extreme aspect (`2400 × 200 mm`) → 5×1 modules, but aspect-ratio validation may reject first
- `w/cols` non-integer → distribute the remainder to the last module, or to all modules evenly and round to mm; **decided: distribute evenly, last module absorbs the ±mm remainder**, and the layout records exact integer mm per module summing to `w`
- rotating the layout (portrait vs landscape module grid) is allowed **only** if `grainDirection` permits; solid wood with directional grain does not get free rotation

**Presentation:** never as a limitation. The UI shows the grid diagram, the module count, and copy framing it as a feature (transport, installation, replaceability) — brief §14/§20.

---

## 10. Pricing engine

### 10.1 Formula

All components in grosze, evaluated server-side by `domain/pricing`:

```
areaM2            = (widthMm × heightMm) / 1_000_000

materialCost      = round(areaM2 × material.pricePerM2Grosze
                          × productMaterial.priceFactorBp / 10000
                          × thickness.priceFactorBp / 10000)

machiningCost     = round(areaM2 × design.machiningMilliMinutesPerM2 / 1000
                          × machineRatePerMinuteGrosze(method))

designSurcharge   = productDesign.surchargeGrosze

finishCost        = round(areaM2 × finish.pricePerM2Grosze) + finish.setupFeeGrosze

moduleSurcharge   = max(0, moduleCount - 1) × pricing.moduleSurchargeGrosze

personalization   = spec.flatFeeGrosze + chars × spec.pricePerCharGrosze

variantFactor     = installVariant.priceFactorBp / 10000

packaging         = packagingFor(areaM2, moduleCount)

subtotalNet = round((product.basePriceGrosze + materialCost + machiningCost
                    + designSurcharge + finishCost + moduleSurcharge
                    + personalization) × variantFactor) + packaging

netUnit  = max(subtotalNet, product.minPriceGrosze)
vat      = round(netUnit × vatRateBp / 10000)
grossUnit = netUnit + vat
```

Rounding: **half-up at every `round()`, on integers, once per component.** Never accumulate floats and round at the end. VAT is computed on the net unit price, then the line total is `grossUnit × quantity` — computing VAT on the line total instead produces off-by-one-grosz differences against invoices.

`design.machiningMilliMinutesPerM2` (thousandths of a minute, an integer) and `machineRatePerMinuteGrosze` are schema addenda (a `PricingSettings` singleton table holds machine rates, module surcharge, packaging tiers, VAT rate, and `version`).

### 10.2 Server authority and versioning

- Prices are computed **only** in Server Actions. The client receives a `PriceBreakdown` object for display and never a formula.
- Add-to-cart recomputes and compares; checkout recomputes and compares again. A mismatch is a hard error, logged, with a Polish message asking the customer to refresh — never silently accepting the client's number.
- `PricingSettings.version` increments on any rate change. Every `Configuration` and `OrderItem` records the version used. Historical orders therefore reprice to exactly what was charged, and a test asserts it.
- `PriceBreakdown` is a first-class typed object stored in the snapshot: every component named, in grosze, summing to the total. This is what makes "the price is wrong" debuggable a year later.

### 10.3 What is deliberately not built

No admin-editable pricing rules UI in MVP (brief §19 says prepare for it, not build it). Rates live in `PricingSettings` rows edited by seed/SQL. The engine reads them from the DB — so a future admin panel is a CRUD screen over an existing table, not a refactor.

---

## 11. Floor / panel products

`requiresExactSize = true` changes the SIZE step materially:

- No preset sizes offered. The customer enters length, width, thickness explicitly.
- A mandatory acknowledgement: „Podaję ostateczne wymiary. Produkt zostanie wykonany na wymiar i nie wymaga docinania." plus the wood-matching warning (`FLOOR_MATCH`).
- Copy states plainly that the product arrives **cut to size** and must not be trimmed, listing what trimming damages (artwork, finish, dimensions, water resistance, structural integrity) — brief §5.
- The order snapshot records the exact dimensions the customer declared, so a dimension dispute is resolvable from the order alone.

Optional (defer to Phase 2): a "dopasowanie do istniejącej podłogi" flow where the customer uploads a photo + panel system name as a `REFERENCE_PHOTO` upload for manual review.

---

## 12. Coffee table tops

- `materialNotesPl` renders prominently on the product page **and** in the configurator summary **and** in the order confirmation: „Produkt obejmuje blat. Nogi nie są w zestawie."
- Thickness is a required step with real price impact.
- Leg compatibility is Phase 2 — modelled as a future `Accessory` relation, not built.

---

## 13. Upload pipeline & design review

### 13.1 Validation (server-side, in order — fail fast)

1. **Size cap before reading:** JPG/PNG ≤ 25 MB, SVG ≤ 5 MB, PDF ≤ 25 MB. Enforced at the route by content-length *and* by streaming byte count (a lying header is the obvious attack).
2. **Magic-byte sniffing.** The declared MIME type and the file extension are both ignored for security decisions. Only `image/jpeg`, `image/png`, `image/svg+xml`, `application/pdf` pass.
3. **SVG sanitization.** Parse, then strip `<script>`, `<foreignObject>`, event handler attributes, `xlink:href`/`href` to external or `data:` URLs, and external entity declarations. An unsanitized customer SVG rendered in a preview is stored XSS; this is the highest-severity item in the upload path.
4. **PDF inspection.** Page count, embedded JS rejection, rasterization for preview.
5. **Raster inspection** via `sharp`: dimensions, colour space, alpha.
6. **Effective resolution check** against the target product size:
   `effectiveDpi = widthPx / (targetWidthMm / 25.4)`; warn below 150 DPI, warn hard below 100.
7. **Aspect mismatch** between the upload and the target product proportions → warning with a crop preview.
8. **Filename sanitization** for display; the storage key is a generated opaque id and never derived from user input.
9. Preview generation (max 1600 px, stripped of EXIF including GPS).

Every check produces a structured `UploadWarning` persisted to `autoWarnings`, and the customer always sees: „Projekt może wymagać ręcznej korekty przed produkcją."

### 13.2 IP confirmation

Before an upload is accepted, an unchecked-by-default checkbox with the declaration text, versioned. Submission without it is rejected server-side (not just disabled client-side). Consent is recorded per §6.9. Nothing in the UI implies that uploading arbitrary artwork is permitted.

### 13.3 Review workflow

```
PENDING_REVIEW ──approve──▶ APPROVED
      │
      ├──request changes──▶ NEEDS_CHANGES ──customer re-uploads──▶ PENDING_REVIEW
      │
      └──reject──────────▶ REJECTED (terminal)
```

**Gate:** an order containing a `CustomerDesign` not in `APPROVED` cannot leave `DESIGN_REVIEW`. Enforced in the domain transition function, tested directly.

Customers see plain status text („Projekt oczekuje na weryfikację." / „Projekt został zaakceptowany." / „Projekt wymaga poprawy.") plus staff comments. They never see CAM terminology. `productionMethod` is internal.

---

## 14. Service abstractions (and what must never be faked)

| Service | Interface | MVP implementation | Test double |
|---|---|---|---|
| Storage | `FileStorage { put, get, getSignedUrl, delete, exists }` | Local disk (dev) / S3-compatible (prod) | In-memory |
| Mail | `Mailer { send(template, to, data) }` | Real SMTP/Resend adapter; **if unconfigured, the app logs and marks the notification as not sent** | Recording mock asserting template + recipient |
| Payment | `PaymentProvider` interface only | **No implementation.** Checkout offers bank transfer / contact | Mock with success/failure/cancel/timeout for future integration tests |
| Production files | — | **Not built.** No SVG/DXF/G-code generation | — |

Per your project rules, three things are explicitly forbidden in this codebase and will be checked in review:

1. No fake payment confirmation. There is no "payment succeeded" path because there is no payment integration.
2. No fake production files. A preview SVG is not a production file and must never be labelled or exported as one.
3. No fake email delivery. If the mailer is unconfigured, the order still succeeds, and the UI says the confirmation will follow — it does not claim an email was sent.

**Backup strategy** for the two services that hold irreplaceable data (Postgres, and the file storage above once its S3 adapter exists) is documented separately — see `docs/BACKUP.md`.

---

## 15. Cart, checkout, order creation

1. **Cart** keyed by user id or a signed guest session cookie. Guest carts merge into the user cart on login (union, not overwrite).
2. **Checkout** collects buyer data, invoice option (NIP with checksum validation), delivery address, delivery method, and the terms/IP acknowledgements.
3. **Order creation is one transaction**: recompute every line from `Configuration` + current `PricingSettings`, compare to the displayed total, build the snapshot, insert `Order` + `OrderItem[]` + initial `OrderEvent`, clear the cart, generate `orderNumber` and `accessToken`.
4. **Payment:** `BANK_TRANSFER` → the confirmation page and email show the bank details, order number as the transfer title, and the amount. Status is `AWAITING_PAYMENT`; a human marks it `PAID` in the operator console. `CONTACT_ARRANGED` → order enters `NEW` and the customer is told they will be contacted.
5. Guest order lookup via `/zamowienie/[orderNumber]?token=…` with a constant-time token comparison.

`orderNumber` generation must be collision-safe under concurrency — a Postgres sequence per year-month, not `count() + 1`.

---

## 16. Security & authorization

### 16.1 Rules

- Every Server Action re-derives the actor from the session. No id is ever trusted from the request body.
- `Configuration`, `UploadedFile`, `CustomerDesign`, `Order` access requires `userId` match **or** matching guest `sessionToken` **or** a valid order `accessToken`.
- `/api/plik/[fileId]` authorizes before touching storage, returns 404 (not 403) on failure so file existence isn't probeable, and streams via the storage adapter. Storage keys are never exposed. No public bucket.
- Rate limits: uploads per session/hour, order creation per IP, auth attempts.
- Security headers + strict CSP; user SVGs are served as attachments or rasterized previews, never inlined into the document.
- Structured logging for auth failures, price mismatches, upload rejections, and order status transitions. No PII in logs beyond user id.

### 16.2 Authorization test matrix (all get tests)

| Actor | Resource | Expected |
|---|---|---|
| Guest with token | own configuration | allow |
| Guest with token | other guest's configuration | 404 |
| Customer A | Customer B's uploaded file | 404 |
| Customer A | Customer B's order | 404 |
| Customer | staff review action | 403 |
| Unauthenticated | `/panel/*` | redirect to login |
| `STAFF` | pricing write | 403 |
| `STAFF` | catalogue write | 403 |
| `ADMIN` | pricing write | allow + audit entry |
| Expired session | any action | re-auth, no data leak |

### 16.3 Roles

| Role | Can |
|---|---|
| `CUSTOMER` | own configurations, files, orders |
| `STAFF` | orders, design review, production queue, customers (read); pricing and catalogue **read-only** |
| `ADMIN` | everything, including pricing, catalogue CRUD, staff management, settings |

There is no self-service path to `STAFF`/`ADMIN`. The first admin is created by seed script; further staff are invited from within the panel by an `ADMIN`.

---

## 16A. Admin panel — full scope

> **Scope change, recorded.** The original brief (§39) said *"The admin panel will be developed as a SECOND PHASE. Do not spend the MVP implementation budget building a large admin dashboard."* You have now reversed that: a detailed admin panel with full management and statistics is in scope. This section replaces the three-screen operator console previously proposed, and §22/§24 are updated accordingly. This roughly **doubles** the build — see §22 for the revised phasing and §25/D2 for the one question it raises about launch order.

Route group `src/app/(admin)/panel/`, gated by middleware on role. Full MUI, `@mui/x-data-grid` for tables, `@mui/x-charts` for statistics. This is a separate visual world from the storefront — standard Material, dense layout, no brand theming investment.

> **Visual reference, recorded 2026-08-24, built 2026-08-27 (P7c slice 7).**
> The owner named
> [Materio](https://github.com/themeselection/materio-mui-nextjs-admin-template-free)
> (MIT-licensed, MUI-based — [live demo](https://demos.themeselection.com/materio-mui-nextjs-admin-template-free/demo))
> as the admin panel's visual direction: a grouped, icon+label sidebar nav
> (Dashboards / Apps & Pages / User Interface / Forms & Tables / Charts /
> Others — map to this section's modules 1-11), a bento-grid dashboard of
> soft-shadow, rounded, colour-accented stat cards, `@mui/x-data-grid` for
> every table. Adopted the **structure and visual language only**, reimplemented
> in plain MUI `sx`/theme (`src/ui/theme/adminTheme.ts`), not Materio's Tailwind
> utility classes (it ships both; this project stays MUI-only per §1) —
> confirmed by actually fetching the real Materio repo before building: it's
> Next 14 + MUI 5 + Tailwind, charts via ApexCharts (non-MUI); this project
> uses `@mui/x-charts` instead, same reasoning. Grouped icon sidebar:
> `AdminSidebarNav.tsx`. Stat cards: `StatCard.tsx`, used by the new `/panel`
> Dashboard landing page (module 1, minus the configurator funnel — deferred,
> needs a new `AnalyticsEvent` model, tracked separately in §16A.1/`docs/CHECKLIST.md`).
> This section's own module list, invariants, and models below are otherwise
> unaffected by that build.

### 16A.1 Modules

**1. Dashboard**
KPI tiles: orders today / 7d / 30d, revenue net and gross, average order value, orders awaiting payment, designs awaiting review, orders in production. Charts: revenue over time, orders by status, top products / designs / materials, configurator funnel (started → design → material → size → summary → cart → order) with drop-off per step, production load (queued m² and machine-minutes). Date-range picker on everything.

**2. Orders**
Data grid with filters (status, payment status, date range, customer, product type, has-custom-design) and CSV export. Detail view: full snapshot rendered exactly as the customer saw it, buyer and invoice data, line items with price breakdown, module layout diagram, status transitions with mandatory note on backwards moves, payment marking, production notes, order event timeline, printable production brief.

> The production brief is a **human-readable summary sheet** — dimensions, material, finish, module layout, design code, personalization text. It is explicitly **not** a CNC/laser production file, is labelled as such, and nothing in the panel generates G-code, DXF or toolpaths.

**3. Design review queue**
Pending customer designs with preview, automatic upload warnings, original file download, threaded comments visible to the customer, approve / request changes / reject, and assignment of internal `productionMethod`. Blocks the order's exit from `DESIGN_REVIEW` until resolved.

**4. Catalogue**
CRUD for categories and products across every field including the dimension envelope, preset sizes, thickness options, installation variants, product↔material compatibility, product↔design assignment, image upload with ordering and alt text, SEO fields, activate/deactivate.

**5. Designs**
CRUD for designs and collections: production metadata (min line width, reference width, detail level, machining minutes/m², recommended method), rights status and provenance (artist, title, year, death year, source, notes), material/product narrowing, thumbnail and preview upload. Rights status is a required field with no default that permits sale — a new design starts `REQUIRES_PERMISSION` and must be deliberately promoted.

**6. Materials & finishes**
CRUD with availability toggles, price per m², sheet size limits, min line width, min text height, grain direction, CNC/laser support flags, and a material↔finish compatibility matrix editor.

**7. Pricing** *(ADMIN only)*
Machine rates, module surcharge, packaging tiers, VAT rate, material and finish rates, product base and minimum price, all per-relation factors. **Highest-risk screen in the application** — a mistyped rate changes every price on the site. Therefore:

- Every save creates a **new `PricingSettings` version**; nothing is edited in place.
- A **price simulator** shows before/after for a fixed set of reference configurations, and the change cannot be published without viewing it.
- Existing orders are pinned to their version and never reprice.
- Every change is audit-logged with a full diff.

**8. Customers**
List and detail: orders, saved configurations, uploaded files, account status. RODO tooling: data export and deletion request handling (deletion anonymises the user but preserves order records, which Polish accounting law requires be retained).

**9. Content**
FAQ entries, static page copy, homepage sections, and customer reviews. Reviews are moderated real submissions only — there is no facility to author a testimonial in a customer's name.

**10. Production**
Queue grouped by status, module manifest per order, capacity view (total queued m² and machine-minutes against a configurable weekly capacity), batch status transitions.

**11. Settings & audit**
Staff users and roles, bank transfer details, shipping methods and rates, email template management, and the audit log viewer.

### 16A.2 Invariants the panel must not violate

1. **No fabricated customer-visible events.** No "mark as shipped" without a real shipment, no "resend email" that does not send, no status that implies work not done.
2. **Soft delete only** for any catalogue entity referenced by an order — deactivate, never destroy. Order snapshots protect display, but re-order and referential integrity need the row.
3. **No pricing retroactivity.** Version pinning is enforced in the domain layer, not by admin discipline.
4. **Every mutation is audited.** `AuditLog` with actor, entity, action and a JSON diff.

### 16A.3 Additional models

```prisma
model AuditLog {
  id        String   @id @default(cuid())
  actorId   String?
  actorEmail String                    // denormalised: survives staff deletion
  entity    String                     // "Product" | "PricingSettings" | "Order" | ...
  entityId  String?
  action    String                     // "create" | "update" | "delete" | "transition"
  diff      Json?
  createdAt DateTime @default(now())
  @@index([entity, entityId])
  @@index([createdAt])
}

model AnalyticsEvent {
  id           String   @id @default(cuid())
  name         String                  // configurator_step_completed, add_to_cart, ...
  sessionToken String?
  userId       String?
  productId    String?
  step         String?
  payload      Json?
  createdAt    DateTime @default(now())
  @@index([name, createdAt])
  @@index([sessionToken])
}
```

`AnalyticsEvent` is first-party and exists because the dashboard's funnel cannot be built from GA4 — GA4 is not queryable server-side without a reporting API integration, and the one question you actually need answered ("where do people abandon the configurator?") deserves data you own. It is written only for consented sessions, and rows older than 12 months are pruned.

### 16A.4 Admin tests (written first, per project rules)

Authorization matrix (customer → 404, `STAFF` → pricing read-only 403 on write, `ADMIN` → allow, unauthenticated → redirect) · pricing save creates a new version and never mutates the old · orders pinned to the old version are unchanged after a rate change · soft-delete refused destruction of a referenced entity · audit log written for every mutation type · illegal status transitions rejected · design-review gate blocks production · CSV export excludes other tenants' data (trivially true now, but the test locks the shape).

### 16A.5 Admin UX — what makes it actually usable

The panel is the tool you will personally sit in every working day. Most admin panels fail not by missing features but by making the ten things you do fifty times a day cost four clicks each. These are requirements, not polish:

**Speed of the daily loop**

- **Global search (`Ctrl/⌘ + K`)** across orders, customers, designs, products — jump to order `2026/08/0042` by typing it, from anywhere.
- **Keyboard navigation** in every data grid: arrows, `Enter` to open, `Esc` to close, `J`/`K` to move between records *without returning to the list*.
- **Saved filters** — „Do wysyłki dziś", „Czeka na płatność > 7 dni", „Projekty do weryfikacji" — pinned as first-class tabs, not rebuilt each morning.
- **Bulk actions** with a selection toolbar: batch status change, batch export, batch mark-as-paid.
- **Inline editing** in grids for the cheap fields (availability toggle, sort order, stock flag) so a five-second change is not a page navigation.
- **Column configuration persisted per user** — visible columns, widths, density, sort. It should look how you left it.

**Not losing work**

- **Optimistic updates with undo** — a status change applies instantly with a „Cofnij" snackbar for ~8 seconds, rather than a confirmation dialog before every action.
- **Confirmation dialogs only for the irreversible** — reject a design, delete a staff account, publish a pricing change. Everything else uses undo. A panel that asks "are you sure?" twenty times a day trains you to click through it, which is exactly when it stops protecting you.
- **Form state survives errors.** A validation failure never clears the form. A navigation away from a dirty form warns.
- **Autosaved drafts** for long forms (product creation, design metadata).

**Understanding what you're looking at**

- **Explain every disabled control.** A greyed-out "Do produkcji" button must say why on hover: „Projekt klienta oczekuje na weryfikację." Silent disabling is the single most common admin-panel failure.
- **Validation that names the fix**, not the rule — „Minimalna szerokość dla dębu to 1,2 mm; ten wzór ma 0,8 mm" beats „Nieprawidłowa wartość".
- **Activity timeline on every record** — who changed what, when, from the audit log, rendered in plain Polish.
- **Preview as customer** — open any product or design in the storefront exactly as a customer sees it, one click from the edit form.
- **Real empty states** that tell you what to do next, not blank tables.

**Working the way the shop works**

- **Duplicate** any product, design or material as a starting point — the fastest way to add the twelfth variant of something.
- **Image upload with drag-drop, reordering, and alt text inline** — not a separate media library trip.
- **Print views** for the production brief and the packing list; the workshop needs paper.
- **CSV import/export** on catalogue tables, so a price list arriving as a spreadsheet doesn't become an afternoon of typing.
- **Tablet-usable** order and production views. The panel will be opened next to the machine on a tablet with sawdust on the screen; the daily-use screens must work at 1024px with large touch targets. Full CRUD forms may remain desktop-only.
- **Dense mode by default** in grids, with a comfortable toggle.

**Statistics that answer questions**

Every dashboard number is **clickable through to the records behind it**. „12 zamówień czeka na płatność" that cannot be clicked is a number; one that opens the filtered list is a tool. Every chart has an explicit date range and an export.

### 16A.6 Build order within the panel — vertical slices, not UI-then-backend

Agreed on sequencing the panel after the storefront. One refinement on *how* it gets built, because it matters for your project's TDD and no-fake rules:

Each admin module is built as a **vertical slice** — tests, server action, and UI together, module by module (orders complete, then design review complete, then catalogue complete) — rather than building the whole panel UI against mock data and wiring the backend afterwards.

Two reasons. First, a fully clickable admin panel backed by mock data is precisely the "fake functionality" your project rules prohibit: it looks finished, demos well, and does nothing, and it is very easy to lose track of which buttons are real. Second, admin screens are shaped by what the queries can efficiently return; designing the UI first tends to produce screens the data model can't serve without expensive rework.

Storefront-first still holds. Within the panel, one working module beats eleven mocked ones.

---

## 17. Polish language & content

**Code is English. Content is Polish.** Identifiers, table names, functions, tests, comments, commit messages, file names — all English. Nothing in this section asks for Polish in the codebase. The one exception already in the schema is the `…Pl` field suffix (`namePl`, `descPl`), which marks *which columns hold customer-visible copy* — useful the day a second language appears, and a clear signal to reviewers about what needs a copy pass.

### 17.1 Typography

A good Latin sans covers Polish, with one specific trap:

> **Google Fonts must be requested with the `latin-ext` subset.** The default `latin` subset **omits ą ć ę ł ń ó ś ź ż**. A font linked as `?family=Inter&subset=latin` renders "Kafelki drewniane" fine and "Dąb — łączone moduły" as broken boxes or fallback glyphs. Using `next/font/google` with `subsets: ['latin', 'latin-ext']` is the fix, and it is a one-line mistake that ships silently because the developer's test strings usually have no diacritics.

Recommended pairing (all with full `latin-ext` coverage): a warm serif for display headings — **Fraunces**, **Newsreader** or **Instrument Serif** — with **Inter** or **DM Sans** for body and UI. Self-host via `next/font` so there is no third-party request and no layout shift.

### 17.2 Engraving fonts are a different problem entirely

The diacritics warning in §6.6 is **not** about the website's typeface. It is about the fonts customers pick for **personalized text that gets permanently milled or lasered into oak.**

Those are decorative faces — script, stencil, hand-lettered, monoline — and free/commercial decorative fonts very frequently ship with Basic Latin only. A customer types „Michał" or „Zażółć", picks a beautiful script face, the preview quietly substitutes a fallback glyph or drops the character, and the failure becomes permanent on a finished tabletop that cannot be re-run.

Hence `Font.supportsPolishDiacritics` plus real per-font glyph-coverage validation: parse the font's cmap table at seed time, store the covered code points, and reject any personalization character the chosen face does not actually contain — with a Polish error naming the character and offering compatible faces. Preview rendering must use the same font file that production uses, or the preview is a lie.

### 17.3 Locale specifics that break if treated as English

| Concern | Correct behaviour |
|---|---|
| **Plurals** | Three forms, not two: „1 moduł" / „2 moduły" / „5 modułów". Applies to modules, days, items, products, reviews. `Intl.PluralRules('pl')` gives `one` / `few` / `many` / `other`; unit-tested at 1, 2, 4, 5, 12, 22, 25, 112. `n === 1 ? … : …` is wrong in Polish. |
| **Dates** | Genitive month: „23 sierpnia 2026", not „23 sierpień 2026". `Intl.DateTimeFormat('pl-PL', {day:'numeric', month:'long', year:'numeric'})` handles it. |
| **Currency** | `1 234,56 zł` — comma decimal, non-breaking space as thousands separator, symbol after the number. Never `zł 1,234.56`. |
| **Numeric input** | Customers type dimensions as `1,2` not `1.2`. Every numeric input accepts both and normalises before parsing; `parseFloat("1,2")` returns `1`, which would silently mis-size a product. |
| **Sorting** | Polish collation: ą sorts after a, ł after l, ż last. `Intl.Collator('pl')` client-side, `COLLATE "pl-PL-x-icu"` in Postgres for DB-ordered lists. |
| **Search** | Diacritic-insensitive: typing „dab" must find „dąb". Postgres `unaccent` extension + a normalised search column. |
| **Slugs** | Transliterate for URLs — ł→l, ą→a, ż→z (`elementy-podlogowe`, `linoryt-01`). Never percent-encoded diacritics in a slug. |
| **Postal / NIP / phone** | `NN-NNN`; NIP validated by its weighted checksum, not just length; phone `+48` with 9 digits. |
| **Address form order** | Street then building/apartment number, postal code before city — a US-shaped address form reads as foreign. |
| **Quotation marks** | Polish uses „ … " (low-open, high-close), not " … ". Cosmetic, but it is one of the things that makes a page read as locally made. |
| **Non-breaking spaces** | After single-letter words — „w kuchni", „i drewno" — a line must not break after `w`, `i`, `z`, `o`, `a`. A small typographic filter on rendered copy handles this. |

### 17.4 What MUI's Polish locale actually covers

MUI does ship Polish, and we use it — but it solves a narrower slice than its name suggests. It translates **MUI's own component chrome**, not your content or your formatting.

```ts
import { plPL } from '@mui/material/locale';
import { plPL as dataGridPlPL } from '@mui/x-data-grid/locales';
import { plPL as pickersPlPL } from '@mui/x-date-pickers/locales';

const theme = createTheme(brandTheme, plPL, dataGridPlPL, pickersPlPL);
```

| Concern | Handled by | Notes |
|---|---|---|
| Pagination „Wierszy na stronie", table sort/filter labels, dialog buttons, autocomplete „Brak opcji" | **MUI `plPL`** | Free. Applies to core + DataGrid + Pickers, each with its own locale export. |
| Date picker calendar, month names, first day of week | **MUI Pickers + adapter locale** (`AdapterDateFns` with date-fns `pl`) | Genitive month forms come from the adapter's locale data, not from MUI. |
| Currency `1 234,56 zł` | **`Intl.NumberFormat('pl-PL')`** | Built into the browser and Node. No library, no dependency. |
| Dates „23 sierpnia 2026" | **`Intl.DateTimeFormat('pl-PL')`** | Same. |
| Plurals „1 moduł / 2 moduły / 5 modułów" | **`Intl.PluralRules('pl')`** + a ~15-line helper | MUI has no concept of your domain nouns. |
| Sorting ą after a, ł after l | **`Intl.Collator('pl')`** client-side, `COLLATE "pl-PL-x-icu"` in Postgres | MUI's DataGrid sorts with a comparator you supply. |
| Comma decimal input (`1,2`) | **Our own input component** | See below. |
| Diacritic-insensitive search | **Postgres `unaccent`** | Server-side; nothing to do with the UI layer. |
| Engraving-font glyph coverage | **Our own validator** (§17.2) | Nothing off the shelf does this. |

So: adopt MUI's locale exports (they're free and correct), and rely on **`Intl`** for everything else — it is genuinely excellent, ships with the platform, and needs no dependency. The only hand-written pieces are the plural helper, the numeric input, and the engraving-font validator, and all three are small, pure functions that live in `src/domain` with unit tests.

On the numeric input specifically: MUI v9 introduced a Base UI-backed `NumberField`, which is the right base, but the parse/format boundary is where dimensions get silently corrupted, so we own it — a thin `DimensionInput` that accepts `1,2` and `1.2`, normalises to integer millimetres, and is tested against comma, period, spaces, `1,2,3`, empty, negative and out-of-range input. That component is the single point where a mis-parsed dimension could reach production, so it gets its own test file rather than trusting a library's default behaviour.

### 17.5 Copy management and legal

- All copy in `src/content/pl/`; a lint rule forbids user-visible string literals inside components. This is not for translation — it is so the "Polish copy reviewed" checklist item is a review of ~6 files instead of ~120 components.
- Legal pages: `Regulamin`, `Polityka prywatności`, RODO information clause, `Prawo odstąpienia`.
- **The important one:** custom-made goods are exempt from the 14-day distance-selling withdrawal right (art. 38 pkt 3 ustawy o prawach konsumenta). Essentially every product on this site is made to the customer's specification, so this exemption is central to the business. It must be stated plainly on product pages and explicitly acknowledged at checkout, with the acknowledgement stored on the order. *I am not a lawyer — have a Polish e-commerce lawyer review the Regulamin before launch.*

---

## 18. SEO

- Category slugs, **updated 2026-08-23** to match the real catalogue (§5):
  `/loft`, `/amulety-i-bransoletki`, `/gres`, `/panele-podlogowe`,
  `/obrazy-drewniane`, `/inne`. The original list here (`/blaty-drewniane`,
  `/elementy-podlogowe` as a category distinct from `/panele-drewniane`) was a
  speculative placeholder from before the owner confirmed the real category
  set — `panele-podlogowe` now covers what `elementy-podlogowe` would have.
  Product-level slugs (`/wzory/linoryt-01`) are unaffected.
- Per-page `generateMetadata` from DB fields (`seoTitlePl`, `seoDescPl`), canonical URLs, Open Graph with real product imagery.
- `Schema.org` `Product` + `Offer` (with `priceCurrency: PLN`, `priceValidUntil`, availability) and `FAQPage`; `BreadcrumbList` on catalogue pages.
- `sitemap.ts` generated from the DB (products, categories, designs, content pages); `robots.ts`.
- Catalogue pages are RSC + ISR so they are fully server-rendered — the reason MUI is confined to islands (§2.1).
- Content architecture for the target queries via category intro copy and a `Jak powstaje` / materials section — written naturally, no stuffing.

---

## 19. Analytics

A single `track(event, payload)` dispatcher in `src/analytics/`, with adapters for GA4, Search Console (verification only), and Meta Pixel — **all no-ops until consent is granted** via a cookie banner (RODO requirement).

Events: `product_view`, `configurator_started`, `configurator_step_completed{step}`, `design_selected`, `material_selected`, `size_changed`, `personalization_added`, `file_uploaded`, `feasibility_warning_shown{code}`, `configuration_completed`, `add_to_cart`, `checkout_started`, `purchase`.

`configurator_step_completed` with the step code is the one that answers the real question — where customers abandon the configurator.

---

## 20. Error & empty states

Never a raw status code or stack trace. `error.tsx` / `not-found.tsx` per route segment, with Polish copy for: failed upload, unsupported file type, file too large, unavailable material, invalid dimensions, impossible combination, unavailable product, failed order creation, server error, expired session, empty cart, empty order history, no results.

Server errors log a correlation id and show the customer: „Coś poszło nie tak. Spróbuj ponownie za chwilę. Jeśli problem się powtarza, skontaktuj się z nami — numer błędu: `ABC123`."

---

## 21. Test strategy (TDD)

### 21.1 Tooling and layers

| Layer | Tool | Scope | Speed |
|---|---|---|---|
| Unit | Vitest | `src/domain/**` — pure, no DB, no mocks needed | ms |
| Integration | Vitest + real Postgres (Docker), transaction rollback per test | repositories, Server Actions, authorization | seconds |
| Component | Vitest + Testing Library | configurator steps, validation display, cart UI | seconds |
| E2E | Playwright | critical journeys, desktop + mobile viewport | minutes |

### 21.2 Order of work per feature (project rule, applied literally)

Define behaviour → enumerate normal cases → enumerate edge and invalid cases → write tests → **run and confirm they fail for the right reason** → minimum implementation → refactor green → add tests for bugs found → done.

The `src/domain` boundary is what makes this cheap: pricing, compatibility, dimension limits, module splitting and personalization validation are all pure functions with no external dependencies, so their tests are written before any Prisma model is generated.

### 21.3 Test inventory for the mandatory-first list

Every item in your project instructions' "tests first" list, mapped:

| Required area | Test location | Key cases beyond the happy path |
|---|---|---|
| product configuration | `unit/configuration` | invalid step order, unknown option id, incomplete config rejected |
| product/material compatibility | `unit/compatibility` | material unavailable, design narrows materials, finish invalid for material |
| dimensions & limits | `unit/dimensions` | below min, above max, exactly at bounds, aspect ratio violation, zero, negative, non-integer |
| production constraints | `unit/feasibility` | thin line at scale, detail level vs size, min text height, boundary equality |
| pricing | `unit/pricing` | every component isolated; rounding at .5; min-price clamp; quantity; version pinning |
| discounts | `unit/pricing` | *(none in MVP — interface + tests only if D3 says yes)* |
| modular calculations | `unit/modules` | exact boundary, sliver avoidance, min module clamp, infeasible, remainder distribution |
| personalization validation | `unit/personalization` | too long, too many lines, unsupported glyph, Polish diacritics, empty, whitespace-only, emoji |
| file upload validation | `integration/upload` | wrong magic bytes, oversize, lying content-length, SVG with script, PDF with JS, corrupted, zero-byte |
| file type/size restrictions | `integration/upload` | each allowed type, each rejected type, exact boundary sizes |
| customer design workflow | `integration/design-review` | every transition, illegal transitions, re-upload after NEEDS_CHANGES, comment authorship |
| IP confirmation | `integration/upload` | missing confirmation rejected server-side, consent text persisted, version recorded |
| cart calculations | `integration/cart` | two configs same product, duplicate, quantity change, removal, stale config |
| order totals | `integration/order` | VAT rounding, multi-line, shipping, total vs sum of lines |
| configuration persistence | `integration/configuration` | refresh, back button, expired guest session, config edited after add-to-cart |
| order snapshots | `integration/order` | catalogue mutated after order → order renders identically; price version pinned |
| customer authorization | `integration/authz` | full matrix from §16.2 |
| access to uploaded files | `integration/authz` | cross-customer 404, guest token, expired token, direct storage key guess |
| auth | `integration/auth` | login, logout, session expiry, role escalation attempt |
| API validation | `integration/actions` | malformed payload, extra fields, type coercion, injection strings |
| error handling | across layers | each error surface renders Polish copy, no stack leak |
| checkout/order creation | `integration/order` + `e2e` | price mismatch rejected, concurrent order numbers, transaction rollback on failure |
| production status transitions | `unit/order-status` | legal/illegal transitions, design-review gate, actor permission |

### 21.4 E2E journeys (Playwright, desktop + mobile)

1. Wall art: browse → configure → warning acknowledged → cart → checkout → order created → confirmation shows full config.
2. Kitchen tile: choose each of the three installation variants; assert the summary states what the customer receives.
3. Large product: configure 120 × 120 cm → module layout shown → snapshot records modules.
4. Custom upload: upload → IP checkbox → warnings → order → status `DESIGN_REVIEW` → staff approves → status advances.
5. Floor element: exact dimensions required → matching warning acknowledged.
6. Two different configurations of the same product in one cart.
7. Refresh and browser-back mid-configuration; state preserved.

### 21.5 Explicitly not a goal

Coverage percentage. Tests assert business behaviour. A test that asserts a component renders a `<div>` is deleted on sight.

---

## 22. Implementation plan

Each phase is TDD: tests first, red, minimum implementation, green, refactor. A phase is done when its acceptance criteria pass and the suite is green.

| Phase | Contents | Acceptance |
|---|---|---|
| **P0 — Foundation** | Repo, TS strict, Vitest/Playwright, Docker Postgres, Prisma schema + first migration, MUI theme + RSC/island split, content module, lint rule for stray UI strings | `npm test` runs; theme renders; migration applies |
| **P1 — Domain core** *(no UI, no DB)* | `money`, `dimensions`, `compatibility`, `modules`, `pricing`, `personalization`, `feasibility` | Full unit suite green; §21.3 unit rows complete |
| **P2 — Catalogue** | Seed data (materials, finishes, designs, 5 products), category & product pages as RSC, SEO metadata, sitemap, robots | Real Polish catalogue browsable; Lighthouse SEO ≥ 95 |
| **P3 — Configurator** | Step machine, option resolution via Server Actions, live preview, price display, warnings, URL/DB persistence | All 5 product types configurable; refresh/back preserved; price server-authoritative |
| **P4 — Upload & review** | Upload route with full validation pipeline, storage adapter, IP consent, review states, staff comments | Malicious SVG rejected; cross-customer access 404; review transitions enforced |
| **P5 — Cart & order** | Cart, checkout, order transaction, snapshot, bank-transfer instructions, confirmation, order lookup | Snapshot immune to catalogue mutation; totals correct; concurrent order numbers unique |
| **P6 — Account & polish** | Order history, saved configurations, mailer adapter, analytics + consent + `AnalyticsEvent`, error/empty states, legal pages, mobile pass | Storefront E2E green desktop + mobile |
| **P7 — Admin panel** | Auth/roles/middleware, audit log, orders, design review, catalogue, designs, materials & finishes, customers, content, production queue, settings | Admin authorization matrix green; audit log complete; soft-delete enforced |
| **P8 — Pricing admin & statistics** | Pricing screens with versioning + simulator, dashboard KPIs and charts, funnel from `AnalyticsEvent`, CSV exports | Rate change creates a version, leaves existing orders untouched, and cannot publish without simulation |
| **P9 — Final verification** | Full checklist review, edge-case sweep, security pass, Polish copy review, performance | §22.1 checklist reviewed item by item |

**Phasing note.** P7–P8 are sequenced after the storefront deliberately: the panel is CRUD over a data model that P1–P5 must prove correct first, and building admin screens against a schema still in flux wastes the most effort of anything in this plan. The three operations that genuinely cannot wait — approve a design, mark a transfer paid, advance production status — are delivered as the first slice of P7 (`P7a`), so the storefront is never able to reach a state no human can act on. See **D2**.

### 22.1 Final checklist

Your §40 checklist, plus the items this analysis added. Kept in `docs/CHECKLIST.md` and reviewed line by line before the project is called finished.

*Added beyond the original list:* prices computed server-side only · price version pinned in every order · order renders correctly after catalogue mutation · Polish pluralization correct at 1/2/5/22 · Polish diacritics render in every chosen font · SVG uploads sanitized · storage keys not guessable · order numbers unique under concurrency · withdrawal-right exemption for custom goods stated and acknowledged · analytics fire only after consent · no MUI in the RSC catalogue tree · no fake email/payment/production-file behaviour anywhere.

---

## 23. Risk register

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| R1 | ~~npm registry blocked~~ **Resolved** — npm works in your PowerShell; builds and tests run on your machine (§1) | — | Closed 2026-08-23 |
| R1b | I cannot execute the test suite, so "green" is your observation, not mine | A silent regression could be reported as passing | Every claim of passing tests is tied to output you paste back; failure messages written to state the expected reason |
| R2 | MUI's default look reads "admin dashboard", contradicting premium positioning | Brand failure — the stated primary risk of the whole project | Aggressive theme override (§2.1); design review of the homepage before P3 |
| R3 | MUI is client-side; naive use kills SEO and LCP on catalogue pages | Lost organic traffic — the main acquisition channel | RSC/island split enforced by lint rule + a test asserting no `@mui/material` import in `(marketing)`/`(shop)` server components |
| R4 | ~~Feasibility constraints are guesses until real machine data exists~~ **Resolved 2026-08-23** — real usable area and module floor confirmed (D7); `domain/feasibility` now enforces `THICKNESS_EXCEEDS_MACHINE` against `MachineSettings.maxWorkpieceThicknessMm = 100`, tested including the boundary. A separate, still-open question: the TwoTrees spec's "20 mm carving layer height" is a different limit (per-pass cut depth into a surface, not workpiece clearance) that would inform a future design-relief-depth check — not built, not the same gap as this row | Promising unmanufacturable results, or over-warning and losing sales | All constraints are DB values, not constants; tune from real production without a deploy |
| R5 | Modular splitting off-by-one at exact boundaries | Wrong module count → wrong price and wrong production plan | Boundary tests written before implementation (§9) |
| R6 | Money as float | Off-by-grosz vs. invoices | Integer grosze by construction, enforced in `domain/money` |
| R7 | Unsanitized customer SVG | Stored XSS | §13.1 step 3; served as attachment / rasterized |
| R8 | Order snapshot implemented as joins | Historical orders change when catalogue changes | Snapshot JSON + mutation test |
| R9 | Guest → user cart merge loses configurations | Lost sales, angry customers | Union merge with integration test |
| R10 | ~~"No admin panel" leaves no way to approve designs~~ **Resolved** — full panel now in scope (§16A) | — | Closed 2026-08-23 |
| R10b | Full admin panel roughly doubles the build and can delay storefront launch indefinitely | The shop never opens | P7a (three operational screens) unblocks launch; the rest of the panel ships after, against a proven schema |
| R14 | Admin pricing screen mistyped → every price on the site changes | Direct revenue loss, and orders taken at wrong prices | Versioned saves, mandatory price simulator before publish, full audit diff, existing orders pinned (§16A.1 §7) |
| R15 | `latin` Google Fonts subset silently drops ą ć ę ł ń ó ś ź ż | Broken glyphs across the whole site, usually spotted after launch | `subsets: ['latin','latin-ext']` in `next/font`; a visual test string containing every Polish diacritic in the component test suite |
| R16 | Decorative engraving font lacks Polish glyphs | Permanently wrong text carved into a finished product — unrecoverable | Per-font cmap coverage parsed at seed time; personalization validator rejects uncovered characters; preview renders the production font file (§17.2) |
| R11 | Withdrawal-right exemption for custom goods not properly disclosed | Legal exposure in PL consumer disputes | §17 legal pages; external legal review |
| R12 | ~~Photography not ready~~ **Resolved 2026-08-23** — a stated placeholder plan now exists and is built: on-brand generated SVGs, unmistakable as placeholders, never presented as real product photos | A premium visual brand with placeholder images is not premium | Decision D5, resolved — real photography still needed before launch; the risk now is launching before that swap happens, not an unstated plan |
| R13 | Scope creep from the "future features" list | MVP never ships | §24 is binding |

---

## 24. Explicitly out of scope for MVP

Online payments · courier/InPost integration · automated invoicing · 3D configurator · SVG/DXF/G-code/CAM generation · automated image vectorization · CNC/laser machine integration · B2B / wholesale pricing · loyalty programme · additional languages · customer-supplied materials · leg/accessory catalogue · dark mode · discount codes (unless D3 says otherwise).

*(The admin panel was moved out of this list on 2026-08-23 and is now P7–P8.)*

*(A blog was never in this list either way — added 2026-08-25 at the
owner's explicit request. Scope stayed deliberately minimal: `BlogPost`
model, `/blog` + `/blog/[slug]` pages, sitemap entry, zero seeded posts.
No authoring UI exists yet — that's P7's job, same as every other
content-editing surface. See `docs/HANDOVER.md` §9o.)*

Each of these has a defined extension point in the model above; none requires a rewrite to add.

---

## 25. Decisions I need from you before coding

| # | Decision | Why it matters | My recommendation |
|---|---|---|---|
| ~~D1~~ | ~~Blocked npm registry~~ | **Resolved 2026-08-23** — npm works in your PowerShell; you run installs and tests, I write files (§1) | — |
| ~~D2~~ | ~~Minimal operator console~~ | **Resolved 2026-08-23** — superseded: a full admin panel is in scope (§16A) | — |
| **D2b** | Does the storefront launch once P7a (approve designs / confirm payment / advance status) is done, or do you wait for the complete panel? | Determines whether you can take real orders in ~⅔ of the total build time or at the end | Launch on P7a. Taking real orders while the rest of the panel is built is how you find out what the panel actually needs |
| **D3** | Discount codes in MVP? | Your project rules list "discounts" as tests-first; the brief never mentions them | Out of scope; add in Phase 2 |
| ~~D4~~ | Real numbers for material `pricePerM2`, machine rate per minute, module surcharge, packaging tiers | The pricing engine is structurally correct but produces meaningless złoty without them | **Resolved 2026-08-23** — seeded `TODO_PRICING` placeholders in `prisma/seed.ts`, clearly marked, to be swapped before launch |
| ~~D5~~ | Product photography and design assets — available, or placeholders? | Brief §6 makes imagery the core of the brand | **Resolved 2026-08-23** — generated on-brand placeholder SVGs (`scripts/generate-placeholder-images.mjs`), not downloaded stock photography of unrelated products. Swap for real photography and real design artwork before launch. Full detail in `docs/HANDOVER.md` §9d |
| **D6** | Customer accounts required at checkout, or guest checkout too? | Affects cart, order lookup, and the auth surface | Guest checkout + optional account — fewer abandoned carts |
| ~~D7~~ | Real machine usable area and minimum module size | §9 currently assumes 580 × 880 mm effective and 150 mm minimum | **Resolved 2026-08-23** — 600×500mm usable, 150mm min module, 100mm max Z-thickness (`MachineSettings.maxWorkpieceThicknessMm`, now enforced by `domain/feasibility` as `THICKNESS_EXCEEDS_MACHINE`). Full detail in `docs/HANDOVER.md` §9 |
| **D8** | Confirm the `KITCHEN_TILE` default size (70 × 120 mm) and whether customers may deviate | Affects preset vs custom size logic | Fixed presets matching common Polish backsplash tile formats — **note:** the real gres product seeded 2026-08-23 uses a size range (300–1200 × 300–700 mm), not the 70×120mm preset originally assumed; D8 is still open on whether fixed presets are wanted at all for this category |

---

## Appendix A — Schema addenda referenced above

> **Status, 2026-08-23:** the schema in `prisma/schema.prisma` is written and
> validated, and every addendum below is in it. Four things were built
> differently from §6 and the schema header comment explains each:
> sub-millimetre tolerances are integer micrometres (`…Um`) rather than
> `Float` millimetres; aspect ratios are basis points (`…Bp`);
> `Material.minDetailSpacingUm` was added because `evaluateFeasibility` needs
> it and §6.3 omitted it; and `PricingSettings` is an append-only version
> table rather than a mutable singleton, which is what §16A.1 module 7
> requires anyway. `docs/HANDOVER.md` §6.1 records the reasoning.

Fields mentioned in the engine sections that need adding to §6 when the schema is written:

- `Design.referenceWidthMm: Int` — the width at which `minLineWidthMm` is declared (§8)
- `Design.machiningMilliMinutesPerM2: Int` — pricing input (§10.1). **Built as an integer number of THOUSANDTHS of a minute**, not the Float this line originally proposed: a float here reintroduces the floating point that `domain/money` exists to keep out of the price chain.
- `Product.minPriceGrosze: Int` — the price clamp (§10.1)
- `Material.grainDirection: enum { NONE, LENGTHWISE }` — rotation permission in module layout (§9)
- `PricingSettings` singleton: `machineRateCncGrosze`, `machineRateLaserGrosze`, `moduleSurchargeGrosze`, `packagingTiers Json`, `vatRateBp`, `version`, `updatedAt`
- `MachineSettings` singleton: `usableWidthMm`, `usableHeightMm`, `minModuleMm`, `jointAllowanceMm`
