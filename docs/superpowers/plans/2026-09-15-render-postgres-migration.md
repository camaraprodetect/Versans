# Render Postgres Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run VerSans on Render PostgreSQL while preserving every existing SQLite database row and review-media byte.

**Architecture:** Introduce a common async database-store interface with SQLite and PostgreSQL backends. Add an explicit SQLite-to-Postgres migration script with transaction, sequence reset, and post-copy digest verification; server selects Postgres from `DATABASE_URL`.

**Tech Stack:** Node.js 22+, built-in `node:sqlite`, `pg`, Node `node:test`, Render PostgreSQL.

**Spec:** `docs/superpowers/specs/2026-09-15-render-postgres-migration-design.md`

## Global Constraints
- Preserve public API response shapes and storefront behavior.
- Preserve explicit IDs, password hashes, session token hashes, review data, order data, and binary review media exactly.
- Never delete or overwrite the source SQLite file.
- PostgreSQL is selected only when `DATABASE_URL` is present.
- Migration must exit non-zero if source/destination verification differs.

---

### Task 1: Database store abstraction
**Files:** Create `lib/database.js`; Test `tests/database-store.test.js`.
**Interfaces:** Produces `createDatabase(options)`, `SqliteStore`, `PostgresStore` with async app-level database methods and `transaction(fn)`.
- [ ] Write failing tests for SQLite async CRUD/session/review/order behavior and Postgres backend selection.
- [ ] Run tests and confirm module-missing failure.
- [ ] Implement SQLite store and PostgreSQL store/schema.
- [ ] Run tests and confirm pass.

### Task 2: Server migration to async store
**Files:** Modify `server.js`; Test existing server/static SEO tests plus new `tests/server-database-adapter.test.js`.
**Interfaces:** Consumes database store methods from Task 1.
- [ ] Write failing source-level/runtime tests that server initializes through the database store and awaits DB operations.
- [ ] Convert auth, review, payment/order helpers and transactions to async store calls.
- [ ] Initialize database before listening and close store on shutdown.
- [ ] Run server and existing tests.

### Task 3: Exact SQLite-to-Postgres migration
**Files:** Create `scripts/migrate-sqlite-to-postgres.js`; Test `tests/postgres-migration.test.js`; Modify `package.json`.
**Interfaces:** Produces command `npm run db:migrate:postgres` using `DATABASE_URL` and optional `VERSANS_DB_PATH`.
- [ ] Write failing tests for source snapshot/digest including binary blobs and exact current source counts.
- [ ] Implement schema init, transactional upsert/copy in FK order, sequence reset, target snapshot, and SHA-256 verification.
- [ ] Add `pg` dependency and migration/verification scripts.
- [ ] Run local dry verification against SQLite and unit tests.

### Task 4: Deployment documentation and final verification
**Files:** Modify `README.md`; Create `scripts/db-status.js`.
**Interfaces:** Produces `npm run db:status` to print backend and safe table counts.
- [ ] Document Render Postgres creation, `DATABASE_URL`, migration command, verification, deploy, and rollback.
- [ ] Run syntax checks, full Node test suite, current SQLite count check, and ZIP changed files only.
