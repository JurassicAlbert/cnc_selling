import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getSession } from '@/server/auth/session';
import { listActiveDesignsForBrowsing } from '@/server/repositories/designs';
import { listFavoritedDesignIds } from '@/server/repositories/design-favorites';
import { listActiveExternalPatternResources } from '@/server/repositories/external-pattern-resources';
import { Container } from '@/ui/primitives/Container';
import { PatternsGallery } from '@/ui/islands/PatternsGallery';
import { Section } from '@/ui/primitives/Section';
import { ThemeRegistry } from '@/ui/theme/ThemeRegistry';
import { SITE } from '@/content/pl/site';

export const metadata: Metadata = {
  title: SITE.patternsSeoTitlePl,
  description: SITE.patternsSeoDescPl,
  alternates: { canonical: '/wzory' },
};

/**
 * Real public pattern-browsing page — P9 phase 3, redesigned 2026-08-28
 * (owner feedback, twice: this was a dead-end gallery, then a visually
 * thin one). Now a real MUI island (`PatternsGallery`) — a browse-and-
 * select experience gets the same "interactive island, use MUI fully"
 * treatment as checkout/the configurator, not the marketing-page RSC
 * register (ARCHITECTURE.md §2.1). This page itself stays a Server
 * Component that only fetches data; `ThemeRegistry` is mounted once
 * around the whole gallery, same "mount around the real interactive
 * part" precedent every other MUI page here uses.
 */
export default async function PatternsPage() {
  // 2026-08-29, owner feedback, verbatim: "sekcja wzorów jest do dupy...
  // ukryj na razie podstronę dla wzorów" (the patterns section isn't
  // working out, hide the page for now). The route, the repository layer,
  // the admin CRUD, and every underlying `Design`/`DesignCollection` row
  // are all untouched — only public access to this one page is gated, the
  // same "hidden, not deleted" precedent every other `isActive`-style
  // toggle in this project already uses. Removing this one line is the
  // entire re-enable path.
  notFound();

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
        <ThemeRegistry>
          <PatternsGallery
            designs={designs}
            externalResources={externalResources}
            favoritedIds={[...favoritedIds]}
            loggedIn={session !== null}
          />
        </ThemeRegistry>
      </Container>
    </Section>
  );
}
