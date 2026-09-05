import type { ReactNode } from 'react';

/** A responsive card grid. RSC-safe - no `@mui/material` import. */
export function Grid({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
        gap: 32,
      }}
    >
      {children}
    </div>
  );
}
