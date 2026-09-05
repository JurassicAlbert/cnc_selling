# Open items - blocked on real data/credentials only the owner can supply

Everything here is real, working code waiting on one external thing (an
account, a real number, a decision) - not a TODO of unfinished engineering.
Each item names exactly what's needed and where it plugs in once supplied.
Written 2026-08-29, after P9 continuation rounds 8–10 (see
`docs/HANDOVER.md` §9z51–§9z53 and `docs/CHECKLIST.md`'s matching sections
for the full technical detail behind each line here).

## 1. Real payment: Przelewy24 (→ also unlocks BLIK + card)

- **What exists**: `src/server/services/payment/przelewy24.ts` is a real,
  spec-accurate client for Przelewy24's actual `/transaction/register` REST
  endpoint and their real SHA384 signature algorithm. Unit-tested
  (`tests/unit/przelewy24.test.ts`) without ever making a network call.
- **What's blocking it**: four env vars, all currently unset -
  `P24_MERCHANT_ID`, `P24_POS_ID`, `P24_API_KEY`, `P24_CRC`. These only
  exist once the business registers a real merchant account at
  [przelewy24.pl](https://www.przelewy24.pl) - sandbox/test credentials are
  normally issued quickly, before full production verification.
- **Why BLIK/card ride along**: Przelewy24 is a payment aggregator - BLIK
  and card payments are typically available through the SAME integration,
  not three separate ones. Registering once likely covers all three.
- **The remaining step, once credentials exist**: set the four env vars.
  Flipping `PaymentMethodConfig.isConnected` to `true` for the seeded
  "Przelewy24" row (`prisma/seed.ts`) is the only code-adjacent change -
  everything else (checkout wiring, order creation) already expects a
  connected provider to just show up in `listActivePaymentMethods()`.

## 2. GEIS courier - no real published price list found

- Searched directly: epaka.pl, globkurier.pl, fastpost.pl,
  pogotowiepaczkowe.pl, and geis.pl itself. Every source only offers an
  interactive per-shipment quote form - no static weight-tier table exists
  to cite honestly (owner's own instruction: "you are not allowed to lie").
- Seeded as a real row (`Kurier GEIS`, `carrier: 'GEIS'`) but
  `isActive: false`, so it's visible to staff in `/panel/dostawa` but never
  selectable at checkout.
- **What's needed**: either a real GEIS rate card (a PDF/page with actual
  weight-bracket prices) or a GEIS business contact who can provide one.
  Once supplied, add `DeliveryWeightTier` rows for it in `prisma/seed.ts`
  the same way InPost/DPD's are already there, and flip `isActive: true`.

## 3. Pickup-point ("paczkomat") picker - real but not live

- `src/server/delivery/pickup-points.ts` is a real, carrier-scoped,
  searchable dataset (InPost + DPD, Poczta Polska dropped per owner
  instruction) - but it's a static sample of real-looking locations, not a
  live directory. The picker says this outright in its own UI copy.
- A genuinely live directory needs InPost's real Geowidget/Points API,
  which needs a free "Parcel Manager" business registration (real company
  details required) - confirmed live: no unauthenticated public endpoint
  exists for the Polish market.
- **What's needed**: register for InPost Parcel Manager, hand over the
  issued API token. `searchPickupPoints`/`findPickupPointById` in that one
  file are the only functions that would need to change to call the real
  API instead of the static array - nothing else in checkout does.

## 4. Bank account number - not a bug, just not filled in

- `StoreSettings.bankAccountNumber` is a real, working admin field. It's
  currently empty, which is why every confirmation page honestly says
  "we'll send the account number separately" instead of showing one.
- **What's needed**: fill it in at `/panel/ustawienia`. Nothing to build.

## 5. Sitewide UI polish - real, but only partly done

- Cart, checkout, and all three order-detail surfaces (guest confirmation,
  account history, admin) are now real MUI (rounds 8–10).
- Confirmed still raw HTML/CSS-variable styling in most of the rest of the
  site (this was never disputed, just not yet acted on systematically):
  FAQ, product listing pages, the home page's own sections, and other
  storefront forms/views not yet touched.
- No blocker here - this is scope/time, not a missing credential. Worth
  deciding whether to keep converting page-by-page as flagged, or do one
  deliberate systematic sweep across the storefront in a dedicated round.

## 6. Rate limits on order creation and login (§16.1) - **RESOLVED 2026-08-30/31**

**The owner chose Postgres.** Built and verified on 2026-08-31: a
`RateLimit` table (migration `20260831000000_add_rate_limit`), one atomic
`INSERT … ON CONFLICT DO UPDATE … RETURNING` in
`src/server/rate-limit/rate-limit.ts`, the real limits in `rules.ts`, and
the per-action throttles in `auth-throttle.ts`. Wired into login,
registration, OTP requests and order creation. 20 tests, including a
20-way concurrency test proving no attempt is lost.

The audit also found the reason this mattered more than §16.1 implied:
every auth form calls `auth.api.*` **directly**, so Better Auth's own
limiter - which lives in its HTTP router's `onRequest` hook - never ran at
all. See `docs/REVIEW-DETAILED.md` SEC-01.

The original write-up is kept below for the record.

---

## 6 (original). Rate limits on order creation and login (§16.1)

- `ARCHITECTURE.md` §16.1 requires rate limits on "uploads per session/
  hour, **order creation per IP**, **auth attempts**". Only the upload
  limiter exists (`src/server/upload/rate-limit.ts`). Order creation and
  login are unthrottled - found by the 2026-08-30 audit (P1-8).
- **Not a code gap so much as a missing decision.** The upload limiter
  works by counting real `UploadedFile` rows in a time window, which does
  not transfer: a failed login leaves no row to count, and counting order
  attempts per IP needs somewhere to keep per-IP state that survives
  across serverless invocations.
- **What's needed from the owner**: a call on where that state lives -
  a small `RateLimit` table in Postgres (simplest, no new infrastructure,
  a write per attempt), or a real Redis/Upstash instance (correct at
  scale, another service to run and pay for). Either is a couple of hours
  of work once chosen; choosing wrong is the expensive part.

## 7. Should `STAFF` be able to edit the catalogue?

- `ARCHITECTURE.md` §16.3 says `STAFF` gets "pricing and catalogue
  **read-only**", and §16.2's own test matrix lists "`STAFF` → catalogue
  write → 403". The code does not do that: every catalogue mutation uses
  `requireStaffSession()`, so `STAFF` can create, edit and retire
  products, materials, designs, finishes, categories and collections.
  Pricing *is* correctly `ADMIN`-only.
- Not a security hole - no customer can reach any of it - but the docs
  and the code genuinely disagree, and only the owner can say which one
  is right.
- **What's needed**: a decision. Either relax the docs (if staff are
  trusted to run the catalogue day to day), or tighten ~20 actions to
  `requireAdminSession()`. Cheap either way once decided.

