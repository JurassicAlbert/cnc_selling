import { notFound } from 'next/navigation';
import { Divider, Stack, Typography } from '@mui/material';

import {
  findProductCollectionForAdmin,
  listProductCollectionItemsForAdmin,
  listProductOptionsForAdmin,
} from '@/server/repositories/admin-product-collections';
import { setProductCollectionActive } from '@/server/actions/admin-product-collections';
import { ActiveToggleButton } from '@/ui/primitives/ActiveToggleButton';
import { ProductCollectionForm } from '@/ui/islands/admin/ProductCollectionForm';
import { ProductCollectionItemsEditor } from '@/ui/islands/admin/ProductCollectionItemsEditor';
import { RecordActivityTimeline } from '@/ui/islands/admin/RecordActivityTimeline';

type ProductCollectionDetailPageProps = {
  readonly params: Promise<{ readonly id: string }>;
};

export default async function AdminProductCollectionDetailPage({ params }: ProductCollectionDetailPageProps) {
  const { id } = await params;
  const collection = await findProductCollectionForAdmin(id);
  if (collection === null) {
    notFound();
  }
  const [items, options] = await Promise.all([listProductCollectionItemsForAdmin(id), listProductOptionsForAdmin()]);

  return (
    <>
      <Stack direction="row" sx={{ mb: 3, justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5">{collection.namePl}</Typography>
        <ActiveToggleButton isActive={collection.isActive} action={setProductCollectionActive.bind(null, collection.id, !collection.isActive)} />
      </Stack>
      <ProductCollectionForm collection={collection} />
      <Divider sx={{ my: 4, maxWidth: 640 }} />
      <ProductCollectionItemsEditor collectionId={collection.id} items={items} options={options} />
      <RecordActivityTimeline entity="ProductCollection" entityId={collection.id} />
    </>
  );
}
