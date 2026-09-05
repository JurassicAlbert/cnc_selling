# AI Implementation Checklist

> **This file is the continuation state for this project.** If you read only
> one document, read this one. It tells you what has been reviewed, what is
> fixed, what remains, what is blocked, and what to do next.
>
> Rules for maintaining it: never reset a completed item · never silently
> delete an unresolved one · merge duplicates rather than adding new ones ·
> preserve IDs · update status with evidence and a date · an item is `[x]`
> only when it is implemented **and verified**, never because a
> recommendation was written down.

---

## Current State

| | |
|---|---|
| **Last reviewed** | 2026-08-30 (audit) · **2026-08-31 (P0 fixes + SEC-05 implemented)** |
| **Commit reviewed** | `e774e40` "Eliminate every duplicate a customer can create" (`main`) |
| **Review status** | Independent full-repository audit complete. **All four P0s fixed and verified** - the three from the audit, plus BUG-35 found and closed during remediation. **SEC-05 (security headers + CSP) closed 2026-08-31.** |
| **Overall implementation status** | Feature-complete against `ARCHITECTURE.md` P0–P9. All P0s closed, **every listed product can actually be configured and ordered** (T-16 holds the line), §16.1's header half exists, and there is CI. **The e2e suite is green (70/70, both browsers)** - see T-23, T-24 and T-25. Remaining: **0 P0, 0 P1**, 32 P2, 14 P3. |
| **Current highest-priority issue** | **UX-22** - a second confirmation on the bank-account field. CI's first-ever run was red (CI-01, fixed 2026-09-05); `main` stays red until that fix lands. |
| **Recommended next task** | **PERF-03**, then finishing **ARCH-02**. **The PR was opened and merged on 2026-09-05, and CI ran for the first time - red, on its first database step (CI-01).** That is fixed and the whole pipeline reproduced locally against virgin databases, but `main` carries the red run until the fix is merged. |
| **Blocking issue** | None. `OPEN_ITEMS.md` §6 (rate-limit storage) is **resolved** - the owner chose Postgres on 2026-08-30 and it is built. |
| **Last completed area** | **UX-22** (2026-09-05). Before it: **ARCH-02** (partial). Before it: **BUG-04 + BUG-19 + T-26**. Before them: **CI-01**, the first real CI run's failure. Before it: **ARCH-03** the same day. Before it: **ADMIN-01** the same day, which closed the last P1. Before it: UX-26. Before it: UX-25 + T-25, and UX-23. Before it: UX-21, and SEC-11 + T-23 found while verifying it. Before them: the warehouse tool, the burger nav, the em-dash sweep, PERF-02 + PERF-05, BUG-05, BUG-06, BUG-07, SEC-04, SEC-10, ARCH-01, SEC-05, SEC-01, SEC-02, SEC-03, BUG-02, BUG-03, BUG-24, BUG-35 and the carried-forward P1-8. |
| **Ready for the next implementation step?** | **Yes.** 1090/1090 unit + integration tests (four consecutive clean runs), **68/68 e2e across both browser projects** (two consecutive), typecheck clean, lint clean, production build succeeds. |

**Verified baseline after the P0 fixes, SEC-05 and ARCH-01** (all actually run):

```
npm test          →  1031 passed / 1031,  85 files,  80s   (was 888/888, and 831/831 before the round)
npm run typecheck →  clean (exit 0)
npm run lint      →  clean, 561 files
npm run build     →  succeeds; the same 3 pre-existing Turbopack warnings (PERF-04)
npx playwright test tests/e2e/security-headers.spec.ts --project=desktop-chromium
                  →  10 passed / 10
```

**And the same suite against a database built exactly the way CI builds one**
- a throwaway database created from `docker/postgres-init/01-databases.sql`,
migrated from zero and seeded from empty, then dropped:

```
prisma migrate deploy  →  all 27 migrations applied from zero, clean
prisma db seed         →  full catalogue seeded from empty
npm test               →  931 passed / 931
npm run build          →  succeeds, 81 static pages generated
```

**The GitHub workflow itself has never run on GitHub** - that cannot be done
from here. Push and watch the first run.

