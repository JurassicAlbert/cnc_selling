import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';

import { ADMIN, adminEmailTemplateKeyLabel } from '@/content/pl/admin';
import { requireAdminSession } from '@/server/auth/session';
import { listEmailTemplates } from '@/server/repositories/admin-email-templates';

// ADMIN-only, 2026-08-31 (SEC-04): these bodies are customer-facing email,
// verification-otp included. See ustawienia/page.tsx's header.
export default async function AdminEmailTemplatesPage() {
  await requireAdminSession();
  const templates = await listEmailTemplates();

  return (
    <>
      <Typography variant="h5" sx={{ mb: 3 }}>
        {ADMIN.emailTemplatesHeadingPl}
      </Typography>

      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>{ADMIN.emailTemplatesColumnKeyPl}</TableCell>
            <TableCell>{ADMIN.emailTemplateFieldSubjectPl}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {templates.map((template) => (
            <TableRow key={template.key} hover>
              <TableCell>
                <Link href={`/panel/ustawienia/szablony/${template.key}`}>{adminEmailTemplateKeyLabel(template.key)}</Link>
              </TableCell>
              <TableCell>{template.subjectPl}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}
