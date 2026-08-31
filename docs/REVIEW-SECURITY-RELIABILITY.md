# Security & reliability review — 2026-08-30

Commit `e774e40`. Full issue detail (evidence, fixes, acceptance criteria)
lives in `REVIEW-DETAILED.md`; this document is the security-shaped view of
the same findings plus the threat-model reasoning behind them.

---

## Summary

| Severity | Count | IDs |
|---|---|---|
| P0 | 3 | SEC-01, SEC-02, SEC-03 |
| P1 | 3 | ~~SEC-04~~, ~~SEC-05~~, ADMIN-01 · **+ SEC-10, found 2026-08-31** |
| P2 | 6 | SEC-06, SEC-07, SEC-08, SEC-09, BUG-17, BUG-18, BUG-22 |

**Assessment.** The authorization *model* is sound and, since the
2026-08-30 `actions/` ↔ `operations/` split, structurally enforced. Object
ownership, order-token comparison, guest-session signing and file access
are all correct and were verified by reading, not assumed. What is missing
is the perimeter: **nothing throttles authentication, nothing sets a
security header, and the business rules that decide what may be sold are
enforced for rendering but not for writing.**

> **Status update, 2026-08-31.** All three perimeter gaps in that sentence
> are now closed: SEC-01 (rate limiting, Postgres-backed), SEC-02 (OTP out
> of the logs), SEC-03 (sellability enforced on the write path), SEC-05
> (security headers + a nonce-based CSP) and SEC-04 (three operations moved
> to ADMIN, with the gate asserted twice so a test can reach it). **SEC-10**
> was found while verifying SEC-04 and fixed the same day: `next/link`
> prefetch was firing a GET route handler that builds a RODO export and
> writes an audit row, so opening a customer page logged an export nobody
> performed. Remaining in this document: **ADMIN-01** at P1, and the six P2s.

---

## What is correct (verified, do not re-audit)

| Control | Where | How it was verified |
|---|---|---|
| Server Actions never trust a caller-supplied actor | `server/actions/*` are thin wrappers; every `apply*(actor, …)` lives in a non-`'use server'` module | read all 37 action files + `tests/unit/server-action-boundary.test.ts` |
| Guest session token is HMAC-signed and length-guarded | `session/guest-session.ts` | read; `timingSafeEqual` guarded against `RangeError` |
| Order `accessToken` compared in constant time | `repositories/orders.ts` | read; explicit length check before `timingSafeEqual` |
| "404, not 403" for anything whose existence must not leak | `requireStaffSession`, `/api/plik`, `requireOwnedUploadedFile`, guest order lookup | read; e2e `admin-authz.spec.ts` covers the panel case |
| Object ownership re-derived from the session | `session/ownership.ts` + every cart/design/configuration operation | read; `cart-operations.test.ts` covers guest-vs-guest |
| Prices never trusted from the client | `create-order.ts` re-prices every line and rejects mismatches | read; `create-order.test.ts` |
| Order idempotency + cart claiming | `create-order.ts` | read; four real concurrency tests |
| Upload: magic bytes, not the declared type | `upload/inspect-file.ts` | read; `upload.test.ts` |
| SVG sanitized (DOMPurify + an `href` hook blocking non-fragment refs) | `inspect-file.ts` | read; the hook is a genuine addition over DOMPurify's defaults |
| SVG never served inline | `/api/plik/[fileId]` forces `Content-Disposition: attachment` for `image/svg+xml` | read |
| Storage keys are opaque UUIDs, never derived from user input | `actions/upload.ts` | read |
| PDF active content rejected | `containsSuspiciousPdfTokens` | read; honest about being a heuristic |
| Role elevation impossible via sign-up | `auth.ts` sets `role: { input: false }` | read |
| Every admin mutation is audit-logged | all 25 `operations/admin-*.ts` | scanned all 25 — **none missing** |
| Pricing writes are ADMIN-only and append-only | `admin-pricing.ts` | read; `applyPublishPricingVersion` is the only `isActive` writer |
| No fake payment / tracking / email states | `PaymentMethodConfig.isConnected` gates checkout; `Shipment` is staff-managed; mailer reports `{ sent: false }` | read |
| Server Action CSRF | framework-level Origin↔Host check, on by default | `node_modules/next/dist/docs/01-app/02-guides/server-actions.md` |

---

## P0 findings

### SEC-01 — Authentication is entirely unthrottled

