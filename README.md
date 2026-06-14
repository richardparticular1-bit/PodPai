# 🎙️ LÚMINA CAST — Servidor

Podcast multiplayer com áudio WebRTC peer-to-peer.

## Deploy no Render.com (grátis)

1. Suba esta pasta no GitHub
2. Acesse https://render.com → New → Web Service
3. Conecte o repositório
4. Build command: `npm install`
5. Start command: `npm start`
6. Clique em Deploy

A URL pública será algo como `https://lumina-cast.onrender.com`

## Como usar

- Acesse a URL do seu servidor
- Cole `wss://lumina-cast.onrender.com` no campo do servidor
- Compartilhe a mesma URL com seus amigos
- Clique em 🔇 para ativar o microfone

## Arquitetura

- `server.js` — WebSocket: sincroniza jogadores + sinalização WebRTC
- `client.html` — Jogo + áudio WebRTC peer-to-peer entre dispositivos
- Áudio viaja diretamente entre os navegadores (P2P), não pelo servidor
- STUN: Google + Cloudflare (grátis)
- TURN: OpenRelay (grátis, cobre NAT simétrico)
