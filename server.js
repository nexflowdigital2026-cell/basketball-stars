// Static file server + WebSocket relay for LAN multiplayer.
// The room host's browser runs the simulation; this server only manages
// lobbies and relays inputs (client -> host) and snapshots (host -> clients).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const PORT = Number(process.env.PORT) || 3000;
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

function lanAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal) out.push(a.address);
  }
  return out;
}

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server, path: '/ws' });
const clients = new Map(); // id -> { ws, name, room }
const rooms = new Map();   // code -> room
let nextId = 1;

const DEFAULT_TEAMS = ['BOS', 'LAL'];

function makeCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let c;
  do { c = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join(''); } while (rooms.has(c));
  return c;
}

function send(ws, msg) { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); }

function roomView(r) {
  return {
    code: r.code, name: r.name, mode: r.mode, hostId: r.hostId, started: r.started,
    teams: r.teams, settings: r.settings,
    members: [...r.members].map(id => ({ id, name: clients.get(id)?.name || '?' })),
    slots: r.slots.map(s => ({ owner: s.owner, ownerName: s.owner ? clients.get(s.owner)?.name : null, pick: s.pick })),
  };
}

function broadcastRoom(r) {
  const view = roomView(r);
  for (const id of r.members) send(clients.get(id).ws, { t: 'room', room: view });
}

function activeSlots(r) { return r.mode === '1v1' ? [0, 2] : [0, 1, 2, 3]; }

function claimFirstFree(r, id) {
  for (const i of activeSlots(r)) if (!r.slots[i].owner) { r.slots[i].owner = id; return; }
}

function leaveRoom(id) {
  const c = clients.get(id);
  if (!c || !c.room) return;
  const r = rooms.get(c.room);
  c.room = null;
  if (!r) return;
  r.members.delete(id);
  for (const s of r.slots) if (s.owner === id) s.owner = null;
  if (r.hostId === id || r.members.size === 0) {
    for (const mid of r.members) {
      const m = clients.get(mid);
      if (m) { m.room = null; send(m.ws, { t: 'closed', reason: 'The host left the room.' }); }
    }
    rooms.delete(r.code);
    return;
  }
  if (r.started) send(clients.get(r.hostId).ws, { t: 'peerLeft', id });
  broadcastRoom(r);
}

wss.on('connection', ws => {
  const id = String(nextId++);
  clients.set(id, { ws, name: 'Player ' + id, room: null });
  send(ws, { t: 'welcome', id, lan: lanAddresses().map(a => `http://${a}:${PORT}`) });

  ws.on('message', raw => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    const c = clients.get(id);
    const r = c.room ? rooms.get(c.room) : null;
    const isHost = r && r.hostId === id;

    switch (m.t) {
      case 'hello':
        c.name = String(m.name || '').slice(0, 16) || c.name;
        if (r) broadcastRoom(r);
        break;
      case 'list':
        send(ws, {
          t: 'rooms', rooms: [...rooms.values()].map(x => ({
            code: x.code, name: x.name, mode: x.mode, started: x.started,
            players: x.slots.filter((s, i) => s.owner && activeSlots(x).includes(i)).length,
            max: activeSlots(x).length,
          })),
        });
        break;
      case 'create': {
        leaveRoom(id);
        const code = makeCode();
        const room = {
          code, name: String(m.name || `${c.name}'s game`).slice(0, 24), mode: m.mode === '2v2' ? '2v2' : '1v1',
          hostId: id, members: new Set([id]), started: false, teams: [...DEFAULT_TEAMS],
          settings: { length: 120, target: 0, powerups: true, difficulty: 'medium', court: 'arena' },
          slots: [0, 1, 2, 3].map(i => ({ owner: null, pick: i % 2 })),
        };
        rooms.set(code, room);
        c.room = code;
        claimFirstFree(room, id);
        broadcastRoom(room);
        break;
      }
      case 'join': {
        const target = rooms.get(String(m.code || '').toUpperCase());
        if (!target) return send(ws, { t: 'error', msg: 'Room not found.' });
        if (target.started) return send(ws, { t: 'error', msg: 'That game already started.' });
        leaveRoom(id);
        target.members.add(id);
        c.room = target.code;
        claimFirstFree(target, id);
        broadcastRoom(target);
        break;
      }
      case 'leave': leaveRoom(id); send(ws, { t: 'left' }); break;
      case 'claim': {
        if (!r || r.started) break;
        const i = Number(m.slot);
        if (!activeSlots(r).includes(i)) break;
        if (r.slots[i].owner && r.slots[i].owner !== id) break;
        for (const s of r.slots) if (s.owner === id) s.owner = null;
        r.slots[i].owner = id;
        broadcastRoom(r);
        break;
      }
      case 'unclaim':
        if (!r || r.started) break;
        for (const s of r.slots) if (s.owner === id) s.owner = null;
        broadcastRoom(r);
        break;
      case 'pick': {
        if (!r || r.started) break;
        const s = r.slots[Number(m.slot)];
        if (!s || (s.owner !== id && !isHost)) break;
        s.pick = Math.max(0, Math.min(5, Number(m.pick) | 0));
        broadcastRoom(r);
        break;
      }
      case 'team': {
        if (!r || r.started) break;
        const side = Number(m.side) ? 1 : 0;
        const ownsSide = r.slots.some((s, i) => s.owner === id && (i < 2 ? 0 : 1) === side);
        if (!ownsSide && !isHost) break;
        r.teams[side] = String(m.team).slice(0, 4);
        // Reset picks so both players on a side don't keep stale roster indexes.
        r.slots[side * 2].pick = 0; r.slots[side * 2 + 1].pick = 1;
        broadcastRoom(r);
        break;
      }
      case 'settings':
        if (!isHost || r.started) break;
        if (m.mode === '1v1' || m.mode === '2v2') {
          r.mode = m.mode;
          if (r.mode === '1v1') {
            for (const i of [1, 3]) {
              const o = r.slots[i].owner;
              r.slots[i].owner = null;
              if (o) claimFirstFree(r, o);
            }
          }
        }
        if (m.settings) Object.assign(r.settings, m.settings);
        broadcastRoom(r);
        break;
      case 'start':
        if (!isHost || r.started) break;
        r.started = true;
        broadcastRoom(r);
        for (const mid of r.members) send(clients.get(mid).ws, { t: 'start', room: roomView(r) });
        break;
      case 'end':
        if (!isHost) break;
        r.started = false;
        broadcastRoom(r);
        break;
      case 'input':
        if (r && r.started && !isHost) send(clients.get(r.hostId).ws, { t: 'input', from: id, input: m.input });
        break;
      case 'state':
        if (isHost) {
          const payload = JSON.stringify({ t: 'state', s: m.s });
          for (const mid of r.members) if (mid !== id) { const w = clients.get(mid).ws; if (w.readyState === 1) w.send(payload); }
        }
        break;
    }
  });

  ws.on('close', () => { leaveRoom(id); clients.delete(id); });
});

server.listen(PORT, () => {
  console.log(`\n  🏀 Basketball Stars 26-27 running\n`);
  console.log(`  This computer:   http://localhost:${PORT}`);
  for (const a of lanAddresses()) console.log(`  Same network:    http://${a}:${PORT}`);
  console.log(`\n  Other players on your Wi-Fi/LAN open the "Same network" address.\n`);
});
