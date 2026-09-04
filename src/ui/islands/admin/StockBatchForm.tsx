'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Alert, Button, Stack, TextField } from '@mui/material';

import { ADMIN, WAREHOUSE } from '@/content/pl/admin';
import { createStockBatch } from '@/server/actions/admin-material-stock';
import type { StockMutationResult } from '@/server/actions/admin-material-stock';
import { usePreservedFormValues } from '@/ui/islands/admin/usePreservedFormValues';

const INITIAL_STATE: StockMutationResult = { ok: true, id: '' };

/**
 * Record a delivery of identical boards.
 *
 * The price field is in zloty because that is what the invoice says, and is
 * converted to grosze here rather than asking an operator to type 32000. That
 * conversion is the same `Math.round(value * 100)` every other money field in
 * the panel uses, so a price entered here rounds exactly the way a price
 * entered anywhere else does.
 */
export function StockBatchForm({ materialId }: { readonly materialId: string }) {
  const router = useRouter();
  const { capture, fieldValue } = usePreservedFormValues();

  const action = async (_prev: StockMutationResult, formData: FormData) => {
    capture(formData);
    const result = await createStockBatch({
      materialId,
      widthMm: Number(formData.get('widthMm') ?? 0),
      heightMm: Number(formData.get('heightMm') ?? 0),
      thicknessMm: Number(formData.get('thicknessMm') ?? 0),
      quantity: Number(formData.get('quantity') ?? 0),
      purchasePriceGrosze: Math.round(Number(formData.get('purchasePricePln') ?? 0) * 100),
      supplierNamePl: String(formData.get('supplierNamePl') ?? ''),
      supplierUrl: String(formData.get('supplierUrl') ?? ''),
      notePl: String(formData.get('notePl') ?? ''),
    });
    if (result.ok) {
      router.refresh();
    }
    return result;
  };
  const [state, formAction] = useActionState(action, INITIAL_STATE);

  return (
    <form action={formAction}>
      <Stack spacing={2} sx={{ maxWidth: 560 }}>
        {!state.ok && <Alert severity="error">{state.detail}</Alert>}

        <Stack direction="row" spacing={2}>
          <TextField
            label={WAREHOUSE.fieldWidthPl}
            name="widthMm"
            type="number"
            defaultValue={fieldValue('widthMm', '')}
            required
            size="small"
          />
          <TextField
            label={WAREHOUSE.fieldHeightPl}
            name="heightMm"
            type="number"
            defaultValue={fieldValue('heightMm', '')}
            required
            size="small"
          />
          <TextField
            label={WAREHOUSE.fieldThicknessPl}
            name="thicknessMm"
            type="number"
            defaultValue={fieldValue('thicknessMm', '')}
            required
            size="small"
          />
        </Stack>

        <Stack direction="row" spacing={2}>
          <TextField
            label={WAREHOUSE.fieldQuantityPl}
            name="quantity"
            type="number"
            defaultValue={fieldValue('quantity', '1')}
            required
            size="small"
          />
          <TextField
            label={WAREHOUSE.fieldPricePl}
            name="purchasePricePln"
            type="number"
            // MUI 9 moved this off the deprecated `inputProps`.
            slotProps={{ htmlInput: { step: '0.01', min: '0' } }}
            defaultValue={fieldValue('purchasePricePln', '')}
            required
            size="small"
          />
        </Stack>

        <TextField
          label={WAREHOUSE.fieldSupplierNamePl}
          name="supplierNamePl"
          defaultValue={fieldValue('supplierNamePl', '')}
          size="small"
        />
        <TextField
          label={WAREHOUSE.fieldSupplierUrlPl}
          name="supplierUrl"
          defaultValue={fieldValue('supplierUrl', '')}
          size="small"
        />
        <TextField
          label={WAREHOUSE.fieldNotePl}
          name="notePl"
          defaultValue={fieldValue('notePl', '')}
          size="small"
        />

        <SubmitButton />
      </Stack>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="contained" disabled={pending} sx={{ alignSelf: 'flex-start' }}>
      {ADMIN.addPl}
    </Button>
  );
}
