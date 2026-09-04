/**
 * P9 continuation, 2026-08-28 - owner feedback: the account panel's
 * remaining sub-pages were still bare `<div>`/`<Link>`/`<button>` rows.
 * Real MUI cards for the saved-configuration ("zapisane projekty") list,
 * same visual language as `AccountOrdersList`/`AccountDashboard`.
 *
 * The "Dodaj do koszyka" button stays a real `<form action={...}>` bound
 * to a Server Action (zero client JS, matching `AccountNav.tsx`'s own
 * logout-button precedent) - `<Button type="submit">` needs no `component`
 * override to render as a native `<button>`, so no function-reference prop
 * crosses the Server→Client boundary (unlike `component={Link}`, which
 * this session found crashes when the caller has no `'use client'` -
 * `PatternsGallery.tsx`'s header comment). The "Edytuj" link is a plain
 * `next/link` used as JSX composition (children), not passed as a prop, for
 * the same reason.
 *
 * No `'use client'`: nothing here needs client-side state.
 */

import Image from 'next/image';
import Link from 'next/link';
import TurnedInIcon from '@mui/icons-material/TurnedIn';
import { Box, Button, Card, CardContent, Stack, Typography } from '@mui/material';

import { formatPln } from '@/domain/money/money';
import { SITE } from '@/content/pl/site';
import { addSavedConfigurationToCart, deleteSavedConfiguration } from '@/server/actions/cart';
import type { SavedConfigurationView } from '@/server/repositories/cart';
import { writeSelectionsToSearch } from '@/ui/islands/configurator/selections-url';

export function AccountConfigurationsList({ configurations }: { readonly configurations: readonly SavedConfigurationView[] }) {
  return (
    <Stack spacing={2}>
      {configurations.map((configuration) => {
        const editHref = `/produkt/${configuration.productSlug}?${writeSelectionsToSearch(configuration.selections)}&edit=${configuration.configurationId}`;
        return (
          <Card key={configuration.configurationId} variant="outlined">
            <CardContent>
              <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                {configuration.imageUrl !== null ? (
                  <Box sx={{ position: 'relative', width: 64, height: 64, borderRadius: 1, overflow: 'hidden', flexShrink: 0 }}>
                    <Image src={configuration.imageUrl} alt={configuration.productNamePl} fill sizes="64px" style={{ objectFit: 'cover' }} />
                  </Box>
                ) : (
                  <Box
                    sx={{
                      width: 64,
                      height: 64,
                      borderRadius: 1,
                      bgcolor: 'secondary.main',
                      color: 'background.paper',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <TurnedInIcon fontSize="small" />
                  </Box>
                )}

                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="subtitle1">{configuration.productNamePl}</Typography>
                  {configuration.priceGrossGrosze !== null && (
                    <Typography variant="body2" color="text.secondary">
                      {formatPln(configuration.priceGrossGrosze)}
                    </Typography>
                  )}
                </Box>

                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexShrink: 0 }}>
                  <Link href={editHref} style={{ font: 'var(--mui-font-body2)' }}>
                    {SITE.accountConfigurationEditPl}
                  </Link>
                  {configuration.isComplete && (
                    <form
                      action={addSavedConfigurationToCart.bind(
                        null,
                        configuration.productSlug,
                        configuration.selections,
                        configuration.acknowledgedWarnings,
                        1,
                      )}
                    >
                      <Button type="submit" size="small" variant="outlined">
                        {SITE.accountConfigurationAddToCartPl}
                      </Button>
                    </form>
                  )}
                  {/*
                   * 2026-08-30: saved projects could only ever accumulate -
                   * there was no way to remove one, which is part of why
                   * duplicates felt permanent. A project currently in the
                   * cart is refused server-side rather than cascaded, so
                   * this never empties a line out of someone's cart behind
                   * their back.
                   */}
                  <form action={deleteSavedConfiguration.bind(null, configuration.configurationId)}>
                    <Button type="submit" size="small" color="error" variant="text">
                      {SITE.accountConfigurationDeletePl}
                    </Button>
                  </form>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        );
      })}
    </Stack>
  );
}
