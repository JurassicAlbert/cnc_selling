'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert, Button, Chip, IconButton, Stack, TextField, Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import type { AdminProductImage } from '@/server/repositories/admin-products';
import { removeProductImage, setPrimaryProductImage, uploadProductImage } from '@/server/actions/admin-product-images';
import type { ActionResult } from '@/server/actions/admin-product-images';
import { FileInputButton } from '@/ui/islands/FileInputButton';

const INITIAL_STATE: ActionResult = { ok: true };

export function ProductImagesEditor({ productId, images }: { readonly productId: string; readonly images: readonly AdminProductImage[] }) {
  const action = async (_prev: ActionResult, formData: FormData) => uploadProductImage(productId, formData);
  const [state, formAction] = useActionState(action, INITIAL_STATE);

  return (
    <Stack spacing={1} sx={{ maxWidth: 640 }}>
      <Typography variant="subtitle1">{ADMIN.productSectionImagesPl}</Typography>
      {images.length === 0 && <Typography color="text.secondary">{ADMIN.imagesEmptyPl}</Typography>}
      <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }}>
        {images.map((image) => (
          <Stack key={image.id} spacing={1} sx={{ width: 160 }}>
            {/* biome-ignore lint/performance/noImgElement: admin-uploaded catalogue photo served straight from public/, next/image adds nothing here */}
            <img src={image.url} alt={image.altPl} style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 4 }} />
            {image.isPrimary ? (
              <Chip size="small" label={ADMIN.imagePrimaryLabelPl} color="primary" />
            ) : (
              <form action={setPrimaryProductImage.bind(null, productId, image.id)}>
                <Button type="submit" size="small">
                  {ADMIN.imageSetPrimaryPl}
                </Button>
              </form>
            )}
            <form action={removeProductImage.bind(null, productId, image.id)}>
              <IconButton type="submit" size="small" aria-label={ADMIN.removePl}>
                ✕
              </IconButton>
            </form>
          </Stack>
        ))}
      </Stack>

      <form action={formAction} encType="multipart/form-data">
        <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-end', mt: 1 }}>
          {!state.ok && <Alert severity="error">{state.detail}</Alert>}
          <FileInputButton name="file" accept="image/jpeg,image/png,image/webp" required label={ADMIN.imageUploadPl} chooseLabel={ADMIN.fileChoosePl} />
          <TextField label={ADMIN.imageFieldAltPl} name="altPl" size="small" sx={{ width: 220 }} />
          <SubmitButton />
        </Stack>
      </form>
    </Stack>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outlined" size="small" disabled={pending}>
      {ADMIN.imageUploadPl}
    </Button>
  );
}
