'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { POSTGRES_SCHEMA_SQL } = require('../lib/database.js');

const ROOT = path.resolve(__dirname, '..');

const TABLES = [
  {
    name: 'users',
    key: 'id',
    columns: ['id','name','email','phone','password_hash','is_verified_customer','verified_customer_at','created_at'],
    numeric: ['id','is_verified_customer','verified_customer_at','created_at']
  },
  {
    name: 'sessions',
    key: 'id',
    columns: ['id','user_id','token_hash','created_at','expires_at'],
    numeric: ['id','user_id','created_at','expires_at']
  },
  {
    name: 'orders',
    key: 'id',
    columns: ['id','order_ref','user_id','customer_email','customer_phone','amount_agorot','currency','items_json','status','created_at','paid_at','updated_at'],
    numeric: ['id','user_id','amount_agorot','created_at','paid_at','updated_at']
  },
  {
    name: 'reviews',
    key: 'id',
    columns: ['id','user_id','review_name','contact_phone','verified_purchase','review_product_id','review_product_variant','rating','body','review_date','image_blob','image_mime','status','created_at','updated_at'],
    numeric: ['id','user_id','verified_purchase','rating','review_date','created_at','updated_at']
  },
  {
    name: 'review_products',
    key: 'review_id, product_id',
    columns: ['review_id','product_id','product_variant','sort_order'],
    numeric: ['review_id','sort_order']
  },
  {
    name: 'review_images',
    key: 'id',
    columns: ['id','review_id','sort_order','image_blob','image_mime','media_kind','created_at'],
    numeric: ['id','review_id','sort_order','created_at']
  },
  {
    name: 'schema_meta',
    key: 'key',
    columns: ['key','value'],
    numeric: []
  }
];

function normalizeDigestValue(value) {
  if (value === null || value === undefined) return 'null';
  if (Buffer.isBuffer(value)) return `buffer:${value.toString('hex')}`;
  if (value instanceof Uint8Array) return `buffer:${Buffer.from(value).toString('hex')}`;
  if (typeof value === 'number') return `number:${Number.isFinite(value) ? String(value) : 'NaN'}`;
  return `string:${String(value)}`;
}

function canonicalTableRows(rows, descriptor) {
  return rows.map((row) => descriptor.columns.map((column) => normalizeDigestValue(row[column])));
}

function digestTable(rows, descriptor) {
  return crypto.createHash('sha256').update(JSON.stringify(canonicalTableRows(rows, descriptor))).digest('hex');
}

function snapshotDigests(snapshot) {
  const out = {};
  for (const descriptor of TABLES) out[descriptor.name] = digestTable(snapshot[descriptor.name] || [], descriptor);
  return out;
}

function snapshotCounts(snapshot) {
  return Object.fromEntries(TABLES.map((descriptor) => [descriptor.name, (snapshot[descriptor.name] || []).length]));
}

function hasSqliteTable(db, name) {
  return !!db.prepare("SELECT 1 AS ok FROM sqlite_master WHERE type='table' AND name=? LIMIT 1").get(name);
}

function snapshotSqlite(sqlitePath) {
  if (!fs.existsSync(sqlitePath)) throw new Error(`SQLite database not found: ${sqlitePath}`);
  const db = new DatabaseSync(sqlitePath, { readOnly: true });
  try {
    const snapshot = {};
    for (const descriptor of TABLES) {
      if (!hasSqliteTable(db, descriptor.name)) {
        snapshot[descriptor.name] = [];
        continue;
      }
      const order = descriptor.key === 'key' ? 'key' : `${descriptor.key}`;
      const availableColumns = new Set(db.prepare(`PRAGMA table_info(${descriptor.name})`).all().map((column) => column.name));
      const selectColumns = descriptor.columns.map((column) => availableColumns.has(column) ? column : `NULL AS ${column}`);
      snapshot[descriptor.name] = db.prepare(`SELECT ${selectColumns.join(', ')} FROM ${descriptor.name} ORDER BY ${order}`).all();
    }
    return snapshot;
  } finally {
    db.close();
  }
}

function coercePostgresRow(row, descriptor) {
  const numeric = new Set(descriptor.numeric || []);
  const out = {};
  for (const column of descriptor.columns) {
    const value = row[column];
    if (value === null || value === undefined) out[column] = null;
    else if (numeric.has(column)) out[column] = Number(value);
    else if (Buffer.isBuffer(value)) out[column] = Buffer.from(value);
    else out[column] = value;
  }
  return out;
}

async function snapshotPostgres(client) {
  const snapshot = {};
  for (const descriptor of TABLES) {
    const order = descriptor.key;
    const result = await client.query(`SELECT ${descriptor.columns.join(', ')} FROM ${descriptor.name} ORDER BY ${order}`);
    snapshot[descriptor.name] = result.rows.map((row) => coercePostgresRow(row, descriptor));
  }
  return snapshot;
}

