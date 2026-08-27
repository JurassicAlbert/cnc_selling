import Link from 'next/link';
import { Button, Chip, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import { listFaqsForAdmin } from '@/server/repositories/admin-faq';

export default async function AdminFaqPage() {
  const faqs = await listFaqsForAdmin();

  return (
    <>
      <Typography variant="h5" sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {ADMIN.faqHeadingPl}
        <Link href="/panel/faq/nowe" style={{ textDecoration: 'none' }}>
          <Button variant="contained" size="small">
            {ADMIN.faqNewPl}
          </Button>
        </Link>
      </Typography>

      {faqs.length === 0 ? (
        <Typography color="text.secondary">{ADMIN.faqEmptyPl}</Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{ADMIN.faqColumnQuestionPl}</TableCell>
              <TableCell>{ADMIN.faqColumnStatusPl}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {faqs.map((faq) => (
              <TableRow key={faq.id} hover>
                <TableCell>
                  <Link href={`/panel/faq/${faq.id}`}>{faq.questionPl}</Link>
                </TableCell>
                <TableCell>
                  <Chip size="small" label={faq.isActive ? ADMIN.activeLabelPl : ADMIN.inactiveLabelPl} color={faq.isActive ? 'success' : 'default'} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}
