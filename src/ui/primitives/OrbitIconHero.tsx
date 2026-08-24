import type { CSSProperties } from 'react';
import {
  ChairIcon,
  DiamondIcon,
  GridViewIcon,
  ImagePlaceholderIcon,
  PrecisionManufacturingIcon,
  ViewColumnIcon,
} from '@/ui/icons';

const RADIUS_PX = 130;
const DURATION_S = 60;

/** One entry per real category — loft, jewelry, tiles, floor panels, wall art. */
const ORBITERS = [
  { Icon: ChairIcon, angleDeg: 0 },
  { Icon: DiamondIcon, angleDeg: 72 },
  { Icon: GridViewIcon, angleDeg: 144 },
  { Icon: ViewColumnIcon, angleDeg: 216 },
  { Icon: ImagePlaceholderIcon, angleDeg: 288 },
] as const;

/**
 * The hero graphic — replaces a photo slot entirely, per the owner's ask
 * ("similar animation on main page instead of image... with our topic
 * icons"). Pattern taken from opensaas.sh (inspected live, at the owner's
 * xpath): concentric decorative rings, plus icons orbiting on a circle via
 * a rotating wrapper (`orbit-spin`) with a fixed radial offset
 * (`translateX`), each icon counter-rotated (`orbit-counter-spin`, same
 * duration) so it stays upright while it travels. Pure CSS — no JS, no
 * animation library, so this stays a Server Component; the animation costs
 * nothing in client bundle size, consistent with this project's
 * Lighthouse-driven discipline about what actually needs to be a client
 * island (`docs/HANDOVER.md` §9e).
 */
export function OrbitIconHero() {
  return (
    <div
      style={{
        position: 'relative',
        width: 360,
        height: 360,
        marginInline: 'auto',
      }}
    >
      <style>{`
        @keyframes orbit-spin {
          from { transform: rotate(var(--start-angle, 0deg)); }
          to { transform: rotate(calc(var(--start-angle, 0deg) + 360deg)); }
        }
        @keyframes orbit-counter-spin {
          from { transform: rotate(calc(-1 * var(--start-angle, 0deg))); }
          to { transform: rotate(calc(-1 * var(--start-angle, 0deg) - 360deg)); }
        }
        @media (prefers-reduced-motion: reduce) {
          .orbit-spin, .orbit-counter-spin { animation: none !important; }
        }
      `}</style>

      {[240, 320, 400].map((size, index) => (
        <div
          key={size}
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: size,
            height: size,
            marginLeft: -size / 2,
            marginTop: -size / 2,
            borderRadius: '50%',
            border: '1px solid var(--mui-palette-divider)',
            opacity: 1 - index * 0.25,
          }}
        />
      ))}

      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: 88,
          height: 88,
          marginLeft: -44,
          marginTop: -44,
          borderRadius: '50%',
          backgroundColor: 'var(--mui-palette-primary-main)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2,
        }}
      >
        <PrecisionManufacturingIcon size={40} style={{ color: 'var(--mui-palette-background-paper)' }} />
      </div>

      {ORBITERS.map(({ Icon, angleDeg }) => (
        <div
          key={angleDeg}
          className="orbit-spin"
          style={
            {
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: 0,
              height: 0,
              '--start-angle': `${angleDeg}deg`,
              animation: `orbit-spin ${DURATION_S}s linear infinite`,
            } as CSSProperties
          }
        >
          <div style={{ transform: `translateX(${RADIUS_PX}px)` }}>
            <div
              className="orbit-counter-spin"
              style={
                {
                  width: 48,
                  height: 48,
                  marginLeft: -24,
                  marginTop: -24,
                  borderRadius: '50%',
                  backgroundColor: 'var(--mui-palette-background-paper)',
                  border: '1px solid var(--mui-palette-divider)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  animation: `orbit-counter-spin ${DURATION_S}s linear infinite`,
                  '--start-angle': `${angleDeg}deg`,
                } as CSSProperties
              }
            >
              <Icon size={24} style={{ color: 'var(--mui-palette-secondary-main)' }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
