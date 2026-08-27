import { notFound } from 'next/navigation';
import { Typography } from '@mui/material';

import { EMAIL_TEMPLATE_PLACEHOLDERS_PL, adminEmailTemplateKeyLabel } from '@/content/pl/admin';
import { findEmailTemplate } from '@/server/repositories/admin-email-templates';
import { EmailTemplateForm } from '@/ui/islands/admin/EmailTemplateForm';
import { RecordActivityTimeline } from '@/ui/islands/admin/RecordActivityTimeline';

type EmailTemplateDetailPageProps = {
  readonly params: Promise<{ readonly key: string }>;
};

export default async function AdminEmailTemplateDetailPage({ params }: EmailTemplateDetailPageProps) {
  const { key } = await params;
  const template = await findEmailTemplate(key);
  if (template === null) {
    notFound();
  }

  return (
    <>
      <Typography variant="h5" sx={{ mb: 3 }}>
        {adminEmailTemplateKeyLabel(template.key)}
      </Typography>
      <EmailTemplateForm template={template} placeholders={EMAIL_TEMPLATE_PLACEHOLDERS_PL[template.key] ?? []} />
      <RecordActivityTimeline entity="EmailTemplate" entityId={template.key} />
    </>
  );
}
