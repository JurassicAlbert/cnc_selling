# Performance review — 2026-08-30

Commit `e774e40`.

## What was actually measured

Stated up front, because the brief asks for measured evidence and for
honesty about its absence.

| Measurement | Method | Result |
|---|---|---|
| Rendering mode per route | `npm run build` | **91 dynamic, 2 static** |
| Build success + warnings | `npm run build` | succeeds; **3 Turbopack over-bundling warnings** |
| Mobile header height | live DOM, 375×812 | **149.56 px** |
| Horizontal overflow (mobile) | live DOM | none — `scrollWidth === clientWidth === 375` |
| Responsive image serving | live DOM + Resource Timing | **correct** — a 327 px slot fetches `w=384`, `srcset` has 9 entries |
| Focus ring | computed style | 3 px, present |
| Queries per page render | counted from the call graph | product page ≈ **13**, incl. 2 session lookups and a duplicated product query |
| Test suite duration | `npm test` | 52.25 s for 831 tests |

**Not measured, and therefore not claimed:**

- **Lighthouse / Core Web Vitals.** No before/after numbers were produced in
  this pass. `CHECKLIST.md:102` records an earlier run: SEO 100/100; LCP
  `[~]` "improved, not clearly acceptable yet". That earlier measurement is
  cited, never re-asserted as current.
- **Bundle sizes.** Next 16 + Turbopack did not emit the Size / First Load
  JS columns in this configuration, and dev-server numbers are meaningless.
  No JS-payload figure appears anywhere below.
- **Real database timings.** No `EXPLAIN ANALYZE` was run; index findings
  are structural.
- **Load behaviour.** No load test was run.

---

## Finding 1 (PERF-01) — Not one page is prerendered

**Measured**, from the production build at this commit:

```
○  (Static)   prerendered as static content   →  2 routes: /robots.txt, /sitemap.xml
ƒ  (Dynamic)  server-rendered on demand       →  91 routes: everything else
```

Not the homepage. Not `/[category]`. Not `/produkt/[slug]`. Not `/o-nas`,
`/regulamin`, `/faq` or a blog post.

### Cause

`StorefrontChrome` — rendered by both `(shop)/layout.tsx` and
`(marketing)/layout.tsx` — calls, on every request:

```ts
const [categories, collections, session, consentChoice, sessionToken] = await Promise.all([
  listActiveCategories(), listActiveCollections(), getSession(), readConsentChoice(), readGuestSessionToken(),
]);
const cartSummary = await getCartSummaryForRequest({ … });
```

`getSession()` reads `headers()`; `readConsentChoice()` and
`readGuestSessionToken()` read `cookies()`. Any request-scoped API opts the
whole subtree out of static rendering, so **every route beneath either
layout is dynamic regardless of what the page itself does**.

Confirmed absent from the entire repository (zero matches each):
`React.cache`, `unstable_cache`, `'use cache'`, `export const revalidate`,
`export const dynamic`, `cacheComponents`.

`generateStaticParams` exists on `/produkt/[slug]` and `/[category]`; the
build reports "Generating static pages (81/81)" and then every route falls
back to dynamic anyway. It is currently pure build-time cost with no
runtime benefit.

### Why this is the most important item in this document

`ARCHITECTURE.md` §18: "Catalogue pages are RSC + ISR so they are fully
server-rendered — the reason MUI is confined to islands (§2.1)." The
project pays a permanent, enforced cost for that reasoning — MUI is
lint-banned from storefront Server Components, and the storefront is
hand-written primitives reading CSS variables as a result — while the
larger half of the same argument is switched off. Every catalogue page view
is an uncached round trip to Postgres.

### Recommended fix, in order of payoff

> ### Step 1 attempted and backed out — 2026-09-04
>
> `unstable_cache` with a `cacheTag`, invalidated by `revalidateTag` from the
> four category and three collection writers, was built in full — including
> the shared tag module, a mechanical guard that every writer sets its tag,
> and an end-to-end test that created a category in the panel and looked for
> it in the storefront nav.
>
> It was removed again, and the reason is the useful part. The **caching**
> half demonstrably works: a category inserted straight into the database
> stayed invisible to the storefront until the TTL elapsed, which is exactly
> a live cross-request cache. The **invalidation** half was never
> demonstrated. Next 16's `revalidateTag` documentation describes tagging via
> `fetch` and via `cacheTag()` inside `use cache`, and does not mention
> `unstable_cache`; the two do share a tag store in the source, but that is a
> weaker claim than a passing test, and the e2e never got far enough to
> settle it (it kept failing earlier, on the admin form).
>
> A cross-request cache whose invalidation is unproven means an admin edit
> that silently takes minutes to reach the shop. That is not a thing to guess
> about, so step 1 waits for the same `cacheComponents` decision below — which
> also replaces `unstable_cache` with the supported `use cache` and makes the
> whole question moot. **What did ship is the request-scoped half** (PERF-02 /
> PERF-05), measured at 36 → 26 queries on a product page.
>
> Anyone picking this up: `revalidateTag` also changed signature in Next 16 —
> it now takes a second `profile` argument, and the one-argument form is
> deprecated but still type-checks.

