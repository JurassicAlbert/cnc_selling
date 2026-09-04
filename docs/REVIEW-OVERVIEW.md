# Review overview — independent audit, 2026-08-30

**Reviewer:** independent audit pass (a different agent from the one that
built the project and from the one that wrote `docs/AUDIT-2026-08-30.md`).
**Commit reviewed:** `e774e40` "Eliminate every duplicate a customer can create", branch `main`.
**Scope:** whole repository — schema, migrations, domain, server, actions,
operations, repositories, routes, UI, admin panel, tests, config, docs.
**Method:** read the implementation first; verify claims against running
code, a live database, a real browser and a real production build. Nothing
below is asserted from a filename or a comment.

Companion documents:
`REVIEW-DETAILED.md` · `REVIEW-TEST-COVERAGE.md` · `REVIEW-UX-UI.md` ·
`REVIEW-SECURITY-RELIABILITY.md` · `REVIEW-PERFORMANCE.md` ·
`AI-IMPLEMENTATION-GUIDE.md` · **`AI-CHECKLIST.md`** (start there to
implement).

---

## Verified baseline

Everything in this table was actually run during the review, not inferred.

| Check | Command | Result |
|---|---|---|
| Unit + integration tests | `npm test` | **831 passed / 831**, 71 files, 52s |
| Types | `npm run typecheck` | clean, exit 0 |
| Lint + Polish-literal rule | `npm run lint` | clean, 537 files |
| Production build | `npm run build` | **succeeds**, 3 Turbopack warnings |
| Live storefront | dev server + browser | home, product, cart, checkout render correctly |
| Database | direct SQL against `DATABASE_URL` | 8 products, 13 designs, 166 orders, 466 configurations |

E2E (`npm run e2e`) was **not** re-run in this pass — the previous session
recorded a known parallel-contention flake pattern, and re-litigating it
would not have changed any finding here. Treated as "previously verified,
not re-verified" rather than as evidence.

---

## Remediation progress — 2026-08-31

Everything below this section is the audit as written on 2026-08-30 and is
left unchanged. This is what has been fixed since. `AI-CHECKLIST.md` remains
the authoritative list.

| Check | Result |
|---|---|
| `npm test` | **1031 passed / 1031**, 85 files, 80s (was 831 / 71) |
| `npm run typecheck` | clean |
| `npm run lint` | clean, 561 files |
| `npm run build` | succeeds, same 3 pre-existing warnings |
| `npx playwright test tests/e2e/security-headers.spec.ts` | 10 passed / 10 |
| The whole CI sequence, against a virgin database | 27 migrations from zero · seed from empty · **931 passed** · build clean |

**Closed:** SEC-01 · SEC-02 · SEC-03 · SEC-04 · SEC-05 · SEC-10 · ARCH-01 ·
BUG-02 · BUG-03 · BUG-05 · BUG-06 · BUG-07 · BUG-24 · BUG-35 · the
carried-forward P1-8. **0 P0 remain.**

**One thing in this round could not be verified from here, and is called out
rather than glossed:** the GitHub Actions workflow (ARCH-01) has never
executed on GitHub. Everything it runs was reproduced locally against a
throwaway database created, migrated and seeded exactly the way CI creates
one — 27 migrations from zero, 931/931 tests, a clean build — but the
runner-specific parts are unproven. The branch is pushed; opening the PR is
what starts the first run (the workflow triggers on `pull_request` and on
pushes to `main`).

**Found during remediation, not in the original audit:**

- **BUG-35 (P0)** — every active product had blocked combinations and two
  were entirely unbuildable while still listed and priced. Invisible before
  because the advertised price was a static column and no test asserted that
  a listed product could actually be ordered. Closed on the owner's ruling
  that a product sold with its pattern already fixed must not have that
  pattern re-measured against the customer's chosen size.
