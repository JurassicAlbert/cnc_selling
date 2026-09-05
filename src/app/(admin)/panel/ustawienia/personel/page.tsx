import { Divider, Stack, Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import { requireAdminSession } from '@/server/auth/session';
import { listStaffUsers } from '@/server/repositories/admin-staff';
import { StaffDataGrid } from '@/ui/islands/admin/StaffDataGrid';
import { StaffInviteForm } from '@/ui/islands/admin/StaffInviteForm';

export default async function AdminStaffPage() {
  const admin = await requireAdminSession();
  const staff = await listStaffUsers();

  return (
    <>
      <Typography variant="h5" sx={{ mb: 3 }}>
        {ADMIN.staffHeadingPl}
      </Typography>

      {staff.length === 0 ? (
        <Typography color="text.secondary">{ADMIN.staffEmptyPl}</Typography>
      ) : (
        <Stack sx={{ mb: 4 }}>
          <StaffDataGrid rows={staff} currentUserId={admin.userId} />
        </Stack>
      )}

      <Divider sx={{ mb: 4 }} />

      <Stack>
        <StaffInviteForm />
      </Stack>
    </>
  );
}
