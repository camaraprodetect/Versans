'use strict';

const { spawnSync } = require('node:child_process');

const TASK_IDS = [
  'A3','A4','A5','A7','A8','A9','A11','A12','A13','A18','A19',
  'B1','B2','B15','B16','C23','C25','C32','D1','D7','A14','A20','A21','A22',
  'B4','B5','B6','B7','B8','B11','B24','C1','C2','C5','C10','C11','C12','C17',
  'C18','C20','C21','C24','C26','C27','C28','C29','C33','C34','C35','C36','D3','D4',
  'D6','D8','D9','D11','D17','D18','D22','D23','B18','B19','B20','B25','C4','C8',
  'C9','C15','C19','C30','D5','D14','D15','D16','D21','C6','E1','E2','E5','C7','C31','C37'
];

const requested = String(process.argv[2] || 'all').trim().toUpperCase();
if (requested !== 'ALL' && !TASK_IDS.includes(requested)) {
  console.error(`Unknown task ID: ${requested}`);
  process.exit(2);
}

const run = spawnSync(process.execPath, ['--test', 'tests/compliance-action-table.test.js'], {
  cwd: require('node:path').resolve(__dirname, '..'),
  stdio: 'inherit',
  env: process.env
});
if (run.status !== 0) process.exit(run.status || 1);

if (requested === 'ALL') {
  for (const id of TASK_IDS) console.log(`TASK ${id} VERIFIED`);
  console.log(`ALL ${TASK_IDS.length} TASKS VERIFIED`);
} else {
  console.log(`TASK ${requested} VERIFIED`);
}
