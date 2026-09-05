'use client';

/**
 * The 2D preview - ARCHITECTURE.md §7.3, closed 2026-08-24. Persistent
 * across every step, live-updating with the same selections the price
 * already reacts to.
 *
 * What is real here and what is not, stated plainly because this renders a
 * picture, and a picture makes claims a sentence does not:
 *
 *   - The material swatch is a REAL photo of that material
 *     (`Material.imageUrl`, sourced in the 2026-08-24 redesign) - not this
 *     exact piece of wood/tile the customer will receive, but genuinely that
 *     material, not a generic stand-in.
 *   - The design artwork is the ONE seeded `Design` row's own
 *     `previewUrl` - today that is still the "wzór podstawowy - do
 *     zastąpienia" placeholder SVG (see `prisma/seed.ts`'s header), so the
 *     mockup composites a real material photo with a placeholder pattern.
 *     That is an honest reflection of the data, not a bug: once real design
 *     artwork is seeded, this composites it exactly the same way, no code
 *     change required.
 *   - The engraved text is fully real: rendered in the EXACT font file
 *     `seedFont` parsed the glyph coverage from (`Font.fileUrl`, loaded here
 *     via the Font Loading API), never a system-font stand-in - the
 *     `Font` model's own header comment ("the preview MUST render with this
 *     same file, or the preview is a lie") is the reason this component
 *     loads a font by URL instead of just setting a CSS `font-family` name
 *     and hoping.
 *   - The module seam lines are exact - drawn directly from
 *     `ModuleLayout.modules`' real `xMm`/`yMm`/`widthMm`/`heightMm`
 *     (`domain/modules/split.ts`), the same numbers the price and the
 *     production plan already use. Nothing here is re-derived or guessed.
 *
 * The on-page caption says all of this in one sentence
 * (`configuratorPreviewCaptionPl`) instead of leaving a customer to assume
 * this is a photo of their finished piece.
 */

import { useEffect, useState } from 'react';

import type { Selections } from '@/domain/configuration/steps';
import type { ModuleLayout } from '@/domain/modules/split';
import type { ConfiguratorOptionData } from '@/server/configurator/resolve-options';
import { SITE } from '@/content/pl/site';
import { Text } from '@/ui/primitives/Text';

type ConfiguratorPreviewProps = {
  readonly selections: Selections;
  readonly options: ConfiguratorOptionData;
  readonly dimensionEnvelope: {
    readonly minWidthMm: number;
    readonly maxWidthMm: number;
    readonly minHeightMm: number;
    readonly maxHeightMm: number;
  };
  /** Only present once `pricing.status === 'priced'` - no seams to draw before that. */
  readonly moduleLayout: ModuleLayout | null;
};

function engravingFontFamily(fontId: string): string {
  return `engraving-${fontId}`;
}

// Module-level, not per-component-instance: a font file is the same bytes
// regardless of which product page mounted this component, so loading it
// twice would be pure waste, not a correctness issue either way.
const loadedFontFamilies = new Set<string>();

/** True once the exact font file is loaded and registered under its own `font-family` name. */
function useEngravingFont(fontId: string | null, fontUrl: string | null): boolean {
  const [ready, setReady] = useState(() => fontId !== null && loadedFontFamilies.has(fontId));

  useEffect(() => {
    if (fontId === null || fontUrl === null) {
      setReady(false);
      return;
    }
    if (loadedFontFamilies.has(fontId)) {
      setReady(true);
      return;
    }
    let cancelled = false;
    const face = new FontFace(engravingFontFamily(fontId), `url(${fontUrl})`);
    face
      .load()
      .then((loaded) => {
        document.fonts.add(loaded);
        loadedFontFamilies.add(fontId);
        if (!cancelled) setReady(true);
      })
      .catch(() => {
        // A failed font load leaves the preview without engraved text
        // rather than crashing the configurator over a decorative feature.
      });
    return () => {
      cancelled = true;
    };
  }, [fontId, fontUrl]);

  return ready;
}

