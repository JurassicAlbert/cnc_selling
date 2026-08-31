# AI implementation guide

**Audience:** the next AI coding agent working on this repository.
**Written:** 2026-08-30, from the audit at commit `e774e40`.
**Read `AI-CHECKLIST.md` first** for *what* to do. This document is *how*.

---

## 0. Read these, in this order, before writing code

1. `AGENTS.md` — **this is not the Next.js in your training data.** Next 16
   renamed `middleware.ts` → `proxy.ts`, removed `experimental.ppr`, and
   introduced `cacheComponents` + `'use cache'`. The real docs are vendored
   at `node_modules/next/dist/docs/`. **Read the relevant one before
   writing framework code.** Guessing here has already cost this project
   real bugs.
2. `AI-CHECKLIST.md` — current state, next task.
3. `docs/REVIEW-DETAILED.md` — the issue you are about to fix.
4. `docs/ARCHITECTURE.md` — the section your change touches.
5. `docs/OPEN_ITEMS.md` — before concluding "X is missing", check whether X
   is blocked on the owner. Nine things are.

Installed versions, all newer than most training data. Check the vendored
docs or `node_modules`, never memory:

| | |
|---|---|
| Next.js **16.3.2** (Turbopack) | React **19.2.8** |
| MUI **9.3.1**, X Data Grid/Charts **9.12** | Prisma **7.9.1** |
| TypeScript **7.0.2** | Better Auth **1.7.1** |
| Vitest **4.1.11** | Playwright **1.62.1** |

---

## 1. Architecture that must be preserved

Do not "improve" any of this. Each was a deliberate decision with a
recorded reason, and several were paid for with a real bug.

### 1.1 The `actions/` ↔ `operations/` boundary

**Every export of a `'use server'` module is a public HTTP endpoint.** This
project learned that the expensive way (`AUDIT-2026-08-30.md` P0-1: ~80
endpoints accepting a forged actor).

```
src/server/operations/   plain modules. Real logic. Every applyXxx(actor, …). NO 'use server'.
src/server/actions/      'use server' ONLY. Thin wrappers: derive the actor, call operations, revalidate.
```

Wrappers forward with `Parameters<typeof ops.x>` / `ReturnType<typeof ops.x>`
so signatures cannot drift. `tests/unit/server-action-boundary.test.ts`
fails the build if an action module exports an `apply*`, takes a
`CurrentSession`, or takes the caller's own identity. **Never weaken that
test.**

### 1.2 The RSC / island split

`biome.json` forbids `@mui/material` inside `(marketing)`/`(shop)` Server
Components. `ThemeRegistry` is mounted only around genuine islands (cart,
checkout, configurator, account, order detail, patterns gallery, `/panel`).
A real Lighthouse run measured a globally mounted provider at 3.8 s LCP
(`CHECKLIST.md:104`).

**Do not mount MUI sitewide.** If you need MUI in a storefront page, put
the interactive part in `src/ui/islands/` and render it as a child, wrapped
in `ThemeRegistry`. That is what the lint message tells you to do; do it.

Storefront primitives (`src/ui/primitives/`) read MUI theme tokens as CSS
variables from `src/app/theme-vars.css`. When you change `theme.ts`, mirror
it there. **The CSS `font` shorthand does not carry `letter-spacing`** —
`font: var(--mui-font-h1)` silently resets tracking, which is why the
letter-spacing variables exist separately.

### 1.3 The domain layer is pure

`src/domain/**` imports nothing from Next or Prisma and does no I/O. That
is what makes the TDD rule practicable. `src/server/mapping/to-domain.ts`
is the **only** place allowed to convert between Prisma rows and domain
types, and it is unit-tested precisely because that seam is where a schema
change would silently break pricing.

### 1.4 Units, without exception

