# VerSans Render Postgres Migration Design

## Goal
Move all relational application data currently stored in `data/versans.sqlite` to Render PostgreSQL without changing public behavior or losing any row, ID, password hash, session, order, review, or review media byte.

## Scope
The migration covers SQLite tables `users`, `sessions`, `orders`, `reviews`, `review_images`, and `schema_meta`. Review images/videos stored as SQLite BLOBs move to PostgreSQL `BYTEA` unchanged. Existing greeting-card PNGs are not part of the SQLite database; the greeting editor's current Google Drive/IndexedDB storage remains unchanged by this database migration.

## Architecture
Add an asynchronous database-store abstraction. The server selects PostgreSQL whenever `DATABASE_URL` is set and otherwise uses SQLite as a local-development/fallback backend. Both implementations expose the same application-level methods, keeping HTTP/API behavior unchanged.

PostgreSQL schema mirrors the existing SQLite columns and constraints closely. Integer primary keys are identity columns but accept explicit IDs during migration. Epoch-millisecond fields use `BIGINT`; binary review media uses `BYTEA`; email uniqueness is enforced case-insensitively with a unique index on `LOWER(email)`.

A dedicated migration command reads the existing SQLite file, initializes PostgreSQL, copies rows in foreign-key-safe order inside a transaction, resets identity sequences, then compares row counts and deterministic SHA-256 table digests between source and destination. The script exits non-zero on any mismatch.

## Safety
- SQLite remains untouched and is retained as a rollback source.
- Server does not automatically copy data at startup.
- Migration is explicit via `npm run db:migrate:postgres`.
- Migration preserves explicit IDs and binary bytes.
- Migration verifies all six tables after copy.
- Render web service only switches to PostgreSQL after `DATABASE_URL` is configured.

## Render configuration
Create Render Postgres in the same region as the web service and set the web service `DATABASE_URL` to the database's internal connection URL. Use the database's external URL only for running migration from a local computer; an internal URL works from the Render service/private network.
