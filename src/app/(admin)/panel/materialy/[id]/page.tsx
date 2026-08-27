import { notFound } from 'next/navigation';
import { Divider, Stack, Typography } from '@mui/material';

import { findMaterialForAdmin } from '@/server/repositories/admin-materials';
import { listFinishOptionsForAdmin } from '@/server/repositories/admin-finishes';
import { setMaterialAvailable } from '@/server/actions/admin-materials';
import { ActiveToggleButton } from '@/ui/primitives/ActiveToggleButton';
import { MaterialForm } from '@/ui/islands/admin/MaterialForm';
import { MaterialFinishEditor } from '@/ui/islands/admin/MaterialFinishEditor';
import { RecordActivityTimeline } from '@/ui/islands/admin/RecordActivityTimeline';

type MaterialDetailPageProps = {
  readonly params: Promise<{ readonly id: string }>;
};

export default async function AdminMaterialDetailPage({ params }: MaterialDetailPageProps) {
  const { id } = await params;
  const [material, finishOptions] = await Promise.all([findMaterialForAdmin(id), listFinishOptionsForAdmin()]);
  if (material === null) {
    notFound();
  }

  return (
    <>
      <Stack direction="row" sx={{ mb: 3, justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5">{material.namePl}</Typography>
        <ActiveToggleButton isActive={material.isAvailable} action={setMaterialAvailable.bind(null, material.id, !material.isAvailable)} />
      </Stack>

      <MaterialForm material={material} />

      <Divider sx={{ my: 4 }} />
      <MaterialFinishEditor materialId={material.id} finishes={material.finishes} options={finishOptions} />
      <RecordActivityTimeline entity="Material" entityId={material.id} />
    </>
  );
}
