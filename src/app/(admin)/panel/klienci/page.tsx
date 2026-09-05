import { Button, TextField, Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import { listCustomersForAdmin } from '@/server/repositories/admin-customers';
import { CustomersDataGrid } from '@/ui/islands/admin/CustomersDataGrid';
import { parsePagination } from '@/domain/pagination/page';
import { AdminPageSummary } from '@/ui/primitives/AdminPageSummary';

type CustomersPageProps = {
  readonly searchParams: Promise<{ readonly search?: string; readonly page?: string; readonly perPage?: string }>;
};

export default async function AdminCustomersPage({ searchParams }: CustomersPageProps) {
  const params = await searchParams;
  const search = params.search !== undefined && params.search.length > 0 ? params.search : undefined;

  const page = parsePagination(params);
  const customers = await listCustomersForAdmin(search, page);

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

      {customers.total === 0 ? (
        <Typography color="text.secondary">{ADMIN.customersEmptyPl}</Typography>
      ) : (
        <>
          <AdminPageSummary skip={page.skip} take={page.take} total={customers.total} />
          <CustomersDataGrid
            rows={customers.items}
            page={page.pageIndex}
            pageSize={page.pageSize}
            total={customers.total}
          />
        </>
      )}
    </>
  );
}
