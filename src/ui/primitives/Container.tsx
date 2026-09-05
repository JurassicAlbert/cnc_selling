import type { ReactNode } from 'react';

/**
 * RSC-safe layout atoms. No `@mui/material` import here or in `Section` -
 * that is the whole point (§2.1, §4). They consume the theme's brand tokens
 * as CSS variables (`--mui-palette-*`, emitted because the theme has
 * `cssVariables: true`) so a Server Component can look on-brand without
 * shipping a single byte of Emotion.
 */
export function Container({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        maxWidth: 1200,
        marginInline: 'auto',
        paddingInline: 24,
      }}
    >
      {children}
    </div>
  );
}
