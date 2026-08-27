import { notFound } from 'next/navigation';
import { Stack, Typography } from '@mui/material';

import { findCategoryForAdmin } from '@/server/repositories/admin-categories';
import { setCategoryActive } from '@/server/actions/admin-categories';
import { ActiveToggleButton } from '@/ui/primitives/ActiveToggleButton';
import { CategoryForm } from '@/ui/islands/admin/CategoryForm';

type CategoryDetailPageProps = {
  readonly params: Promise<{ readonly id: string }>;
};

export default async function AdminCategoryDetailPage({ params }: CategoryDetailPageProps) {
  const { id } = await params;
  const category = await findCategoryForAdmin(id);
  if (category === null) {
    notFound();
  }

  return (
    <>
      <Stack direction="row" sx={{ mb: 3, justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5">{category.namePl}</Typography>
        <ActiveToggleButton isActive={category.isActive} action={setCategoryActive.bind(null, category.id, !category.isActive)} />
      </Stack>
      <CategoryForm category={category} />
    </>
  );
}
