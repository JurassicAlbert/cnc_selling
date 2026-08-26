import { SITE } from '@/content/pl/site';
import { Container } from '@/ui/primitives/Container';
import { Section } from '@/ui/primitives/Section';
import { Text } from '@/ui/primitives/Text';

/**
 * Shared `loading.tsx` fallback — P6 Part F. A route segment's own
 * `loading.tsx` renders this WHILE that segment's Server Component awaits
 * its data (a real DB read on every page in this app), instead of the
 * browser showing a blank tab during navigation. Deliberately plain — an
 * honest "loading" state, not a layout-shifting skeleton mimicking content
 * this project doesn't maintain two copies of.
 */
export function RouteLoading() {
  return (
    <Section>
      <Container>
        <Text muted>{SITE.routeLoadingPl}</Text>
      </Container>
    </Section>
  );
}
