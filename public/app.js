import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { ColladaLoader } from 'three/addons/loaders/ColladaLoader.js';
import { ROBOT_MODELS, DEG, RAD } from './robot-models.js';

const $ = (id) => document.getElementById(id);
const ui = {};
[
  'server-status', 'stage', 'robot-canvas', 'loading', 'loading-detail', 'stage-error', 'retry',
  'play', 'timeline', 'speed', 'current-time', 'duration', 'mode-label', 'scenario-label',
  'robot-name', 'robot-spec', 'joint-controls', 'manual-state', 'tool-position', 'data-status',
  'full-options', 'scenario-options', 'studio-options', 'user-select', 'task-select',
  'scenario-info', 'motion-select', 'skip-idle', 'toggle-target', 'reset-camera',
  'source-title', 'source-link', 'joint-chart', 'chart-overview', 'chart-viewport', 'chart-tooltip',
  'chart-legend', 'chart-current', 'chart-range', 'chart-zoom-out', 'chart-zoom-in',
  'chart-reset', 'chart-follow', 'teach-motion', 'teach-options', 'teach-poses', 'teach-status',
  'capture-pose', 'undo-pose', 'preview-motion', 'save-motion', 'saved-motion'
].forEach((id) => { ui[id] = $(id); });

const state = {
  modelId: 'iiwa7-r800', mode: 'full', motion: 'showcase', robot: null,
  trajectory: null, frames: [], durationMs: 0, timeMs: 0, playing: false,
  speed: 10, lastFrameAt: performance.now(), scenarios: [], loadToken: 0,
  targetVisible: false, trail: [], lastChartAt: 0,
  chartStartMs: 0, chartEndMs: 0, chartFollow: true, chartHoverMs: null, chartMaxAbs: 1,
  teach: { keyframes: [], saving: false }
};

const assetCache = new Map();
const trajectoryCache = new Map();
const stlLoader = new STLLoader();
const colladaLoader = new ColladaLoader();
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const colors = ['#ff6b18', '#5de4d3', '#64a9ff', '#f6d365', '#b98cff', '#ff7597', '#a6ef67'];
const chartInteraction = { pointers: new Map(), drag: null, pinch: null, overviewDrag: null };
const CHART_MIN_WINDOW_MS = 1000;
const CHART_ZOOM_FACTOR = 1.5;
// Preserve the source signal while keeping non-iiwa playback inside model-safe poses.
const PUBLIC_MOTION_RANGE = [[-80, 15], [44, 82], [19, 80], [-102, -15], [-76, -17], [48, 95], [-30, 75]];
let renderer, scene, camera, orbit, transform, transformHelper, target, trailLine, part;

async function requestJson(url, options) {
  const response = await fetch(url, { cache: 'no-store', ...options });
    const body = await response.json();
    if (!response.ok || !body.ok) {
      const error = new Error(body.error ? body.error.message : 'Unable to process the request.');
      error.code = body.error && body.error.code;
      throw error;
    }
    return body.data;
}

async function getJson(url) {
  if (trajectoryCache.has(url)) return trajectoryCache.get(url);
  const request = requestJson(url);
  trajectoryCache.set(url, request);
  try { return await request; } catch (error) { trajectoryCache.delete(url); throw error; }
}

function postJson(url, data) {
  return requestJson(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
}

function quaternionFromRpy(rpy) {
  const qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), rpy[0] || 0);
  const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rpy[1] || 0);
  const qz = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), rpy[2] || 0);
  return qz.multiply(qy).multiply(qx);
}

function configureMesh(object, color) {
  object.traverse((child) => {
    if (!child.isMesh) return;
    if (color != null) child.material = new THREE.MeshStandardMaterial({ color, roughness: .42, metalness: .18 });
    else if (child.material) {
      child.material = child.material.clone();
      child.material.roughness = .42;
      child.material.metalness = .12;
    }
    child.castShadow = true;
    child.receiveShadow = true;
  });
  return object;
}

async function loadVisual(model, spec) {
  const url = model.assetRoot + spec.file;
  if (!assetCache.has(url)) {
    assetCache.set(url, (async () => {
      if (model.format === 'stl') {
        const geometry = await stlLoader.loadAsync(url);
        geometry.computeVertexNormals();
        return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: spec.color || 0xf47721, roughness: .42, metalness: .18 }));
      }
      return (await colladaLoader.loadAsync(url)).scene;
    })());
  }
  const object = (await assetCache.get(url)).clone(true);
  configureMesh(object, model.format === 'stl' ? spec.color : null);
  object.position.fromArray(spec.visualXyz || [0, 0, 0]);
  object.quaternion.copy(quaternionFromRpy(spec.visualRpy || [0, 0, 0]));
  object.scale.setScalar(model.scale || 1);
  return object;
}

function createTool() {
  const group = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x232a2e, metalness: .65, roughness: .3 });
  const glow = new THREE.MeshStandardMaterial({ color: 0xff6b18, emissive: 0x7a2400, emissiveIntensity: .55 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(.032, .045, .075, 20), dark);
  body.rotation.x = Math.PI / 2;
  const left = new THREE.Mesh(new THREE.BoxGeometry(.012, .065, .018), glow);
  const right = left.clone();
  left.position.set(-.027, 0, -.045); right.position.set(.027, 0, -.045);
  group.add(body, left, right);
  group.traverse((node) => { if (node.isMesh) node.castShadow = true; });
  return group;
}

async function buildRobot(modelId) {
  const token = ++state.loadToken;
  const model = ROBOT_MODELS[modelId];
  showLoading('Loading ' + model.name + '…');
  const parts = [model.base, ...model.joints];
  const visuals = [];
  for (let index = 0; index < parts.length; index++) {
    visuals.push(await loadVisual(model, parts[index]));
    if (token !== state.loadToken) return false;
    ui['loading-detail'].textContent = '3D assets ' + (index + 1) + ' / ' + parts.length;
  }
  if (state.robot) scene.remove(state.robot.root);
  const root = new THREE.Group();
  root.name = model.id;
  root.add(visuals[0]);
  const joints = [];
  let parent = root;
  model.joints.forEach((spec, index) => {
    const pivot = new THREE.Group();
    pivot.position.fromArray(spec.xyz);
    pivot.quaternion.copy(quaternionFromRpy(spec.rpy));
    const rotor = new THREE.Group();
    pivot.add(rotor);
    rotor.add(visuals[index + 1]);
    parent.add(pivot);
    joints.push({ spec, pivot, rotor, axis: new THREE.Vector3().fromArray(spec.axis).normalize(), angle: 0 });
    parent = rotor;
  });
  const tool = new THREE.Group();
  tool.position.fromArray(model.tool.xyz);
  tool.quaternion.copy(quaternionFromRpy(model.tool.rpy));
  tool.add(createTool());
  parent.add(tool);
  scene.add(root);
  state.robot = { root, joints, tool, model };
  createJointControls();
  setPose(model.home.map((value) => value * DEG));
  setCamera(model.camera, !reduceMotion);
  target.position.copy(tool.getWorldPosition(new THREE.Vector3()));
  target.position.z = Math.max(.08, target.position.z);
  clearTrail();
  hideLoading();
  return true;
}

