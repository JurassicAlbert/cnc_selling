'use client';

import { Button } from '@mui/material';

export function PrintButton({ label }: { readonly label: string }) {
  return (
    <Button
      type="button"
      variant="contained"
      size="small"
      onClick={() => window.print()}
      sx={{ '@media print': { display: 'none' } }}
    >
      {label}
    </Button>
  );
}
