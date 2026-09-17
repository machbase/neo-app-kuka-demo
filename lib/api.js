'use strict';

const { appError, queryAll, withConnection } = require('./db');
const { MOTION_TABLE } = require('./schema');
const { generatedFrames, model, motion, publicCatalog } = require('./robots');

const PUBLIC_RUN_NAME = 'iiwa7-r800/public-all';

function latestRun(connection, name) {
  return queryAll(connection,
    `SELECT RUN_ID, FRAME_COUNT, SCENARIO_COUNT, DURATION_MS, START_TIME, END_TIME
     FROM ${MOTION_TABLE} METADATA
     WHERE TAG_KIND = ? AND LOGICAL_NAME = ?
     ORDER BY _LAST_UPDATE_TIME DESC LIMIT 1`, 'RUN', name)[0];
}

function robots() {
  return {
    models: publicCatalog(),
    playback: {
      publicModel: 'iiwa7-r800', modes: ['full', 'scenario', 'studio'],
      fullDurationMs: 6140545, activeDurationMs: 3301714,
      frameCount: 33271, scenarioCount: 450
    }
  };
}

function publicSource() {
  return {
    kind: 'public-recording', title: 'Dataset for Collaborative Robotics',
    license: 'CC BY 4.0', doi: '10.17632/4fr33dkrjt.3', sampleRateHz: 10
  };
}

function scenarios(config) {
  return withConnection(config, (connection) => {
    const run = latestRun(connection, PUBLIC_RUN_NAME);
    if (!run) throw appError(404, 'TRAJECTORY_NOT_FOUND', 'Run ./scripts/seed.js to load robot motion data.');
    let rows;
    try {
      rows = queryAll(connection,
        `SELECT USER_NO, TASK_NO, FRAME_COUNT, DURATION_MS
         FROM ${MOTION_TABLE} METADATA
         WHERE RUN_ID = ? AND TAG_KIND = ? AND SOURCE_KIND = ?
         ORDER BY USER_NO, TASK_NO`, run.RUN_ID, 'MOTION', 'public');
    } catch (_) {
      throw appError(500, 'TRAJECTORY_QUERY_FAILED', 'Unable to read the scenario catalog.');
    }
    if (rows.length !== Number(run.SCENARIO_COUNT)) {
      throw appError(500, 'TRAJECTORY_INCOMPLETE', 'The latest robot dataset is incomplete. Run ./scripts/seed.js again.');
    }
    return {
      runId: run.RUN_ID, source: publicSource(), frameCount: Number(run.FRAME_COUNT),
      fullDurationMs: Number(run.DURATION_MS),
      scenarios: rows.map((row) => ({
        id: 'user-' + row.USER_NO + '-task-' + row.TASK_NO,
        user: Number(row.USER_NO), task: Number(row.TASK_NO),
        frameCount: Number(row.FRAME_COUNT), startMs: 0,
        durationMs: Number(row.DURATION_MS)
      }))
    };
  });
}

function toFrame(row, tMs) {
  return {
    tMs, user: Number(row.USER_NO), task: Number(row.TASK_NO), scenario: row.SCENARIO_ID,
    joints: [row.VALUE, row.J2, row.J3, row.J4, row.J5, row.J6, row.J7].map(Number)
  };
}