export function ConfiguratorPreview({
  selections,
  options,
  dimensionEnvelope,
  moduleLayout,
}: ConfiguratorPreviewProps) {
  const material =
    selections.materialId === null
      ? null
      : (options.materials.find((m) => m.id === selections.materialId) ?? null);
  const design =
    selections.designId === null
      ? null
      : (options.designs.find((d) => d.id === selections.designId) ?? null);
  const font =
    selections.fontId === null ? null : (options.fonts.find((f) => f.id === selections.fontId) ?? null);
  const fontReady = useEngravingFont(font?.id ?? null, font?.fileUrl ?? null);

  const widthMm =
    selections.widthMm ?? Math.round((dimensionEnvelope.minWidthMm + dimensionEnvelope.maxWidthMm) / 2);
  const heightMm =
    selections.heightMm ??
    Math.round((dimensionEnvelope.minHeightMm + dimensionEnvelope.maxHeightMm) / 2);

  const textLines = (selections.personalizationText ?? '')
    .split('\n')
    .filter((line) => line.trim().length > 0);
  const strokeWidthMm = Math.max(widthMm, heightMm) * 0.006;
  const fontSizeMm = heightMm * 0.09;
  const lineHeightMm = fontSizeMm * 1.3;
  const textBlockHeightMm = textLines.length * lineHeightMm;

  if (material === null) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Text muted>{SITE.configuratorPreviewHeadingPl}</Text>
        <div
          style={{
            aspectRatio: `${widthMm} / ${heightMm}`,
            maxWidth: 360,
            background: 'var(--mui-palette-background-paper)',
            border: '1px solid var(--mui-palette-divider)',
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            textAlign: 'center',
          }}
        >
          <Text muted>{SITE.configuratorPreviewEmptyPl}</Text>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Text muted>{SITE.configuratorPreviewHeadingPl}</Text>
      <svg
        viewBox={`0 0 ${widthMm} ${heightMm}`}
        role="img"
        aria-label={SITE.configuratorPreviewHeadingPl}
        style={{
          width: '100%',
          maxWidth: 360,
          height: 'auto',
          display: 'block',
          borderRadius: 4,
          background: 'var(--mui-palette-divider)',
        }}
      >
        <image
          href={material.imageUrl}
          x={0}
          y={0}
          width={widthMm}
          height={heightMm}
          preserveAspectRatio="xMidYMid slice"
        />

        {design !== null && (
          <image
            href={design.previewUrl}
            x={widthMm * 0.2}
            y={heightMm * 0.15}
            width={widthMm * 0.6}
            height={heightMm * 0.55}
            preserveAspectRatio="xMidYMid meet"
            opacity={0.85}
            style={{ mixBlendMode: 'multiply' }}
          />
        )}

        {moduleLayout !== null &&
          moduleLayout.totalModules > 1 &&
          moduleLayout.modules.map((module) => (
            <rect
              key={module.code}
              x={module.xMm}
              y={module.yMm}
              width={module.widthMm}
              height={module.heightMm}
              fill="none"
              stroke="var(--mui-palette-background-paper)"
              strokeWidth={strokeWidthMm}
              strokeDasharray={`${strokeWidthMm * 2} ${strokeWidthMm * 2}`}
            />
          ))}

        {font !== null && fontReady && textLines.length > 0 && (
          <text
            x={widthMm / 2}
            y={heightMm - textBlockHeightMm / 2 - heightMm * 0.06}
            textAnchor="middle"
            dominantBaseline="middle"
            fontFamily={engravingFontFamily(font.id)}
            fontSize={fontSizeMm}
            fill="var(--mui-palette-primary-main)"
          >
            {textLines.map((line, index) => (
              // Index-keyed on purpose: these are positional lines of one
              // fixed customer input, not a reorderable list.
              // biome-ignore lint/suspicious/noArrayIndexKey: positional text lines, not a list
              <tspan key={index} x={widthMm / 2} dy={index === 0 ? 0 : lineHeightMm}>
                {line}
              </tspan>
            ))}
          </text>
        )}

        <rect
          x={strokeWidthMm / 2}
          y={strokeWidthMm / 2}
          width={widthMm - strokeWidthMm}
          height={heightMm - strokeWidthMm}
          fill="none"
          stroke="var(--mui-palette-primary-main)"
          strokeWidth={strokeWidthMm}
        />
      </svg>
      <Text muted>{SITE.configuratorPreviewCaptionPl}</Text>
    </div>
  );
}
