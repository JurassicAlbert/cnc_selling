import { notFound } from 'next/navigation';
import { Stack, Typography } from '@mui/material';

import { findFinishForAdmin } from '@/server/repositories/admin-finishes';
import { setFinishAvailable } from '@/server/actions/admin-finishes';
import { ActiveToggleButton } from '@/ui/primitives/ActiveToggleButton';
import { FinishForm } from '@/ui/islands/admin/FinishForm';
import { RecordActivityTimeline } from '@/ui/islands/admin/RecordActivityTimeline';

type FinishDetailPageProps = {
  readonly params: Promise<{ readonly id: string }>;
};

export default async function AdminFinishDetailPage({ params }: FinishDetailPageProps) {
  const { id } = await params;
  const finish = await findFinishForAdmin(id);
  if (finish === null) {
    notFound();
  }

  return (
    <>
      <Stack direction="row" sx={{ mb: 3, justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5">{finish.namePl}</Typography>
        <ActiveToggleButton isActive={finish.isAvailable} action={setFinishAvailable.bind(null, finish.id, !finish.isAvailable)} />
      </Stack>

      <FinishForm finish={finish} />
      <RecordActivityTimeline entity="Finish" entityId={finish.id} />
    </>
  );
}
