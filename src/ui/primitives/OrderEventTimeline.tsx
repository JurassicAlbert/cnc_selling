import { List, ListItem, ListItemText } from '@mui/material';

import { adminOrderStatusLabel } from '@/content/pl/admin';
import type { AdminOrderEventView } from '@/server/repositories/admin-orders';

/**
 * What an event's headline reads as.
 *
 * An event whose two statuses match is not a transition - BUG-20 added one
 * for a recorded payment, which changes `paymentStatus` and leaves the
 * order's own status alone. Rendering that through the arrow branch would
 * print „Nowe → Nowe", which says nothing happened when something did. Its
 * note is the event.
 */
function primaryLineOf(event: AdminOrderEventView): string {
  if (event.fromStatus !== null && event.fromStatus === event.toStatus) {
    return event.notePl !== null && event.notePl.length > 0
      ? event.notePl
      : adminOrderStatusLabel(event.toStatus);
  }
  return event.fromStatus === null
    ? adminOrderStatusLabel(event.toStatus)
    : `${adminOrderStatusLabel(event.fromStatus)} → ${adminOrderStatusLabel(event.toStatus)}`;
}

/** Plain rendering of `OrderEvent` rows, oldest first - §16A.1's "order event timeline." */
export function OrderEventTimeline({ events }: { readonly events: readonly AdminOrderEventView[] }) {
  return (
    <List dense disablePadding>
      {events.map((event, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: an immutable, append-only event log, never reordered
        <ListItem key={index} disableGutters>
          <ListItemText
            primary={primaryLineOf(event)}
            secondary={
              <>
                {event.createdAt.toLocaleString('pl-PL')} - {event.actorType}
                {event.actorEmail !== null ? ` (${event.actorEmail})` : ''}
                {/* Not repeated when it is already the headline - see
                    `primaryLineOf`. */}
                {event.notePl !== null && event.notePl.length > 0 && event.notePl !== primaryLineOf(event) && (
                  <span style={{ display: 'block' }}>{event.notePl}</span>
                )}
              </>
            }
          />
        </ListItem>
      ))}
    </List>
  );
}
