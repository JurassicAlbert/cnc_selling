import { Button, TextField, Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import { listCustomersForAdmin } from '@/server/repositories/admin-customers';
import { CustomersDataGrid } from '@/ui/islands/admin/CustomersDataGrid';

type CustomersPageProps = {
  readonly searchParams: Promise<{ readonly search?: string }>;
};

export default async function AdminCustomersPage({ searchParams }: CustomersPageProps) {
  const params = await searchParams;
  const search = params.search !== undefined && params.search.length > 0 ? params.search : undefined;

  const customers = await listCustomersForAdmin(search);

  return (
    <>
      <Typography variant="h5" sx={{ mb: 3 }}>
        {ADMIN.customersHeadingPl}
      </Typography>

      <form style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        <TextField name="search" label={ADMIN.customersFilterSearchPl} defaultValue={search ?? ''} size="small" sx={{ minWidth: 280 }} />
        <Button type="submit" variant="contained">
          {ADMIN.ordersFilterApplyPl}
        </Button>
      </form>

      {customers.length === 0 ? (
        <Typography color="text.secondary">{ADMIN.customersEmptyPl}</Typography>
      ) : (
        <CustomersDataGrid rows={customers} />
      )}
    </>
  );
}
