/**
 * `docs/REVIEW-DETAILED.md` ARCH-01 - until 2026-08-31 there was no CI at
 * all: no `.github/workflows`, no hooks, and `playwright.config.ts` reading
 * a `process.env.CI` that nothing ever set. A project this disciplined about
 * TDD ran its whole suite only when a human remembered to.
 *
 * These tests exist because **a broken workflow cannot fail locally.** It is
 * a file that only ever executes somewhere else, so the usual feedback loop
 * - write it, run it, see it break - does not apply. The two failure modes
 * worth catching here are the ones that produce a *green* run rather than a
 * red one:
 *
 * - a step invoking an npm script that has been renamed or removed, and
 * - the integration tier running without `TEST_DATABASE_URL`, which
 *   `tests/integration/env-setup.ts` deliberately does not throw on (unit
 *   tests must keep working with no database configured), so the tests
 *   would quietly run against whatever `DATABASE_URL` points at instead.
 *
 * Parsing rather than string-matching, because a workflow that does not
 * parse is the one error GitHub reports only after a push.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

const workflowSource = readFileSync(`${repoRoot}/.github/workflows/ci.yml`, 'utf8');
const packageJson = JSON.parse(readFileSync(`${repoRoot}/package.json`, 'utf8')) as {
  scripts: Record<string, string>;
  engines: { node: string };
};

type Step = { readonly run?: string; readonly uses?: string; readonly with?: Record<string, unknown> };
type Job = {
  readonly 'runs-on'?: string;
  readonly steps?: readonly Step[];
  readonly services?: Record<string, { readonly image?: string }>;
  readonly env?: Record<string, string>;
};
type Workflow = {
  readonly name?: string;
  readonly on?: unknown;
  readonly jobs: Record<string, Job>;
};

const workflow = parse(workflowSource) as Workflow;

function stepsOf(job: Job): readonly Step[] {
  return job.steps ?? [];
}

function runLinesOf(job: Job): readonly string[] {
  return stepsOf(job)
    .flatMap((step) => (step.run ?? '').split('\n'))
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/** Every `npm run <name>` / `npm <name>` a job invokes. */
function npmScriptsOf(job: Job): readonly string[] {
  return runLinesOf(job).flatMap((line) => {
    const script = /\bnpm (?:run |run-script )?([a-z][a-z0-9:-]*)/.exec(line)?.[1];
    // `npm ci` / `npm install` are npm's own commands, not package scripts.
    if (script === undefined || script === 'ci' || script === 'install') {
      return [];
    }
    return [script];
  });
}

const jobs = Object.entries(workflow.jobs);

describe('CI workflow - it parses and it is wired to this repository', () => {
  it('is valid YAML defining at least one job', () => {
    expect(jobs.length).toBeGreaterThan(0);
  });

  it('runs on pushes to main and on pull requests', () => {
    // YAML 1.1 folds a bare `on` into the boolean true; the `yaml` package
    // defaults to 1.2, where it stays a string. Accept either so this test
    // pins the workflow's behaviour, not the parser's version.
    const triggers = (workflow.on ?? (workflow as unknown as Record<string, unknown>)[String(true)]) as {
      push?: { branches?: string[] };
      pull_request?: unknown;
    };

    expect(triggers).toBeDefined();
    expect(triggers.push?.branches).toContain('main');
    expect('pull_request' in triggers).toBe(true);
  });

  it('invokes only npm scripts that actually exist', () => {
    const defined = Object.keys(packageJson.scripts);
    const invoked = [...new Set(jobs.flatMap(([, job]) => npmScriptsOf(job)))];

    expect(invoked.length).toBeGreaterThan(0);
    for (const script of invoked) {
      expect(defined, `workflow runs "npm run ${script}", which package.json does not define`).toContain(
        script,
      );
    }
  });

  it('uses a Node version this package supports', () => {
    const versions = jobs
      .flatMap(([, job]) => stepsOf(job))
      .filter((step) => step.uses?.startsWith('actions/setup-node') === true)
      .map((step) => String(step.with?.['node-version'] ?? ''));

    expect(versions.length).toBeGreaterThan(0);
    const minimum = Number(/(\d+)/.exec(packageJson.engines.node)?.[1]);
    for (const version of versions) {
      expect(Number(version.replace(/[^\d.]/g, '').split('.')[0])).toBeGreaterThanOrEqual(minimum);
    }
  });
});

describe('CI workflow - the verification the Definition of Done names', () => {
  const allScripts = jobs.flatMap(([, job]) => npmScriptsOf(job));

  it.each(['typecheck', 'lint', 'test', 'build'])('runs npm run %s', (script) => {
    expect(allScripts).toContain(script);
  });
});

