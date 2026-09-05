import { notFound } from 'next/navigation';
import { Chip, List, ListItem, ListItemText, Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import { uploadWarningMessage } from '@/content/pl/messages';
import { findDesignReviewForAdmin } from '@/server/repositories/admin-design-review';
import { DesignReviewDecisionForm } from '@/ui/islands/admin/DesignReviewDecisionForm';
import { RecordActivityTimeline } from '@/ui/islands/admin/RecordActivityTimeline';

type DesignReviewDetailPageProps = {
  readonly params: Promise<{ readonly designId: string }>;
};

export default async function AdminDesignReviewDetailPage({ params }: DesignReviewDetailPageProps) {
  const { designId } = await params;
  const design = await findDesignReviewForAdmin(designId);
  if (design === null) {
    notFound();
  }

  return (
    <>
      <Typography variant="h5" sx={{ mb: 1 }}>
        {design.originalName}
      </Typography>
      <Chip size="small" label={design.status} sx={{ mb: 3 }} />

      {design.mimeType.startsWith('image/') && design.mimeType !== 'image/svg+xml' ? (
        // biome-ignore lint/performance/noImgElement: a private, authorized customer upload - next/image's remote-loader config doesn't apply
        <img
          src={`/api/plik/${design.fileId}?preview=1`}
          alt={design.originalName}
          style={{ maxWidth: '100%', maxHeight: 400, display: 'block', marginBottom: 16 }}
        />
      ) : null}

      <a href={`/api/plik/${design.fileId}`}>{ADMIN.designReviewOriginalFilePl}</a>

      <Typography variant="h6" sx={{ mt: 4, mb: 1 }}>
        {ADMIN.designReviewWarningsHeadingPl}
      </Typography>
      {/*
        BUG-11: three states, not two. `null` is "never assessed" and must not
        read as a clean bill of health.
      */}
      {design.autoWarnings === null ? (
        <Typography color="warning.main">{ADMIN.designReviewNotAssessedPl}</Typography>
      ) : design.autoWarnings.length === 0 ? (
        <Typography color="text.secondary">{ADMIN.designReviewNoWarningsPl}</Typography>
      ) : (
        <List dense>
          {design.autoWarnings.map((warning, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: a fixed snapshot from the upload inspector, never reordered
            <ListItem key={index} disableGutters>
              <ListItemText primary={uploadWarningMessage(warning)} />
            </ListItem>
          ))}
        </List>
      )}

      {/*
        BUG-15. Only rendered when there is history: most designs are uploaded
        once, and an empty history heading on every one of them is noise that
        teaches a reviewer to stop reading the page.

        Each is a real link to the file. The customer's own link to it stopped
        working when they replaced it - this is the only place a superseded
        upload can still be opened, which is the whole point of keeping it.
      */}
      {design.previousFiles.length > 0 && (
        <>
          <Typography variant="h6" sx={{ mt: 4, mb: 1 }}>
            {ADMIN.designReviewPreviousFilesHeadingPl}
          </Typography>
          <List dense>
            {design.previousFiles.map((file) => (
              <ListItem key={file.fileId} disableGutters>
                <ListItemText
                  primary={
                    <a href={`/api/plik/${file.fileId}`}>
                      {ADMIN.designReviewPreviousFileLabelPl(
                        file.originalName,
                        file.supersededAt.toLocaleDateString('pl-PL'),
                      )}
                    </a>
                  }
                />
              </ListItem>
            ))}
          </List>
        </>
      )}

      <Typography variant="h6" sx={{ mt: 4, mb: 1 }}>
        {ADMIN.designReviewCommentsHeadingPl}
      </Typography>
      {design.comments.length === 0 ? (
        <Typography color="text.secondary">-</Typography>
      ) : (
        <List dense>
          {design.comments.map((comment) => (
            <ListItem key={comment.id} disableGutters>
              <ListItemText
                primary={comment.bodyPl}
                secondary={`${comment.authorType} - ${comment.createdAt.toLocaleString('pl-PL')}`}
              />
            </ListItem>
          ))}
        </List>
      )}

      <DesignReviewDecisionForm designId={design.id} />
      <RecordActivityTimeline entity="CustomerDesign" entityId={design.id} />
    </>
  );
}
