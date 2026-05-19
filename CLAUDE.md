# Autoflow

A lightweight desktop app for building and running visual automation flows — no backend required.

## What It Does

- **Visual flow editor**: drag-and-drop node graph to wire up automation steps
- **Node types**: Trigger (manual / cron), REST API node, Script (cmd/PowerShell/bash), Condition branch
- **Flow variables**: key-value pairs defined on each flow, referenced with `${var:NAME}` in any field
- **Flow tags**: tag flows for filtering on the home page
- **Flow runner**: executes nodes in topological order, streams output in a live log panel
- **Persistence**: flows saved as JSON in the workspace directory via `tauri-plugin-fs`
- **Run Log**: execution history persisted to localStorage, grouped by date, configurable limit
- **Cron scheduler**: `tokio-cron-scheduler` in Rust fires `flow-fire` events; frontend runs flows in background
- **System tray**: minimize-to-tray, OS desktop notifications for background runs
- **In-app toasts**: completion toasts for all run types with direct log navigation
- **Light / dark theme**: CSS-variable–based theme switching, stored in settings
- **Auto-update**: `tauri-plugin-updater` checks GitHub Releases; manual check in Settings → About

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Shell | **Tauri v2** | Native window, no Node server, ~5 MB binary |
| UI framework | **React 19 + TypeScript** | Ecosystem, hooks, strict mode |
| Bundler | **Vite 7** | Fast HMR, ESM-native |
| Styling | **Tailwind CSS v4** (via `@tailwindcss/vite`) | Utility-first, CSS-variable themes |
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
  App.tsx               # Root layout + theme class application + startup update check
  index.css             # Tailwind base + light/dark CSS variable overrides + animations
  components/
    Sidebar.tsx         # Nav sidebar
    HomePage.tsx        # Flow cards, weather icon, arm/disarm, tags, multi-select, filters
    FlowEditor.tsx      # @xyflow/react canvas + undo/redo + variables bar + tags bar + log panel
    FlowVarsPanel.tsx   # Right panel: flow variable editor (shown when no node selected)
    NodePanel.tsx       # Right panel: selected node config (with REST API test button)
    LogPanel.tsx        # Bottom panel: live execution output
    RunLogPage.tsx      # Run history, grouped by date, filterable, exportable
    SettingsPage.tsx    # Settings: Workspace / Window & Tray / REST API / Shell / Run Log / About
    ToastContainer.tsx  # Fixed bottom-right toast notifications
    nodes/
      TriggerNode.tsx   # Schedule / manual trigger
      RestNode.tsx      # REST API node
      ScriptNode.tsx    # cmd / PowerShell / bash script
      ConditionNode.tsx # Branch on condition
      BaseNode.tsx      # Shared node chrome + run-status ring
    ui/
      Select.tsx        # Dropdown select component
      RefField.tsx      # Text field with upstream ref + flow variable picker
  store/
    flowStore.ts        # Zustand: flows, active flow, view, targetSessionId
    settingsStore.ts    # Persisted settings (localStorage)
    runLogStore.ts      # Run history (localStorage), configurable limit
    workspaceStore.ts   # Workspace path
    toastStore.ts       # In-memory toast queue
    seedFlows.ts        # Default example flows
  lib/
    executor.ts         # Topological sort + node execution (script + REST API)
    backgroundRunner.ts # Wraps runFlow for cron/catch-up/manual background runs + toasts
    cronService.ts      # Listens for flow-fire Tauri events, drives scheduler
    flowPersistence.ts  # Save/load flow JSON via tauri-plugin-fs
    flowIO.ts           # Import/export bundles (single + multi-flow JSON)
    graphRefs.ts        # Upstream node resolution for ${node-id} refs
    interpolate.ts      # ${node-id} and ${var:NAME} interpolation engine
  types/
    flow.ts             # Flow, Node, Edge TypeScript types (includes variables, tags)
    settings.ts         # AppSettings type + defaults

