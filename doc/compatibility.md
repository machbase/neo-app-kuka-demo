# Compatibility and documentation baseline for Neo 8.7.0 and later

Official documentation reviewed on **2026-09-15**. The primary reference is the [official Machbase Neo documentation](https://docs.machbase.com/neo/).

## Support policy

- The minimum target is Machbase Neo **8.7.0**. The app is maintained to use the same JSH API contract on later versions.
- Actual runtime checks are recorded by version and build in the [validation record](validation.md). The support target does not mean that every later version has been tested.
- Before introducing a new API, check its introduction version in the official documentation. If a required API was added after 8.7.0, first decide on an alternative that works on the baseline or a change to the supported version range.
- Check the product version with `machbase-neo version` in the OS shell. `process.version` / `process.versions.jsh` identify the JSH version. The verified 8.7.0 executable reported `jsh-1.0.0` / `1.0.0`, respectively.
- State the minimum version in the `package.json` description and documentation. Do not invent a Neo version check in the manifest or claim an execution guarantee that the official `pkg` documentation does not establish.

## Official documentation and app usage

| Area | App convention | Official documentation |
| --- | --- | --- |
| Execution | Use `machbase-neo jsh` or execute a mounted script directly. `shell` opens the Neo SQL shell | [JSH](https://docs.machbase.com/neo/jsh/) |
| File paths | Distinguish the default `/work` mapping of the OS working directory from explicit `-v` mounts | [Mounts](https://docs.machbase.com/neo/jsh/#directory-mounting) |
| Commands | Distinguish OS commands from JSH commands. Use JSH commands and pipes within their officially supported scope | [Commands](https://docs.machbase.com/neo/jsh/commands/) |
| Packages | Use built-in modules without installation. Run from the project root and separate app options, as in `pkg run start -- --port 56803` | [Packages](https://docs.machbase.com/neo/jsh/packages/) |
| CLI options | Use `require('util/parseArgs')`, explicit option types, and strict validation | [parseArgs](https://docs.machbase.com/neo/jsh/modules/util/parseargs/) |
| HTTP | Use `http.Server` and router context; pass `env: process.env` when serving static files | [http](https://docs.machbase.com/neo/jsh/modules/http/) |
| DB | Use `Client({ host, port, user, password })`, positional parameters, and cleanup of query and connection resources | [machcli](https://docs.machbase.com/neo/jsh/modules/machcli/) |
| Schema | Use the NAME / TIME / VALUE TAG model; run schema setup and insertion explicitly | [SQL](https://docs.machbase.com/neo/sql/) / [TAG](https://docs.machbase.com/neo/sql/tag-table/) |
| Environment and child execution | Use `process.env.get()` and `process.exec()` | [process](https://docs.machbase.com/neo/jsh/modules/process/) |
| Output and files | Use `console.println()`, `Sync` aliases for synchronous fs APIs, and POSIX paths by default | [global](https://docs.machbase.com/neo/jsh/global/) / [fs](https://docs.machbase.com/neo/jsh/modules/fs/) / [path](https://docs.machbase.com/neo/jsh/modules/path/) |
| Future service extensions | Use management APIs only when a controller has been explicitly obtained | [service](https://docs.machbase.com/neo/jsh/modules/service/) |

Documentation links use canonical web page paths. In the Markdown source, the option parser documentation path is `util/parseargs.md`, but the actual module name is the case-sensitive `util/parseArgs`.

## Current APIs and the robot motion sample

The current `machcli` documentation describes the 8.7.0 database selection options (`database`, alias `db`), named parameters, `append()`, and `tx()`. This sample uses the default database, positional parameters, and the documented appender for 33,271 public motion frames. TAG tables do not support transaction rollback, so insertion is not wrapped in `tx()`. A separate completion-marker table prevents partial runs from becoming visible through the API.

The browser uses Three.js r186 and public robot meshes as locally served static assets. These are browser dependencies and are not installed by JSH `pkg`; the exact files and licenses are checked into the repository. `http.Server.static()` exposes only the dedicated `public/assets` and `public/vendor` trees. Robot descriptions, source CSV files, and license source files remain outside the web root.

`addShutdownHook()` is not guaranteed to run on forced termination or unhandled OS signals. Clean up DB resources in the request or command's `finally` block, and do not rely on a shutdown hook alone to preserve data.

The `service` module requires `SERVICE_CONTROLLER` or an explicit controller address. Do not assume that standalone JSH always has access to Neo service management. The current app runs an HTTP server in the foreground and does not register a service.

## Observed runtime differences

The current package documentation shows argument forwarding without a separator, such as `pkg run start --verbose`. However, the installed 8.7.0 build `c4954cf0` rejected `--port` as an unknown `pkg` option. The template documents `pkg run start -- --port ...`, which was verified on this minimum version. Likewise, pass `--help` as `pkg run start -- --help` to display the app's help.

The failure to preserve exit codes in HTTP callbacks on build `c4954cf0` is a local observation recorded separately from the official API specification. The check command uses a synchronous parent to verify the child worker's success report. Even if a later build fixes the issue, preserve the contract that failed or incomplete checks must not be treated as successful.

If an API in the latest documentation behaves differently on the installed build, reproduce the difference on that version and record any small compatibility adjustment together with validation evidence. Do not add support code for untested older versions or remove existing compatibility handling based only on the latest documentation.
