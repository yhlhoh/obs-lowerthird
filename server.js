const express = require('express');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// In-memory preset storage：包含一个示例预置晚会节目样式
let presets = [
  {
    id: 'preset-gala-iframe-1',
    name: '晚会右侧信息区 · 自定义 HTML 示例',
    kind: 'iframe',
    align: 'right',
    themeColor: '',
    extraCss: '',
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
    <div class="tag">LIVE · GALA</div>
    <div class="title">2026 新春特别晚会</div>
    <div class="subtitle">示例：你可以在这里完全自定义 HTML / CSS / JS</div>
  </div>
</body>
</html>`
  }
];
let activePresetId = null;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// REST API for presets
app.get('/api/presets', (req, res) => {
  res.json({ presets, activePresetId });
});

app.post('/api/presets', (req, res) => {
  // 外观 preset：允许自定义 kind/html 等
  const {
    name = '未命名外观',
    kind = 'iframe',
    html = '',
    themeColor = '',
    align = 'right',
    extraCss = ''
  } = req.body || {};
  const preset = {
    id: Date.now().toString(),
    name,
    kind,
    html,
    themeColor,
    align,
    extraCss
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
    extraCss = presets[idx].extraCss
  } = req.body || {};
  presets[idx] = { ...presets[idx], name, kind, html, themeColor, align, extraCss };
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

// Activate preset
app.post('/api/presets/:id/activate', (req, res) => {
  const { id } = req.params;
  const preset = presets.find(p => p.id === id);
  if (!preset) return res.status(404).json({ error: 'Not found' });
  activePresetId = id;
  broadcastActive();
  res.json({ ok: true });
});

// Clear active
app.post('/api/clear', (req, res) => {
  activePresetId = null;
  broadcastActive();
  res.json({ ok: true });
});

function getActivePreset() {
  if (!activePresetId) return null;
  return presets.find(p => p.id === activePresetId) || null;
}

function broadcastActive() {
  const msg = JSON.stringify({ type: 'activePreset', preset: getActivePreset() });
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

wss.on('connection', ws => {
  // send current active on connect
  ws.send(JSON.stringify({ type: 'activePreset', preset: getActivePreset() }));
});

const PORT = process.env.PORT || 30001;
server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  console.log('Admin UI: /admin.html, Widget: /widget.html');
});
