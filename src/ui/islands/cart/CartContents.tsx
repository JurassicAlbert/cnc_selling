'use client';

/**
 * `'use client'` is required here, not optional: `<Button component={Link}>`
 * below needs `Link` (`next/link`) in client scope. Passing `Link` as a
 * `component` PROP from a Server Component crashes at runtime — "Functions
 * cannot be passed directly to Client Components" — confirmed live; a
 * Client Component reference used directly as JSX serializes fine across
 * the Server→Client boundary, but forwarded indirectly through another
 * component's prop, it doesn't (same "no function props across the
 * boundary" rule `ThemeRegistry.tsx`'s own comment already documents for a
 * `Theme` object). Every other `component={Link}` use in this codebase
 * (`PatternsGallery.tsx`, `AccountNav.tsx`, ...) is already inside a
 * `'use client'` file for exactly this reason. No hooks/interactivity are
 * added by this directive — MUI's `Button`/`IconButton`/`Paper` were
 * already Client Components being rendered from the server tree either
 * way; this only changes how `CartContents` itself is evaluated.
 */

import Image from 'next/image';
import Link from 'next/link';
import { Box, Button, IconButton, Paper, Stack, Typography } from '@mui/material';

import { formatPln } from '@/domain/money/money';
import { formatMmAsCentimetres } from '@/domain/text/numeric-input';
import { MAX_CART_ITEM_QUANTITY } from '@/domain/cart/quantity';
import { SITE } from '@/content/pl/site';
import type { CartItemView, CartView } from '@/server/repositories/cart';
import { adjustCartItemQuantity, duplicateCartItem, removeCartItem, updateCartItemQuantity } from '@/server/actions/cart';
import { writeSelectionsToSearch } from '@/ui/islands/configurator/selections-url';
import { AddIcon, ContentCopyIcon, DeleteIcon, RemoveIcon } from '@/ui/icons';
import { Text } from '@/ui/primitives/Text';

/**
 * The real MUI cart UI — 2026-08-29, owner feedback: "ulepsz ui i ux widzę
 * że w koszyku dalej panuje straszny vanilla html/css/js". Lives here
 * rather than directly in `(shop)/koszyk/page.tsx` per `ARCHITECTURE.md`
 * §2.1: `@mui/material` is lint-forbidden inside `(marketing)/(shop)`
 * Server Components (`biome.json`'s own override) — "put the interactive
 * part in `src/ui/islands` and render it as a child," exactly what this
 * is. Still not a client island in the React sense: no `'use client'`, no
 * hooks — every control is STILL a zero-client-JS `<form action={...}>`
 * bound directly to a Server Action; MUI's `Button`/`IconButton` just
 * render a plain native `<button>` under the hood. `koszyk/page.tsx`
 * fetches the cart and wraps this in `ThemeRegistry`.
 */
