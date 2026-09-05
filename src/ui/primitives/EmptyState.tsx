import Link from 'next/link';
import { Button, Stack, Typography } from '@mui/material';

/**
 * A real empty state, not a blank table - `docs/CHECKLIST.md`/
 * `ARCHITECTURE.md` §16A.5: "Real empty states that tell you what to do
 * next." Used on the panel's top-level catalogue/content list pages,
 * where "what to do next" is always the same real action already sitting
 * in the page's own heading button - this repeats it inline, next to the
 * empty message itself, so the next step is visible without having to
 * notice a button elsewhere on the page.
 */
export function EmptyState({
  message,
  actionLabel,
  actionHref,
}: {
  readonly message: string;
  readonly actionLabel?: string;
  readonly actionHref?: string;
}) {
  return (
    <Stack spacing={1.5} sx={{ alignItems: 'flex-start' }}>
      <Typography color="text.secondary">{message}</Typography>
      {actionLabel !== undefined && actionHref !== undefined && (
        <Link href={actionHref} style={{ textDecoration: 'none' }}>
          <Button variant="outlined" size="small">
            {actionLabel}
          </Button>
        </Link>
      )}
    </Stack>
  );
}
