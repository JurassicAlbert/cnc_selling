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

## 5. Sitewide UI polish - and a warning about how NOT to do it

**Corrected 2026-09-13.** This section used to list the storefront's
"raw HTML/CSS-variable styling" as a gap, with FAQ, the product listing
pages and the home page's own sections named as not yet converted to
MUI. Read today, that is an instruction to undo a measured decision, so
it is rewritten rather than left to mislead.

**The storefront deliberately mounts no MUI theme provider, and this is
not a shortcut.** `src/app/theme-vars.css`'s own header records the
Lighthouse audit that settled it (2026-08-23, measured rather than
assumed): with `ThemeRegistry` wrapping every page from the root layout,
mobile performance was **74/100 with a 3.8s LCP on a product page that
used zero interactive MUI components** - roughly 154KB of MUI, Emotion
and React client runtime shipped to pages needing none of it. The RSC
primitives (`Heading`, `Text`, `Container`, `Section`, `Card`,
`SiteHeader`) only ever needed the CSS custom properties.

So the rule is the one that file states: `ThemeRegistry` is still
correct and still used - wrap it around the specific island that needs a
live `@mui/material` component (the configurator, cart, checkout, the
login dialog, the whole `/panel`), never around the root layout again.
Converting a storefront page to MUI "for consistency" is a performance
regression, not polish.

**What is genuinely open here is visual, not technical.** Several of the
surfaces this section used to name have since been worked on in their
own right - the home page's sections and the FAQ page both got headings,
leads and a way out on 2026-09-11 (UX-16 and the section-intro pass),
and the header, cart and checkout were reshaped across RWD-04, UX-23,
UX-27 and UX-29. What is left is taste and time, not a missing
credential and not a missing library.

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

## 7. Should `STAFF` be able to edit the catalogue? - **RESOLVED 2026-09-05**

**The owner chose read-only:** "admin is the only person doing changes on
admin panel we dont have superadmin for now". The docs were right and the
code was over-permissive, so the code moves.

- The disagreement was real: `ARCHITECTURE.md` §16.3 says `STAFF` gets
  "pricing and catalogue **read-only**" and §16.2's test matrix lists
  "`STAFF` → catalogue write → 403", while every catalogue mutation used
  `requireStaffSession()`. Pricing *was* already correctly `ADMIN`-only.
- **It was 84 operations, not the ~20 estimated here.** Measured before
  acting, because the number changes what the work is. Six of them are not
  catalogue at all but day-to-day operator work - moving an order through
  production, marking it paid, recording a shipment, deciding a design
  review, answering a support request, moderating a review - and the owner
  was asked specifically about those before they moved too.
- **Consequence, recorded because it is not obvious:** `STAFF` is now a
  genuinely read-only role. Nobody holds it today (the owner runs the panel
  alone and there is no tier above `ADMIN`), so this costs nothing now; if
  an operator is hired, giving them back the six operational writes is one
  line each, and the split is written down under P2-9 in
  `docs/AI-CHECKLIST.md`.
- Deleting the role entirely was offered and refused, so `STAFF` stays as
  the read-only tier the architecture always described.

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

## 10. Package insurance - built, waiting only for the real rate cards

- **Owner request, 2026-09-05**, answering BUG-08: package insurance as a
  checkout option the customer can select. Asked how it should be priced,
  the owner chose **the carrier's real declared-value table** over a flat
  fee or a percentage.
- **What exists** (complete 2026-09-09): the whole mechanism, end to end.
  `DeliveryInsuranceTier` holds a carrier's declared-value bands the same way
  `DeliveryWeightTier` holds weight brackets; `domain/checkout/insurance.ts`
  picks the cheapest band that covers an order (8 unit tests, written first);
  `resolveDeliveryMethodsForCart` resolves the offer beside the delivery
  price, so checkout and `createOrder` cannot disagree; the checkout shows an
  opt-in control and the premium in the total; `createOrder` re-derives the
  premium server-side from the carrier's table and snapshots
  `insuranceGrosze`/`insuranceLabelPl` like `shippingGrosze` beside them; the
  confirmation, order history and admin order views show it; and
  `/panel/dostawa/[id]` has the editor for typing the bands in.
- **What the owner has to do to turn it on**: open a delivery method under
  `/panel/dostawa`, and enter the carrier's value bands under „Ubezpieczenie
  przesyłki". That is the whole activation. **No band is seeded**, so today
  every method's table is empty, no method offers cover, and no customer sees
  anything at all - the screen says so in as many words rather than looking
  broken.
- **Two rules worth knowing before entering a card.** An order worth more
  than the highest band is offered **nothing**, deliberately: selling „do
  5000 zł" cover on a 6000 zł order would leave the customer believing they
  are covered when they are not. And a customer who asks for cover that has
  since been withdrawn gets a refusal at checkout rather than an uninsured
  order placed quietly - `INSURANCE_UNAVAILABLE`.
- **What's blocking it**: nothing in the code. Only the content - InPost's
  and DPD's actual declared-value ("ubezpieczenie przesyłki") rate cards, the
  value bands and what each band costs. Both publish these to business account holders; neither has
  a citable public table, which is the same wall item 2 hit with GEIS. The
  owner chose this over a flat fee or a percentage of order value, both of
  which could have shipped immediately.
- **Why nothing is seeded meanwhile**: the same reason `Kurier GEIS` is
  seeded `isActive: false`. The owner's own instruction is that "you are not
  allowed to lie", and a plausible-looking premium presented as a quote is
  exactly that.

## 11. Engraving faces exist - their legibility floors are still a guess

**Status 2026-09-13: the faces are real, one number about them is not.**

BUG-31 was that a single face was seeded (Inter, the site's own UI
sans), so the cmap-coverage apparatus had nothing to prove itself
against. Four more are now seeded at the owner's choice - **EB Garamond,
Playfair Display, Montserrat and Parisienne** - all SIL Open Font
License, all taken from `github.com/google/fonts`, each with its
`OFL.txt` stored beside the file in `public/fonts/`, and every one
verified to carry all 18 Polish-specific letters before it entered the
repository. The seed re-parses each real file on every run and refuses
to seed a face missing a Polish glyph.

**What is still owed by the owner: a real `minHeightUm` per face.** All
five carry the same **3 mm placeholder** Inter has had since 2026-08-24,
and it is a placeholder in exactly the `TODO_PRICING` sense - a number
nobody measured. One shared placeholder rather than five invented ones,
because five different guesses would look like measurements.

This matters most for **Parisienne**. A connected script with thin
strokes and fine joins will stop being legible well above the size a
grotesque does, and 3 mm is very likely too low for it - which in
practice means the configurator would accept an engraving that comes off
the machine unreadable. Nothing in the code can settle that.

**What's needed**: a test cut per face - engrave a Polish word with
diacritics at descending cap heights on a real material and record the
smallest that stays readable. Then set `Font.minHeightUm` per row. Until
then the floor is uniform and optimistic, and the honest thing is that
this is written down rather than assumed correct.

---

*Update this file (don't just let it go stale) whenever one of these
items gets resolved or a new one comes up - it exists so a session that
picks this project back up doesn't have to re-derive "what are we
actually still waiting on" from scratch.*
