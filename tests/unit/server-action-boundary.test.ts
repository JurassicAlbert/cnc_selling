import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The security boundary this whole directory depends on, asserted
 * mechanically rather than by convention.
 *
 * In the App Router, EVERY exported async function in a `'use server'`
 * module is a publicly reachable HTTP endpoint — not just the ones a
 * component happens to import. Next.js's own documentation is explicit
 * that such a function must do its own authorization.
 *
 * This codebase's testability convention is an `applyXxx(actor, …)` /
 * `xxx(…)` pair: the wrapper derives the real actor from the session, the
 * `apply` half takes it as a parameter so an integration test can call it
 * without a request scope. That split is good — but only as long as the
 * `apply` half is NOT exported from a `'use server'` module. Exported from
 * one, it becomes an endpoint that accepts a FORGED actor: a request
 * carrying `{ role: 'ADMIN' }` as argument 1 gets admin privileges with no
 * authentication at all.
 *
 * That was a real, live hole in this codebase (~80 endpoints, including
 * staff-role changes, pricing publication and marking orders paid) found
 * by the 2026-08-30 audit — `docs/AUDIT-2026-08-30.md` P0-1. The fix moved
 * every `apply*` into `src/server/operations/`, a plain module directory
 * with no `'use server'` anywhere in it. This test is what stops it coming
 * back the next time someone adds an action the same way.
 */

const ACTIONS_DIR = fileURLToPath(new URL('../../src/server/actions', import.meta.url));

type ActionModule = {
  readonly fileName: string;
  readonly source: string;
};

function readActionModules(): readonly ActionModule[] {
  return readdirSync(ACTIONS_DIR)
    .filter((name) => name.endsWith('.ts'))
    .map((fileName) => ({
      fileName,
      source: readFileSync(`${ACTIONS_DIR}/${fileName}`, 'utf8'),
    }));
}

/** Every top-level `export async function NAME(` in a module, with the parameter list that follows it. */
function exportedFunctions(source: string): readonly { name: string; params: string }[] {
  const found: { name: string; params: string }[] = [];
  const pattern = /^export async function (\w+)\(([\s\S]*?)\)\s*:/gm;
  let match = pattern.exec(source);
  while (match !== null) {
    found.push({ name: match[1] ?? '', params: match[2] ?? '' });
    match = pattern.exec(source);
  }
  return found;
}

const modules = readActionModules();
const serverActionModules = modules.filter((module) => module.source.startsWith("'use server'"));

describe('server action boundary', () => {
  it('finds the real action modules (guards against this test silently scanning nothing)', () => {
    expect(serverActionModules.length).toBeGreaterThan(10);
  });

  it('exports no `apply*` function from any `use server` module', () => {
    const offenders = serverActionModules.flatMap((module) =>
      exportedFunctions(module.source)
        .filter((fn) => fn.name.startsWith('apply'))
        .map((fn) => `${module.fileName} → ${fn.name}`),
    );
    expect(offenders).toEqual([]);
  });

  it('never accepts a session/actor object as an action parameter', () => {
    const offenders = serverActionModules.flatMap((module) =>
      exportedFunctions(module.source)
        .filter((fn) => /\bCurrentSession\b/.test(fn.params))
        .map((fn) => `${module.fileName} → ${fn.name}`),
    );
    expect(offenders).toEqual([]);
  });

  /**
   * The same hole in its customer-facing shape: an action taking the
   * CALLER's own id as a parameter will act as whoever the caller names.
   *
   * A parameter naming the SUBJECT of the mutation is a different thing
   * and stays allowed — `anonymizeCustomer(userId)` and
   * `changeStaffRole(userId, role)` both name whose record is being
   * changed, and both still derive the acting admin from the session
   * before touching it. The names below are the ones that specifically
   * mean "who is asking", which is exactly the fact a client must never
   * get to assert.
   */
  it('never accepts the caller’s own identity as an action parameter', () => {
    const offenders = serverActionModules.flatMap((module) =>
      exportedFunctions(module.source)
        .filter((fn) => /\b(sessionUserId|actorId|actorUserId|currentUserId|staffId|adminId)\s*:/.test(fn.params))
        .map((fn) => `${module.fileName} → ${fn.name}`),
    );
    expect(offenders).toEqual([]);
  });
});
