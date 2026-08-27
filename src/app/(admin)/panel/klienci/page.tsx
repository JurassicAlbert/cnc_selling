import Link from 'next/link';
import { Button, Chip, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import { listCustomersForAdmin } from '@/server/repositories/admin-customers';

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
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{ADMIN.customersColumnNamePl}</TableCell>
              <TableCell>{ADMIN.customersColumnEmailPl}</TableCell>
              <TableCell align="right">{ADMIN.customersColumnOrdersPl}</TableCell>
              <TableCell>{ADMIN.customersColumnRegisteredPl}</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {customers.map((customer) => (
              <TableRow key={customer.id} hover>
                <TableCell>
                  <Link href={`/panel/klienci/${customer.id}`}>{customer.name}</Link>
                </TableCell>
                <TableCell>{customer.email}</TableCell>
                <TableCell align="right">{customer.orderCount}</TableCell>
                <TableCell>{customer.createdAt.toLocaleDateString('pl-PL')}</TableCell>
                <TableCell>{customer.anonymizedAt !== null && <Chip size="small" label={ADMIN.customerAnonymizedChipPl} />}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}
