import { notFound } from 'next/navigation';
import { Stack, Typography } from '@mui/material';

import { findDeliveryMethodForAdmin } from '@/server/repositories/admin-delivery-methods';
import { setDeliveryMethodActive } from '@/server/actions/admin-delivery-methods';
import { ActiveToggleButton } from '@/ui/primitives/ActiveToggleButton';
import { DeliveryMethodForm } from '@/ui/islands/admin/DeliveryMethodForm';
import { RecordActivityTimeline } from '@/ui/islands/admin/RecordActivityTimeline';

type DeliveryMethodDetailPageProps = {
  readonly params: Promise<{ readonly id: string }>;
};

export default async function AdminDeliveryMethodDetailPage({ params }: DeliveryMethodDetailPageProps) {
  const { id } = await params;
  const method = await findDeliveryMethodForAdmin(id);
  if (method === null) {
    notFound();
  }

  return (
    <>
      <Stack direction="row" sx={{ mb: 3, justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5">{method.namePl}</Typography>
        <ActiveToggleButton isActive={method.isActive} action={setDeliveryMethodActive.bind(null, method.id, !method.isActive)} />
      </Stack>
      <DeliveryMethodForm method={method} />
      <RecordActivityTimeline entity="DeliveryMethod" entityId={method.id} />
    </>
  );
}
