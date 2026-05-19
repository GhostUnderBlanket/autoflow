# Autoflow

A lightweight desktop app for building and running visual automation flows — no backend required.

## What It Does

- **Visual flow editor**: drag-and-drop node graph to wire up automation steps
- **Node types**: triggers (schedule, manual), actions (REST API, `.bat`/PowerShell/bash script, condition branch)
- **Flow runner**: executes nodes in topological order, streams output in a live log panel
- **Persistence**: flows saved as JSON files in the workspace directory via `tauri-plugin-fs`
- **Run Log**: all executions logged and persisted to localStorage, grouped by date
- **Cron scheduler**: `tokio-cron-scheduler` in Rust fires `flow-fire` events; frontend picks them up and runs in background
- **System tray**: minimize-to-tray, desktop notifications for background runs
- **Auto-update**: `tauri-plugin-updater` checks GitHub Releases on startup; manual check in Settings → About

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Shell | **Tauri v2** | Native window, no Node server, ~5 MB binary |
| UI framework | **React 19 + TypeScript** | Ecosystem, hooks, strict mode |
| Bundler | **Vite 7** | Fast HMR, ESM-native |
| Styling | **Tailwind CSS v4** (via `@tailwindcss/vite`) | Utility-first, zero config |
| Flow graph | **@xyflow/react v12** | The standard React flow/graph library |
| State | **Zustand v5** | Minimal, no boilerplate |
| Icons | **lucide-react** | Clean, consistent icon set |
| HTTP client | **tauri-plugin-http** | REST API calls from the frontend |
| Shell execution | **tauri-plugin-shell** | Runs cmd / powershell / bash script nodes |
| File I/O | **tauri-plugin-fs** | Read/write flow JSON |
| Scheduler | **tokio-cron-scheduler** (Rust) | Cron-based flow triggers |
| Notifications | **tauri-plugin-notification** | Desktop alerts for background runs |
| Updates | **tauri-plugin-updater** | Auto-update from GitHub Releases |

## Project Structure

```
src/
  main.tsx              # React entry
  App.tsx               # Root layout: sidebar + main panel (startup update check here)
  index.css             # Tailwind base import
  components/
    Sidebar.tsx         # Flow list + nav
    HomePage.tsx        # Flow cards, multi-select, filter, bulk actions
    FlowEditor.tsx      # @xyflow/react canvas + undo/redo + log panel
    NodePanel.tsx       # Right panel: selected node config (with REST API test button)
    LogPanel.tsx        # Bottom panel: live execution output
    RunLogPage.tsx      # Run history, grouped by date, filterable, exportable
    SettingsPage.tsx    # Settings: Workspace / REST API / Shell / Window & Tray / About
    nodes/
      TriggerNode.tsx   # Schedule / manual trigger
      RestNode.tsx      # REST API node
      ScriptNode.tsx    # cmd / PowerShell / bash script
      ConditionNode.tsx # Branch on condition
      BaseNode.tsx      # Shared node chrome + run-status ring
  store/
    flowStore.ts        # Zustand store: flows, active flow, view
    settingsStore.ts    # Persisted settings (localStorage)
    runLogStore.ts      # Run history (localStorage), max 100 sessions
    workspaceStore.ts   # Workspace path
    seedFlows.ts        # Default example flows
  lib/
    executor.ts         # Topological sort + node execution (script + REST API)
    backgroundRunner.ts # Wraps runFlow for cron/catch-up background runs
    cronService.ts      # Listens for flow-fire Tauri events, drives scheduler
    flowPersistence.ts  # Save/load flow JSON via tauri-plugin-fs
    flowIO.ts           # Import/export bundles (single + multi-flow JSON)
    graphRefs.ts        # Upstream node resolution for ${node-id} refs
    interpolate.ts      # ${node-id} interpolation engine
  types/
    flow.ts             # Flow, Node, Edge TypeScript types
    settings.ts         # AppSettings type + defaults

src-tauri/
  src/lib.rs            # Tauri app setup, scheduler, tray, Rust commands
  tauri.conf.json       # App config, shell scope, window size, updater endpoint
  capabilities/
    default.json        # Tauri permissions
  Cargo.toml            # Rust deps
  .github/workflows/
    release.yml         # Build + sign + publish on v* tag push
```

## Design Principles

- **Minimal & clean**: dark neutral palette, generous whitespace, no decorative chrome
- **One mental model**: everything is a flow made of nodes connected by edges
- **No backend**: HTTP calls go directly via tauri-plugin-http; shell runs via tauri-plugin-shell
- **No accounts, no cloud**: flows live in local workspace as plain JSON; settings in localStorage

## Development Commands

```bash
# Install JS deps
npm install

# Start dev (opens window with HMR)
npm run tauri dev

# Type check
npx tsc --noEmit

# Production build
npm run tauri build
```

## Releasing

Push a `v*` tag — GitHub Actions builds, signs, and publishes automatically:

```bash
# 1. Bump version in package.json, src-tauri/Cargo.toml, src-tauri/tauri.conf.json
# 2. Commit, tag, push:
git add -A && git commit -m "Release v0.2.0"
git tag v0.2.0
git push && git push origin v0.2.0
```

## Node Configuration Shape

```ts
// Each node stores its config in node.data
type RestNodeData = {
  label:          string;
  method:         'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  endpoint:       string;           // e.g. "addWorklog"
  bodyMode:       'form' | 'json';
  bodyRows:       { key: string; value: string }[];  // used when bodyMode === 'form'
  body:           string;           // raw JSON string when bodyMode === 'json'
  tokenOverride?: string;           // per-node bearer token; empty = use global settings
};

type ScriptNodeData = {
  label:    string;
  shell:    'cmd' | 'powershell' | 'bash';
  script:   string;     // inline script body
  workDir?: string;
};

type TriggerNodeData = {
  label:    string;
  mode:     'manual' | 'cron';
  cron?:    string;     // e.g. "0 9 * * 1-5"  (5-field; Rust normalises to 6-field)
  catchUp?: 'skip' | 'run-once' | 'run-all';
  enabled?: boolean;
};

type ConditionNodeData = {
  label:   string;
  source:  string;   // e.g. "${prev}" or "${node-id}"
  op:      'equals' | 'notEquals' | 'contains' | 'matches' | 'nonempty' | 'empty' | 'exitZero';
  value?:  string;   // compare-with value for equals/notEquals/contains/matches
};
```

## Key Constraints

- **Shell scope** in `tauri.conf.json` → `plugins.shell.scope` controls which executables can run
- **HTTP scope** in `capabilities/default.json` allows `https://**`; add patterns for additional origins
- **Cron field format**: UI accepts 5-field cron (`min hour dom month dow`); `normalize_cron()` in Rust prepends `0` seconds to produce the 6-field format required by `tokio-cron-scheduler`
- **REST API base URL** is configured globally in Settings → REST API; per-node `tokenOverride` overrides the global bearer token
- **${node-id} interpolation**: downstream nodes can reference upstream output with `${node-id}`; `${prev}` resolves to the immediate parent
- **Auto-update signing key**: public key is in `tauri.conf.json` (safe to commit); private key lives in `~/.tauri/autoflow.key` and as a GitHub Actions secret — never commit it
- Tailwind v4 is configured via `@tailwindcss/vite` plugin (no `tailwind.config.js` needed)
- `@xyflow/react` requires its CSS: `import "@xyflow/react/dist/style.css"` in `main.tsx`
- Run log is capped at 100 sessions; oldest are evicted automatically
- App identifier is `io.github.ghostunderblanket.autoflow` — changing this would reset user app data
