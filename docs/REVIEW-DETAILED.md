# Detailed review — 2026-08-30

Commit `e774e40`, branch `main`. Companion to `REVIEW-OVERVIEW.md`.

**Status vocabulary** (used exactly as the brief defines it):

| Status | Meaning |
|---|---|
| CONFIRMED BUG | Reproduced, or the defect is unambiguous from the code path, with the evidence named |
| LIKELY BUG | The code path implies it; not reproduced end to end |
| ARCHITECTURAL CONCERN | Not wrong today; will become expensive |
| MISSING FUNCTIONALITY | Specified somewhere, not built |
| MISSING TEST | See `REVIEW-TEST-COVERAGE.md` |
| UX/UI · PERFORMANCE · SECURITY · RECOMMENDATION | as named |
| NEEDS VERIFICATION | Cannot be settled in this environment; says why |

Every file path below was opened during the review. Every line number was
correct at commit `e774e40`.

---

# P0 — Critical

---

## SEC-01 — Login, registration and OTP requests are completely unthrottled

- **Status:** CONFIRMED BUG · SECURITY CONCERN
- **Severity:** P0
- **Area:** security / auth
- **Files:** [src/server/actions/auth.ts](src/server/actions/auth.ts) (`submitLogin`, `submitRegister`, `submitOtpRequest`, `submitOtpLogin`), [src/server/auth/auth.ts](src/server/auth/auth.ts)
- **Routes:** `/logowanie`, `/rejestracja`

**Current behaviour.** All four auth Server Actions call Better Auth's
programmatic API directly (`auth.api.signInEmail({ body, headers })`).
Better Auth's rate limiter is installed as the **HTTP router's**
`onRequest` hook — `node_modules/better-auth/dist/api/index.mjs:163-169`,
`const rateLimitResponse = await onRequestRateLimit(currentRequest, ctx)`.
It only runs for requests that reach `auth.handler`, i.e.
`/api/auth/[...all]`. A direct `auth.api.*` call bypasses the router
entirely, so the limiter never executes. `betterAuth({...})` in
`auth.ts` also sets no `rateLimit` option of its own.

Confirmed default, `node_modules/better-auth/dist/context/create-context.mjs:169-174`:
`enabled: options.rateLimit?.enabled ?? isProduction` — enabled in
production, but only on the path this app does not use.

**What this allows.**

1. **Unlimited password guessing** against `submitLogin`. `signInEmail` has
   no attempt counter of its own.
2. **Unlimited OTP email sending** via `submitOtpRequest`: anyone can make
   the shop email any address, repeatedly — inbox flooding for a victim,
   direct cost and sender-reputation damage for the shop.
3. **Unlimited account creation** via `submitRegister`.

**Partially mitigated:** OTP *verification* is bounded — the `emailOTP`
plugin allows 3 attempts (`node_modules/better-auth/dist/plugins/email-otp/routes.mjs:246-253`)
and codes expire in 300s. So the six-digit code is not brute-forceable.
The request endpoint and password login are not covered by that.

**Expected behaviour.** §16.1: "Rate limits: uploads per session/hour,
order creation per IP, **auth attempts**."

**Why it matters.** Credential stuffing against a live shop, and an
unmetered outbound email endpoint, on a store that takes real orders.

**Recommended solution.** This shares a decision with `OPEN_ITEMS.md` §6
(where per-attempt state lives). Two options, and the first is nearly free:

- *Preferred:* keep using `auth.api.*` but wrap the four actions in the
  same limiter you build for order creation. A `RateLimit` table in
  Postgres (`key`, `count`, `windowStart`) with an atomic
  `INSERT … ON CONFLICT DO UPDATE … RETURNING count` is one statement and
  needs no new infrastructure — the same shape `create-order.ts` already
  uses for `OrderNumberCounter`. Key on `email` **and** on client IP
  (`x-forwarded-for`, already read by `actions/upload.ts:requestIpAddress`).
- *Alternative:* configure `betterAuth({ rateLimit: { … } })` and route the
  forms through `authClient` against `/api/auth/*`. This changes the form
  architecture and loses the Server Action ergonomics; not recommended.

Suggested limits: 5 failed logins per email per 15 min; 10 per IP per 15
min; 3 OTP requests per email per hour; 20 registrations per IP per day.
Fail with a real Polish message, not a silent no-op.

**Dependencies.** Resolve `OPEN_ITEMS.md` §6 (storage choice) first — the
same table serves order creation.

**Test required.** Integration: N+1 failed logins for one email → the N+1th
is refused; a different email is unaffected; the window expires. See
`REVIEW-TEST-COVERAGE.md` T-01.

**Acceptance criteria.**
- [ ] A test proves the (N+1)th attempt within the window is refused.
- [ ] The limiter is keyed on both identity and IP.
- [ ] `submitOtpRequest` is limited per email address, not only per IP.
- [ ] Refusal renders Polish copy from `content/pl/`, never a stack trace.

**Evidence.** `better-auth@1.7.1` source as cited; `src/server/auth/auth.ts`
has no `rateLimit` key; `grep -rn "rate-?limit" src` returns only the
upload limiter.

---

## SEC-02 — One-time login codes are written to application logs in plaintext

- **Status:** CONFIRMED BUG · SECURITY CONCERN
- **Severity:** P0
- **Area:** security / logging / auth
- **Files:** [src/server/mail/mailer.ts](src/server/mail/mailer.ts) (`renderSubjectAndText`, `UnconfiguredMailer.send`, `createMailer`), [src/server/logging/logger.ts](src/server/logging/logger.ts)

**Current behaviour.** The OTP subject line embeds the code:

```ts
subject: `Twój kod ${otpPurposePl(d.purpose)}: ${d.otp}`
```

and `UnconfiguredMailer.send` logs that subject together with the
recipient:

```ts
logger.info('mailer.unconfigured_send', { template, subject, to });
```

`createMailer()` selects `UnconfiguredMailer` purely on
`RESEND_API_KEY`/`EMAIL_FROM` being absent. There is **no production
guard** — a deployment that forgets those two variables silently starts
writing every login code and every recipient address to stdout. This is not
theoretical: `logger.ts`'s own header documents the workflow of grepping
the log for an OTP.

**Expected behaviour.** §16.1: "No PII in logs beyond user id." A
credential must never reach a log at any level.

**Why it matters.** Log aggregation is normally readable by more people
than the database is, and is retained. Anyone with log access can sign in
as any user, no password needed.

**Recommended solution.**
1. Never put the OTP in the subject — move it into the body only, and
   never log the body.
2. Log an event with no secret: `{ template, toHash: sha256(to).slice(0,8), sent: false }`.
3. Gate the fallback: if `NODE_ENV === 'production'` and no mailer is
   configured, throw at startup (or return `{ sent: false }` and log an
   `error`-level "mailer not configured" with no payload). A production
   shop silently not sending order confirmations is its own incident.
4. Keep a dev-only escape hatch behind an explicit
   `MAIL_DEV_LOG_SECRETS=1`, so the local OTP workflow survives
   deliberately rather than by default.

**Test required.** Unit: `UnconfiguredMailer.send('verification-otp', …)`
→ the emitted log line does not contain the OTP string. See T-02.

**Acceptance criteria.**
- [ ] No log line in any environment contains an OTP by default.
- [ ] Recipient addresses are not logged in cleartext.
- [ ] An unconfigured mailer in production is loud, not silent.

---

## SEC-03 — Compatibility and availability rules are never enforced on the write path

- **Status:** CONFIRMED BUG · SECURITY CONCERN
- **Severity:** P0
- **Area:** security / ecommerce correctness / legal
- **Files:** [src/server/configurator/validate-and-price.ts](src/server/configurator/validate-and-price.ts), [src/server/repositories/configurator.ts](src/server/repositories/configurator.ts) (lines 106-161, 219-274), [src/server/configurator/resolve-options.ts](src/server/configurator/resolve-options.ts), [src/domain/compatibility/resolve.ts](src/domain/compatibility/resolve.ts)
- **Routes:** every `addToCart`, `updateCartItemConfiguration`, and `createOrder`

**Current behaviour.** `getConfiguratorProductData` builds `materialsById`,
`designsById` and `finishesById` from **every** `ProductMaterial` /
`ProductDesign` / `MaterialFinish` row, with no `where` clause and no
post-filter. `Material.isAvailable`, `Design.isActive` and
`Design.rightsStatus` are selected into the `options` object used for
*rendering*, and are simply absent from the `*ById` maps used for
*pricing*.

`priceAndValidateSelections` — the single function behind add-to-cart, cart
edit and checkout re-pricing — then does plain map lookups:

```ts
const design = selections.designId === null ? null : (data.designsById.get(selections.designId) ?? null);
```

It calls `checkConfigurationComplete` and nothing else. It never calls
`resolveOptions` / `resolveOptionAvailability`, and `domain/compatibility`
is not imported on this path at all. Confirmed by
`grep -rn "availableDesigns|availableMaterials|availableFinishes" src` —
every hit is in `resolve-options.ts` or the domain module itself.

**Five rules that are therefore unenforced server-side:**

| Rule (ARCHITECTURE §7.2 / §6.4) | Enforced for display | Enforced on write |
|---|---|---|
| `Material.isAvailable` | yes | **no** |
| `Design.isActive` | yes | **no** |
| `Design.rightsStatus ∈ {APPROVED_COMMERCIAL, PUBLIC_DOMAIN}` | yes | **no** |
| `DesignMaterial` narrowing | yes | **no** |
| `InstallationVariant.maxThicknessMm` cap | yes | **no** |

**How it is reached.** Selections are URL-encoded
(`ui/islands/configurator/selections-url.ts`) and arrive as plain Server
Action arguments. Two realistic paths:

1. **Ordinary customer, no malice.** Staff deactivate a pattern or a
   material in the panel (the panel's whole delete story is
   deactivate-not-destroy). A customer holding a shared link, a bookmarked
   configurator URL, or a saved project from `/moje-konto/projekty` still
   prices it, still adds it to the cart, and still checks out. Nothing
   anywhere says no.
2. **Crafted request.** A direct POST with any `designId` that has a
   `ProductDesign` row.

**Current exploitability with today's seed data:** verified by SQL — zero
non-sellable designs and zero unavailable materials are currently linked to
an active product, and the one `DesignMaterial` narrowing row belongs to a
leftover e2e design attached to no product. So the hole is **live but not
currently loaded**. It arms itself the first time staff retire anything.

**Why it matters.** `Design.rightsStatus` is not a preference — the schema
comment calls it enforcement of brief §12's requirement that nothing is
assumed free to reproduce, "enforced by a query filter, not by
discipline". On the write path there is no filter, so a `RESTRICTED` or
`REQUIRES_PERMISSION` design can be ordered, manufactured and shipped.
That is a copyright exposure, not a UX slip. It also violates §16's
"Assume that a malicious user can bypass every frontend restriction."

**Recommended solution.** One change, in one place. In
`priceAndValidateSelections`, after resolving the rows and before pricing:

```ts
const options = resolveOptions(data.options, selections);
if (selections.materialId !== null && !options.materialIds.includes(selections.materialId)) return null;
if (selections.designId !== null && !options.designIds.includes(selections.designId)) return null;
if (selections.finishId !== null && !options.finishIds.includes(selections.finishId)) return null;
if (selections.thicknessMm !== null && !options.thicknessesMm.includes(selections.thicknessMm)) return null;
if (selections.installationVariant !== null && !options.installVariantCodes.includes(selections.installationVariant)) return null;
if (selections.fontId !== null && !options.fontIds.includes(selections.fontId)) return null;
```

