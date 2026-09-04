import type { LegalSection } from '@/content/pl/legal';
import { Heading } from '@/ui/primitives/Heading';
import { Text } from '@/ui/primitives/Text';

/** Shared renderer for `REGULAMIN_SECTIONS`/`PRIVACY_SECTIONS` - one heading, one or more paragraphs, per section. */
export function LegalDocument({ sections }: { readonly sections: readonly LegalSection[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 720 }}>
      {sections.map((section) => (
        <div key={section.headingPl}>
          <Heading level={2}>{section.headingPl}</Heading>
          <div style={{ marginBlockStart: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {section.paragraphsPl.map((paragraph, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static content, never reordered
              <Text key={index} muted>
                {paragraph}
              </Text>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
