#!/usr/bin/env node
/**
 * Flags a Polish string literal inside a component. All Polish copy belongs
 * in `src/content/pl` — that is not a translation convention here, it is
 * what keeps a "review the Polish copy" task a review of a handful of files
 * instead of a crawl through every component (ARCHITECTURE.md §4, §17.5).
 *
 * A standalone script, not a Biome/ESLint rule: Biome 2.x's GritQL plugin
 * system can express this, but it is still an early feature and the syntax
 * for "any string containing one of these nine characters" is not worth
 * fighting for a check this simple. Plain text scanning is not weaker here —
 * the check does not need an AST, only "does this file contain Polish text
 * outside an allowed spot", and reading the file as text answers that
 * directly.
 *
 * Heuristic, not exhaustive: it matches the nine Polish-specific diacritics
 * (ą ć ę ł ń ó ś ź ż, either case). That catches the large majority of real
 * Polish sentences — genuine Polish text with zero diacritic characters is
 * rare — but a diacritic-free Polish string (e.g. "Kontakt", "System") will
 * slip through. Precision was chosen over recall deliberately: flagging
 * English technical strings or CSS values too would train people to ignore
 * the warnings.
 *
 * Scope: every .ts/.tsx file under src/app and src/ui, except src/content/pl
 * itself (that IS where Polish belongs) and *.test.ts / *.spec.ts (test
 * descriptions are allowed to be readable). Import/export lines and comments
 * are skipped line-by-line rather than parsed, since paths and comments are
 * not customer-visible copy.
 */

import { readFile } from 'node:fs/promises';
import { relative, sep } from 'node:path';
import fg from 'fast-glob';

const POLISH_DIACRITICS = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/u;
const ROOT = process.cwd();

const SCAN_GLOBS = ['src/app/**/*.{ts,tsx}', 'src/ui/**/*.{ts,tsx}'];
const EXCLUDE_GLOBS = ['src/content/pl/**', '**/*.test.ts', '**/*.spec.ts'];

async function main() {
  const files = await fg(SCAN_GLOBS, {
    cwd: ROOT,
    ignore: EXCLUDE_GLOBS,
    absolute: true,
  });

  const violations = [];

  for (const file of files) {
    const text = await readFile(file, 'utf8');
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i] ?? '';
      const trimmed = line.trim();

      const isImportOrExportLine =
        trimmed.startsWith('import ') ||
        trimmed.startsWith('export ') ||
        trimmed.startsWith('} from ');
      const isCommentLine =
        trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*');

      if (isImportOrExportLine || isCommentLine) {
        continue;
      }

      if (POLISH_DIACRITICS.test(line)) {
        violations.push({
          file: relative(ROOT, file).split(sep).join('/'),
          lineNumber: i + 1,
          text: trimmed.slice(0, 80),
        });
      }
    }
  }

  if (violations.length === 0) {
    console.log(`check-polish-literals: clean (${files.length} files scanned)`);
    return;
  }

  console.error(`check-polish-literals: found ${violations.length} Polish literal(s):\n`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.lineNumber}  ${v.text}`);
  }
  console.error(
    '\nMove this text to src/content/pl and reference it by name — no Polish string ' +
      'literal belongs directly inside a component (ARCHITECTURE.md §4, §17.5).',
  );
  process.exitCode = 1;
}

await main();