Live browser verification of SEC-03/BUG-03 (dev server, real database):
a pattern was retired the way staff would, a configuration URL naming it was
opened, and "Dodaj do koszyka" was **refused** with the new Polish message
- where before the fix it would have been added and orderable. With the
pattern retired, the configurator's default moved by itself from the
placeholder to a real sellable pattern („Gałązka oliwna"). Both were then
restored, and the single cart row created during the check was removed.

`npm run e2e` was **not** re-run (known parallel-contention flake; every
affected spec passed in isolation last session).

---

## P0 - Critical

### Ecommerce

- [x] **BUG-35 · P0 · ecommerce - Products the shop offers but then refuses** - **DONE 2026-08-31.** Found while implementing BUG-02; pre-existing, not caused by any change in this round.
  - **Files:** data, not code - `prisma/seed.ts`'s `DESIGN_SEEDS` and `MATERIAL_SEEDS`, evaluated by `domain/feasibility/rules.ts`
  - **Routes:** `/produkt/bransoletka-z-grawerem`, `/produkt/stolek-loftowy-z-grawerem`, and their cards on `/`, `/amulety-i-bransoletki`, `/loft`
  - **Was:** every active product had blocked combinations, and two were entirely unbuildable while still listed, browsable and priced. Measured by pricing the full option set through the real engine: **bracelet 0 of 132 buildable · loft stool 132 of 792 · chessboard 198 of 396 · wall art 88 of 132 · floor panel 0 of 264 · kitchen tile could not be configured at all.** Blockers: `LINE_TOO_THIN` and `DETAIL_SPACING_TOO_TIGHT`.
  - **Cause:** all 12 seeded designs declare `referenceWidthMm: 600` with `minLineWidthUm: 1200` / `minDetailSpacingUm: 2000`, and features scale with the piece. On a 130 mm bracelet the lines come out at **0,26 mm** against a material minimum of 1,2 mm.
  - **Verified live:** the bracelet page renders „Przy tym rozmiarze linie wzoru mają 0,26 mm… Wybierz większy rozmiar lub inny materiał." That advice **cannot be followed** - 22 cm is the product's own maximum, and all four wood materials share the same 1,2 mm minimum. The customer is told to do something impossible.
  - **Why it was invisible:** no test asserts that an active product can be ordered at all, and the audit's own coverage matrix did not have that row either. The advertised price hid it too - `minPriceGrosze` is a static column, so a card showed „od 40,00 zł" for something unbuyable.
  - **Owner's decision, 2026-08-31 (verbatim):** "we should not measure patterns can be printed on the product - since we decided we sell product with the pattern already - the client can just define material, wymiary. We should give real data for product and there shouldn't be cases where we allow something but its blocked by system - this is logical issue."
  - **Fix, part 1 - stop gating on pattern metadata.** `PATTERN_FEASIBILITY_ENABLED = false` in `price-configuration.ts` passes `design: null` to `evaluateFeasibility`, switching off exactly the three design-derived findings. The reasoning is sound as well as instructed: these rules scale a pattern's declared minimums down to a customer-chosen size, which is only meaningful **when the customer chooses the pattern** - and selection is off, so the pattern is a property of a product we already make. They were also reading seed scaffolding (identical `referenceWidthMm: 600` / `minLineWidthUm: 1200` on all twelve designs), never a real measurement. Nothing deleted: `domain/feasibility` keeps all three rules and their 32 unit tests, `evaluateFeasibility` already accepted `design: null` (the `CUSTOM` path), and flipping one flag re-enables it the day patterns are selectable again **with real per-design numbers**. Every other finding still blocks - module count, natural variation, floor matching, the machine's real Z-axis limit, and all personalization checks - because those constrain choices the customer genuinely makes.
  - **Fix, part 2 - stop requiring what we do not offer.** The same sweep exposed the mirror-image defect: `fartuch-kuchenny-z-grawerem` has `FINISH` in its step list, but its only material is gres, which has no `MaterialFinish` rows because porcelain stoneware is not oiled. It could therefore *never* be completed. `applicableSteps` (`validate-and-price.ts`) now narrows a product type's steps to those the product can actually offer an option for, and `getConfiguratorSnapshot` uses the same narrowing so the UI and the server agree on "complete". MATERIAL and SIZE are never narrowed away - a product with no material should stay a hard failure, not become a valid empty configuration.
  - **Test:** **T-16 added** - `tests/integration/offered-is-buildable.test.ts`. Sweeps every offered combination of every active product (~1500) and asserts none is refused, then drives one configuration per product all the way through `applyAddToCart`. It failed on all six products before the fix and passes now, so it locks the invariant in rather than describing it.
  - **One existing unit test was reversed**, not deleted: `configurator-server.test.ts`'s "flags a blocking feasibility error" asserted precisely the behaviour being removed. It now pins the new rule, with the decision and its reasoning recorded in the test itself, plus a companion asserting that a **real** machine limit still blocks.
  - **Verified live:** `/produkt/bransoletka-z-grawerem` went from two blocking errors and impossible advice („Wybierz większy rozmiar lub inny materiał" - 22 cm was its maximum) to „od 55,69 zł" and a successful add to cart.
  - **Still open, and genuinely the owner's:** the seeded design metadata is placeholder scaffolding. If patterns become customer-selectable again, real per-design `referenceWidthMm`/`minLineWidthUm` measured from the machine are needed before the flag goes back on - and 1,2 mm looks like a *router-bit* figure, while a bracelet would realistically be laser-engraved. Recorded, not blocking anything today.
  - **Evidence:** exhaustive sweep counts above · T-16 red→green · live browser check

### Security

- [x] **SEC-01 · P0 · security/auth - Login, registration and OTP requests are unthrottled** - **DONE 2026-08-31**
  - **Files:** `src/server/actions/auth.ts`, `src/server/auth/auth.ts`
  - **Routes:** `/logowanie`, `/rejestracja`
  - **Current:** All auth actions call `auth.api.*` directly. Better Auth's rate limiter lives in its HTTP router's `onRequest` hook (`node_modules/better-auth/dist/api/index.mjs:163-169`) and only runs for `/api/auth/*`. `betterAuth({…})` sets no `rateLimit`. Result: unlimited password guessing, unlimited outbound OTP email to any address, unlimited account creation. OTP *verification* is bounded at 3 attempts by the plugin; nothing else is.
  - **Expected:** §16.1 - rate limits on "auth attempts".
  - **Test:** T-01 - (N+1) failed logins for one email refused; other emails unaffected; window expires.
  - **Dependencies:** `OPEN_ITEMS.md` §6 (storage). Recommended default: a `RateLimit` table with one atomic `INSERT … ON CONFLICT DO UPDATE … RETURNING`, the same shape `OrderNumberCounter` already uses.
  - **Acceptance:** limiter keyed on identity **and** IP · `submitOtpRequest` limited per email · refusal renders Polish copy from `content/pl/` · a test proves the refusal.
  - **Evidence:** `REVIEW-DETAILED.md` SEC-01
  - **Status:** **DONE 2026-08-31.** `RateLimit` model + migration `20260831000000_add_rate_limit`; `server/rate-limit/{rate-limit,rules,auth-throttle}.ts`; wired into `submitLogin` / `submitRegister` / `submitOtpRequest`. One atomic `INSERT … ON CONFLICT DO UPDATE … RETURNING`, so concurrent attempts compose instead of overwriting - proven by a 20-way concurrent test (exactly 5 of 20 allowed). Limits per email **and** per IP; the IP dimension is skipped when there is no IP rather than folding every unattributable request into one shared bucket. A successful login clears the email counter, so a customer who mistypes and then succeeds carries nothing forward. The refusal names the real wait („Spróbuj ponownie za N minut") and reveals nothing about whether the account exists. **+20 tests** (`rate-limit.test.ts` 7, `auth-throttle.test.ts` 13).

- [x] **SEC-02 · P0 · security/logging - OTP codes are written to logs in plaintext** - **DONE 2026-08-31**
  - **Files:** `src/server/mail/mailer.ts`, `src/server/logging/logger.ts`
  - **Current:** the OTP subject is `` `Twój kod …: ${otp}` `` and `UnconfiguredMailer.send` logs `{ template, subject, to }`. `createMailer()` picks that implementation whenever `RESEND_API_KEY`/`EMAIL_FROM` are unset - the documented default - with **no production guard**. Anyone with log access can sign in as any user. Recipient addresses are logged too.
  - **Expected:** §16.1 - "No PII in logs beyond user id"; a credential never reaches a log.
  - **Test:** T-02 - the emitted log line for a `verification-otp` send does not contain the OTP.
  - **Acceptance:** no log line contains an OTP by default · addresses not logged in cleartext · an unconfigured mailer in production fails loudly · a dev-only escape hatch is explicit (`MAIL_DEV_LOG_SECRETS=1`), not the default.
  - **Evidence:** `REVIEW-DETAILED.md` SEC-02
  - **Status:** **DONE 2026-08-31.** The code left the subject line entirely. `send()` now **returns** the resolved subject instead of logging it, so the template tests observe the real API rather than a side effect - reading behaviour off a log line is what put the code there in the first place. Logs carry a hashed `recipient` tag, never an address (§16.1). An unconfigured mailer in production logs `mailer.not_configured` at **error** level - loud, but still non-throwing, because §14/§15.3 require the order to succeed even when the notification cannot be delivered. The dev "read the OTP from the log" workflow survives behind `MAIL_DEV_LOG_SECRETS=1`, which is ignored when `NODE_ENV=production`. Migration `20260831010000_otp_subject_without_code` fixes the already-seeded DB template that put `{{otp}}` in the subject - **guarded on the old value**, so an operator's own edit is never overwritten. `.env.example` and `logging/logger.ts`'s header updated to match. **+6 tests**, including one proving the guarantee holds even when a DB template puts the code back into the subject.

- [x] **SEC-03 · P0 · security/ecommerce/legal - Availability, rights and compatibility are never enforced on the write path** - **DONE 2026-08-31**
  - **Files:** `src/server/configurator/validate-and-price.ts`, `src/server/repositories/configurator.ts` (106-161, 219-274), `src/server/configurator/resolve-options.ts`
  - **Routes:** every `addToCart`, `updateCartItemConfiguration`, `createOrder`
  - **Current:** `getConfiguratorProductData` builds its `*ById` maps with no `where` and no filter. `priceAndValidateSelections` resolves by map lookup and checks completeness only. `Material.isAvailable`, `Design.isActive`, `Design.rightsStatus`, `DesignMaterial` narrowing and the variant thickness cap are enforced **for rendering only**. A crafted POST - or an ordinary customer on a stale URL after staff retire a pattern - can price and order a `RESTRICTED`/`REQUIRES_PERMISSION` design.
  - **Currently loaded?** No. Verified by SQL: no non-sellable design or unavailable material is linked to an active product today. The hole is live and unloaded; it arms the first time staff deactivate anything.
  - **Expected:** §7.2 and §6.4 - "enforced by a query filter, not by discipline"; §16 - assume the frontend is bypassed.
  - **Test:** T-03 - `applyAddToCart` **and** `createOrder` each reject all six cases (inactive design · `REQUIRES_PERMISSION` design · unavailable material · unavailable finish · `DesignMaterial`-excluded pair · over-cap thickness), asserted through the operation, never against the pure function.
  - **Dependencies:** do **BUG-03** in the same change - the auto-selected default is drawn from the same unfiltered list.
  - **Acceptance:** `resolveOptions` is called from `priceAndValidateSelections` and its output gates the selection · the rules are **not** re-implemented · a test proves that deactivating a pattern makes an existing saved project unorderable · a specific Polish message explains the refusal.
  - **Evidence:** `REVIEW-DETAILED.md` SEC-03
  - **Status:** **DONE 2026-08-31.** `priceAndValidateSelections` now calls the existing `resolveOptions` and refuses any selection outside it. The rules were **reused, not re-implemented**, so there is exactly one definition of "selectable" and it cannot drift from the picker. The function returns a tagged `PriceAndValidateOutcome` with a distinct `OPTION_UNAVAILABLE`, threaded through `AddToCartResult`, `CreateOrderResult` and `CheckoutFormState`, each with its own Polish copy - the generic "invalid configuration" told a customer holding a withdrawn pattern nothing they could act on. **+22 tests** (`selection-availability.test.ts`): deactivated / `REQUIRES_PERMISSION` / `RESTRICTED` designs, unavailable material and finish, a `DesignMaterial`-excluded pair, an unoffered thickness, made-up ids, the still-working control, and the realistic "staff retire a pattern after a project was saved" path - every one asserted **through `applyAddToCart`**, never against the pure function, since that is exactly the gap that let this ship.
  - **Verified live:** a pattern was retired in the dev database the way staff would, a configuration URL naming it was opened, and add-to-cart was refused with the new message. Before the fix that configuration priced, added and was orderable.

---

## P1 - High

### Correctness / ecommerce

- [x] **BUG-02 · P1 · ecommerce/content/SEO - The advertised "from" price is net and unreachable** - **DONE 2026-08-31**
  - **Files:** `src/ui/primitives/ProductCard.tsx:168`, `src/app/(shop)/produkt/[slug]/page.tsx` (price + `jsonLd`)
  - **Routes:** `/`, `/[category]`, `/produkt/[slug]`, `/szukaj`, `/kolekcje/[slug]`
  - **Current:** shows `minPriceGrosze`, which `calculatePrice` uses as the **net** clamp, while every other price on the site is gross. Measured: `obraz-drewniany` 150,00 shown vs ≈190,40 real gross (+27%); `szachownica` +47%; `bransoletka` +39%. The same number is `Offer.price` in the JSON-LD.
  - **Expected:** a gross, achievable starting price; JSON-LD matching the visible price.
  - **Test:** T-04 - for every seeded active product, advertised ≤ cheapest orderable configuration, both gross.
  - **Acceptance:** no product advertises below its cheapest orderable configuration · price is gross · JSON-LD matches · a future rate change that breaks this fails a test.
  - **Evidence:** `REVIEW-DETAILED.md` BUG-02 · `REVIEW-UX-UI.md` UX-01
  - **Status:** **DONE 2026-08-31.** Owner: "we should show the brutto - gross price and the price should depend on what user pick." New `Product.startingPriceGrossGrosze` (migration `20260831030000_add_product_starting_price`), computed by `server/pricing/starting-price.ts` as the **cheapest configuration a customer can actually buy**, gross - reusing `resolveOptions` so it can never quote an unsellable option. Rendered on cards, the product page and the JSON-LD; `null` renders „Wycena indywidualna" and **omits `offers` entirely** rather than publishing a wrong price. `availability` corrected from `InStock` to `MadeToOrder` (closes BUG-24). Price sorting now uses the advertised figure, nulls last, so the sort matches the numbers on the cards. **+5 tests.**
  - **Correction to the audit's own figures:** the review estimated the wall art's real cheapest at ≈190,40 zł by pricing the smallest preset. That was wrong - the 20×20 cm preset is blocked for every pattern the product offers, so nothing at that size is buildable. The true floor is **648,89 zł**, so the advertised 150,00 zł understated by 4,3×, not 27%. Verified live on the homepage.
  - **Refresh hooks:** publishing a pricing version, and creating/editing/toggling a product, material or finish. Design edits and the compatibility editors are **not** hooked yet - see `refreshStartingPricesAfterCatalogueChange`'s own comment; the consequence is bounded to a stale *advertised* figure, since the configurator, cart and checkout all re-price live.

- [x] **BUG-03 · P1 · ecommerce/content - A placeholder design is silently attached to every order, non-deterministically** - **DONE 2026-08-31**
  - **Files:** `src/ui/islands/configurator/Configurator.tsx` (174, 197-210), `src/server/repositories/configurator.ts` (106, 140)
  - **Current:** pattern selection is hidden but `computeDefaultSelections` still takes `options.designs[0]`. Live evidence: the cart reads „Dąb · **Wzór podstawowy - do zastąpienia** · Olejowanie" - an internal placeholder, headed for the immutable snapshot and the production sheet. The pick is unordered (no `orderBy`; all 13 `Design.sortOrder` are `0`) and unfiltered, so the price can differ between renders.
  - **Expected:** a deterministic, sellable, customer-legible default - or no design at all while the feature is off.
  - **Test:** T-05 - repeated snapshots give an identical default `designId` and price; the default is always inside `resolveOptions(...).designIds`.
  - **Dependencies:** SEC-03 (same change).
  - **Acceptance:** no placeholder string reaches a customer or a snapshot · defaults are byte-identical across loads · a non-sellable design can never be a default.
  - **Evidence:** `REVIEW-DETAILED.md` BUG-03 · `REVIEW-UX-UI.md` UX-02
  - **Status:** **DONE 2026-08-31**, all three parts.
    - [x] **Determinism** - `configurator.ts`'s `materials` and `designs` selects gained `orderBy [sortOrder asc, slug/code asc]`. Without an ORDER BY, Postgres promised nothing about which row `[0]` returned, and because `machiningMilliMinutesPerM2` and `surchargeGrosze` are pricing inputs, the same visible configuration could genuinely cost two different amounts on two page loads.
    - [x] **Filtered defaults** - `computeDefaultSelections` now picks through `resolveOptions`, so a deactivated material or a design never cleared for sale can no longer become the default nobody chose. Verified live: with the placeholder retired, the default moved by itself to „Gałązka oliwna".
    - [x] **The placeholder itself - resolved 2026-08-31.** Owner: "we should not have pattern selection for now - its disabled fields in the products - for now we will rather propose ready products or show product with already existing pattern." So the placeholder was **retired** (`isActive: false`) rather than renamed: it is the only design whose artwork still lives in `public/images/placeholders/` while all eleven others are real, so retiring it is precisely "show the product with an already existing pattern". Migration `20260831020000_retire_placeholder_design` + seed. Deactivated, not deleted - §16A.2's soft-delete invariant, and the row keeps the "this was a placeholder" signal. Verified live: the cart line now reads „Dąb · Gałązka oliwna · Olejowanie".

- [x] **BUG-04 · P1 · ecommerce/content - the order confirmation showed no shipping, VAT or subtotal** - **DONE 2026-09-05.**
  - **Was:** `OrderConfirmationView` exposed only `totalGrossGrosze`, so the confirmation listed item lines, a divider, then „Do zapłaty" - and the lines did not add up to the number underneath them. Verified on a real order in the development data: lines summed to **57,39 zł** against a total of **92,55 zł**, with nothing on screen explaining the 35,16 zł. For a free-delivery order the customer was never told delivery was free.
  - **Fix:** the view carries `subtotalNetGrosze`, `vatGrosze` and `shippingGrosze`; `OrderSummary` renders „Suma produktów / Dostawa / Do zapłaty" with „W tym VAT" underneath, reusing the checkout page's own labels so the document a customer pays from reads like the page they paid on. Free delivery says „Gratis" rather than nothing - silence on a payment document reads as an omission, not as a gift.
  - **One subtlety worth recording:** the subtotal shown is `subtotalNetGrosze + vatGrosze`, not `subtotalNetGrosze`. The item lines above it are gross, so showing the net figure there would produce a column that still does not reconcile. VAT is stated underneath instead of added as a third line, because it is already inside both numbers.
  - **Evidence:** `tests/integration/order-confirmation-totals.test.ts` (3, written first) asserts Σ item lines + shipping === `totalGrossGrosze` at the boundary the page actually reads - T-06. Browser-verified on two real historical orders: one with paid delivery (57,39 + 35,16 = 92,55) and one with free delivery („Gratis").
  - **Status:** DONE

- [ ] **BUG-05 · P1 · ecommerce/concurrency - "Duplikuj" reintroduces the P0-3 lost update**
  - **Files:** `src/server/operations/cart.ts:385-398`
  - **Current:** `findUnique` then `update({ quantity: q + 1 })` - the exact shape `AUDIT-2026-08-30.md` P0-3 fixed in the sibling function in the same commit. Two rapid clicks give one increment.
  - **Expected:** `updateMany({ where: { id, quantity: { lt: MAX } }, data: { quantity: { increment: 1 } } })`, matching `applyAdjustCartItemQuantity`.
  - **Test:** T-07 - two **concurrent** calls → quantity 3. (`cart-operations.test.ts:378` is sequential and passes either way.)
  - **Evidence:** `REVIEW-DETAILED.md` BUG-05
  - **Status:** TODO

- [x] **BUG-06 · P1 · correctness/validation - Four step-machine guards are written, tested, and never called** - **DONE 2026-08-31.**
  - **Files:** `src/domain/configuration/steps.ts`, `src/server/configurator/validate-and-price.ts`, `src/ui/islands/configurator/Configurator.tsx`, `src/app/(shop)/produkt/[slug]/page.tsx`
  - **Was:** `checkStepAppliesToProductType`, `checkStepEntry`, `isStepEnterable`, `furthestEnterableStepIndex` had 30 passing assertions and **zero production call sites**. So `personalizationText` was accepted, stored, displayed and snapshotted for products with no `PersonalizationSpec` - with **no length limit and no validation of any kind**; `thicknessMm` persisted for WALL_ART; `installationVariant` for non-KITCHEN_TILE.
  - **Now:** `findSelectionOutsideProductType` wraps `checkStepAppliesToProductType`, and `priceAndValidateSelections` calls it - so the older assertions finally guard something reachable. It takes the **product type's** steps, not `applicableSteps`' narrowed list: those are different questions, and conflating them would turn `OPTION_UNAVAILABLE` (actionable for a customer on a stale link) into a generic invalid-configuration error.
  - **A regression this created, caught before shipping:** `computeDefaultSelections` filled `finishId` for every product, and JEWELRY has no FINISH step - so the bracelet's default carried a finish the type forbids, and would have priced fine and then refused at "Dodaj do koszyka". Defaults are now step-aware and exported so a test can assert it. The bracelet's default price moved 57,54 → **57,39 zł**, and now agrees with the advertised „od 55,69 zł", which had always excluded the finish.
  - **Doc conflict resolved:** `docs/CHECKLIST.md:81` now says which guards are enforced and which remain uncalled - `isStepEnterable`/`checkStepEntry`/`furthestEnterableStepIndex` stay uncalled because the configurator lets a customer move freely between steps by design; forcing sequential entry would be an unasked-for behaviour change.
  - **Verified live** on a production build: the bracelet configures, prices at 57,39 zł, and adds to the cart as „Dąb · Gałązka oliwna" with no finish.
  - **Tests:** T-10 `tests/integration/step-and-input-validation.test.ts` (18, shared with BUG-07) · `tests/unit/configuration-input.test.ts` (40) · `tests/unit/configurator-defaults.test.ts` (11).
  - **Evidence:** `REVIEW-DETAILED.md` BUG-06
  - **Status:** DONE

- [x] **BUG-07 · P1 · validation/dependencies - `zod` is declared and imported nowhere** - **DONE 2026-08-31.**
  - **Files:** `src/domain/configuration/input-schema.ts` (new), `src/domain/feasibility/rules.ts`, `src/server/configurator/validate-and-price.ts`, `src/server/operations/cart.ts`, `src/server/actions/configurator.ts`
  - **Was:** zero `from 'zod'` matches while §2 named it the validation layer. `addToCart`'s `selections` and `acknowledgedWarnings` had no shape validation, no element count and no length cap; arbitrary strings could be written into `Configuration.acknowledgedWarnings`.
  - **Decision: use zod, not drop it** - §2 already said so. One module, `domain/configuration/input-schema.ts`. `FeasibilityCode` is now **derived from** a `FEASIBILITY_CODES` array instead of declared as a union, so the allow-list and the type cannot drift apart.
  - **Parsed at the choke point:** `priceAndValidateSelections` (add-to-cart, cart edit, checkout re-pricing) and `getConfiguratorSnapshot`; `acknowledgedWarnings` in both cart operations. `priceAndValidateSelections` now **returns the parsed selections**, so a caller cannot keep using the raw object by accident.
  - **The predicted 500 was real:** the pre-fix run of the new tests produced `TypeError: selections.personalizationText.trim is not a function` out of `cartItemSignature`.
  - **Tests:** T-11 - the same three files as BUG-06. Every integration rejection also asserts **no `Configuration` row was written**; a check placed after the insert would pass a naive "returns ok:false" test while having stored the row.
  - **Evidence:** `REVIEW-DETAILED.md` BUG-07
  - **Status:** DONE

### Admin

- [x] **ADMIN-01 · P1 · admin/scalability - Order, customer and audit lists truncated silently** - **DONE 2026-09-05.**
  - **Was:** `take: 100` / `take: 200` with client-side `DataGrid` paging, no cursor, no total, and **nothing on screen saying a subset was being shown**. That last part is what made it a bug rather than a limit: the development database now holds **259 orders**, so 159 were unreachable and the screen looked entirely normal. The audit log - §16A.2's record of who changed what - forgot everything past its 200th entry, which is not a record.
  - **Fix:** server-side pagination on all three. The page lives in the URL (`?page=&perPage=`), so it survives a reload, is shareable, and pages *with* the filters above the grid rather than losing them. `findMany` and `count` go out in one `Promise.all` off a single shared `where` - a count built from a separately-written filter is how a list ends up offering six pages of a one-row result. Every page carries „Pokazano 1-25 z 259".
  - **`parsePagination` is a domain function**, tested on its own, because every value in it arrives in a URL: `?perPage=100000` and `?page=-1` reach the database as readily as `2` does. Page size is capped at 100 and the skip is bounded, so `?page=999999999` cannot make Postgres walk an index for nothing.
  - **Two real bugs found while doing it**, both in `admin-production.ts`, both the same shape: `snapshot.moduleLayout.totalModules` and `snapshot.moduleLayout.modules` were read unguarded. `OrderItem.snapshot` is `Json` and deliberately immutable, so an order placed before that field existed genuinely lacks it - **one such row threw while the queue was being built and took down the whole production page**, and the order detail page with it. The two functions beside them already guarded for exactly this and said so in their comments; `moduleLayout` was the one left out. Found because a parallel test file wrote such an order, which is the shared-database contention working in our favour for once.
  - **Not done, and deliberately:** sorting stays client-side and therefore within the current page. Server-side sort means a validated mapping from every sortable column to a Prisma `orderBy`, and these lists are newest-first, which is the order staff actually want. Recorded rather than hidden.
  - **Evidence:** `tests/unit/pagination.test.ts` (18) · `tests/integration/admin-pagination.test.ts` (7, including T-08's "150 seeded orders, page 2 returns 101-150, total === 150" and a sweep proving **no row is unreachable**) · two regression tests for the `moduleLayout` crash · `tests/e2e/admin-pagination.spec.ts` reaches row 101+ through the grid's own next-page control. Browser-verified against the real dev database: orders **251-259 of 259**, customers **351-375 of 379**, audit **1-25 of 188** with a working pager. **1106 → 1133 unit/integration.**
  - **Status:** DONE

- [x] **SEC-04 · P1 · security/authorization - `STAFF` can change the bank account and irreversibly anonymize customers** - **DONE 2026-08-31.**
  - **Files:** `src/server/operations/admin-only.ts` (new), `admin-store-settings.ts`, `admin-customers.ts`, `admin-email-templates.ts`, `panel/ustawienia/**`, `panel/klienci/[id]/page.tsx`, `AdminSidebarNav.tsx`, `panel/layout.tsx`
  - **Was:** of 25 admin operations modules, only `admin-pricing`, `admin-staff` and `admin-analytics` required ADMIN. `STAFF` could rewrite `StoreSettings.bankAccountNumber` (the account every bank-transfer customer pays into), permanently anonymize a customer and delete their sign-in ability, and rewrite customer-facing email bodies including the OTP mail.
  - **Now: the gate is asserted twice, deliberately.** `requireAdminSession()` in the wrapper is what a real request meets - but it reads `next/headers` and therefore **cannot be reached by any test in this repository**, and a rule that lives only where no test can reach it is the exact shape of SEC-03. So each `apply*` also calls `refuseUnlessAdmin(actor)` as its **first statement**, which is both defense in depth and the only version a test can drive. A separate test asserts the guard precedes the first Prisma call: a check that runs after the write returns a refusal to a caller whose bank account has already been changed.
  - **The UI half, which the audit did not name.** Enforcement alone would leave a `STAFF` looking at a form whose submit 404s - the shape the owner ruled out ("there shouldn't be cases where we allow something but its blocked by system"). `/panel/ustawienia` and both `szablony` pages are now `requireAdminSession()`; the customer page **stays STAFF-visible** (§16.3 gives `STAFF` customers *read*) with the form replaced by „Anonimizację konta może wykonać tylko administrator."; `AdminSidebarNav` gained `adminOnly` and the layout passes the role - which also fixes a **pre-existing** bug, since `/panel/ceny` and `/panel/ustawienia/personel` were already ADMIN-gated pages the nav offered to every STAFF account.
  - **Verified live** on a production build by temporarily demoting the panel account to `STAFF` and restoring it: sidebar 23 entries → **21**, `/panel/ustawienia` → „Nie znaleziono takiej strony" (404, not 403), customer page read-only with the notice; ADMIN unchanged.
  - **Tests:** T-09 `tests/integration/admin-authorization.test.ts` (10) - all three `apply*` × {STAFF, CUSTOMER, ADMIN}, and every refusal asserts **nothing changed** plus no audit row written. T-21 `tests/unit/admin-only-operations.test.ts` (14) covers the wrapper half mechanically, **per function** rather than per file, because `admin-pricing.ts` correctly holds both gates (`simulatePricingDraft` is a read, and reads are STAFF).
  - **Three existing tests updated:** `admin-store-settings`, `admin-customers` and `admin-email-templates` each built a `STAFF` actor; now `ADMIN`, with the reversal recorded in each rather than quietly swapped.
  - **Not done, and deliberately:** a second confirmation on the bank-account field. It is a UX hardening rather than part of closing the hole, and the field already sits behind an ADMIN-only page. Left as UX-22.
  - **Evidence:** `REVIEW-DETAILED.md` SEC-04
  - **Status:** DONE

- [x] **SEC-10 · P1 · security/compliance - opening a customer's page silently performed a RODO export** - **NEW, found and fixed 2026-08-31.**
  - **Files:** `src/app/(admin)/panel/klienci/[id]/eksport/route.ts`, `src/app/(admin)/panel/klienci/[id]/page.tsx`
  - **Found** while verifying SEC-04 in a real browser: the customer page's activity timeline showed an „Eksport" entry nobody had triggered.
  - **Confirmed twice** - the network log showed `GET /panel/klienci/<id>/eksport?_rsc=… → 200`, and the database showed a matching `AuditLog` row (`action: 'export'`) attributed to the staff member who had only looked at the page.
  - **Cause:** the export is a GET route handler **with a side effect** (it builds the full RODO Art. 15 export and writes an audit row), and the page linked to it with `next/link`, which Next prefetches.
  - **Why it matters:** §16A.2 invariant 4 makes the audit log the record of what happened. It was recording RODO exports nobody performed, against named staff - a compliance record that reports accesses which never occurred is worse than none, because it will be believed. Every page view also serialised that customer's complete personal data into a response nobody read.
  - **Fixed in two layers:** the link is a plain `<a>` (the convention `/api/plik/[fileId]` already followed, so this link was the odd one out), and the route refuses `next-router-prefetch` / `purpose: prefetch` **before** the session read.
  - **Verified after the fix** on a production build: the same page view produced no request to the export route and left the export-row count unchanged at 6.
  - **Test:** T-22 `tests/unit/customer-export-route.test.ts` (4).
  - **Rule worth carrying forward:** a GET route handler with a side effect must never be reachable from a `<Link>`. Nothing else in the codebase currently has one.
  - **Evidence:** `REVIEW-DETAILED.md` SEC-10
  - **Status:** DONE

- [x] **SEC-05 · P1 · security - No security headers and no CSP anywhere** - **DONE 2026-08-31.**
  - **Files:** `src/server/security/headers.ts` (new, pure), `next.config.ts`, `src/proxy.ts`, `src/app/api/plik/[fileId]/route.ts`, `.env.example`
  - **Was:** zero matches for CSP, `X-Frame-Options`, `X-Content-Type-Options`, HSTS, `Referrer-Policy`, `Permissions-Policy` across the whole repository. §16.1 requires "Security headers + strict CSP". The SVG-as-attachment half of that sentence **was** implemented; the headers half was never built and was **not recorded** in `CHECKLIST.md` or `OPEN_ITEMS.md`.
  - **Now:** five static headers from `next.config.ts` (`nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, `Permissions-Policy`, HSTS in production only) plus `poweredByHeader: false`; a **nonce-based CSP** per request from `proxy.ts`, whose matcher was split so the `/panel` redirect keeps matching prefetches while the CSP entry skips them.
  - **`script-src` is strict** - `'nonce-…' 'strict-dynamic'`, never `'unsafe-inline'`; `'unsafe-eval'` in development only, `upgrade-insecure-requests` in production only. **`style-src` keeps `'unsafe-inline'`** and this is deliberate: Emotion injects styles from the browser and `ThemeRegistry` is mounted from `error.tsx` boundaries, which React renders with no props of ours, so no nonce can reach them - and a nonce in `style-src` would make browsers *ignore* `'unsafe-inline'` and break every client-side style. Reasoning recorded in the module and pinned by a test.
  - **`CSP_MODE`** (`enforce` default · `report-only` · `off`) documented in `.env.example`; an unrecognised value enforces rather than silently disabling.
  - **Verified:** all six headers on a real production response (`next build && next start`, checked with curl); the enforced policy carried through home / product / cart / checkout / `/panel` / `/panel/zamowienia` in a real browser with **zero console messages**, including the MUI Menu popover, the `@mui/x-charts` line chart and a Server Action re-pricing a material change (57,54 → 57,32 zł); `nosniff` confirmed on a real 200 response from `/api/plik/[fileId]`.
  - **Tests:** T-17 `tests/unit/security-headers.test.ts` (24) · T-18 `tests/unit/proxy.test.ts` (7, all three `CSP_MODE` values through the real proxy, plus the `/panel` gate) · T-19 `tests/e2e/security-headers.spec.ts` (10).
  - **Consequence for PERF-01 - read before starting it:** Next reads the nonce from the *request* CSP header at render time, so a prerendered page would ship a stale nonce. **A nonce-based CSP and static/ISR/PPR are mutually exclusive.** Every storefront route is dynamic today so this costs nothing now, but PERF-01 must pick one: keep the nonce and accept dynamic rendering, or move to Next's experimental `sri` (hash-based, static-compatible). Recorded again under PERF-01.
  - **Evidence:** `REVIEW-DETAILED.md` SEC-05
  - **Status:** DONE

### Performance

- [ ] **PERF-01 · P1 · performance/architecture - Not one page is prerendered**
  - **Files:** `src/ui/layout/StorefrontChrome.tsx`, `next.config.ts`, all catalogue pages
  - **Current (measured from `npm run build`):** **91 dynamic routes, 2 static** (`robots.txt`, `sitemap.xml`). `StorefrontChrome` calls `getSession()`/`cookies()` on every storefront page, forcing every route beneath both group layouts dynamic. Zero matches for `React.cache`, `unstable_cache`, `'use cache'`, `revalidate`, `dynamic`, `cacheComponents`. §18 claims "catalogue pages are RSC + ISR".
  - **Expected, in order:** (1) `'use cache'`/`unstable_cache` + tag on `listActiveCategories`/`listActiveCollections`, revalidated from the admin operations that already call `revalidatePath`; (2) `<Suspense>` around the cart badge / account name / consent banner, then `cacheComponents: true` (Next 16 - this also enables PPR by default); (3) catalogue pages become static/ISR and `generateStaticParams` starts paying off.
  - **Dependencies:** read `node_modules/next/dist/docs/01-app/02-guides/migrating-to-cache-components.md` first - it changes navigation behaviour via React `<Activity>`, which affects the configurator's mount.
  - **Step 1 attempted and backed out, 2026-09-04.** `unstable_cache` + `cacheTag` + `revalidateTag` from all seven writers was built, with a mechanical guard and an end-to-end test, then removed. The caching half works - a category inserted straight into the database stayed invisible until the TTL elapsed - but the **invalidation half was never demonstrated**, and Next 16's `revalidateTag` docs cover `fetch` and `use cache` without mentioning `unstable_cache`. A cross-request cache with unproven invalidation means an admin edit silently taking minutes to appear, so it waits for the `cacheComponents` decision below, which replaces the API anyway. Detail in `REVIEW-PERFORMANCE.md` Finding 1. Also note `revalidateTag` gained a required second argument in Next 16.
  - **Dependency added 2026-08-31 by SEC-05 - resolve this before writing any code:** the CSP now issues a per-request nonce from `src/proxy.ts`, and Next stamps it onto its script tags by reading the *request* header at render time. A statically generated page has a stale nonce baked into its HTML, so **step (3) of the plan above is incompatible with the CSP as it stands**, and Next's own CSP guide says PPR is too. Two ways out, and it is a real trade: (a) keep the nonce, accept that catalogue pages stay dynamic, and take the win from step (1) alone (`'use cache'` on the two catalogue queries still removes most of the per-request round trips); (b) switch `script-src` to Next's experimental `experimental.sri` hash path, which is static-compatible but experimental and App-Router-only. Do **not** quietly weaken `script-src` to `'unsafe-inline'` to unblock this - that trades the whole of SEC-05 for a caching win and must be the owner's decision, not an implementation detail.
  - **Acceptance:** `/`, `/[category]`, `/produkt/[slug]` are no longer plain `ƒ` in the build output · the cart badge still updates immediately after a mutation · no visitor ever sees another's cached name or cart · Lighthouse mobile before/after recorded in `REVIEW-PERFORMANCE.md`.
  - **Evidence:** `REVIEW-PERFORMANCE.md` Finding 1
  - **Status:** TODO

- [x] **PERF-02 · P1 · performance - Every `generateMetadata` route queries the same row twice** - **DONE 2026-09-04**, together with PERF-05.
  - **Files:** the five `get*BySlug` repository functions, plus `src/server/auth/session.ts`
  - **Was:** each of the five `generateMetadata` pages called its repository function twice per request; Next dedupes `fetch`, not Prisma. `getSession()` was called two to four times per render, each one a real Better Auth session read, and `React.cache` appeared nowhere in the repository.
  - **Now:** `cache()` from React on all six. Request-scoped, so there is no staleness to reason about at all - the memo dies with the request.
  - **Measured on a production build**, by putting Postgres into `log_statement='all'` and counting `LOG:  execute` lines for one request per route: **`/produkt/[slug]` 36 → 26**, **`/` 14 → 11**, **`/[category]` 14 → 11**. On the product page `Product` went 3 → 2 and `Category` 4 → 1.
  - **Method note for whoever measures next:** `DEBUG=prisma:query` produces nothing under Prisma 7's driver adapter. Postgres-side statement logging is the way, and it needs no code change.
  - **Evidence:** `REVIEW-DETAILED.md` PERF-02
  - **Status:** DONE

---

## P2 - Medium

### Ecommerce / correctness

- [ ] **BUG-08 · P2 · ecommerce** - free-shipping threshold compares **gross** against a field the schema documents as **net**, so it triggers ~23% early. Observed: all four methods showed „0,00 zł" on a 709,16 zł cart whose real InPost tier is 51,61 zł. Fix the mismatch (code, schema comment and admin label must agree); whether a flat 500 zł threshold is right at all is an **owner decision**. `domain/checkout/delivery.ts`.
- [ ] **BUG-13 · P2 · ecommerce/concurrency** - a quantity changed in another tab between the cart read and the transaction is charged at the **old** value; `createOrder` claims rows by id only. Widen the claim predicate to include the priced quantity and reuse `CART_CHANGED`.
- [x] **BUG-19 · P2 · ecommerce - the order snapshot omitted fields §6.8 requires** - **DONE 2026-09-05.**
  - **Added:** `productSlug`, `materialFamilyCode`, `productionDaysMin`/`Max` (§6.8's own list), `materialNotesPl` (§12 requires the confirmation to render it) and the installation variant's `namePl`/`receivesPl` (§6.5: the „Co otrzymujesz" line goes into the snapshot). Only the bare enum code was stored before, so showing it in Polish meant either a live catalogue lookup - the one thing a snapshot exists to prevent - or printing `ON_TOP` at a customer.
  - **Typed optional, not nullable, and the distinction is the point.** Every order placed before today has these keys genuinely absent, so `undefined` is the truth and `| null` would be a claim the data does not support. `machiningMilliMinutesPerM2` is typed `| null` and is really `undefined` on old rows - which is exactly how ADMIN-01 found `admin-production.ts` crashing on `moduleLayout.totalModules` and taking down the production queue. Optional forces every reader to handle the absence.
  - **No extra queries:** all six values come from the data the checkout already fetched and validated the price against. `ProductRow` was deliberately not widened - it is the pricing subset, and these are not pricing inputs.
  - **Evidence:** six cases in `tests/integration/create-order.test.ts`, written first and driven through the real `createOrder` rather than by hand-writing a snapshot, including one asserting that a variant the product does not offer stays null rather than becoming an invented label.
  - **Status:** DONE

- [ ] **BUG-20 · P2 · ecommerce** - `applyMarkOrderPaid` writes an `AuditLog` but no `OrderEvent`, so payment never appears in the order timeline.
- [ ] **BUG-21 · P2 · ecommerce** - editing line B into line A's configuration merges the cart lines but leaves a duplicate `Configuration`, hidden by the read-side dedupe in `listConfigurationsForUser`. Delete the redundant row in the merge branch.
- [ ] **BUG-11 · P2 · uploads** - §13.1's DPI and aspect-mismatch warnings can never fire: both call sites pass `target: null`, so `autoWarnings` is always `[]` and the review queue shows staff an empty list that reads as "checked and fine". Re-inspect at add-to-cart when the size is known; meanwhile say "not yet assessed".
- [ ] **BUG-15 · P2 · uploads** - re-uploading a design orphans the previous `UploadedFile` row and its blobs forever, and leaves the superseded file fetchable. Decide: keep as a visible review history, or delete in the same transaction. Today it is neither.
- [ ] **BUG-23 · P2 · orders** - order numbers use server-local time (`getFullYear`/`getMonth`), so a UTC server files a 01:30 Europe/Warsaw order under the previous month. Format explicitly in `Europe/Warsaw`.

### Security

- [ ] **SEC-06 · P2** - runtime writes into `public/`: no size cap (customer uploads have one), `ownerId` interpolated into a path with no `..` guard while the sibling `deletePublicImage` does guard, and the approach silently fails on the Vercel target §3 names. `src/server/storage/public-images.ts`.
- [ ] **SEC-07 · P2** - RODO anonymization leaves email, full name, phone and address on every `Order` and `SupportRequest`. Retention may be lawful; the gap is that the module presents the scrub as complete, nothing bounds retention and no purge path exists. **Needs an owner decision on the retention window.**
- [ ] **SEC-08 · P2** - the upload rate limit resets when the guest discards the cookie. Nearly free once SEC-01's IP-aware limiter exists.
- [ ] **SEC-09 · P2** - `/api/plik/[fileId]` buffers whole files (up to 25 MB) into memory; §16.1 says it streams. Add `getStream` to `FileStorage`, and `nosniff` here.
- [ ] **BUG-17 · P2** - `robots.ts` allows crawling `/panel`, `/moje-konto`, `/koszyk` and bearer-token order URLs; only `/szukaj` sets `noindex`. Add `disallow` + per-route `robots` metadata.
- [ ] **BUG-22 · P2** - the order `accessToken` travels in the query string (history, `Referer`, access logs). The comparison is correct; mitigate the transport with `Referrer-Policy` + `noindex`, or exchange it for a short-lived cookie.
- [ ] **BUG-18 · P2 · deployment** - `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` is neither set nor documented. Bound-closure actions are used pervasively (`.bind(null, cartItemId)`); without a stable shared key, multi-instance or rolling deployments break cart buttons intermittently. Also document `serverActions.allowedOrigins` for proxy deployments.
- [ ] **BUG-12 · P2 · reliability** - post-response work uses `void promise` rather than Next 16's `after()`. On serverless, order confirmation emails and analytics writes are killed mid-flight. `create-order.ts`, `admin-orders.ts`, `operations/cart.ts`, several pages.

### UX / UI

- [ ] **UX-04 / BUG-10 · P2** - no mobile navigation menu. Measured: 149.56 px header across three wrapped rows, plus a 68 px search band ≈ 27% of a 375 px viewport, on every page. Add a `Drawer` below `md`; fold search into an icon.
- [ ] **UX-05 / BUG-09 · P2** - "Duplikuj" still says and looks like "duplicate" after becoming "+1", duplicating the adjacent stepper. Remove it, or relabel to „Dodaj kolejną sztukę" with a `+` icon.
- [ ] **UX-06 · P2** - the three most likely 404s (`[category]`, `produkt/[slug]`, `blog/[slug]`) render a heading plus the literal „404" with no links. The good `NotFoundContent` (with checked escape routes) exists and is wired only to the generic boundaries. Also give each a real `<title>`.
- [ ] **UX-07 · P2** - „Odbiór osobisty" announces „Darmowa dostawa"; there is no shipping to be free of.
- [ ] **UX-08 / BUG-14 · P2** - switching delivery carrier leaves a stale pickup point, the submit button stays enabled, and the order is rejected server-side with no explanation.
- [ ] **UX-09 · P2** - all four delivery methods show identical „0,00 zł"; per-method delivery estimates would make the choice meaningful. (Paired with BUG-08.)
- [ ] **UX-10 · P2 · accessibility** - nav tap targets are **22 px** (dropdown items 38 px) against WCAG 2.5.8's 24 px. Solved for free by UX-04.
- [ ] **UX-11 · P2** - removing a cart item is instant and irreversible, ~8 px from "Duplikuj" on mobile. Add a „Cofnij" snackbar (§16A.5's own pattern).
- [ ] **UX-13 · P2** - the cart never shows a line's feasibility warnings or its `customDesignStatus`, so a line that will hold the whole order in `DESIGN_REVIEW` looks ordinary. The data is already on `CartItemView`.
- [ ] **UX-14 · P2** - the search band costs a fixed 68 px on every route including cart, checkout and account.
- [ ] **UX-15 · P2** - `loading.tsx` renders the literal „Ładowanie…" rather than a `Skeleton`; the cart empty state is one muted line.
- [ ] **UX-12 · P2 · content** - every product is named „… z grawerem" and the homepage promises „Twój wzór", but pattern selection is off and `/wzory` 404s. Product copy should describe what is actually purchasable. **Owner's call on wording.**

### Performance / architecture / process

- [x] **ARCH-01 · P2 · process - there is no CI** - **DONE 2026-08-31.**
  - **Files:** `.github/workflows/ci.yml` (new), `scripts/seed-test-db.mjs` (new), `playwright.config.ts`, `package.json`
  - **Was:** no `.github/workflows`, no hooks; `playwright.config.ts` read `process.env.CI` and nothing set it.
  - **Now:** two jobs. **`verify`** (`npm ci` → create both databases from `docker/postgres-init/01-databases.sql` → `db:deploy` ×2 → `db:seed` ×2 → typecheck → lint → test → build) and **`e2e`** (`needs: verify`, Chromium + WebKit, Playwright report uploaded as an artifact). Separate on purpose: the e2e suite has a documented parallel-contention flake and must not be able to hide a real failure in `verify`.
  - **Both databases are seeded** - not incidental. `offered-is-buildable` and `starting-price` sweep the *seeded catalogue*, so on an empty database they iterate nothing and **pass vacuously**. New `npm run db:seed:test` mirrors the existing `db:deploy:test`.
  - **Verified as far as is possible locally:** the whole CI sequence was reproduced against a throwaway virgin database - `migrate deploy` applied **all 27 migrations from zero**, `db seed` filled it from empty, `npm test` gave **931/931** against it, and `npm run build` generated its 81 static pages. Then dropped. This mattered: the four migrations added earlier the same day had only ever been applied incrementally by `migrate dev` and had never been proven to apply from scratch.
  - **Not verified - say so:** the workflow **has never executed on GitHub**, which cannot be done from here. `actions/setup-node` caching, the service-container port mapping, `psql` on the runner image and `playwright install --with-deps` are conventional but unproven. Expect the first run to need a small correction.
  - **Test:** T-20 `tests/unit/ci-workflow.test.ts` (12) - parses the YAML and pins the two failure modes that produce a *green* run rather than a red one: a step calling an npm script that no longer exists, and `npm test` running without `TEST_DATABASE_URL` (which `env-setup.ts` deliberately does not throw on, so the whole integration tier would silently run against `DATABASE_URL` and still report success).
  - **Also changed:** `workers: process.env.CI ? 1 : undefined` in `playwright.config.ts`. The documented flake is contention over one shared database; this is that diagnosis applied, **not a measured fix**. Raise it after a few green runs. The real repair is ARCH-03.
  - **Evidence:** `REVIEW-DETAILED.md` ARCH-01
  - **Status:** DONE
- [x] **CI-01 · P1 · tooling - the first CI run that ever executed failed on its first database step** - **DONE 2026-09-05.**
  - **Was:** `psql "$DATABASE_URL" -f docker/postgres-init/01-databases.sql`. `DATABASE_URL` ends in `?schema=public`, which is **Prisma's** parameter; libpq parses a connection URI strictly and rejects anything it does not recognise, so the step died with `psql: error: invalid URI query parameter: "schema"` and every step after it was skipped. Both jobs had the same line, so both were dead.
  - **Why nothing caught it:** locally that SQL is applied by the Postgres container's own init directory on first boot, never by this command. The line had therefore never executed anywhere until GitHub ran it - exactly the failure mode `ci-workflow.test.ts`'s own header describes as the reason that file exists.
  - **Fix:** explicit `psql -h 127.0.0.1 -p 5433 -U cnc -d cnc_selling` flags instead of the Prisma URL, in both jobs, plus a `ci-workflow.test.ts` case that fails if a `psql` line is ever handed `$DATABASE_URL`/`$TEST_DATABASE_URL` again.
  - **Verified by reproducing the whole pipeline locally against virgin databases** - the only way to check a workflow without pushing. Two throwaway databases created with the real init script, then every step of both jobs in order: `db:deploy` ×2, `db:seed` ×2, typecheck, lint, **1145 tests**, build, and the **full e2e suite at 74/74** against a database seeded from zero. Both the failing and the fixed `psql` forms were run against a real Postgres first, so the guard test is known to guard something real.
  - **Status:** DONE
- [x] **T-26 · P2 · tests - six copies of `fillReliably`, and the flake that kept moving between them** - **DONE 2026-09-05.**
  - Six specs each held a near-identical private copy with the same 10s budget, so raising it meant editing six files - and the contention flake kept resurfacing in whichever one had not been touched. Three full-suite runs were lost to it on 2026-09-05 alone, each in a different file (`accounts`, `stale-configuration-link`, `admin-authz`).
  - **Extracted to `tests/e2e/fill-reliably.ts`** with a 30s budget. A **deadline, not a cost**: a field that fills first time returns immediately, so a longer deadline costs nothing but how long a genuinely stuck field waits. What it buys is that `mobile-safari` typing 45 characters into a React-controlled input, while three other workers hammer the same Next process, stops reporting "the machine was busy" as a test failure. `vitest.config.ts` raised its own timeout for the same reason and says so in the same words.
  - **The real repair is still fewer workers per server**, which CI already does with `workers: 1`. This makes the local suite honest in the meantime.
  - **Evidence:** two consecutive full runs at **74/74**.
  - **Status:** DONE
- [x] **ARCH-02 · P2 · architecture - `Configurator.tsx` was the largest file in the repository** - **PARTIALLY DONE 2026-09-05.**
  - **1 632 → 1 252 lines.** Four seams extracted verbatim: `selections.ts` (the pure helpers), `StickyPriceBar.tsx`, `SizeFields.tsx`, `CustomUploadStep.tsx`. Same bodies, same props, same behaviour - the state model stays exactly where it was, which is what the item asks.
  - **The pure extraction was the point, not the line count.** `computeDefaultSelections` was exported from a `'use client'` module purely so a unit test could reach it, and Next treats every export of such a file as a client reference - so a client component was part of the test surface. In `selections.ts` these are plain functions.
  - **New tests for what the move exposed.** `mergeWithDefaults` encodes a rule nothing else stated: five fields (`thicknessMm`, `installationVariant`, `personalizationText`, `fontId`, `customUploadId`) are taken from the URL and **never** defaulted, because guessing a thickness can contradict an installation variant, and inventing personalization text is authorship rather than a default. Reversing that looks like a tidy-up, which is why it is now a test rather than a comment.
  - **Still to do:** `SummaryStep` (189 lines), `ConfigSection`, `OptionStep`, the three menu-item components and the crumb link. The same mechanical move; stopped here because the four largest seams are out and every further one is smaller than the last.
  - **One process note worth keeping.** `biome check --write` was used first and reformatted the whole file - 253 insertions where the refactor needed 4. Formatting is not enforced by `npm run lint` here (`biome format` is a separate script nothing runs), so that would have buried a pure extraction in unrelated churn. Reset and redone with targeted edits: the final diff is **6 insertions, 386 deletions**.
  - **Evidence:** `tests/unit/configurator-selections.test.ts` (8, written first) · `configurator-defaults.test.ts` repointed at the new module, unchanged otherwise · **1164 unit/integration, e2e 74/74**, and the configurator browser-checked on both a catalogue product and the custom-upload product.
  - **Status:** PARTIALLY DONE
- [x] **ARCH-03 · P2 · tests - e2e ran against the development database** - **DONE 2026-09-05.**
  - **Was:** `playwright.config.ts` started the app with `npm run start` and nothing overrode `DATABASE_URL`, so every local run wrote real rows into the data the owner also browses. That database had reached **284 orders and 778 users** by the time this was fixed, plus a leftover `test-e2e-wzor` design.
  - **Fix:** the override lives in `playwright.config.ts` itself, not in `globalSetup` - Playwright loads the config in every worker process, and each worker's specs import `src/server/db/client` for themselves, which a global setup running in its own process could never reach. `webServer.env` hands the same value to `next start`; `process.env` beats `.env` in Next's own load order, verified in `node_modules/next/dist/docs`.
  - **A guard, because several specs delete rows.** `tests/e2e/global-setup.ts` refuses to start unless the database name ends in `_test`, and prints which database it found. Deliberately not a substring match - „latest" ends in those four letters, and a guard that accepted `contest_live` would be worse than none because it would look like protection. The failure being guarded against is mundane: an unset `TEST_DATABASE_URL` means the override silently does nothing and the suite starts deleting real rows while looking entirely normal.
  - **`npm run db:reset`** drops, migrates and seeds the test database. Seeding is its own step: **`prisma migrate reset` does not run the seed under Prisma 7.9.1** - `--skip-seed` is rejected as an unknown option and the help text no longer mentions seeding. Measured, not assumed: the first run left a schema with zero products.
  - **It immediately found a real bug: the seed could not run on an empty database.** `seedProducts` still looked up `categories.inne`, a slug the 2026-09-04 loft/custom-order change renamed to `zamowienie-wlasne`, so `npm run db:seed` threw "seedCategories must run before seedProducts" from zero. **CI would have hit this too** - its `verify` job seeds a virgin database. Nothing caught it before because every existing database already had the products, and an upsert over an existing row never reaches the lookup that failed.
  - **CI's e2e job now prepares the test database** (`db:deploy:test` / `db:seed:test`), pinned by a new `ci-workflow.test.ts` case - reverting it would fail in a way that reads like a broken application rather than a wrongly-prepared database.
  - **Honest about what it did not fix.** ARCH-03 was recorded as the repair for the `mobile-safari` contention flake. It is not: the contention is four browsers sharing one Next server, not the database. That was addressed separately, and properly - `accounts.spec.ts`'s two journeys got `test.slow()`, because they were running out of the 30s default at the *last* step having already done all the work, which is a genuinely long journey rather than a hang. Same remedy as `design-review-customer.spec.ts`.
  - **Evidence:** `tests/unit/e2e-database-guard.test.ts` (10, written first) · the suite prints „e2e: using cnc_selling_test on 127.0.0.1:5433" on every run · **two consecutive full runs at 74/74**, nothing skipped, after a `db:reset` to a clean database. **1133 → 1144 unit/integration.**
  - **Status:** DONE
- [ ] **PERF-03 · P2** - 22 of 25 admin repositories use unbounded `findMany` and serialize whole tables into the RSC payload. `/panel/kontakt` and `/panel/produkcja` grow fastest. Reuse ADMIN-01's pagination helper as they grow; do not pre-optimise all 22.
- [ ] **PERF-04 · P2** - three Turbopack over-bundling warnings from `public-images.ts` (dynamic `path.join` matching 93 016 / 33 848 / 16 924 files). Build a literal path map instead of interpolating.
- [x] **SEC-11 · P1 · security headers - `upgrade-insecure-requests` broke the whole site in Safari over http** - **DONE 2026-09-04.** Introduced by SEC-05, found while browser-verifying UX-21.
  - **Was:** the directive was gated on `isDev`. A **production build served over plain http** - a staging box, a LAN preview, a container behind a TLS-terminating proxy, and this repo's own e2e suite - therefore emitted it, and every script, stylesheet and font was upgraded to an origin with no TLS listener. The page rendered as unstyled server HTML with no client JavaScript, one `SSL connect error` per asset.
  - **Why it hid for four days:** Chromium exempts loopback from the upgrade, WebKit does not. Every SEC-05 verification was Chromium - including `security-headers.spec.ts`'s "hydrates and runs a Server Action under the enforced policy", the spec written to catch exactly this, which was failing on `mobile-safari` inside a suite already red for other reasons.
  - **Fix:** the condition is a property of the request, not the build. `isSecureRequest({ protocol, forwardedProto })` reads `request.nextUrl.protocol` and falls back to `x-forwarded-proto`; `buildContentSecurityPolicy` now takes a **required** `isSecure` - required, because a caller that forgets it is how this happened once.
  - **Evidence:** full e2e suite, both projects, from this one change: **20 failed / 34 passed → 13 failed / 43 passed**, the eight recovered specs being exactly those needing client JS. Unit coverage in `security-headers.test.ts` and `proxy.test.ts`.
  - **Status:** DONE
- [x] **T-23 · P1 · tests - the e2e suite could never have been green** - **DONE 2026-09-04.** Four independent problems that SEC-11 had been hiding.
  - **Registrations exceeded SEC-01.** Six specs register an account, across two projects: twelve per run against `registerPerIp`'s ten per day, before CI's two retries. The failure is silent - the form just stays on `/rejestracja`. The existing `globalSetup` cleared counters once per suite, which cannot help with a limit exceeded *within* one. Fixed with an `auto` fixture (`tests/e2e/fixtures.ts`) clearing the **loopback** counters before every test. Deliberately **not** fixed by raising the limit: that is changing the product to suit the tests.
  - **`shell.spec.ts` still navigated through Loft**, retired at the owner's request the same day, so it failed against a homepage doing exactly what was asked. Repointed at Obrazy. Gres broke it the same way on 2026-08-28.
  - **Two specs asserted on transient success messages** that the success itself hides - `custom-upload`'s „Projekt został przesłany." alert (the accordion advances) and `design-review-customer`'s `waitForLoadState('networkidle')`. Both now wait on a durable consequence. **Worth remembering the intermediate mistake:** waiting for the form to *disappear* looked obvious and was wrong - `toHaveCount(0)` cannot tell "unmounted" from "not rendered yet", so it passed instantly and the failure moved two lines down. Wait for something to appear.
  - **`design-review-customer` is genuinely slow** (two registrations, three logins, two uploads, a staff review) and was spending the 30s default on real work: `test.slow()`.
  - **Evidence:** `npx playwright test` → **20 failed / 34 passed → 56 passed**, the first fully green e2e run in this repository. One residual flake seen on the way and deliberately not papered over: `accounts.spec.ts` timing out in `fillReliably` under eight parallel workers, passing in isolation - the contention CI already avoids with `workers: 1`, whose real repair is **ARCH-03**.
  - **Status:** DONE
- [x] **UX-21 · P2 · UX/UI - the configurator showed a price for an option it will then refuse** - **DONE 2026-09-04.**
  - **Was:** SEC-03 made the *write* path refuse a withdrawn pattern, but `getConfiguratorSnapshot` still priced the configuration, so a customer on a stale link saw „Cena: 709,16 zł" for something they could not buy - the BUG-02 shape, one screen along.
  - **Fix:** `findUnavailableSelection` in `resolve-options.ts`, **shared** with the write path (`everySelectedOptionIsOffered` delegates to it) rather than re-implemented in the browser - SEC-03 happened because the picker's rules and the gate's rules were two pieces of code. No price at all when it fires, not a greyed one, plus a disabled button and copy that says we withdrew it.
  - **The browser check found half the fix missing.** The first version covered the summary panel only; the **sticky price bar** is a second price surface, fixed to the bottom of every screen, and went on showing the figure underneath a panel saying the variant was withdrawn. Now computed once in the parent and passed to both.
  - **Evidence:** `tests/unit/unavailable-selection.test.ts` (11, written first, all failing for the right reason) · `tests/e2e/stale-configuration-link.spec.ts` opens a real link naming `wzor-podstawowy` (retired by BUG-03, still attached to the product - nothing staged) and asserts no price on **either** surface; verified to fail with each half of the fix removed independently, on both browser projects · the 22 existing selection-availability integration tests unchanged, which is what proves the shared refactor moved no behaviour.
  - **Status:** DONE
- [x] **UX-23 · P2 · UX/UI - the cart, the navbar and the search bar reworked towards the Bazaar layout** - **DONE 2026-09-04.** Owner request.
  - **Taken:** the arrangement - a slim topbar above the navigation, the nav centred between the logo and the cart/account controls, a search field owning the full width of its band with a category selector attached, a cart of line cards beside a sticky summary panel, and a category rail on the cart view. **Not taken:** any of the template's CSS, assets, typography or colour. Every value is one of this project's own tokens, which is an identity decision and a licensing one.
  - **Constraints held:** the header is still a Server Component with zero client JS, MUI is still lint-banned from `(marketing)`/`(shop)`, and the burger still works and still fails in the "show everything" direction.
  - **Two things the reference could not be copied on.** Its topbar carries a shipping promotion and its cart summary a voucher field and a shipping estimator. This shop has no shipping offer, no vouchers, and prices delivery at checkout - all three would have been controls or claims that do nothing, in the most visible place on the site. The topbar says something already true instead, and the summary says plainly that delivery is priced at the next step.
  - **The selector had to be made real.** `/szukaj` accepted only `q`, so an attached category selector would have been decoration. `searchActiveProducts` now narrows for real and answers three request shapes, including "a category with no phrase" - what someone actually does after using the selector. A slug naming a category that no longer exists says so rather than silently searching everything.
  - **One real regression, caught in the browser:** hiding the header labels to fit a phone with `display: none` took the cart link's accessible name with them - the link was announced as „1", its count badge. Clipped to a pixel instead.
  - **Evidence:** `tests/integration/product-search.test.ts` (8, written first, all failing for the right reason) · `tests/e2e/storefront-chrome.spec.ts` (12 across both browser projects), including an accessible-name assertion verified to fail against the `display: none` version · browser-verified at 1400px and 375px, no horizontal overflow at either.
  - **Status:** DONE
- [x] **T-24 · P2 · tests - three e2e tests were asserting on the wrong thing** - **DONE 2026-09-04.** Exposed by UX-23's work, not caused by it.
  - **Next's route announcer:** three specs asserted `getByText('<product name>')` on the cart. `__next-route-announcer__` holds the page title for a moment after every navigation and the title contains the product name, so the locator intermittently matched twice and failed strict mode - which reads as a browser flake because it only fires inside that window. All three now use the cart row's own heading.
  - **T-23's rate-limit clear was still racy:** clearing before each test is not enough with eight workers sharing one counter. It now happens immediately before each registration submits.
  - **Evidence:** two consecutive full-suite runs at **68 passed / 68**, both projects. One flake left visible rather than papered over: `accounts.spec.ts` timing out in `checkReliably` under eight workers, passing in isolation - the contention CI avoids with `workers: 1`, whose real repair is **ARCH-03**.
  - **Status:** DONE
- [x] **UX-25 · P2 · UX/UI - the cart's second pass: stages, an address, and the reference's lightness** - **DONE 2026-09-04.** Owner review of UX-23: "koszyk dalej jest za biedny", then "the layout and style of the cart should match the lightness and ui/ux" of the reference, then a list of what was missing.
  - **A stage rail** below the search band and above the cart, on all three pages of the flow. **Three steps, not the reference's four:** the shop has three pages, and the payment method is chosen on the order form with the transfer made in the customer's own bank, because no provider is integrated (`OPEN_ITEMS.md` §1). A „Płatność" step would point at a page that does not exist. Only a completed step is a link, and nothing is a link from the confirmation page - the order consumed the cart, so "back to the cart" leads to an empty one and "back to the order form" invites a second order for one purchase.
  - **The full address and a note, on the cart page**, persisted on the `Cart` and **pre-filling the order form**. That round trip is the whole feature: a cart that collects an address and then makes someone type it again is theatre. Deliberately unvalidated on the way in - it is saved while somebody is still typing - with `createOrder`'s validation unchanged and still binding on what is actually submitted.
  - **The lightness.** Every panel lost its outline for a soft shadow on paper (`SOFT_CARD`); the search band's filled dark button became a quiet magnifier; the stage rail is centred with the current step as a filled pill. The palette stays this shop's warm ground and warm paper: what was borrowed is the weight, not the colour.
  - **The topbar is for social profiles**, not our own subpages ("navbar nad navbarem dotyczy mediów fb insta itd nie podstron"). Four `StoreSettings` fields the owner fills in at `/panel/ustawienia`, validated as absolute https URLs because they become an `href` on every page of the storefront. **Nothing is hard-coded and nothing is shown for a profile nobody configured** - a social icon linking to an unclaimed account is worse than no icon. **Nothing is configured yet, so the strip currently shows only its note**, and on a phone it does not render at all rather than leaving a bar of solid colour containing nothing.
  - **Controls removed at the owner's request**, second round: „Aktualizuj" (numeric quantity entry), „Duplikuj" and „Edytuj" are gone from the cart card - "wystarczy ten podstawowy do ustawiania ilości obok ceny". Recorded because it has consequences: re-opening a line in the configurator is now reached from „Moje projekty" rather than the cart, and reaching the maximum of 25 is 24 presses. `updateCartItemQuantity` and `duplicateCartItem` still exist and are still covered by `cart-operations.test.ts`; **nothing in the UI calls them any more**, which is worth a decision (delete them, or leave them as `'use server'` endpoints with no caller).
  - **Evidence:** `tests/unit/checkout-steps.test.ts` (7) · `tests/integration/cart-delivery-draft.test.ts` (6) · three new social-profile cases in `admin-store-settings.test.ts`, all written first and all failing for the right reason · `tests/e2e/cart-delivery-draft.spec.ts` proves the cart-to-checkout round trip in a real browser, which no other level can · `storefront-chrome.spec.ts`'s topbar test rewritten to drive the real setting and assert the unconfigured case · two migrations. Browser-verified at 1024px and 375px, no horizontal overflow at either. **1090 → 1106 unit/integration; e2e 68 → 72, all passing.**
  - **Status:** DONE
- [x] **T-25 · P2 · tests - a stale `next start` made 31 e2e tests fail against last hour's build** - **DONE 2026-09-04.**
  - `playwright.config.ts` sets `reuseExistingServer: !process.env.CI`. A `next start` left listening on port 3000 by an earlier run is therefore adopted silently - and `next start` reads the build once, at boot, so the whole suite ran against a stale `.next` while the specs were current. 31 failures across every area, with no server output in the log at all, which is the tell: a real run prints 125 `[WebServer]` lines.
  - **Not fixed by disabling reuse:** the setting exists so that iterating on one spec does not rebuild every time, which is worth real minutes. What was missing is knowing when it fired. **The check is one line:** `grep -c '^\[WebServer\]'` on the run log. Zero means nothing was built and the result is about a build you cannot see.
  - This is the second time it has cost a debugging session (the first was during the warehouse work). Recorded here rather than in a comment nobody reads at the moment it matters.
  - **Status:** DONE (recorded; the guard is procedural)
- [x] **UX-26 · P2 · UX/UI - the cart's third pass: one form, a category menu, and a prefill that is honest about its source** - **DONE 2026-09-05.** Owner review of UX-25.
  - **The address form now exists only on step two** ("formularz powinien być tylko w drugiej karcie żeby nie powtarzać"). This reverses the cart-side half of UX-25 one day later, and the reversal was taken properly rather than by hiding a component: the form, its Server Action, its operation, its integration test and the eight `Cart` draft columns are all gone, with a migration dropping them. Unused columns and a `'use server'` export with no caller are debris, not caution.
  - **The category list stopped being a search filter and became quick access** ("wyszukiwanie dobrze sobie radzi bez tego"). It is now a `<details>` menu of category links beside the form, wrapped in a labelled `<nav>` - a bare `<summary>` comes back from the accessibility tree as a `generic` with no name, so nothing announced what the control opened. `searchActiveProducts` keeps its category parameter and `/szukaj?k=…` still works as a deep link; nothing in the UI sends one now, and a test pins that no `k=` is smuggled into a shared search URL.
  - **Space and softness:** a real gap between the menu and the field, both 48px tall with a 999px radius and a hairline border rather than a divider-weight outline.
  - **„Uzupełnij moimi danymi", and the honest part.** There is **no address on a `User`** - the account holds a name, an email and an optional phone - so the address half comes from the customer's own most recent order, and the copy says exactly that. Someone who has never ordered is told the address is not there yet, rather than being shown three boxes filled with empty strings and a label calling it saved. An anonymised account offers nothing at all: RODO deletion overwrites the name and email in place, and re-offering that as a convenience would quietly undo the erasure.
  - **A guest is offered an account, not gated by one.** „Masz już konto?" with login and registration links carrying `next=/koszyk/zamowienie`, above a form that still works exactly as it did. Requiring registration to buy is a real conversion cost nobody asked for.
  - **Evidence:** `tests/integration/checkout-prefill.test.ts` (6, written first) covers the two cases that matter - a customer who has ordered and one who has not - plus the anonymised account. `tests/e2e/checkout-prefill.spec.ts` proves the button actually fills the boxes, which is the part that is easy to get silently wrong: every field is uncontrolled, so a prefill only lands if the form remounts, and "the click worked" would pass against a button that does nothing. **e2e 70/70 on both browser projects; 1106 unit/integration.**
  - **Status:** DONE
- [ ] **WAREHOUSE-01 · P2 · admin - consume stock when an order is produced** - the half deliberately not built on 2026-09-04.
  - **Current:** `MaterialStock` records what arrived and what it cost, and `/panel/magazyn` answers "what can I make from this board and what does the material cost". Nothing decrements a batch when a piece is actually cut: `applyAdjustStockQuantity` exists and is called by nothing.
  - **Why it stopped there:** linking consumption to production means deciding which batch a given order drew from, and that is a real business rule (oldest first, cheapest first, or the operator picks) that the owner has not been asked yet. Guessing it would put wrong numbers into a cost report, which is worse than having no report.
  - **Expected:** a decision on batch selection, then a hook from the production status transition, then the cost-per-order view that becomes possible once consumption is recorded.
  - **Status:** TODO (needs an owner decision first)
- [x] **UX-22 · P3 · UX/security - no second confirmation on the bank-account field** - **DONE 2026-09-05.**
  - **Was:** `StoreSettings.bankAccountNumber` saved as a plain text field with the rest of the form. It is the number every bank-transfer customer is told to pay into, printed on the confirmation page and in the confirmation email, so a transposed digit sends real money elsewhere - and nothing about the wrong number looks wrong.
  - **The suggested fix was a confirm dialog** (reusing `CustomerAnonymizeForm`'s pattern). **Deliberately not that.** A dialog is right for a destructive action and useless here: pressing „na pewno?" does not catch a typo, because the person confirming has the same wrong number in their head. What catches it is the checksum, and re-typing.
  - **Two guards, neither sufficient alone.** `checkBankAccountNumber` verifies a Polish account with the IBAN mod-97 rule - which is exactly what its two leading digits are for, and it rejects both a single mistyped digit and a transposition deterministically. Re-typing catches whatever a checksum cannot, because you would have to make the same mistake twice.
  - **Three judgement calls, all recorded in code.** A number it cannot verify (a foreign IBAN) returns `not-recognised`, **not** `checksum-failed` - "we cannot check this" must not be reported as "this is wrong", and the shop is not required to refuse a foreign account; the re-typed confirmation still applies to it. Spacing is ignored when comparing the two, because nobody groups digits the same way twice and refusing a real match over a space teaches the reader to paste rather than check. And the confirmation is required **only when the number actually changes** - demanding it to edit the shipping rate would train whoever uses this page to paste the same value twice without reading it, which is how a confirmation stops being one.
  - **Evidence:** `tests/unit/bank-account.test.ts` (10, written first, including the transposition case) · seven cases in `admin-store-settings.test.ts` · `tests/e2e/admin-bank-account.spec.ts` proves the guard is reachable and legible in a real browser - the field is on the form, a mismatch stops the save **and says why**, nothing is written, and a correct pair goes through. **1181 unit/integration; e2e 74 → 76, all passing.**
  - **Status:** DONE
- [ ] **BUG-16 · P2 · SEO** - the sitemap omits `/kolekcje` and its children, `/strony/[slug]`, `/faq`, `/o-nas`, `/kontakt` and both legal pages (§18 also names designs and content pages), and sets no `lastModified` despite every model having `updatedAt`.

---

## P3 - Polish

- [x] **BUG-24** - **DONE 2026-08-31** alongside BUG-02: the product JSON-LD now emits `MadeToOrder`, and omits `offers` entirely when there is no advertised price rather than publishing a wrong one.
- [ ] **BUG-26** - `ProductCard` declares `sizes="(max-width: 768px) 50vw"` where the real mobile width is ~87vw (measured 327 px of 375). Under-serves at DPR ≥ 2. *(Image serving is otherwise correct and verified - do not "fix" the rest.)*
- [ ] **UX-16** - Blog is in the footer but not the navbar; FAQ is in the navbar but not the footer.
- [ ] **UX-17** - „Dąb +3" on product cards is developer shorthand; say „4 gatunki drewna".
- [ ] **BUG-27 · accessibility** - the cart badge count is `aria-hidden` with no alternative.
- [ ] **BUG-28 · accessibility** - no skip link (the only in-page anchor is the hero CTA); with a three-row mobile nav this is a real WCAG 2.4.1 gap.
- [ ] **BUG-29 · accessibility** - `<nav>` has no `aria-label`; footer link groups are not labelled landmarks.
- [ ] **BUG-30** - cart `aria-live="polite"` on a value replaced by a full server re-render may never announce; verify or drop.
- [ ] **BUG-31** - only one `Font` is seeded and it is `Inter`, the site's own UI face; the cmap-coverage apparatus guards a single sans-serif. Honest limitation worth stating in customer-facing copy. Related: `OPEN_ITEMS.md` §8.
- [ ] **BUG-32** - all 13 `Design.sortOrder` values are `0`; materials/finishes are likewise unordered in the configurator queries. Feeds BUG-03.
- [ ] **BUG-34** - the pricing simulator's "cannot publish without viewing it" rule (§16A.1 module 7) is enforced only in the client component; `publishPricingVersion` accepts a direct call. ADMIN-only, so low risk.
- [ ] **DOC-01** - `ARCHITECTURE.md` §6.7 still says "Duplicate configuration deep-copies the `Configuration` row rather than incrementing quantity"; reversed 2026-08-30 (the schema and operation comments were updated, this was missed).
- [ ] **DOC-02** - `docs/CHECKLIST.md:81` claims the step guards "reject e.g. a THICKNESS selection on WALL_ART". They are never called (BUG-06). Correct the line or make it true.
- [ ] **DOC-03** - `CHECKLIST.md:102` records LCP as `[~]`; PERF-01's measured "91 dynamic / 2 static" is new evidence that reframes it. Update once PERF-01 lands.

---

## Carried forward from the previous audit (2026-08-30, `docs/AUDIT-2026-08-30.md`)

Preserved verbatim in status. These were raised, deliberately not fixed,
and are **not** superseded by this review.

- [x] **P1-8 · rate limits on order creation** - **DONE 2026-08-31**, alongside SEC-01 as planned. `consumeOrderAttempt` in `server/rate-limit/auth-throttle.ts`, called from `submitCheckout` **after** field validation so correcting a typo never burns an attempt. 10 per IP per hour - a guard against a script, not against someone ordering twice; duplicate *submissions* remain `Order.idempotencyKey`'s job. Skipped entirely when there is no IP, so local development and the e2e suite are never blocked. Refusal says plainly that nothing was charged. **+2 tests.**
- [ ] **P2-9 · may `STAFF` write the catalogue?** - §16.3 and §16.2 say read-only; ~20 actions use `requireStaffSession()`. **BLOCKED - owner's decision** (`OPEN_ITEMS.md` §7). Deliberately *not* merged with SEC-04, which is narrower and needs no decision.
- [ ] **P2-11 · the pickup-point dataset ships to the browser** - `CheckoutForm.tsx` imports it as a runtime value. Harmless at 16 entries; a real payload problem the day it becomes a live directory (`OPEN_ITEMS.md` §3).

---

## Next Recommended Actions

Exact execution order. Rationale and prerequisites given because the order
is not arbitrary.

~~SEC-01 (+ P1-8)~~ · ~~SEC-02~~ · ~~SEC-03 + BUG-03~~ · ~~BUG-02 (+ BUG-24)~~ · ~~SEC-05~~ · ~~ARCH-01~~ · ~~SEC-04~~ (+ ~~SEC-10~~, found during it) · ~~BUG-06 + BUG-07~~ · ~~BUG-05~~ - **all done 2026-08-31.**

**Do this first, before any new item:** open the PR for
`audit-remediation-2026-08-31` and watch the CI workflow's first run. The
branch is pushed, but the workflow triggers on `pull_request` and on pushes
to `main`, so nothing has run yet. It is the one thing in this round that
could not be verified from the development machine, and every item below is
easier once it is green.

| # | ID | Pri | Why now | Prerequisite |
|---|---|---|---|---|
| 1 | **PERF-03** | P2 | 22 admin repositories still use unbounded `findMany`. ADMIN-01 built the pagination helper they would reuse, so this is now mostly application rather than design. | none |
| 2 | **ARCH-02, the rest** | P2 | `SummaryStep` (189 lines) and five smaller components still sit in `Configurator.tsx`. The same mechanical move as the four already out. | none |

**PERF-01 is not in this list any more.** Every one of its three steps now
needs an owner decision - steps 2-3 because of SEC-05's nonce, step 1 because
its invalidation could not be demonstrated. It returns once that call is made.

After those, work P2 in the order listed; the UX items cluster naturally
(UX-04 fixes UX-10 and most of UX-14 with it).

---

## Remaining Blockers

**Nothing blocks starting work.**

| Blocker | Blocks | Status |
|---|---|---|
| ~~Where rate-limit state lives (`OPEN_ITEMS.md` §6)~~ | ~~SEC-01, P1-8, SEC-08~~ | **RESOLVED 2026-08-30** - owner chose Postgres. `RateLimit` table built and in use. SEC-08 is now a small follow-on rather than a blocked item |
| ~~What the placeholder design should be called~~ | ~~BUG-03~~ | **RESOLVED 2026-08-31** - owner chose to show an already-existing pattern, so the placeholder was retired rather than renamed |
| Real per-design production measurements (`referenceWidthMm`, `minLineWidthUm`, and router vs laser) | Nothing today - **BUG-35 is closed** | **Not blocking.** Only needed if patterns become customer-selectable again, since `PATTERN_FEASIBILITY_ENABLED` would then have to go back on. §R4 says these are DB values precisely so they can be corrected from real production; 1,2 mm looks like a router-bit figure and small items would realistically be laser-engraved |
| May `STAFF` write the catalogue? (`OPEN_ITEMS.md` §7) | P2-9 only | Genuinely the owner's call. **Does not block SEC-04**, which is narrower and needs no decision |

Blocked on the owner and **not** implementable by any agent - all nine are
real, working code waiting on an external thing. See `docs/OPEN_ITEMS.md`:

§1 Przelewy24 credentials · §2 a real GEIS price list · §3 an InPost
Parcel Manager token · §4 the bank account number · §5 the remaining UI
polish scope · §6 rate-limit storage · §7 `STAFF` catalogue scope · §8
admin screens for `Font`/`PersonalizationSpec`/`MachineSettings`/`ProductFinishExclusion` ·
§9 uploaded-design deletion (needs a soft-delete + GDPR-erasure decision).

Environment limits on this review, stated so nobody assumes otherwise:

- **No Lighthouse / Core Web Vitals run** in this pass. The only figure
  cited is `CHECKLIST.md:102`'s earlier run, quoted as historical.
- **No bundle sizes.** Next 16 + Turbopack did not emit them and dev-server
  numbers are meaningless. No JS-payload claim appears anywhere in these
  documents.
- **No `EXPLAIN ANALYZE`.** Index findings are structural.
- **No load test.**
- **E2E not re-run.**
- **No payment-integration testing possible** - no provider is connected.

---

## Recently Verified - do not re-investigate

Checked in this review and found **correct**. Re-auditing these is wasted
effort.

**Domain and pricing**
- Integer-grosze arithmetic, half-up rounding on exact integer remainders, basis points, VAT on the unit price. `domain/money`, `domain/pricing`.
- Module splitting, dimension validation, feasibility rules incl. the machine thickness boundary.
- Personalization validation *when a `PersonalizationSpec` exists and a font is chosen* (the gap is only the missing-spec branch - BUG-06).
- `mapping/to-domain.ts` - a renamed column breaks compilation rather than changing a price.

**Orders and cart**
- `OrderItem.snapshot` immutability: order rendering never joins to a live catalogue row, and a real mutate-and-check test proves it.
- Server-side price authority: `createOrder` re-prices every line and rejects on mismatch. No client total is trusted.
- Order numbers from a real Postgres upsert counter - collision-safe.
- Dual idempotency (unique key + cart-row claiming) with four real concurrency tests.
- Atomic quantity adjustment; `deleteMany` on double-clicked removes; `upsert` + P2002 retry on concurrent first add.
- Line-by-line guest-cart merge with quantity folding and clamping.
- Duplicate guards on support requests, reviews and design-review comments.

**Security**
- `actions/` ↔ `operations/` boundary and its guard test.
- HMAC-signed guest session; length-guarded `timingSafeEqual` in both places it is used.
- "404, not 403" applied consistently.
- Ownership re-derived from the session everywhere; cross-guest and cross-user access tested.
- Upload pipeline: magic-byte sniffing, DOMPurify SVG sanitization with a real `href` hook, PDF active-content rejection, EXIF-stripped previews, opaque storage keys, SVG forced to `attachment`.
- `role: { input: false }` - no self-service elevation.
- Audit logging present in **all 25** admin operations modules (scanned individually).
- Pricing writes ADMIN-only and append-only.
- Server Action CSRF is handled at framework level (Origin↔Host).
- **No fake payment, tracking, email or production-file behaviour anywhere.** Verified deliberately; this is the project's strongest discipline.

**Performance and infrastructure**
- `next/image` usage: `sizes` set everywhere, 9-entry `srcset`, and a 327 px slot verifiably downloads `w=384`. Hero has `priority`.
- Self-hosted fonts via `next/font` with `latin-ext` (the §17.1 trap avoided).
- `Promise.all` used correctly wherever reads are independent; the one deliberate *non*-optimisation in `zamowienie/[orderNumber]/page.tsx` is right - leave it.
- Prisma connection pooling (`PrismaPg` given a real `pg.Pool` instance) - fixed, documented, unit-tested.
- Database indexes cover every hot lookup; **no N+1 patterns found**.
- The RSC/island split is real and lint-enforced, and the 3.8 s-LCP evidence behind it is sound. **Do not mount MUI sitewide.**

**Content**
- Polish copy quality is high: natural, specific, correct „…" quotes, correct plurals, no invented claims. The no-Polish-literals lint rule works.
- Every honest "not yet available" notice (bank account, pickup-point sample, mailer, tracking) is correct and must not be replaced with something that looks finished.

---

## ID cross-reference

Some findings are described from two angles - a defect in
`REVIEW-DETAILED.md` and the same thing as a user-facing problem in
`REVIEW-UX-UI.md` or `REVIEW-PERFORMANCE.md`. They are **one checklist item
each**, listed here so nothing appears to exist only inside a narrative
document (brief §21). No alias below is a separate task.

| Alias ID | Where it is described | Tracked in this checklist as |
|---|---|---|
| UX-01 | `REVIEW-UX-UI.md` | **BUG-02** (advertised price) |
| UX-02 | `REVIEW-UX-UI.md` | **BUG-03** (placeholder design) |
| UX-03 | `REVIEW-UX-UI.md` | **BUG-04** (confirmation totals) |
| UX-04 | `REVIEW-UX-UI.md` | **BUG-10** (mobile nav) - listed as `UX-04 / BUG-10` |
| UX-05 | `REVIEW-UX-UI.md` | **BUG-09** (Duplikuj label) - listed as `UX-05 / BUG-09` |
| UX-08 | `REVIEW-UX-UI.md` | **BUG-14** (stale pickup point) - listed as `UX-08 / BUG-14` |
| BUG-25 | `REVIEW-DETAILED.md` P3 | **UX-07** („Odbiór osobisty" free-shipping copy) |
| BUG-33 | `REVIEW-DETAILED.md` P3 | **DOC-01** (§6.7 still documents the old duplicate behaviour) |
| PERF-05 | `REVIEW-PERFORMANCE.md` Finding 3 | **PERF-02** (~13 queries per product page; the `getSession`-twice fix is part of PERF-02's acceptance criteria) |
| UX-18 | `REVIEW-UX-UI.md` | **BUG-27 / BUG-28 / BUG-29 / BUG-30** (the accessibility group) |
| UX-19 | `REVIEW-UX-UI.md` | **BUG-24** (`availability: InStock`) |
| UX-20 | `REVIEW-UX-UI.md` | **ADMIN-01** (the „Pokazano 100 z 166" stopgap is ADMIN-01's interim step, not a separate task) |

Findings recorded as **informational only**, with a reason, and therefore
deliberately not checklist items:

| Observation | Where | Why it is not a task |
|---|---|---|
| No payment-callback tests exist | `REVIEW-TEST-COVERAGE.md` | No provider is connected (`OPEN_ITEMS.md` §1). Writing them would be fake coverage. **Correct as-is.** |
| No carrier-tracking tests exist | `REVIEW-SECURITY-RELIABILITY.md` | No carrier API is integrated; `Shipment` is staff-maintained, honestly. **Correct as-is.** |
| The deliberate non-optimisation in `zamowienie/[orderNumber]/page.tsx` | `REVIEW-PERFORMANCE.md` | Starting `getStoreSettings()` earlier would create an unhandled rejection when `notFound()` throws. **Correct as-is - do not "fix".** |
| The RSC/island split and the MUI lint ban | `REVIEW-PERFORMANCE.md` | Backed by a real 3.8 s-LCP measurement. **Keep.** |
| Everything under "Recently Verified" | this file | Checked and found correct. |

---

## Review History

| Date | Agent / review | Scope | Important findings | Checklist changes |
|---|---|---|---|---|
| 2026-08-23 → 2026-08-30 | Implementation agent (P0–P9 + continuation rounds) | Whole build | See `docs/CHECKLIST.md` and `docs/HANDOVER.md` | `CHECKLIST.md` maintained throughout |
| 2026-08-30 | Self-audit - `docs/AUDIT-2026-08-30.md` | Production readiness before code changes | P0-1 forged-actor Server Actions · P0-2 duplicate orders · P0-3 lost cart update · P1-4 duplicate rows · P1-5 stale badge · P1-6 non-idempotent staff mutations · P1-7 sequential re-pricing · P1-8 missing rate limits · P2-9 STAFF scope · P2-10 raw UI · P2-11 bundled dataset | All P0/P1 except P1-8 implemented test-first; +42 tests |
| 2026-08-30 | Duplicate sweep (commit `e774e40`) | Every path that can create a duplicate | 6 duplicate paths + a login failure inside `mergeGuestCartIntoUser`; saved-project deletion added | `OPEN_ITEMS.md` §9 added; 831 tests |
| **2026-08-30** | **Independent audit - this review** | **Whole repository, verified against a live DB, a real browser and a production build** | **SEC-01 unthrottled auth · SEC-02 OTP in logs · SEC-03 unenforced sellability · BUG-02 net/unreachable advertised price · BUG-03 placeholder design in every order · SEC-05 no CSP · PERF-01 91/93 routes dynamic · ADMIN-01 66 orders unreachable · BUG-06/BUG-07 rules with no call site · ARCH-01 no CI** | **62 items added (3 P0, 11 P1, 34 P2, 14 P3); 3 carried forward. No application code changed. Eight documents created.** |
| **2026-08-31** | P0 remediation | SEC-01, SEC-02, SEC-03 + BUG-03, P1-8 | All three original P0s closed. Two migrations (`RateLimit`, OTP subject). SEC-03's fix reused `resolveOptions` rather than re-implementing §7.2. | **5 items closed**; **1 added** (UX-21). Tests 831 → 879 |
| **2026-08-31** | Advertised pricing + pattern decision | BUG-02, BUG-03 (final part), BUG-24 | New `startingPriceGrossGrosze`, gross and reachable; placeholder pattern retired. **Found BUG-35** - pre-existing, invisible because no test asserted a product is orderable and the static advertised price masked it | **3 items closed**; **1 added as P0** (BUG-35). Tests 879 → 884 |
| **2026-08-31** | "nothing offered may be blocked" | BUG-35 | Owner ruled that pattern feasibility must not gate a product sold with its pattern already fixed. Design-derived findings switched off behind one flag; step lists narrowed to what a product can actually offer (the kitchen tile required a FINISH its only material cannot take). **T-16 added** - sweeps ~1500 offered combinations and refuses to let any be unbuildable. One unit test reversed, with the decision recorded in it | **1 P0 closed**; **T-16 added**. Tests 884 → **888**; typecheck, lint and build clean. Advertised prices recomputed and now match the audit's original estimates (190,40 / 220,85 / 55,69) |
| **2026-08-31** | Security headers + CSP | SEC-05 | §16.1's header half built: five static headers plus `poweredByHeader: false` from `next.config.ts`, and a nonce-based CSP per request from `proxy.ts`. `script-src` strict (`'nonce-…' 'strict-dynamic'`, no `'unsafe-inline'`); `style-src` keeps `'unsafe-inline'` because Emotion injects client-side and `error.tsx` boundaries can never receive a nonce - pinned by a test rather than left implicit. Found in Next's source that it reads the nonce from the report-only header too, which is what makes a report-only rollout honest. **Discovered a hard conflict with PERF-01** (a nonce forecloses static/ISR/PPR) and recorded it there. `X-Powered-By` removed, beyond the audit's list | **1 P1 closed**; **T-17/T-18/T-19 added**. Tests 888 → **919**, plus 10 e2e. Enforced policy verified in a real browser across home/product/cart/checkout/panel with zero console messages |
| **2026-08-31** | Continuous integration | ARCH-01 | Two GitHub Actions jobs - `verify` (types, lint, unit + integration, build) and `e2e` (`needs: verify`, report uploaded as an artifact) - against a Postgres service container that mirrors `docker-compose.yml` down to the port and the init script. Both databases seeded, because the catalogue-sweeping tests **pass vacuously** on an empty one. New `npm run db:seed:test`. `workers: 1` in CI as the documented-but-unmeasured mitigation for the recorded e2e flake. **Proved the whole sequence locally against a virgin database** - 27 migrations from zero, seed from empty, 931/931, build clean - which also established for the first time that this round's four new migrations apply from scratch | **1 P2 closed**; **T-20 added**. Tests 919 → **931**. **The workflow itself has never run on GitHub** - the one unverified thing in this round |
| **2026-08-31** | Admin-only authorization | SEC-04, **SEC-10 (new)** | Three operations moved to ADMIN - and the gate asserted twice, because `requireAdminSession` reads `next/headers` and is unreachable from any test, which is how SEC-03 happened. The UI followed the enforcement (two pages gated, the anonymize form hidden from STAFF, the sidebar made role-aware - which fixed two pre-existing dead links as well), so the panel never offers a STAFF something the system will refuse. **Found SEC-10 while verifying in the browser:** `next/link` prefetch was firing a GET route handler that builds a RODO export and writes an audit row, so opening a customer's page logged an export nobody performed. Also raised `vitest` `testTimeout` 5s → 20s: it is a deadline, not a budget, and the old value had begun failing `create-order.test.ts` under parallel DB contention - an intermittently red CI is a CI people ignore | **2 P1 closed** (one of them new); **1 P3 added** (UX-22); **T-09/T-21/T-22 added**; three existing tests re-pointed at an ADMIN actor with the reversal recorded. Tests 931 → **959**. Also ran the suite six times because CI now will: found and fixed **two real flakes**, both tests wrong about parallel files sharing one database - `offered-is-buildable` sweeping another file's fixture products, and `admin-authorization` snapshotting shared singletons in `beforeAll`. Six consecutive clean runs after |
| **2026-08-31** | Inputs the write path never looked at | BUG-06, BUG-07 | Two sides of one hole: `priceAndValidateSelections` checked neither the *shape* of what it was given nor whether the fields belonged to this product type. `zod` adopted rather than dropped (§2 already required it) in one module, with `FeasibilityCode` now **derived from** a `FEASIBILITY_CODES` array so the allow-list and the type cannot drift. `checkStepAppliesToProductType` - 30 assertions, zero call sites since P3 - is finally reached, via `findSelectionOutsideProductType`. The predicted 500 was real: the pre-fix run produced `TypeError: selections.personalizationText.trim is not a function`. **Caught a regression the fix created before it shipped** - the configurator defaulted a `finishId` on JEWELRY, which has no FINISH step, so the bracelet would have priced fine and then refused at add-to-cart; defaults are step-aware now and its price moved 57,54 → 57,39 zł, agreeing with the advertised „od" figure for the first time | **2 P1 closed**; **T-10/T-11 built**, plus `configurator-defaults`. Tests 959 → **1028**, three consecutive clean runs. `docs/CHECKLIST.md:81` corrected rather than left contradicting the code |
| **2026-08-31** | The lost-update habit | BUG-05 | "Duplikuj" was written as read-then-write when it became a quantity bump - the exact shape P0-3 had found and fixed in `applyAdjustCartItemQuantity` **in the same commit**. Now the sibling's statement verbatim, with the bound in the `where`. The sequential test beside it passed before and after, which is why T-07 is a concurrency test: eight concurrent duplicates produced **2** before the fix and 9 after. Swept for the same shape elsewhere - no computed read-then-write remains in `src/server`, and the ~20 admin `findUnique`-then-`update` pairs are a different, idempotent shape (they read the previous value for the audit diff and write an absolute one), checked rather than assumed | **1 P1 closed**; **T-07 built**. Tests 1028 → **1031**, two consecutive clean runs |
| **2026-09-04** | Query counts | PERF-02, PERF-05 · PERF-01 step 1 **attempted and backed out** | `React.cache` on the five duplicated `generateMetadata` reads and on `getSession`. Measured on a production build with Postgres statement logging rather than estimated: product page **36 → 26** queries, homepage and category **14 → 11**. The cross-request half was built in full (`unstable_cache` + tags + a mechanical guard + an e2e) and removed again: the caching works - a row inserted behind the app stayed invisible until the TTL - but the invalidation was never demonstrated, and Next 16 documents tagging only for `fetch` and `use cache`. Shipping unproven invalidation means an admin edit silently taking minutes to appear, so it waits for the same `cacheComponents` decision that replaces the API. `revalidateTag` also gained a required second argument in Next 16 | **1 P1 closed** (PERF-02, with PERF-05); **PERF-01 remains open with step 1 now also owner-blocked**. Tests unchanged at **1031** - the shipped change is request-scoped memoization, which no unit test can meaningfully observe; the evidence is the measurement |
| **2026-09-04** | Owner requests | Burger nav · Loft retired, „Inne" renamed to „Zamówienie własne" · em-dash banned repo-wide · the warehouse tool | A responsive burger built from a checkbox and a label rather than `<details>` (the UA hides `::details-content` in a way author CSS cannot override, and the checkbox version fails **visible**). `MaterialStock` plus `/panel/magazyn`: what a board cost, what it can be cut into, and the minimum viable price for each item it can make - the half that consumes stock is **WAREHOUSE-01**, deliberately unbuilt pending an owner decision on batch selection. The em-dash rule is enforced by a second rule in `check-polish-literals.mjs`, which caught one real test that used the character as an unsupported-glyph fixture | **WAREHOUSE-01 added.** Three migrations. Tests → **1075** |
| **2026-09-04** | The last edge of SEC-03, and what verifying it uncovered | UX-21 · **SEC-11 (new)** · **T-23 (new)** | UX-21 itself is small and shared with the write path. The browser check is what earned the day: it showed the fix was **half done** (the sticky price bar is a second price surface and still showed the figure), and then that every WebKit spec was failing because SEC-05's `upgrade-insecure-requests` was gated on `isDev` rather than on whether the request was https - so a production build on plain http upgraded its own assets to a port with no TLS listener and shipped a site with no client JavaScript. Chromium exempts loopback and hid it. Fixing that let the suite run far enough to expose T-23's four separate reasons it could never have been green, one of which (twelve registrations against a limit of ten) was structural | **1 P2 closed** (UX-21); **2 P1 found and closed** (SEC-11, T-23). Tests 1075 → **1082**. **e2e: 20 failed / 34 passed → 56/56 passed** - the first green run in this repository |
| **2026-09-04** | The Bazaar-shaped chrome | UX-23 · **T-24 (new)** | Owner request: the topbar, navbar, search bar, cart and cart-view categories rearranged towards `template.getbazaar.io`. Its arrangement, none of its CSS, assets, typography or colour - and two of its elements deliberately not copied at all, because a shipping promotion, a voucher field and a shipping estimator would each be a claim or a control this shop cannot honour. The category selector attached to the search field forced the search itself to become real: `/szukaj` accepted only `q`, so `searchActiveProducts` gained a category and now answers "a category with no phrase" too. Header still a Server Component with zero client JS; burger still working and still failing visible. **One real regression caught in the browser** - hiding the header labels with `display: none` removed the cart link's accessible name along with the text, leaving it announced as „1" | **1 P2 closed** (UX-23); **1 P2 found and closed** (T-24). Tests 1082 → **1090**, four consecutive clean runs. **e2e 56 → 68, all passing**, two consecutive runs |

---

### Documents created by this review

All under `docs/`:

`REVIEW-OVERVIEW.md` · `REVIEW-DETAILED.md` · `REVIEW-TEST-COVERAGE.md` ·
`REVIEW-UX-UI.md` · `REVIEW-SECURITY-RELIABILITY.md` ·
`REVIEW-PERFORMANCE.md` · `AI-IMPLEMENTATION-GUIDE.md` · **`AI-CHECKLIST.md`** (this file)

Pre-existing documents were **read and left unmodified**: `ARCHITECTURE.md`,
`CHECKLIST.md`, `HANDOVER.md`, `OPEN_ITEMS.md`, `AUDIT-2026-08-30.md`,
`BACKUP.md`, `README.md`. Three of them contain statements this review
contradicts - tracked as DOC-01, DOC-02 and DOC-03 rather than edited,
since correcting them is an implementation task with its own evidence.
