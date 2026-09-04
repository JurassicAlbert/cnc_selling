import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { customerDesignStatusMessage } from '@/content/pl/messages';
import { SITE } from '@/content/pl/site';
import { findMyCustomerDesign } from '@/server/repositories/customer-designs';
import { requireOwnedDesignStatus } from '@/server/repositories/design-review';
import { DesignReviewDiscussion } from '@/ui/islands/DesignReviewDiscussion';
import { ReuploadCustomDesignForm } from '@/ui/islands/ReuploadCustomDesignForm';
import { Heading } from '@/ui/primitives/Heading';
import { Text } from '@/ui/primitives/Text';
import { ThemeRegistry } from '@/ui/theme/ThemeRegistry';

type DesignDetailPageProps = {
  readonly params: Promise<{ readonly id: string }>;
};

export const metadata: Metadata = {
  title: SITE.accountDesignsHeadingPl,
};

const dateFormatter = new Intl.DateTimeFormat('pl-PL', { dateStyle: 'long', timeStyle: 'short' });

/**
 * P9 continuation, 2026-08-28 - the "dyskusja" per uploaded design the
 * owner asked for. The status/comment read side already existed
 * (`requireOwnedDesignStatus`, built for P7's admin panel but never
 * rendered anywhere customer-facing); this page finally renders it,
 * plus the file/title info `listMyCustomerDesigns` already shows in the
 * list, plus a real reply form (`DesignReviewDiscussion`, new). Also
 * closes `docs/CHECKLIST.md`'s own honestly-flagged gap: `NEEDS_CHANGES`
 * had a real, tested `reuploadCustomDesign` action but no UI to reach it -
 * `ReuploadCustomDesignForm` is shown only for that one status;
 * `checkDesignReviewTransition` inside the action itself is still the real
 * gate, this is just the entry point.
 * `notFound()` on any ownership failure - same 404-not-403 discipline as
 * `requireOwnedDesignStatus` itself.
 */
export default async function AccountDesignDetailPage({ params }: DesignDetailPageProps) {
  const { id } = await params;
  const [design, reviewStatus] = await Promise.all([findMyCustomerDesign(id), requireOwnedDesignStatus(id)]);
  if (design === null || reviewStatus === null) {
    notFound();
  }

  return (
    <div>
      <Link href="/moje-konto/wzory" style={{ font: 'var(--mui-font-body2)' }}>
        ← {SITE.designDetailBackToListPl}
      </Link>

      <div style={{ marginBlockStart: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
        {design.hasPreview ? (
          // biome-ignore lint/performance/noImgElement: an authorized, per-owner file-serving route (`/api/plik/[fileId]`), not a static asset `next/image` could optimize.
          <img
            src={`/api/plik/${design.fileId}?preview=1`}
            alt={design.titlePl ?? design.originalName}
            style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }}
          />
        ) : (
          <div style={{ width: 96, height: 96, flexShrink: 0, borderRadius: 4, background: 'var(--mui-palette-action-hover)' }} />
        )}
        <div>
          <Heading level={1}>{design.titlePl ?? SITE.accountDesignsUntitledPl}</Heading>
          <Text muted>{design.originalName}</Text>
          <div style={{ marginBlockStart: 4 }}>
            <Text>
              {SITE.designDetailStatusLabelPl}: {customerDesignStatusMessage(design.status)}
            </Text>
          </div>
        </div>
      </div>

      {design.status === 'NEEDS_CHANGES' && (
        <div style={{ marginBlockStart: 32, maxWidth: 480 }}>
          <ThemeRegistry>
            <ReuploadCustomDesignForm customerDesignId={design.id} />
          </ThemeRegistry>
        </div>
      )}

      <div style={{ marginBlockStart: 48, maxWidth: 640 }}>
        <Heading level={2}>{SITE.designDetailDiscussionHeadingPl}</Heading>

        {reviewStatus.comments.length === 0 ? (
          <div style={{ marginBlockStart: 12 }}>
            <Text muted>{SITE.designDetailDiscussionEmptyPl}</Text>
          </div>
        ) : (
          <div style={{ marginBlockStart: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {reviewStatus.comments.map((comment) => (
              <div key={comment.id}>
                <Text muted>
                  {comment.authorType === 'staff' ? SITE.designDetailCommentStaffLabelPl : SITE.designDetailCommentCustomerLabelPl}
                  {' · '}
                  {dateFormatter.format(comment.createdAt)}
                </Text>
                <Text>{comment.bodyPl}</Text>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginBlockStart: 24, marginBlockEnd: 24, borderTop: '1px solid var(--mui-palette-divider)', maxWidth: 480 }} />

        <ThemeRegistry>
          <DesignReviewDiscussion customerDesignId={design.id} />
        </ThemeRegistry>
      </div>
    </div>
  );
}
