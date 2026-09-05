# UX / UI review - 2026-08-30

Commit `e774e40`. Every observation below was made against the running
application in a real browser at 800×621 (desktop) and 375×812 (iPhone 14),
or by reading the component that produces it. Measurements are real.

## Preface - what not to change

The storefront has a genuine visual identity: warm paper ground, Fraunces
display face, the honeycomb/orbit decorations, the hexagonal hero mosaic,
generous section rhythm. It does not read as a MUI template, which was the
stated primary risk (§R2). **Nothing in this document asks for that to
change.** Every recommendation here is about behaviour, hierarchy, copy or
responsiveness inside the existing design language.

The 2026-08-29/30 passes did real work: cart, checkout, order detail,
account and the pattern gallery are proper MUI now, the typography scale is
coherent, focus rings exist site-wide (measured: 3px `:focus-visible`), and
`sizes`-based image serving is correct (measured: a 327px card slot fetches
`w=384`, not the full-size original).

---

# P1

## UX-01 - The advertised price is not the price

**Page:** `/`, `/[category]`, `/produkt/[slug]`, `/szukaj`, `/kolekcje/[slug]`
**Issue:** Product cards say „od 150,00 zł". The product page says the same,
then opens its configurator directly beneath on a real default
configuration priced at **709,16 zł**. The advertised figure is a *net*
clamp; every other price on the site is gross, and for several products the
number is below anything that can actually be built (measured detail:
`REVIEW-DETAILED.md` BUG-02).
**Why it matters:** This is the first number a visitor sees and the one
Google indexes. A 4.7× jump between the listing and the first real price is
a bounce, and in Poland the price shown to a consumer is expected to be the
total including VAT.
**Recommendation:** Show a real, gross, achievable starting price (BUG-02).
If a genuine "from" price cannot be computed, show a range („150–900 zł")
or no price at all - both are better than a wrong one.
**Copy:** keep „od"; the number is the problem, not the word.
**Reference:** Next.js Commerce and every MUI e-commerce template show a
single authoritative price per card.
**Priority:** P1

## UX-02 - A placeholder pattern name is shown to the customer

**Page:** `/koszyk`, `/zamowienie/[orderNumber]`, `/moje-konto/zamowienia/[orderNumber]`
**Issue:** Verified live - the cart line reads
„Dąb · **Wzór podstawowy - do zastąpienia** · Olejowanie". That string
means "basic pattern - to be replaced". It is an internal seed placeholder,
attached automatically because pattern selection is hidden but
`computeDefaultSelections` still picks `designs[0]` (BUG-03). It is written
into the immutable order snapshot and onto the production sheet.
**Why it matters:** The customer is shown a property of their product they
never chose, described in words that say the product is unfinished.
**Recommendation:** See BUG-03 - either give the default a real customer
name („Bez wzoru - sam grawer tekstu") or make DESIGN genuinely optional
while the feature is hidden. Either way the summary must state what the
customer is getting before add-to-cart.
**Priority:** P1

## UX-03 - The order confirmation's numbers do not add up

**Page:** `/zamowienie/[orderNumber]`, `/moje-konto/zamowienia/[orderNumber]`, `/panel/zamowienia/[orderNumber]`
**Issue:** Item lines, a divider, then „Razem". Shipping is never shown, so
the lines do not sum to the total; VAT is never stated. Checkout gets this
right (subtotal / dostawa / do zapłaty) and the information is dropped
exactly where it becomes the permanent record (BUG-04).
**Recommendation:** Add „Suma produktów", „Dostawa" and „w tym VAT (23%)"
above „Do zapłaty", reusing the checkout labels verbatim so the two screens
read identically.
**Priority:** P1

## UX-04 - Mobile navigation has no menu

**Page:** every page
**Issue:** `SiteHeader` uses `flexWrap: 'wrap'` with no breakpoint and no
hamburger. Measured at 375×812: `<header>` is **149.6 px** tall across three
wrapped rows, plus the `SearchBar` band ≈ 68 px - about **27% of the
viewport** before any content, on every page. Screenshot evidence in the
review session.
**Why it matters:** On the product page the customer sees the header, the
search band, a breadcrumb and part of one photo. The price, the
configurator and the CTA are all below the fold.
**Recommendation:** Below `md`, collapse Produkty / O nas / FAQ / Kolekcje
into a single menu button and keep only logo · search icon · cart · account
in the bar. MUI's `Drawer` + `IconButton` is the obvious fit and the cart
page is already a client island, so there is precedent for a small one
here. Fold search into an icon that expands, rather than a permanent band.
**Priority:** P1 (this is also the tap-target fix, UX-10)

---

# P2

## UX-05 - "Duplikuj" no longer duplicates

**Page:** `/koszyk`
**Issue:** The control still reads „Duplikuj" with a copy icon, but since
2026-08-30 it adds 1 to the quantity - exactly what the `+` stepper 40 px
to its left does. Two controls, one behaviour, one of them lying about it.
**Current text:** „Duplikuj"
**Recommended:** remove the control entirely (the stepper covers it), or
relabel to „Dodaj kolejną sztukę" with a `+` icon.
**Priority:** P2

## UX-06 - The three most likely 404s are dead ends

**Page:** unknown category, unknown product slug, unknown blog slug
**Issue:** Verified live at `/nie-ma-takiej-strony`: an `<h1>` reading „Nie
znaleziono takiej kategorii." and the bare literal „404". No links, no
search, no CTA. The good version - `NotFoundContent`, with real checked
escape routes to `/`, `/kolekcje`, `/kontakt` - exists and is wired only to
the two *generic* boundaries. The three specific ones
(`[category]/not-found.tsx`, `produkt/[slug]/not-found.tsx`,
`blog/[slug]/not-found.tsx`) still render the old stub. The page `<title>`
is also just „RYT".
**Why it matters:** These are the 404s people actually reach - a changed
slug, an old link, a typo - and they are the ones with no way out.
**Recommendation:** Have all three render `NotFoundContent` with their own
heading passed in as a prop. Give each a real `<title>`. Consider adding
the search box to the 404 body.
**Priority:** P2

## UX-07 - "Free shipping" is announced for personal collection

**Page:** `/koszyk/zamowienie`
**Issue:** Verified live: „Odbiór osobisty" (collect in person) displays
„Darmowa dostawa - Twoje zamówienie kwalifikuje się do darmowej wysyłki tą
metodą." There is no shipping to be free of.
**Recommended:** suppress the free-shipping badge for methods with no
weight tiers and a `priceGrosze` of 0; say „Bez opłat" or nothing.
**Priority:** P2

## UX-08 - Switching carrier silently invalidates the chosen pickup point

**Page:** `/koszyk/zamowienie`
**Issue:** Pick a Paczkomat, choose a point, switch to DPD Pickup: the
confirmation Alert vanishes but the hidden field still carries the InPost
id and the submit button stays enabled. The order is rejected server-side
with `PICKUP_POINT_INVALID` and the customer sees a red banner with no
indication of what to fix (BUG-14).
**Recommended:** reset the selection on carrier change and drive
`disabledReason` from the resolved point, not the raw id.
**Priority:** P2

## UX-09 - Every delivery method shows 0,00 zł

**Page:** `/koszyk/zamowienie`
**Issue:** Verified live on a 709,16 zł cart: all four active methods
displayed „0,00 zł" and a free-shipping note. The 500 zł threshold is
cleared by most realistic orders, so the weight-tier pricing the owner
specifically asked for almost never fires. Four identical prices also make
the choice look arbitrary - the estimated delivery time is the only
differentiator and it is shown once, below the group, for the selected
method only.
**Recommended:** two separate things. (a) fix the net/gross mismatch
(BUG-08); (b) surface each method's own delivery estimate on its own row so
the choice means something even when the prices match. Whether the 500 zł
threshold is right at all is a business decision for the owner.
**Priority:** P2

## UX-10 - Navigation tap targets are 22 px

**Page:** every page
**Issue:** Measured on the live header: every top-level nav item is **22 px**
tall (Produkty, O nas, FAQ, Kolekcje, Koszyk, Moje konto) and every
dropdown item **38 px**. WCAG 2.5.8 (AA) sets 24 px as the minimum; 44 px is
the practical touch target.
**Recommended:** `min-height: 44px` and vertical padding on `.nav-link` /
`.nav-dropdown-item` in `theme-vars.css`. Solved for free if UX-04 is done.
**Priority:** P2

## UX-11 - Removing a cart item is instant and irreversible

**Page:** `/koszyk`
**Issue:** The bin icon is a bare `<form action>` - one tap and a fully
configured, priced item is gone, with no confirmation and no undo. On
mobile it sits ~8 px from the „Duplikuj" icon at a 34 px target size.
**Recommended:** the panel already has the right pattern -
`ConfirmSubmitButton` for irreversible actions, an undo snackbar for the
rest (§16A.5). A „Cofnij" snackbar is the better fit here; a modal on every
removal is worse.
**Priority:** P2

## UX-12 - No pattern is visible anywhere, but every product implies one

**Page:** `/produkt/[slug]`, `/`, `/[category]`
**Issue:** Pattern selection is deliberately off, `/wzory` deliberately
404s, and the navbar no longer links to it - all consistent. But every
product is named „… z grawerem", the homepage says „Twój wzór, Twój tekst",
and the configurator gives no way to choose or even see a pattern. The
customer is promised engraving and offered only text personalization.
**Recommended:** while the feature is off, the product copy should describe
what is actually on sale („grawer tekstowy", „wzór dobierany indywidualnie
- napisz do nas"). This is copy, not code, and it is the owner's call -
but the current state promises something the checkout cannot deliver.
**Priority:** P2

## UX-13 - The cart hides information the customer needs

**Page:** `/koszyk`
**Issue:** `CartItemView` carries `warnings`, `acknowledgedWarnings` and
`customDesignStatus`; `CartRow` renders none of them. A line whose custom
design is still `PENDING_REVIEW` - which will hold the whole order in
`DESIGN_REVIEW` - looks identical to any other line. Feasibility notices
acknowledged during configuration disappear.
**Recommended:** a small `Chip` on the row for a pending/rejected custom
design, and a compact list of acknowledged notices behind a disclosure.
**Priority:** P2

## UX-14 - The search band costs a fixed 68 px on every page

**Page:** every storefront page
**Issue:** `SearchBar` is a permanent full-width band under the header, on
every route including cart, checkout and account, where searching is not
the next action. Combined with the 149.6 px mobile header it dominates the
first screen.
**Recommended:** collapse it into a header search icon (desktop and
mobile), keeping the full band only on `/` and category pages where it is
the likely next action.
**Priority:** P2

## UX-15 - Empty and loading states are thin

**Page:** several
**Issue:** `/koszyk` empty state is a muted line plus one link - no
illustration, no product suggestions, in a site that has strong decorative
assets available. `loading.tsx` renders the literal word „Ładowanie…"
(observed on `/koszyk/zamowienie`) rather than a skeleton, so the checkout
page flashes bare text before its island hydrates.
**Recommended:** MUI `Skeleton` matching the real layout for the cart,
checkout and account routes; a warmer empty cart with a category shortcut.
**Priority:** P2

---

# P3

## UX-16 - Navigation inconsistencies

- **Blog** is in the footer and linked from the homepage („Zobacz wszystkie posty") but absent from the navbar.
- **FAQ** is in the navbar but absent from the footer.
- **Kolekcje** appears in both, which is correct - the other two should match it.
  **Priority:** P3

## UX-17 - Product-card material list is truncated without a tooltip

„Dąb +3" tells the customer nothing about the other three. Either list them
or say „4 gatunki drewna". **Priority:** P3

## UX-18 - Accessibility details

| Item | Evidence | Fix |
|---|---|---|
| No skip link | measured: the only `a[href^="#"]` is the hero CTA | add „Przejdź do treści" as the first focusable element |
| `<nav>` has no `aria-label` | measured | label the header nav and the footer link groups |
| Cart count is `aria-hidden` | `SiteHeader.tsx` - the badge span | add a visually-hidden „N produktów w koszyku" |
| `aria-live="polite"` on the cart quantity | `CartContents.tsx` | the value is replaced by a full server re-render, so the region may not announce; verify or drop |

Verified **good**, and not to be changed: `<html lang="pl">`, one `<main>`,
a clean h1→h2 heading order on the homepage, no image missing `alt`, all 11
empty-`alt` images are genuinely decorative inside labelled links, no
unnamed buttons or links, and a 3px `:focus-visible` ring.
**Priority:** P3

## UX-19 - Structured data claims stock for made-to-order goods

`availability: 'https://schema.org/InStock'` on every product. `MadeToOrder`
is both accurate and better for rich results. **Priority:** P3

## UX-20 - Admin: the panel does not say it is truncating

`/panel/zamowienia` shows the newest 100 of 166 with a pager that only
pages what it was given. Until real pagination lands (ADMIN-01), render
„Pokazano 100 z 166". **Priority:** P3 as a stopgap; the real fix is P1.

---

# Content / copy audit

Polish copy quality across `src/content/pl/` is **high** - natural,
specific, no marketing filler, correct „…" quotation marks, correct plural
forms, and no invented claims (no fake testimonials, no fake certifications,
no fake delivery promises). The lint rule keeping literals out of components
works and is worth keeping.

Items worth changing:

| Where | Current | Recommended | Reason |
|---|---|---|---|
| Cart row | „Duplikuj" | „Dodaj kolejną sztukę", or remove | Describes a behaviour that no longer exists (UX-05) |
| Delivery option | „Darmowa dostawa - Twoje zamówienie kwalifikuje się…" on „Odbiór osobisty" | „Bez opłat" | There is no shipping to be free of (UX-07) |
| Category / product / blog 404 | „…" + „404" | reuse `NotFoundContent`'s body and links | A bare status code is not an error message (UX-06) |
| Seeded design | „Wzór podstawowy - do zastąpienia" | a real customer-facing name | Currently shown to customers and written into orders (UX-02) |
| Product cards | „Dąb +3" | „4 gatunki drewna" | „+3" is developer shorthand (UX-17) |
| Add-to-cart failure | generic `CONFIGURATION_INVALID` copy | a specific „Ten wzór nie jest już dostępny…" | Needed once SEC-03 lands, or a retired pattern produces an unexplained refusal |
| Checkout submit disabled for an infeasible delivery method | no hint (only the pickup case has one) | say why | `SubmitButton`'s `disabledReason === 'delivery'` renders nothing |

Confirmed **correct** and not to be touched: the withdrawal-right
acknowledgement (art. 38 pkt 3 quoted properly), the „projekt może wymagać
ręcznej korekty" upload framing, the pickup-point picker's explicit
statement that its list is a preliminary sample, the bank-account
placeholder („prześlemy numer konta osobno") rather than a fabricated
number, and every „not yet available" notice.

---

# Responsive audit

| Breakpoint | Verdict |
|---|---|
| Mobile 375 | **Header 149.6 px / 3 rows, no menu (UX-04)**; 22 px tap targets (UX-10); no horizontal overflow (verified: `scrollWidth === clientWidth === 375`); cart, checkout and product page all reflow correctly |
| Tablet 768 | Header still wraps; `.pdp-grid` is single-column until 900px, so a tablet in landscape gets the narrow layout |
| Laptop 1024–1440 | Good. Checkout's two-column split with a sticky summary works well |
| Wide ≥ 1920 | `Container` caps width; the honeycomb hero holds up |
| Admin panel | Fixed **260 px** sidebar with no collapse and no `Drawer`. §16A.5 explicitly requires the daily-use order and production views to be "tablet-usable at 1024px with large touch targets" - at 1024 the sidebar takes a quarter of the width and `DataGrid` gets the rest. **Not met.** |

Image handling is **correct** and was verified rather than assumed: `sizes`
is set on every `next/image`, `srcset` has 9 entries, and a 327 px slot
actually downloads `w=384`. The only nit is that `ProductCard` declares
`50vw` on mobile where the real width is ~87vw, which under-serves at
DPR ≥ 2 (BUG-26).

---

# Reference benchmarks used

Checked against, not copied from:

- **MUI templates** (mui.com/material-ui/getting-started/templates) - for the collapsed mobile app bar and `Drawer` pattern (UX-04) and `Skeleton` loading states (UX-15).
- **MUI e-commerce templates** (mui.com/store/templates/use-case/e-commerce) - single authoritative price per card (UX-01); order summary showing subtotal / shipping / tax / total (UX-03).
- **Next.js Commerce** (github.com/vercel/commerce) - cart line with variant chips and a quantity stepper (the current cart is already close); an order confirmation that reconciles.
- **MUI X Data Grid** server-side pagination docs - for ADMIN-01.
- **Materio** (the admin panel's stated visual reference) - its own layout collapses the sidebar below `lg`, which this panel does not.

The storefront's own visual language is **not** benchmarked against these
and should not be. The references are for interaction patterns only.
