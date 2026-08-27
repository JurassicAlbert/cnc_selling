import { notFound } from 'next/navigation';
import { Stack, Typography } from '@mui/material';

import { findStaticPageForAdmin } from '@/server/repositories/admin-static-pages';
import { setStaticPageActive } from '@/server/actions/admin-static-pages';
import { ActiveToggleButton } from '@/ui/primitives/ActiveToggleButton';
import { StaticPageForm } from '@/ui/islands/admin/StaticPageForm';

type StaticPageDetailPageProps = {
  readonly params: Promise<{ readonly id: string }>;
};

export default async function AdminStaticPageDetailPage({ params }: StaticPageDetailPageProps) {
  const { id } = await params;
  const page = await findStaticPageForAdmin(id);
  if (page === null) {
    notFound();
  }

  return (
    <>
      <Stack direction="row" sx={{ mb: 3, justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5">{page.titlePl}</Typography>
        <ActiveToggleButton isActive={page.isActive} action={setStaticPageActive.bind(null, page.id, !page.isActive)} />
      </Stack>
      <StaticPageForm page={page} />
    </>
  );
}
