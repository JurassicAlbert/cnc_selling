import { SITE } from '@/content/pl/site';
import { undoRemoveCartItem } from '@/server/actions/cart';
import { Text } from '@/ui/primitives/Text';

/**
 * „Cofnij" after a cart removal - UX-11.
 *
 * **Rendered by the page rather than by `CartContents`, and that placement is
 * the whole point.** Removing your only line switches the cart to its
 * empty-state branch, where `CartContents` is not rendered at all - and that
 * is precisely the removal a customer most wants back. A bar inside the cart
 * island would have been missing from the one case it exists for.
 *
 * No MUI and no client JS: a plain `<form action>`, like every other control
 * on this page, so the undo works with scripting off exactly as the bin icon
 * does. The offer itself lives in an `HttpOnly` cookie
 * (`server/session/cart-undo.ts`), which is why nothing needs to be passed
 * through the form and why a reload does not lose it.
 *
 * `role="status"`, not `role="alert"`: this is a confirmation with an option
 * attached, not something wrong. `alert` interrupts a screen reader
 * mid-sentence, which is the wrong register for "that worked, and you can
 * take it back".
 */
export function CartUndoBar() {
  return (
    <div
      role="status"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--space-3)',
        marginBlockStart: 'var(--space-4)',
        padding: 'var(--space-3) var(--space-4)',
        borderRadius: 'var(--radius-card)',
        border: '1px solid var(--mui-palette-divider)',
        background: 'var(--mui-palette-background-paper)',
      }}
    >
      <Text muted>{SITE.cartUndoRemovedPl}</Text>
      <form action={undoRemoveCartItem}>
        <button type="submit" className="form-button-outlined">
          {SITE.cartUndoActionPl}
        </button>
      </form>
    </div>
  );
}
