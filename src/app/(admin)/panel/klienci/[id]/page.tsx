import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Grid, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';

import { ADMIN, adminOrderStatusLabel, adminUploadKindLabel } from '@/content/pl/admin';
import { formatPln } from '@/domain/money/money';
import {
  findCustomerForAdmin,
  listUploadedFilesForCustomer,
} from '@/server/repositories/admin-customers';
import { listOrdersForUser } from '@/server/repositories/orders';
import { listConfigurationsForUser } from '@/server/repositories/cart';
import { CustomerAnonymizeForm } from '@/ui/islands/admin/CustomerAnonymizeForm';

type CustomerDetailPageProps = {
  readonly params: Promise<{ readonly id: string }>;
};

function formatBytes(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function AdminCustomerDetailPage({ params }: CustomerDetailPageProps) {
  const { id } = await params;
  const customer = await findCustomerForAdmin(id);
  if (customer === null) {
    notFound();
  }

  const [orders, configurations, files] = await Promise.all([
    listOrdersForUser(customer.id),
    listConfigurationsForUser(customer.id),
    listUploadedFilesForCustomer(customer.id),
  ]);

  return (
    <>
      <Typography variant="h5" sx={{ mb: 3 }}>
        {customer.name}
      </Typography>

      <Grid container spacing={4}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Typography variant="h6">{ADMIN.customerProfileHeadingPl}</Typography>
          <Typography>
            {ADMIN.customerFieldEmailPl}: {customer.email}
          </Typography>
          {customer.phone !== null && (
            <Typography>
              {ADMIN.customerFieldPhonePl}: {customer.phone}
            </Typography>
          )}
          <Typography>
            {ADMIN.customerFieldRegisteredPl}: {customer.createdAt.toLocaleDateString('pl-PL')}
          </Typography>

          <Typography variant="h6" sx={{ mt: 4, mb: 1 }}>
            {ADMIN.customerOrdersHeadingPl}
          </Typography>
          {orders.length === 0 ? (
            <Typography color="text.secondary">{ADMIN.customerOrdersEmptyPl}</Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{ADMIN.ordersColumnNumberPl}</TableCell>
                  <TableCell>{ADMIN.ordersColumnStatusPl}</TableCell>
                  <TableCell align="right">{ADMIN.ordersColumnTotalPl}</TableCell>
                  <TableCell>{ADMIN.ordersColumnDatePl}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.orderNumber} hover>
                    <TableCell>
                      <Link href={`/panel/zamowienia/${encodeURIComponent(order.orderNumber)}`}>{order.orderNumber}</Link>
                    </TableCell>
                    <TableCell>{adminOrderStatusLabel(order.status)}</TableCell>
                    <TableCell align="right">{formatPln(order.totalGrossGrosze)}</TableCell>
                    <TableCell>{order.createdAt.toLocaleDateString('pl-PL')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <Typography variant="h6" sx={{ mt: 4, mb: 1 }}>
            {ADMIN.customerConfigurationsHeadingPl}
          </Typography>
          {configurations.length === 0 ? (
            <Typography color="text.secondary">{ADMIN.customerConfigurationsEmptyPl}</Typography>
          ) : (
            <Table size="small">
              <TableBody>
                {configurations.map((configuration) => (
                  <TableRow key={configuration.configurationId} hover>
                    <TableCell>{configuration.productNamePl}</TableCell>
                    <TableCell align="right">
                      {configuration.priceGrossGrosze !== null ? formatPln(configuration.priceGrossGrosze) : ''}
                    </TableCell>
                    <TableCell>{configuration.updatedAt.toLocaleDateString('pl-PL')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <Typography variant="h6" sx={{ mt: 4, mb: 1 }}>
            {ADMIN.customerFilesHeadingPl}
          </Typography>
          {files.length === 0 ? (
            <Typography color="text.secondary">{ADMIN.customerFilesEmptyPl}</Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>{ADMIN.customerFilesColumnNamePl}</TableCell>
                  <TableCell>{ADMIN.customerFilesColumnKindPl}</TableCell>
                  <TableCell align="right">{ADMIN.customerFilesColumnSizePl}</TableCell>
                  <TableCell>{ADMIN.customerFilesColumnDatePl}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {files.map((file) => (
                  <TableRow key={file.id} hover>
                    <TableCell>{file.originalName}</TableCell>
                    <TableCell>{adminUploadKindLabel(file.kind)}</TableCell>
                    <TableCell align="right">{formatBytes(file.sizeBytes)}</TableCell>
                    <TableCell>{file.createdAt.toLocaleDateString('pl-PL')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>
            {ADMIN.customerRodoHeadingPl}
          </Typography>
          <Link href={`/panel/klienci/${customer.id}/eksport`}>{ADMIN.customerExportLinkPl}</Link>

          <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>
            {ADMIN.customerAnonymizeHeadingPl}
          </Typography>
          {customer.anonymizedAt !== null ? (
            <Typography color="text.secondary">
              {ADMIN.customerAnonymizedNoticePl} — {customer.anonymizedAt.toLocaleDateString('pl-PL')}
            </Typography>
          ) : (
            <CustomerAnonymizeForm customerId={customer.id} />
          )}
        </Grid>
      </Grid>
    </>
  );
}
