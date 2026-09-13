'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = process.env.VERSANS_DATA_DIR
  ? path.resolve(process.env.VERSANS_DATA_DIR)
  : path.join(ROOT, 'data');
const DB_PATH = process.env.VERSANS_DB_PATH
  ? path.resolve(process.env.VERSANS_DB_PATH)
  : path.join(DATA_DIR, 'versans.sqlite');

if (!fs.existsSync(DB_PATH)) {
  console.error(`SQLite database was not found: ${DB_PATH}`);
  process.exit(1);
}

const backupDir = path.join(DATA_DIR, 'backups');
fs.mkdirSync(backupDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const target = path.join(backupDir, `versans-${stamp}.sqlite`);
const escapedTarget = target.replace(/'/g, "''");

// VACUUM INTO creates a consistent standalone SQLite snapshot, including data that may be in WAL mode.
const db = new DatabaseSync(DB_PATH);
try {
  db.exec(`VACUUM INTO '${escapedTarget}'`);
  console.log(`SQLite backup created: ${target}`);
} finally {
  db.close();
}
