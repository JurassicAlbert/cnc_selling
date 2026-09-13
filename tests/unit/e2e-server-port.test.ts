import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * The e2e server must not share a port with the development server.
 *
 * **This is a hole ARCH-03 left open, and it was walked into on 2026-09-13.**
 *
 * ARCH-03's mechanism is right and works: `playwright.config.ts` rewrites
 * `process.env.DATABASE_URL` to `TEST_DATABASE_URL` at module load, before
 * the `webServer` starts, and `global-setup.ts` refuses outright if the name
 * does not end in `_test`. Both did their job every time Playwright started
 * its own server.
 *
 * What neither covers is `reuseExistingServer: !process.env.CI`. **An
 * already-running server is adopted exactly as it is**, with whatever
 * database *it* was started with - the env override never applies to a
 * process Playwright did not spawn, and the guard in `global-setup.ts` checks
 * the runner's own environment, not the server's.
 *
 * So starting `next dev` on :3000 to look at a page, and then running the
 * suite, points 190 tests at the **development** database. That is not
 * hypothetical: it wrote **93 rows** into it - 10 users, 4 orders, 39
 * configurations, 38 carts - before the run was stopped. It is also, almost
 * certainly, how that database came to hold 259 orders and the leftover
 * fixtures recorded as T-35, and `security-headers.spec.ts` had already
 * written the scenario down („a developer with `next dev` already on :3000")
 * as a thing to tolerate rather than prevent.
 *
 * **The tell is subtle and easy to miss**, which is why a guard is worth more
 * than care: the run looks completely normal, `global-setup.ts` prints
 * „using cnc_selling_test" (truthfully - that is the *runner's* connection),
 * and the only sign is that the log has **zero `[WebServer]` lines**. T-25
 * records exactly that check, and it still takes remembering to make it.
 *
 * A separate port removes the possibility instead of documenting it: nothing
 * but the e2e config's own server ever listens there, so `reuseExistingServer`
 * can only ever adopt a server this config started - which is the thing it
 * was meant to do.
 *
 * Asserted by reading the files rather than importing them, deliberately:
 * importing `playwright.config.ts` would execute its `DATABASE_URL` rewrite
 * inside the vitest process, and a test that repoints the database out from
 * under its neighbours is a worse bug than the one it guards.
 */
const repoRoot = process.cwd();

function portsIn(file: string): number[] {
  const text = readFileSync(path.join(repoRoot, file), 'utf8');
  return [...text.matchAll(/localhost:(\d{4,5})|"port":\s*(\d{4,5})|--port['"\s,]+(\d{4,5})/g)].map((match) =>
    Number(match[1] ?? match[2] ?? match[3]),
  );
}

describe('the e2e server cannot adopt the development server', () => {
  it('does not listen on any port the launch configuration uses', () => {
    const e2ePorts = new Set(portsIn('playwright.config.ts'));
    const devPorts = new Set(portsIn('.claude/launch.json'));

    expect(e2ePorts.size).toBeGreaterThan(0);
    expect(devPorts.size).toBeGreaterThan(0);

    const shared = [...e2ePorts].filter((port) => devPorts.has(port));
    expect(
      shared,
      `the e2e server and a launch.json server share port ${shared.join(', ')} - a running dev server will be adopted, and the suite will run against whatever database it was started with`,
    ).toEqual([]);
  });

  it('points its baseURL and its webServer at the same port', () => {
    // A mismatch here would be a quieter version of the same bug: tests
    // talking to one server while Playwright waits on another.
    const ports = portsIn('playwright.config.ts');
    expect(new Set(ports).size).toBe(1);
  });
});
