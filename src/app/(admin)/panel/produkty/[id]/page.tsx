import { notFound } from 'next/navigation';
import { Divider, Stack, Typography } from '@mui/material';

import {
  findProductForAdmin,
  listCategoryOptionsForAdmin,
  listDesignOptionsForAdmin,
  listMaterialOptionsForAdmin,
} from '@/server/repositories/admin-products';
import { setProductActive } from '@/server/actions/admin-products';
import { ActiveToggleButton } from '@/ui/primitives/ActiveToggleButton';
import { ProductForm } from '@/ui/islands/admin/ProductForm';
import { PresetSizesEditor } from '@/ui/islands/admin/PresetSizesEditor';
import { ThicknessesEditor } from '@/ui/islands/admin/ThicknessesEditor';
import { MaterialCompatEditor } from '@/ui/islands/admin/MaterialCompatEditor';
import { DesignAssignEditor } from '@/ui/islands/admin/DesignAssignEditor';
import { InstallVariantsEditor } from '@/ui/islands/admin/InstallVariantsEditor';
import { ProductImagesEditor } from '@/ui/islands/admin/ProductImagesEditor';
import { RecordActivityTimeline } from '@/ui/islands/admin/RecordActivityTimeline';

type ProductDetailPageProps = {
  readonly params: Promise<{ readonly id: string }>;
};

export default async function AdminProductDetailPage({ params }: ProductDetailPageProps) {
  const { id } = await params;
  const [product, categories, materialOptions, designOptions] = await Promise.all([
    findProductForAdmin(id),
    listCategoryOptionsForAdmin(),
    listMaterialOptionsForAdmin(),
    listDesignOptionsForAdmin(),
  ]);
  if (product === null) {
    notFound();
  }

  return (
    <>
      <Stack direction="row" sx={{ mb: 3, justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5">{product.namePl}</Typography>
        <ActiveToggleButton isActive={product.isActive} action={setProductActive.bind(null, product.id, !product.isActive)} />
      </Stack>

      <ProductForm product={product} categories={categories} />

      <Divider sx={{ my: 4 }} />
      <PresetSizesEditor productId={product.id} sizes={product.presetSizes} />

      <Divider sx={{ my: 4 }} />
      <ThicknessesEditor productId={product.id} thicknesses={product.thicknesses} />

      <Divider sx={{ my: 4 }} />
      <MaterialCompatEditor productId={product.id} materials={product.materials} options={materialOptions} />

      <Divider sx={{ my: 4 }} />
      <DesignAssignEditor productId={product.id} designs={product.designs} options={designOptions} />

      <Divider sx={{ my: 4 }} />
      <InstallVariantsEditor productId={product.id} variants={product.installVariants} />

      <Divider sx={{ my: 4 }} />
      <ProductImagesEditor productId={product.id} images={product.images} />
      <RecordActivityTimeline entity="Product" entityId={product.id} />
    </>
  );
}
