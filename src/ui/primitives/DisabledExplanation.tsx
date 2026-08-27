'use client';

import { Tooltip } from '@mui/material';
import type { ReactElement } from 'react';

/**
 * `docs/CHECKLIST.md` / `ARCHITECTURE.md` §16A.5: "Every disabled control
 * explains why on hover." A plain `title` attribute on a disabled MUI
 * `Button` never actually shows — confirmed directly, not assumed: a real
 * disabled button on this project's own order-status screen already had a
 * `title` prop that could never fire, `getComputedStyle(button).
 * pointerEvents === 'none'` on every disabled MUI control. A native title
 * tooltip (and MUI's own `<Tooltip>`, which attaches its hover listeners to
 * the element it wraps) both need real pointer events to reach the element
 * to trigger on, and `pointer-events: none` blocks them outright.
 *
 * MUI's own documented fix: wrap the disabled control in a plain `<span>`
 * (normal pointer events) and put the `Tooltip` there instead — the span
 * receives the hover, the button just sits inside it. No-op when there is
 * nothing to explain, so a caller can pass this unconditionally.
 */
export function DisabledExplanation({ title, children }: { readonly title: string | undefined; readonly children: ReactElement }) {
  if (title === undefined) {
    return children;
  }
  return (
    <Tooltip title={title}>
      <span style={{ display: 'inline-block' }}>{children}</span>
    </Tooltip>
  );
}