function setPose(values, updateControls = true) {
  if (!state.robot) return;
  state.robot.joints.forEach((joint, index) => {
    const value = THREE.MathUtils.clamp(Number(values[index] || 0), joint.spec.min * DEG, joint.spec.max * DEG);
    joint.angle = value;
    joint.rotor.quaternion.setFromAxisAngle(joint.axis, value);
    if (updateControls && joint.input) {
      joint.input.value = String(value * RAD);
      joint.output.value = (value * RAD).toFixed(1) + '°';
    }
  });
  state.robot.root.updateMatrixWorld(true);
  const p = state.robot.tool.getWorldPosition(new THREE.Vector3()).multiplyScalar(1000);
  ui['tool-position'].textContent = [p.x, p.y, p.z].map((v) => Math.round(v)).join(' · ') + ' mm';
}

function createJointControls() {
  ui['joint-controls'].replaceChildren();
  ui['chart-legend'].replaceChildren();
  state.robot.joints.forEach((joint, index) => {
    const row = document.createElement('div'); row.className = 'joint-row';
    const label = document.createElement('label'); label.textContent = 'J' + (index + 1);
    const input = document.createElement('input'); input.type = 'range'; input.min = joint.spec.min; input.max = joint.spec.max; input.step = '.1';
    const output = document.createElement('output');
    input.addEventListener('input', () => {
      pause(); ui['manual-state'].textContent = 'MANUAL';
      const values = state.robot.joints.map((item) => item.angle); values[index] = Number(input.value) * DEG;
      setPose(values); target.position.copy(state.robot.tool.getWorldPosition(new THREE.Vector3())); clearTrail();
    });
    row.append(label, input, output); ui['joint-controls'].appendChild(row);
    joint.input = input; joint.output = output;
  });
  updateChartLegend();
}

function updateChartLegend() {
  ui['chart-legend'].replaceChildren();
  const labels = state.robot ? state.robot.joints.map((_, index) => 'J' + (index + 1)) : [];
  labels.forEach((label, index) => {
    const legend = document.createElement('span'); legend.innerHTML = '<i style="background:' + colors[index] + '"></i>' + label;
    ui['chart-legend'].appendChild(legend);
  });
}

function initScene() {
  try {
    renderer = new THREE.WebGLRenderer({ canvas: ui['robot-canvas'], antialias: true, alpha: true });
  } catch (error) {
    showError('WebGL is not available in this browser.'); throw error;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
  renderer.shadowMap.enabled = innerWidth > 640;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a0e11, .42);
  camera = new THREE.PerspectiveCamera(38, 1, .01, 30); camera.up.set(0, 0, 1);
  orbit = new OrbitControls(camera, renderer.domElement); orbit.enableDamping = true; orbit.dampingFactor = .07; orbit.minDistance = .55; orbit.maxDistance = 5;
  scene.add(new THREE.HemisphereLight(0xaad4ef, 0x1a1715, 2.1));
  const key = new THREE.DirectionalLight(0xffe9d2, 5.4); key.position.set(2.4, 1.3, 3); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); scene.add(key);
  const rim = new THREE.PointLight(0xff5b12, 14, 4); rim.position.set(-1.4, -1.2, 1.6); scene.add(rim);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(2.8, 64), new THREE.MeshStandardMaterial({ color: 0x151b1e, roughness: .72, metalness: .12 })); floor.receiveShadow = true; scene.add(floor);
  const grid = new THREE.GridHelper(5, 30, 0x43515a, 0x253038); grid.rotation.x = Math.PI / 2; grid.position.z = .002; grid.material.opacity = .35; grid.material.transparent = true; scene.add(grid);
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(.29, .36, .12, 40), new THREE.MeshStandardMaterial({ color: 0x252c30, metalness: .65, roughness: .32 })); pedestal.rotation.x = Math.PI / 2; pedestal.position.z = -.06; pedestal.receiveShadow = true; scene.add(pedestal);
  target = new THREE.Mesh(new THREE.SphereGeometry(.035, 20, 14), new THREE.MeshStandardMaterial({ color: 0x5de4d3, emissive: 0x197b70, emissiveIntensity: 1.2 })); target.visible = false; scene.add(target);
  transform = new TransformControls(camera, renderer.domElement); transform.setSize(.65); transform.attach(target); transformHelper = transform.getHelper(); transformHelper.visible = false; scene.add(transformHelper);
  transform.addEventListener('dragging-changed', (event) => { orbit.enabled = !event.value; });
  transform.addEventListener('objectChange', () => { pause(); ui['manual-state'].textContent = 'IK TARGET'; solveIk(target.position); clearTrail(); });
  const trailGeometry = new THREE.BufferGeometry();
  trailGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(160 * 3), 3).setUsage(THREE.DynamicDrawUsage));
  trailGeometry.setDrawRange(0, 0);
  trailLine = new THREE.Line(trailGeometry, new THREE.LineBasicMaterial({ color: 0x5de4d3, transparent: true, opacity: .72 })); scene.add(trailLine);
  part = new THREE.Mesh(new THREE.BoxGeometry(.075, .075, .075), new THREE.MeshStandardMaterial({ color: 0xff6b18, emissive: 0x6b2100, emissiveIntensity: .4 })); part.position.set(-.42, .25, .04); part.castShadow = true; part.visible = false; scene.add(part);
  renderer.setAnimationLoop(animate);
  addEventListener('resize', resize); resize();
}

function solveIk(goal) {
  if (!state.robot) return;
  const joints = state.robot.joints;
  let reached = false;
  for (let iteration = 0; iteration < 24; iteration++) {
    state.robot.root.updateMatrixWorld(true);
    const end = state.robot.tool.getWorldPosition(new THREE.Vector3());
    const error = goal.clone().sub(end);
    if (error.length() < .004) { reached = true; break; }
    const columns = joints.map((joint) => {
      const position = joint.pivot.getWorldPosition(new THREE.Vector3());
      const quaternion = joint.pivot.getWorldQuaternion(new THREE.Quaternion());
      const axis = joint.axis.clone().applyQuaternion(quaternion).normalize();
      return axis.cross(end.clone().sub(position));
    });
    const a = [[.0064, 0, 0], [0, .0064, 0], [0, 0, .0064]];
    columns.forEach((c) => {
      a[0][0] += c.x * c.x; a[0][1] += c.x * c.y; a[0][2] += c.x * c.z;
      a[1][0] += c.y * c.x; a[1][1] += c.y * c.y; a[1][2] += c.y * c.z;
      a[2][0] += c.z * c.x; a[2][1] += c.z * c.y; a[2][2] += c.z * c.z;
    });
    const inverse = invert3(a); if (!inverse) break;
    const v = multiply3(inverse, error);
    joints.forEach((joint, index) => {
      const delta = THREE.MathUtils.clamp(columns[index].dot(v) * .72, -.12, .12);
      joint.angle = THREE.MathUtils.clamp(joint.angle + delta, joint.spec.min * DEG, joint.spec.max * DEG);
      joint.rotor.quaternion.setFromAxisAngle(joint.axis, joint.angle);
    });
  }
  setPose(joints.map((joint) => joint.angle));
  target.material.color.set(reached ? 0x5de4d3 : 0xff5555);
}

