'use strict';

const http = require('http');
const fs = require('fs');
const process = require('process');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function orderedFrames(frames, dof) {
  let previous = -1;
  frames.forEach((frame) => {
    assert(Number.isFinite(frame.tMs) && frame.tMs >= previous, 'frames must be in time order');
    assert(Array.isArray(frame.joints) && frame.joints.length === dof, 'unexpected joint count');
    assert(frame.joints.every(Number.isFinite), 'joint values must be finite');
    previous = frame.tMs;
  });
}

function run(base, reportFile) {
  let datasetState = { lerobot: false };
  const checks = [
    { path: '/api/health', status: 200, verify: (body) => assert(body.ok && body.data.version === '0.2.0', 'missing app identity') },
    { path: '/api/datasets', status: 200, verify: (body) => {
      assert(body.ok && body.data.publicMotion === true, 'public motion data should be loaded');
      assert(typeof body.data.lerobot === 'boolean' && Object.keys(body.data).sort().join(',') === 'lerobot,publicMotion', 'invalid dataset status');
      datasetState = body.data;
    } },
    { path: '/api/robots', status: 200, verify: (body) => {
      assert(body.ok && body.data.models.length === 3, 'expected three robot models');
      assert(body.data.playback.frameCount === 33271 && body.data.playback.scenarioCount === 450, 'unexpected dataset summary');
    } },
    { path: '/api/scenarios', status: 200, verify: (body) => {
      assert(body.ok && body.data.scenarios.length === 450, 'expected 450 scenarios');
      assert(body.data.frameCount === 33271, 'expected all public frames');
    } },
    { path: '/api/trajectory?mode=scenario&user=1&task=1', status: 200, verify: (body) => {
      assert(body.ok && body.data.frames.length === 82, 'unexpected User 1 scenario 1 size');
      orderedFrames(body.data.frames, 7);
    } },
    { path: '/api/trajectory?mode=studio&model=kr6-r900-2&motion=showcase', status: 200, verify: (body) => {
      assert(body.ok && body.data.frames.length === 121, 'unexpected showcase size');
      orderedFrames(body.data.frames, 6);
    } },
    { path: '/api/lerobot/episodes', status: () => datasetState.lerobot ? 200 : 404, verify: (body) => {
      if (datasetState.lerobot) assert(body.ok && body.data.episodeCount === 3000 && body.data.frameCount === 149985, 'invalid LeRobot catalog');
      else assert(body.error.code === 'LEROBOT_NOT_LOADED', 'expected LeRobot setup error');
    } },
    { path: '/api/lerobot/trajectory?episode=0', status: () => datasetState.lerobot ? 200 : 404, verify: (body) => {
      if (datasetState.lerobot) {
        assert(body.ok && body.data.frames.length > 0 && body.data.frames[0].state.length === 7, 'invalid LeRobot episode');
        assert(body.data.source.stateLayout.join(',') === 'x,y,z,qx,qy,qz,qw', 'invalid LeRobot state layout');
      }
      else assert(body.error.code === 'LEROBOT_NOT_LOADED', 'expected LeRobot setup error');
    } },
    { path: '/api/trajectory?mode=full', status: 200, verify: (body) => {
      assert(body.ok && body.data.frames.length === 33271, 'full playback must contain every frame');
      orderedFrames(body.data.frames, 7);
      assert(body.data.source.license === 'CC BY 4.0', 'missing public dataset attribution');
    } },
    { path: '/api/trajectory?mode=unknown', status: 400, verify: (body) => assert(body.error.code === 'INVALID_MODE', 'expected INVALID_MODE') },
    { path: '/api/trajectory?mode=scenario&user=0&task=16', status: 400, verify: (body) => assert(body.error.code === 'INVALID_SCENARIO', 'expected INVALID_SCENARIO') }
  ];

  function next(index) {
    if (index === checks.length) {
      fs.writeFileSync(reportFile, JSON.stringify({ ok: true, passed: checks.length }));
      console.println('PASS: ' + checks.length + ' robot API checks');
      return;
    }
    const check = checks[index];
    const request = http.get(base + check.path, (response) => {
      try {
        const expectedStatus = typeof check.status === 'function' ? check.status() : check.status;
        assert(response.statusCode === expectedStatus, check.path + ': HTTP ' + response.statusCode);
        check.verify(response.json());
        console.println('PASS:', check.path);
        next(index + 1);
      } catch (error) {
        console.println('FAIL:', error.message);
      }
    });
    request.on('error', (error) => console.println('FAIL:', error.message));
  }
  next(0);
}

if (process.argv.length !== 4) {
  console.println('Run ./scripts/check.js instead.');
  process.exit(1);
}
run(process.argv[2], process.argv[3]);