describe('CI workflow - the database the tests actually need', () => {
  function jobRunning(script: string): [string, Job] {
    const found = jobs.find(([, job]) => npmScriptsOf(job).includes(script));
    if (found === undefined) {
      throw new Error(`no job runs "npm run ${script}"`);
    }
    return found;
  }

  it('gives every job that touches Postgres a service container matching docker-compose', () => {
    // docker-compose.yml pins postgres:16-alpine. A CI image on a different
    // major would test against a database the project does not run.
    const compose = readFileSync(`${repoRoot}/docker-compose.yml`, 'utf8');
    const composeImage = /image:\s*(\S+)/.exec(compose)?.[1];

    const images = jobs
      .flatMap(([, job]) => Object.values(job.services ?? {}))
      .map((service) => service.image);

    expect(images.length).toBeGreaterThan(0);
    for (const image of images) {
      expect(image).toBe(composeImage);
    }
  });

  it('sets TEST_DATABASE_URL wherever npm test runs', () => {
    // The silent-failure guard. `tests/integration/env-setup.ts` does not
    // throw when this is missing - by design, so `tests/unit` works with no
    // database at all - which means a CI job without it would run the whole
    // integration tier against DATABASE_URL and still report success.
    const [name, job] = jobRunning('test');
    expect(Object.keys(job.env ?? {}), `job "${name}" has no TEST_DATABASE_URL`).toContain(
      'TEST_DATABASE_URL',
    );
    expect(job.env?.TEST_DATABASE_URL).not.toBe(job.env?.DATABASE_URL);
  });

  it('migrates and seeds both databases before running anything against them', () => {
    const [, job] = jobRunning('test');
    const scripts = npmScriptsOf(job);

    expect(scripts).toContain('db:deploy');
    expect(scripts).toContain('db:deploy:test');
    expect(scripts).toContain('db:seed');
    expect(scripts).toContain('db:seed:test');

    // Ordering matters: the sweep tests (`offered-is-buildable`,
    // `starting-price`) iterate every active product, so an unseeded test
    // database makes them pass vacuously.
    const order = npmScriptsOf(job);
    expect(order.indexOf('db:seed:test')).toBeLessThan(order.indexOf('test'));
    expect(order.indexOf('db:deploy:test')).toBeLessThan(order.indexOf('db:seed:test'));
  });

  it('seeds the TEST database in the e2e job, not the development one', () => {
    /*
      ARCH-03, 2026-09-05. `playwright.config.ts` points DATABASE_URL at
      TEST_DATABASE_URL for the whole run, including the `next build && next
      start` it launches - so the e2e job has to migrate and seed *that*
      database.

      Worth pinning because reverting it fails in a way that is easy to
      misread: `tests/e2e/global-setup.ts` would still pass (both URLs are
      set in CI), and instead every single spec would fail against an empty
      schema, which reads like the application is broken rather than like the
      wrong database was prepared.
    */
    const [, job] = jobRunning('e2e');
    const scripts = npmScriptsOf(job);

    expect(scripts).toContain('db:deploy:test');
    expect(scripts).toContain('db:seed:test');

    const order = npmScriptsOf(job);
    expect(order.indexOf('db:seed:test')).toBeLessThan(order.indexOf('e2e'));
    expect(order.indexOf('db:deploy:test')).toBeLessThan(order.indexOf('db:seed:test'));
  });

  it('never hands a Prisma connection URL to psql', () => {
    /*
      The first CI run ever to execute, 2026-09-05, failed on its very first
      database step:

          psql: error: invalid URI query parameter: "schema"

      `DATABASE_URL` ends in `?schema=public`, which is Prisma's own
      parameter. libpq parses a connection URI strictly and rejects anything
      it does not recognise, so `psql "$DATABASE_URL"` cannot work - and no
      local run had ever executed that line, because locally the same SQL is
      applied by the Postgres container's own init directory on first boot.

      This is precisely the class of bug this file exists for: a workflow step
      that only ever runs somewhere else. Reproduced before fixing, with the
      real client:

          docker exec cnc_selling_db psql "postgresql://.../cnc_selling?schema=public" -c "select 1"
          -> psql: error: invalid URI query parameter: "schema"
          docker exec cnc_selling_db psql "postgresql://.../cnc_selling"      -c "select 1"
          -> 1 row
    */
    const psqlLines = Object.values(workflow.jobs)
      .flatMap((job) => runLinesOf(job))
      .filter((line) => line.includes('psql'));

    expect(psqlLines.length).toBeGreaterThan(0);
    for (const line of psqlLines) {
      expect(line, `psql cannot parse a Prisma URL: ${line}`).not.toMatch(/\$\{?(TEST_)?DATABASE_URL/);
    }
  });

  it('sets the secrets the app refuses to start without', () => {
    // `auth.ts` and `guest-session.ts` throw on a missing value, and
    // `prisma/seed.ts` throws without SEED_ADMIN_EMAIL - all at import or
    // build time, so a missing one fails the build rather than a test.
    const [, job] = jobRunning('build');
    const env = Object.keys(job.env ?? {});

    for (const name of ['BETTER_AUTH_SECRET', 'SESSION_SECRET', 'SEED_ADMIN_EMAIL']) {
      expect(env).toContain(name);
    }
  });
});