function publicTrajectory(connection, mode, user, task) {
  const run = latestRun(connection, PUBLIC_RUN_NAME);
  if (!run) throw appError(404, 'TRAJECTORY_NOT_FOUND', 'Run ./scripts/seed.js to load robot motion data.');
  let rows;
  try {
    rows = mode === 'scenario'
      ? queryAll(connection,
        `SELECT VALUE, J2, J3, J4, J5, J6, J7, USER_NO, TASK_NO, SCENARIO_ID, PLAYBACK_MS
         FROM ${MOTION_TABLE}
         WHERE NAME = ? AND TIME BETWEEN ? AND ?
         ORDER BY TIME, SAMPLE_NO`,
        run.RUN_ID + '/public/user-' + user + '-task-' + task, run.START_TIME, run.END_TIME)
      : queryAll(connection,
        `SELECT VALUE, J2, J3, J4, J5, J6, J7, USER_NO, TASK_NO, SCENARIO_ID, PLAYBACK_MS
         FROM ${MOTION_TABLE}
         WHERE RUN_ID = ? AND TAG_KIND = ? AND SOURCE_KIND = ?
           AND TIME BETWEEN ? AND ?
         ORDER BY TIME, USER_NO, SAMPLE_NO`,
        run.RUN_ID, 'MOTION', 'public', run.START_TIME, run.END_TIME);
  } catch (_) {
    throw appError(500, 'TRAJECTORY_QUERY_FAILED', 'Unable to read robot motion data.');
  }
  if (!rows.length) throw appError(404, 'TRAJECTORY_NOT_FOUND', 'The requested robot scenario is not available.');

  let frames;
  if (mode === 'scenario') {
    const start = Number(rows[0].PLAYBACK_MS);
    frames = rows.map((row) => toFrame(row, Number(row.PLAYBACK_MS) - start));
  } else {
    frames = rows.map((row) => toFrame(row, Number(row.PLAYBACK_MS)));
    if (frames.length !== Number(run.FRAME_COUNT)) {
      throw appError(500, 'TRAJECTORY_INCOMPLETE', 'The latest robot dataset is incomplete. Run ./scripts/seed.js again.');
    }
  }
  const durationMs = frames[frames.length - 1].tMs;
  return {
    model: 'iiwa7-r800', mode, runId: run.RUN_ID, source: publicSource(),
    durationMs, originalDurationMs: mode === 'full' ? Number(run.DURATION_MS) : durationMs, frames
  };
}

function studioTrajectory(config, modelId, motionId) {
  const modelSpec = model(modelId);
  const motionSpec = motion(motionId);
  if (!modelSpec) throw appError(400, 'INVALID_MODEL', 'Unknown robot model.');
  if (!motionSpec || !generatedFrames(modelId, motionId)) {
    throw appError(400, 'INVALID_MOTION', 'This motion is not available for the selected model.');
  }
  return withConnection(config, (connection) => {
    const run = latestRun(connection, PUBLIC_RUN_NAME);
    if (!run) throw appError(404, 'TRAJECTORY_NOT_FOUND', 'Run ./scripts/seed.js to load robot motion data.');
    let rows;
    try {
      rows = queryAll(connection,
        `SELECT VALUE, J2, J3, J4, J5, J6, J7, USER_NO, TASK_NO, SCENARIO_ID, PLAYBACK_MS
         FROM ${MOTION_TABLE}
         WHERE NAME = ? AND TIME BETWEEN ? AND ?
         ORDER BY TIME, SAMPLE_NO`, run.RUN_ID + '/studio/' + modelId + '/' + motionId, run.START_TIME, run.END_TIME);
    } catch (_) {
      throw appError(500, 'TRAJECTORY_QUERY_FAILED', 'Unable to read the studio motion.');
    }
    const expectedFrames = generatedFrames(modelId, motionId).length;
    if (rows.length !== expectedFrames) {
      throw appError(500, 'TRAJECTORY_INCOMPLETE', 'The latest studio motion is incomplete. Run ./scripts/seed.js again.');
    }
    const dof = modelSpec.dof;
    return {
      model: modelId, mode: 'studio', motion: motionId, runId: run.RUN_ID,
      source: { kind: 'generated', title: 'Neo Robot Motion Lab generated motion', license: 'Project license', sampleRateHz: 10 },
      durationMs: motionSpec.durationMs, originalDurationMs: motionSpec.durationMs,
      frames: rows.map((row) => ({
        tMs: Number(row.PLAYBACK_MS), user: 0, task: 0, scenario: motionId,
        joints: [row.VALUE, row.J2, row.J3, row.J4, row.J5, row.J6, row.J7].slice(0, dof).map(Number)
      }))
    };
  });
}

function trajectory(config, query) {
  const mode = query.get('mode') || 'full';
  if (!['full', 'scenario', 'studio'].includes(mode)) {
    throw appError(400, 'INVALID_MODE', 'mode must be full, scenario, or studio.');
  }
  if (mode === 'studio') {
    return studioTrajectory(config, query.get('model') || 'kr6-r900-2', query.get('motion') || 'showcase');
  }
  const user = Number(query.get('user'));
  const task = Number(query.get('task'));
  if (mode === 'scenario' && (!Number.isInteger(user) || user < 1 || user > 30 || !Number.isInteger(task) || task < 1 || task > 15)) {
    throw appError(400, 'INVALID_SCENARIO', 'user must be 1-30 and task must be 1-15.');
  }
  return withConnection(config, (connection) => publicTrajectory(connection, mode, user, task));
}

module.exports = { robots, scenarios, trajectory };
