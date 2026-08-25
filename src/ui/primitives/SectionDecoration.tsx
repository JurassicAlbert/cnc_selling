/**
 * A static, low-opacity concentric-ring accent for a `Section` — reuses the
 * same visual language as `OrbitIconHero`'s decorative rings (brand color,
 * partial opacity) but without the animation, since this is meant to sit
 * quietly behind real content, not draw the eye on its own. Pure inline
 * SVG, `aria-hidden`, `pointer-events: none` — zero client JS, consistent
 * with every other RSC primitive in this codebase.
 *
 * Colors are set via `style` rather than the `stroke`/`fill` XML attributes
 * — CSS custom property resolution inside plain SVG presentation attributes
 * is inconsistent across engines, and this project tests on WebKit
 * (mobile-safari) in e2e.
 */
export function SectionDecoration({ side = 'right' }: { readonly side?: 'left' | 'right' }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 400 400"
      style={{
        position: 'absolute',
        top: '50%',
        [side === 'right' ? 'right' : 'left']: -140,
        transform: 'translateY(-50%)',
        width: 400,
        height: 400,
        zIndex: -1,
        pointerEvents: 'none',
      }}
    >
      <circle cx="200" cy="200" r="190" fill="none" style={{ stroke: 'var(--mui-palette-secondary-main)', strokeWidth: 1, opacity: 0.14 }} />
      <circle cx="200" cy="200" r="140" fill="none" style={{ stroke: 'var(--mui-palette-secondary-main)', strokeWidth: 1, opacity: 0.11 }} />
      <circle cx="200" cy="200" r="90" fill="none" style={{ stroke: 'var(--mui-palette-secondary-main)', strokeWidth: 1, opacity: 0.09 }} />
    </svg>
  );
}
