# Project Guidelines

## Runtime and layout

- This is `neo-app-starter`, a standalone Machbase Neo JSH web app starter. Support Machbase Neo **8.7.0 and later**; 8.7.0 is the minimum compatibility baseline, not an exact-version requirement.
- Use the current official documentation at https://docs.machbase.com/neo/ as the primary reference. This guidance was checked on 2026-09-15. Read the relevant module page before using a new API, and check its version annotation against the 8.7.0 baseline.
- Keep the support target separate from verified builds. A newer documentation page does not prove that every API works on 8.7.0 or that this app has been tested on every later release.
- Write server and CLI code in JavaScript for JSH, not Node.js. Use CommonJS `require(...)`, documented JSH built-ins, and `console.print()` / `console.println()`.
- Browser code in `public/` runs in a browser and may use DOM, fetch, and SVG APIs. Keep server and browser responsibilities separate.
- Start standalone JSH with `machbase-neo jsh`. `machbase-neo shell` opens the Neo SQL shell; enter `jsh` there only when intentionally using that session. Standalone `jsh` uses `-v` / `-e`, not the SQL shell's `-server` / `-user` / `-password` flags.
- `/work` defaults to the OS working directory where JSH starts, not the directory containing the executable. Prefer an explicit `-v /work/neo-app-starter=/absolute/checkout/path` mount in examples. Use mounted POSIX paths inside JSH and resolve paths from the entry script.
- An OS command can run a saved script directly: `machbase-neo jsh -v /work/neo-app-starter=/absolute/checkout/path /work/neo-app-starter/app/server.js`. The `-C` flag takes JavaScript source, not a JSH shell command line.
- Run `./scripts/*.js` from the project root in JSH. Run `./server.js --host 127.0.0.1 --port 56802` from the `app` directory. Running `./app/server.js` from the root is also supported.
- `package.json` scripts are for JSH `pkg run`, not npm. Prefer built-ins before introducing dependencies.
- `pkg run` runs from the selected package root. Use `pkg run <name> -- <script-options>` for option forwarding: verified 8.7.0 build `c4954cf0` rejects unseparated script flags even though current docs show examples without the separator. Use `pkg install` only when adding dependencies, preserve its lock file, and do not assume npm lifecycle scripts or Node engine checks apply.

## Implementation conventions

- Keep HTTP routing and response handling in `app/`, database and application logic in `lib/`, browser assets in `public/`, and explicit setup commands in `scripts/`.
- Reuse the DB helpers so query results, connections, and clients close on success and failure.
- Load the CLI parser with `const parseArgs = require('util/parseArgs')`, as documented for JSH. Read environment variables through `require('process').env.get(name)`.
- Use JSH `http.Server` / router-context APIs and pass `env: process.env` for filesystem access. Do not substitute Express or assume Node request/response objects. Preserve the distinction between a missing and an explicitly empty query parameter.
- JSH `fs` provides synchronous operations and documented `Sync` aliases; `path` defaults to POSIX. Do not assume every Node filesystem API is available.
- Bind user-provided SQL values with positional `?` parameters. Keep table identifiers in server-owned schema code.
- Keep credentials out of public assets and API errors. The app reads `NEO_APP_DB_*` from the JSH environment; it does not load `.env` files.
- Do not return synthetic data or an empty-success response when a DB operation fails.
- Follow the `{ ok: true, data }` / `{ ok: false, error: { code, message } }` API convention. Validate inputs before database work.
- Use short comments for intent, policy, JSH behavior, and operational cautions rather than narrating mechanics.
- Preserve the simple dependency-free frontend unless a requested feature warrants a change.

## Database lifecycle

