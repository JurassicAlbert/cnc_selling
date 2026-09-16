import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * The deployment files, checked as text.
 *
 * A Dockerfile, a compose file, an nginx config and a GitHub workflow only
 * ever run somewhere else, so the usual write-run-fix loop does not apply to
 * any of them - the same reasoning that gave `.github/workflows/ci.yml` its
 * own `ci-workflow.test.ts`. Every assertion below is something that fails
 * **silently and late**: not with an error at deploy time, but as a site that
 * is subtly wrong in production and fine everywhere else.
 */

const read = (file: string): string => readFileSync(path.resolve(process.cwd(), file), 'utf8');

describe('Dockerfile', () => {
  const dockerfile = read('Dockerfile');

  it('copies public/ and .next/static into the runner', () => {
    /*
      The failure this prevents is the classic one. Next's `output` reference
      states that standalone's `server.js` does NOT serve `public` or
      `.next/static` by itself. Miss either and the site comes up with no CSS
      and no images - which reads as a styling bug, and sends somebody into
      the stylesheet rather than the Dockerfile.
    */
    expect(dockerfile).toMatch(/COPY --from=builder[^\n]*\/app\/\.next\/static/);
    expect(dockerfile).toMatch(/COPY --from=builder[^\n]*\/app\/public/);
  });

  it('carries the Prisma CLI, because the entrypoint migrates with it', () => {
    // The standalone bundle contains only what the app imports at runtime,
    // and `prisma migrate deploy` is a CLI nothing imports. Without these the
    // container starts, fails its first line, and restart-loops.
    expect(dockerfile).toMatch(/node_modules\/\.bin\/prisma/);
    expect(dockerfile).toMatch(/node_modules\/prisma/);
  });

  it('runs as a non-root user that owns the upload directories', () => {
    expect(dockerfile).toMatch(/USER nextjs/);
    // Owning them matters as much as creating them: a volume mounted onto a
    // root-owned directory makes the first admin photo upload fail with
    // EACCES at runtime, long after the deploy reported success.
    expect(dockerfile).toMatch(/chown -R nextjs:nodejs public\/images/);
  });

  it('never defaults a build secret', () => {
    /*
      `ARG X` with no default is required; `ARG X=something` would bake a
      value into every image built without that argument, and the one that
      matters here - NEXT_SERVER_ACTIONS_ENCRYPTION_KEY - would then be a
      shared, public key protecting every Server Action closure.
    */
    const defaulted = dockerfile.match(/^ARG\s+\w+=.+$/gm) ?? [];
    expect(defaulted, `ARG with a default: ${defaulted.join(', ')}`).toEqual([]);
  });
});

describe('docker-compose.prod.yml', () => {
  const compose = read('docker-compose.prod.yml');

  it('mounts each upload kind separately, never public/images wholesale', () => {
    /*
      The single most destructive thing that could be written here. A volume
      at `/app/public/images` would shadow the 37 tracked files underneath it
      - every stock photo, the wordmark, the pattern artwork - and the site
      would launch with broken images everywhere, while the files sit intact
      inside the image where nobody thinks to look.
    */
    for (const kind of ['products', 'categories', 'materials', 'finishes', 'designs']) {
      expect(compose, `${kind} uploads are not persisted`).toContain(
        `/app/public/images/${kind}`,
      );
    }
    expect(compose).not.toMatch(/:\s*\/app\/public\/images\s*$/m);
  });

  it('keeps Postgres off the host network', () => {
    // `expose` publishes to the compose network only; `ports` would put the
    // database on the public internet, where it is found by a scanner within
    // the hour.
    const db = compose.slice(compose.indexOf('  db:'), compose.indexOf('  app:'));
    expect(db).toContain('expose:');
    expect(db, 'the database must not publish a port to the host').not.toMatch(/^\s+ports:/m);
  });

  it('waits for the database to be healthy before starting the app', () => {
    expect(compose).toMatch(/condition:\s*service_healthy/);
  });
});

describe('the reverse proxy', () => {
  const nginx = read('docker/nginx/app.conf');

  it('does not buffer, so streaming survives it', () => {
    /*
      The reason this file is not boilerplate. nginx buffers upstream
      responses by default, which holds a streamed render until it is
      complete: every `<Suspense>` boundary still "works", the page simply
      arrives all at once and later. There is no error and nothing in a log -
      the only symptom is that the performance work had no effect.
    */
    expect(nginx).toMatch(/proxy_buffering\s+off/);
    // Chunked transfer encoding needs HTTP/1.1, and nginx talks 1.0 upstream
    // by default, so without this streaming cannot work at all.
    expect(nginx).toMatch(/proxy_http_version\s+1\.1/);
  });

  it('allows a body as large as the app does', () => {
    // `next.config.ts` sets a 26mb Server Action limit for design uploads.
    // nginx defaults to 1m, so a large upload would be refused by the proxy
    // with a bare 413, never reaching the application's own error handling.
    expect(nginx).toMatch(/client_max_body_size\s+26m/);
  });

  it('forwards the original scheme', () => {
    // Without it the app believes every request arrived over http and builds
    // http:// links into emails and redirects.
    expect(nginx).toMatch(/X-Forwarded-Proto/);
  });
});

describe('the deploy workflow', () => {
  const workflow = read('.github/workflows/deploy.yml');

  it('waits for CI rather than racing it', () => {
    expect(workflow).toMatch(/workflow_run/);
    expect(workflow).toMatch(/conclusion == 'success'/);
  });

  it('deploys the commit CI tested, not whatever main points at now', () => {
    // Between CI finishing and this job starting, main can have moved. Using
    // the branch tip would deploy a commit nothing has verified.
    expect(workflow).toMatch(/workflow_run\.head_sha/);
  });

  it('verifies the host key instead of trusting it', () => {
    expect(workflow).toMatch(/DEPLOY_KNOWN_HOSTS/);

    /*
      Comments stripped before asserting, and the first draft did not do that
      - it failed against the workflow's own comment explaining why
      `StrictHostKeyChecking=no` is NOT used. A test that fails because a file
      discusses the mistake it avoids is a test people learn to ignore.
    */
    const executable = workflow
      .split('\n')
      .filter((line) => !line.trim().startsWith('#'))
      .join('\n');
    expect(executable, 'accepting any host key defeats the point of ssh here').not.toMatch(
      /StrictHostKeyChecking[= ]no/,
    );
  });

  it('never cancels a deploy in flight', () => {
    // Interrupting one mid-migration is how a database ends up half-migrated.
    expect(workflow).toMatch(/cancel-in-progress:\s*false/);
  });
});

describe('line endings', () => {
  /*
    A correctness matter, not tidiness. A shell script checked out with CRLF
    fails on Linux with `bad interpreter: /bin/sh^M`, and
    `docker/entrypoint.sh` runs on every container start - so the symptom
    would be a container that restart-loops before serving a request, for
    whoever happened to clone the repository on Windows, where
    `core.autocrlf=true` is the default.

    `.gitattributes` forces LF for these; this checks the working tree agrees,
    because a `.gitattributes` added after a file was already committed with
    CRLF does not retroactively fix that file.
  */
  it.each(['docker/entrypoint.sh', 'scripts/deploy.sh'])('%s has no carriage returns', (file) => {
    expect(read(file), `${file} would fail on Linux with "bad interpreter"`).not.toMatch(/\r/);
  });

  it('declares the rule, so a fresh clone cannot reintroduce it', () => {
    expect(read('.gitattributes')).toMatch(/\*\.sh\s+text\s+eol=lf/);
  });
});
