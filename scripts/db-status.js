'use strict';

const path = require('node:path');
const { createDatabase } = require('../lib/database.js');

async function main() {
  const root = path.resolve(__dirname, '..');
  const db = createDatabase({ root });
  try {
    await db.init();
    const counts = await db.tableCounts();
    console.log(`backend=${db.backend}`);
    for (const [table, count] of Object.entries(counts)) console.log(`${table}=${count}`);
  } finally {
    await db.close();
  }
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
