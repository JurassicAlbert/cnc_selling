import { Divider, Stack, Typography } from '@mui/material';

import { ADMIN, adminAuditActionLabel } from '@/content/pl/admin';
import { listAuditLogsForEntity } from '@/server/repositories/admin-audit-log';

/**
 * A single record's mutation history, embedded on that entity's own admin
 * detail page - `docs/CHECKLIST.md`'s "activity timeline on every record,
 * from the audit log". Distinct from `/panel/dziennik-zdarzen` (the
 * cross-entity log viewer): this is scoped to one `(entity, entityId)` pair
 * and reads no `searchParams`, so it's a plain async Server Component, not
 * a client island - no interactivity needed, just a fetch + render.
 */
export async function RecordActivityTimeline({ entity, entityId }: { readonly entity: string; readonly entityId: string }) {
  const logs = await listAuditLogsForEntity(entity, entityId);

  return (
    <Stack spacing={2} sx={{ mt: 4 }}>
      <Typography variant="h6">{ADMIN.activityTimelineHeadingPl}</Typography>
      {logs.length === 0 ? (
        <Typography color="text.secondary">{ADMIN.activityTimelineEmptyPl}</Typography>
      ) : (
        <Stack divider={<Divider flexItem />} spacing={1.5}>
          {logs.map((log) => (
            <Stack key={log.id} spacing={0.5}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline', flexWrap: 'wrap' }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {adminAuditActionLabel(log.action)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {log.createdAt.toLocaleString('pl-PL')} · {log.actorEmail}
                </Typography>
              </Stack>
              {log.diff !== null && (
                <Typography
                  component="pre"
                  variant="caption"
                  color="text.secondary"
                  sx={{ m: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace' }}
                >
                  {JSON.stringify(log.diff, null, 2)}
                </Typography>
              )}
            </Stack>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
