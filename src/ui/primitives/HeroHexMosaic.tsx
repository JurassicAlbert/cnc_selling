import { DrawIcon, ImagePlaceholderIcon } from '@/ui/icons';
import { Hexagon, HexPhoto } from '@/ui/primitives/SectionDecoration';

/**
 * Replaces `OrbitIconHero` in the hero's right column (2026-08-26 — the
 * owner moved the orbit animation to the footer and asked for hexes with
 * real, on-brand images here instead — "engraved drawings... match the
 * design style"). Three real photos, all already used elsewhere on the
 * site (no new sourcing), chosen specifically because they show visible
 * engraving/carving rather than a generic material or machine shot:
 * `obrazy-drewniane.jpg` (an actual carved wood-art piece), `loft.jpg`
 * (the stool's engraved top), `amulety-i-bransoletki.jpg` (an engraved
 * wood bracelet). Much higher opacity and far less grayscale than the
 * subtle edge-decoration hexagons (`SectionDecoration`) — this is the
 * hero's primary visual now, meant to be looked at, not a background
 * accent. Pure inline SVG/CSS, `aria-hidden`, zero client JS.
 */
export function HeroHexMosaic() {
  return (
    <div aria-hidden="true" style={{ position: 'relative', width: '100%', maxWidth: 400, aspectRatio: '1 / 1', marginInline: 'auto' }}>
      <svg aria-hidden="true" viewBox="0 0 400 400" width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
        <Hexagon cx={70} cy={90} r={30} icon={DrawIcon} />
        <Hexagon cx={335} cy={315} r={32} icon={ImagePlaceholderIcon} />
        <Hexagon cx={205} cy={355} r={20} />
        <Hexagon cx={355} cy={195} r={18} />
        <Hexagon cx={28} cy={200} r={18} />
        <Hexagon cx={255} cy={35} r={16} />
        <Hexagon cx={130} cy={40} r={13} />
      </svg>
      <HexPhoto
        src="/images/photos/loft.jpg"
        cx={325}
        cy={85}
        size={115}
        opacity={0.92}
        grayscale={5}
      />
      <HexPhoto
        src="/images/photos/amulety-i-bransoletki.jpg"
        cx={78}
        cy={312}
        size={105}
        opacity={0.92}
        grayscale={5}
      />
      <HexPhoto
        src="/images/photos/obrazy-drewniane.jpg"
        cx={200}
        cy={195}
        size={190}
        opacity={0.96}
        grayscale={0}
      />
    </div>
  );
}
