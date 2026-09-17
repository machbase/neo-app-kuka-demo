'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const process = require('process');
const ROOT = path.dirname(path.resolve(process.argv[1]));
const { options } = require(path.join(ROOT, '../lib/config.js'));
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/lerobot-manifest.json'), 'utf8'));

function download(url, destination, redirects) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, (response) => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
        const location = response.headers.location;
        if (typeof response.close === 'function') response.close();
        if (!location || redirects >= 5) return reject(new Error('too many redirects for ' + url));
        return download(new URL(location, url).toString(), destination, redirects + 1).then(resolve, reject);
      }
      if (response.statusCode < 200 || response.statusCode >= 300) {
        if (typeof response.close === 'function') response.close();
        return reject(new Error('HTTP ' + response.statusCode + ' for ' + url));
      }
      try {
        // The compact state/action Parquet is 8.85 MB, so one bounded buffer is acceptable.
        fs.writeFileSync(destination, response.readBodyBuffer());
        resolve();
      } catch (error) { reject(error); }
    });
    request.on('error', reject);
  });
}

async function main() {
  const args = options({ dir: { type: 'string' } });
  if (args.help) {
    console.println('Usage: ./scripts/download-lerobot.js [--dir /absolute/path/to/lerobot]');
    console.println('Downloads the 8.85 MB state/action Parquet only; videos and the 31.98 GiB RLDS conversion are excluded.');
    return;
  }
  const directory = path.resolve(args.dir || path.join(ROOT, '../data/lerobot'));
  const destination = path.join(directory, manifest.name);
  fs.mkdirSync(directory, { recursive: true });
  if (fs.existsSync(destination) && fs.statSync(destination).size === manifest.size) {
    console.println('Already complete:', manifest.name);
  } else {
    console.println('Downloading:', manifest.name, '(' + manifest.size + ' bytes)');
    await download(manifest.url, destination, 0);
  }
  const size = fs.statSync(destination).size;
  if (size !== manifest.size) throw new Error(manifest.name + ' is ' + size + ' bytes; expected ' + manifest.size + '. Run the command again.');
  console.println(JSON.stringify({ ok: true, file: destination, bytes: size, rows: manifest.rows }));
}

main().catch((error) => { console.println('LeRobot download failed:', error.message); process.exit(1); });
