import type { Metadata } from 'next';
import Link from 'next/link';

import Image from 'next/image';

import { customerDesignStatusMessage } from '@/content/pl/messages';
import { SITE } from '@/content/pl/site';
import { listMyCustomerDesigns } from '@/server/repositories/customer-designs';
import { listMyFavoriteDesigns } from '@/server/repositories/design-favorites';
import { CustomerDesignUploadForm } from '@/ui/islands/CustomerDesignUploadForm';
import { FavoriteDesignButton } from '@/ui/islands/FavoriteDesignButton';
import { Heading } from '@/ui/primitives/Heading';
import { Text } from '@/ui/primitives/Text';
import { ThemeRegistry } from '@/ui/theme/ThemeRegistry';

export const metadata: Metadata = {
  title: SITE.accountDesignsHeadingPl,
};

const dateFormatter = new Intl.DateTimeFormat('pl-PL', { dateStyle: 'long' });

/**
 * P9 phase 2 — the standalone "moje wzory" library. Previously, uploading
 * a custom design only existed inline inside the `CUSTOM` product's own
 * configurator step; this page is its real, reusable home. The upload
 * form (the one genuinely interactive part) is a client island wrapped in
 * `ThemeRegistry`; the list itself is plain Server Component markup —
 * same "wrap only the interactive part" precedent as `/faq`.
 */
export default async function AccountDesignsPage() {
  const [designs, favoriteDesigns] = await Promise.all([listMyCustomerDesigns(), listMyFavoriteDesigns()]);

  return (
    <div>
      <Heading level={1}>{SITE.accountDesignsHeadingPl}</Heading>
      <div style={{ marginBlockStart: 8, maxWidth: 640 }}>
        <Text muted>{SITE.accountDesignsIntroPl}</Text>
      </div>

      {designs.length === 0 ? (
        <div style={{ marginBlockStart: 24 }}>
          <Text muted>{SITE.accountDesignsEmptyPl}</Text>
        </div>
      ) : (
        <div style={{ marginBlockStart: 32, display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 640 }}>
          {designs.map((design) => (
            <Link
              key={design.id}
              href={`/moje-konto/wzory/${design.id}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: 16,
                border: '1px solid var(--mui-palette-divider)',
                borderRadius: 'var(--radius-card)',
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              {design.hasPreview ? (
                // biome-ignore lint/performance/noImgElement: an authorized, per-owner file-serving route (`/api/plik/[fileId]`), not a static asset `next/image` could optimize.
                <img
                  src={`/api/plik/${design.fileId}?preview=1`}
                  alt={design.titlePl ?? design.originalName}
                  style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }}
                />
              ) : (
                <div
                  style={{
                    width: 64,
                    height: 64,
                    flexShrink: 0,
                    borderRadius: 4,
                    background: 'var(--mui-palette-action-hover)',
                  }}
                />
              )}
              <div style={{ flex: 1 }}>
                <Text>{design.titlePl ?? SITE.accountDesignsUntitledPl}</Text>
                <Text muted>{design.originalName}</Text>
                <Text muted>
                  {SITE.accountDesignsUploadedAtLabelPl}: {dateFormatter.format(design.createdAt)}
                </Text>
              </div>
              <Text muted>{customerDesignStatusMessage(design.status)}</Text>
            </Link>
          ))}
        </div>
      )}

      {/* P9 continuation, 2026-08-28, owner feedback: catalogue designs
          favourited from /wzory, distinct from the customer's own
          uploads above. */}
      <div style={{ marginBlockStart: 48 }}>
        <Heading level={2}>{SITE.accountFavoriteDesignsHeadingPl}</Heading>
        {favoriteDesigns.length === 0 ? (
          <div style={{ marginBlockStart: 12 }}>
            <Text muted>{SITE.accountFavoriteDesignsEmptyPl}</Text>
            {/*
             * Points at /kolekcje, not /wzory: the patterns page is
             * deliberately `notFound()`-ed for now (owner's request), and
             * an empty state whose only call to action is a 404 is worse
             * than an empty state with none. Collections are the real
             * browsing surface while that page is hidden. Found by
             * crawling the storefront during the 2026-08-30 audit.
             */}
            <Link href="/kolekcje" style={{ display: 'inline-block', marginBlockStart: 8 }}>
              {SITE.accountFavoriteDesignsBrowseLinkPl}
            </Link>
          </div>
        ) : (
          <div
            style={{
              marginBlockStart: 16,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
              gap: 16,
              maxWidth: 640,
            }}
          >
            {favoriteDesigns.map((design) => (
              <div key={design.id}>
                <div
                  style={{
                    position: 'relative',
                    aspectRatio: '1 / 1',
                    borderRadius: 'var(--radius-card)',
                    overflow: 'hidden',
                    marginBlockEnd: 4,
                  }}
                >
                  <Image src={design.thumbnailUrl} alt="" fill sizes="160px" style={{ objectFit: 'cover' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                  <Text>{design.namePl}</Text>
                  <FavoriteDesignButton designId={design.id} initiallyFavorited loggedIn />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginBlockStart: 48, maxWidth: 480 }}>
        <ThemeRegistry>
          <CustomerDesignUploadForm />
        </ThemeRegistry>
      </div>
    </div>
  );
}
