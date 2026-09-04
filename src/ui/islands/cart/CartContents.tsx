'use client';

/**
 * `'use client'` is required here, not optional: `<Button component={Link}>`
 * below needs `Link` (`next/link`) in client scope. Passing `Link` as a
 * `component` PROP from a Server Component crashes at runtime - "Functions
 * cannot be passed directly to Client Components" - confirmed live; a
 * Client Component reference used directly as JSX serializes fine across
 * the Server→Client boundary, but forwarded indirectly through another
 * component's prop, it doesn't (same "no function props across the
 * boundary" rule `ThemeRegistry.tsx`'s own comment already documents for a
 * `Theme` object). Every other `component={Link}` use in this codebase
 * (`PatternsGallery.tsx`, `AccountNav.tsx`, ...) is already inside a
 * `'use client'` file for exactly this reason. No hooks/interactivity are
 * added by this directive - MUI's `Button`/`IconButton`/`Paper` were
 * already Client Components being rendered from the server tree either
 * way; this only changes how `CartContents` itself is evaluated.
 *
 * 2026-08-29 visual pass, owner feedback: "Taka zwykła biała karta w
 * koszyku ... za mało polished" - same hover-lift/accent-border language
 * `AccountOrdersList.tsx` already established for order cards (this
 * project's own real precedent for "polished," not an arbitrary new
 * style), a real quantity-stepper "pill" instead of three loose icon
 * buttons, and the numeric quantity field promoted from a raw `<input>` to
 * a real MUI `TextField` (safe now - this file is already a client
 * boundary; no reason left to keep one control less polished than the
 * rest).
 */

import Image from 'next/image';
import Link from 'next/link';
import { Box, Button, IconButton, Paper, Stack, Typography } from '@mui/material';

import { formatPln } from '@/domain/money/money';
import { formatMmAsCentimetres } from '@/domain/text/numeric-input';
import { MAX_CART_ITEM_QUANTITY } from '@/domain/cart/quantity';
import { SITE } from '@/content/pl/site';
import type { CartItemView, CartView } from '@/server/repositories/cart';
import { adjustCartItemQuantity, removeCartItem } from '@/server/actions/cart';
import { CartDeliveryDraftForm } from '@/ui/islands/cart/CartDeliveryDraftForm';
import { AddIcon, DeleteIcon, RemoveIcon } from '@/ui/icons';
import { Text } from '@/ui/primitives/Text';

/**
 * The real MUI cart UI - 2026-08-29, owner feedback: "ulepsz ui i ux widzę
 * że w koszyku dalej panuje straszny vanilla html/css/js". Lives here
 * rather than directly in `(shop)/koszyk/page.tsx` per `ARCHITECTURE.md`
 * §2.1: `@mui/material` is lint-forbidden inside `(marketing)/(shop)`
 * Server Components (`biome.json`'s own override) - "put the interactive
 * part in `src/ui/islands` and render it as a child," exactly what this
 * is. Every control is STILL a zero-client-JS `<form action={...}>` bound
 * directly to a Server Action - the `'use client'` directive is required
 * for `component={Link}` (see the header comment above), not because any
 * control needs client-side state.
 */
/**
 * The card surface shared by every panel on this page.
 *
 * Owner, 2026-09-04: the cart should match the lightness of the reference
 * layout. Its cards carry no visible border at all - white on a tinted page,
 * separated by a shadow soft enough that you notice the grouping rather than
 * the edge. Ours were `variant="outlined"`, which draws a hard 1px line
 * around every panel, and three of those stacked read as a form rather than
 * as a list.
 *
 * The palette stays this shop's own: a warm ground and warm paper
 * (`theme-vars.css`), not the reference's cool grey. What is borrowed is the
 * weight, not the colour.
 */
const SOFT_CARD = {
  borderRadius: 3,
  bgcolor: 'background.paper',
  boxShadow: '0 1px 2px rgba(60, 42, 25, 0.05), 0 4px 16px rgba(60, 42, 25, 0.05)',
} as const;

export function CartContents({ cart }: { readonly cart: CartView }) {
  const itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    /*
      UX-23, owner request 2026-09-04: the line cards on the left, the
      summary beside them on the right rather than stacked underneath.
      Arrangement taken from `template.getbazaar.io`; none of its styling.

      One column below `md`, where a 320px sidebar would leave the cards too
      narrow to read. `alignItems: 'start'` so the summary keeps its own
      height instead of stretching to match a long list of items - which is
      also what lets it stick.
    */
    <Box
      sx={{
        marginBlockStart: 4,
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 320px' },
        gap: 3,
        alignItems: 'start',
      }}
    >
      <Stack spacing={2}>
        <Typography variant="body2" color="text.secondary">
          {SITE.cartItemsCountPl(itemCount)}
        </Typography>

        {cart.items.map((item) => (
          <CartRow key={item.cartItemId} item={item} />
        ))}

        {/* Owner request, 2026-09-04: the address and a note, on this page.
            Below the items rather than in the summary column, because on a
            phone the summary is what a customer scrolls to in order to check
            out and an eight-field form in front of it is in the way. */}
        <CartDeliveryDraftForm draft={cart.deliveryDraft} />
      </Stack>

      <CartSummary subtotalGrossGrosze={cart.subtotalGrossGrosze} />
    </Box>
  );
}