function assertSnapshotsEqual(source, target) {
  const sourceCounts = snapshotCounts(source);
  const targetCounts = snapshotCounts(target);
  const sourceDigests = snapshotDigests(source);
  const targetDigests = snapshotDigests(target);
  const problems = [];
  for (const descriptor of TABLES) {
    const table = descriptor.name;
    if (sourceCounts[table] !== targetCounts[table]) problems.push(`${table}: count ${sourceCounts[table]} != ${targetCounts[table]}`);
    if (sourceDigests[table] !== targetDigests[table]) problems.push(`${table}: digest ${sourceDigests[table]} != ${targetDigests[table]}`);
  }
  if (problems.length) throw new Error(`Migration verification failed:\n${problems.join('\n')}`);
  return { counts: sourceCounts, digests: sourceDigests };
}

async function insertTable(client, descriptor, rows) {
  if (!rows.length) return;
  const columns = descriptor.columns;
  const placeholders = columns.map((_, index) => `$${index + 1}`).join(',');
  const updates = columns.filter((column) => column !== descriptor.key).map((column) => `${column}=EXCLUDED.${column}`).join(',');
  const conflict = updates ? `DO UPDATE SET ${updates}` : 'DO NOTHING';
  const sql = `INSERT INTO ${descriptor.name} (${columns.join(',')}) VALUES (${placeholders}) ON CONFLICT (${descriptor.key}) ${conflict}`;
  for (const row of rows) await client.query(sql, columns.map((column) => row[column]));
}

async function resetIdentity(client, table) {
  await client.query(`SELECT setval(pg_get_serial_sequence('${table}','id'), COALESCE((SELECT MAX(id) FROM ${table}),1), EXISTS(SELECT 1 FROM ${table}))`);
}

async function copySnapshotToPostgres(client, snapshot, replaceTarget = false) {
  const targetBefore = await snapshotPostgres(client);
  const nonEmpty = TABLES.filter((d) => d.name !== 'schema_meta' && targetBefore[d.name].length > 0);
  if (nonEmpty.length && !replaceTarget) {
    throw new Error(`Target PostgreSQL is not empty (${nonEmpty.map((d) => d.name).join(', ')}). Use MIGRATION_REPLACE_TARGET=1 only if you intentionally want to replace it.`);
  }

  await client.query('BEGIN');
  try {
    if (replaceTarget) await client.query('TRUNCATE review_images, review_products, reviews, orders, sessions, users, schema_meta RESTART IDENTITY CASCADE');
    for (const descriptor of TABLES) await insertTable(client, descriptor, snapshot[descriptor.name]);
    for (const table of ['users','sessions','orders','reviews','review_images']) await resetIdentity(client, table);
    await client.query('COMMIT');
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw err;
  }
}

async function runMigration(options = {}) {
  const sqlitePath = path.resolve(options.sqlitePath || process.env.VERSANS_DB_PATH || path.join(ROOT, 'data', 'versans.sqlite'));
  const databaseUrl = options.databaseUrl || process.env.DATABASE_URL || '';
  if (!databaseUrl) throw new Error('DATABASE_URL is required for PostgreSQL migration.');

  const pg = require('pg');
  if (pg.types) pg.types.setTypeParser(20, (value) => Number(value));
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
  const client = await pool.connect();
  try {
    const source = snapshotSqlite(sqlitePath);
    await client.query(POSTGRES_SCHEMA_SQL);
    if (!options.verifyOnly) await copySnapshotToPostgres(client, source, options.replaceTarget === true);
    const target = await snapshotPostgres(client);
    const verified = assertSnapshotsEqual(source, target);
    return { sqlitePath, ...verified };
  } finally {
    client.release();
    await pool.end();
  }
}

async function main() {
  const verifyOnly = process.argv.includes('--verify-only');
  const replaceTarget = process.env.MIGRATION_REPLACE_TARGET === '1' || process.argv.includes('--replace-target');
  const result = await runMigration({ verifyOnly, replaceTarget });
  console.log(`SQLite source: ${result.sqlitePath}`);
  for (const descriptor of TABLES) console.log(`${descriptor.name}: ${result.counts[descriptor.name]} row(s) · ${result.digests[descriptor.name]}`);
  console.log(verifyOnly ? 'PostgreSQL verification passed.' : 'PostgreSQL migration + verification passed.');
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
  });
}

module.exports = {
  TABLES,
  normalizeDigestValue,
  snapshotSqlite,
  snapshotPostgres,
  snapshotDigests,
  snapshotCounts,
  assertSnapshotsEqual,
  copySnapshotToPostgres,
  runMigration
};
