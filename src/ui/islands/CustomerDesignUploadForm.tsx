'use client';

/**
 * P9 phase 2 — the standalone upload form for `/moje-konto/wzory`, the new
 * real home for uploading a custom design (previously only reachable
 * inline inside the `CUSTOM` product's own configurator step). Reuses
 * `uploadCustomDesign` unchanged — the exact same validation/inspection/
 * consent pipeline as the configurator's own upload, just with a `titlePl`
 * field added (the Server Action already accepts it, optional, so the
 * configurator's own inline upload — which sends no title — keeps working
 * exactly as before). On success, calls `router.refresh()` so the list
 * above this form picks up the new row from the Server Component parent,
 * the same "Server Actions + router boundary" shape every mutation in
 * this codebase already uses.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Checkbox, FormControlLabel, Stack, TextField, Typography } from '@mui/material';

import { SITE } from '@/content/pl/site';
import { FileInputButton } from '@/ui/islands/FileInputButton';
import { UPLOAD } from '@/content/pl/upload';
import { uploadErrorMessage, uploadWarningMessage } from '@/content/pl/messages';
import type { UploadErrorCode } from '@/content/pl/messages';
import type { UploadWarning } from '@/domain/upload/inspect';
import { maxUploadSizeBytes } from '@/domain/upload/inspect';
import { uploadCustomDesign } from '@/server/actions/upload';
import type { UploadCustomDesignResult } from '@/server/actions/upload';

export function CustomerDesignUploadForm() {
  const router = useRouter();
  const [titlePl, setTitlePl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [ipConsent, setIpConsent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<UploadErrorCode | null>(null);
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
    if (titlePl.trim().length > 0) {
      formData.set('titlePl', titlePl.trim());
    }
    if (ipConsent) {
      formData.set('ipConsent', 'on');
    }

    // Same "the framework can reject before the Server Action ever runs"
    // case `Configurator.tsx`'s own upload step already found and fixed —
    // a file just over `next.config`'s body-size buffer throws instead of
    // resolving `{ok: false}`.
    let result: UploadCustomDesignResult;
    try {
      result = await uploadCustomDesign(formData);
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
    setTitlePl('');
    setFile(null);
    router.refresh();
  };

  return (
    <Stack spacing={2} sx={{ maxWidth: 480 }}>
      <Typography variant="h6">{SITE.accountDesignsUploadHeadingPl}</Typography>

      <TextField
        label={SITE.accountDesignsTitleFieldLabelPl}
        placeholder={SITE.accountDesignsTitleFieldPlaceholderPl}
        value={titlePl}
        onChange={(e) => setTitlePl(e.target.value)}
        size="small"
      />

      <FileInputButton
        accept=".jpg,.jpeg,.png,.svg,.pdf,image/jpeg,image/png,image/svg+xml,application/pdf"
        label={SITE.configuratorUploadChooseFilePl}
        chooseLabel={SITE.configuratorUploadChooseFilePl}
        onFileChange={setFile}
      />

      <Alert severity="info">{UPLOAD.ipDeclarationTextPl}</Alert>
      <FormControlLabel
        control={<Checkbox checked={ipConsent} onChange={(e) => setIpConsent(e.target.checked)} />}
        label={SITE.configuratorUploadIpConsentLabelPl}
      />

      {error !== null && <Alert severity="error">{uploadErrorMessage(error, errorParams)}</Alert>}
      {successNotice && <Alert severity="success">{SITE.configuratorUploadSuccessPl}</Alert>}
      {warnings.map((warning) => (
        <Alert severity="warning" key={warning.code}>
          {uploadWarningMessage(warning)}
        </Alert>
      ))}

      <Button variant="contained" disabled={pending || file === null || !ipConsent} onClick={handleSubmit} sx={{ alignSelf: 'flex-start' }}>
        {pending ? SITE.configuratorUploadSubmittingPl : SITE.configuratorUploadSubmitPl}
      </Button>
    </Stack>
  );
}
