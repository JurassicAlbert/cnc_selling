/**
 * `docs/AI-CHECKLIST.md` UX-06 - a 404 must not be a dead end.
 *
 * Three boundaries (`[category]`, `produkt/[slug]`, `blog/[slug]`) rendered a
 * heading and the literal „404" and nothing else: no link home, no link to
 * the collections, no way on at all. The good body - `NotFoundContent`, whose
 * escape routes were each checked to be a real reachable page - existed the
 * whole time and was wired only to the generic group boundaries, so which of
 * the two a visitor got depended on how specific the missing thing was. The
 * more specific the miss, the worse the page.
 *
 * Enforced by reading the sources rather than by rendering them, for the same
 * reason `after-response.test.ts` scans instead of executing: these files are
 * one-liners that nobody looks at twice, and a new dynamic route arriving
 * with its own hand-rolled `not-found.tsx` is exactly how the split came
 * back the first time. The e2e spec (`tests/e2e/not-found.spec.ts`) asserts
 * the links are really there in a browser; this asserts that no boundary can
 * quietly stop routing through the component that provides them.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const APP_DIR = fileURLToPath(new URL('../../src/app', import.meta.url));

function walk(dir: string): readonly string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = `${dir}/${entry}`;
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const boundaries = walk(APP_DIR).filter((file) => file.endsWith('/not-found.tsx'));

/** A relative path reads better in a failure message than an absolute one. */
function relative(file: string): string {
  return file.slice(APP_DIR.length + 1);
}

describe('every not-found boundary offers a way out', () => {
  it('finds the boundaries at all, so a rename cannot make this vacuous', () => {
    expect(boundaries.length).toBeGreaterThanOrEqual(6);
  });

  it.each(boundaries.map((file) => [relative(file), file]))(
    '%s renders NotFoundContent',
    (_name, file) => {
      expect(readFileSync(file, 'utf8')).toContain('NotFoundContent');
    },
  );

  it.each(boundaries.map((file) => [relative(file), file]))(
    '%s does not fall back to a bare status number',
    (_name, file) => {
      // „404" as visible text told the visitor nothing they could act on, and
      // it is the tell that a boundary has stopped using the shared body.
      expect(readFileSync(file, 'utf8')).not.toMatch(/>\s*404\s*</);
    },
  );
});
