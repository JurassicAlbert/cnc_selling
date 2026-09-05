'use client';

/*
  Extracted from `Configurator.tsx` on 2026-09-05 for `docs/AI-CHECKLIST.md`
  ARCH-02: that file was 1 632 lines, three times the next largest in the
  repository, with no test of its own except through e2e. Moved verbatim -
  same body, same props, same behaviour - along a seam that already existed.
  The state model stays in `Configurator.tsx`, which is what ARCH-02 asks.
*/

import { useState } from 'react';
import { Alert, Button, Checkbox, FormControlLabel, MenuItem, TextField } from '@mui/material';

import { SITE } from '@/content/pl/site';
import { COPY, customerDesignStatusMessage, uploadErrorMessage, uploadWarningMessage } from '@/content/pl/messages';
import type { UploadErrorCode } from '@/content/pl/messages';
import { UPLOAD } from '@/content/pl/upload';
import { maxUploadSizeBytes } from '@/domain/upload/inspect';
import type { UploadWarning } from '@/domain/upload/inspect';
import { uploadCustomDesign } from '@/server/actions/upload';
import type { UploadCustomDesignResult } from '@/server/actions/upload';
import type { OwnedCustomerDesignListItem } from '@/server/repositories/customer-designs';
import { FileInputButton } from '@/ui/islands/FileInputButton';
import { Text } from '@/ui/primitives/Text';

export function CustomUploadStep({
  customerDesignId,
  savedDesigns,
  onUploaded,
}: {
  readonly customerDesignId: string | null;
  readonly savedDesigns: readonly OwnedCustomerDesignListItem[];
  readonly onUploaded: (customerDesignId: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [ipConsent, setIpConsent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<UploadErrorCode | null>(null);
  const [errorParams, setErrorParams] = useState<Record<string, number> | undefined>(undefined);
  const [warnings, setWarnings] = useState<readonly UploadWarning[]>([]);
  const [selectedSavedDesignId, setSelectedSavedDesignId] = useState('');

  const handleSubmit = async () => {
    if (file === null) {
      setError('NO_FILE');
      setErrorParams(undefined);
      return;
    }
    setPending(true);
    setError(null);
    setErrorParams(undefined);
    const formData = new FormData();
    formData.set('file', file);
    if (ipConsent) {
      formData.set('ipConsent', 'on');
    }

    // A file large enough to exceed next.config's own `serverActions.
    // bodySizeLimit` (26mb - deliberately just above the app's real 25MB
    // cap, see next.config's own comment) never reaches `uploadCustomDesign`
    // at all: Next.js rejects the request at the framework boundary and the
    // call throws instead of resolving `{ok: false}`. Found live while
    // verifying this exact upload flow - without this catch, `pending`
    // never clears and the customer is stuck on "Przesyłanie..." forever,
    // the failure visible only in the browser console. `file.size`/`file.
    // type` are already known client-side, so the same real-numbers
    // `FILE_TOO_LARGE` message can be shown immediately, no server
    // round-trip needed to know what went wrong.
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
    onUploaded(result.customerDesignId);
  };

  if (customerDesignId !== null) {
    // Reusing a design from `savedDesigns` is a real, previously-existing
    // row - it may already be APPROVED, not "just uploaded and pending."
    // Showing the hardcoded pending/needs-review copy for an already
    // -approved reused design would be actively wrong, not just imprecise.
    const reused = savedDesigns.find((design) => design.id === customerDesignId);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 480 }}>
        <Alert severity="success">
          {reused !== undefined ? SITE.configuratorUploadReuseSuccessPl : SITE.configuratorUploadSuccessPl}
        </Alert>
        <Text muted>{reused !== undefined ? customerDesignStatusMessage(reused.status) : COPY.designStatusPending}</Text>
        {(reused === undefined || reused.status === 'PENDING_REVIEW') && <Text muted>{COPY.customDesignNeedsReview}</Text>}
        {warnings.map((warning) => (
          <Alert severity="warning" key={warning.code}>
            {uploadWarningMessage(warning)}
          </Alert>
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 480 }}>
      {savedDesigns.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Text muted>{SITE.configuratorUploadReuseHeadingPl}</Text>
          <TextField
            select
            size="small"
            label={SITE.configuratorUploadReuseSelectLabelPl}
            value={selectedSavedDesignId}
            onChange={(e) => setSelectedSavedDesignId(e.target.value)}
          >
            {savedDesigns.map((design) => (
              <MenuItem key={design.id} value={design.id}>
                {design.titlePl ?? design.originalName} - {customerDesignStatusMessage(design.status)}
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="outlined"
            disabled={selectedSavedDesignId === ''}
            onClick={() => onUploaded(selectedSavedDesignId)}
            sx={{ alignSelf: 'flex-start' }}
          >
            {SITE.configuratorUploadReuseButtonPl}
          </Button>
          <Text muted>{SITE.configuratorUploadReuseOrNewPl}</Text>
        </div>
      )}

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

      <Button
        variant="contained"
        disabled={pending || file === null || !ipConsent}
        onClick={handleSubmit}
      >
        {pending ? SITE.configuratorUploadSubmittingPl : SITE.configuratorUploadSubmitPl}
      </Button>
    </div>
  );
}
