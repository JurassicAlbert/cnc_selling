import type { Metadata } from 'next';

import { customerDesignStatusMessage } from '@/content/pl/messages';
import { SITE } from '@/content/pl/site';
import { listMyCustomerDesigns } from '@/server/repositories/customer-designs';
import { CustomerDesignUploadForm } from '@/ui/islands/CustomerDesignUploadForm';
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
  const designs = await listMyCustomerDesigns();

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
            <div
              key={design.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: 16,
                border: '1px solid var(--mui-palette-divider)',
                borderRadius: 'var(--radius-card)',
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
            </div>
          ))}
        </div>
      )}

      <div style={{ marginBlockStart: 48, maxWidth: 480 }}>
        <ThemeRegistry>
          <CustomerDesignUploadForm />
        </ThemeRegistry>
      </div>
    </div>
  );
}
