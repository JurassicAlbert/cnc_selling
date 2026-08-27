import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';

import { ADMIN, adminEmailTemplateKeyLabel } from '@/content/pl/admin';
import { listEmailTemplates } from '@/server/repositories/admin-email-templates';

export default async function AdminEmailTemplatesPage() {
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
