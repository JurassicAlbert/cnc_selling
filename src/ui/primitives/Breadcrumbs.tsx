import Link from 'next/link';
import { Fragment } from 'react';

import { SITE } from '@/content/pl/site';
import { toSafeJsonLd } from '@/ui/seo/json-ld';

export type Crumb = {
  readonly labelPl: string;
  readonly href: string;
};

/**
 * RSC-safe. Renders both the visible trail and `BreadcrumbList` JSON-LD
 * (ARCHITECTURE.md §18) — one component, so the two can never drift apart.
 */
export function Breadcrumbs({ trail }: { trail: readonly Crumb[] }) {
  const items: Crumb[] = [{ labelPl: SITE.catalogueHomeLinkPl, href: '/' }, ...trail];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.labelPl,
      item: item.href,
    })),
  };

  return (
    <nav aria-label={SITE.catalogueHomeLinkPl} style={{ font: 'var(--mui-font-body2)' }}>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: only way to emit JSON-LD; toSafeJsonLd escapes `<` so it can't break out of the script tag — src/ui/seo/json-ld.ts
        dangerouslySetInnerHTML={{ __html: toSafeJsonLd(jsonLd) }}
      />
      {items.map((item, index) => (
        <Fragment key={item.href}>
          {index > 0 && <span style={{ color: 'var(--mui-palette-text-secondary)' }}> / </span>}
          {index === items.length - 1 ? (
            <span style={{ color: 'var(--mui-palette-text-secondary)' }}>{item.labelPl}</span>
          ) : (
            <Link href={item.href} style={{ color: 'var(--mui-palette-text-primary)' }}>
              {item.labelPl}
            </Link>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