function invert3(m) {
  const a=m[0][0],b=m[0][1],c=m[0][2],d=m[1][0],e=m[1][1],f=m[1][2],g=m[2][0],h=m[2][1],i=m[2][2];
  const det=a*(e*i-f*h)-b*(d*i-f*g)+c*(d*h-e*g); if(Math.abs(det)<1e-9)return null;
  return [[(e*i-f*h)/det,(c*h-b*i)/det,(b*f-c*e)/det],[(f*g-d*i)/det,(a*i-c*g)/det,(c*d-a*f)/det],[(d*h-e*g)/det,(b*g-a*h)/det,(a*e-b*d)/det]];
}

function multiply3(m, v) { return new THREE.Vector3(m[0][0]*v.x+m[0][1]*v.y+m[0][2]*v.z,m[1][0]*v.x+m[1][1]*v.y+m[1][2]*v.z,m[2][0]*v.x+m[2][1]*v.y+m[2][2]*v.z); }

function setTargetVisible(visible) {
  state.targetVisible = Boolean(visible);
  target.visible = state.targetVisible;
  transformHelper.visible = state.targetVisible;
  ui['toggle-target'].classList.toggle('active', state.targetVisible);
  if (state.targetVisible && state.robot) target.position.copy(state.robot.tool.getWorldPosition(new THREE.Vector3()));
}

function setCamera(spec, animateMove) {
  const end = new THREE.Vector3().fromArray(spec.position), targetPosition = new THREE.Vector3().fromArray(spec.target);
  if (!animateMove) { camera.position.copy(end); orbit.target.copy(targetPosition); orbit.update(); return; }
  const start = camera.position.clone(), startTarget = orbit.target.clone(), began = performance.now();
  function move(now) { const t = Math.min(1, (now - began) / 650); const e = t * t * (3 - 2 * t); camera.position.lerpVectors(start, end, e); orbit.target.lerpVectors(startTarget, targetPosition, e); if (t < 1) requestAnimationFrame(move); }
  requestAnimationFrame(move);
}

function prepareFrames(data) {
  let playback = 0;
  return data.frames.map((frame, index) => {
    if (index) {
      const previous = data.frames[index - 1];
      let delta = frame.tMs - previous.tMs;
      if (state.mode === 'full' && ui['skip-idle'].checked && frame.scenario !== previous.scenario && delta > 600) delta = 600;
      playback += Math.max(0, delta);
    }
    return { ...frame, playTMs: state.mode === 'full' && ui['skip-idle'].checked ? playback : frame.tMs };
  });
}

function installTrajectory(data, status, autoPlay) {
  state.trajectory = data;
  state.frames = prepareFrames(data);
  state.durationMs = state.frames.length ? state.frames.at(-1).playTMs : 0;
  state.timeMs = 0;
  ui.timeline.max = String(Math.max(1, state.durationMs));
  ui.timeline.value = '0';
  ui['current-time'].textContent = formatTime(0);
  ui.duration.textContent = formatTime(state.durationMs);
  computeChartMetadata();
  resetChartView();
  updateSource(data.source);
  clearTrail();
  if (state.frames.length) {
    applyFrame(state.frames[0]);
    updateScenarioLabel({ meta: state.frames[0] });
  }
  ui['data-status'].textContent = status;
  if (autoPlay && !reduceMotion) play(); else pause();
  drawChart(true);
}

async function loadTrajectory() {
  const token = ++state.loadToken;
  let url;
  if (state.mode === 'full') url = './api/trajectory?mode=full';
  else if (state.mode === 'scenario') url = './api/trajectory?mode=scenario&user=' + ui['user-select'].value + '&task=' + ui['task-select'].value;
  else url = './api/trajectory?mode=studio&model=' + state.modelId + '&motion=' + ui['motion-select'].value;
  showLoading(state.mode === 'full' ? 'Loading all 33,271 frames…' : 'Loading motion data…');
  try {
    const data = await getJson(url); if (token !== state.loadToken) return;
    state.speed = state.mode === 'full' ? 10 : 1; ui.speed.value = String(state.speed);
    installTrajectory(data, data.frames.length.toLocaleString() + ' frames ready' + (usesPublicRetarget() ? ' · retargeted' : ''), true);
    hideLoading();
  } catch (error) { if (token === state.loadToken) { hideLoading(); showError(error.message); ui['data-status'].textContent = error.code || 'Load failed'; } }
}

function frameAt(time) {
  if (!state.frames.length) return null;
  let low = 0, high = state.frames.length - 1;
  while (low < high) { const mid = Math.ceil((low + high) / 2); if (state.frames[mid].playTMs <= time) low = mid; else high = mid - 1; }
  const first = state.frames[low], second = state.frames[Math.min(low + 1, state.frames.length - 1)];
  const span = second.playTMs - first.playTMs, amount = span ? THREE.MathUtils.clamp((time - first.playTMs) / span, 0, 1) : 0;
  const result = { meta: amount < .5 ? first : second };
  if (first.joints) result.joints = first.joints.map((value, index) => value + ((second.joints[index] ?? value) - value) * amount);
  if (first.state) result.state = first.state.map((value, index) => value + ((second.state[index] ?? value) - value) * amount);
  return result;
}

function applyFrame(frame) {
  if (!frame || !state.robot) return;
  target.visible = state.targetVisible;
  setPose(retargetPublicPose(frame.joints));
}

function usesPublicRetarget() {
  return ['full', 'scenario'].includes(state.mode) && Boolean(state.robot && state.robot.model.publicMotionRange);
}

function retargetPublicPose(values) {
  const ranges = state.robot && state.robot.model.publicMotionRange;
  if (!usesPublicRetarget() || !ranges) return values;
  return ranges.map((targetRange, index) => {
    const sourceRange = PUBLIC_MOTION_RANGE[index];
    const sourceDegrees = Number(values[index] || 0) * RAD;
    const amount = clamp((sourceDegrees - sourceRange[0]) / (sourceRange[1] - sourceRange[0]), 0, 1);
    return (targetRange[0] + (targetRange[1] - targetRange[0]) * amount) * DEG;
  });
}

