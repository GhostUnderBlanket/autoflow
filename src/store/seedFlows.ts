import type { Flow } from '../types/flow';

/**
 * Flows the user sees on first launch. Written to disk once on bootstrap;
 * after that the user owns them — delete or edit freely.
 */

const T = Date.now();
const H = 3_600_000;

export const SEED_FLOWS: Flow[] = [
  {
    id:          'flow-1',
    name:        'Quick Worklog · 1 hour on PLR-37',
    description: 'Single-shot REST API worklog. Manual trigger logs 1 hour against PLR-37 with today\'s date. Edit the body fields to customise.',
    nodes: [
      { id: 'n1', type: 'trigger', label: 'Manual',     position: { x: 0,   y: 0 }, data: { mode: 'manual' } },
      {
        id:       'n2',
        type:     'rest',
        label:    'addWorklog',
        position: { x: 260, y: 0 },
        data: {
          method:    'POST',
          endpoint:  'addWorklog',
          bodyMode:  'form',
          bodyRows:  [
            { key: 'taskId',      value: 'PLR-37' },
            { key: 'hours',       value: '1' },
            { key: 'description', value: 'Automation task' },
          ],
        },
      },
    ],
    edges:     [{ id: 'e1', source: 'n1', target: 'n2' }],
    variables: {},
    status:    'idle',
    createdAt: T - 7 * 24 * H,
    updatedAt: T - H,
  },
  {
    id:          'flow-2',
    name:        'Backup & Notify',
    description: 'Runs backup.bat then dispatches a PowerShell notification script on successful exit.',
    nodes: [
      { id: 'n1', type: 'trigger', label: 'Manual',     position: { x: 0,   y: 0 }, data: { mode: 'manual' } },
      { id: 'n2', type: 'script',  label: 'backup.bat', position: { x: 240, y: 0 }, data: { shell: 'cmd',        script: 'backup.bat' } },
      { id: 'n3', type: 'script',  label: 'notify.ps1', position: { x: 480, y: 0 }, data: { shell: 'powershell', script: 'notify.ps1' } },
    ],
    edges: [
      { id: 'e1', source: 'n1', target: 'n2' },
      { id: 'e2', source: 'n2', target: 'n3' },
    ],
    status:    'idle',
    lastRun:   T - 24 * H,
    createdAt: T - 3 * 24 * H,
    updatedAt: T - 24 * H,
  },
  {
    id:          'flow-3',
    name:        'Daily Worklog · Weekdays 18:00',
    description: 'Scheduled REST API worklog. (1) Resolve today\'s date in YYYY-MM-DD, (2) POST to /addWorklog with the date wired in. Configure your taskId, hours, and API token in Settings.',
    nodes: [
      { id: 'wl-trigger', type: 'trigger', label: 'Weekdays 18:00', position: { x: 0,   y: 120 }, data: { mode: 'cron', cron: '0 18 * * 1-5', catchUp: 'skip', enabled: true } },
      {
        id:       'wl-date',
        type:     'script',
        label:    'Resolve date',
        position: { x: 240, y: 120 },
        data: { shell: 'powershell', script: 'Get-Date -Format "yyyy-MM-dd"' },
      },
      {
        id:       'wl-log',
        type:     'rest',
        label:    'addWorklog',
        position: { x: 500, y: 120 },
        data: {
          method:   'POST',
          endpoint: 'addWorklog',
          bodyMode: 'form',
          bodyRows: [
            { key: 'taskId',      value: 'PLR-37' },
            { key: 'hours',       value: '8' },
            { key: 'date',        value: '${wl-date}' },
            { key: 'description', value: 'Daily work on PLR-37' },
          ],
        },
      },
    ],
    edges: [
      { id: 'wl-e1', source: 'wl-trigger', target: 'wl-date' },
      { id: 'wl-e2', source: 'wl-date',    target: 'wl-log'  },
    ],
    status:    'idle',
    createdAt: T - 30 * 60_000,
    updatedAt: T - 30 * 60_000,
  },
];
