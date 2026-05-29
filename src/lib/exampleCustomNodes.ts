import type { CustomNodeDef } from '../types/customNode';

export function getExampleCustomNodes(): CustomNodeDef[] {
  return [
    {
      id: 'discord-webhook',
      label: 'Discord Webhook',
      color: '#5865F2',
      description: 'Post a message to a Discord channel via webhook URL',
      version: '1.0.0',
      fields: [
        { name: 'url',      label: 'Webhook URL', type: 'text',     placeholder: 'https://discord.com/api/webhooks/…' },
        { name: 'content',  label: 'Message',     type: 'textarea', placeholder: 'Hello from Autoflow! ${prev}' },
        { name: 'username', label: 'Bot name',     type: 'text',     default: 'Autoflow', placeholder: 'Autoflow' },
      ],
      executor: {
        type: 'js',
        fn: `async ({ fields, log }) => {
  if (!fields.url) throw new Error('Webhook URL is required');
  const body = { content: fields.content, username: fields.username || 'Autoflow' };
  log('POST ' + fields.url);
  const res = await fetch(fields.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error('Discord returned ' + res.status + (err ? ': ' + err : ''));
  }
  log('✓ message sent');
  return fields.content;
}`,
      },
    },
    {
      id: 'slack-message',
      label: 'Slack Message',
      color: '#611F69',
      description: 'Post a message to a Slack channel via Incoming Webhook',
      version: '1.0.0',
      fields: [
        { name: 'url',        label: 'Webhook URL',           type: 'text',     placeholder: 'https://hooks.slack.com/services/…' },
        { name: 'text',       label: 'Message',               type: 'textarea', placeholder: 'Build complete: ${prev}' },
        { name: 'channel',    label: 'Channel (optional)',     type: 'text',     placeholder: '#deploys' },
        { name: 'icon_emoji', label: 'Icon emoji (optional)', type: 'text',     default: ':robot_face:', placeholder: ':robot_face:' },
      ],
      executor: {
        type: 'js',
        fn: `async ({ fields, log }) => {
  if (!fields.url) throw new Error('Webhook URL is required');
  const body = { text: fields.text };
  if (fields.channel)    body.channel    = fields.channel;
  if (fields.icon_emoji) body.icon_emoji = fields.icon_emoji;
  log('POST ' + fields.url);
  const res   = await fetch(fields.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const reply = await res.text();
  if (!res.ok || reply !== 'ok') throw new Error('Slack returned ' + res.status + ': ' + reply);
  log('✓ ' + reply);
  return fields.text;
}`,
      },
    },
    {
      id: 'ntfy-notify',
      label: 'ntfy Notification',
      color: '#a855f7',
      description: 'Push a phone notification via ntfy.sh — free, no account needed for public topics',
      version: '1.0.0',
      fields: [
        { name: 'topic',    label: 'Topic',    type: 'text',   placeholder: 'my-autoflow-alerts' },
        { name: 'title',   label: 'Title',    type: 'text',   placeholder: 'Autoflow alert' },
        { name: 'message', label: 'Message',  type: 'textarea', placeholder: '${prev}' },
        { name: 'priority', label: 'Priority', type: 'select', default: 'default', options: ['min', 'low', 'default', 'high', 'urgent'] },
        { name: 'server',  label: 'Server',   type: 'text',   default: 'https://ntfy.sh', placeholder: 'https://ntfy.sh' },
      ],
      executor: {
        type: 'js',
        fn: `async ({ fields, log }) => {
  const url = (fields.server || 'https://ntfy.sh').replace(/\\/+$/, '') + '/' + fields.topic;
  log('POST ' + url);
  const headers = { 'Content-Type': 'text/plain' };
  if (fields.title)                              headers['Title']    = fields.title;
  if (fields.priority && fields.priority !== 'default') headers['Priority'] = fields.priority;
  const res = await fetch(url, { method: 'POST', headers, body: fields.message });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error('ntfy returned ' + res.status + (err ? ': ' + err : ''));
  }
  log('✓ notification sent');
  return fields.message;
}`,
      },
    },
    {
      id: 'json-extract',
      label: 'JSON Extract',
      color: '#10b981',
      description: 'Extract a value from upstream JSON using a dot-path (e.g. data.user.name)',
      version: '1.0.0',
      fields: [
        { name: 'path',     label: 'Dot-path',              type: 'text', placeholder: 'data.user.name' },
        { name: 'fallback', label: 'Fallback (if missing)', type: 'text', default: '', placeholder: '' },
      ],
      executor: {
        type: 'js',
        fn: `async ({ fields, prev, log }) => {
  let obj;
  try { obj = JSON.parse(prev); }
  catch { throw new Error('Upstream output is not valid JSON'); }
  const keys = fields.path.split('.').filter(Boolean);
  let val = obj;
  for (const k of keys) {
    if (val == null || typeof val !== 'object') { val = undefined; break; }
    val = val[k];
  }
  if (val === undefined || val === null) {
    if (fields.fallback !== '') { log('path not found, using fallback'); return fields.fallback; }
    throw new Error('Path "' + fields.path + '" not found in JSON');
  }
  const out = typeof val === 'string' ? val : JSON.stringify(val);
  log(fields.path + ' = ' + out);
  return out;
}`,
      },
    },
    {
      id: 'http-post',
      label: 'HTTP POST',
      color: '#f59e0b',
      description: 'Generic authenticated HTTP POST — sends upstream stdout as the request body',
      version: '1.0.0',
      fields: [
        { name: 'url',          label: 'URL',          type: 'text',   placeholder: 'https://api.example.com/events' },
        { name: 'content_type', label: 'Content-Type', type: 'select', default: 'application/json', options: ['application/json', 'text/plain', 'application/x-www-form-urlencoded'] },
        { name: 'token',        label: 'Bearer token (optional)', type: 'text', placeholder: '${secret:API_TOKEN}' },
      ],
      executor: {
        type: 'js',
        fn: `async ({ fields, prev, log }) => {
  if (!fields.url) throw new Error('URL is required');
  const headers = { 'Content-Type': fields.content_type };
  if (fields.token) headers['Authorization'] = 'Bearer ' + fields.token;
  log(fields.url);
  const res  = await fetch(fields.url, { method: 'POST', headers, body: prev });
  const body = await res.text();
  log('← ' + res.status + ' ' + res.statusText);
  if (!res.ok) throw new Error('HTTP ' + res.status + ': ' + body.slice(0, 200));
  return body;
}`,
      },
    },
  ];
}