/**
 * The summary panel. Sticky on desktop so the total and the checkout button
 * stay reachable however long the list of items gets - the same reason the
 * configurator has a price bar, applied to the page where the number is
 * actually about to be paid.
 *
 * It holds only what this page genuinely knows. The reference layout also
 * carries a voucher field and a shipping estimator; there is no voucher
 * system in this shop, and shipping is chosen and priced at checkout
 * against a real delivery method, so both would be controls that do
 * nothing. „Suma czesciowa" stays the honest
 * label: it is the items, before delivery.
 *
 * It does not repeat the item count. That line already sits above the list,
 * and having it twice on one screen is redundant to a reader and ambiguous
 * to anything looking for it - `cart.spec.ts` hit the second half of that
 * immediately ("strict mode violation ... resolved to 2 elements"), which is
 * a fair complaint about the page rather than about the test.
 */
function CartSummary({ subtotalGrossGrosze }: { readonly subtotalGrossGrosze: number }) {
  return (
    <Paper
      elevation={0}
      sx={{
        ...SOFT_CARD,
        p: 3,
        position: { md: 'sticky' },
        top: { md: 16 },
      }}
    >
      <Stack spacing={2}>
        {/* Label and figure on one line, as in the reference. It was a
            stacked caption-over-heading beside a circular icon badge, which
            is three visual elements for one number. */}
        <Stack direction="row" sx={{ alignItems: 'baseline', justifyContent: 'space-between', gap: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {SITE.cartSubtotalLabelPl}
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
            {formatPln(subtotalGrossGrosze)}
          </Typography>
        </Stack>

        {/* Said here rather than discovered at the next step: the number
            above is not the number they will pay. */}
        <Typography variant="caption" color="text.secondary">
          {SITE.cartShippingAtCheckoutPl}
        </Typography>

        <Button component={Link} href="/koszyk/zamowienie" variant="contained" size="large" fullWidth>
          {SITE.cartCheckoutCtaPl}
        </Button>

        <Button component={Link} href="/" variant="text" size="small" fullWidth>
          {SITE.cartContinueShoppingPl}
        </Button>
      </Stack>
    </Paper>
  );
}

/**
 * One line in the cart.
 *
 * Restyled 2026-09-04 on owner feedback: the item card should be closer to
 * the reference layout's. It was an outlined card that gained an accent
 * border and a shadow on hover, and carried its controls in one long row
 * under the description - heavy enough that three of them in a list read as
 * a wall. The reference is quieter: a soft card with no strong border, the
 * image left, the unit price under the name, and the line total and the
 * remove control held to the right.
 *
 * Nothing was removed to achieve that, and one thing deliberately was not.
 * The numeric quantity field and its button look redundant next to the
 * stepper and are not: the stepper moves by one, and this is how somebody
 * orders eleven without pressing a button eleven times. It is quieter now,
 * not gone.
 */
function CartRow({ item }: { readonly item: CartItemView }) {
  const atMax = item.quantity >= MAX_CART_ITEM_QUANTITY;

  // One dot-separated line rather than three stacked ones. Every part of it
  // is load-bearing here in a way it is not in the reference: two rows of
  // the same product differ only by their configuration, so the material,
  // the pattern and the size are how a customer tells them apart.
  const specPl = [
    item.materialNamePl,
    item.designNamePl,
    item.finishNamePl,
    item.fontNamePl,
    item.widthMm !== null && item.heightMm !== null
      ? `${formatMmAsCentimetres(item.widthMm)}×${formatMmAsCentimetres(item.heightMm)} cm`
      : null,
  ]
    .filter((value): value is string => value !== null)
    .join(' · ');

  return (
    <Paper elevation={0} sx={{ ...SOFT_CARD, p: 2 }}>
      {/*
        The reference's row exactly: image, name over unit price, stepper,
        line total, remove. Everything this shop has that the reference does
        not is demoted to the quiet line underneath, rather than competing
        for width up here - a first attempt put all of it on one row and the
        product name was squeezed to about forty pixels, wrapping one word
        per line.
      */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '64px minmax(0, 1fr)', sm: '80px minmax(0, 1fr) auto auto auto' },
          columnGap: { xs: 2, sm: 2.5 },
          rowGap: 1.5,
          alignItems: 'center',
        }}
      >
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            aspectRatio: '1 / 1',
            borderRadius: 2,
            overflow: 'hidden',
            bgcolor: 'action.hover',
          }}
        >
          {item.imageUrl !== null && (
            <Image src={item.imageUrl} alt="" fill sizes="80px" style={{ objectFit: 'cover' }} />
          )}
        </Box>

        <Stack spacing={0.25} sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ lineHeight: 1.3 }}>
            {item.productNamePl}
          </Typography>
          {/* The unit price under the name, as in the reference. The figure
              further right is the line total, and without this one there is
              no way to tell the two apart at a quantity above one. */}
          {item.priceGrossGrosze !== null && (
            <Typography variant="body2" color="text.secondary">
              {formatPln(item.priceGrossGrosze)}
            </Typography>
          )}
          {specPl.length > 0 && <Text muted>{specPl}</Text>}
          {item.personalizationText !== null && item.personalizationText.trim().length > 0 && (
            <Text muted>„{item.personalizationText}”</Text>
          )}
          {!item.isComplete && <Text muted>{SITE.cartIncompleteNoticePl}</Text>}
        </Stack>

        {/*
          `display: contents` at `sm` and up: the three controls become grid
          cells of the row above, which is the reference's arrangement. On a
          phone the wrapper is a real flex row instead, so the stepper, the
          line total and the bin share one line - stacked as three separate
          grid rows they left the bin sitting alone under the total.
        */}
        <Box
          sx={{
            display: { xs: 'flex', sm: 'contents' },
            gridColumn: { xs: '1 / -1' },
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
          }}
        >
          <QuantityStepper item={item} atMax={atMax} />

          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 700,
              whiteSpace: 'nowrap',
              minWidth: { sm: 88 },
              textAlign: { sm: 'right' },
            }}
          >
            {item.priceGrossGrosze !== null ? formatPln(item.priceGrossGrosze * item.quantity) : null}
          </Typography>

          <Box sx={{ justifySelf: { sm: 'end' } }}>
            <form action={removeCartItem.bind(null, item.cartItemId)}>
              <IconButton type="submit" size="small" aria-label={SITE.cartRemovePl} title={SITE.cartRemovePl} color="error">
                <DeleteIcon size={16} />
              </IconButton>
            </form>
          </Box>
        </Box>
      </Box>

    </Paper>
  );
}

