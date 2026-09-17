# Initial implementation validation

Validation date: 2026-09-15. These results describe the initial implementation and do not automatically guarantee subsequent changes.

The support baseline is **Neo 8.7.0 and later**. The actual runtime version in the record below is 8.7.0; these results do not constitute validation of later versions. See the [compatibility and documentation baseline](compatibility.md) for official references and the support policy.

## Environment

- Executable: `/home/sjkim2/work/neo/current/machbase-neo`
- Neo: `8.7.0`, build `c4954cf0`, engine `8.7.0`, Linux amd64
- Running Neo HTTP endpoint: `127.0.0.1:25654`
- App DB endpoint: `127.0.0.1:25656`, passed as `NEO_APP_DB_PORT=25656`
- App HTTP endpoint: `127.0.0.1:56802`
- JSH project mount: `/work/neo-app-starter`
- Browser: Chromium 145 / Playwright, using validation tools outside the repository

The server and CLI ran in actual JSH. Node.js used for browser automation is neither the app runtime nor a project dependency.

## Actual JSH / DB / HTTP checks

| Check | Result |
| --- | --- |
| App startup from the project root and the `app` directory | Passed |
| Server and page delivery under a different mount name, `/work/renamed-app` | Passed |
| `pkg run schema`, `seed`, `start`, `check` | Passed |
| `--help` for all four public CLIs, schema `--print` | Passed |
| Query before schema creation | HTTP 500, `SAMPLES_QUERY_FAILED` |
| Query of an empty table after schema creation | HTTP 200, empty array |
| Sample insertion | 60 rows stored; actual values verified through the API |
| Schema rerun | Existing 60 rows preserved |
| Sample insertion rerun | 60 rows added, 120 total |
| Latest data range | Comparison of query results for `limit=1`, the default of 60, and `limit=1000` passed |
| Time representation | Ascending order and UTC ISO strings verified |
| Invalid limit | `0`, `1001`, `-1`, `1.5`, `abc`, and an empty value all returned HTTP 400 |
| Separate app instance with an invalid DB port | Sample query HTTP 503 / health HTTP 200 |
| Access to server source, configuration, and Git files | HTTP 404 |
| Invalid server CLI port | Exit code 1 |
| Final `check.js` | All 8 API checks passed, exit code 0 |
| Final `check.js` given a URL that returns HTTP 404 | Failure reported, exit code 1 |

## Browser checks

- An actual empty table displayed the no-data message and instructions for schema setup and sample insertion.
- The chart displayed 60 actual DB records, and the latest value matched the API result.
- Refresh fetched the data and rendered the chart again.
- An actual DB connection failure displayed an error, hid the chart, and distinguished server status from DB status.
- Delayed responses displayed the loading message and disabled the button.
- A **mock HTTP 500 response** verified the query failure message and removal of previous values; restoring actual responses returned the page to normal. An actual HTTP 500 caused by a missing table was checked separately. The table was not deleted for this UI scenario.
- Desktop and 375px/640px screen widths were checked. The 375px layout was checked again after adjusting mobile axis label sizes.
- No browser JavaScript errors occurred.

## JSH compatibility handling

On this Neo build, calling `process.exit(1)` from an HTTP callback was reproduced returning exit code 0. The check command therefore writes a success result file only after its internal worker completes every check. A synchronously executing parent verifies that file and returns the final exit code. Failure or a missing result is never treated as success.

Check files are created in a directory for each run under `.run/` and removed on normal completion or failure. The command uses `process.exec()` and does not depend on asynchronous exit codes.

## State after initial validation

- The validation app server was stopped. The existing Machbase Neo service was left running.
- The app-specific `NEO_APP_SAMPLE` table and its 120 sample rows were preserved for trying out the app.
- The original `neo-lidar-demo` worktree was unchanged.
- The new repository had been initialized on `main`; no commit, remote registration, or push had been performed at that point.
- Execution on other Neo versions and Windows was not validated.

## 2026-09-15: Recheck after updating official documentation references

These checks used the same Neo 8.7.0 build, `c4954cf0`. Unlike the JavaScript execution through `shell -C` used during initial validation, this round used **direct `machbase-neo jsh` entry and script execution**.

