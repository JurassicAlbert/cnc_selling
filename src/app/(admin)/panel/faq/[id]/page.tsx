import { notFound } from 'next/navigation';
import { Stack, Typography } from '@mui/material';

import { findFaqForAdmin } from '@/server/repositories/admin-faq';
import { setFaqActive } from '@/server/actions/admin-faq';
import { ActiveToggleButton } from '@/ui/primitives/ActiveToggleButton';
import { FaqForm } from '@/ui/islands/admin/FaqForm';
import { RecordActivityTimeline } from '@/ui/islands/admin/RecordActivityTimeline';

type FaqDetailPageProps = {
  readonly params: Promise<{ readonly id: string }>;
};

export default async function AdminFaqDetailPage({ params }: FaqDetailPageProps) {
  const { id } = await params;
  const faq = await findFaqForAdmin(id);
  if (faq === null) {
    notFound();
  }

  return (
    <>
      <Stack direction="row" sx={{ mb: 3, justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5">{faq.questionPl}</Typography>
        <ActiveToggleButton isActive={faq.isActive} action={setFaqActive.bind(null, faq.id, !faq.isActive)} />
      </Stack>
      <FaqForm faq={faq} />
      <RecordActivityTimeline entity="Faq" entityId={faq.id} />
    </>
  );
}
