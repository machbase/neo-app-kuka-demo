'use strict';

const { appError, close, queryAll, withConnection } = require('./db');
const { MOTION_TABLE } = require('./schema');
const { model } = require('./robots');

const SOURCE_KIND = 'visitor-simulation';
const SAMPLE_MS = 100;
const SEGMENT_MS = 1500;
const MAX_KEYFRAMES = 8;
const JOINT_LIMITS_DEG = {
  'iiwa7-r800': [[-170, 170], [-120, 120], [-170, 170], [-120, 120], [-170, 170], [-120, 120], [-175, 175]],
  'kr6-r900-2': [[-170, 170], [-190, 45], [-120, 156], [-185, 185], [-120, 120], [-350, 350]],
  'iisy3-r760': [[-185, 185], [-230, 50], [-150, 150], [-175, 175], [-110, 110], [-220, 220]]
};

function smooth(value) {
  return value * value * (3 - 2 * value);
}

function validateKeyframes(modelId, keyframes) {
  const spec = model(modelId);
  const limits = JOINT_LIMITS_DEG[modelId];
  if (!spec || !limits) throw appError(400, 'INVALID_MODEL', 'Unknown robot model.');
  if (!Array.isArray(keyframes) || keyframes.length < 2 || keyframes.length > MAX_KEYFRAMES) {
    throw appError(400, 'INVALID_KEYFRAMES', 'Capture between 2 and 8 poses.');
  }
  return keyframes.map((pose) => {
    const joints = pose && Array.isArray(pose.joints) ? pose.joints : pose;
    if (!Array.isArray(joints) || joints.length !== spec.dof || !joints.every(Number.isFinite)) {
      throw appError(400, 'INVALID_KEYFRAMES', 'Every pose must contain one finite value per robot joint.');
    }
    return joints.map((value, index) => {
      const minimum = limits[index][0] * Math.PI / 180;
      const maximum = limits[index][1] * Math.PI / 180;
      if (value < minimum - 1e-7 || value > maximum + 1e-7) {
        throw appError(400, 'JOINT_LIMIT_EXCEEDED', 'A captured pose exceeds the selected robot joint limits.');
      }
      return Number(value.toFixed(7));
    });
  });
}

function interpolate(keyframes) {
  const frames = [];
  keyframes.forEach((start, segment) => {
    if (segment === keyframes.length - 1) return;
    const end = keyframes[segment + 1];
    const firstStep = segment === 0 ? 0 : 1;
    for (let step = firstStep; step <= SEGMENT_MS / SAMPLE_MS; step++) {
      const amount = smooth(step * SAMPLE_MS / SEGMENT_MS);
      frames.push({
        tMs: segment * SEGMENT_MS + step * SAMPLE_MS,
        joints: start.map((value, joint) =>
          Number((value + (end[joint] - value) * amount).toFixed(7)))
      });
    }
  });
  return frames;
}

function source() {
  return {
    kind: SOURCE_KIND,
    title: 'Visitor-created simulated motion',
    license: 'Project data',
    sampleRateHz: 1000 / SAMPLE_MS
  };
}

function response(modelId, runId, frames, createdAt) {
  return {
    model: modelId,
    mode: 'teach',
    motion: runId,
    runId,
    createdAt,
    source: source(),
    durationMs: frames.length ? frames[frames.length - 1].tMs : 0,
    originalDurationMs: frames.length ? frames[frames.length - 1].tMs : 0,
    frames: frames.map((frame) => ({
      tMs: frame.tMs,
      user: 0,
      task: 0,
      scenario: runId,
      joints: frame.joints
    }))
  };
}

