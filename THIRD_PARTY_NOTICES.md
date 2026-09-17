# Third-party notices

## KUKA robot descriptions

The KR 6 R900-2 and LBR iisy 3 R760 descriptions and visual meshes are derived from
[`kroshu/kuka_robot_descriptions`](https://github.com/kroshu/kuka_robot_descriptions),
Copyright 2025 KUKA Hungaria Kft., under the Apache License 2.0. The complete license is
included in `third_party/licenses/kuka-robot-descriptions-Apache-2.0.txt`.

The LBR iiwa 7 R800 description and visual meshes are derived from
[`facebookresearch/differentiable-robot-model`](https://github.com/facebookresearch/differentiable-robot-model),
Copyright Facebook, Inc. and its affiliates, under the MIT License. The complete license is
included in `third_party/licenses/facebookresearch-MIT.txt`.

KUKA product names identify the modeled robots. This project is not an official KUKA product
and does not provide hardware control.

## Dataset for Collaborative Robotics

The 30 CSV files under `scripts/data/collaborative-robotics/` are from *Dataset for
Collaborative Robotics*, version 3, DOI
[`10.17632/4fr33dkrjt.3`](https://doi.org/10.17632/4fr33dkrjt.3), by Shurook Almohamade,
John Clark, and James Law. The dataset is licensed under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

The seed command reads all 33,271 records, converts the seven `JointPosition` columns from
degrees to radians, and preserves `Time/Second`, `Time Stamp`, participant number, and task
number. Participant demographic data and the maze image are not included.

## Stanford KUKA Multimodal Dataset (LeRobot conversion)

The optional downloader retrieves the compact Parquet from
[`lerobot/stanford_kuka_multimodal_dataset`](https://huggingface.co/datasets/lerobot/stanford_kuka_multimodal_dataset).
The converted dataset is listed as MIT licensed and contains 149,985 frames at 20 FPS.
`observation.state` holds end-effector XYZ and quaternion values; it does not contain measured
joint angles. This application imports only the state/action rows and does not download the
31.98 GiB RLDS conversion or video files.

## hyparquet

The JSH importer includes hyparquet 1.31.0, Copyright 2023–2026 Hugh McNally, under the MIT
License. It parses the downloaded Parquet without adding a JSH package dependency. The complete
license is included in `third_party/licenses/hyparquet-MIT.txt`.

## Three.js

The browser renderer uses Three.js r186, Copyright © 2010–2026 three.js authors, under the
MIT License. The complete license is included in `third_party/licenses/three-MIT.txt`.
