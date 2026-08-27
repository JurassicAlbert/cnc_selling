'use client';

/**
 * Runs on mount, no separate "simulate" button — the "publish blocked until
 * simulation viewed" rule (`docs/ARCHITECTURE.md` §16A.1 module 7) means
 * there must be no path to Publish that skips ever seeing this table. The
 * Publish button below only becomes enabled once this fetch has resolved
 * (success or error — an error is still "reviewed," it just means don't
 * publish yet). A real `ConfirmSubmitButton` dialog gates the actual publish
 * call — this changes every price on the site, and is genuinely
 * irreversible (publishing flips the previously-active version inactive in
 * the same atomic transaction, no path back). Replaced a `window.confirm()`
 * placeholder — see `ConfirmSubmitButton`'s own doc comment.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import { formatPln } from '@/domain/money/money';
import { publishPricingVersion, simulatePricingDraft } from '@/server/actions/admin-pricing';
import type { SimulatePricingResult } from '@/server/actions/admin-pricing';
import { ConfirmSubmitButton } from '@/ui/primitives/ConfirmSubmitButton';

function delta(current: number | null, draft: number | null): string {
  if (current === null || draft === null) {
    return '—';
  }
  const diff = draft - current;
  const sign = diff > 0 ? '+' : '';
  return `${sign}${formatPln(diff)}`;
}

export function PricingSimulator({ version, alreadyActive }: { readonly version: number; readonly alreadyActive: boolean }) {
  const router = useRouter();
  const [result, setResult] = useState<SimulatePricingResult | null>(null);
  const [publishState, setPublishState] = useState<{ readonly pending: boolean; readonly error: string | null }>({
    pending: false,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    simulatePricingDraft(version).then((r) => {
      if (!cancelled) {
        setResult(r);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [version]);

  async function handlePublish() {
    setPublishState({ pending: true, error: null });
    const publishResult = await publishPricingVersion(version);
    if (publishResult.ok) {
      router.push('/panel/ceny');
    } else {
      setPublishState({ pending: false, error: publishResult.detail });
    }
  }

  return (
    <>
      <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>
        {ADMIN.pricingSimulatorHeadingPl}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {ADMIN.pricingSimulatorIntroPl}
      </Typography>

      {result === null && <Alert severity="info">{ADMIN.pricingSimulatorLoadingPl}</Alert>}
      {result !== null && !result.ok && <Alert severity="error">{ADMIN.pricingSimulatorErrorPl}</Alert>}
      {result?.ok && (
        <Table size="small" sx={{ mb: 2, maxWidth: 640 }}>
          <TableHead>
            <TableRow>
              <TableCell>{ADMIN.pricingSimulatorColumnProductPl}</TableCell>
              <TableCell align="right">{ADMIN.pricingSimulatorColumnCurrentPl}</TableCell>
              <TableCell align="right">{ADMIN.pricingSimulatorColumnDraftPl}</TableCell>
              <TableCell align="right">{ADMIN.pricingSimulatorColumnDeltaPl}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {result.rows.map((row) => (
              <TableRow key={row.slug}>
                <TableCell>{row.namePl}</TableCell>
                {row.status === 'ok' ? (
                  <>
                    <TableCell align="right">{formatPln(row.currentGrossGrosze ?? 0)}</TableCell>
                    <TableCell align="right">{formatPln(row.draftGrossGrosze ?? 0)}</TableCell>
                    <TableCell align="right">{delta(row.currentGrossGrosze, row.draftGrossGrosze)}</TableCell>
                  </>
                ) : (
                  <TableCell colSpan={3} align="right">
                    <Typography variant="body2" color="text.secondary">
                      {ADMIN.pricingSimulatorUnpriceablePl}
                    </Typography>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {publishState.error !== null && (
        <Alert severity="error" sx={{ mb: 1, maxWidth: 640 }}>
          {publishState.error}
        </Alert>
      )}
      {alreadyActive ? (
        <Alert severity="success" sx={{ maxWidth: 640 }}>
          {ADMIN.pricingAlreadyActivePl}
        </Alert>
      ) : (
        <>
          <ConfirmSubmitButton
            label={ADMIN.pricingPublishPl}
            confirmTitle={ADMIN.pricingPublishConfirmTitlePl}
            confirmMessage={ADMIN.pricingPublishConfirmPl}
            confirmLabel={ADMIN.pricingPublishConfirmButtonPl}
            cancelLabel={ADMIN.cancelPl}
            color="warning"
            disabled={result === null}
            pending={publishState.pending}
            onConfirm={handlePublish}
          />
          {result === null && (
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.5 }}>
              {ADMIN.pricingPublishBlockedHintPl}
            </Typography>
          )}
        </>
      )}
    </>
  );
}
