import Link from 'next/link';
import { Button, Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import { listFaqsForAdmin } from '@/server/repositories/admin-faq';
import { FaqDataGrid } from '@/ui/islands/admin/FaqDataGrid';

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
        <FaqDataGrid rows={faqs} />
      )}
    </>
  );
}