- Money: **integer grosze**. Field names end `Grosze`. No float, no Decimal.
- Multipliers: **basis points**. `10000` = ×1.00.
- Lengths: **integer millimetres**, suffix `Mm`.
- Sub-millimetre tolerances: **integer micrometres**, suffix `Um` (so a
  boundary comparison is integer-exact — `1.2` is not exactly `1.2` in
  double precision, and `tests/unit/feasibility.test.ts` tests that
  boundary).
- Machining time: **thousandths of a minute per m²**.
- `…Pl` marks a column holding customer-visible Polish copy.

### 1.5 The connection pool

`PrismaPg` **must** be constructed with a real `pg.Pool` *instance*, never
a config object — otherwise its `connect()` spins a new pool per call.
That was the actual cause of the `EADDRINUSE` build failures. Reasoning is
in `src/server/db/client.ts`; a unit test pins it. Do not touch.

---

## 2. Patterns to follow

### 2.1 Every mutation

```ts
// operations/thing.ts  — plain module
export async function applyDoThing(actor: Owner | CurrentSession, id: string, …): Promise<Result> {
  // 1. ownership / role — re-derived, never trusted from the argument
  // 2. domain validation — call the pure function, do not re-implement it
  // 3. one atomic write, or a $transaction
  // 4. audit log (admin mutations only)
}
export async function doThing(id: string, …) {          // still in operations/
  const actor = await requireStaffSession();            // or currentOwner()
  const result = await applyDoThing(actor, id, …);
  if (result.ok) revalidatePath(…);
  return result;
}

// actions/thing.ts  — 'use server'
export async function doThing(...args: Parameters<typeof operations.doThing>) { return operations.doThing(...args); }
```

### 2.2 Never read-then-write

The single most repeated bug class in this repository's history (P0-3, and
BUG-05 which re-introduced it in the same commit that fixed it). A check
followed by a write is not atomic.

```ts
// WRONG
const row = await prisma.x.findUnique({ where: { id } });
await prisma.x.update({ where: { id }, data: { n: row.n + 1 } });

// RIGHT — the condition lives in the WHERE clause
await prisma.x.updateMany({ where: { id, n: { lt: MAX } }, data: { n: { increment: 1 } } });
```

Use a unique index (`Order.idempotencyKey`, `CartItem` signature,
`SupportRequest.dedupeKey`) or a conditional statement. Treat "affected 0
rows" as "someone else already did it" and answer honestly.

### 2.3 `deleteMany`, not `delete`

A double-clicked button must not 500 for an outcome the user already got.

### 2.4 Prisma P2002

Duck-typed, never `instanceof`, so it does not depend on which generated
client threw it:

```ts
function isUniqueConstraintViolation(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && (e as { code?: unknown }).code === 'P2002';
}
```

### 2.5 Server Actions are untrusted entry points

Next's own words (`node_modules/next/dist/docs/01-app/02-guides/server-actions.md`).
Re-derive the actor from the session; take a reference (an id) plus the
change, never the row's contents; never trust an id without an ownership
query.

### 2.6 Ownership

```ts
const owner = await currentOwner();                  // { userId, sessionToken }
if (hasNoOwner(owner)) return;
await prisma.x.findFirst({ where: { id, OR: ownerOrClauses(owner) } });
```

§16.1: userId match **or** matching guest `sessionToken` **or** a valid
order `accessToken`. Return `null`/404, never 403 — do not reveal
existence.

---

## 3. Patterns NOT to repeat

These are the recurring defect shapes this audit found. Check your change
against them before you finish.

### 3.1 ⚠️ The dominant defect: a rule with no call site

**Three separate rules in this codebase are correct, unit-tested, and never
called by production.** `domain/compatibility` (SEC-03),
`checkStepAppliesToProductType` and friends (BUG-06), and `zod` (BUG-07,
imported nowhere). All three are documented as enforced. All their unit
tests pass.

**Before you close any issue, answer: which production request path
executes this code, and which test drives it through that path?** If the
only test calls the pure function directly, you have written a
specification, not a guard.

### 3.2 Hiding a feature in the UI does not remove it from the data

