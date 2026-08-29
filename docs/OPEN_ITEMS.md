# Open items — blocked on real data/credentials only the owner can supply

Everything here is real, working code waiting on one external thing (an
account, a real number, a decision) — not a TODO of unfinished engineering.
Each item names exactly what's needed and where it plugs in once supplied.
Written 2026-08-29, after P9 continuation rounds 8–10 (see
`docs/HANDOVER.md` §9z51–§9z53 and `docs/CHECKLIST.md`'s matching sections
for the full technical detail behind each line here).

## 1. Real payment: Przelewy24 (→ also unlocks BLIK + card)

- **What exists**: `src/server/services/payment/przelewy24.ts` is a real,
  spec-accurate client for Przelewy24's actual `/transaction/register` REST
  endpoint and their real SHA384 signature algorithm. Unit-tested
  (`tests/unit/przelewy24.test.ts`) without ever making a network call.
- **What's blocking it**: four env vars, all currently unset —
  `P24_MERCHANT_ID`, `P24_POS_ID`, `P24_API_KEY`, `P24_CRC`. These only
  exist once the business registers a real merchant account at
  [przelewy24.pl](https://www.przelewy24.pl) — sandbox/test credentials are
  normally issued quickly, before full production verification.
- **Why BLIK/card ride along**: Przelewy24 is a payment aggregator — BLIK
  and card payments are typically available through the SAME integration,
  not three separate ones. Registering once likely covers all three.
- **The remaining step, once credentials exist**: set the four env vars.
  Flipping `PaymentMethodConfig.isConnected` to `true` for the seeded
  "Przelewy24" row (`prisma/seed.ts`) is the only code-adjacent change —
  everything else (checkout wiring, order creation) already expects a
  connected provider to just show up in `listActivePaymentMethods()`.

## 2. GEIS courier — no real published price list found

- Searched directly: epaka.pl, globkurier.pl, fastpost.pl,
  pogotowiepaczkowe.pl, and geis.pl itself. Every source only offers an
  interactive per-shipment quote form — no static weight-tier table exists
  to cite honestly (owner's own instruction: "you are not allowed to lie").
- Seeded as a real row (`Kurier GEIS`, `carrier: 'GEIS'`) but
  `isActive: false`, so it's visible to staff in `/panel/dostawa` but never
  selectable at checkout.
- **What's needed**: either a real GEIS rate card (a PDF/page with actual
  weight-bracket prices) or a GEIS business contact who can provide one.
  Once supplied, add `DeliveryWeightTier` rows for it in `prisma/seed.ts`
  the same way InPost/DPD's are already there, and flip `isActive: true`.

## 3. Pickup-point ("paczkomat") picker — real but not live

- `src/server/delivery/pickup-points.ts` is a real, carrier-scoped,
  searchable dataset (InPost + DPD, Poczta Polska dropped per owner
  instruction) — but it's a static sample of real-looking locations, not a
  live directory. The picker says this outright in its own UI copy.
- A genuinely live directory needs InPost's real Geowidget/Points API,
  which needs a free "Parcel Manager" business registration (real company
  details required) — confirmed live: no unauthenticated public endpoint
  exists for the Polish market.
- **What's needed**: register for InPost Parcel Manager, hand over the
  issued API token. `searchPickupPoints`/`findPickupPointById` in that one
  file are the only functions that would need to change to call the real
  API instead of the static array — nothing else in checkout does.

## 4. Bank account number — not a bug, just not filled in

- `StoreSettings.bankAccountNumber` is a real, working admin field. It's
  currently empty, which is why every confirmation page honestly says
  "we'll send the account number separately" instead of showing one.
- **What's needed**: fill it in at `/panel/ustawienia`. Nothing to build.

## 5. Sitewide UI polish — real, but only partly done

- Cart, checkout, and all three order-detail surfaces (guest confirmation,
  account history, admin) are now real MUI (rounds 8–10).
- Confirmed still raw HTML/CSS-variable styling in most of the rest of the
  site (this was never disputed, just not yet acted on systematically):
  FAQ, product listing pages, the home page's own sections, and other
  storefront forms/views not yet touched.
- No blocker here — this is scope/time, not a missing credential. Worth
  deciding whether to keep converting page-by-page as flagged, or do one
  deliberate systematic sweep across the storefront in a dedicated round.

---

*Update this file (don't just let it go stale) whenever one of these
items gets resolved or a new one comes up — it exists so a session that
picks this project back up doesn't have to re-derive "what are we
actually still waiting on" from scratch.*
