import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Chip, Typography } from '@mui/material';

import { ADMIN, adminSupportRequestStatusLabel } from '@/content/pl/admin';
import { findSupportRequestForAdmin } from '@/server/repositories/admin-support-requests';
import { SupportRequestDecisionForm } from '@/ui/islands/admin/SupportRequestDecisionForm';
import { RecordActivityTimeline } from '@/ui/islands/admin/RecordActivityTimeline';
import { Text } from '@/ui/primitives/Text';

type SupportRequestDetailPageProps = {
  readonly params: Promise<{ readonly id: string }>;
};

export default async function AdminSupportRequestDetailPage({ params }: SupportRequestDetailPageProps) {
  const { id } = await params;
  const request = await findSupportRequestForAdmin(id);
  if (request === null) {
    notFound();
  }

  return (
    <>
      <Typography variant="h5" sx={{ mb: 1 }}>
        {request.subjectPl}
      </Typography>
      <Chip size="small" label={adminSupportRequestStatusLabel(request.status)} sx={{ mb: 3 }} />

      <Text>
        {request.namePl ?? request.email} - {request.email}
      </Text>
      <Text muted>{request.createdAt.toLocaleString('pl-PL')}</Text>
      <Text muted>
        {request.orderNumber !== null ? (
          <>
            {ADMIN.supportRequestOrderContextPl}: <Link href={`/panel/zamowienia/${encodeURIComponent(request.orderNumber)}`}>{request.orderNumber}</Link>
          </>
        ) : (
          ADMIN.supportRequestNoOrderContextPl
        )}
      </Text>

      <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>
        {ADMIN.supportRequestFieldMessagePl}
      </Typography>
      <Typography sx={{ whiteSpace: 'pre-wrap' }}>{request.messagePl}</Typography>

      <SupportRequestDecisionForm id={request.id} status={request.status} adminNotesPl={request.adminNotesPl} />
      <RecordActivityTimeline entity="SupportRequest" entityId={request.id} />
    </>
  );
}
