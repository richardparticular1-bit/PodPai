/**/**
 * LÚMINA CAST — Servidor WebSocket
 * Deploy: Render.com (free tier) — https://render.com
 * 
 * Serve o client.html via HTTP + WebSocket para:
 *   - Sincronizar jogadores (posição, chat, skills)
 *   - Sinalização WebRTC (offer/answer/ice) para áudio peer-to-peer
 */
const { WebSocketServer } = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3001;

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url === '/' || url === '/index.html') {
    const file = path.join(__dirname, 'client.html');
    if (!fs.existsSync(file)) { res.writeHead(404); res.end('client.html not found'); return; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    fs.createReadStream(file).pipe(res);
  } else if (url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', players: clients.size, uptime: process.uptime() }));
  } else {
    res.writeHead(404); res.end();
  }
});

const wss = new WebSocketServer({ server });
const clients = new Map(); // id -> { ws, name, avatar, color, wx, wy, moved }

function send(ws, data)         { if (ws.readyState === 1) ws.send(JSON.stringify(data)); }
function broadcast(data, skip)  { for (const [id, c] of clients) if (id !== skip) send(c.ws, data); }
function sendTo(id, data)       { const c = clients.get(id); if (c) send(c.ws, data); }

wss.on('connection', (ws) => {
  let myId = null;

  ws.on('message', (raw) => {
    let msg; try { msg = JSON.parse(raw.toString()); } catch { return; }

    if (msg.type === 'join') {
      myId = msg.id;
      clients.set(myId, { ws, name: msg.name, avatar: msg.avatar, color: msg.color, wx: msg.wx||0, wy: msg.wy||0, moved: false });
      // Envia lista de quem já está na sala
      const existing = [...clients.entries()]
        .filter(([id]) => id !== myId)
        .map(([id, c]) => ({ id, name: c.name, avatar: c.avatar, color: c.color, wx: c.wx, wy: c.wy, moved: c.moved }));
      send(ws, { type: 'room_state', players: existing });
      // Anuncia para os demais
      broadcast({ type: 'join', from: myId, name: msg.name, avatar: msg.avatar, color: msg.color, wx: msg.wx||0, wy: msg.wy||0 }, myId);
      console.log(`[+] ${msg.name} | ${clients.size} online`);
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
    // WebRTC signaling — roteamento direto, sem modificação
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

server.listen(PORT, () => console.log(`🎙️  LÚMINA CAST — porta ${PORT}`));
