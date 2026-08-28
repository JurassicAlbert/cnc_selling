'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert, Button, IconButton, MenuItem, Stack, TextField, Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import type { AdminProductCollectionItem, AdminProductOption } from '@/server/repositories/admin-product-collections';
import { removeProductCollectionItem, setProductCollectionItem } from '@/server/actions/admin-product-collections';
import type { ProductCollectionItemResult } from '@/server/actions/admin-product-collections';

const INITIAL_STATE: ProductCollectionItemResult = { ok: true };

/** Nested editor for assigning products to a `ProductCollection` — same shape as `DesignAssignEditor` (design→product), reversed here (product→collection), no surcharge field since collection membership carries no price. */
export function ProductCollectionItemsEditor({
  collectionId,
  items,
  options,
}: {
  readonly collectionId: string;
  readonly items: readonly AdminProductCollectionItem[];
  readonly options: readonly AdminProductOption[];
}) {
  const available = options.filter((option) => !items.some((item) => item.productId === option.id));

  const action = async (_prev: ProductCollectionItemResult, formData: FormData) =>
    setProductCollectionItem(collectionId, String(formData.get('productId') ?? ''), Number(formData.get('sortOrder') ?? 0));
  const [state, formAction] = useActionState(action, INITIAL_STATE);

  return (
    <Stack spacing={1} sx={{ maxWidth: 560 }}>
      <Typography variant="subtitle1">{ADMIN.productCollectionItemsHeadingPl}</Typography>
      {items.length === 0 && <Typography color="text.secondary">{ADMIN.productCollectionItemsEmptyPl}</Typography>}
      {items.map((item) => (
        <Stack key={item.productId} direction="row" spacing={2} sx={{ alignItems: 'center' }}>
          <Typography sx={{ flex: 1 }}>{item.namePl}</Typography>
          <form action={removeProductCollectionItem.bind(null, collectionId, item.productId)}>
            <IconButton type="submit" size="small" aria-label={ADMIN.removePl}>
              ✕
            </IconButton>
          </form>
        </Stack>
      ))}

      {available.length > 0 && (
        <form action={formAction}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-end', mt: 1 }}>
            {!state.ok && <Alert severity="error">{state.detail}</Alert>}
            <TextField select label={ADMIN.productCollectionItemsFieldProductPl} name="productId" size="small" sx={{ width: 260 }} defaultValue={available[0]?.id}>
              {available.map((option) => (
                <MenuItem key={option.id} value={option.id}>
                  {option.namePl}
                </MenuItem>
              ))}
            </TextField>
            <TextField label={ADMIN.productCollectionItemsFieldSortOrderPl} name="sortOrder" type="number" defaultValue={0} size="small" sx={{ width: 130 }} />
            <SubmitButton />
          </Stack>
        </form>
      )}
    </Stack>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outlined" size="small" disabled={pending}>
      {ADMIN.addPl}
    </Button>
  );
}
