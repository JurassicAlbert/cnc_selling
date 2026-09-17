#!/bin/sh
# Container entrypoint: bring the schema up to date, then hand over to Next.
#
# `set -e` matters here. Without it a failed migration would be logged and the
# server would start anyway, against a database whose shape the code no longer
# matches - which fails later, per-request, as confusing 500s rather than as a
# deploy that refused.
set -e

echo "[entrypoint] applying migrations"
# `migrate deploy`, never `migrate dev`: deploy applies existing migrations and
# nothing else, while dev can generate a new one and, on drift, offers to reset
# the database. On production data that is unrecoverable.
./node_modules/.bin/prisma migrate deploy

# Seeding is NOT run here, deliberately. `prisma/seed.ts` creates the first
# admin and the owner's catalogue; running it on every container start would
# fight with real edits, and `upsert ... update: {}` means it silently would
# not repair them anyway (docs/AI-CHECKLIST.md T-37). First-time seeding is an
# explicit, separate step - see docs/DEPLOYMENT.md.

echo "[entrypoint] starting ${*}"
exec "$@"