`PATTERN_SELECTION_ENABLED = false` hid the pattern picker; a placeholder
design is still attached to every order and written into the immutable
snapshot (BUG-03). When you disable a feature, follow the data all the way
to the order.

### 3.3 Do not let a display value and a stored value drift apart

The catalogue advertises a *net* clamp while everything else shows *gross*
(BUG-02). Free shipping compares *gross* against a field documented as
*net* (BUG-08). Pick a unit, state it in the field name or the comment, and
make every reader agree.

### 3.4 Unordered queries are non-deterministic

`configurator.ts` selects `product.designs` and `product.materials` with no
`orderBy`, and the UI takes `[0]` as a default (BUG-03). Postgres makes no
promise about row order without `ORDER BY`. If a query result feeds a
default, a price, or anything a customer sees — order it.

### 3.5 Do not update a comment and leave the UI

The "Duplikuj" reversal updated the schema comment, the operation comment
and two tests; the button still says „Duplikuj" and still shows a copy icon
(BUG-09). When behaviour changes, grep `src/content/pl/` too.

### 3.6 `void promise` is not "later"

`void mailer.send(…)` after the response works on a long-running Node
server and is killed on serverless. Next 16 has `after()` from
`next/server`. Use it (BUG-12).

### 3.7 Never log a secret

`UnconfiguredMailer` logs the OTP because the OTP is in the subject line
(SEC-02). Before adding any `logger.*` call, ask what is inside the values
you are passing.

---

## 4. Naming and file conventions

- **Code is English. Content is Polish.** No Polish string literal may
  appear in a component — `scripts/check-polish-literals.mjs` enforces it,
  and `npm run lint` runs it. All copy lives in `src/content/pl/`.
- Repositories: `src/server/repositories/*.ts` are the only files that
  query Prisma for page content. `admin-*.ts` variants are unscoped by
  owner and **must** be called from behind `requireStaffSession()`.
- Islands: `src/ui/islands/**`. Primitives (RSC-safe): `src/ui/primitives/**`.
- Migrations are **hand-authored SQL** under `prisma/migrations/<timestamp>_<name>/`.
  Apply with `npm run db:deploy && npm run db:deploy:test && npm run prisma:generate`.
- Header comments carry the *why*, especially for anything counter-intuitive.
  This convention is the best thing about the codebase. Keep it, and record
  reversals rather than quietly swapping them (`CartItem`'s schema comment
  is the model).

---

## 5. Polish locale rules

Never `n === 1 ? … : …`. Three plural forms — use the existing helper,
tested at 1/2/5/12/22/25. Dates use genitive months via
`Intl.DateTimeFormat('pl-PL')`. Currency is `1 234,56 zł` with a
non-breaking space; `formatPln` owns this. Numeric input accepts `1,2` and
`1.2` — `domain/text/numeric-input.ts` owns that, because
`parseFloat("1,2")` returns `1` and would silently mis-size a product.
Quotation marks are „…". Non-breaking space after single-letter words
(a, i, o, u, w, z). Fonts need `subsets: ['latin', 'latin-ext']` or Polish
diacritics render as tofu.

---

## 6. Testing expectations

Governing rule (`CLAUDE.md`/`AGENTS.md`): tests first, confirm they fail
for the right reason, minimum implementation, refactor green.

**Layers:** unit (`tests/unit`, pure, no DB) · integration
(`tests/integration`, real Postgres via `TEST_DATABASE_URL`) · e2e
(`tests/e2e`, Playwright). A component layer is specified in §21.1 and does
not exist — see `REVIEW-TEST-COVERAGE.md`.

**Rules learned here, apply them:**

- **Test the boundary, not just the unit.** §3.1 above. Anything protecting
  money, rights or what gets manufactured needs at least one test through
  the real operation.
- **Concurrency tests must actually be concurrent.** `Promise.all` of two
  calls, not two sequential awaits. The existing duplicate test is
  sequential and passes against the racy implementation (BUG-05).
- **Prove the red.** Disable the guard, watch the test fail for the stated
  reason, restore it. That is how the order-idempotency work was verified
  and it is why it can be trusted.
