'use strict';

const fs = require('fs');
const path = require('path');
const process = require('process');
const ROOT = path.dirname(path.dirname(path.resolve(process.argv[1])));
const { dbConfig, options } = require(path.join(ROOT, 'lib/config.js'));
const { close, withConnection } = require(path.join(ROOT, 'lib/db.js'));
const { MOTION_TABLE } = require(path.join(ROOT, 'lib/schema.js'));
const { MODELS, MOTIONS, generatedFrames } = require(path.join(ROOT, 'lib/robots.js'));

const DEG = Math.PI / 180;
const PUBLIC_MODEL = 'iiwa7-r800';
const PUBLIC_RUN_NAME = PUBLIC_MODEL + '/public-all';
const DATA_DIR = path.join(ROOT, 'scripts/data/collaborative-robotics');

function appendFrame(appender, frame, metadata) {
  const joints = frame.joints.concat(Array(7 - frame.joints.length).fill(0));
  appender.append(
    frame.name, frame.time, joints[0], joints[1], joints[2], joints[3], joints[4], joints[5], joints[6],
    frame.sample, frame.playbackMs, frame.sourceSeconds, frame.sourceTimestamp,
    metadata.tagKind, metadata.runId, metadata.logicalName, metadata.modelId, metadata.sourceKind,
    metadata.scenarioId, metadata.user, metadata.task, metadata.dof, metadata.frameCount,
    metadata.scenarioCount, metadata.durationMs, metadata.startTime, metadata.endTime
  );
}

function insertMetadata(connection, item) {
  connection.exec(
    `INSERT INTO ${MOTION_TABLE} METADATA
       (NAME, TAG_KIND, RUN_ID, LOGICAL_NAME, MODEL_ID, SOURCE_KIND, SCENARIO_ID,
        USER_NO, TASK_NO, DOF, FRAME_COUNT, SCENARIO_COUNT, DURATION_MS, START_TIME, END_TIME)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    item.name, item.tagKind, item.runId, item.logicalName, item.modelId, item.sourceKind,
    item.scenarioId, item.user, item.task, item.dof, item.frameCount,
    item.scenarioCount, item.durationMs, item.startTime, item.endTime
  );
}

function publicMetadata(frames) {
  const groups = new Map();
  frames.forEach((frame) => {
    let item = groups.get(frame.name);
    if (!item) {
      item = {
        name: frame.name, tagKind: 'MOTION', runId: frame.runId,
        logicalName: frame.logicalName, modelId: frame.modelId, sourceKind: frame.sourceKind,
        scenarioId: frame.scenarioId, user: frame.user, task: frame.task, dof: 7,
        frameCount: 0, scenarioCount: 1, firstSeconds: frame.sourceSeconds,
        lastSeconds: frame.sourceSeconds, startTime: frame.time, endTime: frame.time
      };
      groups.set(frame.name, item);
    }
    item.frameCount++;
    item.lastSeconds = frame.sourceSeconds;
    item.endTime = frame.time;
  });
  return [...groups.values()].map((item) => ({
    ...item, durationMs: Math.round((item.lastSeconds - item.firstSeconds) * 1000)
  }));
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
      const logicalName = PUBLIC_MODEL + '/user-' + user + '-task-' + task;
      frames.push({
        name: runId + '/public/user-' + user + '-task-' + task, logicalName,
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
    name: runId + '/studio/' + modelId + '/' + motionId, logicalName: modelId + '/' + motionId,
    time: new Date(runStart + frame.tMs), joints: frame.joints, runId,
    modelId, scenarioId: motionId, user: 0, task: 0, sample,
    playbackMs: frame.tMs, sourceSeconds: frame.tMs / 1000,
    sourceTimestamp: 0, sourceKind: 'generated'
  }));
}

function seed() {
  const runStart = Date.now();
  const runId = 'seed-' + runStart;
  let inserted = 0;
  withConnection(dbConfig(), (connection) => {
    let appender;
    try {
      const publicData = readPublicFrames(runId, runStart);
      const publicItems = publicMetadata(publicData.frames);
      const publicByName = new Map(publicItems.map((item) => [item.name, item]));

      const generated = [];
      MODELS.forEach((model) => model.motions.forEach((motionId) => {
        generated.push({
          name: model.id + '/' + motionId,
          modelId: model.id,
          motionId,
          frames: generatedMotionFrames(runId, runStart, model.id, motionId)
        });
      }));
      generated.forEach((entry) => {
        entry.metadata = {
          name: entry.frames[0].name, tagKind: 'MOTION', runId,
          logicalName: entry.name, modelId: entry.modelId, sourceKind: 'generated',
          scenarioId: entry.motionId, user: 0, task: 0, dof: MODELS.find((item) => item.id === entry.modelId).dof,
          frameCount: entry.frames.length, scenarioCount: 1, durationMs: MOTIONS[entry.motionId].durationMs,
          startTime: entry.frames[0].time, endTime: entry.frames.at(-1).time
        };
      });

      appender = connection.append(MOTION_TABLE);
      publicData.frames.forEach((frame) => { appendFrame(appender, frame, publicByName.get(frame.name)); inserted++; });
      generated.forEach((entry) => entry.frames.forEach((frame) => { appendFrame(appender, frame, entry.metadata); inserted++; }));
      appender.flush();
      appender.close();
      appender = null;

      insertMetadata(connection, {
        name: runId + '/run/public-all', tagKind: 'RUN', runId,
        logicalName: PUBLIC_RUN_NAME, modelId: PUBLIC_MODEL, sourceKind: 'public',
        scenarioId: 'public-all', user: 0, task: 0, dof: 7,
        frameCount: publicData.frames.length, scenarioCount: 450, durationMs: publicData.durationMs,
        startTime: new Date(runStart), endTime: new Date(runStart + publicData.durationMs)
      });
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
