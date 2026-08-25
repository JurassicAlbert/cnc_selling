import { prisma } from '@/server/db/client';

export type BlogPostSummary = {
  readonly slug: string;
  readonly titlePl: string;
  readonly shortDescPl: string;
  readonly imageUrl: string | null;
  readonly publishedAt: Date;
};

/** Published means `isActive` and `publishedAt` is set and not in the future — a null `publishedAt` is a draft. */
export async function listPublishedBlogPosts(): Promise<BlogPostSummary[]> {
  const posts = await prisma.blogPost.findMany({
    where: { isActive: true, publishedAt: { not: null, lte: new Date() } },
    orderBy: { publishedAt: 'desc' },
    select: { slug: true, titlePl: true, shortDescPl: true, imageUrl: true, publishedAt: true },
  });
  return posts.map((post) => ({ ...post, publishedAt: post.publishedAt as Date }));
}

export type BlogPostDetail = BlogPostSummary & {
  readonly bodyPl: string;
  readonly seoTitlePl: string;
  readonly seoDescPl: string;
};

export async function getPublishedBlogPostBySlug(slug: string): Promise<BlogPostDetail | null> {
  const post = await prisma.blogPost.findFirst({
    where: { slug, isActive: true, publishedAt: { not: null, lte: new Date() } },
    select: {
      slug: true,
      titlePl: true,
      shortDescPl: true,
      bodyPl: true,
      imageUrl: true,
      seoTitlePl: true,
      seoDescPl: true,
      publishedAt: true,
    },
  });
  if (post === null) {
    return null;
  }
  return { ...post, publishedAt: post.publishedAt as Date };
}

/** Every published post slug, for the sitemap. */
export async function listAllPublishedBlogPostSlugs(): Promise<string[]> {
  const posts = await prisma.blogPost.findMany({
    where: { isActive: true, publishedAt: { not: null, lte: new Date() } },
    select: { slug: true },
  });
  return posts.map((p) => p.slug);
}