Login, registration, OTP request and OTP verification are Server Actions
calling `auth.api.*` **directly**. Better Auth's rate limiter is installed
in its HTTP router's `onRequest` hook
(`node_modules/better-auth/dist/api/index.mjs:163-169`), which only runs
for traffic through `auth.handler` — i.e. `/api/auth/*`. This application's
own forms never take that path, and `betterAuth({…})` sets no `rateLimit`
option.

**Attack surface:**
- unlimited password guessing (`signInEmail` has no attempt counter);
- unlimited outbound email — `submitOtpRequest` will mail any address on
  demand, as many times as asked, at the shop's cost and reputation;
- unlimited account creation.

**Bounded by luck, not design:** OTP *verification* is capped at 3 attempts
by the plugin (`plugins/email-otp/routes.mjs:246-253`) with a 300 s expiry,
so the six-digit code itself is not brute-forceable. Nothing else is
bounded.

§16.1 requires rate limits on "auth attempts". Fix and tests:
`REVIEW-DETAILED.md` SEC-01 / `REVIEW-TEST-COVERAGE.md` T-01.

### SEC-02 — One-time login codes are logged in plaintext

`renderSubjectAndText` builds the OTP subject as
`` `Twój kod ${purpose}: ${otp}` ``, and `UnconfiguredMailer.send` logs
`{ template, subject, to }`. `createMailer()` selects that implementation
whenever `RESEND_API_KEY`/`EMAIL_FROM` are unset, **with no environment
guard** — and unset is the project's documented default state.

Anyone who can read application logs can sign in as any user without a
password. Recipient addresses are logged too, against §16.1's "No PII in
logs beyond user id". `logger.ts`'s own header documents the practice of
grepping the log for an OTP, which confirms the behaviour rather than
excusing it.

The fix must include a **production guard**: an unconfigured mailer in
production should fail loudly, not degrade to logging secrets. See T-02.

### SEC-03 — Sellability is enforced for display only

`domain/compatibility/resolve.ts` correctly implements §7.2's filters
(`isAvailable`, `isActive`, `rightsStatus ∈ {APPROVED_COMMERCIAL,
PUBLIC_DOMAIN}`, `DesignMaterial` narrowing, variant thickness cap) and is
called **only** from `resolve-options.ts`, whose output feeds the UI.

`priceAndValidateSelections` — the shared write path for add-to-cart, cart
edit and checkout re-pricing — reads material, design and finish from
`getConfiguratorProductData`'s maps, which are built with **no `where`
clause and no post-filter**. It checks completeness and nothing else.

Threat model:
- **Unprivileged remote attacker.** A crafted Server Action POST with any
  `designId` that has a `ProductDesign` row prices and orders successfully.
