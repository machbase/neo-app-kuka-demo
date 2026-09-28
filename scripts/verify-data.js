'use strict';

const path = require('path');
const process = require('process');
const ROOT = path.dirname(path.dirname(path.resolve(process.argv[1])));
const { options } = require(path.join(ROOT, 'lib/config.js'));
const { verifyPublicData } = require(path.join(ROOT, 'lib/public-data.js'));

try {
  const args = options();
  if (args.help) {
    console.println('Usage: ./scripts/verify-data.js');
    console.println('Checks the 30 bundled public CSV files without changing the database.');
  } else {
    const result = verifyPublicData(ROOT);
    console.println(JSON.stringify({
      ok: true,
      data: result,
      message: 'Bundled robot motion data is ready. No separate download is required.'
    }));
  }
} catch (error) {
  console.println('Data verification failed:', error.message);
  process.exit(1);
}
