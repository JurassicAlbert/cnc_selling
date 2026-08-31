# Test coverage review — 2026-08-30

Commit `e774e40`. Companion to `REVIEW-DETAILED.md`.

## Measured baseline

`npm test`, run during this review:

```
Test Files  71 passed (71)
     Tests  831 passed (831)
  Duration  52.25s
```

| Layer | Files | Tests | Notes |
|---|---|---|---|
| Unit (`tests/unit`) | 28 | ~500 | Pure `src/domain` + a few server-pure modules. No DB. |
| Integration (`tests/integration`) | 43 | ~330 | Real Postgres (`TEST_DATABASE_URL`), operations and repositories |
| E2E (`tests/e2e`) | 7 specs | **15 tests** | × 2 projects (`desktop-chromium`, `mobile-safari`) = 30 runs |

`npm run e2e` was **not** re-run in this review. The previous session
recorded a reproducible parallel-contention flake pattern
(`fillReliably` login timeouts, "destination stream closed early") with
every affected spec passing in isolation. Treated here as previously
verified, not as evidence produced by this pass.

### Status update — 2026-08-31

The findings below are preserved as written on 2026-08-30. This block
records what has since been built, so the gaps that remain are the ones
still worth acting on.

```
Test Files  85 passed (85)     (was 71)
     Tests  1028 passed (1028) (was 831)
  Duration  83s
```

| Layer | Files | Change |
|---|---|---|
| Unit (`tests/unit`) | 35 | +7 — `security-headers`, `proxy`, `ci-workflow`, `admin-only-operations`, `customer-export-route`, `configuration-input`, `configurator-defaults` |
| Integration (`tests/integration`) | 50 | +7 — `rate-limit`, `auth-throttle`, `selection-availability`, `starting-price`, `offered-is-buildable`, `admin-authorization`, `step-and-input-validation` |
| E2E (`tests/e2e`) | 8 specs, ~25 tests | +1 spec — `security-headers` (10) |

**Priority-1 IDs now built:** T-01 (`auth-throttle.test.ts`, plus
`rate-limit.test.ts` with a 20-way concurrency case proving exactly 5 of 20
are allowed) · T-02 (`mailer.test.ts`, including the case where a database
template puts `{{otp}}` back into the subject) · T-03
(`selection-availability.test.ts`, 22 tests — 9 rejection cases against both
the cart and the checkout path) · T-04 (`starting-price.test.ts`).

**T-09 is now built too** (`admin-authorization.test.ts`, 10 — all three SEC-04 operations against STAFF, CUSTOMER and ADMIN actors, each refusal asserting that *nothing changed*).

**T-10 and T-11 are built** (`step-and-input-validation.test.ts`, 18 — every
step-applicability and input-shape rule driven through `applyAddToCart`, each
rejection also asserting no `Configuration` row was written).

