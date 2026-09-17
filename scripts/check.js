'use strict';

const fs = require('fs');
const path = require('path');
const process = require('process');
const ROOT = path.dirname(path.dirname(path.resolve(process.argv[1])));
const { options } = require(path.join(ROOT, 'lib/config.js'));

function check(base) {
  const runRoot = path.join(ROOT, '.run');
  fs.mkdirSync(runRoot, { recursive: true });
  const runDir = path.join(runRoot, 'check-' + process.pid + '-' + Date.now());
  fs.mkdirSync(runDir);
  const reportFile = path.join(runDir, 'result.json');
  try {
    // Verified Neo 8.7.0 build c4954cf0 can lose exit status from HTTP callbacks.
    // Keep the success-report contract on newer builds too; missing reports must fail.
    fs.writeFileSync(reportFile, JSON.stringify({ ok: false }));
    const worker = path.join(ROOT, 'scripts/internal/check-api.js');
    process.exec(worker, base, reportFile);
    const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
    if (report.ok !== true) throw new Error('API checks did not complete successfully.');
  } finally {
    if (fs.existsSync(reportFile)) fs.unlinkSync(reportFile);
    fs.rmdirSync(runDir);
  }
}

try {
  const args = options({ url: { type: 'string' } });
  if (args.help) {
    console.println('Usage: ./scripts/check.js [--url http://127.0.0.1:56802]');
  } else {
    const base = (args.url || 'http://127.0.0.1:56802').replace(/\/+$/, '');
    if (!/^https?:\/\/[^\s?#]+$/.test(base)) throw new Error('--url must be an HTTP(S) base URL');
    check(base);
  }
} catch (error) {
  console.println('Check failed:', error.message);
  process.exit(1);
}