function animate(now) {
  const delta = Math.min(100, now - state.lastFrameAt); state.lastFrameAt = now;
  if (state.playing && state.frames.length) {
    state.timeMs += delta * state.speed;
    if (state.timeMs >= state.durationMs) state.timeMs = 0;
    const frame = frameAt(state.timeMs);
    applyFrame(frame);
    ui.timeline.value = String(Math.round(state.timeMs)); ui['current-time'].textContent = formatTime(state.timeMs); updateScenarioLabel(frame);
    if (state.chartFollow && chartWindowMs() < state.durationMs) centerChartOn(state.timeMs);
    updatePart(); addTrailPoint(); if (now - state.lastChartAt > 100) { drawChart(); state.lastChartAt = now; }
  }
  orbit.update(); renderer.render(scene, camera);
}

function updatePart() {
  const pick = state.mode === 'studio' && ui['motion-select'].value === 'pick-place'; part.visible = pick; if (!pick || !state.robot) return;
  const progress = state.durationMs ? state.timeMs / state.durationMs : 0;
  if (progress < .24) part.position.set(-.42, .25, .04);
  else if (progress < .72) part.position.copy(state.robot.tool.getWorldPosition(new THREE.Vector3())).add(new THREE.Vector3(0, 0, -.055));
  else part.position.set(.42, .25, .04);
}

function addTrailPoint() { if (!state.robot) return; const p=state.robot.tool.getWorldPosition(new THREE.Vector3()); if(!state.trail.length||p.distanceTo(state.trail.at(-1))>.008){state.trail.push(p);if(state.trail.length>160)state.trail.shift();const attribute=trailLine.geometry.getAttribute('position');state.trail.forEach((point,index)=>attribute.setXYZ(index,point.x,point.y,point.z));attribute.needsUpdate=true;trailLine.geometry.setDrawRange(0,state.trail.length);} }
function clearTrail() { state.trail=[]; if(trailLine)trailLine.geometry.setDrawRange(0,0); }

function chartValues(frame) { return frame.joints; }
function chartSeriesCount() { return state.robot.joints.length; }
function chartWindowMs() { return Math.max(0, state.chartEndMs - state.chartStartMs); }
function minimumChartWindow() { return Math.min(Math.max(0, state.durationMs), CHART_MIN_WINDOW_MS); }
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }

function formatChartTime(ms) {
  const total = Math.max(0, Math.round(ms));
  const hours = Math.floor(total / 3600000);
  const minutes = Math.floor(total % 3600000 / 60000);
  const seconds = Math.floor(total % 60000 / 1000);
  const millis = total % 1000;
  return (hours ? String(hours).padStart(2, '0') + ':' : '') + String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0') + '.' + String(millis).padStart(3, '0');
}

function setChartFollow(enabled) {
  state.chartFollow = Boolean(enabled);
  ui['chart-follow'].classList.toggle('active', state.chartFollow);
  ui['chart-follow'].setAttribute('aria-pressed', String(state.chartFollow));
}

function updateChartReadout() {
  const duration = Math.max(0, state.durationMs);
  const span = Math.max(1, chartWindowMs());
  const zoom = duration ? duration / span : 1;
  ui['chart-current'].textContent = formatChartTime(state.timeMs);
  ui['chart-range'].textContent = formatChartTime(state.chartStartMs) + ' – ' + formatChartTime(state.chartEndMs) + ' · ' + zoom.toFixed(1) + '×';
  const disabled = !state.frames.length;
  ui['chart-zoom-out'].disabled = disabled || span >= duration;
  ui['chart-zoom-in'].disabled = disabled || span <= minimumChartWindow();
  ui['chart-reset'].disabled = disabled;
  ui['chart-follow'].disabled = disabled;
}

function setChartView(startMs, endMs, manual) {
  const duration = Math.max(0, state.durationMs);
  if (!duration) {
    state.chartStartMs = 0; state.chartEndMs = 0;
    updateChartReadout(); return;
  }
  let span = clamp(endMs - startMs, minimumChartWindow(), duration);
  let start = clamp(startMs, 0, duration - span);
  if (endMs > duration && startMs >= 0) start = duration - span;
  state.chartStartMs = start;
  state.chartEndMs = start + span;
  if (manual) setChartFollow(false);
  updateChartReadout();
}

function centerChartOn(timeMs) {
  const span = chartWindowMs() || state.durationMs;
  const start = clamp(timeMs - span / 2, 0, Math.max(0, state.durationMs - span));
  state.chartStartMs = start; state.chartEndMs = start + span;
}

function resetChartView() {
  state.chartStartMs = 0;
  state.chartEndMs = Math.max(0, state.durationMs);
  state.chartHoverMs = null;
  ui['chart-tooltip'].hidden = true;
  setChartFollow(true);
  updateChartReadout();
}

function zoomChart(factor, anchorMs, manual) {
  if (!state.durationMs) return;
  const oldSpan = chartWindowMs() || state.durationMs;
  const newSpan = clamp(oldSpan / factor, minimumChartWindow(), state.durationMs);
  const anchor = clamp(anchorMs, state.chartStartMs, state.chartEndMs);
  const portion = oldSpan ? (anchor - state.chartStartMs) / oldSpan : .5;
  setChartView(anchor - newSpan * portion, anchor + newSpan * (1 - portion), manual);
  if (!manual && state.chartFollow) centerChartOn(anchorMs);
  drawChart();
}

function lowerFrameIndex(timeMs) {
  let low = 0, high = state.frames.length;
  while (low < high) { const mid = Math.floor((low + high) / 2); if (state.frames[mid].playTMs < timeMs) low = mid + 1; else high = mid; }
  return Math.min(low, state.frames.length - 1);
}

function nearestFrameIndex(timeMs) {
  const next = lowerFrameIndex(timeMs);
  const previous = Math.max(0, next - 1);
  return Math.abs(state.frames[next].playTMs - timeMs) < Math.abs(state.frames[previous].playTMs - timeMs) ? next : previous;
}

function computeChartMetadata() {
  state.chartMaxAbs = Math.PI * 1.25;
}

