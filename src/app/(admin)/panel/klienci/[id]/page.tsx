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
import { requireStaffSession } from '@/server/auth/session';
import { CustomerAnonymizeForm } from '@/ui/islands/admin/CustomerAnonymizeForm';
import { RecordActivityTimeline } from '@/ui/islands/admin/RecordActivityTimeline';

type CustomerDetailPageProps = {
  readonly params: Promise<{ readonly id: string }>;
};

function formatBytes(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * ARCHITECTURE.md §16.3 gives STAFF "customers (**read**)" — so this page
 * stays STAFF-visible, and only the anonymize control is ADMIN-only
 * (docs/REVIEW-DETAILED.md SEC-04). The session is read here rather than
 * inherited from the layout because a Server Component cannot receive the
 * layout's locals; `requireStaffSession()` is the same gate the layout
 * already applied, so this adds a role read, not a second authorization
 * decision.
 *
 * Hiding the form is not the enforcement — `applyAnonymizeCustomer` and
 * `anonymizeCustomer` both refuse a non-ADMIN actor. This is here so a
 * STAFF is never shown a control the system will then refuse, which is the
 * shape the owner ruled out on 2026-08-31.
 */
export default async function AdminCustomerDetailPage({ params }: CustomerDetailPageProps) {
  const viewer = await requireStaffSession();
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
          {/*
            A plain <a>, not next/link — the same convention
            `weryfikacja/[designId]` already uses for `/api/plik/[fileId]`.
            This target is a route handler that BUILDS the export and writes
            an audit row, and Next prefetches `<Link>` targets: with a
            `<Link>` here, opening this page silently performed a RODO export
            and logged it (SEC-10, 2026-08-31). Nothing that has a side
            effect may be speculatively fetched.
          */}
          <a href={`/panel/klienci/${customer.id}/eksport`}>{ADMIN.customerExportLinkPl}</a>

          <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>
            {ADMIN.customerAnonymizeHeadingPl}
          </Typography>
          {customer.anonymizedAt !== null ? (
            <Typography color="text.secondary">
              {ADMIN.customerAnonymizedNoticePl} — {customer.anonymizedAt.toLocaleDateString('pl-PL')}
            </Typography>
          ) : viewer.role === 'ADMIN' ? (
            <CustomerAnonymizeForm customerId={customer.id} />
          ) : (
            <Typography color="text.secondary">{ADMIN.customerAnonymizeAdminOnlyPl}</Typography>
          )}
        </Grid>
      </Grid>

      <RecordActivityTimeline entity="User" entityId={customer.id} />
    </>
  );
}