- **Ordinary customer, no intent.** Staff deactivate a pattern or material
  (the panel's whole delete story is deactivate-not-destroy). A saved
  project, a shared configurator URL or a bookmark still works. Nothing
  refuses it.

The schema comment on `Design.rightsStatus` says sellability is "enforced
by a query filter, not by discipline". On the write path there is neither.
A `RESTRICTED` or `REQUIRES_PERMISSION` design can be ordered and
manufactured — a copyright exposure, not a UX defect (brief §12).

**Currently loaded?** No — verified by SQL: zero non-sellable designs and
zero unavailable materials are linked to an active product today, and the
single `DesignMaterial` narrowing row belongs to a leftover e2e design
attached to no product. The hole is live and unloaded; it arms itself the
first time staff retire anything.

Fix: call the existing `resolveOptions` from
`priceAndValidateSelections` — do not re-implement the rules. See T-03.

---

## P1 findings

### SEC-04 — `STAFF` can redirect payments and destroy accounts — **RESOLVED 2026-08-31**

Of 25 `operations/admin-*.ts` modules, only `admin-pricing`, `admin-staff`
and `admin-analytics` require `ADMIN`. Three of the remaining 22 are not
catalogue work and are separable from the open "may STAFF edit the
catalogue?" question (`OPEN_ITEMS.md` §7):

1. **`applyUpdateStoreSettings`** — writes `StoreSettings.bankAccountNumber`,
   the account every bank-transfer customer is told to pay into. A
   compromised `STAFF` account redirects all incoming payment.
2. **`applyAnonymizeCustomer`** — scrubs identity **and deletes `Session`
   and `Account` rows**, permanently ending the customer's ability to sign
   in. Irreversible, and §16.3 grants `STAFF` only "customers (read)".
3. **`applyUpdateEmailTemplate`** — rewrites customer-facing email bodies,
   including `verification-otp`.

§16.3 assigns all three to `ADMIN`. No owner decision is needed. Consider a
second confirmation step on the bank-account field specifically.

**Fixed 2026-08-31.** All three wrappers gate on `requireAdminSession()`,
and — because that gate reads `next/headers` and is therefore unreachable
from any test in this repository — each `apply*` also calls
`refuseUnlessAdmin(actor)` as its first statement. The doubling is the
point: SEC-03 was a correct, unit-tested rule that the write path never
called, and "enforced only where no test can look" is the same shape. The
panel followed the enforcement, so a `STAFF` is not offered controls the
system will refuse. The bank-account confirmation is carried as **UX-22**,
deliberately not folded into a security fix.

### SEC-10 — Opening a customer's page performed a RODO export — **found and fixed 2026-08-31**

Not in the original audit. Found while verifying SEC-04 in a browser.

`/panel/klienci/[id]/eksport` is a GET route handler **with a side effect**:
it builds the customer's full RODO Art. 15 export and writes an `AuditLog`
row. The page linked to it with `next/link`, and Next prefetches `<Link>`
targets — so merely opening a customer's page produced
`GET …/eksport?_rsc=… → 200` and an audit row claiming an export had been
performed, attributed to a staff member who had only looked at the page.

**Threat-model note.** The exposure is not confidentiality — the reader was
already authorized to see that customer. It is **integrity of the compliance
record**: §16A.2 invariant 4 makes the audit log the account of what
happened, and it was reporting RODO accesses that never occurred. A log that
is wrong in the direction of over-reporting is still wrong, and it is the
artifact a regulator would be shown.

Fixed in two layers: the link is a plain `<a>` (the convention
`/api/plik/[fileId]` already followed), and the route refuses
`next-router-prefetch` / `purpose: prefetch` before the session read.

**Rule worth carrying:** a GET route handler with a side effect must never
be reachable from a `<Link>`. Nothing else in the codebase currently has
one.

### SEC-05 — No security headers, no CSP — **RESOLVED 2026-08-31**

A case-insensitive search across the repository for
`Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`,
`Strict-Transport-Security`, `Referrer-Policy` and `Permissions-Policy`
returned **zero matches**. `next.config.ts` defined no `headers()`.

§16.1 requires "Security headers + strict CSP". The SVG half of that
sentence was implemented; the headers half was never built and — unlike the
rate limits — was **not recorded in `CHECKLIST.md` or `OPEN_ITEMS.md`**, so
nobody was tracking it.

This mattered here specifically because the application renders
customer-derived image previews, admin-uploaded images served from
`public/`, and `dangerouslySetInnerHTML` JSON-LD.

**Now:** five static headers plus `poweredByHeader: false` from
`next.config.ts`, and a nonce-based CSP per request from `src/proxy.ts`, with
the policy itself in the pure, unit-tested `src/server/security/headers.ts`.
`script-src` is strict (`'nonce-…' 'strict-dynamic'`, no `'unsafe-inline'`);
`style-src` keeps `'unsafe-inline'` because Emotion injects styles from the
browser and `error.tsx` boundaries can never receive a nonce — a nonce there
would *disable* that allowance under CSP3 and break every client-side style,
so this is a considered position, not an oversight. Enforced by default,
`CSP_MODE=report-only|off` as the operator escape hatch.

**Threat-model note.** What this buys, concretely: the JSON-LD blocks and
any future injection into rendered copy can no longer execute script,
because there is no `'unsafe-inline'` and an attacker cannot guess a
128-bit per-request nonce. `frame-ancestors 'none'` closes clickjacking on
`/panel`. `Referrer-Policy` stops the guest order `?token=` (BUG-22) leaking
to third parties via `Referer`. What it does **not** buy: CSS-based data
exfiltration is still possible in principle, because of the `style-src`
decision above.

Full detail, including the verification and the conflict this creates with
PERF-01: `REVIEW-DETAILED.md` SEC-05.

### ADMIN-01 — The audit log silently forgets

Beyond the operator impact (`REVIEW-DETAILED.md`), the audit-log truncation
is a *compliance* problem: §16A.2 invariant 4 makes the log the record of
every mutation, and `/panel/dziennik-zdarzen` shows only the newest 200
entries with no pagination and no indication that more exist.

---

## P2 findings

| ID | Issue | Note |
|---|---|---|
| **SEC-06** | Runtime writes into `public/` | Documented as safe for a long-running Node host; §3 names Vercel, where it silently fails. No size cap (customer uploads have one). `ownerId` interpolated into a path with no `..` guard, while the sibling `deletePublicImage` does guard — not reachable today (callers pass cuids), but an asymmetry worth closing |
| **SEC-07** | RODO anonymization is partial | `Order` retains email, full name, phone and full address; `SupportRequest` retains email and name. Retention is legitimate for accounting; the gap is that the module presents the scrub as complete, nothing bounds retention, and no purge path exists |
| **SEC-08** | Upload limit resets with the cookie | The limiter keys on `sessionToken`; discarding the cookie mints a new one and resets the count. Fixing SEC-01's IP-aware limiter makes this nearly free |
| **SEC-09** | `/api/plik` buffers whole files | `storage.get()` loads up to 25 MB into memory per request; §16.1 says it streams. Also missing `nosniff` while serving user bytes `inline` |
| **BUG-17** | `robots.ts` allows everything | `/panel`, `/moje-konto`, `/koszyk` and bearer-token order URLs are all crawlable. Only `/szukaj` sets `noindex` |
| **BUG-22** | Order token travels in the query string | Correct constant-time comparison, weak transport: history, `Referer`, access logs. Mitigate with `Referrer-Policy` + `noindex`, or exchange the token for a short-lived cookie |
| **BUG-18** | `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` unset | Bound-closure Server Actions are used pervasively (`.bind(null, cartItemId)`); without a stable shared key, multi-instance or rolling deployments break them intermittently |

---

## Reliability, concurrency and idempotency

### Solid, verified by real concurrency tests

| Scenario | Behaviour | Guard |
|---|---|---|
| Two checkouts, same rendered form | one order; the second gets the first's | `Order.idempotencyKey @unique` |
| Two checkouts, two tabs, different keys | one order; the loser rolls back with `CART_CHANGED` | cart rows claimed as the transaction's first write |
| Racing `+`/`−` on quantity | both land; bounds hold | single atomic `updateMany` with the clamp in `where` |
| Double-clicked add-to-cart | one row, quantity 2 | `@@unique([cartId, configurationSignature])` + one retry |
| Double-clicked remove | no error | `deleteMany`, not `delete` |
| Concurrent first add (cart creation) | no 500 | `upsert` + P2002 retry |
| Double-clicked staff status change / mark-paid | one event, one email, one audit row | conditional `updateMany` on the expected state |
| Login with items in both carts | merged, quantities added, clamped | line-by-line merge in the login transaction |
| Duplicate support request / review / design comment | deduped or answered honestly | `dedupeKey @unique`, P2002 caught, time window |
| Order numbers under concurrency | unique | Postgres `INSERT … ON CONFLICT DO UPDATE RETURNING` |

That list is genuinely strong and represents the best work in the
repository.

### Gaps found in this pass

| ID | Scenario | Current | Risk |
|---|---|---|---|
| **BUG-05** | Two rapid "Duplikuj" clicks | read-then-write; one increment lost | Regression of the P0-3 fix from the same commit |
| **BUG-13** | Quantity edited in tab B while tab A checks out | order written with the stale quantity — the claim matches on id only | Customer charged for a quantity they changed |
| **BUG-12** | Response returns before the confirmation email is sent | `void mailer.send(…)`, no `after()` | On serverless, confirmation emails silently never send |
| **BUG-21** | Line B edited into line A's configuration | cart lines merge; a duplicate `Configuration` survives, hidden by read-side dedupe | Data drift, invisible |
| **BUG-15** | Design re-uploaded | previous `UploadedFile` row and blobs orphaned forever | Unbounded storage growth; superseded designs stay fetchable |

### Recovery behaviour

Verified good: a `PRICE_CHANGED` rejection happens **before** any write; a
`CART_CHANGED` loser rolls the whole transaction back; a mailer failure
never undoes a committed order; `revalidatePath('/', 'layout')` clears the
stale cart badge. The one honest weakness is that a customer whose
configuration became invalid gets a single generic message with no
indication of *which* option went away — which becomes noticeable as soon
as SEC-03 starts rejecting retired patterns.

---

## Explicitly not assessed, and why

- **Every payment-callback scenario** (duplicate callback, delayed
  callback, browser closed before callback, payment succeeded but order
  creation failed). No provider is connected — `OPEN_ITEMS.md` §1 — so
  there is no handler to test. `przelewy24.ts` is a real, spec-accurate,
  unit-tested client with no network calls; that is the correct state.
  Writing callback tests now would be fake coverage.
- **Real carrier behaviour.** No carrier API is integrated; `Shipment` is
  staff-maintained, honestly.
- **Production TLS / HSTS / proxy behaviour.** No production deployment
  exists to test against.
- **Load and stress behaviour.** Not run. The performance findings in
  `REVIEW-PERFORMANCE.md` are structural or measured from a build, never
  extrapolated from a load test that did not happen.
- **E2E suite.** Not re-run in this pass (see `REVIEW-TEST-COVERAGE.md`).
