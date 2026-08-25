import type { CSSProperties } from 'react';
import {
  ChairIcon,
  DiamondIcon,
  DrawIcon,
  EngineeringIcon,
  GridViewIcon,
  ImagePlaceholderIcon,
  PrecisionManufacturingIcon,
  ViewColumnIcon,
} from '@/ui/icons';

/**
 * Three genuinely distinct orbits (2026-08-26 — the owner said every icon
 * was animating on the same single circle, just spread around it, and
 * wanted real separate rings). Each `RING_RADII` value lines up exactly
 * with one of the static decorative circles drawn below, so the icons
 * visibly travel ON the drawn rings rather than at an unrelated fixed
 * radius the way the single-orbit version did. Inner rings spin faster
 * than outer ones — real orbital mechanics, not just decoration.
 */
const RING_RADII = [90, 130, 170] as const;
const RING_DURATIONS_S = [45, 60, 80] as const;

type Orbiter = {
  readonly Icon: typeof ChairIcon;
  readonly ring: 0 | 1 | 2;
  readonly angleDeg: number;
};

/** 8 real icons (the same set used across the site's hexagon decorations), 2–3 per ring. */
const ORBITERS: readonly Orbiter[] = [
  { Icon: ChairIcon, ring: 0, angleDeg: 0 },
  { Icon: GridViewIcon, ring: 0, angleDeg: 180 },
  { Icon: DiamondIcon, ring: 1, angleDeg: 60 },
  { Icon: ViewColumnIcon, ring: 1, angleDeg: 180 },
  { Icon: EngineeringIcon, ring: 1, angleDeg: 300 },
  { Icon: ImagePlaceholderIcon, ring: 2, angleDeg: 30 },
  { Icon: PrecisionManufacturingIcon, ring: 2, angleDeg: 150 },
  { Icon: DrawIcon, ring: 2, angleDeg: 270 },
];

type OrbitIconHeroProps = {
  /** Overall diameter in px — the whole layout is authored at 360 and uniformly scaled, so the footer can use a smaller size without re-tuning every radius. */
  readonly size?: number;
};

/**
 * The orbiting-icon graphic — moved from the hero into the footer
 * (2026-08-26, owner's request), replaced in the hero by `HeroHexMosaic`.
 * Pure CSS — no JS, no animation library, still a Server Component; see
 * `docs/HANDOVER.md` §9e on why that matters here.
 */
export function OrbitIconHero({ size = 360 }: OrbitIconHeroProps) {
  const scale = size / 360;

  return (
    <div style={{ width: size, height: size, marginInline: 'auto', position: 'relative' }}>
      <div
        style={{
          width: 360,
          height: 360,
          position: 'absolute',
          top: 0,
          left: 0,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
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

        {RING_RADII.map((radius, index) => (
          <div
            key={radius}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: radius * 2,
              height: radius * 2,
              marginLeft: -radius,
              marginTop: -radius,
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

        {ORBITERS.map(({ Icon, ring, angleDeg }) => {
          const radius = RING_RADII[ring];
          const duration = RING_DURATIONS_S[ring];
          return (
            <div
              key={`${ring}-${angleDeg}`}
              className="orbit-spin"
              style={
                {
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: 0,
                  height: 0,
                  '--start-angle': `${angleDeg}deg`,
                  animation: `orbit-spin ${duration}s linear infinite`,
                } as CSSProperties
              }
            >
              <div style={{ transform: `translateX(${radius}px)` }}>
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
                      animation: `orbit-counter-spin ${duration}s linear infinite`,
                      '--start-angle': `${angleDeg}deg`,
                    } as CSSProperties
                  }
                >
                  <Icon size={24} style={{ color: 'var(--mui-palette-secondary-main)' }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
