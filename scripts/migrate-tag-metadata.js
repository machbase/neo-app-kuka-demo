'use strict';

const path = require('path');
const process = require('process');
const ROOT = path.dirname(path.dirname(path.resolve(process.argv[1])));
const { dbConfig, options } = require(path.join(ROOT, 'lib/config.js'));
const { queryAll, withConnection } = require(path.join(ROOT, 'lib/db.js'));
const { MOTION_TABLE, LEGACY_TABLES, ensureSchema } = require(path.join(ROOT, 'lib/schema.js'));

function migrate() {
  const targets = [MOTION_TABLE, ...LEGACY_TABLES];
  const dropped = [];
  withConnection(dbConfig(), (connection) => {
    targets.forEach((table) => {
      const exists = queryAll(connection, 'SELECT NAME FROM M$SYS_TABLES WHERE NAME = ?', table);
      if (!exists.length) return;
      connection.exec('DROP TABLE ' + table);
      dropped.push(table);
    });
    ensureSchema(connection);
  });
  console.println(JSON.stringify({ ok: true, dropped, created: [MOTION_TABLE] }));
}

try {
  const args = options({ confirm: { type: 'boolean' } });
  if (args.help) {
    console.println('Usage: ./scripts/migrate-tag-metadata.js --confirm');
    console.println('Drops this app\'s robot-motion tables and creates the single METADATA-based schema.');
  } else if (!args.confirm) {
    throw new Error('--confirm is required because this migration permanently deletes robot-motion data');
  } else {
    migrate();
  }
} catch (error) {
  console.println('Migration failed:', error.message);
  process.exit(1);
}
