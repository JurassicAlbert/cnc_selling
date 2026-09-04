import type { CSSProperties, ReactNode } from 'react';

type Level = 1 | 2 | 3 | 4 | 5 | 6;

const TAGS = { 1: 'h1', 2: 'h2', 3: 'h3', 4: 'h4', 5: 'h5', 6: 'h6' } as const;

/**
 * A raw HTML heading does NOT pick up the theme's typography automatically -
 * that only happens through MUI's `Typography` component or its generated
 * class names, neither of which an RSC-safe primitive can use without
 * pulling in `@mui/material`. `cssVariables: true` publishes each variant as
 * a single `font` shorthand custom property (`--mui-font-h1`, weight/size/
 * line-height/family together), and that DOES work on a plain tag with
 * `style={{ font: 'var(--mui-font-h1)' }}` - no Emotion, no class, no MUI
 * import. This primitive exists so nobody has to rediscover that.
 *
 * 2026-08-30, typography pass - three things the shorthand alone got wrong:
 *
 * 1. **Letter-spacing is not part of the `font` shorthand.** Setting it
 *    silently resets tracking to `normal`, so every heading on the
 *    storefront lost the theme's own value - including the display-size
 *    hero, where loose default tracking is most visible. Now applied from
 *    its own token.
 * 2. **`text-wrap: balance`** evens out the last line of a multi-line
 *    heading instead of leaving one orphaned word. Browsers apply it only
 *    up to a few lines, which is exactly the heading case, and it degrades
 *    to normal wrapping where unsupported.
 * 3. **`overflow-wrap: anywhere`** stops an unbroken string (a long product
 *    name, a URL) from pushing past its container at display sizes. It only
 *    ever engages when a word genuinely cannot fit, so ordinary headings
 *    are unaffected.
 */
export function Heading({ level, children }: { level: Level; children: ReactNode }) {
  const Tag = TAGS[level];
  const style: CSSProperties = {
    font: `var(--mui-font-h${level})`,
    letterSpacing: `var(--mui-letter-spacing-h${level})`,
    color: 'var(--mui-palette-text-primary)',
    textWrap: 'balance',
    overflowWrap: 'anywhere',
    margin: 0,
  };
  return <Tag style={style}>{children}</Tag>;
}
