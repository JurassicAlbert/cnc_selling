-- Runs once, on first `docker compose up -d db` (empty data volume only).
-- If you change this file after the volume exists, run `docker compose down -v`
-- to recreate the cluster — Postgres will not re-run init scripts otherwise.

-- Separate database for the integration suite. Tests truncate and roll back;
-- pointing them at the development database would delete the catalogue you
-- were just looking at in the browser.
CREATE DATABASE cnc_selling_test OWNER cnc;

-- Diacritic-insensitive search ("dab" finds "dąb") — ARCHITECTURE.md §17.3.
-- Created in both databases; extensions are per-database, not per-cluster.
\connect cnc_selling
CREATE EXTENSION IF NOT EXISTS unaccent;

\connect cnc_selling_test
CREATE EXTENSION IF NOT EXISTS unaccent;
