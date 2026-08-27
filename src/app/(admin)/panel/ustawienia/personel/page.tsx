import { Button, Divider, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import { requireAdminSession } from '@/server/auth/session';
import { listStaffUsers } from '@/server/repositories/admin-staff';
import { changeStaffRole } from '@/server/actions/admin-staff';
import { StaffInviteForm } from '@/ui/islands/admin/StaffInviteForm';

function roleLabel(role: string): string {
  return role === 'ADMIN' ? ADMIN.staffRoleAdminPl : ADMIN.staffRoleStaffPl;
}

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
        <Table size="small" sx={{ mb: 4 }}>
          <TableHead>
            <TableRow>
              <TableCell>{ADMIN.staffColumnNamePl}</TableCell>
              <TableCell>{ADMIN.staffColumnEmailPl}</TableCell>
              <TableCell>{ADMIN.staffColumnRolePl}</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {staff.map((user) => (
              <TableRow key={user.id} hover>
                <TableCell>{user.name}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>{roleLabel(user.role)}</TableCell>
                <TableCell>
                  {user.id !== admin.userId && (
                    <form action={changeStaffRole.bind(null, user.id, 'CUSTOMER')}>
                      <Button type="submit" size="small" color="error">
                        {ADMIN.staffRevokeButtonPl}
                      </Button>
                    </form>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Divider sx={{ mb: 4 }} />

      <Stack>
        <StaffInviteForm />
      </Stack>
    </>
  );
}
