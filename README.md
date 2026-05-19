# Autoflow

A lightweight desktop app for building and running visual automation flows — no backend, no accounts, no cloud.

![Tauri v2](https://img.shields.io/badge/Tauri-v2-blue)
![React 19](https://img.shields.io/badge/React-19-61dafb)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)
![Platform](https://img.shields.io/badge/platform-Windows-lightgrey)

## What It Does

- **Visual flow editor** — drag-and-drop node graph to wire up automation steps
- **Node types** — Trigger (manual / cron schedule), Polaris REST API, Script (cmd / PowerShell / bash), Condition branch
- **Flow runner** — executes nodes in topological order, streams output in a live log panel
- **Cron scheduler** — Rust-side `tokio-cron-scheduler` fires flows on schedule even when the window is hidden
- **System tray** — minimize to tray, desktop notifications for background runs
- **Run Log** — full execution history persisted across restarts, filterable and exportable
- **Auto-update** — checks GitHub Releases on startup; one-click install from Settings → About

## Tech Stack

| Layer | Choice |
|---|---|
| Shell | Tauri v2 |
| UI | React 19 + TypeScript + Vite 7 |
| Styling | Tailwind CSS v4 |
| Flow graph | @xyflow/react v12 |
| State | Zustand v5 |
| HTTP | tauri-plugin-http |
| Scheduler | tokio-cron-scheduler (Rust) |
| Updates | tauri-plugin-updater |

## Development

```bash
npm install
npm run tauri dev      # dev window with HMR
npx tsc --noEmit       # type check
npm run tauri build    # production build + installer
```

## Releasing

Push a `v*` tag — GitHub Actions builds, signs, and publishes the release automatically:

```bash
# bump version in package.json + src-tauri/Cargo.toml + src-tauri/tauri.conf.json
git add -A && git commit -m "Release v0.2.0"
git tag v0.2.0
git push && git push origin v0.2.0
```

## Node Types

| Node | Purpose |
|---|---|
| **Trigger** | Starts the flow — manually or on a cron schedule |
| **Polaris** | HTTP request (GET/POST/PUT/PATCH/DELETE) with form or raw-JSON body |
| **Script** | Inline cmd / PowerShell / bash script |
| **Condition** | Branches flow on a condition; true/false edges route downstream nodes |

Downstream nodes reference upstream output with `${node-id}` or `${prev}`.

## License

MIT