`resolveOptions` is already pure, already tested, and already produces
exactly these lists. Do **not** re-implement the rules — reuse them. That
also makes `resolveOptions` the single definition of "selectable", which is
what §7.2 intends.

Returning `null` gives callers the existing `CONFIGURATION_INVALID` /
`PRICE_CHANGED` behaviour, so no new error surface is needed. Note the
customer-facing consequence: a saved project whose pattern was retired now
fails to add with a blunt message — worth a dedicated Polish string
(`SITE.cartOptionNoLongerAvailablePl`) rather than reusing the generic one.

**Dependencies.** Do BUG-03 in the same change — the auto-selected default
design is drawn from the same unfiltered list.

**Test required.** Integration, on the write path (not the pure function):
add-to-cart and `createOrder` each rejecting an inactive design, a
`REQUIRES_PERMISSION` design, an unavailable material, an unavailable
finish, a `DesignMaterial`-excluded pair, and an over-cap thickness. See
T-03.

**Acceptance criteria.**
- [ ] `applyAddToCart` returns `CONFIGURATION_INVALID` for each of the six cases.
- [ ] `createOrder` refuses the same six for a cart row that predates the deactivation.
- [ ] The assertions run through the action/operation, never against `availableDesigns` directly.
- [ ] Deactivating a pattern in the panel is proven, by test, to make an existing saved project unorderable.

---

# P1 — High

---

## BUG-02 — The advertised "from" price is net, and lower than any real configuration

- **Status:** CONFIRMED BUG · UX/UI · SEO
- **Severity:** P1 (the highest-impact P1 — it is on every listing page)
- **Area:** ecommerce / content / SEO / consumer-law exposure
- **Files:** [src/ui/primitives/ProductCard.tsx](src/ui/primitives/ProductCard.tsx) (line 168), [src/app/(shop)/produkt/[slug]/page.tsx](src/app/(shop)/produkt/[slug]/page.tsx) (price block and `jsonLd`), [src/domain/pricing/calculate.ts](src/domain/pricing/calculate.ts)
- **Routes:** `/`, `/[category]`, `/produkt/[slug]`, `/szukaj`, `/kolekcje/[slug]`

**Current behaviour.** Every "od X zł" renders
`formatPln(product.minPriceGrosze)`. In `calculatePrice`,
`minPriceGrosze` is the **net** clamp:
`unitNetGrosze = minimumApplied ? input.minPriceGrosze : netBeforeMinimum`,
and VAT is added afterwards. Everywhere else the customer sees gross
(`Configurator.tsx:1121,1513` and the cart both use `unitGrossGrosze`).

It is also a *floor*, not a *starting price*: for several products the
cheapest configuration that can actually be built already exceeds it before
VAT.

**Measured** against the live database and the real pricing version 4
(base + cheapest material + cheapest finish + machining + smallest
packaging tier, at each product's own `minWidthMm × minHeightMm`):

| Product | Displayed | Cheapest real net | Cheapest real gross | Understated by |
|---|---|---|---|---|
| `obraz-drewniany-z-grawerem` | 150,00 zł | 154,80 | **190,40 zł** | +27% |
| `szachownica-z-grawerem` | 150,00 zł | 179,55 | **220,85 zł** | +47% |
| `bransoletka-z-grawerem` | 40,00 zł | 45,29 | **55,71 zł** | +39% |
| `stolek-loftowy-z-grawerem` | 200,00 zł | 200,00 | **246,00 zł** | +23% |
| `panel-podlogowy-z-grawerem` | 300,00 zł | 300,00 | **369,00 zł** | +23% |
| `wlasny-projekt-z-grawerem` | 200,00 zł | 200,00 | **246,00 zł** | +23% |
| `fartuch-kuchenny-z-grawerem` | 400,00 zł | 400,00 | **492,00 zł** | +23% |

The gap is visible in the product page itself: it shows "od 150,00 zł" and
the configurator immediately below opens on a real, default configuration
priced at **709,16 zł**.

The same figure is emitted as structured data:

```ts
offers: { '@type': 'Offer', priceCurrency: 'PLN', price: (product.minPriceGrosze / 100).toFixed(2) }
```

**Expected behaviour.** A consumer-facing price in Poland is the total
price including VAT (ustawa o informowaniu o cenach towarów i usług). A
"from" price should be reachable.

**Why it matters.** Every listing page, every search result and Google's
product rich result advertise a price the shop will not honour. Aside from
the legal exposure, a customer who clicks "od 150 zł" and lands on 709 zł
bounces.

**Recommended solution.** Compute a real cheapest-sellable gross price per
product and store it — do not compute it per request.

1. Add `startingPriceGrossGrosze Int?` to `Product`.
2. Populate it by running the existing `priceConfiguration` over each
   product's cheapest **selectable** combination (cheapest available
   material, its cheapest available finish, the smallest preset size /
   `minWidth × minHeight`, no personalization). This is the same code the
   pricing simulator already drives, so no new pricing logic.
3. Recompute on: product save, material/finish price change, and pricing
   version publish. Each of those already goes through an
   `operations/admin-*.ts` function, so there are exactly three call sites.
4. Render `startingPriceGrossGrosze` everywhere `minPriceGrosze` is shown
   today, and in the JSON-LD. Fall back to hiding the price rather than
   showing a wrong one when it is `null`.
5. While you are in the JSON-LD, `availability` is hardcoded
   `https://schema.org/InStock` for made-to-order goods — see BUG-24.

**Alternative if that is too much for now:** show
`formatPln(grossFor(minPriceGrosze, vatRateBp))` and change the label from
"od" to something honest about it being a floor. That fixes the 23% but not
the unreachability, so it is a stopgap, not the fix.

**Test required.** Unit: for every seeded active product, the displayed
starting price is ≤ the price of its own cheapest selectable configuration,
and both are gross. See T-04.

**Acceptance criteria.**
- [ ] No product advertises a price below its cheapest orderable configuration.
- [ ] The advertised price is gross.
- [ ] JSON-LD `Offer.price` matches the visible price exactly.
- [ ] A test fails if a future rate change makes any product's advertised price unreachable.

---

## BUG-03 — A placeholder design is silently attached to every order, non-deterministically

- **Status:** CONFIRMED BUG
- **Severity:** P1
- **Area:** ecommerce correctness / content / production
- **Files:** [src/ui/islands/configurator/Configurator.tsx](src/ui/islands/configurator/Configurator.tsx) (lines 174, 197-210 `computeDefaultSelections`), [src/server/repositories/configurator.ts](src/server/repositories/configurator.ts) (lines 106, 140 — the `materials`/`designs` selects)
- **Routes:** `/produkt/[slug]`, `/koszyk`, `/zamowienie/[orderNumber]`, `/panel/zamowienia/[orderNumber]/karta-produkcyjna`

**Current behaviour.** Pattern selection is deliberately hidden
(`const PATTERN_SELECTION_ENABLED = false`, an owner decision recorded in
that file's header). The DESIGN crumb is removed from the UI — but
`computeDefaultSelections` still runs:

```ts
designId: options.designs[0]?.id ?? null,
materialId: defaultMaterial?.id ?? null,
```

Three separate defects follow.

**1. The customer never sees, chooses or confirms the design, but the order
records one.** Verified live: with pattern selection off, the cart line for
a default configuration reads

> Dąb · **Wzór podstawowy — do zastąpienia** · Olejowanie

`Wzór podstawowy — do zastąpienia` translates as *"basic pattern — to be
replaced"*. It is an internal placeholder (`slug: wzor-podstawowy`,
`code: WZR-001`). It is shown to the customer in the cart, and
`create-order.ts:buildOrderItemInput` copies `designNamePl` and
`designCode` into the immutable `OrderItem.snapshot`, from which the
production sheet at `/panel/zamowienia/[orderNumber]/karta-produkcyjna` is
rendered. The workshop would receive a job card naming a placeholder.

