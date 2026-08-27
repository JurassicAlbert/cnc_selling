import { notFound } from 'next/navigation';
import { Stack, Typography } from '@mui/material';

import { findBlogPostForAdmin } from '@/server/repositories/admin-blog';
import { setBlogPostActive } from '@/server/actions/admin-blog';
import { ActiveToggleButton } from '@/ui/primitives/ActiveToggleButton';
import { BlogPostForm } from '@/ui/islands/admin/BlogPostForm';

type BlogPostDetailPageProps = {
  readonly params: Promise<{ readonly id: string }>;
};

export default async function AdminBlogPostDetailPage({ params }: BlogPostDetailPageProps) {
  const { id } = await params;
  const post = await findBlogPostForAdmin(id);
  if (post === null) {
    notFound();
  }

  return (
    <>
      <Stack direction="row" sx={{ mb: 3, justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5">{post.titlePl}</Typography>
        <ActiveToggleButton isActive={post.isActive} action={setBlogPostActive.bind(null, post.id, !post.isActive)} />
      </Stack>
      <BlogPostForm post={post} />
    </>
  );
}
