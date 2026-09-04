'use client';

/**
 * 2026-08-28, owner feedback: "cały formularz logowania dalej ma zbyt
 * biedne UI/UX... wygląda jakbyś na siłę chciał dostosować do
 * minimalistycznego frontendu i wychodzi vanilla html/css look" - the
 * login/register pages were a bare heading + a raw `Stack` of `TextField`s
 * with no visual framing at all. `theme.ts`'s flattened shadows/minimal
 * radius are a deliberate brand choice (ARCHITECTURE.md §2.1: "the stock
 * Material look reads as admin dashboard"), not licence to skip real
 * visual design - this panel earns its presence with a real `Paper`
 * frame, a brand icon badge, and (for login) real `Tabs` instead of two
 * separate forms stacked with a plain divider between them, which is
 * exactly the "bolted-on" look that was flagged.
 */

import { type ReactNode, useState } from 'react';
import EngineeringIcon from '@mui/icons-material/Engineering';
import { Avatar, Box, Paper, Tab, Tabs, Typography } from '@mui/material';

export function AuthPanel({ heading, children }: { readonly heading: string; readonly children: ReactNode }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        maxWidth: 440,
        mx: { xs: 0, sm: 'auto' },
        p: { xs: 3, sm: 5 },
        borderTop: '3px solid',
        borderTopColor: 'secondary.main',
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3, textAlign: 'center' }}>
        <Avatar sx={{ bgcolor: 'secondary.main', width: 56, height: 56, mb: 1.5 }}>
          <EngineeringIcon />
        </Avatar>
        <Typography variant="h5" component="h1">
          {heading}
        </Typography>
      </Box>
      {children}
    </Paper>
  );
}

export function AuthTabs({
  passwordTabLabel,
  otpTabLabel,
  passwordPanel,
  otpPanel,
}: {
  readonly passwordTabLabel: string;
  readonly otpTabLabel: string;
  readonly passwordPanel: ReactNode;
  readonly otpPanel: ReactNode;
}) {
  const [tab, setTab] = useState(0);
  return (
    <Box>
      <Tabs value={tab} onChange={(_e, value) => setTab(value)} variant="fullWidth" sx={{ mb: 3 }}>
        <Tab label={passwordTabLabel} />
        <Tab label={otpTabLabel} />
      </Tabs>
      <Box role="tabpanel" hidden={tab !== 0}>
        {tab === 0 && passwordPanel}
      </Box>
      <Box role="tabpanel" hidden={tab !== 1}>
        {tab === 1 && otpPanel}
      </Box>
    </Box>
  );
}
