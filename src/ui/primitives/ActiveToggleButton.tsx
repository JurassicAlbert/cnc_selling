import { Button } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';

/**
 * Shared activate/deactivate button for `Category`/`Product` — both use the
 * same soft-delete-only pattern (§16A.2). A plain zero-client-JS form
 * bound to a Server Action, same convention `koszyk/page.tsx` already uses
 * for cart quantity/remove — no client component needed for a single
 * submit button.
 */
export function ActiveToggleButton({
  isActive,
  action,
}: {
  readonly isActive: boolean;
  readonly action: () => Promise<void>;
}) {
  return (
    <form action={action}>
      <Button type="submit" size="small" variant="outlined" color={isActive ? 'error' : 'primary'}>
        {isActive ? ADMIN.deactivatePl : ADMIN.activatePl}
      </Button>
    </form>
  );
}
