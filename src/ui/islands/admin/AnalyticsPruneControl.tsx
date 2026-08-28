'use client';

import { useState, useTransition } from 'react';
import { Alert, Stack, Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import { pruneAnalyticsEvents } from '@/server/actions/admin-analytics';
import { ConfirmSubmitButton } from '@/ui/primitives/ConfirmSubmitButton';

/**
 * `docs/CHECKLIST.md`'s "12-month pruning of analytics rows" — real,
 * staff-triggered (no scheduler exists anywhere in this project). Uses
 * `ConfirmSubmitButton`'s `onConfirm`/`pending` mode rather than its
 * `formId` mode: this isn't a plain form submission, it calls the Server
 * Action directly so the real deleted count can be shown afterward.
 */
export function AnalyticsPruneControl({ initialPrunableCount }: { readonly initialPrunableCount: number }) {
  const [prunableCount, setPrunableCount] = useState(initialPrunableCount);
  const [deletedCount, setDeletedCount] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  const handleConfirm = () => {
    startTransition(async () => {
      const result = await pruneAnalyticsEvents();
      setDeletedCount(result.deletedCount);
      setPrunableCount(0);
    });
  };

  return (
    <Stack spacing={1} sx={{ maxWidth: 480 }}>
      <Typography variant="caption" color="text.secondary">
        {ADMIN.settingsAnalyticsRetentionNoticePl}
      </Typography>
      <Typography variant="body2">{ADMIN.settingsAnalyticsPrunableCountPl(prunableCount)}</Typography>
      {deletedCount !== null && <Alert severity="success">{ADMIN.settingsAnalyticsPrunedNoticePl(deletedCount)}</Alert>}
      <ConfirmSubmitButton
        label={ADMIN.settingsAnalyticsPruneButtonPl}
        confirmTitle={ADMIN.settingsAnalyticsPruneConfirmTitlePl}
        confirmMessage={ADMIN.settingsAnalyticsPruneConfirmMessagePl}
        confirmLabel={ADMIN.settingsAnalyticsPruneConfirmButtonPl}
        cancelLabel={ADMIN.cancelPl}
        variant="outlined"
        color="error"
        disabled={prunableCount === 0}
        onConfirm={handleConfirm}
        pending={pending}
      />
    </Stack>
  );
}
