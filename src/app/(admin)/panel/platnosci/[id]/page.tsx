import { notFound } from 'next/navigation';
import { Stack, Typography } from '@mui/material';

import { findPaymentMethodConfigForAdmin } from '@/server/repositories/admin-payment-methods';
import { setPaymentMethodConfigActive } from '@/server/actions/admin-payment-methods';
import { ActiveToggleButton } from '@/ui/primitives/ActiveToggleButton';
import { PaymentMethodConfigForm } from '@/ui/islands/admin/PaymentMethodConfigForm';
import { RecordActivityTimeline } from '@/ui/islands/admin/RecordActivityTimeline';

type PaymentMethodDetailPageProps = {
  readonly params: Promise<{ readonly id: string }>;
};

export default async function AdminPaymentMethodDetailPage({ params }: PaymentMethodDetailPageProps) {
  const { id } = await params;
  const method = await findPaymentMethodConfigForAdmin(id);
  if (method === null) {
    notFound();
  }

  return (
    <>
      <Stack direction="row" sx={{ mb: 3, justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5">{method.namePl}</Typography>
        <ActiveToggleButton isActive={method.isActive} action={setPaymentMethodConfigActive.bind(null, method.id, !method.isActive)} />
      </Stack>
      <PaymentMethodConfigForm method={method} />
      <RecordActivityTimeline entity="PaymentMethodConfig" entityId={method.id} />
    </>
  );
}
