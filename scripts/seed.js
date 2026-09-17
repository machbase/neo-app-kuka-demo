'use strict';

const fs = require('fs');
const path = require('path');
const process = require('process');
const ROOT = path.dirname(path.dirname(path.resolve(process.argv[1])));
const { dbConfig, options } = require(path.join(ROOT, 'lib/config.js'));
const { close, withConnection } = require(path.join(ROOT, 'lib/db.js'));
const { MOTION_TABLE, RUN_TABLE } = require(path.join(ROOT, 'lib/schema.js'));
const { MODELS, MOTIONS, generatedFrames } = require(path.join(ROOT, 'lib/robots.js'));

const DEG = Math.PI / 180;
const PUBLIC_MODEL = 'iiwa7-r800';
const PUBLIC_RUN_NAME = PUBLIC_MODEL + '/public-all';
const DATA_DIR = path.join(ROOT, 'scripts/data/collaborative-robotics');

function appendFrame(appender, frame) {
  const joints = frame.joints.concat(Array(7 - frame.joints.length).fill(0));
  appender.append(
    frame.name, frame.time, joints[0], joints[1], joints[2], joints[3], joints[4], joints[5], joints[6],
    frame.runId, frame.modelId, frame.scenarioId, frame.user, frame.task, frame.sample,
    frame.playbackMs, frame.sourceSeconds, frame.sourceTimestamp, frame.sourceKind
  );
}

function readPublicFrames(runId, runStart) {
  const frames = [];
  let offsetMs = 0;
  for (let user = 1; user <= 30; user++) {
    const file = path.join(DATA_DIR, 'User_' + user + '.csv');
    const lines = fs.readFileSync(file, 'utf8').trim().split(/\r?\n/).slice(1);
    let lastSource = 0;
    lines.forEach((line, sample) => {
      const columns = line.split(',');
      const sourceSeconds = Number(columns[0]);
      const task = Number(columns[1]);
      const joints = columns.slice(19, 26).map((value) => Number(value) * DEG);
      if (columns.length !== 28 || !joints.every(Number.isFinite)) {
        throw new Error('Invalid public dataset row in User_' + user + '.csv at line ' + (sample + 2));
      }
      const playbackMs = offsetMs + Math.round(sourceSeconds * 1000);
      frames.push({
        name: PUBLIC_MODEL + '/user-' + user + '-task-' + task,
        time: new Date(runStart + playbackMs), joints, runId, modelId: PUBLIC_MODEL,
        scenarioId: 'user-' + user + '-task-' + task, user, task, sample,
        playbackMs, sourceSeconds, sourceTimestamp: Number(columns[2]), sourceKind: 'public'
      });
      lastSource = sourceSeconds;
    });
    offsetMs += Math.round(lastSource * 1000);
  }
  return { frames, durationMs: offsetMs };
}

function generatedMotionFrames(runId, runStart, modelId, motionId) {
  return generatedFrames(modelId, motionId).map((frame, sample) => ({
    name: modelId + '/' + motionId,
    time: new Date(runStart + frame.tMs), joints: frame.joints, runId,
    modelId, scenarioId: motionId, user: 0, task: 0, sample,
    playbackMs: frame.tMs, sourceSeconds: frame.tMs / 1000,
    sourceTimestamp: 0, sourceKind: 'generated'
  }));
}

function writeRun(connection, name, runId, modelId, sourceKind, frameCount, scenarioCount, durationMs) {
  connection.exec(
    `INSERT INTO ${RUN_TABLE} (NAME, TIME, VALUE, RUN_ID, MODEL_ID, SOURCE_KIND, FRAME_COUNT, SCENARIO_COUNT, DURATION_MS)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    name, new Date(), frameCount, runId, modelId, sourceKind, frameCount, scenarioCount, durationMs
  );
}

function seed() {
  const runStart = Date.now();
  const runId = 'seed-' + runStart;
  let inserted = 0;
  withConnection(dbConfig(), (connection) => {
    let appender;
    try {
      appender = connection.append(MOTION_TABLE);
      const publicData = readPublicFrames(runId, runStart);
      publicData.frames.forEach((frame) => { appendFrame(appender, frame); inserted++; });

      const generated = [];
      MODELS.forEach((model) => model.motions.forEach((motionId) => {
        generated.push({
          name: model.id + '/' + motionId,
          modelId: model.id,
          motionId,
          frames: generatedMotionFrames(runId, runStart, model.id, motionId)
        });
      }));
      generated.forEach((entry) => entry.frames.forEach((frame) => { appendFrame(appender, frame); inserted++; }));
      appender.flush();
      appender.close();
      appender = null;

      writeRun(connection, PUBLIC_RUN_NAME, runId, PUBLIC_MODEL, 'public', publicData.frames.length, 450, publicData.durationMs);
      generated.forEach((entry) => writeRun(
        connection, entry.name, runId, entry.modelId, 'generated', entry.frames.length, 1,
        MOTIONS[entry.motionId].durationMs
      ));
      console.println(JSON.stringify({
        ok: true, runId, publicFrames: publicData.frames.length,
        publicScenarios: 450, publicDurationMs: publicData.durationMs,
        generatedMotions: generated.length, inserted
      }));
    } catch (error) {
      close(appender);
      console.println('Rows inserted before failure:', inserted);
      console.println('Incomplete run has no completion marker:', runId);
      throw error;
    }
  });
}

try {
  const args = options();
  if (args.help) {
    console.println('Usage: ./scripts/seed.js');
    console.println('Adds all 30 public iiwa sessions and six generated studio motions.');
  } else {
    seed();
  }
} catch (error) {
  console.println('Seed failed:', error.message);
  process.exit(1);
}
