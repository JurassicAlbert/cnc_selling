import { Button, MenuItem, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';

import { ADMIN, adminAuditActionLabel } from '@/content/pl/admin';
import { listAuditLogEntities, listAuditLogs } from '@/server/repositories/admin-audit-log';
import type { AuditAction } from '@/server/audit/write-audit-log';

const ACTIONS: readonly AuditAction[] = ['create', 'update', 'delete', 'transition', 'export'];

type AuditLogPageProps = {
  readonly searchParams: Promise<{ readonly entity?: string; readonly action?: string; readonly search?: string }>;
};

export default async function AdminAuditLogPage({ searchParams }: AuditLogPageProps) {
  const params = await searchParams;
  const entity = params.entity !== undefined && params.entity.length > 0 ? params.entity : undefined;
  const action = params.action !== undefined && params.action.length > 0 ? params.action : undefined;
  const search = params.search !== undefined && params.search.length > 0 ? params.search : undefined;

  const [logs, entities] = await Promise.all([listAuditLogs({ entity, action, search }), listAuditLogEntities()]);

  return (
    <>
      <Typography variant="h5" sx={{ mb: 3 }}>
        {ADMIN.auditLogHeadingPl}
      </Typography>

      <form style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <TextField select name="entity" label={ADMIN.auditLogFilterEntityPl} defaultValue={entity ?? ''} size="small" sx={{ minWidth: 180 }}>
          <MenuItem value="">{ADMIN.ordersFilterAnyPl}</MenuItem>
          {entities.map((e) => (
            <MenuItem key={e} value={e}>
              {e}
            </MenuItem>
          ))}
        </TextField>
        <TextField select name="action" label={ADMIN.auditLogFilterActionPl} defaultValue={action ?? ''} size="small" sx={{ minWidth: 180 }}>
          <MenuItem value="">{ADMIN.ordersFilterAnyPl}</MenuItem>
          {ACTIONS.map((a) => (
            <MenuItem key={a} value={a}>
              {adminAuditActionLabel(a)}
            </MenuItem>
          ))}
        </TextField>
        <TextField name="search" label={ADMIN.auditLogFilterSearchPl} defaultValue={search ?? ''} size="small" sx={{ minWidth: 260 }} />
        <Button type="submit" variant="contained">
          {ADMIN.ordersFilterApplyPl}
        </Button>
      </form>

      {logs.length === 0 ? (
        <Typography color="text.secondary">{ADMIN.auditLogEmptyPl}</Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{ADMIN.auditLogColumnDatePl}</TableCell>
              <TableCell>{ADMIN.auditLogColumnActorPl}</TableCell>
              <TableCell>{ADMIN.auditLogColumnEntityPl}</TableCell>
              <TableCell>{ADMIN.auditLogColumnActionPl}</TableCell>
              <TableCell>{ADMIN.auditLogColumnDiffPl}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id} hover>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{log.createdAt.toLocaleString('pl-PL')}</TableCell>
                <TableCell>{log.actorEmail}</TableCell>
                <TableCell>
                  {log.entity}
                  {log.entityId !== null && (
                    <Typography component="span" variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      {log.entityId}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>{adminAuditActionLabel(log.action)}</TableCell>
                <TableCell sx={{ maxWidth: 420 }}>
                  {log.diff !== null ? (
                    <Typography
                      component="pre"
                      variant="caption"
                      sx={{ m: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace' }}
                    >
                      {JSON.stringify(log.diff, null, 2)}
                    </Typography>
                  ) : (
                    ADMIN.auditLogNoDiffPl
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}
