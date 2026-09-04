import { Button } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';

/**
 * Shared "Duplikuj" button for Product/Design/Material detail pages.
 * Same zero-client-JS form-bound-to-a-Server-Action shape as
 * `ActiveToggleButton` - the action itself redirects to the new
 * record's page on success (see `duplicateProductAndGo` and its
 * siblings), so no client-side state is needed here either.
 */
export function DuplicateButton({ action }: { readonly action: () => Promise<void> }) {
  return (
    <form action={action}>
      <Button type="submit" size="small" variant="outlined">
        {ADMIN.duplicatePl}
      </Button>
    </form>
  );
}
