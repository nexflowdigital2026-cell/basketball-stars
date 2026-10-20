// Thin WebSocket client for the LAN relay server.
export class Net {
  constructor() { this.ws = null; this.id = null; this.handlers = {}; this.lan = []; this.room = null; }

  on(type, fn) { (this.handlers[type] ||= []).push(fn); }
  off(type) { delete this.handlers[type]; }
  emit(type, msg) { for (const fn of this.handlers[type] || []) fn(msg); }

  connect(name) {
    return new Promise((resolve, reject) => {
      if (this.ws && this.ws.readyState === 1) { this.send({ t: 'hello', name }); return resolve(); }
      if (location.protocol === 'file:') return reject(new Error('Open the game through the server (npm start) to play on the network.'));
      const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
      this.ws = ws;
      const timer = setTimeout(() => reject(new Error('Could not reach the game server.')), 5000);
      ws.onmessage = ev => {
        const m = JSON.parse(ev.data);
        if (m.t === 'welcome') { this.id = m.id; this.lan = m.lan; clearTimeout(timer); this.send({ t: 'hello', name }); resolve(); }
        if (m.t === 'room') this.room = m.room;
        if (m.t === 'closed' || m.t === 'left') this.room = null;
        this.emit(m.t, m);
      };
      ws.onerror = () => { clearTimeout(timer); reject(new Error('Could not reach the game server.')); };
      ws.onclose = () => { this.room = null; this.emit('disconnect', {}); this.ws = null; };
    });
  }

  send(msg) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(msg)); }
  get connected() { return this.ws && this.ws.readyState === 1; }
  get isHost() { return this.room && this.room.hostId === this.id; }
}
