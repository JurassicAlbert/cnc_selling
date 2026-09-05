/**
 * `docs/AI-CHECKLIST.md` BUG-12 - post-response work used `void promise`.
 *
 * `void mailer.send(...)` starts a promise and forgets it. On a long-lived
 * Node server that is merely untidy: the process stays alive and the promise
 * settles. On a serverless platform - the Vercel target §18 names - the
 * invocation can be frozen or killed the moment the response is written, so
 * the order confirmation email a customer is waiting for may simply never be
 * sent, with nothing logged either way because the code that would log it
 * never ran.
 *
 * Next 16 has the primitive for this: `after()` from `next/server`, which on
 * serverless extends the invocation through the platform's `waitUntil` until
 * the work settles.
 *
 * **`after()` throws outside a request scope**, exactly like `cookies()` -
 * verified in `node_modules/next/dist/server/after/after.js`, which checks
 * for the work store and throws `E468` when there is none. So it cannot live
 * in `createOrder` or an `apply*`: those are called directly by this test
 * suite, and a framework API in them is what made `createOrder` untestable
 * the first time (its own header records `revalidatePath` being moved out
 * for exactly this reason).
 *
 * That gives the rule this file enforces, which is the same split the
 * `apply*`/wrapper pairs already use: **real logic in the operation,
 * framework side effects in the action**. It is enforced mechanically rather
 * than by convention because the failure is invisible - reintroducing `void`
 * breaks nothing locally and silently drops email in production.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SERVER_DIR = fileURLToPath(new URL('../../src/server', import.meta.url));

/** Comments discuss `void`; only code schedules with it. */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

function walk(dir: string): readonly string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = `${dir}/${entry}`;
    if (statSync(full).isDirectory()) {
      return walk(full);
    }
    return full.endsWith('.ts') ? [full] : [];
  });
}

/**
 * `void somethingAsync(...)` - a promise started and abandoned.
 *
 * Matches `void` followed by an identifier, which is the statement form. It
 * deliberately does **not** require the call parenthesis on the same line: the
 * first version of this did, and missed the `void mailer` in
 * `admin-orders.ts`, whose `.send(...)` sits on the next line, while catching
 * its neighbours. A guard that silently covers three of four sites is worse
 * than none, because it reads as coverage.
 *
 * A `void` type annotation never has a bare identifier after it (`: void {`,
 * `Promise<void>`, `: void =`), so those do not match.
 */
const FIRE_AND_FORGET = /(^|[\s;{}])void\s+[a-zA-Z_$]/;

describe('post-response work is scheduled, not abandoned (BUG-12)', () => {
  const files = walk(SERVER_DIR);

  it('finds the server modules at all - a scan that matched nothing would pass silently', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it.each(files.map((file) => [file.slice(SERVER_DIR.length + 1), file] as const))(
    '%s does not abandon a promise with `void`',
    (_name, file) => {
      const offending = withoutComments(readFileSync(file, 'utf8'))
        .split('\n')
        .filter((line) => FIRE_AND_FORGET.test(line));

      expect(
        offending,
        'Post-response work belongs in an action, scheduled with `after()` from `next/server`. ' +
          '`void` abandons the promise, and a serverless invocation can be killed before it settles.',
      ).toEqual([]);
    },
  );
});