- Setup and robot-motion insertion are explicit CLI actions, never server startup side effects.
- `schema.js` preserves existing tables and rows. Do not introduce automatic drop/reset behavior.
- `seed.js` adds a complete motion run on every invocation. TAG tables have no transaction rollback; report partial insertion and write completion markers only after every frame succeeds.
- The current `machcli` docs include 8.7.0 database selection (`database`, alias `db`), named parameters, appenders, and transaction helpers. These do not change this sample's contract: it uses the default database, positional parameters, appenders for bulk motion data, and TAG tables. Do not wrap TAG operations in `tx()`.
- Use separate explicit migrations for existing-schema changes.
- The starter runs its server in the foreground. If a future task adds managed jobs, prefer JSH `service` and verify its command contract before registration.
- For managed-job changes, treat config, service registration, pid, checkpoint, and logs as separate artifacts. Define preservation/removal and explicit restart behavior; do not report every config file as an installed service.
- Service clients require a session-provided `SERVICE_CONTROLLER` or an explicit controller address; do not assume standalone JSH has a controller or hardcode a port. Distinguish rereading configuration from applying it, following the current service documentation.
- Shutdown hooks are not guaranteed on forced termination or unhandled OS signals. Keep essential DB cleanup in `finally`; if a future service needs graceful signal handling, verify that path in JSH.

## Validation

- Confirm the `machbase-neo` executable path with the user before the first runtime validation in a session; an already confirmed path may be reused.
- Run `<NEO_EXECUTABLE> version` to record the Neo version/build and verify the 8.7.0 minimum. `process.version` and `process.versions.jsh` identify JSH itself and must not be used as the Neo version.
- Inspect the actual Neo HTTP and DB ports and JSH mount paths. They may differ from README defaults. Do not stop or reconfigure unrelated services.
- Use the smallest relevant JSH execution. Do not use Node.js as proof that JSH server or CLI code works.
- After schema and seed, run `./scripts/check.js` against the app server from another JSH session.
- Keep the check worker/report boundary: on verified Neo 8.7.0 build `c4954cf0`, `process.exit(1)` inside HTTP callbacks can return exit code 0. This is a local observation, not a documented guarantee for all later versions. The synchronous parent must require explicit worker success, return a failing status otherwise, and clean up its own temporary report.
- Validate documented commands through `machbase-neo jsh`, not only JavaScript snippets passed to `machbase-neo shell -C`. Check both passing and failing exit codes. For newer Neo builds, record the tested version separately and rerun the same checks before claiming validation.
- For data-path changes, verify DB results, order/limits, empty data, connection/query failures, and preservation on setup rerun as relevant.
- For UI changes, verify browser rendering, refresh, empty/error/loading states, and narrow-screen layout. External browser automation tooling need not become a project dependency.
- Record what actually ran. Static inspection is not runtime validation. Preserve unrelated worktree changes and database objects.

## Documentation and official references

- Keep README examples usable from a fresh checkout, and clearly distinguish OS shell from JSH shell.
- Update API docs and checks when response shape or behavior changes.
- Keep dated runtime findings in `doc/validation.md`; do not relabel historical results as a newer-version test. See `doc/compatibility.md` for the support policy and source mapping.
- Prefer the canonical page links below. Machine-readable Markdown pages may use lowercase filenames (for example, `util/parseargs.md`) even when the JavaScript module name is `util/parseArgs`.

| Topic | Official documentation |
| --- | --- |
| Entry points, mounts, external execution | https://docs.machbase.com/neo/jsh/ |
| Interactive commands, pipes, redirection | https://docs.machbase.com/neo/jsh/commands/ |
| Global timers and console | https://docs.machbase.com/neo/jsh/global/ |
| Built-in module catalog | https://docs.machbase.com/neo/jsh/modules/ |
| HTTP client and server | https://docs.machbase.com/neo/jsh/modules/http/ |
| Database client and transactions | https://docs.machbase.com/neo/jsh/modules/machcli/ |
| Process, environment, lifecycle | https://docs.machbase.com/neo/jsh/modules/process/ |
| Filesystem and paths | https://docs.machbase.com/neo/jsh/modules/fs/ and https://docs.machbase.com/neo/jsh/modules/path/ |
| CLI argument parsing | https://docs.machbase.com/neo/jsh/modules/util/parseargs/ |
| JSH packages | https://docs.machbase.com/neo/jsh/packages/ |
| Managed service client | https://docs.machbase.com/neo/jsh/modules/service/ |
| SQL and TAG table model | https://docs.machbase.com/neo/sql/ and https://docs.machbase.com/neo/sql/tag-table/ |
| Release notes | https://docs.machbase.com/neo/releases/ |
