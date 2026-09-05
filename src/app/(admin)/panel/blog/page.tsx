import Link from 'next/link';
import { Button, Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import { listBlogPostsForAdmin } from '@/server/repositories/admin-blog';
import { BlogPostsDataGrid } from '@/ui/islands/admin/BlogPostsDataGrid';
import { EmptyState } from '@/ui/primitives/EmptyState';

export default async function AdminBlogPostsPage() {
  const posts = await listBlogPostsForAdmin();

  return (
    <>
      <Typography variant="h5" sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {ADMIN.blogPostsHeadingPl}
        <Link href="/panel/blog/nowy" style={{ textDecoration: 'none' }}>
          <Button variant="contained" size="small">
            {ADMIN.blogPostsNewPl}
          </Button>
        </Link>
      </Typography>

      {posts.length === 0 ? (
        <EmptyState message={ADMIN.blogPostsEmptyPl} actionLabel={ADMIN.blogPostsNewPl} actionHref="/panel/blog/nowy" />
      ) : (
        <BlogPostsDataGrid rows={posts} />
      )}
    </>
  );
}
