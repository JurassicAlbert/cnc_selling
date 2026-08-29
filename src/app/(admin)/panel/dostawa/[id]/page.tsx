import { notFound } from 'next/navigation';
import { Stack, Typography } from '@mui/material';

import { findDeliveryMethodForAdmin } from '@/server/repositories/admin-delivery-methods';
import { setDeliveryMethodActive } from '@/server/actions/admin-delivery-methods';
import { ActiveToggleButton } from '@/ui/primitives/ActiveToggleButton';
import { DeliveryMethodForm } from '@/ui/islands/admin/DeliveryMethodForm';
import { DeliveryWeightTiersEditor } from '@/ui/islands/admin/DeliveryWeightTiersEditor';
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
      {/*
       * Directly below the form, not in a separate screen: the "Cena" field
       * just above is only the fallback for a method that has tiers, so the
       * two have to be readable together or the form stays misleading
       * (`docs/AUDIT-2026-08-30.md` §20).
       */}
      <DeliveryWeightTiersEditor deliveryMethodId={method.id} tiers={method.weightTiers} />
      <RecordActivityTimeline entity="DeliveryMethod" entityId={method.id} />
    </>
  );
}
