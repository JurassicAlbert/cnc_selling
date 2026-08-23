import type { Metadata } from 'next';

import { listActiveCategories } from '@/server/repositories/categories';
import { Card } from '@/ui/primitives/Card';
import { Container } from '@/ui/primitives/Container';
import { Grid } from '@/ui/primitives/Grid';
import { Heading } from '@/ui/primitives/Heading';
import { Section } from '@/ui/primitives/Section';
import { SITE } from '@/content/pl/site';

/**
 * A Server Component. No `@mui/material` import — `biome.json`'s `overrides`
 * enforces that for every file under `(marketing)` and `(shop)`.
 *
 * This renders only what real, non-invented content supports: the category
 * grid, from the seeded catalogue. The full homepage ARCHITECTURE.md §22
 * describes — hero copy, "how it's made", craftsmanship narrative, reviews,
 * FAQ — needs the owner's actual words and, for reviews specifically, real
 * customer submissions (fabricating a testimonial is explicitly forbidden,
 * §16A.1 module 9). None of that is guessed at here; those sections simply
 * don't exist yet rather than being filled with placeholder narrative that
 * would look finished and isn't.
 */
export default async function MarketingHomePage() {
  const categories = await listActiveCategories();

  return (
    <Section>
      <Container>
        <Heading level={1}>{SITE.catalogueCategoriesHeadingPl}</Heading>
        <Grid>
          {categories.map((category) => (
            <Card
              key={category.slug}
              href={`/${category.slug}`}
              imageUrl={category.imageUrl}
              imageAlt={category.namePl}
            >
              <Heading level={3}>{category.namePl}</Heading>
            </Card>
          ))}
        </Grid>
      </Container>
    </Section>
  );
}

export const metadata: Metadata = {
  title: SITE.homeSeoTitlePl,
  description: SITE.homeSeoDescPl,
  alternates: { canonical: '/' },
};
