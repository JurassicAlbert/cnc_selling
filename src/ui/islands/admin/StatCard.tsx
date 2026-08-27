/**
 * The bento-grid KPI tile — Materio's signature dashboard card: a soft
 * colour-tinted rounded icon badge, a big value, a label, and an optional
 * secondary line. Server-renderable (no client state), so the Dashboard
 * page can render nine of these directly without shipping any extra JS.
 */

import type { ReactNode } from 'react';
import { Card, CardContent, Stack, Typography } from '@mui/material';

export type StatCardColor = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';

export function StatCard({
  icon,
  label,
  value,
  subLabel,
  color = 'primary',
}: {
  readonly icon: ReactNode;
  readonly label: string;
  readonly value: string;
  readonly subLabel?: string;
  readonly color?: StatCardColor;
}) {
  return (
    <Card>
      <CardContent>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
          <Stack
            sx={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              // Dot-path strings, not `(theme) => ...` callbacks: `StatCard`
              // is a Server Component, and a function-valued `sx` prop
              // crosses into `Stack` (a Client Component internally) as a
              // prop — Next.js crashes ("Functions cannot be passed
              // directly to Client Components"), confirmed live. MUI's `sx`
              // resolves these plain strings against the theme itself, no
              // callback needed.
              bgcolor: `${color}.main`,
              color: `${color}.contrastText`,
            }}
          >
            {icon}
          </Stack>
          <Stack spacing={0.25} sx={{ minWidth: 0 }}>
            <Typography variant="h5" component="p">
              {value}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {label}
            </Typography>
            {subLabel !== undefined && (
              <Typography variant="caption" color="text.secondary">
                {subLabel}
              </Typography>
            )}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