function sizeChartCanvas(canvas, force) {
  const rect = canvas.getBoundingClientRect();
  const ratio = Math.min(devicePixelRatio, 1.5);
  const width = Math.max(300, Math.round(rect.width * ratio));
  const height = Math.max(1, Math.round(rect.height * ratio));
  if (force || canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  return { rect, ratio, width, height };
}

function drawSeries(context, width, plotHeight, startMs, endMs, startIndex, endIndex, step, alpha) {
  const span = Math.max(1, endMs - startMs);
  context.globalAlpha = alpha;
  for (let series = 0; series < chartSeriesCount(); series++) {
    context.strokeStyle = colors[series]; context.lineWidth = 1.35; context.beginPath();
    let first = true;
    for (let index = startIndex; index <= endIndex; index += step) {
      const frame = state.frames[index];
      const x = (frame.playTMs - startMs) / span * width;
      const y = plotHeight / 2 - (chartValues(frame)[series] || 0) / state.chartMaxAbs * plotHeight * .43;
      if (first) { context.moveTo(x, y); first = false; } else context.lineTo(x, y);
    }
    if ((endIndex - startIndex) % step) {
      const frame = state.frames[endIndex];
      context.lineTo((frame.playTMs - startMs) / span * width, plotHeight / 2 - (chartValues(frame)[series] || 0) / state.chartMaxAbs * plotHeight * .43);
    }
    context.stroke();
  }
  context.globalAlpha = 1;
}

function drawOverview(force) {
  if (!state.frames.length || !state.robot) return;
  const canvas = ui['chart-overview'];
  const { ratio, width, height } = sizeChartCanvas(canvas, force);
  const context = canvas.getContext('2d'); context.clearRect(0, 0, width, height);
  const step = Math.max(1, Math.floor(state.frames.length / width));
  drawSeries(context, width, height, 0, state.durationMs, 0, state.frames.length - 1, step, .48);
  const startX = state.chartStartMs / Math.max(1, state.durationMs) * width;
  const endX = state.chartEndMs / Math.max(1, state.durationMs) * width;
  context.fillStyle = '#050708a8'; context.fillRect(0, 0, startX, height); context.fillRect(endX, 0, width - endX, height);
  context.strokeStyle = '#5de4d3'; context.lineWidth = 1.5 * ratio; context.strokeRect(startX, .75 * ratio, Math.max(2 * ratio, endX - startX), height - 1.5 * ratio);
  const playhead = state.timeMs / Math.max(1, state.durationMs) * width;
  context.strokeStyle = '#fff'; context.globalAlpha = .9; context.beginPath(); context.moveTo(playhead, 0); context.lineTo(playhead, height); context.stroke(); context.globalAlpha = 1;
}

function drawChart(force) {
  if (!state.frames.length || !state.robot) {
    [ui['joint-chart'], ui['chart-overview']].forEach((canvas) => {
      const { width, height } = sizeChartCanvas(canvas, force);
      canvas.getContext('2d').clearRect(0, 0, width, height);
    });
    updateChartReadout();
    return;
  }
  const canvas = ui['joint-chart'];
  const { rect, ratio, width, height } = sizeChartCanvas(canvas, force);
  const context = canvas.getContext('2d'); context.clearRect(0, 0, width, height);
  const labelHeight = 19 * ratio, plotHeight = height - labelHeight;
  context.strokeStyle = '#273036'; context.lineWidth = 1;
  for (let row = 1; row < 5; row++) { context.beginPath(); context.moveTo(0, row * plotHeight / 5); context.lineTo(width, row * plotHeight / 5); context.stroke(); }
  context.fillStyle = '#697278'; context.font = 8 * ratio + 'px ui-monospace, monospace';
  const tickCount = rect.width < 520 ? 2 : 5;
  for (let column = 0; column <= tickCount; column++) {
    const x = column * width / tickCount;
    context.strokeStyle = '#20272b'; context.beginPath(); context.moveTo(x, 0); context.lineTo(x, plotHeight); context.stroke();
    context.textAlign = column === 0 ? 'left' : column === tickCount ? 'right' : 'center';
    context.fillText(formatChartTime(state.chartStartMs + chartWindowMs() * column / tickCount), x, height - 5 * ratio);
  }
  const first = Math.max(0, lowerFrameIndex(state.chartStartMs) - 1);
  const last = Math.min(state.frames.length - 1, lowerFrameIndex(state.chartEndMs) + 1);
  const step = Math.max(1, Math.floor((last - first + 1) / width));
  drawSeries(context, width, plotHeight, state.chartStartMs, state.chartEndMs, first, last, step, 1);
  if (state.timeMs >= state.chartStartMs && state.timeMs <= state.chartEndMs) {
    const x = (state.timeMs - state.chartStartMs) / Math.max(1, chartWindowMs()) * width;
    context.strokeStyle = '#fff'; context.globalAlpha = .7; context.beginPath(); context.moveTo(x, 0); context.lineTo(x, plotHeight); context.stroke(); context.globalAlpha = 1;
  }
  if (state.chartHoverMs != null && state.chartHoverMs >= state.chartStartMs && state.chartHoverMs <= state.chartEndMs) {
    const x = (state.chartHoverMs - state.chartStartMs) / Math.max(1, chartWindowMs()) * width;
    context.strokeStyle = '#5de4d3'; context.globalAlpha = .75; context.beginPath(); context.moveTo(x, 0); context.lineTo(x, plotHeight); context.stroke(); context.globalAlpha = 1;
  }
  updateChartReadout(); drawOverview(force);
}

function updateScenarioLabel(frame) {
  if (!frame || !frame.meta) return;
  if (state.mode === 'teach') ui['scenario-label'].textContent = 'Visitor motion · ' + frame.meta.scenario;
  else ui['scenario-label'].textContent = state.mode === 'full' || state.mode === 'scenario' ? 'Participant ' + frame.meta.user + ' · Scenario ' + frame.meta.task : frame.meta.scenario;
}

function seekPlayback(timeMs, shouldPause) {
  if (!state.frames.length) return;
  if (shouldPause) pause();
  state.timeMs = clamp(timeMs, 0, state.durationMs);
  ui.timeline.value = String(Math.round(state.timeMs));
  ui['current-time'].textContent = formatTime(state.timeMs);
  const frame = frameAt(state.timeMs); applyFrame(frame); updateScenarioLabel(frame);
  if (state.chartFollow && chartWindowMs() < state.durationMs) centerChartOn(state.timeMs);
  drawChart();
}

function showChartTooltip(clientX, clientY, timeMs) {
  if (!state.frames.length) return;
  const index = nearestFrameIndex(timeMs), frame = state.frames[index], values = chartValues(frame);
  state.chartHoverMs = frame.playTMs;
  const tooltip = ui['chart-tooltip']; tooltip.replaceChildren();
  const title = document.createElement('strong'); title.textContent = formatChartTime(frame.playTMs); tooltip.appendChild(title);
  const meta = document.createElement('span');
  meta.textContent = frame.user ? 'Participant ' + frame.user + ' · Scenario ' + frame.task : 'Studio · ' + frame.scenario;
  if (usesPublicRetarget()) meta.textContent += ' · iiwa source';
  tooltip.appendChild(meta);
  const labels = values.map((_, valueIndex) => 'J' + (valueIndex + 1));
  labels.forEach((label, valueIndex) => {
    const row = document.createElement('span');
    row.textContent = label + '  ' + ((values[valueIndex] || 0) * RAD).toFixed(2) + '°';
    row.style.color = colors[valueIndex]; tooltip.appendChild(row);
  });
  tooltip.hidden = false;
  const viewportRect = ui['chart-viewport'].getBoundingClientRect();
  const left = clientX - viewportRect.left + 12, top = clientY - viewportRect.top + 12;
  tooltip.style.left = Math.max(6, Math.min(left, viewportRect.width - tooltip.offsetWidth - 6)) + 'px';
  tooltip.style.top = Math.max(6, Math.min(top, viewportRect.height - tooltip.offsetHeight - 6)) + 'px';
  drawChart();
}

function chartTimeAtClientX(canvas, clientX, startMs = state.chartStartMs, endMs = state.chartEndMs) {
  const rect = canvas.getBoundingClientRect();
  return startMs + clamp((clientX - rect.left) / Math.max(1, rect.width), 0, 1) * (endMs - startMs);
}

function beginChartPointer(event) {
  const canvas = ui['joint-chart']; canvas.setPointerCapture(event.pointerId);
  chartInteraction.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (chartInteraction.pointers.size === 1) {
    chartInteraction.drag = { id: event.pointerId, x: event.clientX, start: state.chartStartMs, end: state.chartEndMs, moved: false };
    chartInteraction.pinch = null;
  } else {
    const points = [...chartInteraction.pointers.values()];
    const distance = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
    const midpointX = (points[0].x + points[1].x) / 2;
    chartInteraction.drag = null;
    chartInteraction.pinch = {
      distance: Math.max(1, distance), span: chartWindowMs(),
      anchor: chartTimeAtClientX(canvas, midpointX),
      portion: clamp((midpointX - canvas.getBoundingClientRect().left) / Math.max(1, canvas.getBoundingClientRect().width), 0, 1)
    };
  }
  canvas.classList.add('dragging'); ui['chart-tooltip'].hidden = true;
}

function moveChartPointer(event) {
  const canvas = ui['joint-chart'];
  if (!chartInteraction.pointers.has(event.pointerId)) {
    if (event.pointerType === 'mouse' && !event.buttons) showChartTooltip(event.clientX, event.clientY, chartTimeAtClientX(canvas, event.clientX));
    return;
  }
  chartInteraction.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (chartInteraction.pointers.size >= 2 && chartInteraction.pinch) {
    const points = [...chartInteraction.pointers.values()];
    const distance = Math.max(1, Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y));
    const span = clamp(chartInteraction.pinch.span * chartInteraction.pinch.distance / distance, minimumChartWindow(), state.durationMs);
    setChartView(chartInteraction.pinch.anchor - span * chartInteraction.pinch.portion, chartInteraction.pinch.anchor + span * (1 - chartInteraction.pinch.portion), true);
    drawChart(); return;
  }
  const drag = chartInteraction.drag;
  if (!drag || drag.id !== event.pointerId) return;
  const deltaX = event.clientX - drag.x;
  if (Math.abs(deltaX) > 3) drag.moved = true;
  if (!drag.moved) return;
  const deltaMs = -deltaX / Math.max(1, canvas.getBoundingClientRect().width) * (drag.end - drag.start);
  setChartView(drag.start + deltaMs, drag.end + deltaMs, true); drawChart();
}