src-tauri/
  src/lib.rs            # Tauri app setup, scheduler, tray, Rust commands
  tauri.conf.json       # App config, shell scope, updater endpoint, createUpdaterArtifacts
  capabilities/
    default.json        # Tauri permissions
  Cargo.toml            # Rust deps
  icons/                # App icons generated from app-icon.svg via `npx tauri icon`
.github/workflows/
  release.yml           # Build + sign + publish on v* tag push
```

## Design Principles

- **Minimal & clean**: neutral palette (dark default, light optional), generous whitespace
- **One mental model**: everything is a flow made of nodes connected by edges
- **No backend**: HTTP calls go directly via tauri-plugin-http; shell via tauri-plugin-shell
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

# Regenerate app icons from app-icon.svg
npx tauri icon app-icon.svg
```

## Releasing

Push a `v*` tag — GitHub Actions builds, signs, and publishes automatically:

```bash
# 1. Bump version in package.json, src-tauri/Cargo.toml, src-tauri/tauri.conf.json
# 2. Commit, tag, push:
git add -A && git commit -m "Release v0.x.0"
git tag v0.x.0
git push && git push origin v0.x.0
```

## Flow Data Shape

```ts
interface Flow {
  id:          string;
  name:        string;
  description: string;
  variables?:  Record<string, string>;  // ${var:NAME} interpolation
  tags?:       string[];                // for filtering on home page
  nodes:       FlowNode[];
  edges:       FlowEdge[];
  status:      'idle' | 'running' | 'success' | 'error';
  lastRun?:    number;
  createdAt:   number;
  updatedAt:   number;
}
```

## Node Configuration Shape

```ts
type RestNodeData = {
  label:          string;
  method:         'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  endpoint:       string;
  bodyMode:       'form' | 'json';
  bodyRows:       { key: string; value: string }[];
  body:           string;
  tokenOverride?: string;
};

type ScriptNodeData = {
  label:    string;
  shell:    'cmd' | 'powershell' | 'bash';
  script:   string;
  workDir?: string;
};

type TriggerNodeData = {
  label:    string;
  mode:     'manual' | 'cron';
  cron?:    string;     // 5-field; Rust normalises to 6-field for tokio-cron-scheduler
  catchUp?: 'skip' | 'run-once' | 'run-all';
  enabled?: boolean;    // arm/disarm — false means scheduler skips this flow
};

type ConditionNodeData = {
  label:   string;
  source:  string;
  op:      'equals' | 'notEquals' | 'contains' | 'matches' | 'nonempty' | 'empty' | 'exitZero';
  value?:  string;
};
```

## Key Constraints

- **One trigger per flow** — enforced in the UI; second trigger is disabled in Add Node menu
- **Shell scope** in `tauri.conf.json` → `plugins.shell.scope` controls which executables can run
- **HTTP scope** in `capabilities/default.json` allows `https://**`
- **Cron field format**: UI accepts 5-field cron; `normalize_cron()` in Rust prepends `0` seconds for 6-field `tokio-cron-scheduler`
- **REST API base URL** configured globally in Settings → REST API; per-node `tokenOverride` overrides the global token
- **`${node-id}` interpolation**: downstream nodes reference upstream stdout; `${prev}` = immediate parent
- **`${var:NAME}` interpolation**: resolved from the flow's `variables` map before node refs
- **Insert ref picker**: `raw` inserts `${var:NAME}` (correct for numbers/booleans/form fields); `"text"` inserts `"${var:NAME}"` (quoted JSON string)
- **Theme**: `.light` class on `<html>` overrides CSS custom properties; applied via `useEffect` in `App.tsx`
- **Run log limit**: configurable in Settings → Run Log (default 100, range 10–500)
- **Auto-update signing key**: public key in `tauri.conf.json` (safe to commit); private key at `~/.tauri/autoflow.key` and as GitHub Actions secrets
- **`createUpdaterArtifacts: true`** in `tauri.conf.json` — required for updater bundle generation
- Tailwind v4 via `@tailwindcss/vite` (no `tailwind.config.js`)
- `@xyflow/react` requires: `import "@xyflow/react/dist/style.css"` in `main.tsx`
- App identifier: `io.github.ghostunderblanket.autoflow` — changing resets user app data
