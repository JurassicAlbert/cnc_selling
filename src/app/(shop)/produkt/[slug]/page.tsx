import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { formatPln } from '@/domain/money/money';
import { formatMmAsCentimetres } from '@/domain/text/numeric-input';
import { getActiveProductBySlug, getProductBySlugForPreview, listAllActiveProductSlugs } from '@/server/repositories/products';
import { getConfiguratorProductData } from '@/server/repositories/configurator';
import { listOwnedCustomerDesigns } from '@/server/repositories/customer-designs';
import { recordAnalyticsEvent } from '@/server/analytics/record-event';
import { getSession } from '@/server/auth/session';
import { readGuestSessionToken } from '@/server/session/read-guest-session';
import { Breadcrumbs } from '@/ui/primitives/Breadcrumbs';
import { Container } from '@/ui/primitives/Container';
import { Heading } from '@/ui/primitives/Heading';
import { Section } from '@/ui/primitives/Section';
import { Text } from '@/ui/primitives/Text';
import { Configurator } from '@/ui/islands/configurator/Configurator';
import { ThemeRegistry } from '@/ui/theme/ThemeRegistry';
import { toSafeJsonLd } from '@/ui/seo/json-ld';
import { SITE } from '@/content/pl/site';
import { ADMIN } from '@/content/pl/admin';

type ProductPageProps = {
  readonly params: Promise<{ readonly slug: string }>;
  /**
   * `?podglad=1` is the "Preview as customer" admin feature
   * (§16A.5/`ARCHITECTURE.md`) — a staff-only bypass of the `isActive`
   * gate so a not-yet-published product can be reviewed on this exact
   * page before going live. A non-staff visitor (or a staff member
   * without the query param) sees the same 404-on-inactive behavior as
   * always; the flag alone grants nothing without a real staff session.
   */
  readonly searchParams: Promise<{ readonly podglad?: string }>;
};

function Chip({ children }: { readonly children: ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-block',
        font: 'var(--mui-font-caption)',
        color: 'var(--mui-palette-text-primary)',
        border: '1px solid var(--mui-palette-divider)',
        borderRadius: 999,
        padding: '6px 14px',
        background: 'var(--mui-palette-background-paper)',
      }}
    >
      {children}
    </span>
  );
}

/**
 * A small circular glyph badge for the info cards below — real-but-plain
 * inline SVG (no `@mui/icons-material`, no MUI dependency at all), matching
 * `SectionDecoration.tsx`'s own "RSC-safe hand-drawn glyph" precedent
 * rather than reaching for a component library icon in a Server Component.
 */
function GlyphBadge({ path }: { readonly path: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 44,
        height: 44,
        borderRadius: '50%',
        background: 'var(--mui-palette-secondary-light, #E9D9C4)',
        color: 'var(--mui-palette-secondary-dark, #6B4A28)',
        flexShrink: 0,
      }}
    >
      {/* biome-ignore lint/a11y/noSvgWithoutTitle: purely decorative, adjacent heading already labels the card for assistive tech */}
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d={path} />
      </svg>
    </span>
  );
}

const ICON_PATH = {
  material: 'M3 7l9-4 9 4-9 4-9-4zm0 5l9 4 9-4M3 17l9 4 9-4',
  installation: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.8 2.8-2-2 2.8-2.8z',
  care: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z',
} as const;

/** One "care / material / installation" info block — replaces a bare `Heading`+`Text` pair. */
function InfoCard({ icon, heading, children }: { readonly icon: keyof typeof ICON_PATH; readonly heading: string; readonly children: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 16,
        padding: 24,
        borderRadius: 4,
        border: '1px solid var(--mui-palette-divider)',
        background: 'var(--mui-palette-background-paper)',
      }}
    >
      <GlyphBadge path={ICON_PATH[icon]} />
      <div style={{ minWidth: 0 }}>
        <Heading level={2}>{heading}</Heading>
        <div style={{ marginBlockStart: 8 }}>{children}</div>
      </div>
    </div>
  );
}