- **A conflict between SEC-05 and PERF-01** — a nonce-based CSP and
  static/ISR/PPR are mutually exclusive. PERF-01 step 1 is unaffected; steps
  2 and 3 now need an owner decision. Detail in `REVIEW-PERFORMANCE.md`
  Finding 1.

**One published figure was corrected twice and ends where it started.** The
audit estimated the wall-art product's real cheapest configuration at
~190,40 zł gross. Measured with pattern feasibility still gating, it was
648,89 zł; once that gating was removed on the owner's instruction it is
190,40 zł again. The original estimate was right and the intermediate figure
was an artifact of a bug — recorded here rather than quietly dropped.

---

## Overall quality

**This is a well-built codebase.** That needs saying plainly, because the
rest of this review is a list of problems and would otherwise misrepresent
the whole.

The parts that are genuinely strong, verified by reading the code rather
than trusting the docs:

- **Money and pricing.** Integer grosze end to end, half-up rounding done
  on integers with exact remainder arithmetic, basis points instead of
  floats, VAT computed on the unit price. `domain/pricing` is pure and has
  39 unit tests. This is the part most projects get wrong and this one does
  not.
- **Order snapshots.** `OrderItem.snapshot` is a real immutable JSON
  document, and order rendering genuinely never joins to a live catalogue
  row. A renamed material cannot corrupt a past order.
- **Server-side price authority.** `createOrder` re-prices every line from
  the catalogue and current `PricingSettings` and rejects on any mismatch.
  No client total is trusted anywhere.
- **Idempotency and concurrency**, after the 2026-08-30 round: order
  `idempotencyKey @unique`, cart rows claimed as the transaction's first
  write, atomic quantity adjustment, `CartItem @@unique([cartId,
  configurationSignature])`, conditional staff mutations. The integration
  tests for these are real concurrency tests, not sequential stand-ins.
- **The `actions/` ↔ `operations/` boundary** and the automated guard
  (`tests/unit/server-action-boundary.test.ts`) that keeps ~80 endpoints
  from re-becoming forgeable.
- **Payment honesty.** `PaymentMethodConfig.isConnected` structurally gates
  checkout; an unconnected provider is rejected exactly like a nonexistent
  one. There is no fake payment path anywhere, and no fake carrier
  tracking. The "no fake functionality" rule is genuinely respected.
- **Upload pipeline.** Magic-byte sniffing, real DOMPurify SVG
  sanitization with an `href` hook, PDF active-content rejection,
  EXIF-stripped previews, opaque storage keys, an authorizing file route
  that 404s rather than 403s.
- **Documentation.** `ARCHITECTURE.md`, `HANDOVER.md`, `CHECKLIST.md` and
  the in-file header comments are unusually good — most decisions have a
  recorded reason, including the reversals.

---

## The biggest risks

Three things would hurt a real shop on day one. All three are **new
findings** — none appears in `docs/AUDIT-2026-08-30.md`, `CHECKLIST.md` or
`OPEN_ITEMS.md`.

### 1. Authentication is completely unthrottled (SEC-01, P0)

Login, registration and OTP-request all call `auth.api.signInEmail(...)`
**directly from Server Actions**. Better Auth's rate limiter lives in its
HTTP router's `onRequest` hook, so it only ever runs for requests that go
through `/api/auth/*`. This application never sends its own login through
that path. Result: unlimited password guessing, and an unlimited
"send me a code" endpoint that will email any address on demand at your
Resend cost.

### 2. One-time login codes are written to the logs (SEC-02, P0)

When `RESEND_API_KEY` is unset — the default, and the state the project
documents as normal — `UnconfiguredMailer` logs the message subject, and
the OTP subject line *contains the code*. There is no production guard.
Anyone who can read application logs can sign in as any user. This also
breaches §16.1's "No PII in logs beyond user id" (recipient addresses are
logged too).

### 3. Availability and compatibility are never enforced server-side (SEC-03, P0)

