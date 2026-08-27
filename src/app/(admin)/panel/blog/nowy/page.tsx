import { Typography } from '@mui/material';

import { ADMIN } from '@/content/pl/admin';
import { BlogPostForm } from '@/ui/islands/admin/BlogPostForm';

export default function AdminNewBlogPostPage() {
  return (
    <>
      <Typography variant="h5" sx={{ mb: 3 }}>
        {ADMIN.blogPostsNewPl}
      </Typography>
      <BlogPostForm />
    </>
  );
}
