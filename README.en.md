# Neo Robot Motion Lab

[한국어](README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [English](README.en.md)

A standalone Machbase Neo JSH application that turns a complete public KUKA LBR iiwa
motion dataset into an interactive 3D showcase. It includes 33,271 recorded frames across
30 participants and 450 scenarios, two generated studio motions, three selectable robot
models, joint controls, and a position-based IK target.

The server and CLI run in Machbase Neo JSH. The browser renderer uses a locally bundled
Three.js build; there is no Node.js runtime, npm install, frontend build, or external CDN.
This is a simulation and visualization demo. It does not control robot hardware.

## Requirements and addresses

- Git and Machbase Neo **8.7.0 or later**
- A running Neo database
- A WebGL-capable browser

Run `<NEO_EXECUTABLE> version` in the OS shell to verify the Neo product version.

| Purpose | Default address |
| --- | --- |
| Neo HTTP / SQL shell | `http://127.0.0.1:5654` |
| Machbase database | `127.0.0.1:5656` |
| Robot Motion Lab | `http://127.0.0.1:56802` |

## Quick start

Clone the project in the OS shell, then start JSH with an explicit mount. Replace the paths
and DB port with the values for your installation.

```sh
git clone https://github.com/machbase/neo-app-kuka-demo.git neo-app-kuka-demo
<NEO_EXECUTABLE> jsh \
  -v /work/neo-app-kuka-demo=/absolute/path/to/neo-app-kuka-demo \
  -e NEO_APP_DB_PORT=5656
```

Run schema and data setup from the project root inside JSH:

```text
cd /work/neo-app-kuka-demo
./scripts/schema.js
./scripts/seed.js
```

`schema.js` creates `NEO_APP_ROBOT_MOTION` and `NEO_APP_ROBOT_RUN` without dropping or
changing existing tables. The previous `NEO_APP_SAMPLE` table, when present, is untouched.

`seed.js` adds a new complete data run on every invocation:

- all 30 public CSV files: 33,271 frames, 450 scenarios, about 1:42:21 with original gaps;
- generated Showcase and Pick & Place motions for all three robot models;
- a completion marker written only after all frames have been appended successfully.

TAG ingestion has no transaction rollback. A failed seed can leave partial rows, but it does
not write a completion marker, so the API continues using the latest completed run. The
command reports the run ID and number of rows inserted before failure.

Start the foreground server from the `app` directory:

```text
cd /work/neo-app-kuka-demo/app
./server.js --host 127.0.0.1 --port 56802
```

Open **http://127.0.0.1:56802/**. Press `Ctrl+C` in JSH to stop the server.

The package shortcuts are JSH `pkg run` commands:

```text
cd /work/neo-app-kuka-demo
pkg run schema
pkg run seed
pkg run download-lerobot
pkg run import-lerobot
pkg run start
pkg run check
```

Pass server options after `--`, for example `pkg run start -- --port 56803`. The verified
Neo 8.7.0 build rejects `--port` as a `pkg` option when the separator is omitted.

### Run directly from the OS shell

```sh
<NEO_EXECUTABLE> jsh \
  -v /work/neo-app-kuka-demo=/absolute/path/to/neo-app-kuka-demo \
  -e NEO_APP_DB_PORT=5656 \
  /work/neo-app-kuka-demo/app/server.js --host 127.0.0.1 --port 56802
```

The app reads `NEO_APP_DB_HOST`, `NEO_APP_DB_PORT`, `NEO_APP_DB_USER`, and
`NEO_APP_DB_PASSWORD` from the JSH environment. Defaults are `127.0.0.1`, `5656`, `sys`,
and `manager`. It does not load `.env` files.

## Loading the larger datasets

The compact LeRobot state/action Parquet is kept outside the repository and downloaded once
from Hugging Face. The 31.98 GiB RLDS conversion and LeRobot videos are not used.

### 1. Create the schema

From the project root in JSH:

```text
cd /work/neo-app-kuka-demo
./scripts/schema.js
```

This creates `NEO_APP_ROBOT_MOTION`, `NEO_APP_ROBOT_RUN`, and `NEO_APP_LEROBOT_MOTION`
with `IF NOT EXISTS`; existing rows are preserved.

### 2. Import LeRobot state and action rows

Download the single 8,849,485-byte Parquet. It contains all 149,985 frames and 3,000 episodes
sampled at 20 Hz:

```text
./scripts/download-lerobot.js
```

The default file is `/work/neo-app-kuka-demo/data/lerobot/stanford-kuka-state.parquet`, which Git
ignores. Use `--dir` on the downloader and `--file` on the importer for another mounted location.
Use a two-row database and parser smoke test first:

```text
./scripts/import-lerobot.js --limit 2
```

Then import the complete compact conversion:

```text
./scripts/import-lerobot.js
```

A completion marker is written only after all 149,985 rows succeed. A limited or failed run may
leave partial rows, but the API never selects it for playback. `observation.state` is an
end-effector pose `[x, y, z, qx, qy, qz, qw]`, not seven joint angles. `action` is
`[dx, dy, dz, drx, dry, drz, gripper]`. The UI reconstructs one possible robot posture from XYZ
with inverse kinematics because the source does not contain measured joint angles. The command
does not download the 31.98 GiB RLDS data, videos, depth, or optical flow.

## Demo modes

- **Full playback** loads every public frame and plays participants 1–30 automatically.
  Original participant-relative timestamps and scenario gaps are retained. “Skip long idle
  gaps” compresses only scenario transitions; disabling it restores the 1:42:21 timeline.
- **Scenario** selects one participant from 1–30 and one task from 1–15. Individual recordings
  range from about 3.1 to 15.8 seconds.
- **Studio** plays the generated 12-second Axis Showcase or 10-second Pick & Place motion.
  Selecting KR 6 or iisy switches to Studio automatically.
- **LeRobot** lets you select an episode or explicitly load all 149,985 Cartesian poses; XYZ is reconstructed with inverse kinematics.
  This is not the 31.98 GiB RLDS conversion.

The viewport supports orbit and zoom, 0.5×–10× playback, timeline seeking, joint sliders,
an XYZ target with position IK, an end-effector trail, and a synchronized joint chart.
Reduced-motion browser settings disable automatic playback.

## Public API

All responses use `{ "ok": true, "data": ... }` or
`{ "ok": false, "error": { "code": "...", "message": "..." } }`.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/health` | Server identity; does not check the DB |
| `GET /api/robots` | Three model specifications and dataset totals |
| `GET /api/scenarios` | Metadata for all 450 recorded scenarios |
| `GET /api/trajectory?mode=full` | All 33,271 recorded frames |
| `GET /api/trajectory?mode=scenario&user=1&task=1` | One recorded scenario |
| `GET /api/trajectory?mode=studio&model=kr6-r900-2&motion=showcase` | One generated motion |
| `GET /api/datasets` | Whether each dataset is loaded |
| `GET /api/lerobot/episodes` | LeRobot episode catalog |
| `GET /api/lerobot/trajectory?episode=0` | One LeRobot episode |

Model, mode, user, task, and motion values are validated before database work. Database
connection failures return `DB_UNAVAILABLE`; missing setup, incomplete runs, bad input, and
query failures remain distinct errors. Raw CSV files, server source, credentials, and Git
files are not exposed by the HTTP server.

## Validation

With the server running, use another JSH process:

```sh
<NEO_EXECUTABLE> jsh \
  -v /work/neo-app-kuka-demo=/absolute/path/to/neo-app-kuka-demo \
  /work/neo-app-kuka-demo/scripts/check.js --url http://127.0.0.1:56802
```

The checker validates app identity, three robot models, the 450-scenario catalog, an actual
recorded scenario, a generated motion, all 33,271 full-playback frames, ordering, joint
dimensions, source attribution, and invalid mode/scenario errors. It creates a temporary
report under `.run/` and removes it after normal success or failure.

See [validation history](doc/validation.md), [compatibility policy](doc/compatibility.md),
and [third-party notices](THIRD_PARTY_NOTICES.md).

## Data and model licenses

- *Dataset for Collaborative Robotics*, version 3, DOI
  [`10.17632/4fr33dkrjt.3`](https://doi.org/10.17632/4fr33dkrjt.3): CC BY 4.0.
- KR 6 R900-2 and LBR iisy 3 R760 meshes and descriptions: Apache 2.0,
  `kroshu/kuka_robot_descriptions`.
- LBR iiwa 7 R800 meshes and description: MIT,
  `facebookresearch/differentiable-robot-model`.
- Three.js r186: MIT.

KUKA names identify the modeled products. This repository is not an official KUKA product.
