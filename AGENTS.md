# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install

npm start            # build renderer, then launch Electron (uses --no-sandbox)
npm run dev          # Vite dev server + Electron with VITE_DEV_SERVER_URL set (hot reload for renderer)
npm run start:cli    # headless proxy server via main.js, no Electron
npm run build:renderer

npm test             # vitest run
npm run test:watch
npx vitest run src/runtime/logger.test.js          # single file
npx vitest run -t 'falls back to first route'      # single test by name

npm run lint
npm run lint:fix

npm run dist:linux   # package AppImage + .deb into release/ (dist:win for the NSIS installer)
```

Local fake backend for the `local` routes in `proxies-template.json`:
`docker compose up fake-api` (json-server on port 3001, data in `docker/db.json`).

`config.json` and `proxies.json` are gitignored. The CLI requires them in the cwd (copy from
`config-template.json` / `proxies-template.json`); the Electron app seeds any missing one from the
templates via `ensureConfigFiles` (`src/runtime/configFiles.js`). Unpackaged it uses the repo root;
packaged it uses `app.getPath('userData')` (`~/.config/devix`), since `app.asar` is read-only.

## Architecture

**One runtime core, two entry points.** `src/runtime/proxyRuntime.js` owns the Express server and
is entirely Electron-free. `main.js` (CLI) and `electron/main.js` (GUI) each construct a single
`ProxyRuntime` and drive it. Keep proxy/config logic in `src/runtime/` — it is the only tested layer.

**Split config, by design.**
- `proxies.json` — port + static proxy definitions (`name`, unique `path`, `routes: {key: {destination}}`). Edited via the APIs tab.
- `config.json` — `activeRoutes` only, keyed by proxy **path** (not name). Edited via the Config tab or tray menu.

`buildRuntimeState(proxiesConfig, runtimeConfig)` merges the two into the in-memory state, validates
uniqueness of `path`, and falls back to the first route when the configured one is missing. It is a
pure function and the main unit under test.

**Reload is stop-and-restart, not hot swap.** Changing a route writes `config.json` then calls
`reload()` → `stop()` + `start()`, rebuilding the whole Express app. `fs.watch` on both config files
triggers the same path, debounced 200ms (`scheduleReload`). Because the app writes the files it also
watches, every self-write sets `ignoreWatchEventsUntil` to swallow the resulting watch event — keep
that guard when adding new writes. Concurrent reloads are serialized via `isReloading`/`pendingReload`.

**Proxying.** Each proxy mounts `createProxyMiddleware` at its `path` with `pathRewrite` stripping
that prefix and `selfHandleResponse: true`. Request bodies are captured by draining `req` in
`onProxyReq` into `req._capturedBody`; response bodies come from `responseInterceptor`. Both are
capped at `BODY_CAPTURE_LIMIT` (256 KB) and JSON-parsed when possible. A catch-all `app.use('/')`
returns 500 for unmatched paths.

**Logger dual output.** `src/runtime/logger.js` is an EventEmitter. Every call takes
`(message, terminalMessage, data)`: `message` + `data` form the structured entry emitted to
subscribers (the GUI), while `terminalMessage` carries the chalk-colored variant for stdout.
Pass `{ gui: false }` in `data` for terminal-only lines. Electron's main process subscribes, keeps a
1000-entry ring buffer, and pushes each entry to all windows over IPC.

**GUI wiring.** The renderer is sandboxed (`contextIsolation: true`, no node integration) and reaches
the main process only through `window.proxyApi`, defined in `electron/preload.js`. Adding a capability
means three edits: `ipcMain.handle` in `electron/main.js`, a bridge method in `preload.js`, a call in
`renderer/src/App.vue`. `App.vue` is the only component that touches `window.proxyApi`: it owns the
IPC wiring and the shell, and feeds `components/` (`AppBar`, `LogsTab`, `RoutesTab`, `SettingsTab`,
`StatusBar`, `ToastHost`, …) through props/events. Pure helpers live in `renderer/src/lib/`
(`format`, `inspect`, `clipboard`, `toasts`) and design tokens in `renderer/src/styles/theme.css`.
Tab ids are internal (`logs` / `config` / `apis`); the labels are Logs / Routes / Settings.

Fonts are bundled, not fetched: the CSP is `default-src 'self'`, so Inter and JetBrains Mono ship as
variable `.woff2` files in `renderer/public/fonts/`, declared in `theme.css`. Reference them as
`/fonts/…` — Vite rewrites that to a relative URL, which is what the `file://` page needs. `theme.css`
also owns the global reset, scrollbars, the shared `:focus-visible` ring and the
`prefers-reduced-motion` block (it zeroes `--dur-fast`/`--dur-base`, so new transitions should keep
using those tokens).

The tray menu mirrors runtime state; after any config mutation call both `refreshTrayMenu()` and
`notifyConfigUpdated()` so tray and renderer stay in sync. Closing the window hides it — the app lives
in the tray until Quit sets `app.isQuitting`.

## Packaging and releases

electron-builder config lives in the `build` field of `package.json`. Output goes to `release/`
(not the default `dist/`, which holds the renderer build). `build/icon.png` is the app icon — currently
an upscale of the tray icon. The `files` allowlist decides what ships in `app.asar`: a new top-level
file or directory needed at runtime must be added there. `.github/workflows/release.yml` builds Linux
and Windows on tag push `v*` (tag must equal `package.json` version) and publishes a GitHub Release;
`workflow_dispatch` builds without releasing.

## Gotchas

- **`npm run lint` currently fails** (~620 errors). `eslint.config.cjs` enforces `semi: ['error', 'never']`
  but the entire codebase is written with semicolons, so `lint:fix` would rewrite nearly every file.
  Don't run `lint:fix` repo-wide as a side effect of an unrelated change.
- The eslint config declares no vitest globals, so `describe`/`test`/`expect` in `src/**/*.test.js`
  report `no-undef` even though `vitest.config.mjs` sets `globals: true`.
- Vitest picks up `src/**/*.test.js` and `renderer/src/**/*.test.js`; the runtime is CommonJS while
  `renderer/` is ESM. Renderer coverage is limited to the pure helpers in `renderer/src/lib/` —
  there is no component test setup.