export function CartContents({ cart }: { readonly cart: CartView }) {
  return (
    <Stack spacing={2} sx={{ marginBlockStart: 4, maxWidth: 880 }}>
      <Typography variant="body2" color="text.secondary">
        {SITE.cartItemsCountPl(cart.items.reduce((sum, item) => sum + item.quantity, 0))}
      </Typography>

      {cart.items.map((item) => (
        <CartRow key={item.cartItemId} item={item} />
      ))}

      <Paper variant="outlined" sx={{ p: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="h6">
          {SITE.cartSubtotalLabelPl}: {formatPln(cart.subtotalGrossGrosze)}
        </Typography>
        <Button component={Link} href="/koszyk/zamowienie" variant="contained" size="large">
          {SITE.cartCheckoutCtaPl}
        </Button>
      </Paper>
    </Stack>
  );
}

function CartRow({ item }: { readonly item: CartItemView }) {
  const editHref = `/produkt/${item.productSlug}?${writeSelectionsToSearch(item.selections)}&edit=${item.configurationId}`;
  const atMax = item.quantity >= MAX_CART_ITEM_QUANTITY;

  return (
    <Paper variant="outlined" sx={{ p: 2, display: 'grid', gridTemplateColumns: { xs: '72px 1fr', sm: '96px 1fr auto' }, gap: 2 }}>
      <Box sx={{ position: 'relative', width: '100%', aspectRatio: '1 / 1', borderRadius: 1, overflow: 'hidden' }}>
        {item.imageUrl !== null && <Image src={item.imageUrl} alt="" fill sizes="96px" style={{ objectFit: 'cover' }} />}
      </Box>

      <Stack spacing={0.5} sx={{ minWidth: 0 }}>
        <Typography variant="subtitle1">{item.productNamePl}</Typography>
        <Text muted>
          {[item.materialNamePl, item.designNamePl, item.finishNamePl, item.fontNamePl]
            .filter((value): value is string => value !== null)
            .join(' · ')}
        </Text>
        {item.widthMm !== null && item.heightMm !== null && (
          <Text muted>
            {SITE.catalogueDimensionsLabelPl}: {formatMmAsCentimetres(item.widthMm)}×
            {formatMmAsCentimetres(item.heightMm)} cm
          </Text>
        )}
        {item.personalizationText !== null && item.personalizationText.trim().length > 0 && (
          <Text muted>„{item.personalizationText}”</Text>
        )}
        {!item.isComplete && <Text muted>{SITE.cartIncompleteNoticePl}</Text>}

        <Stack direction="row" spacing={2} sx={{ alignItems: 'center', flexWrap: 'wrap', marginBlockStart: 1 }}>
          <Link href={editHref} style={{ font: 'var(--mui-font-body2)' }}>
            {SITE.cartEditPl}
          </Link>

          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
            <form action={adjustCartItemQuantity.bind(null, item.cartItemId, -1)}>
              <IconButton type="submit" size="small" aria-label={SITE.cartQuantityDecreasePl} disabled={item.quantity <= 1}>
                <RemoveIcon size={16} />
              </IconButton>
            </form>
            <Typography variant="body2" sx={{ minWidth: 24, textAlign: 'center' }} aria-live="polite">
              {item.quantity}
            </Typography>
            <form action={adjustCartItemQuantity.bind(null, item.cartItemId, 1)}>
              <IconButton type="submit" size="small" aria-label={SITE.cartQuantityIncreasePl} disabled={atMax}>
                <AddIcon size={16} />
              </IconButton>
            </form>
          </Stack>

          <form action={duplicateCartItem.bind(null, item.cartItemId)}>
            <IconButton type="submit" size="small" aria-label={SITE.cartDuplicatePl} title={SITE.cartDuplicatePl}>
              <ContentCopyIcon size={16} />
            </IconButton>
          </form>

          <form action={removeCartItem.bind(null, item.cartItemId)}>
            <IconButton type="submit" size="small" aria-label={SITE.cartRemovePl} title={SITE.cartRemovePl} color="error">
              <DeleteIcon size={16} />
            </IconButton>
          </form>
        </Stack>

        {atMax && (
          <Typography variant="caption" color="text.secondary">
            {SITE.cartQuantityMaxNoticePl(MAX_CART_ITEM_QUANTITY)}
          </Typography>
        )}

        {/* Direct numeric entry for a bigger jump than the +/- stepper — still zero-JS, still clamped server-side (`updateCartItemQuantity`). */}
        <form action={updateCartItemQuantity.bind(null, item.cartItemId)} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', font: 'var(--mui-font-caption)' }}>
            {SITE.cartQuantityLabelPl}
            <input
              type="number"
              name="quantity"
              min={1}
              max={MAX_CART_ITEM_QUANTITY}
              defaultValue={item.quantity}
              style={{ width: 56, padding: 4 }}
            />
          </label>
          {/* `formNoValidate`: the `max` attribute above is a UX hint only —
              the real enforcement is server-side (`updateCartItemQuantity`'s
              `clampCartQuantity` call). Without this, the browser's own
              HTML5 constraint validation would silently block submission of
              an out-of-range value before it ever reached the server. */}
          <Button type="submit" size="small" variant="text" formNoValidate>
            {SITE.cartUpdateQuantityPl}
          </Button>
        </form>
      </Stack>

      <Typography variant="subtitle1" sx={{ textAlign: { xs: 'left', sm: 'right' }, gridColumn: { xs: '1 / -1', sm: 'auto' } }}>
        {item.priceGrossGrosze !== null ? formatPln(item.priceGrossGrosze * item.quantity) : null}
      </Typography>
    </Paper>
  );
}
