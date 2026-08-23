import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { formatPln } from '@/domain/money/money';
import { formatMmAsCentimetres } from '@/domain/text/numeric-input';
import { getActiveProductBySlug, listAllActiveProductSlugs } from '@/server/repositories/products';
import { getConfiguratorProductData } from '@/server/repositories/configurator';
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

/** Server-rendered from the DB (ARCHITECTURE.md §18) — no client-side fetch for content. */
export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getActiveProductBySlug(slug);
  if (product === null) {
    notFound();
  }
  const configuratorData = await getConfiguratorProductData(slug);

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
        <Heading level={1}>{product.namePl}</Heading>
        <Text muted>{product.shortDescPl}</Text>

        {product.images.length > 0 && (
          // biome-ignore lint/performance/noImgElement: placeholder SVGs get nothing from next/image's raster pipeline — same as Card.tsx.
          <img
            src={product.images[0]?.url}
            alt={product.images[0]?.altPl}
            style={{ width: '100%', maxWidth: 600, height: 'auto', display: 'block' }}
          />
        )}

        <Text>
          {SITE.catalogueStartingPricePrefixPl} {formatPln(product.minPriceGrosze)}
        </Text>

        <Text>{product.longDescPl}</Text>

        {configuratorData !== null && (
          <>
            <Heading level={2}>{SITE.configuratorHeadingPl}</Heading>
            <ThemeRegistry>
              <Configurator
                productSlug={product.slug}
                options={configuratorData.options}
                dimensionEnvelope={{
                  minWidthMm: product.minWidthMm,
                  maxWidthMm: product.maxWidthMm,
                  minHeightMm: product.minHeightMm,
                  maxHeightMm: product.maxHeightMm,
                }}
              />
            </ThemeRegistry>
          </>
        )}

        {product.materialNotesPl !== null && (
          <>
            <Heading level={2}>{SITE.catalogueMaterialNotesLabelPl}</Heading>
            <Text>{product.materialNotesPl}</Text>
          </>
        )}

        <Heading level={2}>{SITE.catalogueDimensionsLabelPl}</Heading>
        <Text>{dimensionsPl}</Text>

        <Heading level={2}>{SITE.catalogueMaterialsLabelPl}</Heading>
        <Text>{product.materials.map((m) => m.namePl).join(', ')}</Text>

        <Heading level={2}>{SITE.catalogueProductionTimeLabelPl}</Heading>
        <Text>
          {product.productionDaysMin}–{product.productionDaysMax} {SITE.catalogueProductionTimeUnitPl}
        </Text>

        {product.installationInfoPl !== null && (
          <>
            <Heading level={2}>{SITE.catalogueInstallationInfoLabelPl}</Heading>
            <Text>{product.installationInfoPl}</Text>
          </>
        )}

        {product.installationVariants.length > 0 && (
          <>
            <Heading level={2}>{SITE.catalogueInstallationVariantsLabelPl}</Heading>
            {product.installationVariants.map((variant) => (
              <div key={variant.namePl}>
                <Heading level={3}>{variant.namePl}</Heading>
                <Text muted>{variant.descPl}</Text>
                <Text>{variant.receivesPl}</Text>
              </div>
            ))}
          </>
        )}

        <Heading level={2}>{SITE.catalogueCareInstructionsLabelPl}</Heading>
        <Text>{product.careInstructionsPl}</Text>
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