`domain/compatibility` is correct and well tested — and it is only ever
called to decide what the UI *displays*. The write path
(`priceAndValidateSelections`, used by both add-to-cart and checkout)
resolves material, design and finish from **unfiltered** maps. Nothing
checks `Material.isAvailable`, `Design.isActive`, `Design.rightsStatus`,
`DesignMaterial` narrowing, or an installation variant's thickness cap.

The schema comment on `Design.rightsStatus` says sellability is "enforced
by a query filter, not by discipline". On the write path there is no
filter. A crafted request — or an ordinary customer on a stale URL after
staff retire a pattern — can order a design the shop has no right to sell.

### And the one a customer sees first

The catalogue advertises **`minPriceGrosze`, a net clamp, as if it were the
price** (BUG-02, P1). Every other price on the site is gross. Measured
against the live database:

| Product | Shown as | Cheapest real configuration (gross) | Gap |
|---|---|---|---|
| `obraz-drewniany-z-grawerem` | od 150,00 zł | ≈ 190,40 zł | **+27%** |
| `szachownica-z-grawerem` | od 150,00 zł | ≈ 220,85 zł | **+47%** |
| `bransoletka-z-grawerem` | od 40,00 zł | ≈ 55,71 zł | **+39%** |

The same number is emitted as `Offer.price` in the Schema.org JSON-LD.

---

## The strongest parts

Listed so a future agent does not re-audit them:

1. `domain/money`, `domain/pricing`, `domain/modules`, `domain/dimensions`,
   `domain/feasibility` — pure, correct, well tested.
2. `OrderItem.snapshot` immutability (has a real mutate-and-check test).
3. `createOrder`'s re-pricing, cart claiming and dual idempotency guards.
4. `server/actions/` ↔ `server/operations/` split + its guard test.
5. Guest session cookie: HMAC-signed, length-guarded `timingSafeEqual`.
6. Order `accessToken` comparison: constant-time, length-guarded.
7. `/api/plik/[fileId]`: authorizes before storage, 404s on failure, SVG
   forced to `attachment`.
8. SVG sanitization (DOMPurify + a real `href` hook), PDF active-content
   rejection.
9. Audit logging: **every** admin operations module writes one — verified
   by scanning all 25 files, none missing.
10. Payment/tracking honesty — no simulated states anywhere.

---

## Most important architectural conclusions

**A. The performance architecture is half-built, and the enforced half is
the smaller one.** MUI is lint-banned from storefront Server Components to
protect LCP. Meanwhile a production build shows **91 dynamic routes and 2
static ones** — not a single page is prerendered, there is no
`React.cache`, no `unstable_cache`, no `'use cache'`, no `revalidate`, and
`cacheComponents` is off. `StorefrontChrome` calls `getSession()` and
`cookies()` on every storefront page, which is what forces every route
dynamic. §18's "catalogue pages are RSC + ISR" is not implemented. The
cheap, high-leverage fix (cache the chrome's static halves, enable
`cacheComponents`, wrap the cart badge in `Suspense`) is worth more than
everything the lint rule protects.

**B. Domain functions are written, tested, and then not called.** Three
separate cases: the compatibility filters (SEC-03), the step-entry guards
`checkStepAppliesToProductType` / `checkStepEntry` / `isStepEnterable`
(BUG-06), and `zod` — a declared dependency imported nowhere (BUG-07). All
three are documented as enforced; `docs/CHECKLIST.md:81` states the step
guards "reject e.g. a THICKNESS selection on WALL_ART", which the running
application does not do. **The recurring defect is a missing call site, not
missing logic**, and the unit tests cannot see it because they test the
pure function directly. This is the single most useful pattern in the
review: when a rule matters, assert it through the *write path*.