function endChartPointer(event, cancelled) {
  const canvas = ui['joint-chart'];
  const drag = chartInteraction.drag;
  const tap = !cancelled && drag && drag.id === event.pointerId && !drag.moved && chartInteraction.pointers.size === 1;
  chartInteraction.pointers.delete(event.pointerId);
  if (!chartInteraction.pointers.size) {
    canvas.classList.remove('dragging'); chartInteraction.drag = null; chartInteraction.pinch = null;
  }
  if (tap) {
    const time = chartTimeAtClientX(canvas, event.clientX); seekPlayback(time, true); showChartTooltip(event.clientX, event.clientY, time);
  }
}

function bindChartEvents() {
  const canvas = ui['joint-chart'], overview = ui['chart-overview'];
  canvas.addEventListener('pointerdown', beginChartPointer);
  canvas.addEventListener('pointermove', moveChartPointer);
  canvas.addEventListener('pointerup', (event) => endChartPointer(event, false));
  canvas.addEventListener('pointercancel', (event) => endChartPointer(event, true));
  canvas.addEventListener('pointerleave', () => {
    if (chartInteraction.pointers.size) return;
    state.chartHoverMs = null; ui['chart-tooltip'].hidden = true; drawChart();
  });
  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    const factor = clamp(Math.exp(-event.deltaY * .002), .5, 2);
    zoomChart(factor, chartTimeAtClientX(canvas, event.clientX), true);
  }, { passive: false });
  canvas.addEventListener('keydown', (event) => {
    const center = state.chartFollow ? state.timeMs : (state.chartStartMs + state.chartEndMs) / 2;
    if (event.key === '+' || event.key === '=') zoomChart(CHART_ZOOM_FACTOR, center, false);
    else if (event.key === '-') zoomChart(1 / CHART_ZOOM_FACTOR, center, false);
    else if (event.key === 'Home' || event.key === '0') { resetChartView(); drawChart(); }
    else if (event.key.toLowerCase() === 'f') { setChartFollow(!state.chartFollow); if (state.chartFollow) centerChartOn(state.timeMs); drawChart(); }
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      const delta = chartWindowMs() * .1 * (event.key === 'ArrowLeft' ? -1 : 1);
      setChartView(state.chartStartMs + delta, state.chartEndMs + delta, true); drawChart();
    } else return;
    event.preventDefault();
  });

  overview.addEventListener('pointerdown', (event) => {
    if (!state.durationMs) return;
    overview.setPointerCapture(event.pointerId); overview.classList.add('dragging');
    const rect = overview.getBoundingClientRect();
    const pointerTime = clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1) * state.durationMs;
    const inside = pointerTime >= state.chartStartMs && pointerTime <= state.chartEndMs;
    if (!inside) setChartView(pointerTime - chartWindowMs() / 2, pointerTime + chartWindowMs() / 2, true);
    chartInteraction.overviewDrag = { id: event.pointerId, x: event.clientX, start: state.chartStartMs, end: state.chartEndMs };
    drawChart();
  });
  overview.addEventListener('pointermove', (event) => {
    const drag = chartInteraction.overviewDrag; if (!drag || drag.id !== event.pointerId) return;
    const delta = (event.clientX - drag.x) / Math.max(1, overview.getBoundingClientRect().width) * state.durationMs;
    setChartView(drag.start + delta, drag.end + delta, true); drawChart();
  });
  const endOverview = (event) => { if (!chartInteraction.overviewDrag || chartInteraction.overviewDrag.id !== event.pointerId) return; chartInteraction.overviewDrag = null; overview.classList.remove('dragging'); };
  overview.addEventListener('pointerup', endOverview); overview.addEventListener('pointercancel', endOverview);

  ui['chart-zoom-in'].addEventListener('click', () => zoomChart(CHART_ZOOM_FACTOR, state.chartFollow ? state.timeMs : (state.chartStartMs + state.chartEndMs) / 2, false));
  ui['chart-zoom-out'].addEventListener('click', () => zoomChart(1 / CHART_ZOOM_FACTOR, state.chartFollow ? state.timeMs : (state.chartStartMs + state.chartEndMs) / 2, false));
  ui['chart-reset'].addEventListener('click', () => { resetChartView(); drawChart(); });
  ui['chart-follow'].addEventListener('click', () => { setChartFollow(!state.chartFollow); if (state.chartFollow) centerChartOn(state.timeMs); drawChart(); });
  updateChartReadout();
}