This is precisely what brief §4 ("customers must never be confused about
what they are buying") and §37 ("do not silently change the customer's
design") exist to prevent.

**2. The pick is non-deterministic.** `product.designs` and
`product.materials` are selected with **no `orderBy`** (`configurator.ts`
lines 140 and 106). Postgres row order for a join with no `ORDER BY` is
unspecified and can change after any `UPDATE`, `VACUUM` or plan change.
Verified: all 13 `Design.sortOrder` values are `0`, so even adding
`orderBy: { sortOrder: 'asc' }` would not disambiguate today.

Because `machiningMilliMinutesPerM2` and `ProductDesign.surchargeGrosze`
are pricing inputs, two loads of the same product page can legitimately
produce **two different prices for a configuration the customer perceives
as identical** — which then surfaces as a `PRICE_CHANGED` rejection at
checkout with no explanation.

**3. The default is drawn from the unfiltered list** (see SEC-03), so the
auto-attached design is not checked for `isActive` or `rightsStatus`. If
`wzor-podstawowy` were ever deactivated, the default would silently become
whatever row came back first — possibly a non-sellable one.

**Why it matters.** Combined: a customer buys a product whose engraving
they never chose, at a price that can vary between page loads, described in
their order by an internal placeholder string.

**Recommended solution.**

1. Add `orderBy: { design: { sortOrder: 'asc' } }` / `{ material: { sortOrder: 'asc' } }`
   to the `configurator.ts` selects, and give the seeded designs and
   materials real distinct `sortOrder` values. Determinism first.
2. Filter the default through `resolveOptions` (SEC-03's fix) so an
   unsellable row can never be the default.
3. Decide what "no pattern" means while selection is hidden. Two honest
   options:
   - **Make it a real, named product option.** Rename `wzor-podstawowy` to
     something a customer can read and accept (e.g. „Bez wzoru — sam
     grawer tekstu") and make sure its `machiningMilliMinutesPerM2` and
     surcharge reflect that. Cheapest change, and the snapshot stops lying.
   - **Make DESIGN genuinely optional for these product types.** Drop
     `DESIGN` from the step list while the feature is off, let
     `selections.designId` stay `null`, and let `calculatePrice` take its
     existing `design === null` branch (already implemented and tested for
     `CUSTOM`). Cleaner, but touches the step machine.
4. Whichever is chosen, the summary must show what the customer is getting
   before add-to-cart.

**Test required.** Integration: two consecutive `getConfiguratorSnapshot`
calls for the same product return the same default `designId` and the same
price; the default design is always in `resolveOptions(...).designIds`. See
T-05.

**Acceptance criteria.**
- [ ] No customer-visible string, and no order snapshot, contains "do zastąpienia" or any other placeholder marker.
- [ ] The default configuration is byte-identical across repeated loads.
- [ ] A deactivated or non-sellable design can never be selected as a default.

---

## BUG-04 — The order confirmation never shows shipping, VAT or the net subtotal

- **Status:** CONFIRMED BUG · UX/UI
- **Severity:** P1
- **Area:** ecommerce / content / compliance
- **Files:** [src/server/repositories/orders.ts](src/server/repositories/orders.ts) (`OrderConfirmationView`, `findOrderForConfirmation`, `findOrderForUser`), [src/ui/primitives/OrderSummary.tsx](src/ui/primitives/OrderSummary.tsx)
- **Routes:** `/zamowienie/[orderNumber]`, `/moje-konto/zamowienia/[orderNumber]`, `/panel/zamowienia/[orderNumber]`

**Current behaviour.** `Order` stores `subtotalNetGrosze`, `vatGrosze`,
`shippingGrosze` and `totalGrossGrosze`. `OrderConfirmationView` exposes
only `totalGrossGrosze`. `OrderSummary` renders each item's
`lineGrossGrosze`, a divider, then "Razem" with the grand total.

So the confirmation page lists lines that do not sum to the total, and
never says why. For an order with paid shipping the arithmetic is simply
wrong on its face; for a free-shipping order the customer is not told that
delivery was free.

The checkout page **does** break it out correctly
(`CheckoutForm.tsx:442-462`: subtotal / dostawa / do zapłaty). The
information is lost at exactly the moment it becomes the permanent record.

**Expected behaviour.** §15.4 has the confirmation showing "the bank
details, order number as the transfer title, and the amount". A Polish
consumer confirmation should also show the delivery cost separately and
state that prices include VAT; a NIP buyer needs net and VAT.

**Why it matters.** The confirmation is the document the customer keeps and
the one they pay from. "Items add up to 709,16 but you owe 761,16" with no
shipping line generates a support request every time.

**Recommended solution.** Add `subtotalNetGrosze`, `vatGrosze` and
`shippingGrosze` to `OrderConfirmationView` and to both queries (they are
plain columns on a row already being read — no extra query). Render, in
`OrderSummary`, above "Razem":

```
Suma produktów      709,16 zł
Dostawa              52,00 zł
w tym VAT (23%)     142,32 zł
─────────────────────────────
Do zapłaty          761,16 zł
```

Reuse `SITE.checkoutSubtotalLabelPl` / `SITE.checkoutShippingLabelPl` so
checkout and confirmation read identically. Add one new key for the VAT
line.

**Test required.** Integration: for a real order, the rendered view's
item lines + shipping equal `totalGrossGrosze`. See T-06.

**Acceptance criteria.**
- [ ] Shipping is a visible line on all three order-detail surfaces.
- [ ] The displayed numbers reconcile to `totalGrossGrosze` exactly.
- [ ] VAT is stated.

---

## BUG-05 — "Duplikuj" reintroduces the lost-update race that P0-3 fixed

- **Status:** **RESOLVED 2026-08-31** (was CONFIRMED BUG)
- **Severity:** P1
- **Area:** ecommerce / concurrency
- **Files:** [src/server/operations/cart.ts](src/server/operations/cart.ts) (`applyDuplicateCartItem`, lines 385-398)

**Current behaviour.** The 2026-08-30 duplicate sweep changed "Duplikuj"
from a deep copy to a quantity bump, and implemented it as read-then-write:

```ts
const cartItem = await prisma.cartItem.findUnique({ where: { id: cartItemId }, select: { quantity: true } });
if (cartItem === null) return;
await prisma.cartItem.update({
  where: { id: cartItemId },
  data: { quantity: clampCartQuantity(cartItem.quantity + 1) },
});
```

This is the exact shape `docs/AUDIT-2026-08-30.md` P0-3 identified and
fixed in `applyAdjustCartItemQuantity` in the same round. Two rapid clicks
(the control is a zero-JS `<form action>` with nothing disabling it) both
read `1` and both write `2`; the customer clicked twice and got one
increment.

`applyAdjustCartItemQuantity`, two functions above, shows the correct
pattern and explains why in its own comment.

**Why it matters.** Low blast radius, but it is a regression of a fix from
the same commit, and it means the P0-3 lesson is not yet a habit the code
enforces.

**Recommended solution.** Use the sibling's shape verbatim:

```ts
await prisma.cartItem.updateMany({
  where: { id: cartItemId, quantity: { lt: MAX_CART_ITEM_QUANTITY } },
  data: { quantity: { increment: 1 } },
});
```

The `findUnique` becomes unnecessary — `findOwnedCartItem` above already
proves the row exists and is owned.

**Test required.** Integration: two concurrent `applyDuplicateCartItem`
calls → quantity 3, not 2. The existing test at
`tests/integration/cart-operations.test.ts:378` is sequential and passes
either way. See T-07.

**Acceptance criteria.**
- [x] A concurrency test proves both duplicates land.
- [x] The clamp is expressed in the `where`, not applied after a read.

### What was built (2026-08-31)

The sibling's shape, verbatim — `updateMany` with `quantity: { lt:
MAX_CART_ITEM_QUANTITY }` in the `where` and `{ increment: 1 }` in the
data. The `findUnique` it replaced was redundant as well as racy:
`findOwnedCartItem` above had already proved the row exists and is owned.

**The existing test could not have caught this**, which is the point worth
recording. `cart-operations.test.ts`'s sequential duplicate test passed
identically before and after. T-07 adds three:

- two concurrent duplicates → quantity **3**. Failed before the fix.
- eight concurrent duplicates → quantity **9**. Before the fix this produced
  **2** — seven of eight increments lost.
- four concurrent duplicates one short of the cap → exactly
  `MAX_CART_ITEM_QUANTITY`. This one passed before the fix too, by luck:
  clamping 24 + 1 gives the right answer either way. It is kept because it
  pins the *reason* the bound lives in the `where`.

**Swept for the same shape elsewhere.** `grep` for a computed read-then-write
(`current.x + 1` and similar) across `src/server` now returns nothing, and
all three counter mutations in the codebase use atomic `increment`/
`decrement`. The ~20 admin `findUnique`-then-`update` pairs are a **different
shape** and are not bugs: they read the previous value to record it in the
audit-log diff and then write an *absolute* value, so two concurrent calls
converge on the same result. Checked rather than assumed.

---

## BUG-06 — Four step-machine guards are written, tested, and never called

- **Status:** **RESOLVED 2026-08-31** (was CONFIRMED BUG · ARCHITECTURAL CONCERN)
- **Severity:** P1
- **Area:** correctness / validation / test quality
- **Files:** [src/domain/configuration/steps.ts](src/domain/configuration/steps.ts) (`isStepEnterable`, `furthestEnterableStepIndex`, `checkStepEntry`, `checkStepAppliesToProductType`), [src/server/configurator/validate-and-price.ts](src/server/configurator/validate-and-price.ts)

**Current behaviour.** `grep -rn "checkStepAppliesToProductType|checkStepEntry|furthestEnterableStepIndex|isStepEnterable" src`
outside the defining module returns exactly **one** hit — a comment in
`Configurator.tsx:405` saying `isStepEnterable` no longer restricts
anything. Production uses only `stepsForProductType` and
`checkConfigurationComplete`.

Consequences, all reachable through a normal Server Action call:

- `personalizationText` is accepted, stored and displayed for products with
  **no** `PersonalizationSpec` and **no** `PERSONALIZATION` step. Verified
  against the database: `panel-podlogowy-z-grawerem` (FLOOR_ELEMENT) and
  `fartuch-kuchenny-z-grawerem` (KITCHEN_TILE) have no spec row.
  `evaluatePersonalization` returns `{ issues: [], fontRequired: false }`
  when the spec is missing, so **no length limit, no glyph coverage check
  and no content validation of any kind** applies. The string is written to
  `Configuration.personalizationText`, shown in the cart, and copied into
  the immutable order snapshot.
- `thicknessMm` is persisted for `WALL_ART`, which has no `THICKNESS` step.
  It does not affect price (the map lookup misses) but it does reach the
  snapshot, so an order can read "Grubość: 999 mm" for a wall panel.
- `installationVariant` is persisted for non-`KITCHEN_TILE` products
  (constrained only by the Postgres enum).

**Documentation disagrees with the code.** `docs/CHECKLIST.md:81` states,
as a completed item: "`isStepEnterable`/`checkStepEntry` enforce 'every
prior step satisfied…', `checkStepAppliesToProductType` rejects e.g. a
THICKNESS selection on WALL_ART." The running application does none of
that. This is the clearest documentation-vs-implementation divergence in
the repository.

**Test-quality note.** `tests/unit/configuration.test.ts` has 30 passing
assertions against these functions. They are correct and they protect
nothing, because no production path reaches them. See
`REVIEW-TEST-COVERAGE.md`'s "tests that cannot fail for a real reason".

**Recommended solution.** In `priceAndValidateSelections`, next to the
SEC-03 checks, reject any selection whose step is not in the product type's
list:

```ts
const steps = stepsForProductType(data.typeCode);
const setButNotApplicable =
  (selections.thicknessMm !== null && !steps.includes('THICKNESS')) ||
  (selections.installationVariant !== null && !steps.includes('INSTALLATION_VARIANT')) ||
  (selections.personalizationText !== null && !steps.includes('PERSONALIZATION')) ||
  (selections.fontId !== null && !steps.includes('PERSONALIZATION')) ||
  (selections.designId !== null && !steps.includes('DESIGN')) ||
  (selections.customUploadId !== null && !steps.includes('CUSTOM_UPLOAD'));
if (setButNotApplicable) return null;
```

Express it via `checkStepAppliesToProductType` so the existing tests
finally guard something real. Separately, give
`personalizationText` an unconditional maximum length in
`validatePersonalization` (or at the action boundary) so the "no spec"
branch cannot accept unbounded text.

**Acceptance criteria.**
- [x] `checkStepAppliesToProductType` is called from the write path.
- [x] Integration test: `personalizationText` on a FLOOR_ELEMENT is rejected.
- [x] Integration test: `thicknessMm` on a WALL_ART is rejected.
- [x] `docs/CHECKLIST.md:81` is corrected, or made true.

---

## BUG-07 — `zod` is a dependency that nothing imports; Server Action inputs are unvalidated

- **Status:** **RESOLVED 2026-08-31** (was CONFIRMED BUG · ARCHITECTURAL CONCERN)
- **Severity:** P1
- **Area:** validation / dependencies
- **Files:** [package.json](package.json) (`zod: ^4.4.3`), every file under `src/server/actions/`

**Current behaviour.** `grep -rn "from 'zod'" src` → **0 matches**.
`ARCHITECTURE.md` §2 lists Zod as the validation layer: "One schema reused
for client hints and server enforcement." §21.3 assigns "API validation |
malformed payload, extra fields, type coercion, injection strings" to
`integration/actions`, a test file that does not exist.

What validation actually exists is hand-written and uneven:

- `actions/checkout.ts` — genuinely good: real Polish NIP checksum, postal
  code, phone, email, per-field error codes. This is the model.
- `actions/cart.ts` — `Number(formData.get('quantity'))` with a
  `Number.isFinite` guard and a clamp. Adequate for quantity.
- `addToCart(productSlug, selections, acknowledgedWarnings, quantity)` —
  **no shape validation at all.** `selections` is destructured straight
  into a Prisma `create`; `acknowledgedWarnings` is spread into a
  `String[]` column with no element count, no length cap and no allow-list
  of known warning codes. A direct POST can write arbitrary strings of
  arbitrary size into `Configuration.acknowledgedWarnings`.

Next's own guidance (`node_modules/next/dist/docs/01-app/02-guides/server-actions.md`,
"Security") is explicit: "Treat every action as an untrusted entry point…
Validate inputs. Treat `FormData`, query parameters, and headers as
untrusted."

**Why it matters.** Wrong-typed ids currently fail as Prisma errors, which
surface as 500s rather than clean rejections; unbounded arrays and strings
are a cheap storage-amplification vector; and the documented validation
strategy does not exist, so the next contributor will assume it does.

**Recommended solution.** Pick one and make it the rule:

- *Use zod.* Define one `SelectionsSchema` in `domain/configuration/` and
  parse at the top of `applyAddToCart` / `applyUpdateCartItemConfiguration`
  / `getConfiguratorSnapshot`. Constrain `acknowledgedWarnings` to the real
  `FeasibilityCode` union (it is already a closed set in
  `domain/feasibility/rules.ts`) with a max length, and
  `personalizationText` to a hard maximum.
- *Or drop zod* from `package.json` and amend §2, and still add the two
  bounds above by hand.

Either is defensible; leaving a declared-but-unused validation dependency
alongside a documented validation strategy that does not exist is not.

### What was built (2026-08-31) — both bugs, one change

They were fixed together because they are the same hole seen from two
sides: `priceAndValidateSelections` is the single write path for
add-to-cart, cart edit and checkout re-pricing, and it looked at neither
the *shape* of what it was given nor whether the fields belonged to this
product type.

**Zod, not removal** — §2 already said to use it, and this is the one place
it lives: `src/domain/configuration/input-schema.ts`.
`selectionsSchema` bounds every field; `acknowledgedWarningsSchema` is
`z.enum(FEASIBILITY_CODES).max(16)`. `FeasibilityCode` is now **derived
from** a `FEASIBILITY_CODES` array rather than declared as a union, so the
allow-list and the type cannot drift apart. Both parsers return `null`
rather than zod issues: nothing downstream can act on *why* a payload was
malformed, since the UI cannot produce one.

**`findSelectionOutsideProductType`** (`domain/configuration/steps.ts`)
wraps the previously-uncalled `checkStepAppliesToProductType`, so its 30
existing assertions finally guard something reachable. It takes the
**product type's** steps, not `applicableSteps`' narrowed list — those
answer different questions, and conflating them would turn
`OPTION_UNAVAILABLE` (a message a customer on a stale link can act on) into
a generic invalid-configuration error.

`priceAndValidateSelections` now parses first, then rejects an
out-of-type selection, then does everything it did before — and **returns
the parsed selections**, so `applyAddToCart` can no longer keep using the
caller's raw object. That last part mattered: the pre-fix run of the new
tests produced a real `TypeError:
selections.personalizationText.trim is not a function` out of
`cartItemSignature` — precisely the 500 this issue predicted.

**A regression the write-path fix created, caught before it shipped.**
`computeDefaultSelections` filled `finishId` from the material's first
available finish for *every* product, and `JEWELRY` has no FINISH step
(§5). The seeded bracelet's oak offers oiling, so its default carried a
finish the product type forbids: the page would have priced happily and
then refused at "Dodaj do koszyka" — the exact shape the owner ruled out on
2026-08-31. The defaults are now step-aware
(`computeDefaultSelections(options, productTypeCode)`, exported so
`tests/unit/configurator-defaults.test.ts` can assert it against the same
`findSelectionOutsideProductType` the server uses). A side effect worth
noting: the bracelet's default price moved 57,54 → **57,39 zł**, because a
finish was never legitimately part of that configuration. The advertised
"od 55,69 zł" had always excluded it — the configurator default and the
advertised price now come from the same rule.

**Verified live** on a production build: the bracelet configures, prices at
57,39 zł, and adds to the cart as „Dąb · Gałązka oliwna" with no finish.

**Tests.** `tests/unit/configuration-input.test.ts` (40) for the rules
themselves; `tests/unit/configurator-defaults.test.ts` (11) for the client
defaults; `tests/integration/step-and-input-validation.test.ts` (18) drives
every rule through `applyAddToCart` against real Postgres, and **each
rejection also asserts that no `Configuration` row was written** — a check
placed after the insert would satisfy a "returns ok:false" test while
having stored the row.

**Left uncalled, deliberately:** `isStepEnterable`, `checkStepEntry` and
`furthestEnterableStepIndex`. The configurator lets a customer move between
steps freely, which is a UX decision rather than an oversight, and forcing
sequential entry now would be a behaviour change nobody asked for. They
remain the domain model of §7.1. `docs/CHECKLIST.md:81` has been corrected
to say exactly that instead of implying all four were enforced.

**Acceptance criteria.**
- [x] `acknowledgedWarnings` accepts only known codes, bounded in count.
- [x] `personalizationText` has an unconditional maximum length.
- [x] Malformed action arguments produce a typed rejection, not a 500.
- [x] `zod` is either used or removed, and §2 matches reality.

---

## ADMIN-01 — Order, customer and audit lists silently truncate

- **Status:** CONFIRMED BUG
- **Severity:** P1
- **Area:** admin / scalability
- **Files:** [src/server/repositories/admin-orders.ts](src/server/repositories/admin-orders.ts) (`ADMIN_ORDER_LIST_LIMIT = 100`), [src/server/repositories/admin-customers.ts](src/server/repositories/admin-customers.ts) (`= 100`), [src/server/repositories/admin-audit-log.ts](src/server/repositories/admin-audit-log.ts) (`= 200`)
- **Routes:** `/panel/zamowienia`, `/panel/klienci`, `/panel/dziennik-zdarzen`

**Current behaviour.** Each list does `take: N`, `orderBy createdAt desc`,
and hands the result to a client `DataGrid` whose pagination only paginates
what it was given. There is no cursor, no page parameter, no total count,
and no "showing 100 of N" indicator.

**This is already happening.** The development database holds **166
orders**. The panel shows the newest 100. Sixty-six real orders are
unreachable — not "will be", *are*, right now. The only workaround is
guessing filters until the target falls inside the newest 100 of the
filtered set.

The audit log is worse in kind: it is the record §16A.2 invariant 4 exists
to produce, and it silently forgets everything past the newest 200 entries.

**Why it matters.** "Find the order from three months ago" is a daily
operator task. Silently truncating a compliance log is the failure mode an
audit log is supposed to make impossible.

**Recommended solution.** Server-side pagination. `DataGrid` supports
`paginationMode="server"` with `rowCount`; the page reads `?page=&pageSize=`
from `searchParams` and the repository takes `skip`/`take` plus a
`prisma.order.count({ where })` for the total (run both in one
`Promise.all`). Three repositories, three pages. Until that lands, at
minimum render "Pokazano 100 z 166" so an operator is never misled.

**Test required.** Integration: with 150 seeded orders, page 2 returns
orders 101-150 and `total` is 150. See T-08.

**Acceptance criteria.**
- [ ] Every order ever placed is reachable from `/panel/zamowienia`.
- [ ] Row counts are real totals, not page sizes.
- [ ] The audit log is fully navigable.

---

## SEC-04 — `STAFF` can change the bank account and irreversibly anonymize customers

- **Status:** **RESOLVED 2026-08-31** (was CONFIRMED BUG · SECURITY CONCERN)
- **Severity:** P1
- **Area:** security / authorization
- **Files:** [src/server/operations/admin-store-settings.ts](src/server/operations/admin-store-settings.ts), [src/server/operations/admin-customers.ts](src/server/operations/admin-customers.ts), [src/server/operations/admin-email-templates.ts](src/server/operations/admin-email-templates.ts)

**Current behaviour.** Verified by scanning all 25 `operations/admin-*.ts`
files: only `admin-pricing`, `admin-staff` and `admin-analytics` use
`requireAdminSession()`. The other 22 use `requireStaffSession()`. Three of
those 22 are not catalogue edits and deserve separate treatment from the
already-recorded `OPEN_ITEMS.md` §7 question:

1. **`applyUpdateStoreSettings`** writes `StoreSettings.bankAccountNumber` —
   the account number every bank-transfer customer is told to pay into, on
   the confirmation page and in the confirmation email. A compromised or
   malicious `STAFF` account redirects all incoming payments. §16.3 gives
   settings to `ADMIN`.
2. **`applyAnonymizeCustomer`** scrubs the user's identity **and deletes
   their `Session` and `Account` rows**, permanently removing their ability
   to sign in. It is irreversible and refuses to run twice. §16.3 gives
   `STAFF` "customers (**read**)".
3. **`applyUpdateEmailTemplate`** rewrites the body of customer-facing
   email, including `verification-otp`.

**Recommended solution.** Move these three to `requireAdminSession()`.
Unlike the catalogue question, this needs no owner decision — none of the
three is a day-to-day catalogue task, and §16.3 already assigns all three
to `ADMIN`. Consider a second confirmation (re-entered password, or a typed
confirmation string) on the bank-account field specifically.

**Test required.** Integration: `STAFF` → `applyUpdateStoreSettings` → refused. See T-09.

**Acceptance criteria.**
- [x] `STAFF` cannot change bank details, anonymize a customer, or edit email templates.
- [x] Each has an authorization test.

**Related, and left as the owner's call:** the broader "may `STAFF` write
the catalogue?" question is already `OPEN_ITEMS.md` §7 / audit P2-9. This
issue is deliberately narrower and does not depend on it.

### What was built (2026-08-31)

The three wrappers now call `requireAdminSession()`. That alone would have
satisfied the letter of the recommendation, and it would have been
**untestable**: `requireAdminSession` reads `next/headers`, which throws
outside a request scope, so no test in this repository can reach it
(`tests/integration/authz.test.ts`'s header records the same constraint from
P4). A rule that lives only where no test can reach it is the exact shape of
SEC-03 — a correct, well-tested function that the write path never called.

So the gate is asserted twice:

- **`requireAdminSession()` in the wrapper** — the gate a real request meets,
  and still the primary control. Guarded mechanically by
  `tests/unit/admin-only-operations.test.ts`, which checks *per function*
  rather than per file, because `admin-pricing.ts` correctly contains both
  gates (`simulatePricingDraft` is a read, and reads are `STAFF`).
- **`refuseUnlessAdmin(actor)` as the first statement of each `apply`** —
  the same rule where a test can drive it. `src/server/operations/admin-only.ts`.
  A separate test asserts the guard appears *before* the first Prisma call in
  each of the three: a check that runs after the write returns a refusal to a
  caller whose bank account has already been changed.

The actor parameter was renamed `staff` → `admin` in all three, so the
signature no longer says something the function refuses.

**The UI half, which the recommendation did not name.** Enforcement alone
would have left a `STAFF` looking at a settings form whose submit 404s —
the shape the owner ruled out on 2026-08-31 ("there shouldn't be cases where
we allow something but its blocked by system"). So:

- `/panel/ustawienia` and both `/panel/ustawienia/szablony` pages now call
  `requireAdminSession()` themselves.
- The customer page **stays `STAFF`-visible** (§16.3 gives `STAFF` customers
  *read*) and shows „Anonimizację konta może wykonać tylko administrator."
  in place of the form.
- `AdminSidebarNav` gained `adminOnly`, and the layout passes the role. This
  also fixes a **pre-existing** inconsistency: `/panel/ceny` and
  `/panel/ustawienia/personel` were already `ADMIN`-gated pages that the nav
  offered to every `STAFF` account, so clicking them produced a 404. Hiding a
  link is presentation, not a control — every route and operation still
  enforces its own gate.

**Verified in a real browser against a production build**, by temporarily
demoting the panel account to `STAFF` and restoring it afterwards:

| | `ADMIN` | `STAFF` |
|---|---|---|
| Sidebar entries | 23 | **21** — „Ceny" and „Ustawienia" absent |
| `/panel/ustawienia` direct URL | renders | **„Nie znaleziono takiej strony"** (404, not 403) |
| Customer page | anonymize form | read-only, with the admin-only notice |

**Tests.** `tests/integration/admin-authorization.test.ts` (10) drives all
three `apply*` with `STAFF`, `CUSTOMER` and `ADMIN` actors against real
Postgres, and asserts for every refusal that **nothing changed** — the bank
account, the customer's identity, the template body — plus that no audit row
is written for a refused attempt. `tests/unit/admin-only-operations.test.ts`
(14) covers the wrapper half mechanically.

Three existing tests (`admin-store-settings`, `admin-customers`,
`admin-email-templates`) built a `STAFF` actor and were updated to `ADMIN`,
with the reversal recorded in each rather than quietly swapped.

---

## SEC-10 — Opening a customer's page silently performed a RODO export

- **Status:** **RESOLVED 2026-08-31** · CONFIRMED BUG · SECURITY CONCERN
- **Severity:** P1
- **Area:** security / compliance
- **Files:** [src/app/(admin)/panel/klienci/[id]/eksport/route.ts](src/app/(admin)/panel/klienci/[id]/eksport/route.ts), [src/app/(admin)/panel/klienci/[id]/page.tsx](src/app/(admin)/panel/klienci/[id]/page.tsx)

**New finding**, not in the 2026-08-30 audit. Found while verifying SEC-04 in
a real browser — the customer page's activity timeline showed an „Eksport"
entry nobody had triggered.

**Confirmed, twice.** The network log showed

```
GET /panel/klienci/<id>/eksport?_rsc=Q2oXSWriMRsgbeBI → 200 OK
```

and the database showed a matching `AuditLog` row (`entity: 'User'`,
`action: 'export'`) attributed to the staff member who had only *looked* at
the page.

**Cause.** `/panel/klienci/[id]/eksport` is a GET route handler with a side
effect: it builds the customer's full RODO Art. 15 export and writes an
audit row. The page linked to it with `next/link`, and Next prefetches
`<Link>` targets.

**Why it matters more than the wasted work.** §16A.2 invariant 4 makes the
audit log the record of what happened. It was recording RODO exports that
nobody performed, against named staff. A compliance record that reports
accesses which never occurred is worse than no record, because it will be
believed. Every customer-page view also serialised that customer's complete
personal data into a response nobody read.

**Fixed in two layers.** The link is a plain `<a>` — the convention
`/api/plik/[fileId]` already followed in `weryfikacja/[designId]/page.tsx`,
so this link was the odd one out rather than a new idea. And the route
refuses any request carrying `next-router-prefetch` or `purpose: prefetch`,
checked **before** the session read, because nothing should happen for a
speculative request.

**Verified after the fix** on a production build: opening the same customer
page produced no request to the export route and left the export-row count
unchanged at 6.

**Tests.** `tests/unit/customer-export-route.test.ts` (4) — the route returns
404 for both prefetch header forms (and passing without a request scope also
proves the guard runs before `getSession()`), plus a mechanical check that
the page renders a plain anchor.

**Worth checking when adding any route handler:** a GET with a side effect
must never be reachable from a `<Link>`. Nothing else in the codebase
currently has one — `/api/plik/[fileId]` reads and streams, and writes
nothing.

---

## SEC-05 — No security headers and no Content-Security-Policy anywhere

- **Status:** **RESOLVED 2026-08-31** (was MISSING FUNCTIONALITY · SECURITY CONCERN)
- **Severity:** P1
- **Area:** security
- **Files:** [src/server/security/headers.ts](src/server/security/headers.ts) (new), [next.config.ts](next.config.ts), [src/proxy.ts](src/proxy.ts), [src/app/api/plik/[fileId]/route.ts](src/app/api/plik/[fileId]/route.ts)

**Original behaviour.** A case-insensitive search for
`Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`,
`Strict-Transport-Security`, `Referrer-Policy` and `Permissions-Policy`
across all `.ts`/`.tsx`/`.json`/`.md` files returns **no matches**.
`next.config.ts` defines no `headers()`; `proxy.ts` only redirects
unauthenticated `/panel` traffic.

§16.1 requires: "Security headers + strict CSP; user SVGs are served as
attachments or rasterized previews, never inlined into the document." The
second half is genuinely done (`/api/plik/[fileId]` forces
`Content-Disposition: attachment` for `image/svg+xml`). The first half was
never built — and, unlike the rate limits, it is **not** recorded in
`CHECKLIST.md` or `OPEN_ITEMS.md`, so it is a gap nobody is tracking.

**Related, smaller:** `/api/plik/[fileId]` sets `Content-Type` from the
sniffed MIME type but no `X-Content-Type-Options: nosniff`, while serving
customer-uploaded bytes `inline` for PDFs and rasters.

**Why it matters.** This application renders customer-supplied SVG-derived
previews, admin-uploaded images, and `dangerouslySetInnerHTML` JSON-LD. A
CSP is the layer that contains a mistake in any of them. `X-Frame-Options`/
`frame-ancestors` also matters for the admin panel.

**Recommended solution.** Add a `headers()` block in `next.config.ts`:

- `X-Content-Type-Options: nosniff` (site-wide, and explicitly on `/api/plik/*`)
- `Referrer-Policy: strict-origin-when-cross-origin` — also stops the guest
  order `?token=` leaking to third parties via `Referer` (see BUG-22)
- `X-Frame-Options: DENY` / `frame-ancestors 'none'`
- `Strict-Transport-Security` (production only)
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- A CSP. MUI/Emotion inject runtime `<style>` elements, so a strict
  `style-src` needs the nonce path from
  `node_modules/next/dist/docs/…/content-security-policy.md` plus MUI's
  `@mui/material-nextjs` cache provider. Ship `Content-Security-Policy-Report-Only`
  first, watch for a week, then enforce.

**Acceptance criteria.**
- [x] All headers above present on a production response.
- [x] CSP enforced (not report-only) with no console violations on home, product, cart, checkout, `/panel`.
- [x] `nosniff` on `/api/plik/[fileId]`.

### What was built (2026-08-31)

The policy itself lives in a pure module, `src/server/security/headers.ts`,
so it can be unit-tested without a server. It has two consumers, split on
whether a header varies per request:

- **`next.config.ts` → `headers()`** — `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options:
  DENY`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, and
  `Strict-Transport-Security: max-age=63072000; includeSubDomains` **in
  production only**. Also `poweredByHeader: false`, which was not on the list
  above — Next sends `X-Powered-By: Next.js` by default, and it buys nothing.
  These cover static assets, the image optimizer and `/api/*`, which the
  proxy matcher deliberately does not touch.
- **`src/proxy.ts` → the CSP**, because the nonce must be fresh per request.

HSTS is production-only for a specific reason: it is pinned per host by the
browser and cannot be withdrawn server-side, so sending it from
`http://localhost` would force https on every other localhost project on the
developer's machine for two years.

**`script-src` is strict:** `'self' 'nonce-…' 'strict-dynamic'`, never
`'unsafe-inline'`. `'unsafe-eval'` is added in development only (React uses
`eval` there to rebuild server stacks in the browser) and
`upgrade-insecure-requests` in production only.

**`style-src` keeps `'unsafe-inline'`, deliberately.** The audit note above
suggested the nonce path via `@mui/material-nextjs`. That provider does
accept `options.nonce` and does stamp it on the styles it emits — but the
nonce cannot *reach* it. `ThemeRegistry` is a Client Component with ~22 call
sites, several of which are themselves client (`AccountNav`) or are
`error.tsx` boundaries that React renders with no props of ours. There is no
path by which a per-request value gets to those. Adding a nonce to
`style-src` anyway would be worse than omitting it: under CSP3 a nonce makes
browsers ignore `'unsafe-inline'` entirely, so it would break every
client-side Emotion style rather than tighten anything. Style injection is
also a far smaller prize than script injection — Google's own strict-CSP
guidance grades on `script-src`. The reasoning is in the module and pinned by
a test, so it cannot be "tightened" by accident later.

**`CSP_MODE`** (`enforce` default · `report-only` · `off`) is documented in
`.env.example`. An unrecognised value enforces: a typo must never be the
thing that silently switches the policy off.

**One thing worth knowing, found in Next's source rather than its docs.**
`node_modules/next/dist/server/app-render/app-render.js:209` reads
`headers['content-security-policy'] || headers['content-security-policy-report-only']`.
The published guide only mentions the enforcing header. Because Next reads
both, a report-only rollout applies the nonce to framework scripts exactly as
enforcement would — so the violations it reports are real, not a flood of
false ones from Next's own bootstrap. That is what makes `CSP_MODE=report-only`
a usable watch mode rather than noise.

**Verified.** All six headers on a real production response
(`npm run build && next start`, read with curl). The enforced policy carried
through home, product, cart, checkout, `/panel` and `/panel/zamowienia` in a
real browser with **zero console messages** — including a MUI Menu popover
(a portal created after hydration, which is precisely the client-side
Emotion case), the `@mui/x-charts` revenue chart, and a Server Action
re-pricing a material change from 57,54 zł to 57,32 zł, which proves
`'strict-dynamic'` really does let the router load its chunks. `nosniff`
confirmed on a real 200 response from `/api/plik/[fileId]`.

**Tests.** `tests/unit/security-headers.test.ts` (24) pins the policy,
including a round-trip of a generated nonce through Next's own
`getScriptNonceFromHeader`, imported from the installed package so that a
Next upgrade changing it fails loudly. `tests/unit/proxy.test.ts` (7) drives
all three `CSP_MODE` values through the real `proxy()` and pins that turning
the CSP off does not also turn the `/panel` redirect off.
`tests/e2e/security-headers.spec.ts` (10) asserts the headers on a live
response, that the nonce differs per request, that Next applied it to its own
script tags, and that five real pages produce no CSP violation.

### Consequence for PERF-01

Next reads the nonce from the **request** CSP header at render time, so a
prerendered page ships a stale nonce. **A nonce-based CSP and static/ISR are
mutually exclusive**, and Next's own guide says PPR is too. Every storefront
route is dynamic today, so this costs nothing right now — but PERF-01 step
(3) is now blocked on a choice: keep the nonce and take the win from step (1)
alone, or move `script-src` to Next's experimental `sri` hash path. Weakening
`script-src` to `'unsafe-inline'` to unblock caching would trade away all of
SEC-05 and is the owner's decision, not an implementation detail. Recorded in
`AI-CHECKLIST.md` under PERF-01.

---

## PERF-01 — Not one page is prerendered; the storefront is 100% dynamic

- **Status:** CONFIRMED · PERFORMANCE
- **Severity:** P1
- **Area:** performance / architecture
- **Files:** [src/ui/layout/StorefrontChrome.tsx](src/ui/layout/StorefrontChrome.tsx), [next.config.ts](next.config.ts), every catalogue page

**Measured**, from `npm run build` at this commit:

```
91 routes marked ƒ (Dynamic) server-rendered on demand
 2 routes marked ○ (Static)  →  /robots.txt, /sitemap.xml
```

Not the homepage, not a category, not a product, not `/o-nas`, not
`/regulamin`, not a blog post.

**Cause.** `StorefrontChrome` is rendered by both `(shop)/layout.tsx` and
`(marketing)/layout.tsx` and calls, on every request:
`listActiveCategories()`, `listActiveCollections()`, `getSession()`,
`readConsentChoice()`, `readGuestSessionToken()`, then
`getCartSummaryForRequest()`. `getSession()` and the cookie reads are
request-scoped APIs, so **every route beneath either layout is forced
dynamic**, regardless of what the page itself does.

Confirmed absent from the entire codebase: `React.cache`, `unstable_cache`,
`'use cache'`, `export const revalidate`, `export const dynamic`,
`cacheComponents`. `generateStaticParams` in `/produkt/[slug]` and
`/[category]` runs at build time (81 pages generated) and then every route
falls back to dynamic anyway.

**Why it matters.** §18 states "Catalogue pages are RSC + ISR so they are
fully server-rendered — the reason MUI is confined to islands (§2.1)".
`CHECKLIST.md:102` records LCP as `[~]` "improved, not clearly acceptable
yet". The project pays a real ongoing cost — MUI is lint-banned from the
storefront, and the storefront is hand-written primitives as a result — to
protect a metric whose single biggest lever is switched off. Every product
page view is ~6 uncached Postgres round trips.

**Recommended solution**, in the order that pays best:

1. **Split the chrome.** `listActiveCategories()` and
   `listActiveCollections()` change roughly never. Wrap them in
   `'use cache'` (Next 16) or `unstable_cache` with a tag, and revalidate
   that tag from the category/collection admin operations, which already
   call `revalidatePath`. Cost: two small changes; effect: two queries per
   page render disappear.
2. **Isolate the request-scoped part.** Move the cart badge, the account
   name and the consent banner into their own components rendered inside
   `<Suspense>`. With `cacheComponents: true` (Next 16, which also enables
   PPR by default — `node_modules/next/dist/docs/…/cacheComponents.md`) the
   static shell prerenders and only the personalised fragment streams.
3. **Then** the catalogue pages can genuinely be static/ISR again, and
   `generateStaticParams` starts earning its keep.

Do 1 and 2 before considering any other performance work; nothing else on
this list is worth as much.

**Verification required.** Re-run `npm run build` and confirm `○`/`◐` on
`/`, `/[category]`, `/produkt/[slug]`; then a real Lighthouse mobile run on
a product page, before and after, recorded in `REVIEW-PERFORMANCE.md`.

**Acceptance criteria.**
- [ ] Home, category and product routes are no longer plain `ƒ`.
- [ ] Cart badge still updates immediately after a cart mutation.
- [ ] A logged-in visitor never sees another visitor's cached name or cart.

---

## PERF-02 — Every `generateMetadata` page queries the same row twice

- **Status:** CONFIRMED · PERFORMANCE
- **Severity:** P1
- **Area:** performance
- **Files:** `src/app/(shop)/produkt/[slug]/page.tsx`, `src/app/(shop)/[category]/page.tsx`, `src/app/(shop)/kolekcje/[slug]/page.tsx`, `src/app/(marketing)/blog/[slug]/page.tsx`, `src/app/(marketing)/strony/[slug]/page.tsx`

**Current behaviour.** Each of these five files calls the same repository
function twice per request — once in `generateMetadata`, once in the page
body (`getActiveProductBySlug`, `getActiveCategoryBySlug`, …). Prisma calls
are not deduplicated by Next automatically; only `fetch` is, and only
under specific cache settings. No `React.cache()` wrapper exists anywhere
in the repository (verified: zero matches).

**Recommended solution.** Wrap each of those five repository functions in
`cache()` from `react`:

```ts
import { cache } from 'react';
export const getActiveProductBySlug = cache(async (slug: string) => { … });
```

Five one-line changes; halves the query count on the five most-visited
dynamic routes. Combined with PERF-01, the product page drops from ~7
queries per render to ~2.

**Acceptance criteria.**
- [ ] A single request to `/produkt/[slug]` issues one product query, not two.
- [ ] The same holds for the other four routes.

---

# P2 — Medium

---

## BUG-08 — Free-shipping threshold compares gross against a net-documented field

- **Status:** CONFIRMED BUG
- **Severity:** P2
- **Files:** [src/domain/checkout/delivery.ts](src/domain/checkout/delivery.ts) (`evaluateDeliveryMethod`), [prisma/schema.prisma](prisma/schema.prisma) (`DeliveryMethod.freeShippingThresholdGrosze`)

The schema documents the field as *"Order subtotal (**net**) at or above
which this method becomes free."* The code compares
`cart.subtotalGrossGrosze`. Free shipping therefore triggers at
`threshold / 1.23` net — 23% earlier than the documented policy. With the
seeded 500 zł threshold that is 406,50 zł net.

**Observed consequence**, live: a 709,16 zł cart showed **all four** active
delivery methods at "0,00 zł — Darmowa dostawa". The real InPost tier for
that cart's computed weight (70×70 cm oak at the 18 mm fallback thickness ≈
6.2 kg) is `do 10 kg` = **51,61 zł**, absorbed by the shop.

Two separable things:
- **The bug:** pick one unit and make code, schema comment and admin form
  label agree. (Gross is arguably the better UX — "spend 500 zł" means the
  number the customer sees — so fixing the *comment* may be the right call.)
- **The business question (RECOMMENDATION, owner's decision):** a flat 500 zł
  free-shipping threshold on made-to-order furniture means the carefully
  built weight-tier machinery almost never fires. Worth revisiting the
  threshold, or making it weight-aware.

**Acceptance criteria.** Unit test pinning which subtotal is compared;
schema comment and admin label match it.

---

## BUG-09 — "Duplikuj" still says and looks like "duplicate" after becoming "+1"

- **Status:** CONFIRMED · UX/UI · content
- **Severity:** P2
- **Files:** [src/ui/islands/cart/CartContents.tsx](src/ui/islands/cart/CartContents.tsx), [src/content/pl/site.ts](src/content/pl/site.ts) (`cartDuplicatePl: 'Duplikuj'`)

The behaviour was reversed on 2026-08-30 (correctly, at the owner's
request). The schema comment, the operation comment and two tests were all
updated to record the reversal. The **user-visible label and icon were
not**: the control still reads „Duplikuj", still uses `ContentCopyIcon`,
and sits inches from a `+` stepper that now does exactly the same thing.

**Recommended:** remove the control (the `+` covers it) — or, if a
one-click "+1" shortcut is wanted, relabel to „Dodaj kolejną sztukę" with a
`+`-style icon. Do not leave a button promising a second line.

---

## BUG-10 — Mobile navigation has no menu

- **Status:** CONFIRMED · UX/UI · accessibility
- **Severity:** P2
- **Files:** [src/ui/primitives/SiteHeader.tsx](src/ui/primitives/SiteHeader.tsx)

`flexWrap: 'wrap'` is the entire responsive strategy — no breakpoint, no
hamburger. **Measured** at 375×812: the `<header>` is **149.6 px** tall
(three wrapped rows), plus the separate `SearchBar` band ≈ 68 px — roughly
**27% of the viewport** consumed before any content, on every page.

Also measured on the same render: every top-level nav target is **22 px**
tall and every dropdown item **38 px**, against WCAG 2.5.8's 24 px minimum
and the 44 px practical target. Detail in `REVIEW-UX-UI.md`.

---

## BUG-11 — Upload resolution and aspect warnings can never fire

- **Status:** CONFIRMED · MISSING FUNCTIONALITY
- **Severity:** P2
- **Files:** [src/server/actions/upload.ts](src/server/actions/upload.ts), [src/server/operations/design-review.ts](src/server/operations/design-review.ts), [src/domain/upload/inspect.ts](src/domain/upload/inspect.ts)

Both upload paths call `inspectUploadedFile({ bytes, target: null })`, and
`target === null` skips `evaluateResolution` and `evaluateAspectMismatch`
entirely. So §13.1 steps 6 and 7 — the DPI check ("warn below 150 DPI, warn
hard below 100") and the aspect-mismatch warning — **never run in
production**, and `CustomerDesign.autoWarnings` is always `[]`.

The code documents *why* honestly (`CUSTOM_UPLOAD` precedes `SIZE`, so no
target size exists yet) — but the consequence is that a real, unit-tested
safety feature is dead, and the design-review queue shows staff an empty
warnings list that looks like "we checked and it's fine".

**Recommended:** re-inspect at add-to-cart, when width and height are
known, and store the resulting warnings on the `CustomerDesign`. The
inspector already accepts a target; only the call site is missing.
Meanwhile, staff-facing copy should say "not yet assessed", not show an
empty warning list.

---

## BUG-12 — Post-response work is fire-and-forget, not `after()`

- **Status:** LIKELY BUG · ARCHITECTURAL CONCERN
- **Severity:** P2
- **Files:** [src/server/orders/create-order.ts](src/server/orders/create-order.ts) (lines 391, 407), [src/server/operations/admin-orders.ts](src/server/operations/admin-orders.ts) (line 109), [src/server/operations/cart.ts](src/server/operations/cart.ts) (line 286), several pages calling `recordAnalyticsEvent`

Order-confirmation email, status-update email and every analytics write are
started with `void promise.catch(…)` and never awaited. On a long-running
Node server this works. On any platform that freezes or terminates the
execution context when the response is sent (Vercel, Cloud Run with
CPU-throttling, Lambda), the promise is killed mid-flight: **order
confirmation emails silently not sent**, purchases missing from analytics.

Next 16 provides `after()` from `next/server` for exactly this. Since §3
names Vercel as a deployment target, this should be `after(() => mailer.send(…))`.
Marked LIKELY rather than CONFIRMED because it cannot be reproduced on the
local Node server.

---

## BUG-13 — A quantity changed in another tab is charged at the old value

- **Status:** LIKELY BUG
- **Severity:** P2
- **Files:** [src/server/orders/create-order.ts](src/server/orders/create-order.ts)

`createOrder` reads the cart (including `quantity`) before opening the
transaction, then claims rows with
`deleteMany({ where: { id: { in: cartItemIds }, cartId } })` — by id only.
A quantity change committed between the read and the transaction does not
change the id, so the claim still succeeds and the order is written with
the **stale** quantity. The two-tab case the idempotency work covers is
add/remove; this is edit.

**Recommended:** claim conditionally on the quantities that were priced,
e.g. delete each row with `where: { id, cartId, quantity }`, and treat a
short count as the existing `CART_CHANGED`. The infrastructure is already
there — only the predicate needs widening.

---

## BUG-14 — Switching delivery carrier leaves a stale pickup point

- **Status:** CONFIRMED BUG · UX/UI
- **Severity:** P2
- **Files:** [src/ui/islands/checkout/CheckoutForm.tsx](src/ui/islands/checkout/CheckoutForm.tsx) (lines 115-123, 466-472)

`selectedPickupPointId` is never reset when `selectedDeliveryId` changes.
Choose an InPost Paczkomat, pick a point, then switch to DPD Pickup: the
green confirmation Alert disappears (`findPickupPointById(dpd, inpostId)`
is `null`) but the hidden field still submits the InPost id, and
`disabledReason` only checks for `null`, so the submit button stays
enabled. The server correctly rejects with `PICKUP_POINT_INVALID` — the
customer just gets a failed submission for no visible reason.

**Recommended:** reset `selectedPickupPointId` (and the query) in the
delivery `onChange`, or derive `disabledReason` from `selectedPickupPoint`
rather than `selectedPickupPointId`.

---

## BUG-15 — Re-uploading a design orphans the previous file and its bytes

- **Status:** CONFIRMED BUG
- **Severity:** P2
- **Files:** [src/server/operations/design-review.ts](src/server/operations/design-review.ts) (`reuploadCustomDesign`)

The re-upload creates a new `UploadedFile` and repoints
`CustomerDesign.fileId` at it. The previous `UploadedFile` row keeps
existing with no `design` relation, and its bytes (plus preview) stay on
disk forever. Nothing lists or reaps them, and nothing can serve them
(`/api/plik` still would, for the owner — arguably a small privacy point:
a superseded design remains fetchable indefinitely).

**Recommended:** either keep them deliberately as a review history
(and then *show* the history in the review thread, which is genuinely
useful) or delete the superseded file and its blobs inside the same
transaction. Choose one and write it down; today it is neither.

---

## BUG-16 — Sitemap is missing most of the site; no `lastModified`

- **Status:** MISSING FUNCTIONALITY · SEO
- **Severity:** P2
- **Files:** [src/app/sitemap.ts](src/app/sitemap.ts)

Contains: home, `/blog`, categories, products, blog posts. Missing:
`/kolekcje` and every `/kolekcje/[slug]`, every `/strony/[slug]`
(`StaticPage`), `/faq`, `/o-nas`, `/kontakt`, `/regulamin`,
`/polityka-prywatnosci`. §18 also names "designs" and "content pages". No
entry sets `lastModified`, though every model carries `updatedAt`.

---

## BUG-17 — `robots.ts` allows crawling of the panel, the account area and token URLs

- **Status:** CONFIRMED · SECURITY CONCERN · SEO
- **Severity:** P2
- **Files:** [src/app/robots.ts](src/app/robots.ts)

`rules: { userAgent: '*', allow: '/' }` with no `disallow`. Only
`/szukaj` sets `robots: { index: false }` (verified: the single match in
the whole app).

`/zamowienie/[orderNumber]?token=…` is a bearer-token URL that grants full
access to an order. Combined with the missing `Referrer-Policy` (SEC-05),
that token can leak to any third-party resource the page loads and be
indexed if the URL is ever shared.

**Recommended:** `disallow: ['/panel/', '/moje-konto/', '/koszyk', '/zamowienie/']`;
add `export const metadata = { robots: { index: false, follow: false } }`
to the order confirmation, cart, checkout and account routes; add
`Referrer-Policy` (SEC-05).

---

## BUG-18 — `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` is not set or documented

- **Status:** LIKELY BUG · deployment
- **Severity:** P2
- **Files:** [.env.example](.env.example), [next.config.ts](next.config.ts)

Next encrypts variables captured by inline/bound Server Actions
(`node_modules/next/dist/docs/01-app/02-guides/server-actions.md`,
"Closure variable encryption"), and the docs state that multi-instance and
self-hosted deployments must set a stable
`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` shared across instances.

This codebase binds closures pervasively — `adjustCartItemQuantity.bind(null, item.cartItemId, 1)`,
`removeCartItem.bind(...)`, `submitGuestReview.bind(null, orderNumber, token)`,
and so on. Without a stable key, a two-instance deployment (or a rolling
redeploy while a page is open) fails to decrypt bound arguments and cart
buttons break for some requests and not others — a maddening intermittent
bug.

`serverActions.allowedOrigins` is also unset; fine for a single-origin
deployment, but must be set if a proxy or CDN rewrites `Host`.

**Recommended:** document both in `.env.example` and in a short
deployment section, with the "generate once, share across instances"
warning.

---

## BUG-19 — The order snapshot omits fields the architecture requires

- **Status:** CONFIRMED · MISSING FUNCTIONALITY
- **Severity:** P2
- **Files:** [src/server/orders/snapshot.ts](src/server/orders/snapshot.ts), [src/server/orders/create-order.ts](src/server/orders/create-order.ts) (`buildOrderItemInput`)

§6.8 specifies the snapshot as "product name **and slug**, design code and
name, material name **and family**, dimensions, thickness, finish,
installation variant, personalization text and font, module count and
layout, the full price breakdown with the pricing version, **estimated
production days**, and the customer design file reference."

Missing from `OrderItemSnapshot`: `productSlug`, material `family`,
`productionDaysMin/Max`. Also missing, and required elsewhere:

- `materialNotesPl` — §12 says it renders "on the product page **and** in
  the configurator summary **and** in the order confirmation".
- The installation variant's `namePl` and `receivesPl` — §6.5 says the "Co
  otrzymujesz" line "goes into the summary **and the order snapshot**".
  Only the bare enum code (`ON_TOP` / `OVERLAY` / `REPLACEMENT`) is stored,
  so rendering it in Polish either requires a live lookup (breaking the
  snapshot rule) or shows an English enum.

These are cheap to add and impossible to backfill later, which is the
argument for doing it now.

---

## BUG-20 — Marking an order paid writes no `OrderEvent`

- **Status:** CONFIRMED BUG
- **Severity:** P2
- **Files:** [src/server/operations/admin-orders.ts](src/server/operations/admin-orders.ts) (`applyMarkOrderPaid`)

The payment transition writes an `AuditLog` entry but no `OrderEvent`. The
order timeline — the thing staff and customers actually read — therefore
never shows that payment was received, only status changes. §16A.1 module 2
lists "payment marking" alongside "order event timeline".

**Recommended:** emit an `OrderEvent` (or extend the event model with a
non-status event type) inside the same conditional update.

---

## BUG-21 — Editing a cart line can still leave a duplicate saved project

- **Status:** LIKELY BUG
- **Severity:** P2
- **Files:** [src/server/operations/cart.ts](src/server/operations/cart.ts) (`applyUpdateCartItemConfiguration`)

The 2026-08-30 sweep stopped duplicate `Configuration` rows on the *add*
path and merges duplicate `CartItem`s on the *edit* path. But editing line
B's configuration into line A's selections **mutates** `Configuration` B; A
and B are then two distinct `Configuration` rows with identical selections.
The cart lines merge; the saved projects do not. The read-side dedupe in
`listConfigurationsForUser` hides it from `/moje-konto/projekty`, so the
duplicate exists in the database and is invisible.

**Recommended:** in the merge branch, delete the now-redundant
`Configuration` after the `CartItem` merge (it is safe — `OrderItem` never
joins to `Configuration`, as `applyDeleteConfiguration` already documents).

---

## PERF-03 — Every admin list except three loads its whole table

- **Status:** ARCHITECTURAL CONCERN · PERFORMANCE
- **Severity:** P2
- **Files:** all `src/server/repositories/admin-*.ts` except `admin-orders`, `admin-customers`, `admin-audit-log`

Verified by scanning all 25 files: 22 use unbounded `findMany` and
serialize the full result into the RSC payload for a client `DataGrid`.
Fine at 8 products and 13 designs. At a few thousand designs, or an
open-ended table like `SupportRequest`, the page payload grows without
limit. `/panel/kontakt` and `/panel/produkcja` are the two that grow
fastest in normal operation.

**Recommended:** solve it once, with the same server-side pagination
helper ADMIN-01 needs, and apply it to the unbounded lists as they grow.
Not urgent; do not pre-optimise all 22.

---

## PERF-04 — Three Turbopack over-bundling warnings

- **Status:** CONFIRMED · PERFORMANCE (build)
- **Severity:** P2
- **Files:** [src/server/storage/public-images.ts](src/server/storage/public-images.ts) (lines 47, 50, 66)

`npm run build` emits three warnings; the dynamic `path.join(PUBLIC_IMAGES_ROOT, kind, ownerId)`
patterns match **93 016 / 33 848 / 16 924 files** respectively. Turbopack's
message: "Overly broad patterns can lead to build performance issues and
over bundling."

**Recommended:** build the path from a validated literal map of the five
`PublicImageKind` values rather than interpolating, or move the filesystem
write behind a small non-bundled boundary. The build currently succeeds, so
this is hygiene, not breakage — but a clean build is worth keeping clean.

---

## SEC-06 — Runtime writes into `public/` are deployment-fragile and unvalidated

- **Status:** ARCHITECTURAL CONCERN · SECURITY CONCERN
- **Severity:** P2
- **Files:** [src/server/storage/public-images.ts](src/server/storage/public-images.ts)

Admin-uploaded product, category, material, finish and design images are
written into `public/images/{kind}/{ownerId}/{uuid}.{ext}` at runtime. The
file header is honest that this assumes a long-running Node server — but
§3 names Vercel as a deployment target, where `public/` is immutable and
these uploads vanish on the next deploy. Documented in one place,
contradicted in another.

Two smaller points in the same file:
- `savePublicImage` has **no size cap** (customer uploads do — 25 MB via
  `domain/upload/inspect.ts`). An admin can write an arbitrarily large
  file.
- `ownerId` is interpolated into a path with no validation.
  `deletePublicImage` explicitly guards against `..`; `savePublicImage`
  does not. Not currently reachable (every caller passes a cuid from the
  database), which is why this is a defence-in-depth note rather than a
  vulnerability — but the asymmetry between the two functions is the kind
  of thing that becomes one.

---

## SEC-07 — RODO anonymization leaves full PII on orders and support requests

- **Status:** ARCHITECTURAL CONCERN · compliance
- **Severity:** P2
- **Files:** [src/server/operations/admin-customers.ts](src/server/operations/admin-customers.ts)

`applyAnonymizeCustomer` scrubs `User` and revokes sign-in. Its comment
argues that `Configuration` and `UploadedFile` carry no name/email/phone —
correct — but does not mention that **`Order` does**: `email`, `firstName`,
`lastName`, `phone`, `street`, `postalCode`, `city` are all retained
verbatim, as is `SupportRequest.email`/`namePl`.

Retaining invoice data is legitimate under Polish accounting law, and the
architecture says so. The gap is that the module presents the scrub as
complete, nothing bounds the retention (no period, no purge job), and a
data-subject request cannot be answered accurately from the code as it
reads.

**Recommended:** document what is retained and why, directly in the
operator UI shown at anonymization time; add a retention window and a
purge path for anything beyond the accounting minimum. This is a decision
for the owner, not a unilateral change.

---

## SEC-08 — Guest upload rate limit resets with the cookie

- **Status:** CONFIRMED · SECURITY CONCERN
- **Severity:** P2
- **Files:** [src/server/upload/rate-limit.ts](src/server/upload/rate-limit.ts), [src/server/actions/upload.ts](src/server/actions/upload.ts)

The limiter counts `UploadedFile` rows for the caller's `sessionToken` or
`userId`. A guest's `sessionToken` is a cookie the client controls: discard
it and `ensureGuestSessionToken()` mints a fresh one, resetting the count
to zero. Ten uploads per hour becomes unlimited for the cost of clearing a
cookie.

**Recommended:** add an IP dimension using the same limiter SEC-01 needs
(`x-forwarded-for` is already read in this file's neighbourhood). Fixing
SEC-01 makes this nearly free.

---

## SEC-09 — `/api/plik/[fileId]` buffers whole files; §16.1 says it streams

- **Status:** CONFIRMED · PERFORMANCE · doc divergence
- **Severity:** P2
- **Files:** [src/app/api/plik/[fileId]/route.ts](src/app/api/plik/[fileId]/route.ts), [src/server/storage/local-disk.ts](src/server/storage/local-disk.ts)

`const bytes = await storage.get(key)` reads the entire file into memory
and wraps it in a `Uint8Array`. With a 25 MB cap and concurrent staff
downloads in the review queue, that is real heap pressure. §16.1 says the
route "streams via the storage adapter".

**Recommended:** give `FileStorage` a `getStream(key)` and return a
`ReadableStream` response. Also add `nosniff` here (SEC-05).

---

## ARCH-01 — There is no CI

- **Status:** **RESOLVED 2026-08-31** (was MISSING FUNCTIONALITY · ARCHITECTURAL CONCERN)
- **Severity:** P2
- **Files:** [.github/workflows/ci.yml](.github/workflows/ci.yml) (new), [scripts/seed-test-db.mjs](scripts/seed-test-db.mjs) (new), [playwright.config.ts](playwright.config.ts), [package.json](package.json)

No `.github/workflows`, no `.husky`, no pre-commit hooks. `playwright.config.ts`
branched on `process.env.CI` but nothing ever set it. 831 tests, a
typecheck, a lint rule and an e2e suite ran only when a human remembered.

For a project whose governing instruction is test-driven development, this
was the single highest-leverage process fix available.

### What was built

Two jobs, deliberately separate:

- **`verify`** — `npm ci` → create both databases → `db:deploy` ×2 →
  `db:seed` ×2 → `typecheck` → `lint` → `test` → `build`. Fast and
  deterministic; this is what a branch-protection rule should require.
- **`e2e`** — `needs: verify`, installs Chromium + WebKit, runs the
  Playwright suite (whose own `webServer` builds and starts the app), and
  uploads the HTML report as an artifact.

They are separate because the e2e suite has a **documented, reproducible
parallel-contention flake** (`REVIEW-TEST-COVERAGE.md`), and a flake there
must not hide a real failure in `verify`.

**The database setup mirrors `docker-compose.yml` exactly**, down to the
published port (5433) and the init script — the workflow runs
`docker/postgres-init/01-databases.sql` itself rather than repeating the
SQL, so "works locally" and "works in CI" cannot drift. Both databases are
created because both are genuinely used: `next build` reads `DATABASE_URL`
(`generateStaticParams` prerenders 81 catalogue pages) while the integration
tier is redirected to `TEST_DATABASE_URL` by `tests/integration/env-setup.ts`.

**Both databases are seeded.** This is not incidental: `offered-is-buildable`
sweeps every offered combination of every *active product*, and
`starting-price` exhaustively searches the seeded catalogue. On an empty
database those iterate nothing and **pass vacuously** — a green run that
proves nothing, which is worse than a red one. A new `npm run db:seed:test`
(`scripts/seed-test-db.mjs`) mirrors the existing `db:deploy:test` and makes
this a command rather than a remembered incantation.

### Verified — and what could not be

A workflow only ever executes somewhere else, so the ordinary write-run-fix
loop does not apply. Two things were done instead of hoping.

**1. The whole CI sequence was reproduced locally against a virgin
database.** A throwaway `cnc_selling_cicheck` was created with the same init
SQL, then:

```
prisma migrate deploy   →  all 27 migrations applied from zero, clean
prisma db seed          →  full catalogue seeded from empty
npm test                →  931 passed / 931   (against that database)
npm run build           →  succeeds, 81 static pages generated
```

The database was then dropped. This matters most for the four migrations
added earlier the same day (`RateLimit`, the OTP subject, the retired
placeholder design, `startingPriceGrossGrosze`) — the local databases had
grown incrementally through `migrate dev` and **had never been proven to
apply from scratch**, which is exactly what CI does on every run.

**2. `tests/unit/ci-workflow.test.ts` (12) parses the workflow** and pins
the two failure modes that produce a *green* run rather than a red one: a
step invoking an npm script that has been renamed, and `npm test` running
without `TEST_DATABASE_URL` — which `env-setup.ts` deliberately does not
throw on (unit tests must work with no database), so the entire integration
tier would silently run against `DATABASE_URL` and still report success.

**Not verified: the workflow has never executed on GitHub.** That cannot be
done from here. The runner-specific parts — `actions/setup-node` caching,
the service-container port mapping, `psql` on the runner image, and
`npx playwright install --with-deps` — are conventional but unproven. Expect
the first run to need a small correction.

**`workers: process.env.CI ? 1 : undefined`** was added to
`playwright.config.ts`: the recorded flake is parallel contention over one
shared database, and a first CI run that is red for that reason teaches a
team to ignore CI. This is the documented diagnosis applied, **not a
measured fix** — raise it once the suite has a few green runs. The real
repair is ARCH-03.

---

## ARCH-02 — `Configurator.tsx` is 1 525 lines

- **Status:** ARCHITECTURAL CONCERN
- **Severity:** P2
- **Files:** [src/ui/islands/configurator/Configurator.tsx](src/ui/islands/configurator/Configurator.tsx)

The largest file in the repository by a factor of three. It holds the step
machine, the breadcrumb menus, size popovers, the personalization form,
custom-upload handling, the warnings/acknowledgement UI, and price display.
It is coherent and well commented — but it is where every future
configurator change lands, and it currently has no component test of its
own.

**Recommended:** extract along seams that already exist —
`<ConfiguratorBreadcrumbs>`, `<SizeStep>`, `<PersonalizationStep>`,
`<CustomUploadStep>`, `<PriceAndWarnings>` — and add component tests per
piece. Do not restructure the state model; it works.

---

## ARCH-03 — Development database is polluted with test artifacts

- **Status:** RECOMMENDATION
- **Severity:** P2

The database `npm run dev` points at contains **166 orders, 466
configurations, 262 cart items**, a `test-e2e-wzor` design
(`isActive: false`, `REQUIRES_PERMISSION`) and two dead duplicate delivery
methods („Kurier", „Paczkomat") superseded by their „… InPost" versions.

E2E specs run against the dev database rather than the test one, so every
run accumulates more. It makes "is this real data or leftover?" a question,
which is exactly the question an audit should not have to ask.

**Recommended:** point Playwright at `TEST_DATABASE_URL`, and add a
`npm run db:reset` that drops and reseeds the dev database.

---

## BUG-22 — Order `accessToken` travels in the query string

- **Status:** ARCHITECTURAL CONCERN · SECURITY CONCERN
- **Severity:** P2
- **Files:** `src/app/(shop)/zamowienie/[orderNumber]/page.tsx`, [src/server/actions/checkout.ts](src/server/actions/checkout.ts) (`redirect`, `lookupOrder`)

The guest order URL is `/zamowienie/2026%2F08%2F0042?token=<32 bytes>`. The
token is a bearer credential in a URL, which means it lands in browser
history, in any `Referer` sent to a third party, and in server access logs.
The comparison itself is correct and constant-time; the transport is the
weak part.

Mitigations, cheapest first: add `Referrer-Policy` (SEC-05); `noindex` the
route (BUG-17); consider setting a short-lived signed cookie on first
successful lookup and redirecting to the clean URL.

---

## BUG-23 — Order numbers use server-local time

- **Status:** LIKELY BUG
- **Severity:** P2
- **Files:** [src/server/orders/create-order.ts](src/server/orders/create-order.ts)

`now.getFullYear()` / `now.getMonth()` build both the counter key and the
displayed `orderNumber`. A server running in UTC (the default nearly
everywhere) assigns an order placed at 01:30 Europe/Warsaw on the 1st of a
month to the **previous** month's sequence. Harmless for uniqueness,
confusing for accounting, and it silently changes if the deployment's `TZ`
changes.

**Recommended:** format explicitly in `Europe/Warsaw` with `Intl.DateTimeFormat`.

---

# P3 — Polish

---

- **BUG-24** — JSON-LD `availability: 'https://schema.org/InStock'` is hardcoded for made-to-order goods; `MadeToOrder`/`PreOrder` is accurate. `src/app/(shop)/produkt/[slug]/page.tsx`.
- **BUG-25** — "Odbiór osobisty" (personal collection) displays „Darmowa dostawa — Twoje zamówienie kwalifikuje się do darmowej wysyłki tą metodą". Nonsense for a method with no shipping. Verified live. `CheckoutForm.tsx` + `evaluateDeliveryMethod`'s threshold branch.
- **BUG-26** — `ProductCard` images declare `sizes="(max-width: 768px) 50vw, 300px"` but render at ~87vw on a 375px viewport (measured 327px). Under-requests at DPR ≥ 2. (Image sizing is otherwise correct — verified that a 327px slot fetches `w=384`.)
- **BUG-27** — Cart badge count is `aria-hidden="true"` with no alternative, so screen readers hear the total but not the item count. `SiteHeader.tsx`.
- **BUG-28** — No skip link. The only in-page anchor is the hero CTA. With a 3-row mobile nav this is a real WCAG 2.4.1 gap.
- **BUG-29** — `<nav>` has no `aria-label`; the footer's link groups are not a labelled landmark.
- **BUG-30** — Removing a cart item has no confirmation and no undo; a mis-tap discards a fully configured, priced item.
- **BUG-31** — Only one `Font` row is seeded, and it is `Inter`, the site's own UI face. The whole cmap-coverage apparatus (§17.2) currently guards a single sans-serif, and `Font` has no admin screen (`OPEN_ITEMS.md` §8). Honest limitation; worth stating in customer-facing copy.
- **BUG-32** — All 13 `Design.sortOrder` values are `0`; `Material`/`Finish` ordering is similarly unset in the configurator queries. See BUG-03.
- **BUG-33** — `ARCHITECTURE.md` §6.7 still says "Duplicate configuration deep-copies the `Configuration` row rather than incrementing quantity." Reversed on 2026-08-30; the schema comment and the operation comment were updated, this one was missed.
- **BUG-34** — The pricing simulator's "cannot publish without viewing it" rule (§16A.1 module 7) is enforced only in `PricingSimulator.tsx` (`disabled={result === null}`). `publishPricingVersion` accepts a direct call. `ADMIN`-only, so low risk — but the invariant is UI-deep, not enforced.

---

## Cross-cutting: where this review disagrees with the repository's own documents

| Document says | Code does | Issue |
|---|---|---|
| §7.2 / §6.4 — availability & rights "enforced by a query filter, not by discipline" | not filtered on the write path | SEC-03 |
| §16.1 — "Security headers + strict CSP" | none exist | SEC-05 |
| §16.1 — rate limits on "auth attempts" | none | SEC-01 |
| §16.1 — "No PII in logs beyond user id" | OTP + recipient logged | SEC-02 |
| §16.1 — `/api/plik` "streams via the storage adapter" | buffers fully | SEC-09 |
| §16.3 — `STAFF`: customers **read**; settings **ADMIN** | STAFF can anonymize + change bank details | SEC-04 |
| §18 — "Catalogue pages are RSC + ISR" | 91/93 routes dynamic, no caching primitives at all | PERF-01 |
| §2 — Zod "reused for client hints and server enforcement" | imported nowhere | BUG-07 |
| §6.8 — snapshot includes slug, family, production days | absent | BUG-19 |
| §6.5 — variant "Co otrzymujesz" goes into the snapshot | only the enum code | BUG-19 |
| §12 — `materialNotesPl` shown in the order confirmation | not in the snapshot or the view | BUG-19 |
| §13.1.6-7 — DPI and aspect warnings | never run (`target: null`) | BUG-11 |
| §6.7 — "Duplicate deep-copies the Configuration" | now increments quantity (deliberate reversal) | BUG-33 |
| `CHECKLIST.md:81` — step guards "reject a THICKNESS selection on WALL_ART" | never called | BUG-06 |
| `DeliveryMethod.freeShippingThresholdGrosze` — "(net)" | compared against gross | BUG-08 |
| `public-images.ts` — "deployment target is a long-running Node server" | §3 names Vercel | SEC-06 |
