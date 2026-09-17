export const ROBOT_MODELS = {
  'iiwa7-r800': {
    id: 'iiwa7-r800', name: 'LBR iiwa 7 R800', dof: 7, format: 'stl',
    assetRoot: './assets/robots/iiwa7-r800/', scale: 1,
    camera: { position: [1.65, 1.35, 1.15], target: [0, 0, 0.55] },
    base: { file: 'link_0.stl', color: 0xb8bdc4, xyz: [0, 0, 0], rpy: [0, 0, 0] },
    home: [0, 20, 0, -65, 0, 55, 0],
    joints: [
      { xyz: [0, 0, .15], rpy: [0, 0, 0], axis: [0, 0, 1], min: -170, max: 170, file: 'link_1.stl', color: 0xc5c9ce, visualXyz: [0, 0, .0075] },
      { xyz: [0, 0, .19], rpy: [Math.PI / 2, 0, Math.PI], axis: [0, 0, 1], min: -120, max: 120, file: 'link_2.stl', color: 0xf47721 },
      { xyz: [0, .21, 0], rpy: [Math.PI / 2, 0, Math.PI], axis: [0, 0, 1], min: -170, max: 170, file: 'link_3.stl', color: 0xc5c9ce, visualXyz: [0, 0, -.026] },
      { xyz: [0, 0, .19], rpy: [Math.PI / 2, 0, 0], axis: [0, 0, 1], min: -120, max: 120, file: 'link_4.stl', color: 0xf47721 },
      { xyz: [0, .21, 0], rpy: [-Math.PI / 2, Math.PI, 0], axis: [0, 0, 1], min: -170, max: 170, file: 'link_5.stl', color: 0xc5c9ce, visualXyz: [0, 0, -.026] },
      { xyz: [0, .0607, .19], rpy: [Math.PI / 2, 0, 0], axis: [0, 0, 1], min: -120, max: 120, file: 'link_6.stl', color: 0xf47721 },
      { xyz: [0, .081, .0607], rpy: [-Math.PI / 2, Math.PI, 0], axis: [0, 0, 1], min: -175, max: 175, file: 'link_7.stl', color: 0xc5c9ce, visualXyz: [0, 0, -.0005] }
    ],
    tool: { xyz: [0, 0, .045], rpy: [0, 0, 0] }
  },
  'kr6-r900-2': {
    id: 'kr6-r900-2', name: 'KR 6 R900-2', dof: 6, format: 'dae',
    assetRoot: './assets/robots/kr6-r900-2/', scale: 1,
    camera: { position: [1.7, 1.45, 1.15], target: [0, 0, .52] },
    base: { file: 'base_link.dae', xyz: [0, 0, 0], rpy: [0, 0, 0] },
    home: [0, -55, 65, 0, 45, 0],
    joints: [
      { xyz: [0, 0, .208], rpy: [Math.PI, 0, 0], axis: [0, 0, 1], min: -170, max: 170, file: 'link_1.dae', visualXyz: [0, 0, .208], visualRpy: [-Math.PI, 0, 0] },
      { xyz: [.025, -.0907, -.192], rpy: [Math.PI / 2, 0, 0], axis: [0, 0, 1], min: -190, max: 45, file: 'link_2.dae', visualXyz: [-.4, -.025, -.0907], visualRpy: [Math.PI / 2, 0, Math.PI / 2] },
      { xyz: [.455, 0, -.0042], rpy: [0, 0, 0], axis: [0, 0, 1], min: -120, max: 156, file: 'link_3.dae', visualXyz: [-.025, .855, -.0865], visualRpy: [Math.PI / 2, 0, 0] },
      { xyz: [.196, -.025, -.0865], rpy: [Math.PI / 2, 0, -Math.PI / 2], axis: [0, 0, 1], min: -185, max: 185, file: 'link_4.dae', visualXyz: [-.88, 0, .221], visualRpy: [0, Math.PI / 2, 0] },
      { xyz: [0, .0505, -.224], rpy: [0, Math.PI / 2, Math.PI / 2], axis: [0, 0, 1], min: -120, max: 120, file: 'link_5.dae', visualXyz: [-.445, .88, -.0505], visualRpy: [Math.PI / 2, 0, 0] },
      { xyz: [.0615, 0, -.0505], rpy: [Math.PI / 2, 0, -Math.PI / 2], axis: [0, 0, 1], min: -350, max: 350, file: 'link_6.dae', visualXyz: [-.88, 0, .5065], visualRpy: [0, Math.PI / 2, 0] }
    ],
    tool: { xyz: [0, 0, -.0285], rpy: [Math.PI, 0, Math.PI] }
  },
  'iisy3-r760': {
    id: 'iisy3-r760', name: 'LBR iisy 3 R760', dof: 6, format: 'stl',
    assetRoot: './assets/robots/iisy3-r760/', scale: 1,
    camera: { position: [1.45, 1.25, 1.05], target: [0, 0, .45] },
    base: { file: 'base_link.stl', color: 0xf0f1f2, xyz: [0, 0, 0], rpy: [0, 0, 0] },
    home: [0, -55, 65, 0, 40, 0],
    joints: [
      { xyz: [0, 0, .1264], rpy: [0, 0, 0], axis: [0, 0, -1], min: -185, max: 185, file: 'link_1.stl', color: 0xf5f5f4 },
      { xyz: [0, 0, .0886], rpy: [-Math.PI / 2, 0, 0], axis: [0, 0, 1], min: -230, max: 50, file: 'link_2.stl', color: 0xe7e8e9 },
      { xyz: [.3, 0, 0], rpy: [0, 0, -Math.PI / 2], axis: [0, 0, 1], min: -150, max: 150, file: 'link_3.stl', color: 0xf5f5f4 },
      { xyz: [0, 0, 0], rpy: [Math.PI / 2, 0, 0], axis: [0, 0, 1], min: -175, max: 175, file: 'link_4.stl', color: 0xe7e8e9 },
      { xyz: [0, 0, -.3], rpy: [-Math.PI / 2, 0, 0], axis: [0, 0, 1], min: -110, max: 110, file: 'link_5.stl', color: 0xf5f5f4 },
      { xyz: [0, 0, 0], rpy: [Math.PI / 2, 0, 0], axis: [0, 0, 1], min: -220, max: 220, file: 'link_6.stl', color: 0xe7e8e9 }
    ],
    tool: { xyz: [0, 0, -.1605], rpy: [0, Math.PI, 0] }
  }
};

export const DEG = Math.PI / 180;
export const RAD = 180 / Math.PI;