- Direct loading of `util/parseArgs` and actual option parsing passed.
- `--help` for all four public CLIs, schema `--print`, and rejection of an invalid server port passed.
- The server ran using the README command format: `jsh -v ... -e ... /work/neo-app-starter/app/server.js --host ... --port ...`.
- All 8 API checks passed through `jsh -v ... /work/neo-app-starter/scripts/check.js`, with exit code 0.
- A check targeting an invalid API path failed with exit code 1.
- `pkg run start -- --help` displayed the actual server help, and `pkg run start -- --port bad` failed server port validation. Passing `--port` without the separator was rejected by this build's `pkg`, so the requirement was documented.
- All 17 referenced official documentation URLs returned HTTP 200.
- The DB row count was confirmed as 120. Schema creation and sample insertion were not rerun.
- This change updated the CLI parser module path, guidelines, documentation, and descriptions. Browser UI validation was not rerun; the initial browser results above remain a separate record.

The product version verified in this round was 8.7.0, as reported by `machbase-neo version`. The same executable reported `process.version` as `jsh-1.0.0` and `process.versions.jsh` as `1.0.0`, so these values are not used to check the minimum Neo version.

## 2026-09-15: README audit and English app messages

The README in all four languages was compared with the implementation and the official [JSH execution guide](https://docs.machbase.com/neo/jsh/), [package commands](https://docs.machbase.com/neo/jsh/packages/), [CLI reference](https://docs.machbase.com/neo/operations/command-line/), and module documentation for [http](https://docs.machbase.com/neo/jsh/modules/http/), [machcli](https://docs.machbase.com/neo/jsh/modules/machcli/), and [util/parseArgs](https://docs.machbase.com/neo/jsh/modules/util/parseargs/).

Corrections:

- Replaced the instruction to change only the server script path with a complete OS command for `check.js`. The checker accepts `--url`, whereas `--host` and `--port` belong to the server.
- Corrected translated README labels that still described the supporting documents as Korean.
- Updated README UI language descriptions and API error examples to match the English app messages. The existing API checker now also requires the English invalid-limit message.

Static inspection confirmed the documented DB defaults, explicit schema/seed lifecycle, 60-row insertion loop, latest-N query and ascending response order, limit validation, API error mapping, public file allowlist, and dependency-free structure. Local README links, JSON examples, absence of Korean text in application sources, and `git diff --check` passed. These are static checks, not JSH execution results.

Browser validation used Chromium `145.0.7632.6` through external Playwright tooling. The browser loaded the actual `public/` files with intercepted, mocked HTTP responses; no Neo server or DB was used for these checks.

- English labels, messages, HTML language, and date formatting passed, including a browser configured with Korean locale and the Asia/Seoul time zone. Display times remained local.
- Rendering of 60 measurements, refresh requests, loading and disabled-button state, empty data and setup instructions, query/DB/network errors, removal of stale values, recovery, and the singular one-measurement message passed.
- Layout checks at widths 1280px, 640px, and 375px found no horizontal page overflow. The 375px screenshot was also visually inspected.
- No browser JavaScript errors occurred.

The browser checks above preceded executable-path confirmation and used mocked HTTP only. After the user confirmed the executable path, the live checks below were performed on the English-message changes. Earlier results remain historical evidence.


### Live JSH and DB follow-up after path confirmation

- Executable: `/home/sjkim2/work/neo/current/machbase-neo`. The `version` command reported Neo **8.7.0**, build **c4954cf0**, engine 8.7.0, Linux amd64.
- Existing Neo endpoints were HTTP `127.0.0.1:25654` and DB `127.0.0.1:25656`. The app used `NEO_APP_DB_PORT=25656` and the explicit mount `/work/neo-app-starter=/home/sjkim2/work/neo-app-starter`.
- Direct OS execution through `machbase-neo jsh` started the app at `127.0.0.1:56802`. All four public CLI help commands and schema `--print` exited 0. An invalid server port exited 1.
- The old README instruction was reproduced: replacing only the script path while retaining `--host` and `--port` made `check.js` reject `--host` and exit 1. The corrected explicit `--url` command passed all 8 API checks and exited 0. An invalid API base path failed with exit 1. Both runs removed their temporary reports.
- Schema setup preserved the existing 120 rows. One seed run reported 60 inserted rows. The first immediate API read did not yet show all 180 rows; a later read did. All original rows remained. Latest-N results matched the full response for limits 1, 5, the default 60, and 1000. Another schema run preserved all 180 rows.
- In an actual interactive JSH terminal, `pkg run schema` and `pkg run check` passed. `pkg run start -- --help` displayed server help; `pkg run start -- --port bad` reached server validation; omitting the separator made `pkg` reject `--port`.
- Starting `./server.js --host 127.0.0.1 --port 56803` from `app/` served the health endpoint. `Ctrl+C` stopped the server and returned to JSH. Starting `pkg run start -- --port 56803` from the project root also passed all 8 API checks from a separate JSH process.
- A separate app with an unused DB port returned HTTP 503 with the English `DB_UNAVAILABLE` message, while health remained HTTP 200. An empty limit returned HTTP 400 with the English `INVALID_LIMIT` message before DB access. Server source, DB configuration, package metadata, and Git configuration paths returned HTTP 404.
- Chromium 145.0.7632.6 loaded the live app, rendered 60 DB measurements, matched the latest value to the API, refreshed successfully, and passed layout checks at 1280px, 640px, and 375px. The actual DB connection failure displayed the English error and hid the chart while retaining the connected server status. No browser JavaScript errors occurred.
- All app server processes started for this validation were stopped. The existing Neo service was left running. The app table now retains 180 sample rows, including the original 120.

The current round did not recreate a missing/empty table, force a partial seed failure, or test authentication/query-permission failures against the live DB. Empty-data and query-error UI states were covered by the explicitly mocked browser checks above. Other Neo versions and Windows were not tested.

## 2026-09-15: Robot Motion Lab implementation

The temperature example was replaced by a simulation-only KUKA Robot Motion Lab. Validation used `/home/sjkim2/work/neo/current/machbase-neo`: Neo **8.7.0**, build **c4954cf0**, engine 8.7.0, Linux amd64. The existing Neo service remained at HTTP `127.0.0.1:25654` and DB `127.0.0.1:25656`; the app used `NEO_APP_DB_PORT=25656` and the explicit project mount.

### Data, schema, and API

- All 30 CC BY 4.0 source CSV files were checked into the setup data directory byte-for-byte with SHA-256 hashes. They contain 33,271 frames across 30 participants and 450 tasks. The seed converts seven joint positions from degrees to radians while preserving participant, task, source time, source timestamp, and scenario gaps.
- Schema setup created `NEO_APP_ROBOT_MOTION` and `NEO_APP_ROBOT_RUN` without deleting the existing `NEO_APP_SAMPLE` table. A schema rerun passed and preserved data.
- The first seed appended 33,271 public frames plus 666 generated-motion frames, 33,937 total, in 8.8 seconds. It recorded the public duration as 6,140,545 ms. A second seed created a different run ID with the same counts; API selection moved to the latest completed run and still returned exactly 33,271 public frames rather than duplicates. The resulting tables contained 67,874 motion rows and 14 completion markers; the previous sample table still contained 180 rows.
- The live JSH checker passed all 13 checks: health, dataset status, three-model catalog, 450-scenario catalog, User 1 / Task 1 with 82 frames, KR 6 Showcase with 121 frames, optional dataset setup states, full playback with 33,271 ordered 7-axis frames, invalid mode, and invalid scenario.
- From an interactive JSH session, `pkg run schema` and `pkg run check` passed, `pkg run start -- --help` reached the server help, and omitting the separator made `pkg` reject `--port` as documented.
- The full trajectory response was 6,978,621 bytes and completed in 2.83 seconds on localhost. Scenario metadata was 42,433 bytes and completed in 0.06 seconds. These are local measurements, not network performance guarantees.
- With an unused DB port, health and the static robot catalog remained HTTP 200; scenario and full-trajectory requests returned HTTP 503 `DB_UNAVAILABLE`. Invalid mode validation returned HTTP 400 before DB access.
- The license page, model assets, and local Three.js files returned HTTP 200. Source CSV, `lib/api.js`, and `.git/config` paths returned HTTP 404.

### Browser

Chromium `145.0.7632.6` loaded the live JSH app and actual DB data through external Playwright tooling.

- Full playback loaded every 33,271-frame record. With idle-gap compression enabled, the timeline was 59:14; disabling it restored 1:42:21.
- Scenario selection loaded User 1 / Task 1 as 82 frames and Task 2 as 74 frames. Playback metadata and duration changed with the selection.
- LBR iiwa 7 R800, KR 6 R900-2, and LBR iisy 3 R760 all loaded their local visual meshes and produced 7-axis or 6-axis controls as appropriate. Model switching selected the stored Studio motion for models without public recordings.
- Axis Showcase contained 121 frames over 12 seconds; Pick & Place contained 101 frames over 10 seconds. Joint sliders entered Manual mode, and the XYZ IK target could be enabled.
- Desktop and 375px layouts rendered without horizontal page overflow. Full/scenario/studio switching, idle-gap toggle, source attribution, joint chart, end-effector trail, and playback controls were present. Reduced-motion settings kept playback paused, and rapid KR 6 → iisy selection finished on iisy without a stale model load replacing it. No browser JavaScript errors occurred.

The IK solver's target widget and unreachable-target color state were inspected in the implementation but were not exercised through an automated 3D drag. The WebGL-unavailable branch was not browser-automated. A deliberately partial TAG append was not written to the shared DB; the completion-marker ordering was verified by source inspection. Other Neo versions, other browsers, real KUKA hardware, and Windows were not tested.

## 2026-09-16: Optional LeRobot dataset

The RLDS full conversion (31.98 GiB) is deliberately excluded. Initial full-import trials through
the public Hugging Face rows API stopped at approximately 6,100 and 29,000 rows under persistent
HTTP 429 responses; neither run wrote a completion marker. That path was replaced with a direct
download of the compact state/action Parquet.

On Neo 8.7.0 build `c4954cf0`, `download-lerobot.js` retrieved the exact 8,849,485-byte file with
149,985 rows. JSH parsed it with the checked-in hyparquet bundle, and a `--limit 2` smoke import
stored two rows without a completion marker. The source state was verified as end-effector pose
`[x, y, z, qx, qy, qz, qw]`, not measured joint angles. Videos, depth, optical flow, and RLDS
files were not downloaded.

The subsequent complete local import wrote 149,985 rows, 3,000 episodes, and a completion marker.
The sum of the episode-local recorded durations was 7,349,250 ms. API validation after this import
checked the complete episode catalog and an episode response with the explicit Cartesian state
layout. The full-playback endpoint returned all 149,985 frames as a 29,135,055-byte JSON response
in 10.30 seconds on localhost; its concatenated 20 Hz timeline was 7,499,200 ms. These response
measurements are local observations, not network performance guarantees.

## 2026-09-16: Positionless signal dataset removal

The separate signal-only dataset was removed because it contains joint effort samples without
the robot pose needed for meaningful 3D motion playback. Its menu, browser logic, routes, schema
creation, package commands, setup scripts, manifest, and documentation were removed. The 21
downloaded source files were also deleted from the checkout, releasing 3,685,669,674 bytes.

On Neo 8.7.0 build `c4954cf0`, schema setup reported only the motion, run, and LeRobot tables.
The JSH checker passed all 11 current API checks. The two removed routes returned HTTP 404,
`/api/datasets` returned only `publicMotion` and `lerobot`, and the served HTML contained exactly
two dataset buttons. Existing database objects are preserved by policy and are no longer queried
or exposed by the application.

## 2026-09-17: Interactive Motion Signature navigation

The Motion Signature browser UI added time-axis zoom and pan, a full-range overview, playback
following, reset, and per-frame value inspection. JavaScript syntax, HTML ID wiring, whitespace,
and isolated viewport-state/render-event checks passed.

Chromium `153.0.8010.12` was exercised through temporary external Playwright tooling against the
actual checked-in browser files with mocked API responses. The test loaded both 33,271 public
frames and all 149,985 LeRobot frames, then passed button and wheel zoom, chart and overview pan,
overview repositioning, reset, Follow release/resume, chart seek with playback pause, joint and
Cartesian tooltips, touch pinch zoom, and the 375px layout without horizontal overflow. No
browser console or page errors occurred.

The same browser run selected KR 6 R900-2 and LBR iisy 3 R760, entered Studio as expected, and
then selected Full playback. Both runs retained the selected model instead of switching back to
LBR iiwa 7 R800. Public iiwa joint signals spanning the checked-in dataset ranges were retargeted
into each model's conservative Studio ranges. The iisy output stayed inside all six configured
ranges and retained connected geometry at 0%, 25%, 50%, 75%, and 100% of the actual checked-in
public dataset playback. The UI reported the retargeted state while the Motion Signature tooltip
continued to report the source iiwa values.

This round did not run the server through Machbase Neo JSH or query a live database because the
Neo executable path was not confirmed for this session. The mocked browser result verifies the
frontend interaction and large in-memory frame paths, not live HTTP or DB behavior.

## 2026-09-17: LeRobot feature removal

The optional LeRobot feature was removed from the current application contract. The browser no
longer exposes a dataset selector, episode controls, Cartesian-state rendering, or full LeRobot
loading. The server no longer registers `/api/datasets` or `/api/lerobot/*`; schema setup now
declares only `NEO_APP_ROBOT_MOTION` and `NEO_APP_ROBOT_RUN`. The downloader, importer, manifest,
hyparquet bundle and license, package commands, current documentation, and API checks were removed
together. No destructive cleanup of existing database objects or ignored local data was performed.

JavaScript syntax, HTML ID wiring, whitespace, and the absence of current LeRobot references all
passed static checks. Chromium `153.0.8010.12` loaded the actual browser files with all 33,271
checked-in public frames through mocked API responses. Three-model switching and retargeting,
Full/Studio playback, Motion Signature navigation, touch pinch, and the 375px layout passed with
no console or page errors; the served UI contained no dataset selector or LeRobot text.

This removal round did not run the JSH server or query the live database because the Neo executable
path was not confirmed for this session. Route 404 behavior, the reduced eight-check JSH worker,
and live schema output therefore remain unverified in this round.

## 2026-09-17: Single TAG table with METADATA

Neo 8.7.0 build `c4954cf0` was validated through
`/home/sjkim2/work/neo/current/machbase-neo` against DB port `25656`. The explicit
`migrate-tag-metadata.js --confirm` command dropped only `NEO_APP_ROBOT_MOTION`,
`NEO_APP_ROBOT_RUN`, and the legacy `NEO_APP_LEROBOT_MOTION`, then created one
`NEO_APP_ROBOT_MOTION` TAG table with DATA and METADATA areas. Running the migration without
`--confirm` failed with exit code 1 and did not modify the database.

The live seed inserted 33,937 DATA rows: 33,271 public frames and 666 generated Studio frames.
The appender automatically registered 456 `MOTION` metadata entries from the metadata values
supplied with each logical TAG row; one explicit metadata-only `RUN` completion marker was added
after the appender closed. The marker recorded run `seed-1789650045341`, 33,271 public frames,
450 scenarios, 6,140,545 ms, and the DATA-axis `START_TIME`/`END_TIME` bounds.
Catalog inspection confirmed the old robot run and LeRobot tables were absent. Unrelated
`NEO_APP_ROBOT_TORQUE` and `NEO_APP_SAMPLE` tables were not modified.

A normal schema rerun preserved all 33,937 DATA rows and 457 METADATA rows. The live JSH checker
passed all eight current API checks. Chromium `153.0.8010.12` loaded the live app and passed full
33,271-frame playback, Studio playback, iisy retargeting, Motion Signature zoom, and the 375px
layout without console or page errors.

Every playback DATA query included both tag pruning and a BASETIME predicate. Full used the
automatically indexed scalar metadata predicate `RUN_ID = ?`, with `TAG_KIND` and `SOURCE_KIND`
filters; Scenario and Studio used exact `NAME` values. All three used
`TIME BETWEEN START_TIME AND END_TIME`, and playback time came directly from `PLAYBACK_MS`.
`EXPLAIN` showed `VOLATILE INDEX SCAN` on metadata with a `RUN_ID` key range, followed by a DATA
`KEYVALUE INDEX SCAN` with the tag-ID `IN` set and `TIME BETWEEN` range. On localhost, Full
returned 6,978,621 bytes in 2.84 seconds, User 1 / Task 1 returned 17,056 bytes in 0.017 seconds,
and iisy Showcase returned 15,461 bytes in 0.028 seconds.
