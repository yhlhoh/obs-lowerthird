const express = require('express');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Global settings
let settings = {
  autoHideDuration: 0 // 0 = disabled, >0 = ms to auto-hide
};

// Appearance presets: define the visual template with {{placeholder}} support
let presets = [
  {
    id: 'preset-gala-iframe-1',
    name: '晚会右侧信息区 · 模板示例',
    kind: 'iframe',
    align: 'right',
    themeColor: '',
    extraCss: '',
    fieldDefs: [
      { key: 'tag', label: '标签', defaultValue: 'LIVE · GALA' },
      { key: 'mainTitle', label: '主标题', defaultValue: '2026 新春特别晚会' },
      { key: 'subtitle', label: '副标题', defaultValue: '示例：你可以在这里完全自定义 HTML / CSS / JS' }
    ],
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
      color: #fff;
      background: transparent;
    }
    .wrap {
      position: relative;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: flex-start;
      padding: 10px 16px;
      box-sizing: border-box;
    }
    .tag {
      font-size: 11px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      opacity: 0.85;
    }
    .title {
      margin-top: 6px;
      font-size: 20px;
      font-weight: 800;
    }
    .subtitle {
      margin-top: 4px;
      font-size: 14px;
      opacity: 0.9;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="tag">{{tag}}</div>
    <div class="title">{{mainTitle}}</div>
    <div class="subtitle">{{subtitle}}</div>
  </div>
</body>
</html>`
  }
];

// Content presets: define field values to fill into appearance preset templates
let contentPresets = [
  {
    id: 'content-preset-1',
    name: '春晚主持人介绍',
    appearancePresetId: 'preset-gala-iframe-1',
    fields: {
      tag: 'LIVE · GALA',
      mainTitle: '2026 新春特别晚会',
      subtitle: '主持人：某某某 · 某某某'
    }
  },
  {
    id: 'content-preset-2',
    name: '节目单第一项',
    appearancePresetId: 'preset-gala-iframe-1',
    fields: {
      tag: '节目单 01',
      mainTitle: '《欢乐中国年》',
      subtitle: '表演：XX歌舞团'
    }
  }
];

let activePresetId = null;
let activeContentPresetId = null;
let activeFieldOverrides = {};

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Settings API ─────────────────────────────────────────────────────────────

app.get('/api/settings', (req, res) => {
  res.json(settings);
});

app.put('/api/settings', (req, res) => {
  const { autoHideDuration } = req.body || {};
  if (typeof autoHideDuration === 'number') {
    settings.autoHideDuration = Math.max(0, autoHideDuration);
  }
  res.json(settings);
});

// ── Appearance Presets API ────────────────────────────────────────────────────

app.get('/api/presets', (req, res) => {
  res.json({ presets, contentPresets, activePresetId, activeContentPresetId, settings });
});

app.post('/api/presets', (req, res) => {
  const {
    name = '未命名外观',
    kind = 'iframe',
    html = '',
    themeColor = '',
    align = 'right',
    extraCss = '',
    fieldDefs = []
  } = req.body || {};
  const preset = {
    id: Date.now().toString(),
    name,
    kind,
    html,
    themeColor,
    align,
    extraCss,
    fieldDefs
  };
  presets.push(preset);
  res.json(preset);
});

app.put('/api/presets/:id', (req, res) => {
  const { id } = req.params;
  const idx = presets.findIndex(p => p.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const {
    name = presets[idx].name,
    kind = presets[idx].kind,
    html = presets[idx].html,
    themeColor = presets[idx].themeColor,
    align = presets[idx].align,
    extraCss = presets[idx].extraCss,
    fieldDefs = presets[idx].fieldDefs || []
  } = req.body || {};
  presets[idx] = { ...presets[idx], name, kind, html, themeColor, align, extraCss, fieldDefs };
  res.json(presets[idx]);
});

app.delete('/api/presets/:id', (req, res) => {
  const { id } = req.params;
  presets = presets.filter(p => p.id !== id);
  if (activePresetId === id) {
    activePresetId = null;
    broadcastActive();
  }
  res.json({ ok: true });
});

// ── Content Presets API ───────────────────────────────────────────────────────

app.get('/api/content-presets', (req, res) => {
  res.json(contentPresets);
});

app.post('/api/content-presets', (req, res) => {
  const {
    name = '未命名内容',
    appearancePresetId = '',
    fields = {}
  } = req.body || {};
  const cp = {
    id: Date.now().toString(),
    name,
    appearancePresetId,
    fields
  };
  contentPresets.push(cp);
  res.json(cp);
});

app.put('/api/content-presets/:id', (req, res) => {
  const { id } = req.params;
  const idx = contentPresets.findIndex(c => c.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  const {
    name = contentPresets[idx].name,
    appearancePresetId = contentPresets[idx].appearancePresetId,
    fields = contentPresets[idx].fields
  } = req.body || {};
  contentPresets[idx] = { ...contentPresets[idx], name, appearancePresetId, fields };
  res.json(contentPresets[idx]);
});

app.delete('/api/content-presets/:id', (req, res) => {
  const { id } = req.params;
  contentPresets = contentPresets.filter(c => c.id !== id);
  if (activeContentPresetId === id) {
    activeContentPresetId = null;
    broadcastActive();
  }
  res.json({ ok: true });
});

// ── Activate ──────────────────────────────────────────────────────────────────

// Activate by content preset id
app.post('/api/content-presets/:id/activate', (req, res) => {
  const { id } = req.params;
  const cp = contentPresets.find(c => c.id === id);
  if (!cp) return res.status(404).json({ error: 'Not found' });

  activeContentPresetId = id;
  activePresetId = cp.appearancePresetId;
  activeFieldOverrides = req.body?.fieldOverrides || {};

  const bodyDuration = req.body && typeof req.body.autoHideDuration === 'number'
    ? req.body.autoHideDuration
    : null;
  broadcastActive(bodyDuration !== null ? bodyDuration : settings.autoHideDuration);
  res.json({ ok: true });
});

// Activate by appearance preset id (legacy + direct)
app.post('/api/presets/:id/activate', (req, res) => {
  const { id } = req.params;
  const preset = presets.find(p => p.id === id);
  if (!preset) return res.status(404).json({ error: 'Not found' });

  activePresetId = id;
  activeContentPresetId = null;
  activeFieldOverrides = req.body?.fieldOverrides || {};

  const bodyDuration = req.body && typeof req.body.autoHideDuration === 'number'
    ? req.body.autoHideDuration
    : null;
  broadcastActive(bodyDuration !== null ? bodyDuration : settings.autoHideDuration);
  res.json({ ok: true });
});

// Clear active
app.post('/api/clear', (req, res) => {
  activePresetId = null;
  activeContentPresetId = null;
  activeFieldOverrides = {};
  broadcastActive(0);
  res.json({ ok: true });
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function getActivePreset() {
  if (!activePresetId) return null;
  return presets.find(p => p.id === activePresetId) || null;
}

function getContentData() {
  let fields = {};
  // Start with appearance preset defaults
  const ap = getActivePreset();
  if (ap && ap.fieldDefs) {
    for (const fd of ap.fieldDefs) {
      fields[fd.key] = fd.defaultValue || '';
    }
  }
  // Override with active content preset fields
  if (activeContentPresetId) {
    const cp = contentPresets.find(c => c.id === activeContentPresetId);
    if (cp) Object.assign(fields, cp.fields);
  }
  // Override with per-activation overrides
  Object.assign(fields, activeFieldOverrides);
  return fields;
}

function broadcastActive(autoHideDuration) {
  const preset = getActivePreset();
  const contentData = getContentData();
  const hideDuration = typeof autoHideDuration === 'number' ? autoHideDuration : settings.autoHideDuration;
  const msg = JSON.stringify({
    type: 'activePreset',
    preset,
    contentData,
    autoHideDuration: hideDuration
  });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

wss.on('connection', ws => {
  // send current active on connect
  ws.send(JSON.stringify({
    type: 'activePreset',
    preset: getActivePreset(),
    contentData: getContentData(),
    autoHideDuration: settings.autoHideDuration
  }));
});

const PORT = process.env.PORT || 30001;
server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  console.log('Admin UI: /admin.html, Management: /manage.html, Widget: /widget.html');
});