function play(){if(!state.frames.length)return;state.playing=true;ui.play.innerHTML='<span>Ⅱ</span>';ui.play.setAttribute('aria-label','Pause playback');ui['manual-state'].textContent='PLAYBACK'}
function pause(){state.playing=false;ui.play.innerHTML='<span>▶</span>';ui.play.setAttribute('aria-label','Play motion')}
function formatTime(ms){const total=Math.max(0,Math.round(ms/1000)),hours=Math.floor(total/3600),minutes=Math.floor(total%3600/60),seconds=total%60;return (hours?String(hours).padStart(2,'0')+':':'')+String(minutes).padStart(2,'0')+':'+String(seconds).padStart(2,'0')}
function showLoading(text){ui.loading.hidden=false;ui['loading-detail'].textContent=text;ui['stage-error'].hidden=true}
function hideLoading(){ui.loading.hidden=true}
function showError(message){ui['stage-error'].hidden=false;ui['stage-error'].querySelector('span').textContent=message}
function updateSource(source){ui['source-title'].textContent=source.title;const publicData=source.kind==='public-recording',visitor=source.kind==='visitor-simulation';ui['source-link'].textContent=publicData?'CC BY 4.0 · DOI '+source.doi+' ↗':visitor?'Simulated with IK · stored in Machbase Neo':'Generated motion · project data';ui['source-link'].href=publicData?'https://doi.org/'+source.doi:'./third-party.html'}
function resize(){if(!renderer)return;const rect=ui.stage.getBoundingClientRect();renderer.setSize(rect.width,rect.height,false);camera.aspect=rect.width/rect.height;camera.updateProjectionMatrix();drawChart(true)}

function visitorSource(title) {
  return { kind: 'visitor-simulation', title: title || 'Visitor-created simulated motion', license: 'Project data', sampleRateHz: 10 };
}

function renderTeachState(message) {
  ui['teach-poses'].replaceChildren();
  state.teach.keyframes.forEach((_, index) => {
    const item = document.createElement('li');
    item.textContent = String(index + 1).padStart(2, '0');
    item.title = 'Captured pose ' + (index + 1);
    ui['teach-poses'].appendChild(item);
  });
  const count = state.teach.keyframes.length;
  ui['capture-pose'].disabled = count >= 8 || state.teach.saving;
  ui['undo-pose'].disabled = !count || state.teach.saving;
  ui['preview-motion'].disabled = count < 2 || state.teach.saving;
  ui['save-motion'].disabled = count < 2 || state.teach.saving;
  ui['save-motion'].textContent = state.teach.saving ? 'SAVING…' : 'SAVE & REPLAY';
  if (message) ui['teach-status'].textContent = message;
}

function clearTeachPlayback() {
  pause();
  state.trajectory = null;
  state.frames = [];
  state.durationMs = 0;
  state.timeMs = 0;
  ui.timeline.max = '1';
  ui.timeline.value = '0';
  ui['current-time'].textContent = '00:00';
  ui.duration.textContent = '00:00';
  resetChartView();
  drawChart(true);
}

function resetTeach(message) {
  state.teach.keyframes = [];
  state.teach.saving = false;
  clearTeachPlayback();
  setTargetVisible(true);
  ui['manual-state'].textContent = 'TEACH TARGET';
  ui['scenario-label'].textContent = 'Move target · capture poses';
  ui['data-status'].textContent = 'Teaching workspace ready';
  updateSource(visitorSource('Visitor teaching workspace'));
  renderTeachState(message || 'Move the cyan target or joint sliders, then capture at least two poses.');
}

function teachFrames() {
  const frames = [];
  state.teach.keyframes.forEach((start, segment) => {
    if (segment === state.teach.keyframes.length - 1) return;
    const end = state.teach.keyframes[segment + 1];
    for (let step = segment === 0 ? 0 : 1; step <= 15; step++) {
      const value = step / 15;
      const amount = value * value * (3 - 2 * value);
      frames.push({
        tMs: segment * 1500 + step * 100,
        user: 0,
        task: 0,
        scenario: 'unsaved-preview',
        joints: start.map((joint, index) => joint + (end[index] - joint) * amount)
      });
    }
  });
  return frames;
}

function syncTeachDraft() {
  if (state.teach.keyframes.length < 2) {
    clearTeachPlayback();
    return;
  }
  const frames = teachFrames();
  installTrajectory({
    model: state.modelId, mode: 'teach', motion: 'unsaved-preview',
    source: visitorSource('Unsaved visitor motion preview'),
    durationMs: frames.at(-1).tMs, originalDurationMs: frames.at(-1).tMs, frames
  }, frames.length + ' draft frames · not saved', false);
  seekPlayback(state.durationMs, true);
  setTargetVisible(true);
  ui['manual-state'].textContent = 'TEACH TARGET';
}

function captureTeachPose() {
  if (!state.robot || state.teach.keyframes.length >= 8) return;
  pause();
  state.teach.keyframes.push(state.robot.joints.map((joint) => Number(joint.angle.toFixed(7))));
  if (state.teach.keyframes.length >= 2) syncTeachDraft();
  renderTeachState('Pose ' + state.teach.keyframes.length + ' captured. Move the target and capture the next pose.');
}

function undoTeachPose() {
  const pose = state.teach.keyframes.pop();
  if (state.teach.keyframes.length >= 2) syncTeachDraft();
  else {
    clearTeachPlayback();
    if (state.teach.keyframes.length) setPose(state.teach.keyframes[0]);
    else if (pose) setPose(pose);
    setTargetVisible(true);
  }
  renderTeachState(state.teach.keyframes.length ? 'Last pose removed.' : 'No captured poses. Capture at least two poses.');
}

function previewTeachMotion() {
  if (state.teach.keyframes.length < 2) return;
  state.speed = 1; ui.speed.value = '1';
  if (!state.frames.length) syncTeachDraft();
  setTargetVisible(false);
  state.timeMs = 0; ui.timeline.value = '0';
  applyFrame(frameAt(0));
  if (!reduceMotion) play(); else pause();
  renderTeachState('Previewing ' + state.teach.keyframes.length + ' captured poses. Save when ready.');
}

async function loadTeachMotions(selectedId) {
  const select = ui['saved-motion'];
  select.disabled = true;
  try {
    const data = await requestJson('./api/teach/motions?model=' + encodeURIComponent(state.modelId));
    select.replaceChildren(new Option(data.motions.length ? 'Saved motions on this model' : 'No saved motions yet', ''));
    data.motions.forEach((motion) => {
      const created = new Date(motion.createdAt);
      const label = (Number.isNaN(created.valueOf()) ? motion.id : created.toLocaleString()) + ' · ' + motion.frameCount + ' frames';
      select.add(new Option(label, motion.id));
    });
    if (selectedId) select.value = selectedId;
  } catch (error) {
    select.replaceChildren(new Option('Unable to load motion memory', ''));
  } finally {
    select.disabled = false;
  }
}

