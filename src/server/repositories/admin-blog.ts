/** Admin blog-post queries - unscoped by `isActive`/`publishedAt`, unlike `blog.ts`'s public `listPublishedBlogPosts`. Every caller here MUST go through `requireStaffSession()` first. */

import { prisma } from '@/server/db/client';

export type AdminBlogPostListItem = {
  readonly id: string;
  readonly slug: string;
  readonly titlePl: string;
  readonly isActive: boolean;
  readonly publishedAt: Date | null;
};

export async function listBlogPostsForAdmin(): Promise<readonly AdminBlogPostListItem[]> {
  return prisma.blogPost.findMany({
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    select: { id: true, slug: true, titlePl: true, isActive: true, publishedAt: true },
  });
}

export type AdminBlogPostDetail = {
  readonly id: string;
  readonly slug: string;
  readonly titlePl: string;
  readonly shortDescPl: string;
  readonly bodyPl: string;
  readonly seoTitlePl: string;
  readonly seoDescPl: string;
  readonly imageUrl: string | null;
  readonly isActive: boolean;
  readonly sortOrder: number;
  readonly publishedAt: Date | null;
};

export async function findBlogPostForAdmin(id: string): Promise<AdminBlogPostDetail | null> {
  return prisma.blogPost.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      titlePl: true,
      shortDescPl: true,
      bodyPl: true,
      seoTitlePl: true,
      seoDescPl: true,
      imageUrl: true,
      isActive: true,
      sortOrder: true,
      publishedAt: true,
    },
  });
}
