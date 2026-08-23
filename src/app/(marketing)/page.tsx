import { Container } from '@/ui/primitives/Container';
import { Heading } from '@/ui/primitives/Heading';
import { Section } from '@/ui/primitives/Section';
import { Text } from '@/ui/primitives/Text';
import { ThemeShowcaseButton } from '@/ui/islands/ThemeShowcaseButton';
import { SITE } from '@/content/pl/site';

/**
 * A Server Component. No `@mui/material` import — the lint rule in
 * `biome.json`'s `overrides` enforces that for every file under
 * `(marketing)` and `(shop)`, and this page is the thing that rule exists to
 * protect. The one piece of MUI on this page (`ThemeShowcaseButton`) is a
 * client island rendered as a child, not imported into this file's own
 * render tree.
 *
 * Placeholder content, not real marketing copy — see `src/content/pl/site.ts`.
 */
export default function MarketingHomePage() {
  return (
    <Section>
      <Container>
        <Heading level={1}>{SITE.scaffoldTitlePl}</Heading>
        <Text muted>{SITE.scaffoldBodyPl}</Text>
        <ThemeShowcaseButton />
      </Container>
    </Section>
  );
}
