/**
 * PODPAI CAST — Servidor WebSocket + HTTP
 * Serve client.html, manifest.json, sw.js, icons
 * Deploy: Render.com
 */
const { WebSocketServer } = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3001;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json',
  '.js':   'application/javascript',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
};

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];

  if (url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', players: clients.size, uptime: process.uptime() }));
    return;
  }

  // Serve static files
  const fileMap = {
    '/':            'client.html',
    '/index.html':  'client.html',
    '/manifest.json':'manifest.json',
    '/sw.js':       'sw.js',
    '/icon-192.png':'icon-192.png',
    '/icon-512.png':'icon-512.png',
  };

  const fileName = fileMap[url];
  if (!fileName) { res.writeHead(404); res.end('Not found'); return; }

  const filePath = path.join(__dirname, fileName);
  if (!fs.existsSync(filePath)) { res.writeHead(404); res.end(`${fileName} not found`); return; }

  const ext = path.extname(fileName);
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': fileName === 'client.html' ? 'no-cache' : 'public, max-age=86400',
  });
  fs.createReadStream(filePath).pipe(res);
});

// ── WEBSOCKET ────────────────────────────────────────────────
const wss = new WebSocketServer({ server });
const clients = new Map();

function send(ws, data)        { if (ws.readyState === 1) ws.send(JSON.stringify(data)); }
function broadcast(data, skip) { for (const [id, c] of clients) if (id !== skip) send(c.ws, data); }
function sendTo(id, data)      { const c = clients.get(id); if (c) send(c.ws, data); }

wss.on('connection', (ws) => {
  let myId = null;

  ws.on('message', (raw) => {
    let msg; try { msg = JSON.parse(raw.toString()); } catch { return; }

    if (msg.type === 'join') {
      myId = msg.id;
      clients.set(myId, { ws, name: msg.name, avatar: msg.avatar, color: msg.color, wx: msg.wx||0, wy: msg.wy||0, moved: false, listener: msg.listener });
      const existing = [...clients.entries()]
        .filter(([id]) => id !== myId)
        .map(([id, c]) => ({ id, name: c.name, avatar: c.avatar, color: c.color, wx: c.wx, wy: c.wy, moved: c.moved, listener: c.listener }));
      send(ws, { type: 'room_state', players: existing });
      broadcast({ type: 'join', from: myId, name: msg.name, avatar: msg.avatar, color: msg.color, wx: msg.wx||0, wy: msg.wy||0, listener: msg.listener }, myId);
      console.log(`[+] ${msg.name}${msg.listener?' (ouvinte)':''} | ${clients.size} online`);
    }
    else if (msg.type === 'move' && myId) {
      const c = clients.get(myId);
      if (c) Object.assign(c, { wx: msg.wx, wy: msg.wy, moved: true });
      broadcast({ type: 'move', from: myId, wx: msg.wx, wy: msg.wy, moved: true }, myId);
    }
    else if (msg.type === 'chat' && myId) {
      broadcast({ type: 'chat', from: myId, text: msg.text }, myId);
    }
    else if (msg.type === 'skill' && myId) {
      broadcast({ type: 'skill', from: myId, cardId: msg.cardId, wx: msg.wx, wy: msg.wy }, myId);
    }
    else if (['offer','answer','ice-candidate'].includes(msg.type) && myId) {
      sendTo(msg.to, { ...msg, from: myId });
    }
  });

  ws.on('close', () => {
    if (!myId) return;
    const c = clients.get(myId);
    if (c) { broadcast({ type: 'leave', from: myId }); clients.delete(myId); console.log(`[-] ${c.name} | ${clients.size} online`); }
  });

  ws.on('error', () => {});
});

server.listen(PORT, () => console.log(`🎙️  PODPAI CAST — porta ${PORT}`));