/**
 * The stepper, on the item's own row - the only quantity control the
 * reference layout has, and now the only one here.
 *
 * Owner, 2026-09-04: "nie potrzebujemy również aktualizuj, duplikuj ani
 * edytuj ani podwójnego forma z liczbą - wystarczy ten podstawowy do
 * ustawiania ilości obok ceny". So the card lost a numeric quantity field
 * with its own submit button, a „Duplikuj" button and an „Edytuj" link.
 *
 * What that costs, recorded rather than discovered later: re-opening a cart
 * line in the configurator is now reached from „Moje projekty"
 * (`AccountConfigurationsList.tsx` builds the same `?edit=` link), not from
 * the cart; and reaching the maximum of twenty-five is twenty-four presses.
 * `updateCartItemQuantity` and `duplicateCartItem` still exist and are still
 * covered by `tests/integration/cart-operations.test.ts` - nothing on this
 * page calls them any more.
 *
 * Two sibling forms with the current value between them, rather than one:
 * HTML forms cannot nest, and each control is its own zero-JS Server Action
 * submission.
 */
function QuantityStepper({ item, atMax }: { readonly item: CartItemView; readonly atMax: boolean }) {
  return (
    <Stack
      direction="row"
      sx={{
        alignItems: 'center',
        border: 1,
        borderColor: 'divider',
        borderRadius: 999,
        overflow: 'hidden',
        width: 'fit-content',
      }}
    >
      <form action={adjustCartItemQuantity.bind(null, item.cartItemId, -1)}>
        <IconButton
          type="submit"
          size="small"
          aria-label={SITE.cartQuantityDecreasePl}
          disabled={item.quantity <= 1}
          sx={{ borderRadius: 0 }}
        >
          <RemoveIcon size={16} />
        </IconButton>
      </form>
      <Typography variant="body2" sx={{ minWidth: 24, textAlign: 'center', fontWeight: 600 }} aria-live="polite">
        {item.quantity}
      </Typography>
      <form action={adjustCartItemQuantity.bind(null, item.cartItemId, 1)}>
        <IconButton
          type="submit"
          size="small"
          aria-label={SITE.cartQuantityIncreasePl}
          disabled={atMax}
          sx={{ borderRadius: 0 }}
        >
          <AddIcon size={16} />
        </IconButton>
      </form>
    </Stack>
  );
}

