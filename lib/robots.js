'use strict';

const DEG = Math.PI / 180;

const MODELS = [
  {
    id: 'iiwa7-r800', name: 'LBR iiwa 7 R800', family: 'Collaborative', dof: 7,
    payloadKg: 7, reachMm: 800, assetKind: 'stl', realData: true,
    motions: ['showcase', 'pick-place']
  },
  {
    id: 'kr6-r900-2', name: 'KR 6 R900-2', family: 'Industrial', dof: 6,
    payloadKg: 6, reachMm: 901, assetKind: 'dae', realData: false,
    motions: ['showcase', 'pick-place']
  },
  {
    id: 'iisy3-r760', name: 'LBR iisy 3 R760', family: 'Collaborative', dof: 6,
    payloadKg: 3, reachMm: 760, assetKind: 'stl', realData: false,
    motions: ['showcase', 'pick-place']
  }
];

const MOTIONS = {
  showcase: { id: 'showcase', name: 'Axis Showcase', durationMs: 12000, sampleRateHz: 10 },
  'pick-place': { id: 'pick-place', name: 'Pick & Place', durationMs: 10000, sampleRateHz: 10 }
};

const KEYFRAMES = {
  'iiwa7-r800': {
    showcase: [[0, 20, 0, -65, 0, 55, 0], [45, 35, -35, -80, 45, 35, 70], [-45, 60, 35, -55, -45, 65, -70], [0, 20, 0, -65, 0, 55, 0]],
    'pick-place': [[-42, 35, 20, -78, 20, 58, 0], [-20, 62, 10, -92, 5, 45, 25], [28, 58, -20, -82, -20, 48, -25], [42, 35, -20, -70, -10, 55, 0], [-42, 35, 20, -78, 20, 58, 0]]
  },
  'kr6-r900-2': {
    showcase: [[0, -55, 65, 0, 45, 0], [55, -80, 92, 65, -35, 100], [-55, -42, 38, -65, 55, -100], [0, -55, 65, 0, 45, 0]],
    'pick-place': [[-48, -62, 78, 0, 42, 0], [-22, -88, 105, 0, 68, 15], [28, -82, 96, 0, 60, -15], [48, -62, 78, 0, 42, 0], [-48, -62, 78, 0, 42, 0]]
  },
  'iisy3-r760': {
    showcase: [[0, -55, 65, 0, 40, 0], [60, -82, 95, 75, -45, 110], [-60, -38, 35, -75, 55, -110], [0, -55, 65, 0, 40, 0]],
    'pick-place': [[-50, -65, 80, 0, 40, 0], [-22, -92, 110, 0, 65, 20], [28, -86, 102, 0, 58, -20], [50, -65, 80, 0, 40, 0], [-50, -65, 80, 0, 40, 0]]
  }
};

function model(id) {
  return MODELS.find((item) => item.id === id);
}

function motion(id) {
  return MOTIONS[id];
}

function smooth(value) {
  return value * value * (3 - 2 * value);
}

function generatedFrames(modelId, motionId) {
  const spec = motion(motionId);
  const keys = KEYFRAMES[modelId] && KEYFRAMES[modelId][motionId];
  if (!spec || !keys) return null;
  const count = spec.durationMs / 100 + 1;
  return Array.from({ length: count }, (_, index) => {
    const progress = index / (count - 1);
    const scaled = progress * (keys.length - 1);
    const segment = Math.min(Math.floor(scaled), keys.length - 2);
    const amount = smooth(scaled - segment);
    return {
      tMs: index * 100,
      joints: keys[segment].map((start, joint) =>
        Number(((start + (keys[segment + 1][joint] - start) * amount) * DEG).toFixed(7)))
    };
  });
}

function publicCatalog() {
  return MODELS.map((item) => ({
    id: item.id,
    name: item.name,
    family: item.family,
    dof: item.dof,
    payloadKg: item.payloadKg,
    reachMm: item.reachMm,
    assetKind: item.assetKind,
    realData: item.realData,
    motions: item.motions.map((id) => MOTIONS[id])
  }));
}

module.exports = { MODELS, MOTIONS, generatedFrames, model, motion, publicCatalog };
