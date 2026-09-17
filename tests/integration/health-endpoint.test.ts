import { describe, expect, it } from 'vitest';

import { GET } from '@/app/api/health/route';

/**
 * The endpoint a deploy and a container healthcheck ask "are you actually
 * working?".
 *
 * Added 2026-09-16 with the Docker deployment. `scripts/deploy.sh` polls it
 * after replacing the container, because a deploy that reports success and
 * leaves a site returning 502 is the failure mode most worth ruling out, and
 * `docker-compose.prod.yml` restarts the app on it.
 *
 * **It checks the database, not just the process.** A Next server answers
 * `200` on a static route long before it can serve a page: every storefront
 * page reads the catalogue, so a process that is up with no database is not
 * healthy, it is a site that returns 500 to every visitor. Checking only that
 * the process responds would make the healthcheck actively misleading - it
 * would hold a broken deployment up as a good one.
 *
 * **It says almost nothing.** This route is unauthenticated and reachable
 * from the internet, so it must not become a free reconnaissance endpoint:
 * no version, no schema, no migration state, no connection string, no error
 * text. „ok" or a 503 is the entire contract. The detail belongs in the
 * container's logs, which are already structured.
 */
describe('GET /api/health', () => {
  it('answers 200 when the database is reachable', async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'ok' });
  });

  it('is never cached', async () => {
    /*
      A cached healthcheck is worse than none: it would keep reporting the
      last good answer while the thing it describes is down, which is exactly
      when somebody is relying on it.
    */
    const response = await GET();

    expect(response.headers.get('cache-control')).toMatch(/no-store/);
  });

  it('leaks nothing about the deployment', async () => {
    const response = await GET();
    const body = JSON.stringify(await response.json());

    // Exactly one key, and a constant value.
    expect(Object.keys(JSON.parse(body))).toEqual(['status']);
    expect(body).not.toMatch(/postgres|prisma|version|migration|\d+\.\d+\.\d+/i);
  });
});
