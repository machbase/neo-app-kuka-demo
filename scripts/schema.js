'use strict';

const path = require('path');
const process = require('process');
const ROOT = path.dirname(path.dirname(path.resolve(process.argv[1])));
const { dbConfig, options } = require(path.join(ROOT, 'lib/config.js'));
const { withConnection } = require(path.join(ROOT, 'lib/db.js'));
const { MOTION_TABLE, DDLS, ensureSchema } = require(path.join(ROOT, 'lib/schema.js'));

try {
  const args = options({ print: { type: 'boolean' } });
  if (args.help) {
    console.println('Usage: ./scripts/schema.js [--print]');
  } else if (args.print) {
    DDLS.forEach((ddl) => console.println(ddl + ';'));
  } else {
    withConnection(dbConfig(), (connection) => ensureSchema(connection));
    console.println(JSON.stringify({
      ok: true, tables: [MOTION_TABLE],
      message: 'Robot motion schema ready; existing tables and data preserved.'
    }));
  }
} catch (error) {
  console.println('Schema failed:', error.message);
  process.exit(1);
}
