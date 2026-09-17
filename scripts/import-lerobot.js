'use strict';

const fs = require('fs');
const path = require('path');
const process = require('process');
const ROOT = path.dirname(path.resolve(process.argv[1]));
const { dbConfig, integer, options } = require(path.join(ROOT, '../lib/config.js'));
const { Client } = require('machcli');
const { close } = require(path.join(ROOT, '../lib/db.js'));
const { LEROBOT_TABLE, RUN_TABLE } = require(path.join(ROOT, '../lib/schema.js'));
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/lerobot-manifest.json'), 'utf8'));

// JSH 8.7 provides Buffer but not the browser encoding globals used by hyparquet.
if (typeof TextDecoder === 'undefined') {
  globalThis.TextDecoder = class { decode(input) { return Buffer.from(input || []).toString('utf8'); } };
}
if (typeof TextEncoder === 'undefined') {
  globalThis.TextEncoder = class { encode(input) { return Uint8Array.from(Buffer.from(String(input), 'utf8')); } };
}
const { parquetMetadata, parquetReadObjects } = require(path.join(ROOT, 'vendor/hyparquet.cjs'));

const RUN_NAME = 'lerobot/stanford-kuka';
const COLUMNS = ['observation.state', 'action', 'timestamp', 'episode_index', 'frame_index', 'next.done', 'index', 'task_index'];

function readBinary(file) {
  const descriptor = fs.openSync(file, 'r');
  try {
    const size = fs.fstatSync(descriptor).size;
    const bytes = new Uint8Array(size);
    let offset = 0;
    while (offset < size) {
      const count = fs.readSync(descriptor, bytes, offset, size - offset, offset);
      if (!count) throw new Error('unexpected end of file at byte ' + offset);
      offset += count;
    }
    return bytes.buffer;
  } finally {
    fs.closeSync(descriptor);
  }
}

function appendRow(appender, row, runId, runStart) {
  const state = row['observation.state'];
  const action = row.action;
  const sourceIndex = Number(row.index);
  if (!Array.isArray(state) || state.length !== 7 || !state.every(Number.isFinite)) throw new Error('invalid observation.state at row ' + sourceIndex);
  if (!Array.isArray(action) || action.length !== 7 || !action.every(Number.isFinite)) throw new Error('invalid action at row ' + sourceIndex);
  const episode = Number(row.episode_index);
  const frame = Number(row.frame_index);
  const timestamp = Number(row.timestamp);
  appender.append(
    'episode-' + episode, new Date(runStart + sourceIndex * 50),
    state[0], state[1], state[2], state[3], state[4], state[5], state[6],
    action[0], action[1], action[2], action[3], action[4], action[5], action[6],
    runId, episode, frame, timestamp, Number(row.task_index), row['next.done'] ? 1 : 0
  );
  return { episode, timestamp };
}

function writeRun(connection, runId, frames, episodes, durationMs) {
  connection.exec(
    `INSERT INTO ${RUN_TABLE} (NAME, TIME, VALUE, RUN_ID, MODEL_ID, SOURCE_KIND, FRAME_COUNT, SCENARIO_COUNT, DURATION_MS)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    RUN_NAME, new Date(), frames, runId, 'iiwa7-r800', 'lerobot', frames, episodes, durationMs
  );
}

async function importData(file, limit, offset) {
  if (!fs.existsSync(file)) throw new Error('missing ' + file + '; run download-lerobot.js first');
  if (fs.statSync(file).size !== manifest.size) throw new Error(file + ' does not match the expected ' + manifest.size + '-byte source file; run download-lerobot.js again');
  console.println('Reading:', file);
  const buffer = readBinary(file);
  const total = Number(parquetMetadata(buffer).num_rows);
  if (total !== manifest.rows) throw new Error('Parquet contains ' + total + ' rows; expected ' + manifest.rows);
  const requested = limit == null ? total - offset : Math.min(limit, total - offset);
  if (requested <= 0) throw new Error('no rows selected');
  const rows = await parquetReadObjects({ file: buffer, columns: COLUMNS, rowStart: offset, rowEnd: offset + requested });
  if (rows.length !== requested) throw new Error('Parquet reader returned ' + rows.length + ' of ' + requested + ' requested rows');

  const runId = 'lerobot-' + Date.now();
  const runStart = Date.now();
  let appender;
  let inserted = 0;
  const episodeLast = new Map();
  const episodeFirst = new Map();
  let maxEpisode = -1;
  let client;
  let connection;
  try {
    client = new Client(dbConfig());
    connection = client.connect();
    appender = connection.append(LEROBOT_TABLE);
    rows.forEach((row) => {
      const info = appendRow(appender, row, runId, runStart);
      inserted++;
      maxEpisode = Math.max(maxEpisode, info.episode);
      if (!episodeFirst.has(info.episode)) episodeFirst.set(info.episode, info.timestamp);
      episodeLast.set(info.episode, info.timestamp);
      if (inserted % 10000 === 0) { appender.flush(); console.println('Imported LeRobot frames:', inserted + '/' + requested); }
    });
    appender.close(); appender = null;
    if (offset === 0 && requested === total && inserted === total) {
      let durationMs = 0;
      episodeLast.forEach((last, episode) => { durationMs += Math.round((last - episodeFirst.get(episode)) * 1000); });
      writeRun(connection, runId, inserted, maxEpisode + 1, durationMs);
      console.println(JSON.stringify({ ok: true, runId, frames: inserted, episodes: maxEpisode + 1, durationMs }));
    } else {
      console.println(JSON.stringify({ ok: true, runId, frames: inserted, completionMarker: false, message: 'Partial import stored without a completion marker.' }));
    }
  } catch (error) {
    close(appender);
    console.println('Rows imported before failure:', inserted);
    console.println('Incomplete run has no completion marker:', runId);
    throw error;
  } finally {
    close(connection);
    close(client);
  }
}

(async () => {
  try {
    const args = options({ file: { type: 'string' }, limit: { type: 'string' }, offset: { type: 'string' } });
    if (args.help) {
      console.println('Usage: ./scripts/import-lerobot.js [--file /path/to/stanford-kuka-state.parquet] [--limit ROWS] [--offset ROWS]');
      console.println('Imports the compact local state/action Parquet; RLDS and videos are not loaded.');
      return;
    }
    const file = path.resolve(args.file || path.join(ROOT, '../data/lerobot', manifest.name));
    const limit = args.limit == null ? null : integer(args.limit, '--limit', 1, manifest.rows);
    const offset = integer(args.offset == null ? '0' : args.offset, '--offset', 0, manifest.rows - 1);
    await importData(file, limit, offset);
  } catch (error) {
    console.println('LeRobot import failed:', error.message);
    process.exit(1);
  }
})();
