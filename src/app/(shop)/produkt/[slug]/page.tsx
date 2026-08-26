import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { formatPln } from '@/domain/money/money';
import { formatMmAsCentimetres } from '@/domain/text/numeric-input';
import { getActiveProductBySlug, listAllActiveProductSlugs } from '@/server/repositories/products';
import { getConfiguratorProductData } from '@/server/repositories/configurator';
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

type ProductPageProps = {
  readonly params: Promise<{ readonly slug: string }>;
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
      }}
    >
      {children}
    </span>
  );
}

/**
 * Server-rendered from the DB (ARCHITECTURE.md §18) — no client-side fetch
 * for content. Intro restructured 2026-08-24 to an image-left/info-right
 * PDP layout (matching the owner's reference); the configurator below it is
 * untouched — it's freshly built, tested, and browser-verified this
 * session, and this pass only restyles the page chrome around it.
 */
export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getActiveProductBySlug(slug);
  if (product === null) {
    notFound();
  }
  const configuratorData = await getConfiguratorProductData(slug);
  const primaryImage = product.images[0] ?? null;

  const [sessionToken, session] = await Promise.all([readGuestSessionToken(), getSession()]);
  void recordAnalyticsEvent({
    name: 'product_view',
    sessionToken,
    userId: session?.userId ?? null,
    productId: configuratorData?.productId ?? null,
  });

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

        <div
          style={{ marginBlockStart: 24, display: 'grid', gap: 40 }}
          className="pdp-intro"
        >
          {/* grid-template-columns lives here, not inline: an inline style always
              wins the cascade over a stylesheet rule, media query included. */}
          <style>{`
            .pdp-intro { grid-template-columns: 1fr; }
            @media (min-width: 900px) {
              .pdp-intro { grid-template-columns: 1fr 1fr; align-items: start; }
            }
          `}</style>

          <div style={{ position: 'relative', aspectRatio: '1 / 1', borderRadius: 2, overflow: 'hidden' }}>
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

            {configuratorData !== null && (
              <div style={{ marginBlockStart: 32 }}>
                <Link
                  href="#konfigurator"
                  style={{
                    display: 'inline-block',
                    font: 'var(--mui-font-button)',
                    textTransform: 'none',
                    padding: '12px 28px',
                    borderRadius: 2,
                    backgroundColor: 'var(--mui-palette-primary-main)',
                    color: 'var(--mui-palette-background-paper)',
                    textDecoration: 'none',
                  }}
                >
                  {SITE.configuratorHeadingPl}
                </Link>
              </div>
            )}
          </div>
        </div>

        {configuratorData !== null && (
          <div id="konfigurator" style={{ marginBlockStart: 64, scrollMarginTop: 96 }}>
            <Heading level={2}>{SITE.configuratorHeadingPl}</Heading>
            <div style={{ marginBlockStart: 24 }}>
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
                />
              </ThemeRegistry>
            </div>
          </div>
        )}

        <div style={{ marginBlockStart: 64, display: 'flex', flexDirection: 'column', gap: 32 }}>
          {product.materialNotesPl !== null && (
            <div>
              <Heading level={2}>{SITE.catalogueMaterialNotesLabelPl}</Heading>
              <Text>{product.materialNotesPl}</Text>
            </div>
          )}

          {product.installationInfoPl !== null && (
            <div>
              <Heading level={2}>{SITE.catalogueInstallationInfoLabelPl}</Heading>
              <Text>{product.installationInfoPl}</Text>
            </div>
          )}

          {product.installationVariants.length > 0 && (
            <div>
              <Heading level={2}>{SITE.catalogueInstallationVariantsLabelPl}</Heading>
              {product.installationVariants.map((variant) => (
                <div key={variant.namePl} style={{ marginBlockStart: 12 }}>
                  <Heading level={3}>{variant.namePl}</Heading>
                  <Text muted>{variant.descPl}</Text>
                  <Text>{variant.receivesPl}</Text>
                </div>
              ))}
            </div>
          )}

          <div>
            <Heading level={2}>{SITE.catalogueCareInstructionsLabelPl}</Heading>
            <Text>{product.careInstructionsPl}</Text>
          </div>
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