**1. Cache the chrome's static halves.** `listActiveCategories()` and
`listActiveCollections()` change when an admin edits a category — which is
rare, and already goes through an `operations/admin-*` function that calls
`revalidatePath`. Wrap them with `'use cache'` + `cacheTag`, or
`unstable_cache` with a tag, and revalidate the tag from those operations.
Two queries per page render disappear immediately, with no architectural
change.

**2. Isolate the request-scoped fragment.** Move the cart badge, the
account name and the consent banner into their own components inside
`<Suspense>`. Then enable `cacheComponents: true` in `next.config.ts` —
per `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/cacheComponents.md`,
this makes Next "prerender a static HTML shell that is served immediately
while dynamic content streams in", and it implements Partial Prerendering
as the App Router default (the old `experimental.ppr` flag is gone in 16).

**3. Then** the catalogue pages become genuinely static/ISR and
`generateStaticParams` starts earning its keep.

**Migration note:** `cacheComponents` is a behavioural change, not a flag
flip. Read `node_modules/next/dist/docs/01-app/02-guides/migrating-to-cache-components.md`
first. It also enables React `<Activity>`-based state preservation across
client navigations, which affects the configurator's mount behaviour — the
one place in this app where that could surprise.

> ### Blocker added 2026-08-31 by SEC-05 — resolve before writing any code
>
> SEC-05 shipped a **nonce-based Content-Security-Policy** issued per
> request from `src/proxy.ts`. Next stamps that nonce onto its own script
> tags by reading the CSP off the **request** headers at render time
> (`node_modules/next/dist/server/app-render/app-render.js:209-210`). A
> prerendered page has a stale nonce baked into its HTML, so the header and
> the document would disagree and the page would load zero JavaScript.
>
> **Steps 2 and 3 above are therefore incompatible with the CSP as it
> stands** — Next's own CSP guide states this directly, including that
> "Partial Prerendering (PPR) is incompatible with nonce-based CSP".
>
> **Step 1 is not affected** and is still worth doing on its own: caching
> `listActiveCategories()`/`listActiveCollections()` removes two Postgres
> round trips per render regardless of whether the route is static.
>
> Beyond step 1 there is a real choice, and it belongs to the owner:
>
> | | Keeps | Costs |
> |---|---|---|
> | Keep the nonce | A strict `script-src` with no `'unsafe-inline'` | Catalogue pages stay dynamic; PPR unavailable |
> | Move to `experimental.sri` | Static/ISR/PPR **and** a strict `script-src` | An experimental, App-Router-only Next feature |
>
> The third option — weakening `script-src` to `'unsafe-inline'` — trades
> away the whole of SEC-05 for a caching win and **must not be done as an
> implementation detail** of this item.

**Do not do anything else on this list before 1 and 2.** Nothing else is
worth as much.

---

## Finding 2 (PERF-02) — Duplicate query on every `generateMetadata` route

Five pages call the same repository function twice per request — once in
`generateMetadata`, once in the page body:

| Route | Function called twice |
|---|---|
| `/produkt/[slug]` | `getActiveProductBySlug` |
| `/[category]` | `getActiveCategoryBySlug` |
| `/kolekcje/[slug]` | (collection lookup) |
| `/blog/[slug]` | (post lookup) |
| `/strony/[slug]` | (page lookup) |

Next deduplicates `fetch`, not Prisma calls. `React.cache()` is the
supported mechanism and appears **nowhere** in the codebase.

**Fix:** five one-line changes.

```ts
import { cache } from 'react';
export const getActiveProductBySlug = cache(async (slug: string) => { … });
```

---

## Finding 3 (PERF-05) — ~13 queries to render one product page

Counted from the call graph (not profiled):