/**
 * Server-rendered from the DB (ARCHITECTURE.md §18) — no client-side fetch
 * for content. Intro restructured 2026-08-24 to an image-left/info-right
 * PDP layout (matching the owner's reference); the configurator below it is
 * untouched — it's freshly built, tested, and browser-verified this
 * session, and this pass only restyles the page chrome around it.
 */
export default async function ProductPage({ params, searchParams }: ProductPageProps) {
  const { slug } = await params;
  const { podglad } = await searchParams;

  const [sessionToken, session] = await Promise.all([readGuestSessionToken(), getSession()]);
  const isStaffPreview = podglad === '1' && (session?.role === 'STAFF' || session?.role === 'ADMIN');

  const product = isStaffPreview ? await getProductBySlugForPreview(slug) : await getActiveProductBySlug(slug);
  if (product === null) {
    notFound();
  }
  const configuratorData = await getConfiguratorProductData(slug, !isStaffPreview);
  const primaryImage = product.images[0] ?? null;
  // Cheap even when unused — only the CUSTOM product type's `CUSTOM_UPLOAD`
  // step actually renders this list (P9 phase 2's "pick a saved design
  // instead of uploading fresh" reuse path); fetched here regardless since
  // that's still simpler and cheaper than threading a product-type check
  // through this Server Component just to skip one indexed query.
  const savedDesigns = await listOwnedCustomerDesigns({ userId: session?.userId ?? null, sessionToken });

  // A staff preview hit is not real customer traffic — never counted.
  if (!isStaffPreview) {
    void recordAnalyticsEvent({
      name: 'product_view',
      sessionToken,
      userId: session?.userId ?? null,
      productId: configuratorData?.productId ?? null,
    });
  }

  const dimensionsPl =
    `${formatMmAsCentimetres(product.minWidthMm)}–${formatMmAsCentimetres(product.maxWidthMm)} × ` +
    `${formatMmAsCentimetres(product.minHeightMm)}–${formatMmAsCentimetres(product.maxHeightMm)} cm`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.namePl,
    description: product.shortDescPl,
    image: product.images.map((image) => image.url),
    offers: {
      '@type': 'Offer',
      priceCurrency: 'PLN',
      price: (product.minPriceGrosze / 100).toFixed(2),
      availability: 'https://schema.org/InStock',
    },
  };

  return (
    <Section>
      <Container>
        {isStaffPreview && (
          <div
            style={{
              marginBlockEnd: 16,
              padding: '10px 16px',
              borderRadius: 2,
              background: 'var(--mui-palette-warning-light, #fff3cd)',
              color: 'var(--mui-palette-warning-dark, #7a5900)',
              font: 'var(--mui-font-body2)',
            }}
          >
            {ADMIN.productPreviewBannerPl}
          </div>
        )}
        <script
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: only way to emit JSON-LD; toSafeJsonLd escapes `<` so it can't break out of the script tag — src/ui/seo/json-ld.ts
          dangerouslySetInnerHTML={{ __html: toSafeJsonLd(jsonLd) }}
        />
        <Breadcrumbs
          trail={[
            { labelPl: product.category.namePl, href: `/${product.category.slug}` },
            { labelPl: product.namePl, href: `/produkt/${product.slug}` },
          ]}
        />

        <div style={{ marginBlockStart: 24, display: 'grid', gap: 48 }} className="pdp-grid">
          {/* grid-template-columns lives here, not inline: an inline style always
              wins the cascade over a stylesheet rule, media query included.
              2026-08-28, owner feedback: the configurator belongs directly
              beside the photo, not in a separate full-width section below —
              the photo column is sticky on desktop so it stays in view while
              the customer works through the configurator's bands. */}
          <style>{`
            .pdp-grid { grid-template-columns: 1fr; }
            .pdp-photo { position: relative; aspect-ratio: 1 / 1; border-radius: 4px; overflow: hidden; }
            @media (min-width: 900px) {
              .pdp-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: start; }
              .pdp-photo { position: sticky; top: 96px; }
            }
          `}</style>

          <div className="pdp-photo">
            {primaryImage !== null && (
              <Image
                src={primaryImage.url}
                alt={primaryImage.altPl}
                fill
                sizes="(max-width: 900px) 100vw, 50vw"
                style={{ objectFit: 'cover' }}
                priority
              />
            )}
          </div>

          <div>
            <Heading level={1}>{product.namePl}</Heading>
            <div style={{ marginBlockStart: 8 }}>
              <Text muted>{product.shortDescPl}</Text>
            </div>
            <div style={{ marginBlockStart: 16, font: 'var(--mui-font-h4)', color: 'var(--mui-palette-text-primary)' }}>
              {SITE.catalogueStartingPricePrefixPl} {formatPln(product.minPriceGrosze)}
            </div>

            <div style={{ marginBlockStart: 20, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <Chip>
                {product.productionDaysMin}–{product.productionDaysMax} {SITE.catalogueProductionTimeUnitPl}
              </Chip>
              <Chip>{dimensionsPl}</Chip>
              <Chip>{product.materials.map((m) => m.namePl).join(', ')}</Chip>
            </div>

            <div style={{ marginBlockStart: 24 }}>
              <Text>{product.longDescPl}</Text>
            </div>

            {/* 2026-08-28, owner feedback: patterns/materials/finish are
                selected in place, right here, the same way a t-shirt's
                colour is picked — never a link that navigates the customer
                away from the product. The old pattern-thumbnails section
                that linked out to /wzory is gone; the DESIGN band inside
                the configurator below already covers "pick a ready-made
                pattern" without leaving the page. */}
            {configuratorData !== null && (
              <div style={{ marginBlockStart: 32 }}>
                <Heading level={2}>{SITE.configuratorHeadingPl}</Heading>
                <div style={{ marginBlockStart: 16 }}>
                  <ThemeRegistry>
                    <Configurator
                      productSlug={product.slug}
                      options={configuratorData.options}
                      materialNotesPl={product.materialNotesPl}
                      requiresExactSize={product.requiresExactSize}
                      dimensionEnvelope={{
                        minWidthMm: product.minWidthMm,
                        maxWidthMm: product.maxWidthMm,
                        minHeightMm: product.minHeightMm,
                        maxHeightMm: product.maxHeightMm,
                      }}
                      isPreview={isStaffPreview}
                      savedDesigns={savedDesigns}
                    />
                  </ThemeRegistry>
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ marginBlockStart: 64, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {product.materialNotesPl !== null && (
            <InfoCard icon="material" heading={SITE.catalogueMaterialNotesLabelPl}>
              <Text>{product.materialNotesPl}</Text>
            </InfoCard>
          )}

          {product.installationInfoPl !== null && (
            <InfoCard icon="installation" heading={SITE.catalogueInstallationInfoLabelPl}>
              <Text>{product.installationInfoPl}</Text>
            </InfoCard>
          )}

          {product.installationVariants.length > 0 && (
            <InfoCard icon="installation" heading={SITE.catalogueInstallationVariantsLabelPl}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {product.installationVariants.map((variant) => (
                  <div key={variant.namePl}>
                    <Heading level={3}>{variant.namePl}</Heading>
                    <Text muted>{variant.descPl}</Text>
                    <Text>{variant.receivesPl}</Text>
                  </div>
                ))}
              </div>
            </InfoCard>
          )}

          <InfoCard icon="care" heading={SITE.catalogueCareInstructionsLabelPl}>
            <Text>{product.careInstructionsPl}</Text>
          </InfoCard>
        </div>
      </Container>
    </Section>
  );
}

export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const slugs = await listAllActiveProductSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getActiveProductBySlug(slug);
  if (product === null) {
    return {};
  }
  return {
    title: product.seoTitlePl,
    description: product.seoDescPl,
    alternates: { canonical: `/produkt/${product.slug}` },
    openGraph: {
      title: product.seoTitlePl,
      description: product.seoDescPl,
      images: product.images.map((image) => image.url),
    },
  };
}
