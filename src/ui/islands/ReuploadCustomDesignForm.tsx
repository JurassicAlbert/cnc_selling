'use client';

/**
 * P9 continuation, 2026-08-28 — the other half of the NEEDS_CHANGES flow
 * `docs/CHECKLIST.md` flagged as still missing after the discussion thread
 * shipped (`DesignReviewDiscussion.tsx`): `reuploadCustomDesign`
 * (`server/actions/design-review.ts`) has been real and tested since P7,
 * but had no UI. Only rendered by the parent page when
 * `status === 'NEEDS_CHANGES'` — `reuploadCustomDesign` itself already
 * refuses any other status via `checkDesignReviewTransition`, so this is
 * belt-and-suspenders, not the only guard. No consent checkbox: the
 * original upload already captured the IP declaration
 * (`ipConfirmedAt`/`ipDeclarationTextPl` on `CustomerDesign`); a corrected
 * file for the same design isn't a new declaration.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Stack, Typography } from '@mui/material';

import { SITE } from '@/content/pl/site';
import { uploadErrorMessage, uploadWarningMessage } from '@/content/pl/messages';
import type { UploadWarning } from '@/domain/upload/inspect';
import { maxUploadSizeBytes } from '@/domain/upload/inspect';
import { reuploadCustomDesign } from '@/server/actions/design-review';
import type { ReuploadCustomDesignErrorCode, ReuploadCustomDesignResult } from '@/server/actions/design-review';

export function ReuploadCustomDesignForm({ customerDesignId }: { readonly customerDesignId: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ReuploadCustomDesignErrorCode | null>(null);
  const [errorParams, setErrorParams] = useState<Record<string, number> | undefined>(undefined);
  const [warnings, setWarnings] = useState<readonly UploadWarning[]>([]);
  const [successNotice, setSuccessNotice] = useState(false);

  const handleSubmit = async () => {
    if (file === null) {
      setError('NO_FILE');
      setErrorParams(undefined);
      return;
    }
    setPending(true);
    setError(null);
    setErrorParams(undefined);
    setSuccessNotice(false);
    const formData = new FormData();
    formData.set('file', file);

    // Same "the framework can reject before the Server Action ever runs"
    // case `CustomerDesignUploadForm.tsx` already guards against.
    let result: ReuploadCustomDesignResult;
    try {
      result = await reuploadCustomDesign(customerDesignId, formData);
    } catch {
      setPending(false);
      setError('FILE_TOO_LARGE');
      const maxBytes = maxUploadSizeBytes(file.type);
      setErrorParams(maxBytes === null ? undefined : { actualBytes: file.size, maxBytes });
      return;
    }
    setPending(false);
    if (!result.ok) {
      setError(result.code);
      setErrorParams(result.params);
      return;
    }
    setWarnings(result.warnings);
    setSuccessNotice(true);
    setFile(null);
    router.refresh();
  };

  return (
    <Stack spacing={2} sx={{ maxWidth: 480 }}>
      <Alert severity="warning">{SITE.designDetailNeedsChangesNoticePl}</Alert>
      <Typography variant="h6">{SITE.configuratorUploadReplacePl}</Typography>

      <div>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {SITE.configuratorUploadChooseFilePl}
        </Typography>
        <input
          type="file"
          accept=".jpg,.jpeg,.png,.svg,.pdf,image/jpeg,image/png,image/svg+xml,application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </div>

      {error !== null && <Alert severity="error">{uploadErrorMessage(error, errorParams)}</Alert>}
      {successNotice && <Alert severity="success">{SITE.configuratorUploadSuccessPl}</Alert>}
      {warnings.map((warning) => (
        <Alert severity="warning" key={warning.code}>
          {uploadWarningMessage(warning)}
        </Alert>
      ))}

      <Button variant="contained" disabled={pending || file === null} onClick={handleSubmit} sx={{ alignSelf: 'flex-start' }}>
        {pending ? SITE.configuratorUploadSubmittingPl : SITE.configuratorUploadSubmitPl}
      </Button>
    </Stack>
  );
}
