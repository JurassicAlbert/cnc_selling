import Link from 'next/link';
import type { ReactNode } from 'react';

type CardProps = {
  readonly href: string;
  readonly imageUrl: string | null;
  readonly imageAlt: string;
  readonly children: ReactNode;
};

/**
 * RSC-safe — `next/link` needs no client boundary. Plain `<img>`, not
 * `next/image`: every image today is a generated placeholder SVG that gets
 * no benefit from Next's raster optimization pipeline. Switch to
 * `next/image` when real photography replaces them (D5).
 */
export function Card({ href, imageUrl, imageAlt, children }: CardProps) {
  return (
    <Link href={href} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div
        style={{
          border: '1px solid var(--mui-palette-divider)',
          borderRadius: 2,
          overflow: 'hidden',
          backgroundColor: 'var(--mui-palette-background-paper)',
          height: '100%',
        }}
      >
        {imageUrl !== null && (
          // biome-ignore lint/performance/noImgElement: placeholder SVGs get nothing from next/image's raster pipeline — see file comment.
          <img
            src={imageUrl}
            alt={imageAlt}
            style={{ width: '100%', height: 180, objectFit: 'cover', display: 'block' }}
          />
        )}
        <div style={{ padding: 16 }}>{children}</div>
      </div>
    </Link>
  );
}
