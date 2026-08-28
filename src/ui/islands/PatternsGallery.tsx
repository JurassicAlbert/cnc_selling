'use client';

/**
 * 2026-08-28, owner feedback (round 2 — "Strona wzorów dalej jest zbyt
 * biedna", "the patterns page is still too poor"): the previous pass only
 * added plain-text links from a pattern to its products, using hand-rolled
 * `<div>`s with inline styles, same visual register as the rest of the
 * marketing RSC tree — which is correct for product/category pages
 * (ARCHITECTURE.md §2.1's "no MUI in the RSC tree" rule), but this page is
 * genuinely a browse-and-select experience, not passive catalogue copy, so
 * it gets the same "interactive island, use MUI fully" treatment checkout
 * and the configurator already have.
 *
 * `'use client'` is required here specifically because of `<Chip
 * component={Link} .../>` below — MUI's polymorphic-component prop passes
 * the `Link` function itself as a prop value, which cannot cross a Server
 * → Client render boundary (confirmed live: "Functions cannot be passed
 * directly to Client Components" crashed the page in dev before this was
 * added). `favoritedIds` therefore also arrives as a plain array, not a
 * `Set` — `Set`/`Map` aren't part of the serializable prop surface either;
 * rebuilt into a `Set` once, locally, since membership checks happen in a
 * render loop.
 *
 * Each "available on" link now actually carries the design selection
 * through via `writeSelectionsToSearch` — the configurator has hydrated
 * from the URL on mount since before this pass ("brief §36": refresh/
 * shared-link resumption), this page just never used that mechanism for
 * its own links. A customer picking a pattern here now lands on the
 * product's MATERIAL step already past DESIGN, not stepping through it
 * again from scratch.
 */

import Image from 'next/image';
import Link from 'next/link';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { Box, Card, CardContent, Chip, Stack, Typography } from '@mui/material';

import { EMPTY_SELECTIONS } from '@/domain/configuration/steps';
import { SITE } from '@/content/pl/site';
import type { PublicDesignListItem } from '@/server/repositories/designs';
import type { ExternalPatternResourceEntry } from '@/server/repositories/external-pattern-resources';
import { writeSelectionsToSearch } from '@/ui/islands/configurator/selections-url';
import { FavoriteDesignButton } from '@/ui/islands/FavoriteDesignButton';
import { Heading } from '@/ui/primitives/Heading';

function designHref(productSlug: string, designId: string): string {
  const query = writeSelectionsToSearch({ ...EMPTY_SELECTIONS, designId });
  return `/produkt/${productSlug}?${query}`;
}

export function PatternsGallery({
  designs,
  externalResources,
  favoritedIds,
  loggedIn,
}: {
  readonly designs: readonly PublicDesignListItem[];
  readonly externalResources: readonly ExternalPatternResourceEntry[];
  readonly favoritedIds: readonly string[];
  readonly loggedIn: boolean;
}) {
  const favoritedIdSet = new Set(favoritedIds);
  return (
    <Box>
      <Heading level={1}>{SITE.patternsHeadingPl}</Heading>
      <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 720 }}>
        {SITE.patternsIntroPl}
      </Typography>

      {designs.length === 0 ? (
        <Typography color="text.secondary" sx={{ mt: 3 }}>
          {SITE.patternsEmptyPl}
        </Typography>
      ) : (
        <Box
          sx={{
            mt: 4,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 3,
          }}
        >
          {designs.map((design) => (
            <Card
              key={design.id}
              variant="outlined"
              sx={{
                display: 'flex',
                flexDirection: 'column',
                transition: 'border-color 0.15s ease, transform 0.15s ease',
                '&:hover': { borderColor: 'secondary.main', transform: 'translateY(-2px)' },
              }}
            >
              <Box sx={{ position: 'relative', aspectRatio: '1 / 1', bgcolor: 'background.default' }}>
                <Image src={design.thumbnailUrl} alt="" fill sizes="(max-width: 768px) 50vw, 240px" style={{ objectFit: 'cover' }} />
                {design.featured && (
                  <Chip
                    label={SITE.patternsFeaturedBadgePl}
                    size="small"
                    color="secondary"
                    sx={{ position: 'absolute', insetBlockStart: 8, insetInlineStart: 8 }}
                  />
                )}
                <Box sx={{ position: 'absolute', insetBlockStart: 4, insetInlineEnd: 4 }}>
                  <FavoriteDesignButton designId={design.id} initiallyFavorited={favoritedIdSet.has(design.id)} loggedIn={loggedIn} />
                </Box>
              </Box>
              <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography variant="h6">{design.namePl}</Typography>
                {design.descPl !== null && (
                  <Typography variant="body2" color="text.secondary">
                    {design.descPl}
                  </Typography>
                )}
                {design.tags.length > 0 && (
                  <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
                    {design.tags.map((tag) => (
                      <Chip key={tag} label={tag} size="small" variant="outlined" />
                    ))}
                  </Stack>
                )}
                <Box sx={{ mt: 'auto', pt: 1 }}>
                  {design.products.length === 0 ? (
                    <Typography variant="caption" color="text.secondary">
                      {SITE.patternsNotAssignedPl}
                    </Typography>
                  ) : (
                    <Stack spacing={0.5}>
                      <Typography variant="caption" color="text.secondary">
                        {SITE.patternsAvailableOnLabelPl}
                      </Typography>
                      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                        {design.products.map((product) => (
                          <Chip
                            key={product.slug}
                            component={Link}
                            href={designHref(product.slug, design.id)}
                            label={product.namePl}
                            size="small"
                            clickable
                            color="secondary"
                            variant="outlined"
                          />
                        ))}
                      </Stack>
                    </Stack>
                  )}
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      <Box sx={{ mt: 8 }}>
        <Heading level={2}>{SITE.patternsExternalHeadingPl}</Heading>
        <Typography color="text.secondary" sx={{ mt: 1.5, maxWidth: 720 }}>
          {SITE.patternsExternalIntroPl}
        </Typography>

        {externalResources.length === 0 ? (
          <Typography color="text.secondary" sx={{ mt: 2 }}>
            {SITE.patternsExternalEmptyPl}
          </Typography>
        ) : (
          <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {externalResources.map((resource) => (
              <Card key={resource.id} variant="outlined">
                <CardContent>
                  <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                    <Typography
                      component="a"
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      variant="h6"
                      sx={{ color: 'text.primary', display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
                    >
                      {resource.namePl}
                      <OpenInNewIcon fontSize="inherit" />
                    </Typography>
                    <Chip label={`${SITE.patternsExternalBadgePl}: ${resource.sourceLabel}`} size="small" variant="outlined" />
                  </Stack>
                  {resource.descPl !== null && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {resource.descPl}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}
