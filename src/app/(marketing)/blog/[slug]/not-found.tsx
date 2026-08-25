import { Container } from '@/ui/primitives/Container';
import { Heading } from '@/ui/primitives/Heading';
import { Section } from '@/ui/primitives/Section';
import { Text } from '@/ui/primitives/Text';
import { SITE } from '@/content/pl/site';

export default function BlogPostNotFound() {
  return (
    <Section>
      <Container>
        <Heading level={1}>{SITE.blogPostNotFoundPl}</Heading>
        <Text muted>404</Text>
      </Container>
    </Section>
  );
}