**C. Hiding a feature in the UI did not stop it reaching the order.**
Pattern selection is switched off (`PATTERN_SELECTION_ENABLED = false`) but
`computeDefaultSelections` still auto-picks `options.designs[0]`. The live
cart reads **"Dąb · Wzór podstawowy — do zastąpienia · Olejowanie"** — an
internal placeholder whose name literally means "basic pattern — to be
replaced", shown to the customer and headed for the immutable order
snapshot and the production sheet. The pick is also non-deterministic: the
query has no `orderBy` and all 13 `Design.sortOrder` values are `0`.

**D. The admin panel is complete in breadth and capped in depth.** Every
model has real CRUD, real audit logging and real role gates. But
`listOrdersForAdmin` takes 100 rows with client-side pagination and no
"showing 100 of N" — the development database already holds **166 orders**,
so 66 are unreachable in the panel *today*. Customers cap at 100 and the
audit log — the compliance record — at 200.

**E. There is no CI.** No `.github/workflows`, no hooks. A project this
disciplined about TDD runs its 831 tests only when a human remembers to.
**Fixed 2026-08-31 (ARCH-01)** — two GitHub Actions jobs against a Postgres
service container; see the progress section above for what was and was not
verified.

---

## Highest-priority fixes, in order

1. ~~**SEC-01** — throttle login / register / OTP-request.~~ **Done 2026-08-31.**
2. ~~**SEC-02** — never log OTPs; fail loudly when the mailer is unconfigured in production.~~ **Done 2026-08-31.**
3. ~~**SEC-03** — enforce `domain/compatibility` on the write path.~~ **Done 2026-08-31.**
4. ~~**BUG-02** — show a gross, achievable "from" price (and fix the JSON-LD).~~ **Done 2026-08-31.**
5. ~~**BUG-03** — stop silently attaching a placeholder design; make defaults deterministic and filtered.~~ **Done 2026-08-31.**
6. ~~**SEC-05** — add security headers and a CSP (§16.1, never implemented, never recorded).~~ **Done 2026-08-31.**
7. **PERF-01** — make catalogue pages cacheable again. **All three steps now need an owner decision** — steps 2-3 conflict with SEC-05's nonce, and step 1 was attempted and backed out because its invalidation could not be demonstrated (`REVIEW-PERFORMANCE.md` Finding 1). The request-scoped half shipped as PERF-02/PERF-05: 36 → 26 queries on a product page.
8. **ADMIN-01** — real pagination for orders / customers / audit log.
9. **BUG-04** — show shipping and VAT on the order confirmation.
10. ~~**BUG-06 / BUG-07** — call the step guards; either use `zod` or drop it.~~ **Done 2026-08-31** — zod adopted (§2 already required it), and the step guards now run on the write path.

**And, above all of the remaining items: ARCH-01 (CI).** 88 tests were added
across this remediation round, one of them the only guard on a policy that
fails silently, and nothing runs any of them automatically.

---

## Counts

Counted from `AI-CHECKLIST.md`, which is the authoritative list.

| | P0 | P1 | P2 | P3 | Total |
|---|---|---|---|---|---|
| New issues, this review | 3 | 11 | 34 | 14 | **62** |
| Carried forward (P1-8, P2-9, P2-11) | — | 1 | 2 | — | **3** |
| **Tracked total** | **3** | **12** | **36** | **14** | **65** |

By category — these overlap (one issue can be both a security and a
correctness problem), so they sum to slightly more than 62:

| Category | Count |
|---|---|
| Security / reliability | 13 |
| Correctness / ecommerce | 14 |
| UX / UI | 13 |
| Architecture / process / SEO | 10 |
| Accessibility | 5 |
| Performance | 5 |
| Admin | 3 |

Plus **15 named missing tests** (T-01…T-15) and three unbuilt E2E journeys
from §21.4 — see `REVIEW-TEST-COVERAGE.md`.

Full detail, evidence and acceptance criteria for every ID: `REVIEW-DETAILED.md`.
Where to start implementing: `AI-CHECKLIST.md`.