| Source | Queries |
|---|---|
| `StorefrontChrome`: categories, collections, cart summary | 3 |
| `StorefrontChrome`: `getSession()` → Better Auth session + user lookup | ~2 |
| `ProductPage`: `getSession()` **again** | ~2 |
| `ProductPage`: `getActiveProductBySlug` | 1 |
| `ProductPage`: `getConfiguratorProductData` → product + machine + pricing (`Promise.all`), plus a second round trip for fonts | 3–4 |
| `ProductPage`: `listOwnedCustomerDesigns` | 1 |
| `generateMetadata`: `getActiveProductBySlug` again (PERF-02) | 1 |
| `recordAnalyticsEvent` write | 1 |
| **Total** | **≈ 13** |

Two of those stand out beyond PERF-01/02:

- **`getSession()` is called twice per render** — once by the layout's
  `StorefrontChrome`, once by the page. Better Auth performs a real
  database lookup each time. Wrapping `getSession` in `React.cache()` makes
  the second call free and is a two-line change with no behavioural risk.
- **`listOwnedCustomerDesigns` runs on every product page** and is used
  only by the `CUSTOM` product type's upload step. The code documents this
  as deliberate ("cheap, and now costs no wall time because of
  `Promise.all`") — which is true for latency and false for connection
  pressure. Once the product type is known, skip it.

The internal `Promise.all` usage across the codebase is good and was
verified: `create-order.ts` re-prices items in parallel, `ProductPage`
parallelises its three reads, `StorefrontChrome` parallelises five, and
`configurator.ts` parallelises product/machine/pricing. The
`recordAnalyticsEvent`/mailer calls are deliberately not awaited — correct
for latency, and a real risk on serverless (BUG-12).

---

## Finding 4 (PERF-04) — Three Turbopack over-bundling warnings

`npm run build` emits, from `src/server/storage/public-images.ts`:

| Line | Pattern matches |
|---|---|
| 50 (`writeFile(path.join(dir, fileName))`) | **93 016 files** |
| 47 (`path.join(PUBLIC_IMAGES_ROOT, kind, ownerId)`) | **33 848 files** |
| 66 (`rm(path.join(PUBLIC_IMAGES_ROOT, relative))`) | **16 924 files** |

Turbopack: "Overly broad patterns can lead to build performance issues and
over bundling." The build succeeds, so this is hygiene — but a clean build
is worth keeping clean, and these are the only three warnings.

**Fix:** build the directory from a literal map keyed by the five
`PublicImageKind` values instead of interpolating, so the analyser sees
finite paths.

---

## Finding 5 (PERF-03) — Admin lists have no server-side pagination

22 of 25 `admin-*` repositories issue unbounded `findMany` and serialize the
whole table into the RSC payload for a client `DataGrid`. The three that do
bound (`orders` 100, `customers` 100, `audit-log` 200) truncate *silently*,
which is a correctness bug (ADMIN-01), not a performance one.

Fine today (8 products, 13 designs). The two that grow without bound in
normal operation are `/panel/kontakt` (`SupportRequest`) and
`/panel/produkcja`. Solve it once with the same server-side pagination
helper ADMIN-01 needs; do not pre-optimise all 22.

---

## Database

Reviewed structurally. `EXPLAIN ANALYZE` was **not** run.

**Indexes look right.** Every hot lookup has one:
`Product.slug @unique`, `@@index([categoryId, isActive])`,
`@@index([typeCode, isActive])`, `Configuration` on `userId`/`sessionToken`/`productId`,
`CartItem @@index([cartId])` plus the signature unique index,
`Order` on `userId`/`status`/`createdAt` with `orderNumber` and
`accessToken` unique, `OrderItem @@index([orderId])`, `AuditLog` on
`(entity, entityId)`, `(createdAt)` and `(actorId)`, `AnalyticsEvent` on
`(name, createdAt)`.

**No N+1 patterns found.** Cart, order, product and configurator reads all
use nested `select`, which Prisma resolves in a bounded number of queries.
The one genuine second round trip — the fonts query in
`getConfiguratorProductData` — is explained in a comment and is correct
(`allowedFontIds` is a scalar array, so it cannot be joined in the first
query).

**Two smaller notes:**

- `getCartSummaryForRequest` selects every cart item and its configuration
  price to compute a count and a total in JS. A single aggregate would be
  cheaper, but this runs on every page render, so it becomes worth doing
  only if PERF-01's caching does not remove it from the hot path first.
- **Missing `ORDER BY`.** `configurator.ts` selects `product.materials` and
  `product.designs` with no ordering, despite both having `sortOrder`
  columns. That is a correctness bug (BUG-03) before it is a performance
  one, but it also means the query plan is free to change row order between
  executions.

**Connection pooling** was fixed properly (`PrismaPg` given a real
`pg.Pool` *instance*, with the reasoning recorded in `db/client.ts` and a
unit test in `db-pool-config.test.ts`). Do not re-investigate it.

---

## Client-side rendering cost

The RSC / island split is **real and correctly enforced**: `biome.json`
forbids `@mui/material` inside `(marketing)`/`(shop)` Server Components,
and `ThemeRegistry` is mounted only around genuine islands (cart, checkout,
configurator, account, order detail, patterns gallery, and the whole
`/panel`).

Two observations:

- **The decision is justified** and should be kept. `CHECKLIST.md:104`
  records a real Lighthouse finding: a globally mounted theme provider
  measured 3.8 s LCP. That is evidence, not a preference. Nothing in this
  review recommends mounting MUI sitewide.
- **`Configurator.tsx` is 1 525 lines** and ships as a single client
  component on the product page — the most-visited page in the shop. It
  pulls in `@mui/material` Menu, Popover, TextField and the icon set. It is
  the largest single client payload on the storefront. Splitting it
  (ARCH-02) would allow the size/personalization steps to load lazily.
  Worth doing after PERF-01, and worth measuring before and after — this is
  exactly the kind of change that should not be made on intuition.
- **P2-11 from the previous audit still stands:** `CheckoutForm.tsx`
  imports `searchPickupPoints`/`findPickupPointById` as runtime values, so
  the whole `PICKUP_POINTS` array ships to the browser. Harmless at 16
  entries; a real problem the day it is swapped for a live directory
  (`OPEN_ITEMS.md` §3).

## Images and fonts

Both verified, both **correct** — recorded so they are not re-audited:

- Every `next/image` sets `sizes`; `srcset` has 9 entries; a 327 px slot
  actually downloads `w=384`. The hero image sets `priority`. The one nit
  is `ProductCard`'s `sizes="(max-width: 768px) 50vw, 300px"` where the real
  mobile width is ~87vw — under-serves at DPR ≥ 2 (BUG-26).
- Fonts are self-hosted through `next/font` with the `latin-ext` subset
  (the §17.1 trap), so there is no third-party request and no layout shift
  from font loading.

---

## Async / parallelisation audit

Asked for explicitly by the brief: where is there `A → wait → B → wait → C`
that could be `A + B + C`?

**Already parallel (verified, leave alone):** `create-order.ts` item
re-pricing, delivery + payment method resolution, `ProductPage`'s three
reads, `StorefrontChrome`'s five, `configurator.ts`'s product/machine/pricing,
`sitemap.ts`'s three, checkout's delivery + payment lookups.

**Genuinely sequential, and correctly so:**

- `StorefrontChrome`'s cart summary depends on the session resolved above
  it. Real dependency.
- `CheckoutPage` resolves the cart before delivery methods, because
  `resolveDeliveryMethodsForCart` needs the cart's weight. Real dependency.
- `zamowienie/[orderNumber]/page.tsx` deliberately does **not** start
  `getStoreSettings()` before the order lookup, because `notFound()` throws
  and an unawaited promise would become an unhandled rejection. The
  reasoning is written into the file. **Correct — do not "optimise" this.**

**Remaining opportunities, all small:**

- `getSession()` twice per render (PERF-05) — fix with `React.cache`, not
  with parallelism.
- `listOwnedCustomerDesigns` on every product page regardless of type.
- The fonts query in `getConfiguratorProductData` is inherently a second
  round trip; it could be avoided by making `allowedFontIds` a real
  relation, which is a schema change not worth making for this alone.

**Deferrable work that currently runs inline:** none. Analytics and email
are already deferred — the problem is that they are deferred *wrongly*
(`void` instead of `after()`, BUG-12), not that they block.

---

## Recommended order of work

1. **PERF-01 step 1** — cache categories/collections. Small, safe, immediate.
2. **PERF-02 + the `getSession` cache** — six `React.cache()` wrappers.
3. **PERF-01 step 2** — `<Suspense>` the personalised chrome, enable `cacheComponents`. Re-run the build and confirm `/`, `/[category]`, `/produkt/[slug]` are no longer plain `ƒ`. **Blocked since 2026-08-31 on the nonce-vs-static decision under Finding 1 — take that to the owner before starting, and do not resolve it by weakening `script-src`.**
4. **Run Lighthouse mobile on a product page before and after 1-3**, and record the real numbers in this file. Nothing after this point should be attempted without those numbers.
5. **PERF-04** — clear the three build warnings.
6. **ARCH-02 / PERF-03** — split `Configurator.tsx` and add admin pagination, both measured.
