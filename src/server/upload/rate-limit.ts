import { prisma } from '@/server/db/client';

/**
 * §16.1: "Rate limits: uploads per session/hour" - no rate-limit model or
 * library is named anywhere in the spec (checked: no `RateLimit` model in
 * the schema, nothing in `ARCHITECTURE.md`). Implemented as a plain count
 * query against `UploadedFile` rows already written in the last hour for
 * this session/user, rather than adding new infrastructure (Redis, an
 * in-memory limiter) this project has no other need for. Trade-off,
 * stated plainly: this doesn't coordinate across multiple app instances -
 * fine at this project's actual scale (a single dev/small-prod deployment
 * with no horizontal scaling anywhere else in the stack either), not
 * something to silently assume works differently.
 */
const MAX_UPLOADS_PER_HOUR = 10;
const ONE_HOUR_MS = 60 * 60 * 1000;

export async function isUploadRateLimited(actor: { sessionToken: string | null; userId: string | null }): Promise<boolean> {
  if (actor.sessionToken === null && actor.userId === null) {
    // No identity at all to rate-limit by - callers must have already
    // rejected this request for lacking ownership before reaching here.
    return true;
  }

  const since = new Date(Date.now() - ONE_HOUR_MS);
  const count = await prisma.uploadedFile.count({
    where: {
      createdAt: { gte: since },
      ...(actor.userId !== null ? { userId: actor.userId } : { sessionToken: actor.sessionToken }),
    },
  });

  return count >= MAX_UPLOADS_PER_HOUR;
}