async function saveTeachMotion() {
  if (state.teach.keyframes.length < 2 || state.teach.saving) return;
  state.teach.saving = true;
  renderTeachState('Saving motion memory to Machbase Neo…');
  try {
    const data = await postJson('./api/teach/motions', { model: state.modelId, keyframes: state.teach.keyframes.map((joints) => ({ joints })) });
    setTargetVisible(false);
    state.speed = 1; ui.speed.value = '1';
    installTrajectory(data, data.frames.length + ' frames · saved in Machbase Neo', true);
    await loadTeachMotions(data.runId);
    renderTeachState('Motion memory saved · ' + state.teach.keyframes.length + ' poses · ' + data.frames.length + ' frames.');
  } catch (error) {
    renderTeachState((error.code || 'SAVE_FAILED') + ' · ' + error.message);
    ui['data-status'].textContent = error.code || 'Save failed';
  } finally {
    state.teach.saving = false;
    renderTeachState();
  }
}

async function loadSavedTeachMotion(id) {
  if (!id) return;
  showLoading('Recalling motion memory…');
  try {
    const data = await recallTeachMotion(id, 4);
    setTargetVisible(false);
    state.speed = 1; ui.speed.value = '1';
    installTrajectory(data, data.frames.length + ' frames recalled from Machbase Neo', true);
    renderTeachState('Replaying saved motion memory ' + id + '.');
    hideLoading();
  } catch (error) {
    hideLoading(); showError(error.message); ui['data-status'].textContent = error.code || 'Load failed';
  }
}

async function recallTeachMotion(id, retries) {
  try {
    return await requestJson('./api/teach/motion?id=' + encodeURIComponent(id));
  } catch (error) {
    if (error.code !== 'MOTION_NOT_READY' || retries <= 0) throw error;
    await new Promise((resolve) => setTimeout(resolve, 250));
    return recallTeachMotion(id, retries - 1);
  }
}

async function enterTeach() {
  state.mode = 'teach';
  updateModePanels();
  resetTeach();
  await loadTeachMotions();
}

async function selectModel(modelId) {
  state.modelId=modelId;document.querySelectorAll('.model-card').forEach((card)=>card.classList.toggle('active',card.dataset.model===modelId));
  const meta=(await getJson('./api/robots')).models.find((item)=>item.id===modelId);ui['robot-name'].textContent=meta.name;ui['robot-spec'].textContent=meta.dof+' axes · '+meta.payloadKg+' kg payload · '+meta.reachMm+' mm reach';
  const built=await buildRobot(modelId);if(!built||state.modelId!==modelId)return;
  if(state.mode==='teach'){resetTeach('Model changed. Capture a new motion for '+meta.name+'.');await loadTeachMotions();return}
  if(modelId!=='iiwa7-r800'){ui['motion-select'].value='showcase';state.motion='showcase';setMode('studio')}else await loadTrajectory();
}

function updateModePanels(){
  ['full','scenario','studio','teach'].forEach((mode)=>{document.querySelector('[data-mode="'+mode+'"]').classList.toggle('active',state.mode===mode);ui[mode+'-options'].hidden=state.mode!==mode});
  ui['mode-label'].textContent=state.mode==='full'?'FULL DATASET':state.mode==='scenario'?'SCENARIO':state.mode==='studio'?'STUDIO MOTION':'TEACH MOTION';
}
async function setMode(mode) {
  // An explicit playback-mode choice preserves the robot selected by the user.
  if (mode === 'teach') { await enterTeach(); return; }
  state.mode = mode;
  setTargetVisible(false);
  updateModePanels();
  await loadTrajectory();
}

function bindEvents(){
  bindChartEvents();
  document.querySelectorAll('.model-card').forEach((card)=>card.addEventListener('click',()=>selectModel(card.dataset.model)));
  document.querySelectorAll('.mode-tabs button').forEach((button)=>button.addEventListener('click',()=>setMode(button.dataset.mode)));
  ui.play.addEventListener('click',()=>state.playing?pause():play());ui.speed.addEventListener('change',()=>{state.speed=Number(ui.speed.value)});
  ui.timeline.addEventListener('input',()=>seekPlayback(Number(ui.timeline.value),true));
  ui['skip-idle'].addEventListener('change',()=>{if(state.trajectory){state.frames=prepareFrames(state.trajectory);state.durationMs=state.frames.at(-1).playTMs;ui.timeline.max=state.durationMs;ui.duration.textContent=formatTime(state.durationMs);state.timeMs=0;computeChartMetadata();resetChartView();seekPlayback(0,false)}});
  ui['user-select'].addEventListener('change',()=>{updateScenarioInfo();if(state.mode==='scenario')loadTrajectory()});ui['task-select'].addEventListener('change',()=>{updateScenarioInfo();if(state.mode==='scenario')loadTrajectory()});
  ui['motion-select'].addEventListener('change',()=>{state.motion=ui['motion-select'].value;if(state.mode==='studio')loadTrajectory()});
  ui['teach-motion'].addEventListener('click',()=>setMode('teach'));
  ui['toggle-target'].addEventListener('click',()=>setTargetVisible(!state.targetVisible));
  ui['capture-pose'].addEventListener('click',captureTeachPose);ui['undo-pose'].addEventListener('click',undoTeachPose);ui['preview-motion'].addEventListener('click',previewTeachMotion);ui['save-motion'].addEventListener('click',saveTeachMotion);
  ui['saved-motion'].addEventListener('change',()=>loadSavedTeachMotion(ui['saved-motion'].value));
  ui['reset-camera'].addEventListener('click',()=>setCamera(state.robot.model.camera,true));ui.retry.addEventListener('click',()=>selectModel(state.modelId));
}

function updateScenarioInfo(){const item=state.scenarios.find((x)=>x.user===Number(ui['user-select'].value)&&x.task===Number(ui['task-select'].value));if(item)ui['scenario-info'].textContent=item.frameCount+' frames · '+formatTime(item.durationMs)}

async function initialize() {
  bindEvents();initScene();showLoading('Checking Machbase Neo…');
  try {await getJson('./api/health');ui['server-status'].classList.add('connected');ui['server-status'].lastChild.textContent=' Server connected'}catch(_){ui['server-status'].lastChild.textContent=' Check server connection'}
  try {const catalog=await getJson('./api/scenarios');state.scenarios=catalog.scenarios;for(let i=1;i<=30;i++)ui['user-select'].add(new Option('User '+String(i).padStart(2,'0'),i));for(let i=1;i<=15;i++)ui['task-select'].add(new Option('Scenario '+String(i).padStart(2,'0'),i));updateScenarioInfo()}catch(error){ui['data-status'].textContent=error.code||'Data unavailable'}
  updateModePanels();await buildRobot(state.modelId);await loadTrajectory();
}

initialize().catch((error)=>{hideLoading();showError(error.message);console.error(error)});
