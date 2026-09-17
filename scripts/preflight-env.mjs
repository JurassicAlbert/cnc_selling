/**
 * Check an environment file against the production manifest.
 *
 *   node scripts/preflight-env.mjs .env.production
 *
 * Exits non-zero when something is missing or dangerous, so it can gate a
 * release. Prints every problem at once: fix-one-rerun-discover-the-next
 * turns a first deploy into an evening.
 *
 * Reads a file rather than `process.env` on purpose. The thing being checked
 * is the file that will be shipped to the server, and checking the shell that
 * happens to be running the script answers a different question.
 */

import { readFileSync } from 'node:fs';

import { DEPLOY_ENV, checkDeployEnv } from './deploy-env.mjs';

/**
 * A deliberately small parser: `KEY=value`, `#` comments, optional quotes.
 *
 * Not `dotenv`, because this must run on a server where `node_modules` may
 * not exist yet - the whole point is to check the configuration *before*
 * anything is built.
 */
function parseEnvFile(text) {
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    const equals = trimmed.indexOf('=');
    if (equals === -1) continue;
    const key = trimmed.slice(0, equals).trim();
    let value = trimmed.slice(equals + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const path = process.argv[2] ?? '.env.production';

let text;
try {
  text = readFileSync(path, 'utf8');
} catch {
  console.error(`preflight: cannot read ${path}`);
  console.error('');
  console.error('This file holds the production configuration and is never committed.');
  console.error('Create it from the manifest below, then run this again.');
  console.error('');
  for (const entry of DEPLOY_ENV) {
    if (entry.level === 'required') console.error(`  ${entry.name}=`);
  }
  process.exit(1);
}

const { ok, errors, warnings } = checkDeployEnv(parseEnvFile(text), { target: 'production' });

for (const warning of warnings) {
  console.warn(`  warn   ${warning}`);
}
for (const error of errors) {
  console.error(`  ERROR  ${error}`);
}

if (!ok) {
  console.error('');
  console.error(`preflight: ${errors.length} problem(s) in ${path}. Nothing was deployed.`);
  process.exit(1);
}

console.log(
  warnings.length === 0
    ? `preflight: ${path} is complete.`
    : `preflight: ${path} is usable, with ${warnings.length} thing(s) deliberately not configured.`,
);
