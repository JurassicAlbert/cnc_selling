'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert, Box, Button, Chip, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';

import { ADMIN, csvImportSuccessMessage } from '@/content/pl/admin';

export type CsvImportRowResult = {
  readonly row: number;
  readonly slug: string;
  readonly ok: boolean;
  readonly detail: string | null;
};

export type CsvImportResult =
  | { readonly ok: true; readonly createdCount: number; readonly rows: readonly CsvImportRowResult[] }
  | { readonly ok: false; readonly detail: string };

const INITIAL_STATE: CsvImportResult = { ok: true, createdCount: 0, rows: [] };

/**
 * A real, generic CSV bulk-import form - `docs/CHECKLIST.md`'s "CSV
 * import/export on catalogue tables" (export already existed via `DataGrid`'s
 * own toolbar; this is the missing import half). Every row goes through the
 * exact same `applyCreateX` a manual create does, so imported rows are
 * indistinguishable from hand-typed ones - see e.g. `applyImportCategoriesFromCsv`
 * in `admin-categories.ts`. A bad row never aborts the whole batch: this
 * reports per-row success/failure, since a staff member fixing a large CSV
 * needs to know exactly which rows to fix, not just "something failed."
 */
export function CsvImportForm({
  action,
  expectedColumns,
}: {
  readonly action: (formData: FormData) => Promise<CsvImportResult>;
  readonly expectedColumns: readonly string[];
}) {
  const boundAction = async (_prev: CsvImportResult, formData: FormData) => action(formData);
  const [state, formAction] = useActionState(boundAction, INITIAL_STATE);
  const skipped = state.ok ? state.rows.filter((row) => !row.ok) : [];

  return (
    <Paper variant="outlined" sx={{ p: 3, mb: 4, maxWidth: 640 }}>
      <Stack spacing={1.5}>
        <Typography variant="h6">{ADMIN.csvImportHeadingPl}</Typography>
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
            {ADMIN.csvImportColumnsHintPl}:
          </Typography>
          <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
            {expectedColumns.map((column) => (
              <Chip key={column} label={column} size="small" variant="outlined" sx={{ fontFamily: 'monospace' }} />
            ))}
          </Stack>
        </Box>
        <form action={formAction}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <input type="file" name="file" accept=".csv,text/csv" required />
            <SubmitButton />
          </Stack>
        </form>
        {!state.ok && <Alert severity="error">{state.detail}</Alert>}
        {state.ok && state.rows.length > 0 && (
          <Alert severity={skipped.length === 0 ? 'success' : 'warning'}>{csvImportSuccessMessage(state.createdCount)}</Alert>
        )}
        {skipped.length > 0 && (
          <>
            <Typography variant="subtitle2">{ADMIN.csvImportSkippedHeadingPl}</Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{ADMIN.csvImportColumnRowPl}</TableCell>
                  <TableCell>{ADMIN.csvImportColumnSlugPl}</TableCell>
                  <TableCell>{ADMIN.csvImportColumnReasonPl}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {skipped.map((row) => (
                  <TableRow key={row.row}>
                    <TableCell>{row.row}</TableCell>
                    <TableCell>{row.slug.length > 0 ? row.slug : '-'}</TableCell>
                    <TableCell>{row.detail}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </Stack>
    </Paper>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outlined" size="small" disabled={pending}>
      {pending ? ADMIN.csvImportPendingPl : ADMIN.csvImportButtonPl}
    </Button>
  );
}
