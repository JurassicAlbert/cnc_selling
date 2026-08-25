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
              .footer-grid { grid-template-columns: 1.5fr 1fr 1fr; }
            }
          `}</style>

          <div>
            <div style={{ font: 'var(--mui-font-h6)', color: 'var(--mui-palette-text-primary)' }}>
              CNC Selling
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
            {/* The orbiting-icon graphic, moved here from the hero (2026-08-26,
                owner's request) — sized down for the footer rather than
                re-tuning its internal geometry twice. */}
            <div style={{ marginBlockStart: 'var(--space-6)' }}>
              <OrbitIconHero size={180} />
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