## 8. Four models with no admin screen at all

Found by auditing every Prisma model against the panel (2026-08-30, §20).
`DeliveryWeightTier` was the fifth and the one that actually mattered -
it decides what customers are charged - and now has a real editor on the
delivery-method page. These four remain, deliberately:

| Model | What it holds | Why it can wait |
|---|---|---|
| `Font` | engraving fonts | Adding one is not just a DB row - a real font file has to be licensed, installed and validated by `opentype.js`. A form alone would be a trap. |
| `PersonalizationSpec` | per-product engraving rules (max characters, allowed fonts) | Real, seeded, and correct. Changing it is rare and currently a seed edit. |
| `MachineSettings` | the real machine's own limits, feeding feasibility and pricing | One row, changed roughly never, and wrong values silently distort every quote. Arguably *should* stay out of a form. |
| `ProductFinishExclusion` | "this finish is not available on this product" | Editable indirectly today via the product's finish compatibility; a dedicated screen is a nice-to-have. |

**What's needed**: nothing urgent. Worth revisiting if the owner finds
themselves wanting to change any of these without a developer. `Font` is
the one most likely to come up, and is also the one that needs the most
care beyond a CRUD form.

## 9. A customer cannot delete an uploaded design

Found during the 2026-08-30 duplicate sweep, alongside the saved-project
delete that WAS added. These are not the same problem:

- A saved project (`Configuration`) is safe to delete outright - nothing
  historical references it, because `OrderItem` carries an immutable
  snapshot and never joins back. That is now built.
- An uploaded design (`CustomerDesign`) is referenced by
  `OrderItem.customerDesignId`. Hard-deleting one would leave a completed
  order pointing at nothing, which is exactly what §16A.2's soft-delete
  invariant exists to prevent ("an existing order must not become
  meaningless because a row it referenced was later deleted").

**What's needed**: a decision on the shape, not just the code. A real
"remove from my library" needs an `archivedAt`-style column so the design
disappears from `/moje-konto/wzory` and the configurator's reuse picker
while every order that used it still resolves. It also needs a call on
what happens to the stored file - kept (simplest, and what the order
audit trail arguably requires) or purged on request (a real GDPR
erasure path, larger). Both are a couple of hours once decided; deciding
is the part only the owner can do.

---

*Update this file (don't just let it go stale) whenever one of these
items gets resolved or a new one comes up - it exists so a session that
picks this project back up doesn't have to re-derive "what are we
actually still waiting on" from scratch.*
