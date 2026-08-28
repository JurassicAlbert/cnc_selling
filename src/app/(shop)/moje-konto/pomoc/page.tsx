import type { Metadata } from 'next';
import Link from 'next/link';

import { supportRequestStatusMessage } from '@/content/pl/messages';
import { SITE } from '@/content/pl/site';
import { getSession } from '@/server/auth/session';
import { submitSupportRequest } from '@/server/actions/support-requests';
import { listMySupportRequests } from '@/server/repositories/support-requests';
import { SupportRequestForm } from '@/ui/islands/SupportRequestForm';
import { Heading } from '@/ui/primitives/Heading';
import { Text } from '@/ui/primitives/Text';
import { ThemeRegistry } from '@/ui/theme/ThemeRegistry';

export const metadata: Metadata = {
  title: SITE.accountHelpHeadingPl,
};

const dateFormatter = new Intl.DateTimeFormat('pl-PL', { dateStyle: 'long' });

/**
 * P9 continuation, 2026-08-28 — "informacje kontaktowe i pomoc do firmy"
 * (owner feedback). `submitSupportRequest`/`SupportRequestForm` already
 * existed (`/kontakt`); this page is the missing other half — a customer
 * could file a request but never see it again. `adminNotesPl` stays
 * staff-only (schema's own comment) — only `status` is shown, matching
 * `listSupportRequestsForUser`'s deliberately narrow select.
 */
export default async function AccountHelpPage() {
  const [session, requests] = await Promise.all([getSession(), listMySupportRequests()]);

  return (
    <div>
      <Heading level={1}>{SITE.accountHelpHeadingPl}</Heading>
      <div style={{ marginBlockStart: 8, maxWidth: 640 }}>
        <Text muted>{SITE.accountHelpIntroPl}</Text>
      </div>

      <div style={{ marginBlockStart: 32 }}>
        <Heading level={2}>{SITE.accountHelpRequestsHeadingPl}</Heading>
        {requests.length === 0 ? (
          <div style={{ marginBlockStart: 12 }}>
            <Text muted>{SITE.accountHelpRequestsEmptyPl}</Text>
          </div>
        ) : (
          <div style={{ marginBlockStart: 16, display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 640 }}>
            {requests.map((request) => (
              <div
                key={request.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 16,
                  padding: 16,
                  border: '1px solid var(--mui-palette-divider)',
                  borderRadius: 'var(--radius-card)',
                }}
              >
                <div>
                  <Text>{request.subjectPl}</Text>
                  {request.orderNumber !== null && (
                    <Text muted>
                      {SITE.accountHelpOrderContextPl}: {request.orderNumber}
                    </Text>
                  )}
                  <Text muted>{dateFormatter.format(request.createdAt)}</Text>
                </div>
                <Text muted>{supportRequestStatusMessage(request.status)}</Text>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginBlockStart: 48, maxWidth: 480 }}>
        <ThemeRegistry>
          <SupportRequestForm action={submitSupportRequest} heading={SITE.accountHelpNewRequestHeadingPl} defaultEmail={session?.email} />
        </ThemeRegistry>
      </div>

      <div style={{ marginBlockStart: 24 }}>
        <Link href="/kontakt" style={{ font: 'var(--mui-font-body2)' }}>
          {SITE.contactHeadingPl}
        </Link>
      </div>
    </div>
  );
}
