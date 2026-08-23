import type { ReactNode } from 'react';

type Level = 1 | 2 | 3 | 4 | 5 | 6;

const TAGS = { 1: 'h1', 2: 'h2', 3: 'h3', 4: 'h4', 5: 'h5', 6: 'h6' } as const;

/**
 * A raw HTML heading does NOT pick up the theme's typography automatically —
 * that only happens through MUI's `Typography` component or its generated
 * class names, neither of which an RSC-safe primitive can use without
 * pulling in `@mui/material`. `cssVariables: true` publishes each variant as
 * a single `font` shorthand custom property (`--mui-font-h1`, weight/size/
 * line-height/family together), and that DOES work on a plain tag with
 * `style={{ font: 'var(--mui-font-h1)' }}` — no Emotion, no class, no MUI
 * import. This primitive exists so nobody has to rediscover that.
 */
export function Heading({ level, children }: { level: Level; children: ReactNode }) {
  const Tag = TAGS[level];
  return (
    <Tag
      style={{
        font: `var(--mui-font-h${level})`,
        color: 'var(--mui-palette-text-primary)',
        margin: 0,
      }}
    >
      {children}
    </Tag>
  );
}
