#!/usr/bin/env node
/**
 * Flags a Client Component that imports a **runtime value** out of
 * `@/server`.
 *
 * P2-11 called this "the pickup-point dataset ships to the browser", and the
 * size was the least of it: 2 647 bytes of sample data, genuinely harmless.
 * What the item was really pointing at is a boundary that lies. A file under
 * `src/server/` reads as server-only to anyone opening it, so the day somebody
 * adds an API key, a database read or a secret to one - and `pickup-points.ts`
 * is explicitly waiting to become a live InPost API client, `OPEN_ITEMS.md`
 * §3 - it lands in the browser bundle of every checkout, and nothing says no.
 *
 * **Three kinds of `@/server` import are fine and are not flagged:**
 *
 * - `import type`, and `import { type Foo }` - erased, nothing ships.
 * - `@/server/actions/*` - Server Actions are *meant* to be called from the
 *   client; that is the whole point of the thin `'use server'` wrapper layer
 *   (`docs/AUDIT-2026-08-30.md` P0-1).
 * - anything in a file with no `'use client'` directive.
 *
 * The remedy is never "import it anyway": pure logic the browser legitimately
 * needs belongs in `src/domain`, which exists precisely as the framework-free,
 * shareable layer. That is where `pickup-points` and `findUnavailableSelection`
 * both moved on 2026-09-11.
 *
 * A standalone script rather than a Biome rule, for the reason
 * `check-polish-literals.mjs` gives about its own check: this needs "does a
 * file carrying 'use client' import a runtime value from @/server", and
 * reading the file as text answers that directly.
 */

import { readFile } from 'node:fs/promises';
import fg from 'fast-glob';

const ALLOWED_PREFIX = '@/server/actions/';

/**
 * One import statement at a time.
 *
 * The clause deliberately forbids `;` and quote characters. An import
 * statement ends with `';`, so barring those stops a match that begins at one
 * statement and runs on to a later `from '@/server/...'`. The first version of
 * this script did exactly that and reported 45 violations where there are two,
 * with line numbers pointing at unrelated imports - a guard that cries wolf
 * being worse than no guard at all, which is T-32's own lesson.
 */
const IMPORT_PATTERN = /import\s+(type\s+)?([^;'"]*?)\s+from\s+'(@\/server\/[^']+)'/g;

/**
 * `import { type Foo, bar }` - the inline modifier. A clause whose every
 * specifier carries `type` is erased just as surely as `import type`.
 */
function everySpecifierIsAType(clause) {
  const inner = clause.trim().replace(/^\{/, '').replace(/\}$/, '').trim();
  if (inner.length === 0) {
    return true;
  }
  return inner
    .split(',')
    .map((specifier) => specifier.trim())
    .filter((specifier) => specifier.length > 0)
    .every((specifier) => /^type\s/.test(specifier));
}

async function main() {
  const files = await fg(['src/**/*.tsx', 'src/**/*.ts'], { dot: false });
  const violations = [];

  for (const file of files) {
    const source = await readFile(file, 'utf8');
    // Only a Client Component can ship an import to the browser.
    if (!/^\s*['"]use client['"]/m.test(source)) {
      continue;
    }

    for (const match of source.matchAll(IMPORT_PATTERN)) {
      const [, isType, clause, specifier] = match;
      if (isType !== undefined) {
        continue;
      }
      if (specifier.startsWith(ALLOWED_PREFIX)) {
        continue;
      }
      if (clause.trimStart().startsWith('{') && everySpecifierIsAType(clause)) {
        continue;
      }

      const lineNumber = source.slice(0, match.index).split('\n').length;
      violations.push({ file, lineNumber, specifier });
    }
  }

  if (violations.length === 0) {
    console.log(`check-client-server-imports: clean (${files.length} files scanned)`);
    return;
  }

  console.error(`check-client-server-imports: found ${violations.length} runtime import(s) of @/server in a Client Component:`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.lineNumber}  ${v.specifier}`);
  }
  console.error('');
  console.error('A Client Component may import from @/server only as `import type` (erased) or from');
  console.error('@/server/actions/ (a Server Action, which is meant to be called from the client).');
  console.error('Pure logic the browser needs belongs in src/domain - see P2-11.');
  process.exitCode = 1;
}

await main();
