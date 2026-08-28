import { notFound } from 'next/navigation';
import { Stack, Typography } from '@mui/material';

import { findExternalPatternResourceForAdmin } from '@/server/repositories/admin-external-pattern-resources';
import { setExternalPatternResourceActive } from '@/server/actions/admin-external-pattern-resources';
import { ActiveToggleButton } from '@/ui/primitives/ActiveToggleButton';
import { ExternalPatternResourceForm } from '@/ui/islands/admin/ExternalPatternResourceForm';
import { RecordActivityTimeline } from '@/ui/islands/admin/RecordActivityTimeline';

type ExternalPatternResourceDetailPageProps = {
  readonly params: Promise<{ readonly id: string }>;
};

export default async function AdminExternalPatternResourceDetailPage({ params }: ExternalPatternResourceDetailPageProps) {
  const { id } = await params;
  const resource = await findExternalPatternResourceForAdmin(id);
  if (resource === null) {
    notFound();
  }

  return (
    <>
      <Stack direction="row" sx={{ mb: 3, justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5">{resource.namePl}</Typography>
        <ActiveToggleButton isActive={resource.isActive} action={setExternalPatternResourceActive.bind(null, resource.id, !resource.isActive)} />
      </Stack>
      <ExternalPatternResourceForm resource={resource} />
      <RecordActivityTimeline entity="ExternalPatternResource" entityId={resource.id} />
    </>
  );
}
