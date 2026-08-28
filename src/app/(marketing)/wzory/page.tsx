import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { getSession } from '@/server/auth/session';
import { listActiveDesignsForBrowsing } from '@/server/repositories/designs';
import { listFavoritedDesignIds } from '@/server/repositories/design-favorites';
import { listActiveExternalPatternResources } from '@/server/repositories/external-pattern-resources';
import { Container } from '@/ui/primitives/Container';
import { FavoriteDesignButton } from '@/ui/islands/FavoriteDesignButton';
import { Heading } from '@/ui/primitives/Heading';
import { Section } from '@/ui/primitives/Section';
import { Text } from '@/ui/primitives/Text';
import { SITE } from '@/content/pl/site';

export const metadata: Metadata = {
  title: SITE.patternsSeoTitlePl,
  description: SITE.patternsSeoDescPl,
  alternates: { canonical: '/wzory' },
};

/**
 * Real public pattern-browsing page — P9 phase 3. `Design.featured` (added
 * in phase 2) gets its first real consumer here. There's still no
 * standalone `/wzory/[slug]` detail route — a design is only ever selected
 * inside a specific product's configurator — but each card now links out to
 * every real, currently-orderable product that offers it (2026-08-28, owner
 * feedback: this used to be a dead-end gallery with no way from "I like
 * this pattern" to "here's where I can order it"), so this is no longer a
 * pure dead end even without its own detail page. Below the in-house
 * designs, a clearly-labelled external-resources section — never presented
 * as this project's own content, honest by construction (§15's "no fake
 * functionality" rule applies to attribution too, not just to
 * payment/tracking).
 */
export default async function PatternsPage() {
  const [designs, externalResources, session] = await Promise.all([
    listActiveDesignsForBrowsing(),
    listActiveExternalPatternResources(),
    getSession(),
  ]);
  const favoritedIds = await listFavoritedDesignIds(
    session?.userId ?? null,
    designs.map((d) => d.id),
  );

  return (
    <Section>
      <Container>
        <Heading level={1}>{SITE.patternsHeadingPl}</Heading>
        <div style={{ marginBlockStart: 16, maxWidth: 720 }}>
          <Text muted>{SITE.patternsIntroPl}</Text>
        </div>

        {designs.length === 0 ? (
          <div style={{ marginBlockStart: 24 }}>
            <Text muted>{SITE.patternsEmptyPl}</Text>
          </div>
        ) : (
          <div
            style={{
              marginBlockStart: 32,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 24,
            }}
          >
            {designs.map((design) => (
              <div key={design.id}>
                <div
                  style={{
                    position: 'relative',
                    aspectRatio: '1 / 1',
                    borderRadius: 'var(--radius-card)',
                    overflow: 'hidden',
                    marginBlockEnd: 'var(--space-2)',
                    boxShadow: 'var(--shadow-sm)',
                    backgroundColor: 'var(--mui-palette-background-paper)',
                  }}
                >
                  <Image src={design.thumbnailUrl} alt="" fill sizes="(max-width: 768px) 50vw, 220px" style={{ objectFit: 'cover' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ font: 'var(--mui-font-h6)', color: 'var(--mui-palette-text-primary)' }}>{design.namePl}</div>
                  <FavoriteDesignButton designId={design.id} initiallyFavorited={favoritedIds.has(design.id)} loggedIn={session !== null} />
                </div>
                {design.descPl !== null && (
                  <div style={{ marginBlockStart: 4 }}>
                    <Text muted>{design.descPl}</Text>
                  </div>
                )}
                <div style={{ marginBlockStart: 8 }}>
                  {design.products.length === 0 ? (
                    <Text muted>{SITE.patternsNotAssignedPl}</Text>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'baseline' }}>
                      <span style={{ font: 'var(--mui-font-caption)', color: 'var(--mui-palette-text-secondary)' }}>
                        {SITE.patternsAvailableOnLabelPl}
                      </span>
                      {design.products.map((product, index) => (
                        <span key={product.slug} style={{ font: 'var(--mui-font-caption)' }}>
                          <Link href={`/produkt/${product.slug}`} style={{ color: 'var(--mui-palette-secondary-main)' }}>
                            {product.namePl}
                          </Link>
                          {index < design.products.length - 1 ? ',' : ''}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginBlockStart: 64 }}>
          <Heading level={2}>{SITE.patternsExternalHeadingPl}</Heading>
          <div style={{ marginBlockStart: 12, maxWidth: 720 }}>
            <Text muted>{SITE.patternsExternalIntroPl}</Text>
          </div>

          {externalResources.length === 0 ? (
            <div style={{ marginBlockStart: 16 }}>
              <Text muted>{SITE.patternsExternalEmptyPl}</Text>
            </div>
          ) : (
            <ul style={{ marginBlockStart: 24, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {externalResources.map((resource) => (
                <li
                  key={resource.id}
                  style={{
                    border: '1px solid var(--mui-palette-divider)',
                    borderRadius: 'var(--radius-card)',
                    padding: 'var(--space-3)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ font: 'var(--mui-font-h6)', color: 'var(--mui-palette-text-primary)' }}
                    >
                      {resource.namePl} ↗
                    </a>
                    <span
                      style={{
                        font: 'var(--mui-font-caption)',
                        color: 'var(--mui-palette-text-secondary)',
                        border: '1px solid var(--mui-palette-divider)',
                        borderRadius: 999,
                        padding: '2px 10px',
                      }}
                    >
                      {SITE.patternsExternalBadgePl}: {resource.sourceLabel}
                    </span>
                  </div>
                  {resource.descPl !== null && (
                    <div style={{ marginBlockStart: 8 }}>
                      <Text muted>{resource.descPl}</Text>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Container>
    </Section>
  );
}
