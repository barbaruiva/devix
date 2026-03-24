# Express Proxy Router

A local development router/proxy with an Electron GUI.

It routes requests by proxy path (for example `/api1`) to environment-specific destinations (`dev`, `stage`, `prod`, etc.), and lets you switch active environments from the UI.

## Features

- Proxy routing with Express + `http-proxy-middleware`
- Electron desktop app with Vue renderer
- Live logs tab (structured request logs)
- Configuration tab to change active route per proxy
- File-based config split:
  - `proxies.json` for static proxy definitions
  - `config.json` for active route selection only
- Auto-reload when `proxies.json` or `config.json` changes

## Requirements

- Node.js 20+
- npm

## Install

```bash
npm install
```

## Run

### Electron GUI

```bash
npm start
```

### CLI mode

```bash
npm run start:cli
```

### Dev mode (Vite + Electron)

```bash
npm run dev
```

## Configuration

### `proxies.json`

Static proxy definitions and available routes.

```json
{
  "port": 12345,
  "proxies": [
    {
      "name": "API 1",
      "path": "/api1",
      "routes": {
        "dev": { "destination": "http://localhost:8080" },
        "stage": { "destination": "http://gateway-stage/api1" }
      }
    }
  ]
}
```

### `config.json`

Active route selection by unique proxy path.

```json
{
  "activeRoutes": {
    "/api1": "dev"
  }
}
```

## Scripts

- `npm start`: build renderer and launch Electron
- `npm run start:cli`: run proxy server from terminal
- `npm run dev`: run Vite and Electron together
- `npm run build:renderer`: build Vue renderer to `dist/renderer`

## Logs (GUI)

The Logs tab renders structured entries with:

- Timestamp
- Status code
- Method
- Proxy path
- Full destination path
- Request size (bytes)

## Notes

- `path` in each proxy entry should be unique.
- Edit `proxies.json` when adding/changing routes.
- Edit `config.json` when changing active routes only.
