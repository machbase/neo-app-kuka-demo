'use strict';

const fs = require('fs');
const path = require('path');

const DEG = Math.PI / 180;
const PUBLIC_MODEL = 'iiwa7-r800';
const FILE_COUNT = 30;
const EXPECTED_FRAMES = 33271;
const EXPECTED_SCENARIOS = 450;

function dataDirectory(root) {
  return path.join(root, 'scripts/data/collaborative-robotics');
}

function readPublicFrames(root, runId, runStart) {
  const frames = [];
  const scenarios = new Set();
  let offsetMs = 0;

  for (let user = 1; user <= FILE_COUNT; user++) {
    const file = path.join(dataDirectory(root), 'User_' + user + '.csv');
    if (!fs.existsSync(file)) throw new Error('Missing public dataset file: User_' + user + '.csv');
    const lines = fs.readFileSync(file, 'utf8').trim().split(/\r?\n/).slice(1);
    let lastSource = 0;
    lines.forEach((line, sample) => {
      const columns = line.split(',');
      const sourceSeconds = Number(columns[0]);
      const task = Number(columns[1]);
      const sourceTimestamp = Number(columns[2]);
      const joints = columns.slice(19, 26).map((value) => Number(value) * DEG);
      if (columns.length !== 28 || !Number.isFinite(sourceSeconds) || !Number.isInteger(task) ||
          task < 1 || task > 15 || !Number.isFinite(sourceTimestamp) || !joints.every(Number.isFinite)) {
        throw new Error('Invalid public dataset row in User_' + user + '.csv at line ' + (sample + 2));
      }
      const playbackMs = offsetMs + Math.round(sourceSeconds * 1000);
      const logicalName = PUBLIC_MODEL + '/user-' + user + '-task-' + task;
      frames.push({
        name: runId + '/public/user-' + user + '-task-' + task, logicalName,
        time: new Date(runStart + playbackMs), joints, runId, modelId: PUBLIC_MODEL,
        scenarioId: 'user-' + user + '-task-' + task, user, task, sample,
        playbackMs, sourceSeconds, sourceTimestamp, sourceKind: 'public'
      });
      scenarios.add(user + '/' + task);
      lastSource = sourceSeconds;
    });
    offsetMs += Math.round(lastSource * 1000);
  }

  if (frames.length !== EXPECTED_FRAMES || scenarios.size !== EXPECTED_SCENARIOS) {
    throw new Error('Public dataset totals do not match the expected 33,271 frames and 450 scenarios.');
  }
  return { frames, durationMs: offsetMs, fileCount: FILE_COUNT, scenarioCount: scenarios.size };
}

function verifyPublicData(root) {
  const data = readPublicFrames(root, 'verify', 0);
  return {
    files: data.fileCount,
    frames: data.frames.length,
    scenarios: data.scenarioCount,
    durationMs: data.durationMs
  };
}

module.exports = { PUBLIC_MODEL, readPublicFrames, verifyPublicData };
