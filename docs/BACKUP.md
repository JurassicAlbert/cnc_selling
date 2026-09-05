# Backup strategy

`docs/CHECKLIST.md`'s own "Backup strategy documented" line. This is the
honest state of backups today (none - correctly, for a local dev
environment) plus a concrete, actionable plan for before this goes to
production, not a generic checklist copied from elsewhere.

## What actually needs backing up

Two things hold data that cannot be regenerated:

1. **The Postgres database** (`docker-compose.yml`'s `db` service in dev;
   whatever replaces it in production). Every order, customer account,
   catalogue row, audit log entry, and pricing version lives here. This is
   the one that matters most - losing an order is a real customer and
   business problem, not an inconvenience.
2. **Uploaded files** - customer-submitted custom-design uploads
   (`CustomerDesign`/`UploadedFile`) and staff-uploaded catalogue images
   (material/finish/design photos). Currently served by
   `src/server/storage/local-disk.ts`, whose own header comment already
   says what it is: "Dev/MVP implementation... not meant for production
   (no redundancy, no CDN, single-instance-only)." `src/server/storage/
   file-storage.ts`'s `FileStorage` interface exists specifically so a
   real S3-compatible adapter can replace it later without touching any
   calling code - that adapter is **not built yet** (§14 of
   `docs/ARCHITECTURE.md` lists it as prod's job, correctly not attempted
   in this MVP pass). A customer's custom-uploaded design file is the one
   truly irreplaceable artifact in this whole system - it cannot be
   regenerated from the database if lost, unlike a catalogue photo a
   staff member could re-upload.

What does **not** need a backup strategy: `uploads-dev/` itself
(gitignored, disposable local dev data by design) and the Docker Postgres
volume in dev (`docker compose down -v` intentionally destroys it - the
compose file's own header comment says so). Nothing in local development
is meant to survive being deleted; that is what "dev" means here.

## Current state, honestly

**No backups exist today, and that's correct for this project's current
phase.** There is no chosen production hosting target yet (no cloud
provider, no managed Postgres, no S3 bucket configured anywhere in this
repo - confirmed by grep, not assumed) - writing a specific `pg_dump`
cron job today would be automating a backup of throwaway local
`cnc_selling_db` container data, which is actively wrong: the compose
file already documents that destroying that data on purpose
(`docker compose down -v`) is expected, normal developer behavior.
Backups are a production concern, and there is no production yet.

## Before launch: what to actually set up

### Database

- **If a managed Postgres provider is chosen** (RDS, Supabase, Neon,
  Railway, Fly Postgres, Cloud SQL, etc.) - use its built-in automated
  backup/point-in-time-recovery feature instead of building a parallel
  one. Every major managed provider does continuous backup with a
  retention window and PITR restore as a checkbox, and re-implementing
  that worse, by hand, is wasted effort with a worse failure mode. Verify
  the specific provider's PITR window covers the RPO target below before
  relying on it.
- **If self-hosting Postgres** (a VPS, a Docker container in production,
  etc.) - the concrete, minimum-viable setup:
  1. Nightly `pg_dump --format=custom` (not plain SQL - `--format=custom`
     compresses and allows selective/parallel restore) to a location
     **off the database host** - a separate object-storage bucket, not a
     second directory on the same disk. A backup that dies with the
     server it's backing up is not a backup.
  2. WAL archiving (`archive_mode = on` + `archive_command` shipping WAL
     segments to the same off-host location) if the RPO target below
     needs sub-24-hour granularity - a nightly dump alone only ever
     recovers to last night.
  3. Retention: keep daily dumps for 30 days, monthly dumps for 12
     months, adjust once real usage patterns and storage cost are known.
  4. Encrypt backups at rest - this database contains customer PII
     (names, addresses, order history) subject to RODO, same as the
     live database itself.

### File storage

- Once the S3-compatible `FileStorage` adapter exists: enable the
  bucket's own versioning and cross-region (or cross-provider) replication
  - this is normally a checkbox on the bucket, not custom code.
- Until then: **uploaded customer design files have zero redundancy in
  any environment this app currently runs in.** This is a real,
  currently-true production risk, named plainly rather than glossed over
  - not a defect in this MVP pass (the S3 adapter is explicitly out of
  scope per `docs/ARCHITECTURE.md` §14), but a concrete blocker to
  resolve before real customer uploads depend on this system.

### Targets (adjust with the business, not invented precision)

- **RPO** (how much data a restore can lose): ≤ 24 hours via nightly
  `pg_dump`, or minutes via WAL/managed-provider PITR if the business
  can't tolerate losing a day of orders - reasonable for a small
  made-to-order operation to start with the 24-hour target and tighten
  later if order volume justifies it.
- **RTO** (how long a restore takes): a few hours is reasonable for an
  operation this size - restoring a `pg_dump --format=custom` to a fresh
  instance and re-pointing `DATABASE_URL` is normally the bulk of the
  work, not a multi-day project.

### Restore testing

A backup that has never been restored is unverified, not safe. Quarterly:
restore the latest dump into a scratch database (`cnc_selling_restore_test`
alongside dev/test, matching this repo's own existing convention of
separate throwaway databases - see `docker-compose.yml`'s own `cnc_selling`
vs `cnc_selling_test` split) and confirm the app can actually start
against it. This is cheap to do and the only way to know the backup
mechanism itself isn't silently broken.

## Who owns this

Not decided yet - there is no operations team defined in this repo. Note
here, honestly, rather than inventing an owner: whoever picks the
production hosting provider should set up that provider's backup
mechanism (or the self-hosted recipe above) as part of that same
decision, not as a separate afterthought task.