function save(config, input) {
  const body = input && typeof input === 'object' ? input : {};
  const modelId = typeof body.model === 'string' ? body.model : '';
  const keyframes = validateKeyframes(modelId, body.keyframes);
  const frames = interpolate(keyframes);
  const now = Date.now();
  const runId = 'teach-' + now + '-' + Math.floor(Math.random() * 1679616).toString(36).padStart(4, '0');
  const motionName = runId + '/motion';
  const durationMs = frames[frames.length - 1].tMs;
  const startTime = new Date(now);
  const endTime = new Date(now + durationMs);
  const spec = model(modelId);
  let inserted = 0;

  withConnection(config, (connection) => {
    let appender;
    try {
      appender = connection.append(MOTION_TABLE);
      frames.forEach((frame, sample) => {
        const joints = frame.joints.concat(Array(7 - frame.joints.length).fill(0));
        appender.append(
          motionName, new Date(now + frame.tMs), joints[0], joints[1], joints[2], joints[3], joints[4], joints[5], joints[6],
          sample, frame.tMs, frame.tMs / 1000, 0,
          'MOTION', runId, modelId + '/visitor/' + runId, modelId, SOURCE_KIND,
          runId, 0, 0, spec.dof, frames.length, 1, durationMs, startTime, endTime
        );
        inserted++;
      });
      appender.flush();
      appender.close();
      appender = null;

      // This RUN row is the completion marker; partial TAG writes remain hidden without it.
      connection.exec(
        `INSERT INTO ${MOTION_TABLE} METADATA
           (NAME, TAG_KIND, RUN_ID, LOGICAL_NAME, MODEL_ID, SOURCE_KIND, SCENARIO_ID,
            USER_NO, TASK_NO, DOF, FRAME_COUNT, SCENARIO_COUNT, DURATION_MS, START_TIME, END_TIME)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        runId + '/run', 'RUN', runId, modelId + '/visitor/' + runId, modelId, SOURCE_KIND,
        runId, 0, 0, spec.dof, frames.length, 1, durationMs, startTime, endTime
      );
    } catch (error) {
      close(appender);
      console.println('Incomplete visitor motion:', runId, 'rows:', inserted);
      throw appError(500, 'MOTION_SAVE_FAILED', 'Unable to save the visitor motion.');
    }
  });

  return response(modelId, runId, frames, startTime.toISOString());
}

function list(config, modelId) {
  if (!model(modelId)) throw appError(400, 'INVALID_MODEL', 'Unknown robot model.');
  return withConnection(config, (connection) => {
    let rows;
    try {
      rows = queryAll(connection,
        `SELECT RUN_ID, MODEL_ID, FRAME_COUNT, DURATION_MS, START_TIME
         FROM ${MOTION_TABLE} METADATA
         WHERE TAG_KIND = ? AND SOURCE_KIND = ? AND MODEL_ID = ?
         ORDER BY _LAST_UPDATE_TIME DESC LIMIT 20`,
        'RUN', SOURCE_KIND, modelId);
    } catch (_) {
      throw appError(500, 'MOTION_QUERY_FAILED', 'Unable to read visitor motion memory.');
    }
    return { motions: rows.map((row) => ({
      id: row.RUN_ID,
      model: row.MODEL_ID,
      frameCount: Number(row.FRAME_COUNT),
      durationMs: Number(row.DURATION_MS),
      createdAt: row.START_TIME
    })) };
  });
}

function load(config, id) {
  if (typeof id !== 'string' || !/^teach-[0-9]+-[a-z0-9]{4}$/.test(id)) {
    throw appError(400, 'INVALID_MOTION_ID', 'A valid visitor motion ID is required.');
  }
  return withConnection(config, (connection) => {
    let marker;
    try {
      marker = queryAll(connection,
        `SELECT RUN_ID, MODEL_ID, DOF, FRAME_COUNT, DURATION_MS, START_TIME, END_TIME
         FROM ${MOTION_TABLE} METADATA
         WHERE TAG_KIND = ? AND SOURCE_KIND = ? AND RUN_ID = ? LIMIT 1`,
        'RUN', SOURCE_KIND, id)[0];
    } catch (_) {
      throw appError(500, 'MOTION_QUERY_FAILED', 'Unable to read visitor motion memory.');
    }
    if (!marker) throw appError(404, 'MOTION_NOT_FOUND', 'The visitor motion is not available.');
    let rows;
    try {
      rows = queryAll(connection,
        `SELECT VALUE, J2, J3, J4, J5, J6, J7, PLAYBACK_MS
         FROM ${MOTION_TABLE}
         WHERE NAME = ? AND TIME BETWEEN ? AND ?
         ORDER BY TIME, SAMPLE_NO`,
        id + '/motion', marker.START_TIME, marker.END_TIME);
    } catch (_) {
      throw appError(500, 'MOTION_QUERY_FAILED', 'Unable to read the visitor motion.');
    }
    if (rows.length !== Number(marker.FRAME_COUNT)) {
      // TAG appender rows can become query-visible just after their completion marker.
      throw appError(503, 'MOTION_NOT_READY', 'The visitor motion is still becoming available. Try again shortly.');
    }
    const dof = Number(marker.DOF);
    const frames = rows.map((row) => ({
      tMs: Number(row.PLAYBACK_MS),
      joints: [row.VALUE, row.J2, row.J3, row.J4, row.J5, row.J6, row.J7].slice(0, dof).map(Number)
    }));
    return response(marker.MODEL_ID, id, frames, marker.START_TIME);
  });
}

module.exports = { interpolate, list, load, save, validateKeyframes };