**Still missing, unchanged and still the highest value per line: T-12** —
guest order lookup with a wrong, shorter, longer and empty token. Also still
missing: **T-05** (default-selection determinism), **T-06** (order-total
reconciliation), **T-07** (concurrent `applyDuplicateCartItem`), **T-08**
(admin pagination) and **T-13/14/15** (§16.2's remaining matrix rows).

**Added beyond the original list:**

| ID | Test | Covers |
|---|---|---|
| **T-16** | `offered-is-buildable.test.ts` — sweeps every offered combination of every active product (~1500), asserts none is refused, then drives one configuration per product through `applyAddToCart` | BUG-35, and the owner's rule that nothing offered may be blocked |
| **T-17** | `security-headers.test.ts` (24) — the policy string, including a round-trip of a generated nonce through Next's own `getScriptNonceFromHeader`, imported from the installed package so a Next upgrade that changes it fails loudly | SEC-05 |
| **T-18** | `proxy.test.ts` (7) — all three `CSP_MODE` values driven through the real `proxy()`, plus proof that turning the CSP off does not also turn the `/panel` redirect off | SEC-05 |
| **T-19** | `security-headers.spec.ts` (10 e2e) — headers on a live response, a fresh nonce per request, Next applying that nonce to its own script tags, five real pages with no CSP violation, and a Server Action running under enforcement | SEC-05 |
| **T-20** | `ci-workflow.test.ts` (12) — parses `.github/workflows/ci.yml` and pins the two failure modes that produce a *green* run: a step calling an npm script that no longer exists, and `npm test` running without `TEST_DATABASE_URL` | ARCH-01 |
| **T-21** | `admin-only-operations.test.ts` (14) — every mutating wrapper §16.3 assigns to ADMIN gates on `requireAdminSession`, asserted **per function** (not per file: `admin-pricing.ts` correctly holds both gates, since `simulatePricingDraft` is a read). Also that the three SEC-04 `apply*` check the role *before* their first Prisma call | SEC-04 |
| **T-22** | `customer-export-route.test.ts` (4) — the RODO export route returns 404 for a prefetch, and the page links to it with a plain anchor | SEC-10 |
| **T-23** | `configuration-input.test.ts` (40) — `findSelectionOutsideProductType` for every product type × selection field, and both zod parsers against wrong types, unbounded strings, unknown warning codes and missing fields | BUG-06, BUG-07 |
| **T-24** | `configurator-defaults.test.ts` (11) — the configurator never defaults a selection whose step the product type lacks, checked with the same function the server uses, and still produces a priceable starting point | BUG-06 |

T-17/T-18/T-19 exist as three layers on purpose. A CSP is the rare thing
that fails **silently and totally**: a nonce the framework cannot parse
produces a blank page, not an error, and no unit test of a string would
notice. The e2e layer is the only one that can catch it.

**A pattern worth naming, from T-09/T-21 and T-20.** Several of this
project's rules live in places no test can call: `requireAdminSession()` and
`requireStaffSession()` read `next/headers`, and a CI workflow only ever
executes on someone else's machine. The answer used in all three cases is
the same — put the rule somewhere reachable *as well* (an `apply*` that
takes the actor as a parameter), and pin the unreachable half **mechanically
by reading the source**, the way `server-action-boundary.test.ts` already
did. Neither half alone is enough: the runtime test misses a wrapper
downgraded back to `requireStaffSession`, and the source test cannot tell
you whether the rule actually refuses anything.

**And the change to `vitest.config.ts`'s `testTimeout` (5s → 20s, 2026-08-31)
belongs in this document**, because it is a statement about the suite. The
value is a *deadline*, not a budget — a passing test finishes when it
finishes — and at 5s `create-order.test.ts` (~4.1s of test time on its own)
had begun failing under the full suite's contention for one Postgres. That
failure carries no information, and with CI now running the suite on every
push, an intermittently red pipeline is one people learn to ignore.

### Two real flakes, found by running the suite repeatedly (2026-08-31)

Adding CI made "passes on my machine, once" insufficient, so the suite was
run six times in a row. Two intermittent failures appeared, roughly one run
in four. Both were **defects in the tests**, and both came from the same
blind spot: *Vitest runs files in parallel against one shared database.*

1. **`offered-is-buildable.test.ts` (T-16) swept the live catalogue.** It
   enumerated every active product at that moment — which, mid-run, includes
   the fixture products `selection-availability.test.ts` creates and then
   deletes. The failure read `test-availability-<uuid>: no configurator
   data`: a product that existed when it was listed and was gone when it was
   fetched. Fixed by excluding `slug: startsWith('test-')`; all seven
   fixture-creating files were checked and every one uses that prefix, so
   the filter is complete rather than hopeful.

2. **`admin-authorization.test.ts` snapshotted shared singletons in
   `beforeAll`.** `StoreSettings` row 1 and the `verification-otp` template
   are singletons that `admin-store-settings.test.ts` and
   `admin-email-templates.test.ts` legitimately write. A snapshot taken once
   at the top of a file can be *another file's in-flight value*, so the later
   "nothing changed" comparison failed for a reason unrelated to the code
   under test. Fixed by reading immediately before each call and comparing
   immediately after — which is also the assertion actually meant: *this
   call changed nothing.*

**The rule to take from both:** a test that reads global state must scope
that read as tightly as the assertion needs, and a test that enumerates "all
of X" must say which X it means. Neither is a reason to serialise the suite;
`ARCH-03` (point e2e and fixtures at a dedicated database) remains the
structural answer.

The same repetition also surfaced the `testTimeout` problem above. Running a
suite once is not evidence that it is stable — a lesson worth keeping now
that CI will run it on every push.

## Overall judgement

**The test suite is good, and it is good in the right places.** Money,
pricing, module splitting, dimensions, feasibility, personalization and the
cart/order concurrency work are genuinely well covered, with real
concurrency tests rather than sequential stand-ins. `tests/unit/server-action-boundary.test.ts`
is an unusually smart test: it guards an architectural rule, not a
behaviour.

It has one systemic weakness, and it explains three of this review's most
serious findings.

---

## The systemic weakness: pure functions tested, call sites untested

Three separate rules in this codebase are implemented as correct, well
tested pure functions that **no production path ever calls**:

| Rule | Where it is implemented | Tests on it | Called on the write path? |
|---|---|---|---|
| Material/design/finish availability, rights status, `DesignMaterial` narrowing | `domain/compatibility/resolve.ts` | 17 (`compatibility.test.ts`) | **No** — SEC-03 |
| Step applicability and step entry | `domain/configuration/steps.ts` | 30 (`configuration.test.ts`) | **No** — BUG-06 |
| Input schema validation | `zod` | 0 | **No** — BUG-07 (never imported) |

All 47 of those assertions pass. None of them can fail for a reason a
customer would ever encounter, because they exercise the function directly
rather than the path that is supposed to use it.

> **Closed 2026-08-31.** All three rows are now called on the write path:
> compatibility by SEC-03, the step guard by BUG-06
> (`findSelectionOutsideProductType`), and zod by BUG-07 — adopted rather
> than dropped, since §2 already required it. The rule proposed below was
> followed in each case: the enforcement is tested through
> `applyAddToCart`, not through the pure function.

This is not a coverage-percentage problem — `ARCHITECTURE.md` §21.5 is
right to reject that metric. It is a **test-target** problem: the tests
point at the unit rather than at the boundary the rule is supposed to
defend.

**The rule this suite should adopt:** *for any rule that protects money,
rights, or what gets manufactured, at least one test must drive it through
the real Server Action / operation, not through the pure function.* The
existing `cart-operations.test.ts` and `create-order.test.ts` already work
this way — that is exactly why they found real bugs.

---

## What is genuinely well covered

Worth recording so nobody re-audits it:

| Area | Where | Quality |
|---|---|---|
| Grosz arithmetic, VAT, half-up rounding, formatting | `unit/money.test.ts` (37) | Excellent — boundary cases at `.5`, safe-integer extremes |
| Price components, min-price clamp, version pinning | `unit/pricing.test.ts` (39) | Excellent |
| Module splitting, exact boundaries, sliver avoidance | `unit/modules.test.ts` (23) | Excellent |
| Dimensions, aspect ratio, zero/negative/non-integer | `unit/dimensions.test.ts` (22) | Excellent |
| Feasibility incl. machine thickness boundary | `unit/feasibility.test.ts` (32) | Excellent |
| Personalization: length, lines, glyph coverage, diacritics, emoji | `unit/personalization.test.ts` (26) | Excellent |
| Prisma row → domain mapping | `unit/mapping.test.ts` (39) | Excellent — a renamed column breaks compilation |
| Order status transitions incl. the design-review gate | `unit/order-status.test.ts` (22) | Excellent |
| Polish plurals at 1/2/5/12/22/25, collation, numeric input | `unit/plural`, `collation`, `text` (51) | Excellent |
| Cart line identity | `unit/cart-signature.test.ts` (6) | Good, both directions |
| **Cart concurrency** — double-clicked add, racing ±, both bounds under contention | `integration/cart-operations.test.ts` (23) | **Excellent — real concurrency** |
| **Order idempotency** — same-key resubmit, two concurrent same-key, two concurrent different-render, stale tab | `integration/create-order.test.ts` (14) | **Excellent — real concurrency** |
| Delivery/payment/pickup validation at order creation | `integration/create-order.test.ts` | Excellent — includes the "unconnected provider" case |
| Snapshot immutability under catalogue mutation | `integration/soft-delete-invariant.test.ts` + create-order | Real mutate-and-check |
| Upload: magic bytes, oversize, SVG script, PDF JS, corrupted | `integration/upload.test.ts` (16) + `unit/upload-inspect.test.ts` (17) | Excellent |
| Cross-owner access to files and designs | `integration/authz.test.ts` (9) | Good |
| Cross-user order access | `integration/auth.test.ts:168` | Good |
| Admin CRUD across 25 modules | `integration/admin-*.test.ts` (~210) | Broad and real |
| Server Action boundary | `unit/server-action-boundary.test.ts` (4) | Architecturally smart |

---

## Missing and weak coverage

### Priority 1 — tests that would have caught this review's findings

| ID | Test | Covers | Layer |
|---|---|---|---|
| **T-01** | (N+1) failed logins for one email within the window → refused; a different email unaffected; window expiry releases | SEC-01 | integration |
| **T-02** | `UnconfiguredMailer.send('verification-otp', …)` → the emitted log line does **not** contain the OTP | SEC-02 | unit |
| **T-03** | `applyAddToCart` **and** `createOrder` each reject: inactive design · `REQUIRES_PERMISSION` design · unavailable material · unavailable finish · `DesignMaterial`-excluded pair · thickness over the variant cap | SEC-03 | integration |
| **T-04** | For every seeded active product: advertised starting price ≤ cheapest orderable configuration, and both gross | BUG-02 | integration |
| **T-05** | Two consecutive `getConfiguratorSnapshot` calls → identical default `designId` and identical price; default is always inside `resolveOptions(...).designIds` | BUG-03 | integration |
| **T-06** | Rendered order view: Σ item lines + shipping === `totalGrossGrosze` | BUG-04 | integration |
| **T-07** | Two **concurrent** `applyDuplicateCartItem` → quantity 3 (today's test at `cart-operations.test.ts:378` is sequential and passes either way) | BUG-05 | integration |
| **T-08** | 150 seeded orders → page 2 returns 101-150 and `total === 150` | ADMIN-01 | integration |
| **T-09** | `STAFF` → `applyUpdateStoreSettings` / `applyAnonymizeCustomer` / `applyUpdateEmailTemplate` → refused; `ADMIN` → allowed | SEC-04 | integration |
| **T-10** | `personalizationText` on a FLOOR_ELEMENT and `thicknessMm` on a WALL_ART are rejected by `applyAddToCart` | BUG-06 | integration |
| **T-11** | `acknowledgedWarnings` rejects unknown codes and an over-length array; `personalizationText` rejects an over-length string on a product with no `PersonalizationSpec` | BUG-07 | integration |
| **T-12** | `findOrderForConfirmation` with a wrong token, a shorter token, a longer token, and an empty token → `null`, never a throw | see below | integration |

**T-12 deserves a note.** `docs/AUDIT-2026-08-30.md`'s scenario matrix
records "Guest order lookup, wrong token → 404, constant-time compare →
correct". That was established by reading, not by a test. Searching the
whole suite: every call to `findOrderForConfirmation` passes
`order.accessToken` — the **correct** token. There is no negative case
anywhere. `timingSafeEqual` throws `RangeError` on a length mismatch and
the guard against that is one `provided.length === expected.length` check;
if it were ever removed, a short token would 500 and nothing would notice.
This is the single most valuable missing test in the repository relative
to its cost.

### Priority 2 — §16.2's own matrix rows with no test

`ARCHITECTURE.md` §16.2 presents a ten-row authorization matrix and says
"all get tests". Actual state:

| Actor | Resource | Expected | Tested? |
|---|---|---|---|
| Guest with token | own configuration | allow | indirect (cart ops) |
| Guest with token | **other guest's configuration** | 404 | **no** — only `CartItem` ownership is tested |
| Customer A | Customer B's uploaded file | 404 | yes (`authz.test.ts`) |
| Customer A | Customer B's order | 404 | yes (`auth.test.ts:168`) |
| Customer | staff review action | 403 | **no** direct test |
| Unauthenticated | `/panel/*` | redirect | yes (e2e `admin-authz.spec.ts`) |
| `STAFF` | pricing write | 403 | yes |
| `STAFF` | **catalogue write** | 403 | **no** — and the code allows it (`OPEN_ITEMS.md` §7) |
| `ADMIN` | pricing write | allow + audit | yes |
| **Expired session** | any action | re-auth, no leak | **no** |

Add: **T-13** guest-vs-guest `Configuration` access; **T-14** an expired
`Session` row → every owner-scoped read returns nothing and no action
mutates; **T-15** a `CUSTOMER` calling a design-review operation.

### Priority 3 — §21.4's E2E journeys

§21.4 lists seven required journeys. Current state:

| # | Journey | Status |
|---|---|---|
| 1 | Wall art: browse → configure → warning acknowledged → cart → checkout → order | ✅ `checkout.spec.ts` |
| 2 | **Kitchen tile: all three installation variants; summary states what the customer receives** | ❌ **missing** |
| 3 | Large product 120×120 → module layout shown → snapshot records modules | ⚠️ partial — `cart.spec.ts` prices and adds 120×120 but asserts nothing about the module layout or the snapshot |
| 4 | Custom upload → IP checkbox → warnings → order → `DESIGN_REVIEW` → staff approves | ✅ `custom-upload.spec.ts` + `design-review-customer.spec.ts` |
| 5 | **Floor element: exact dimensions required, matching warning acknowledged** | ❌ **missing** |
| 6 | Two different configurations of one product in one cart | ✅ `cart.spec.ts` |
| 7 | **Refresh and browser-back mid-configuration; state preserved** | ❌ **missing** — and this is the URL-state mechanism §7.1 calls out as "almost always broken in hand-rolled configurators" |

Also absent from E2E, all real customer paths: guest order lookup
(`/zamowienie/sprawdz`), the support-request form, review submission after
`COMPLETED`, product search, collections, blog, FAQ, password login (only
registration is exercised), and logout.

### Priority 4 — behaviours with no test at all

- **Payment lifecycle beyond bank transfer.** Correctly none: no provider
  is connected (`OPEN_ITEMS.md` §1). Writing callback tests would be
  coverage theatre. `przelewy24.ts` is unit-tested without network calls,
  which is the right treatment. **Leave as is.**
- **`mergeGuestCartIntoUser`** has integration coverage via
  `accounts.spec.ts` (e2e) but no direct unit/integration test of the
  three-way case: guest cart + user cart + the same signature on both
  sides, including the clamp.
- **`applyUpdateCartItemConfiguration` leaving a duplicate `Configuration`**
  (BUG-21) — the cart-line merge is tested; the saved-project side is not.
- **`revalidatePath` scope.** P1-5's fix (layout-scope invalidation) is
  described in the audit as "covered by e2e badge assertion"; no such
  assertion exists in `tests/e2e/cart.spec.ts`.
- **Sitemap and robots content.** No test asserts which routes appear.
- **`OrderItem.snapshot` completeness.** The immutability test is strong;
  nothing asserts the snapshot *contains* the fields §6.8 requires, which
  is why BUG-19's omissions went unnoticed.
- **Component tests.** `ARCHITECTURE.md` §21.1 lists a Component layer
  ("Vitest + Testing Library — configurator steps, validation display, cart
  UI"). It does not exist: `tests/component/` was never created, there is
  no `@testing-library/*` dependency, and `vitest.config.ts` is
  `environment: 'node'` with no jsdom project. The 1 525-line
  `Configurator.tsx` has no test of its own at any layer except through
  e2e.

---

## Tests that are weak or likely to become flaky

| Test | Concern |
|---|---|
| `cart-operations.test.ts:378` "Duplikuj … raises its quantity" | Sequential; passes with the racy implementation. Should be concurrent (T-07). |
| `cart-operations.test.ts:391` "duplicating never pushes past the maximum" | Also sequential; the clamp is exercised, the race is not. |
| Every e2e spec | Known parallel-contention flake (`fillReliably` timeouts). `fullyParallel: true` with a shared database and shared seeded accounts. Consider `workers: 1` for the specs that log in, or per-worker account fixtures. |
| E2E against the **dev** database | `playwright.config.ts` runs `npm run build && npm run start`, which uses `DATABASE_URL`. That is why the dev database now holds 166 orders and a leftover `test-e2e-wzor` design. Point e2e at `TEST_DATABASE_URL` (ARCH-03). |
| `admin-*.test.ts` breadth | Thorough on happy paths and authorization; thin on invalid input (e.g. negative prices, absurd `sortOrder`, oversized text) for most entities. `admin-pricing` is the exception and the model to copy. |

---

## Test matrix — feature by feature

Coverage quality: ●●● strong · ●●○ adequate · ●○○ thin · ○○○ none

| Feature | Implementation | Existing tests | Quality | Missing cases | Risk | Recommended | Pri |
|---|---|---|---|---|---|---|---|
| Money / VAT / rounding | `domain/money` | `unit/money` (37) | ●●● | — | low | — | — |
| Pricing engine | `domain/pricing` | `unit/pricing` (39) | ●●● | — | low | — | — |
| Modules | `domain/modules` | `unit/modules` (23) | ●●● | — | low | — | — |
| Dimensions | `domain/dimensions` | `unit/dimensions` (22) | ●●● | — | low | — | — |
| Feasibility | `domain/feasibility` | `unit/feasibility` (32) | ●●● | — | low | — | — |
| Personalization | `domain/personalization` | `unit/personalization` (26) | ●●● | unbounded text when no spec exists | **high** | T-11 | P1 |
| **Compatibility / rights** | `domain/compatibility` | `unit/compatibility` (17) | ●○○ | **every write-path case** | **critical** | T-03 | **P0** |
| **Step machine** | `domain/configuration` | `unit/configuration` (30) | ●○○ | **every write-path case** | high | T-10 | P1 |
| Configurator pricing | `server/configurator` | `unit/configurator-server` (33) | ●●○ | default-selection determinism | high | T-05 | P1 |
| Cart identity & quantity | `operations/cart` | `integration/cart-operations` (23) | ●●● | concurrent duplicate | med | T-07 | P1 |
| Cart merge on login | `cart/merge-guest-cart` | e2e only | ●○○ | three-way merge + clamp | med | direct integration test | P2 |
| Saved projects | `operations/cart` | `integration/cart-operations` | ●●○ | duplicate `Configuration` after edit | med | BUG-21 test | P2 |
| Order creation | `orders/create-order` | `integration/create-order` (14) | ●●● | stale quantity between read and claim | med | BUG-13 test | P2 |
| Order snapshot | `orders/snapshot` | `soft-delete-invariant` (1) + create-order | ●●○ | required-field completeness | med | assert §6.8 fields | P2 |
| **Guest order lookup** | `repositories/orders` | none negative | ●○○ | **wrong / short / long / empty token** | **high** | T-12 | **P1** |
| Delivery pricing | `domain/checkout/delivery` | `unit/delivery-pricing` (9) | ●●○ | net-vs-gross threshold | med | T (BUG-08) | P2 |
| Shipping weight | `domain/shipping/weight` | `unit/shipping-weight` (10) | ●●○ | packaging weight excluded | low | note | P3 |
| Upload validation | `upload/inspect-file` | `unit` (17) + `integration` (16) | ●●● | DPI/aspect never reached in prod | med | BUG-11 | P2 |
| Design review | `operations/design-review` | integration (10) | ●●○ | orphaned file on re-upload | low | BUG-15 | P2 |
| **Auth throttling** | — | none | ○○○ | **everything** | **critical** | T-01 | **P0** |
| **Mailer secrets** | `mail/mailer` | `integration/mailer` (4) | ●○○ | **OTP not logged** | **critical** | T-02 | **P0** |
| Authorization matrix | various | `authz` (9), `auth` (9) | ●●○ | 4 of 10 §16.2 rows | high | T-13/14/15 | P1 |
| Admin CRUD | `operations/admin-*` | 25 files (~210) | ●●○ | invalid input breadth | med | copy `admin-pricing`'s style | P2 |
| **Admin list pagination** | `repositories/admin-*` | none | ○○○ | **truncation** | high | T-08 | P1 |
| Audit logging | `audit/write-audit-log` | `admin-audit-log` (4) | ●●○ | one per mutation type | low | — | P3 |
| **Catalogue "from" price** | `ProductCard`, product page | none | ○○○ | **net vs gross, reachability** | high | T-04 | P1 |
| SEO (sitemap/robots/JSON-LD) | `app/sitemap.ts`, `robots.ts` | none | ○○○ | route coverage, noindex | med | assert route sets | P2 |
| UI components | `ui/**` | none | ○○○ | **the entire layer** | med | add a component layer | P2 |
| Rendering mode / caching | build config | none | ○○○ | static vs dynamic | med | assert in CI | P2 |

---

## Recommended additions, in order

1. **T-12** — guest order lookup with a bad token. Highest value per line in the repo.
2. **T-03** — compatibility on the write path (unblocks SEC-03).
3. **T-01, T-02** — auth throttling and mailer secrecy (unblock SEC-01, SEC-02).
4. **T-04, T-05** — starting price and default-selection determinism.
5. **T-07, T-10, T-11** — the concurrency and input-bound gaps.
6. **T-08, T-09** — admin pagination and the three role tightenings.
7. **T-13/14/15** — close §16.2's matrix.
8. **E2E journeys 2, 5 and 7** from §21.4 — kitchen-tile variants, floor-element exact size, refresh/back mid-configuration.
9. **Stand up the component layer** (`tests/component`, jsdom project, Testing Library) and start with `CheckoutForm` and `Configurator`'s breadcrumb/size steps.
10. ~~**CI** (ARCH-01)~~ — **done 2026-08-31.** Two GitHub Actions jobs against a Postgres service container. Note for anyone adding tests: CI seeds both databases, because the catalogue-sweeping tests pass vacuously on an empty one, and it applies every migration from zero on every run — something `migrate dev` locally never proves.
