import { List, ListItem, ListItemText } from '@mui/material';

import { adminOrderStatusLabel } from '@/content/pl/admin';
import type { AdminOrderEventView } from '@/server/repositories/admin-orders';

/** Plain rendering of `OrderEvent` rows, oldest first — §16A.1's "order event timeline." */
export function OrderEventTimeline({ events }: { readonly events: readonly AdminOrderEventView[] }) {
  return (
    <List dense disablePadding>
      {events.map((event, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: an immutable, append-only event log, never reordered
        <ListItem key={index} disableGutters>
          <ListItemText
            primary={
              event.fromStatus === null
                ? adminOrderStatusLabel(event.toStatus)
                : `${adminOrderStatusLabel(event.fromStatus)} → ${adminOrderStatusLabel(event.toStatus)}`
            }
            secondary={
              <>
                {event.createdAt.toLocaleString('pl-PL')} — {event.actorType}
                {event.actorEmail !== null ? ` (${event.actorEmail})` : ''}
                {event.notePl !== null && event.notePl.length > 0 && (
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