- **Never write a test for something that does not exist.** No payment
  callback tests — no provider is connected. Coverage theatre is worse than
  a gap, because it reads as protection.
- **Do not chase coverage percentage.** §21.5. A test asserting that a
  component renders a `<div>` is deleted on sight.

**Known environment facts, so you do not rediscover them:**
- `revalidatePath` / `cookies()` / `headers()` throw outside a request
  scope. That is the entire reason for the `apply*` split. Test the
  `apply*` half.
- Postgres rejects NUL (`0x00`) in `text`. This has bitten twice. Use
  `' '` escapes or `JSON.stringify`, never a literal NUL in source.
- The dev server holds a stale Prisma client after a migration — restart it.
- E2E currently runs against the **dev** database, which is why it has 166
  orders. Fixing that is ARCH-03.

---

## 7. Invariants you must not break

### Ecommerce

- Prices are computed **only** server-side. A price from the browser is
  used to detect a mismatch, never to charge.
- Add-to-cart re-prices; checkout re-prices again and compares. A mismatch
  is a hard, logged rejection.
- `PricingSettings` is append-only. Publishing swaps `isActive` atomically.
  Existing orders are pinned to their version and never reprice.
- **The order snapshot is the contract.** `OrderItem.snapshot` is
  self-contained. Rendering an order must never join to a live catalogue
  row. There is a test that mutates every catalogue row and asserts the
  rendered order is unchanged — keep it passing.
- Two *different* configurations are two cart rows. Two *identical* ones
  are one row with a quantity — enforced by
  `@@unique([cartId, configurationSignature])` and by every write path
  merging. (This reverses the original §6.7 design; `CartItem`'s schema
  comment records why.)
- Buyer data on an `Order` is captured, never re-read from the profile.

### Payment / orders — the hard rules

From the project instructions and §14. **Never create:** fake checkout,
fake payment confirmation, fake transaction ids, fake shipment tracking,
fake carrier responses, fake customer communication, fake production files,
fake CNC jobs, fake manufacturing completion, fake pricing, fake inventory,
fake order status.

Concretely, in this codebase: `PaymentMethodConfig.isConnected` is **never**
set `true` from the admin form — only by real code once a real provider
exists. An unconnected provider is rejected exactly like a nonexistent one.
`Shipment` is staff-maintained and the UI never implies live tracking. The
mailer reports `{ sent: false }` and the UI says the confirmation "will
follow" rather than claiming it was sent. **All of this is currently
correct. Do not regress it.**

### Admin (§16A.2)

1. No fabricated customer-visible events.
2. **Soft delete only** for anything an order references — deactivate,
   never destroy. (`Configuration` is the documented exception: nothing
   historical references it, which is why `applyDeleteConfiguration`
   exists. `CustomerDesign` is *not* an exception — `OrderItem` references
   it, which is why customer-facing deletion is still open,
   `OPEN_ITEMS.md` §9.)
3. No pricing retroactivity.
4. Every mutation is audited. All 25 modules currently do this — keep it at 25.

### Design review

An order containing a `CustomerDesign` not in `APPROVED` cannot leave
`DESIGN_REVIEW`. Enforced in the domain transition function. Customers see
plain status text, never CAM terminology; `productionMethod` is internal.

---

## 8. UX and content principles

Preserve the storefront's visual identity — layout, background,
decorative elements, composition, proportions. It is not a MUI template and
must not become one (§R2). Standardise *primitives* (buttons, inputs,
cards, dialogs) on MUI **inside islands**; do not move, redesign or replace
the page composition, and do not add a sitewide provider (§1.2).

- Unavailable options are **shown disabled with a Polish reason**, never
  hidden (§7.2).
- Validation names the fix, not the rule.
- Never a raw status code or a stack trace. The three category/product/blog
  404s currently violate this by printing the literal "404" (UX-06).
- Confirmation dialogs only for the irreversible; undo for everything else
  (§16A.5).
