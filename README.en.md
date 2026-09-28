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

### 1. Check Neo and clone the repository

```sh
<NEO_EXECUTABLE> version
git clone https://github.com/machbase/neo-app-kuka-demo.git neo-app-kuka-demo
```

### 2. Start JSH

Confirm the actual Machbase port of the running Neo database and mount the project explicitly.
Replace the default `5656` below when your installation uses another port.

```sh
<NEO_EXECUTABLE> jsh \
  -v /work/neo-app-kuka-demo=/absolute/path/to/neo-app-kuka-demo \
  -e NEO_APP_DB_PORT=5656
```

### 3. Verify and load the data

The 30 public CSV files are included in the repository; no separate download is required.
`verify-data.js` checks 33,271 frames and 450 scenarios without changing the database.

```text
cd /work/neo-app-kuka-demo
./scripts/verify-data.js
./scripts/schema.js
./scripts/seed.js
```

`schema.js` creates one `NEO_APP_ROBOT_MOTION` TAG table whose DATA and METADATA areas hold
frames and tag attributes. It does not drop existing data.

`seed.js` adds a new complete data run on every invocation:

- all 30 public CSV files: 33,271 frames, 450 scenarios, about 1:42:21 with original gaps;
- generated Showcase and Pick & Place motions for all three robot models;
- a completion marker written only after all frames have been appended successfully.

TAG ingestion has no transaction rollback. A failed seed can leave partial rows, but it does
not write a completion marker, so the API continues using the latest completed run. The
command reports the run ID and number of rows inserted before failure. Success reports `ok:true`,
`publicFrames:33271`, and `publicScenarios:450`. Fix the cause and rerun `seed.js` after a failure.

### 4. Start the server — JSH session A

The server stays in the foreground, so leave this session open.

```text
cd /work/neo-app-kuka-demo/app
./server.js --host 127.0.0.1 --port 56802
```

### 5. Validate — separate OS shell/JSH session B

With the server running, execute this from another OS shell:

```sh
<NEO_EXECUTABLE> jsh \
  -v /work/neo-app-kuka-demo=/absolute/path/to/neo-app-kuka-demo \
  /work/neo-app-kuka-demo/scripts/check.js --url http://127.0.0.1:56802
```

Confirm `PASS: 11 robot API checks`.

### 6. Open the browser

Open **http://127.0.0.1:56802/**. Press `Ctrl+C` in session A to stop the server.

## JSH package shortcuts

Run these JSH `pkg run` commands from the project root (`/work/neo-app-kuka-demo`):

| Command | Purpose |
| --- | --- |
| `pkg run verify-data` | Non-destructive bundled CSV check |
| `pkg run schema` | Create the current schema and preserve existing data |
| `pkg run seed` | Append one new completed run |
| `pkg run start` | Run the foreground server in session A |
| `pkg run check` | Check the running server from session B |
| `pkg run migrate-tag-metadata -- --confirm` | **Legacy upgrade only; deletes this app's data** |

Pass server options after `--`, for example `pkg run start -- --port 56803`. The verified
Neo 8.7.0 build rejects `--port` as a `pkg` option when the separator is omitted.

## Upgrade the legacy two-table schema

Do not run this for a fresh checkout. Only for the previous schema, stop the server and run the
following once. It permanently drops this app's `NEO_APP_ROBOT_MOTION`, `NEO_APP_ROBOT_RUN`, and
legacy `NEO_APP_LEROBOT_MOTION`, creates the current table, and reloads the data.

```text
cd /work/neo-app-kuka-demo
./scripts/migrate-tag-metadata.js --confirm
./scripts/seed.js
```

## Run the server directly from the OS shell

```sh
<NEO_EXECUTABLE> jsh \
  -v /work/neo-app-kuka-demo=/absolute/path/to/neo-app-kuka-demo \
  -e NEO_APP_DB_PORT=5656 \
  /work/neo-app-kuka-demo/app/server.js --host 127.0.0.1 --port 56802
```

## Remote access on a trusted network

```text
cd /work/neo-app-kuka-demo
pkg run start -- --host 0.0.0.0 --port 56802
```

Open `http://<server-ip>:56802/` remotely. Allow only the app port through the firewall; do not
expose the Machbase database port. The Teach write API has no authentication, so do not expose it
directly to the public internet. Use reverse-proxy authentication or an IP allowlist.

The app reads `NEO_APP_DB_HOST`, `NEO_APP_DB_PORT`, `NEO_APP_DB_USER`, and
`NEO_APP_DB_PASSWORD` from the JSH environment. Defaults are `127.0.0.1`, `5656`, `sys`,
and `manager`. It does not load `.env` files.

## Demo modes

- **Full playback** loads every public frame and plays participants 1–30 automatically.
  Original participant-relative timestamps and scenario gaps are retained. “Skip long idle
  gaps” compresses only scenario transitions; disabling it restores the 1:42:21 timeline.
  Explicitly selecting Full playback keeps the currently selected robot model. For KR 6 and
  iisy, the source iiwa joint signals are retargeted into each model's safe Studio ranges while
  the chart continues to display the source values.
- **Scenario** selects one participant from 1–30 and one task from 1–15. Individual recordings
  range from about 3.1 to 15.8 seconds.
- **Studio** plays the generated 12-second Axis Showcase or 10-second Pick & Place motion.
  Selecting KR 6 or iisy switches to Studio automatically.
- **Teach** captures 2–8 poses with the XYZ IK target or joint sliders, without hardware.
  Preview smoothly interpolates the poses at 10 Hz; `Save & Replay` stores the completed
  simulated motion in Machbase. Only motions with completion markers appear in the per-model
  Motion memory list and can be recalled. These are simulated, not measured or hardware-controlled.

Use Teach in this order: `select Teach → move the target or a joint → Capture Pose at least twice
→ Preview → Save & Replay → recall it from Motion memory`.

The viewport supports orbit and zoom, 0.5×–10× playback, timeline seeking, joint sliders,
an XYZ target with position IK, and an end-effector trail. Motion Signature supports time-axis
zoom and pan, a full-range overview, playhead following, reset, and per-frame value inspection.
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
| `GET /api/teach/motions?model=iiwa7-r800` | Completed visitor simulations for one model |
| `GET /api/teach/motion?id=<motion-id>` | One completed visitor motion |
| `POST /api/teach/motions` | Validate and interpolate 2–8 joint poses, then save the motion |

Model, mode, user, task, and motion values are validated before database work. Database
connection failures return `DB_UNAVAILABLE`; missing setup, incomplete runs, bad input, and
query failures remain distinct errors. Raw CSV files, server source, credentials, and Git
files are not exposed by the HTTP server. Immediately after an append, frame visibility may
briefly lag behind the completion marker; recall then returns transient `MOTION_NOT_READY`,
which the browser retries for a short bounded period.

## Validation coverage

The checker validates app identity, three robot models, the 450-scenario catalog, an actual
recorded scenario, a generated motion, all 33,271 full-playback frames, ordering, joint
dimensions, source attribution, and invalid mode/scenario errors. It creates a temporary
report under `.run/` and removes it after normal success or failure. It also checks invalid
Teach requests without creating a visitor motion.

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
