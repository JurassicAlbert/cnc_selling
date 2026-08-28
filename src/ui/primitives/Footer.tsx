import Link from 'next/link';

import { Container } from '@/ui/primitives/Container';
import { OrbitIconHero } from '@/ui/primitives/OrbitIconHero';
import { Text } from '@/ui/primitives/Text';
import { SITE } from '@/content/pl/site';

type CategoryLink = {
  readonly slug: string;
  readonly namePl: string;
};

type FooterProps = {
  readonly categories: readonly CategoryLink[];
};

/**
 * Added 2026-08-25 — the owner's explicit feedback was that the site had no
 * footer at all. Real content only, per the owner's own clarified policy:
 * category links and search (both real, already-built pages), and links to
 * the two legal stub pages below, honestly marked as still in preparation.
 * No email, phone, social links, or invented company registration details —
 * none of that exists anywhere in this system yet (same reasoning the P5
 * handover used for the bank account number).
 */
export function Footer({ categories }: FooterProps) {
  return (
    <footer
      style={{
        marginBlockStart: 'var(--space-8)',
        borderTop: '1px solid var(--mui-palette-divider)',
        backgroundColor: 'var(--mui-palette-background-paper)',
        boxShadow: '0 -1px 3px rgba(46, 42, 38, 0.05)',
      }}
    >
      <Container>
        <div
          style={{
            display: 'grid',
            gap: 'var(--space-6)',
            paddingBlockStart: 'var(--space-7)',
            paddingBlockEnd: 'var(--space-6)',
          }}
          className="footer-grid"
        >
          {/* Same reasoning as (marketing)/page.tsx's .hero-grid: an inline
              style always wins the cascade, so the responsive override has
              to live in a stylesheet rule instead. */}
          <style>{`
            .footer-grid { grid-template-columns: 1fr; }
            @media (min-width: 700px) {
              .footer-grid { grid-template-columns: 1.3fr 1fr 1fr; }
            }
            @media (min-width: 980px) {
              .footer-grid { grid-template-columns: 1.3fr 1fr 1fr auto; }
            }
          `}</style>

          <div>
            <div style={{ font: 'var(--mui-font-h6)', color: 'var(--mui-palette-text-primary)' }}>
              RYT
            </div>
            <div
              style={{
                marginBlockStart: 'var(--space-1)',
                paddingInlineStart: 'var(--space-2)',
                borderInlineStart: '2px solid var(--mui-palette-secondary-main)',
                font: 'var(--mui-font-subtitle2)',
                fontStyle: 'italic',
                color: 'var(--mui-palette-secondary-main)',
              }}
            >
              {SITE.footerTaglinePl}
            </div>
            <div style={{ marginBlockStart: 'var(--space-3)', maxWidth: 360 }}>
              <Text muted>{SITE.homeSeoDescPl}</Text>
            </div>
          </div>

          <div>
            <div
              style={{
                font: 'var(--mui-font-subtitle2)',
                color: 'var(--mui-palette-text-primary)',
                marginBlockEnd: 'var(--space-3)',
              }}
            >
              {SITE.footerCategoriesHeadingPl}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {categories.map((category) => (
                <Link
                  key={category.slug}
                  href={`/${category.slug}`}
                  className="footer-link"
                  style={{ font: 'var(--mui-font-body2)' }}
                >
                  {category.namePl}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <div
              style={{
                font: 'var(--mui-font-subtitle2)',
                color: 'var(--mui-palette-text-primary)',
                marginBlockEnd: 'var(--space-3)',
              }}
            >
              {SITE.footerInfoHeadingPl}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <Link href="/szukaj" className="footer-link" style={{ font: 'var(--mui-font-body2)' }}>
                {SITE.footerSearchLinkPl}
              </Link>
              <Link href="/blog" className="footer-link" style={{ font: 'var(--mui-font-body2)' }}>
                {SITE.footerBlogLinkPl}
              </Link>
              <Link href="/wzory" className="footer-link" style={{ font: 'var(--mui-font-body2)' }}>
                {SITE.footerPatternsLinkPl}
              </Link>
              <Link href="/kolekcje" className="footer-link" style={{ font: 'var(--mui-font-body2)' }}>
                {SITE.footerCollectionsLinkPl}
              </Link>
              <Link href="/kontakt" className="footer-link" style={{ font: 'var(--mui-font-body2)' }}>
                {SITE.footerContactLinkPl}
              </Link>
              <Link href="/regulamin" className="footer-link" style={{ font: 'var(--mui-font-body2)' }}>
                {SITE.footerTermsLinkPl}
              </Link>
              <Link
                href="/polityka-prywatnosci"
                className="footer-link"
                style={{ font: 'var(--mui-font-body2)' }}
              >
                {SITE.footerPrivacyLinkPl}
              </Link>
            </div>
          </div>

          {/* Its own grid column (2026-08-26, owner's request) — not nested
              inside the brand column with the tagline/description. Hidden
              below 980px (see the `.footer-grid` media queries above) so it
              never competes for space with the 3 real content columns on
              narrower viewports; the animation is decorative, the links
              above it aren't. */}
          {/* `display` deliberately lives only in the class below, not here —
              an inline style always wins the cascade over a stylesheet rule
              (same reasoning as `.hero-grid`/`.footer-grid` above), so
              setting `display: flex` inline would defeat the `display: none`
              default and show this column under 980px regardless. */}
          <div style={{ alignItems: 'center' }} className="footer-orbit-column">
            <style>{`
              .footer-orbit-column { display: none; }
              @media (min-width: 980px) {
                .footer-orbit-column { display: flex; }
              }
            `}</style>
            <OrbitIconHero size={170} />
          </div>
        </div>

        <div
          style={{
            borderTop: '1px solid var(--mui-palette-divider)',
            paddingBlock: 'var(--space-4)',
          }}
        >
          <span style={{ font: 'var(--mui-font-caption)', color: 'var(--mui-palette-text-secondary)' }}>
            © {new Date().getFullYear()} {SITE.footerCopyrightPl}
          </span>
        </div>
      </Container>
    </footer>
  );
}
