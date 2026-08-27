import { notFound } from 'next/navigation';
import { Stack, Typography } from '@mui/material';

import { findCollectionForAdmin } from '@/server/repositories/admin-designs';
import { setCollectionActive } from '@/server/actions/admin-designs';
import { ActiveToggleButton } from '@/ui/primitives/ActiveToggleButton';
import { CollectionForm } from '@/ui/islands/admin/CollectionForm';

type CollectionDetailPageProps = {
  readonly params: Promise<{ readonly id: string }>;
};

export default async function AdminCollectionDetailPage({ params }: CollectionDetailPageProps) {
  const { id } = await params;
  const collection = await findCollectionForAdmin(id);
  if (collection === null) {
    notFound();
  }

  return (
    <>
      <Stack direction="row" sx={{ mb: 3, justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5">{collection.namePl}</Typography>
        <ActiveToggleButton isActive={collection.isActive} action={setCollectionActive.bind(null, collection.id, !collection.isActive)} />
      </Stack>
      <CollectionForm collection={collection} />
    </>
  );
}