- No invented content: no fabricated testimonials, no fake certifications,
  no placeholder strings shown to customers (BUG-03 is a live violation).

---

## 9. Performance principles

- **Measure before and after.** The one previous performance claim in this
  project that mattered (the 3.8 s provider LCP) came from a real
  Lighthouse run, and it is why the architecture is what it is. Do not make
  a performance change on intuition.
- **Do not optimise a waterfall into an unhandled rejection.** There is a
  deliberate non-optimisation in
  `zamowienie/[orderNumber]/page.tsx` — a promise is *not* started early
  because `notFound()` throws above it. The reason is written into the
  file. Leave it.
- Independent reads go in one `Promise.all`; dependent reads stay
  sequential. Both are already done correctly in several places — copy
  those.
- **The biggest available win is caching, not bundle size** (PERF-01: 91
  of 93 routes are dynamic). Do that first.

---

## 10. Known constraints

- **CI exists as of 2026-08-31** (`.github/workflows/ci.yml`, ARCH-01): a
  `verify` job (types, lint, unit + integration, build) and a separate `e2e`
  job, both against a Postgres service container. Still run
  `npm run typecheck && npm run lint && npm test` yourself before claiming
  anything is done — CI is a safety net, not a substitute for looking.
  - If you add or rename an npm script, `tests/unit/ci-workflow.test.ts`
    will tell you when the workflow no longer matches.
  - If you add a migration, remember CI applies **every** migration from an
    empty database on every run. `migrate dev` locally does not prove that.
  - The workflow's first GitHub run had not happened when it was written.
    If it is red for an infrastructure reason, fix the workflow — do not
    disable the step.
- **Nine items are blocked on the owner** — `OPEN_ITEMS.md` §1-§9. Do not
  build around them, do not fake them, do not silently drop them.
- **No payment provider is connected.** `przelewy24.ts` is real and
  unit-tested; four env vars are missing.
- **Pickup points are a static sample**, and the UI says so.
- **Only one engraving `Font` is seeded**, and it is the site's UI face.
- **`public/` writes** assume a long-running Node server, not serverless.
- **The dev database is polluted** with e2e artifacts (166 orders, a
  leftover inactive design). Do not treat its contents as intentional
  fixture data.
- **A strict CSP is enforced** (added 2026-08-31, SEC-05). Two consequences
  for anything you write:
  - **No inline `<script>`, ever** — no `dangerouslySetInnerHTML` carrying
    executable JavaScript, no `onclick="…"` attributes. `script-src` has no
    `'unsafe-inline'` and a nonce it cannot see. JSON-LD via
    `<script type="application/ld+json">` is fine; it is data, not script.
    A third-party `<Script>` needs the nonce from the `x-nonce` request
    header **and** its host added to `src/server/security/headers.ts`.
  - **Anything off-origin is blocked by default** — images, fonts, `fetch`,
    iframes, form posts. Adding an external service means editing that
    module and its tests, deliberately. The first real case will be
    Przelewy24's redirect (`form-action`), and the test for that directive
    says so.
  - `CSP_MODE=report-only` in `.env` while you debug a violation; never
    leave it there, and never widen `script-src` to unblock yourself.

---

## 11. Definition of done

From the project instructions, plus what this audit adds:

- [ ] Requirements defined; normal, edge, invalid and failure cases tested
- [ ] Authorization cases tested where relevant
- [ ] **A test drives the rule through the real request path**, not only the pure function
- [ ] **Any concurrency claim is proven by a concurrent test**
- [ ] `npm run typecheck` · `npm run lint` · `npm test` all clean
- [ ] `npm run build` still succeeds, with no new warnings
- [ ] No fake production behaviour presented as real
- [ ] Polish copy lives in `src/content/pl/` and reads naturally
- [ ] Docs updated where the change contradicts them — **including
      `ARCHITECTURE.md` and `CHECKLIST.md`.** This audit found four places
      where the code moved and the documentation did not
- [ ] `AI-CHECKLIST.md` updated: status, evidence, date
