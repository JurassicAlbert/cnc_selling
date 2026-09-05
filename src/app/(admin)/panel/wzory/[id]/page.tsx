import { notFound } from 'next/navigation';
import { Divider, Stack, Typography } from '@mui/material';

import { findDesignForAdmin, listCollectionOptionsForAdmin } from '@/server/repositories/admin-designs';
import { listMaterialOptionsForAdmin } from '@/server/repositories/admin-products';
import { duplicateDesignAndGo, setDesignActive } from '@/server/actions/admin-designs';
import { ActiveToggleButton } from '@/ui/primitives/ActiveToggleButton';
import { DuplicateButton } from '@/ui/primitives/DuplicateButton';
import { DesignForm } from '@/ui/islands/admin/DesignForm';
import { DesignMaterialEditor } from '@/ui/islands/admin/DesignMaterialEditor';
import { RecordActivityTimeline } from '@/ui/islands/admin/RecordActivityTimeline';

type DesignDetailPageProps = {
  readonly params: Promise<{ readonly id: string }>;
};

export default async function AdminDesignDetailPage({ params }: DesignDetailPageProps) {
  const { id } = await params;
  const [design, collections, materialOptions] = await Promise.all([
    findDesignForAdmin(id),
    listCollectionOptionsForAdmin(),
    listMaterialOptionsForAdmin(),
  ]);
  if (design === null) {
    notFound();
  }

  return (
    <>
      <Stack direction="row" sx={{ mb: 3, justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5">{design.namePl}</Typography>
        <Stack direction="row" spacing={1}>
          <DuplicateButton action={duplicateDesignAndGo.bind(null, design.id)} />
          <ActiveToggleButton isActive={design.isActive} action={setDesignActive.bind(null, design.id, !design.isActive)} />
        </Stack>
      </Stack>

      <DesignForm design={design} collections={collections} />

      <Divider sx={{ my: 4 }} />
      <DesignMaterialEditor designId={design.id} materials={design.materials} options={materialOptions} />
      <RecordActivityTimeline entity="Design" entityId={design.id} />
    </>
  );
}
