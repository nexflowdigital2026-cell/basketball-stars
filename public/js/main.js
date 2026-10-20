// App shell: menus, match setup, main loop, LAN sessions and season flow.
import { TEAMS, TEAM, SIGS, ovr, teamStrength } from './teams.js';
import { Game, DT, EMPTY_INPUT } from './game.js';
import { makeBrain, aiInput } from './ai.js';
import { readDevice, DEVICE_LABELS, connectedPads } from './input.js';
import { Renderer, trimFor, COURTS } from './render.js';
import { unlockAudio, play, setVolume, getVolume } from './audio.js';
import { Net } from './net.js';
import * as Season from './season.js';

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const renderer = new Renderer($('#game'));
const net = new Net();
const SLOT_COLORS = ['#4fd1ff', '#5dff7a', '#ff5a5a', '#ffd23f'];
const LENGTHS = [['90', '1:30'], ['120', '2:00'], ['180', '3:00'], ['t11', 'First to 11'], ['t21', 'First to 21']];
const COURT_OPTS = Object.entries(COURTS).map(([k, v]) => [k, v.split(' ')[0]]);

let playerName = 'Player';
try { playerName = localStorage.getItem('bs_name') || 'Player ' + Math.floor(Math.random() * 90 + 10); } catch {}

// ------------------------------------------------------------------ screens

let current = 'main';
function show(id) {
  current = id;
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === 'scr-' + id));
  if (id === 'lan') enterLan();
  if (id === 'season') renderSeason();
  if (id === 'settings') renderSettings();
  if (id === 'help') renderHelp();
}
function overlay(id, on) { $('#scr-' + id).classList.toggle('active', on); }
function hideAllScreens() { document.querySelectorAll('.screen').forEach(s => s.classList.remove('active')); }

let toastT;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2800);
}

document.addEventListener('click', e => {
  unlockAudio();
  const b = e.target.closest('button');
  if (b) play('click');
  const go = e.target.closest('[data-go]');
  if (!go) return;
  const to = go.dataset.go;
  if (to === 'quick' || to === 'local') openSetup(to);
  else show(to);
});

// ------------------------------------------------------------------ shared widgets

const badge = (t, cls = 'badge') => `<div class="${cls}" style="background:${t.c1};border-color:${t.c2};color:${trimFor(t)}">${t.abbr}</div>`;

function playerCard(team, idx, { sel = false, tag = '', taken = false } = {}) {
  const p = team.players[idx];
  const bars = [['SPD', 'spd'], ['MID', 'shot'], ['3PT', 'three'], ['DNK', 'dunk'], ['DEF', 'def'], ['BLK', 'blk'], ['HND', 'hnd']]
    .map(([l, k]) => `<div class="bar">${l}<i><b style="width:${p.r[k]}%"></b></i></div>`).join('');
  return `<div class="card ${sel ? 'sel' : ''} ${taken ? 'taken' : ''}" data-idx="${idx}">
    ${tag ? `<span class="slot-tag">${esc(tag)}</span>` : ''}
    <div class="num" style="background:${team.c1};color:${trimFor(team)}">${p.num}</div>
    <div><div class="pname">${esc(p.name)}</div><div class="meta">${p.pos} · ${SIGS[p.sig].name}</div><div class="bars">${bars}</div></div>
    <div class="ovr">${ovr(p)}<small>OVR</small></div></div>`;
}

function teamHead(t, locked) {
  return `<div class="team-head ${locked ? 'locked' : ''}" style="background:linear-gradient(90deg, ${t.c1}, ${t.c1}aa)">
    ${badge(t)}<div style="color:${trimFor(t)}"><div class="tcity">${esc(t.city)}</div><div class="tname">${esc(t.name)}</div></div>
    ${locked ? '' : `<div class="change" style="color:${trimFor(t)}">Change ▾</div>`}</div>`;
}

function seg(name, options, value, disabled = false) {
  return `<div class="seg ${disabled ? 'disabled' : ''}" data-seg="${name}">${options.map(([v, l]) => `<button data-v="${v}" class="${String(v) === String(value) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
}
function bindSegs(root, onChange) {
  root.querySelectorAll('[data-seg]').forEach(s => s.addEventListener('click', e => {
    const b = e.target.closest('button[data-v]');
    if (b) onChange(s.dataset.seg, b.dataset.v);
  }));
}

let teamModalCb = null;
function openTeamModal(cb) {
  teamModalCb = cb;
  const conf = c => TEAMS.filter(t => t.conf === c).map(t => `<button class="tbtn" data-team="${t.abbr}" style="background:linear-gradient(90deg, ${t.c1}, ${t.c1}88)">
      ${badge(t)}<div style="color:${trimFor(t)}"><div class="tn">${esc(t.name)}</div><div class="ts">${esc(t.city)} · ${Math.round(teamStrength(t))}</div></div></button>`).join('');
  $('#team-grid').innerHTML = `<h3>EASTERN CONFERENCE</h3><div class="tgrid">${conf('E')}</div><h3>WESTERN CONFERENCE</h3><div class="tgrid">${conf('W')}</div>`;
  $('#team-modal').classList.add('active');
}
$('#team-grid').addEventListener('click', e => {
  const b = e.target.closest('[data-team]');
  if (!b) return;
  $('#team-modal').classList.remove('active');
  if (teamModalCb) teamModalCb(b.dataset.team);
});
$('#team-modal-close').onclick = () => $('#team-modal').classList.remove('active');

function bestPicks(abbr, n) {
  return TEAM[abbr].players.map((p, i) => [ovr(p), i]).sort((a, b) => b[0] - a[0]).slice(0, n).map(x => x[1]);
}
function lengthCfg(len) {
  return len.startsWith('t') ? { length: 0, target: Number(len.slice(1)) } : { length: Number(len), target: 0 };
}

// ------------------------------------------------------------------ quick / local setup

const setup = {
  kind: 'quick', mode: '1v1', teams: ['BOS', 'LAL'], picks: [[0, 1], [0, 1]], active: [0, 0],
  ctrls: [['kb', 'cpu'], ['cpu', 'cpu']], difficulty: 'medium', len: '120', powerups: true, court: 'arena',
};

function openSetup(kind) {
  setup.kind = kind;
  setup.ctrls = kind === 'quick' ? [['kb', 'cpu'], ['cpu', 'cpu']] : [['kb1', 'cpu'], ['kb2', 'cpu']];
  $('#setup-title').textContent = kind === 'quick' ? 'Quick Match' : 'Same Device';
  show('setup');
  renderSetup();
}

function deviceOptions(kind) {
  const devs = kind === 'quick' ? ['kb', 'pad0', 'cpu'] : ['kb1', 'kb2', 'pad0', 'pad1', 'pad2', 'pad3', 'cpu'];
  return devs;
}

function renderSetup() {
  const per = setup.mode === '2v2' ? 2 : 1;
  $('#setup-options').innerHTML = `
    <div class="opt">Mode ${seg('mode', [['1v1', '1 v 1'], ['2v2', '2 v 2']], setup.mode)}</div>
    <div class="opt">CPU ${seg('difficulty', [['easy', 'Easy'], ['medium', 'Pro'], ['hard', 'All-Star']], setup.difficulty)}</div>
    <div class="opt">Game ${seg('len', LENGTHS, setup.len)}</div>
    <div class="opt">Cards ${seg('powerups', [['1', 'On'], ['0', 'Off']], setup.powerups ? 1 : 0)}</div>
    <div class="opt">Court ${seg('court', COURT_OPTS, setup.court)}</div>`;
  for (let side = 0; side < 2; side++) {
    const t = TEAM[setup.teams[side]];
    const picks = setup.picks[side].slice(0, per);
    const cards = t.players.map((_, i) => {
      const k = picks.indexOf(i);
      return playerCard(t, i, { sel: k >= 0, tag: k >= 0 ? (per > 1 ? `SLOT ${k + 1}` : 'SELECTED') : '' });
    }).join('');
    const slots = picks.map((idx, k) => {
      const opts = deviceOptions(setup.kind).map(d => `<option value="${d}" ${setup.ctrls[side][k] === d ? 'selected' : ''}>${DEVICE_LABELS[d]}</option>`).join('');
      return `<div class="slot" data-slot="${k}" style="${per > 1 && setup.active[side] === k ? 'outline:2px solid var(--accent)' : ''}">
        <span>${per > 1 ? `<b>Slot ${k + 1}:</b> ` : ''}${esc(t.players[idx].name)}</span>
        <select data-ctrl="${k}">${opts}</select></div>`;
    }).join('');
    const el = $('#setup-side-' + side);
    el.innerHTML = `${teamHead(t)}<div class="slots">${slots}</div><div class="roster">${cards}</div>
      ${per > 1 ? '<div class="hint" style="margin-top:8px">Click a slot, then a player to put them there.</div>' : ''}`;
    el.querySelector('.team-head').onclick = () => openTeamModal(abbr => {
      setup.teams[side] = abbr; setup.picks[side] = bestPicks(abbr, 2); setup.active[side] = 0; renderSetup();
    });
    el.querySelectorAll('.card').forEach(c => c.onclick = () => {
      const idx = Number(c.dataset.idx), k = setup.active[side];
      const pk = setup.picks[side];
      const other = pk.indexOf(idx);
      if (other >= 0 && other !== k && other < per) pk[other] = pk[k];
      pk[k] = idx;
      if (per > 1) setup.active[side] = (k + 1) % per;
      renderSetup();
    });
    el.querySelectorAll('.slot').forEach(s => s.onclick = e => {
      if (e.target.tagName === 'SELECT' || e.target.tagName === 'OPTION') return;
      setup.active[side] = Number(s.dataset.slot); renderSetup();
    });
    el.querySelectorAll('select[data-ctrl]').forEach(s => s.onchange = () => { setup.ctrls[side][Number(s.dataset.ctrl)] = s.value; renderHint(); });
  }
  bindSegs($('#setup-options'), (k, v) => {
    if (k === 'powerups') setup.powerups = v === '1'; else setup[k] = v;
    if (k === 'mode') setup.active = [0, 0];
    renderSetup();
  });
  renderHint();
}

function renderHint() {
  const used = setup.ctrls.flatMap((c, side) => c.slice(0, setup.mode === '2v2' ? 2 : 1));
  const dup = used.filter(d => d !== 'cpu').find((d, i, a) => a.indexOf(d) !== i);
  $('#setup-hint').textContent = dup ? `⚠ ${DEVICE_LABELS[dup]} is assigned twice.` :
    used.some(d => d.startsWith('pad')) && !connectedPads().length ? '⚠ No gamepad detected yet. Press a button on it.' :
    setup.teams[0] === setup.teams[1] ? 'Mirror match! Same team on both sides.' : '';
}

$('#setup-start').onclick = () => {
  const per = setup.mode === '2v2' ? 2 : 1;
  const cfg = {
    mode: setup.mode, teams: [...setup.teams], roster: setup.picks.map(p => p.slice(0, per)),
    powerups: setup.powerups, court: setup.court, ...lengthCfg(setup.len),
  };
  const controls = [0, 1].flatMap(side => setup.ctrls[side].slice(0, per));
  startMatch({ cfg, controls, kind: 'local', difficulty: setup.difficulty, home: cfg.teams[0], again: () => openSetup(setup.kind) });
};

// ------------------------------------------------------------------ match session

let session = null;

function tagFor(dev, i) {
  if (dev === 'kb') return { label: 'YOU', color: SLOT_COLORS[0], spec: 'E' };
  if (dev === 'kb1') return { label: 'P1', color: SLOT_COLORS[0], spec: 'E' };
  if (dev === 'kb2') return { label: 'P2', color: SLOT_COLORS[2], spec: 'O' };
  if (dev && dev.startsWith('pad')) return { label: 'PAD ' + (Number(dev.slice(3)) + 1), color: SLOT_COLORS[(Number(dev.slice(3)) + 1) % 4], spec: 'RB' };
  return null;
}

function hintFor(controls) {
  const has = d => controls.includes(d);
  if (has('kb') || has('kb1')) return 'A/D move · W jump · F shoot · G hit/pass · S crossover · Shift nitro · E super' + (has('kb2') ? '   |   P2: arrows · K · L · ↓ · RShift · O' : '');
  if (has('kb2')) return 'P2: ←/→ move · ↑ jump · K shoot · L hit/pass · ↓ crossover · RShift nitro · O super';
  return '';
}

function startMatch(opts) {
  const { cfg, controls, kind, difficulty = 'medium', home } = opts;
  const game = new Game(cfg);
  const brains = controls.map(() => makeBrain(difficulty));
  session = { ...opts, game, brains, controls: [...controls], paused: false, overShown: false, netInputs: {}, steps: 0, pendingEv: [], lastSent: '', lastSentT: 0, targets: null };
  const tags = opts.tags || controls.map(tagFor);
  renderer.setMatch(game, { home, court: cfg.court, tags, hint: kind === 'attract' ? '' : opts.hint ?? hintFor(controls), mute: kind === 'attract', noHud: kind === 'attract' });
  if (kind !== 'attract') {
    hideAllScreens(); overlay('pause', false); overlay('end', false);
    document.body.classList.add('in-game');
  }
}

function stopSession() {
  session = null;
  document.body.classList.remove('in-game');
  overlay('pause', false); overlay('end', false);
}

function startAttract() {
  const pool = [...TEAMS].sort(() => Math.random() - 0.5);
  const a = pool[0].abbr, b = pool[1].abbr;
  startMatch({
    cfg: { mode: '2v2', teams: [a, b], roster: [bestPicks(a, 2), bestPicks(b, 2)], length: 0, target: 0, powerups: true, court: Object.keys(COURTS)[Math.floor(Math.random() * 3)] },
    controls: ['cpu', 'cpu', 'cpu', 'cpu'], kind: 'attract', difficulty: 'hard', home: a, tags: [null, null, null, null],
  });
  session.game.phaseT = 0.5;
}

function backToMenu() {
  if (session && (session.kind === 'host' || session.kind === 'client')) net.send({ t: 'leave' });
  stopSession();
  startAttract();
  show('main');
}

function readMerged(devs) {
  const out = { ...EMPTY_INPUT };
  for (const d of devs) { const r = readDevice(d); for (const k in out) out[k] = out[k] || r[k]; }
  return out;
}

function gatherInputs() {
  const g = session.game;
  return g.players.map((p, i) => {
    const c = session.controls[i];
    if (c === 'cpu') return aiInput(g, p, session.brains[i]);
    if (c && typeof c === 'object') {
      const ni = session.netInputs[c.net];
      if (!ni) return EMPTY_INPUT;
      const inp = {};
      for (const k in EMPTY_INPUT) inp[k] = !!(ni.cur[k] || ni.latch[k]);
      return inp;
    }
    if (c === 'kb' && session.kind !== 'local') return readMerged(['kb', 'pad0']);
    return readDevice(c);
  });
}

function stepSession() {
  const s = session, g = s.game;
  g.step(gatherInputs());
  for (const id in s.netInputs) s.netInputs[id].latch = {};
  const ev = g.drainEvents();
  renderer.handleEvents(ev);
  if (s.kind === 'host') {
    s.pendingEv.push(...ev);
    if (++s.steps % 2 === 0) {
      const snap = g.snapshot();
      snap.ev = s.pendingEv;
      s.pendingEv = [];
      net.send({ t: 'state', s: snap });
    }
  }
  if (s.kind === 'attract' && g.phase === 'over') startAttract();
}

function checkOver() {
  const s = session;
  if (!s || s.kind === 'attract' || s.overShown) return;
  if (s.game.phase === 'over' && s.game.phaseT > 2.2) { s.overShown = true; showEnd(); }
}

let last = performance.now(), acc = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (session) {
    if (session.kind !== 'client') {
      if (!session.paused) { acc += dt; let n = 0; while (acc >= DT && n++ < 6) { stepSession(); acc -= DT; if (!session) break; } if (acc > DT * 6) acc = 0; }
    } else {
      smoothClient(dt);
      sendClientInput();
      if (session.game.phase === 'over') session.game.phaseT += dt;
    }
    if (session) { renderer.render(dt); checkOver(); }
  }
  requestAnimationFrame(frame);
}

// ------------------------------------------------------------------ pause / end

window.addEventListener('keydown', e => {
  if (!session || session.kind === 'attract') return;
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (session.overShown) return;
    const on = !$('#scr-pause').classList.contains('active');
    if (session.kind === 'local') session.paused = on;
    $('#pause-restart').style.display = session.kind === 'local' ? '' : 'none';
    overlay('pause', on);
  }
});
$('#pause-resume').onclick = () => { session.paused = false; overlay('pause', false); };
$('#pause-restart').onclick = () => { const o = session; startMatch({ ...o, cfg: o.cfg, controls: o.controls }); };
$('#pause-help').onclick = () => { overlay('pause', false); session.paused = true; show('help'); helpReturn = true; };
$('#pause-quit').onclick = () => { if (session && session.season) { toast('Season game abandoned. It was not counted.'); } backToMenu(); };
let helpReturn = false;
document.querySelector('#scr-help .back').addEventListener('click', e => {
  if (helpReturn && session) { e.stopPropagation(); helpReturn = false; hideAllScreens(); overlay('pause', true); }
}, true);

function showEnd() {
  const s = session, g = s.game;
  const tA = TEAM[g.cfg.teams[0]], tB = TEAM[g.cfg.teams[1]];
  const w = g.winner === 0 ? tA : tB;
  $('#end-title').textContent = `${w.name} win${g.overtime ? ' in OT' : ''}!`;
  $('#end-score').innerHTML = [0, 1].map(side => {
    const t = side ? tB : tA;
    return `<div class="es">${badge(t)}<div class="num ${g.winner === side ? 'win' : ''}">${g.score[side]}</div></div>${side === 0 ? '<div class="vs">–</div>' : ''}`;
  }).join('');
  $('#end-stats').innerHTML = `<tr><th>PLAYER</th><th>PTS</th><th>FG</th><th>3PT</th><th>DNK</th><th>AST</th><th>STL</th><th>BLK</th><th>KO</th><th>ANKLES</th></tr>` +
    g.players.map(p => { const st = p.stats; return `<tr><td><span class="mini-badge" style="background:${TEAM[p.team].c1};border-color:${TEAM[p.team].c2};color:${trimFor(TEAM[p.team])}">${p.team}</span>${esc(p.name)}</td>
      <td><b>${st.pts}</b></td><td>${st.fgm}/${st.fga}</td><td>${st.tpm}/${st.tpa}</td><td>${st.dnk}</td><td>${st.ast}</td><td>${st.stl}</td><td>${st.blk}</td><td>${st.ko}</td><td>${st.ank}</td></tr>`; }).join('');
  const btns = $('#end-buttons');
  btns.innerHTML = '';
  const add = (label, fn, primary) => { const b = document.createElement('button'); b.textContent = label; if (primary) b.className = 'primary'; b.onclick = fn; btns.appendChild(b); };
  if (s.season) {
    add('Continue Season ▶', () => {
      const ss = Season.loadSeason();
      Season.completeGame(ss, g.score[0], g.score[1]);
      stopSession(); startAttract(); show('season');
    }, true);
  } else if (s.kind === 'local') {
    add('Rematch', () => startMatch({ ...s }), true);
    add('Change Teams', () => { stopSession(); startAttract(); s.again(); });
    add('Main Menu', backToMenu);
  } else if (s.kind === 'host') {
    add('Back to Lobby', () => { net.send({ t: 'end' }); stopSession(); startAttract(); show('lobby'); renderLobby(); }, true);
    add('Leave', () => { backToMenu(); });
  } else if (s.kind === 'client') {
    add('Waiting for host…', () => {}, false);
    btns.firstChild.disabled = true;
    add('Leave', backToMenu);
  }
  overlay('end', true);
}

// ------------------------------------------------------------------ help / settings

function renderHelp() {
  $('#help-sigs').innerHTML = Object.values(SIGS).map(s => `<tr><td>${s.name}</td><td>${s.desc}</td></tr>`).join('');
}
function renderSettings() {
  const v = $('#set-volume');
  v.value = getVolume();
  v.oninput = () => setVolume(Number(v.value));
  const n = $('#set-name');
  n.value = playerName;
  n.oninput = () => { playerName = n.value.trim() || 'Player'; try { localStorage.setItem('bs_name', playerName); } catch {} };
  const pads = connectedPads();
  $('#set-pads').textContent = pads.length ? `Detected: ${pads.map(i => 'Gamepad ' + (i + 1)).join(', ')}` : 'No gamepads detected.';
}
window.addEventListener('gamepadconnected', e => toast(`🎮 Gamepad ${e.gamepad.index + 1} connected`));

// ------------------------------------------------------------------ LAN

let lanMode = '1v1', listTimer = null;

async function enterLan() {
  const st = $('#lan-status');
  st.className = 'status'; st.textContent = 'Connecting to game server…';
  try {
    await net.connect(playerName);
    st.className = 'status ok';
    st.textContent = `✔ Connected as ${playerName}`;
    $('#lan-addr').innerHTML = net.lan.length
      ? `Friends on the same Wi-Fi open: ${net.lan.map(a => `<code>${a}</code>`).join(' or ')}`
      : 'No network address found. Make sure this computer is on Wi-Fi/LAN.';
    net.send({ t: 'list' });
    clearInterval(listTimer);
    listTimer = setInterval(() => { if (current === 'lan') net.send({ t: 'list' }); else clearInterval(listTimer); }, 2000);
  } catch (e) {
    st.className = 'status err';
    st.textContent = '✖ ' + e.message + ' Start it with "npm start" and open the address it prints.';
  }
}

$('#lan-mode').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  lanMode = b.dataset.v;
  $('#lan-mode').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
});
$('#lan-create').onclick = () => net.send({ t: 'create', name: $('#lan-room-name').value.trim() || `${playerName}'s game`, mode: lanMode });
$('#lan-join').onclick = () => net.send({ t: 'join', code: $('#lan-code').value.trim() });
$('#lan-refresh').onclick = () => net.send({ t: 'list' });
$('#lan-rooms').addEventListener('click', e => { const b = e.target.closest('[data-join]'); if (b) net.send({ t: 'join', code: b.dataset.join }); });

net.on('rooms', m => {
  $('#lan-rooms').innerHTML = m.rooms.length ? m.rooms.map(r => `<div class="room"><div><div class="rn">${esc(r.name)}</div>
    <div class="rm">${r.mode} · ${r.players}/${r.max} players · code ${r.code}${r.started ? ' · in progress' : ''}</div></div>
    <button data-join="${r.code}" ${r.started ? 'disabled' : ''}>Join</button></div>`).join('') : '<div class="hint">No open games yet. Create one!</div>';
});
net.on('error', m => toast(m.msg));
net.on('room', () => {
  if (session && session.kind === 'client' && !net.room.started && session.overShown) { stopSession(); startAttract(); }
  if (!session || session.kind === 'attract') { if (current !== 'lobby') show('lobby'); renderLobby(); }
});
net.on('closed', m => { toast(m.reason || 'Room closed.'); if (session && session.kind !== 'attract') { stopSession(); startAttract(); } show('lan'); });
net.on('disconnect', () => { if (session && (session.kind === 'host' || session.kind === 'client')) { toast('Lost connection to the server.'); stopSession(); startAttract(); show('main'); } });
$('#lobby-leave').onclick = () => { net.send({ t: 'leave' }); show('lan'); };

function lobbyPicks(room, side) {
  const team = TEAM[room.teams[side]];
  const ids = room.mode === '2v2' ? [side * 2, side * 2 + 1] : [side * 2];
  const picks = ids.map(i => Math.min(room.slots[i].pick, team.players.length - 1));
  if (picks.length === 2 && picks[0] === picks[1]) picks[1] = (picks[0] + 1) % team.players.length;
  return { ids, picks };
}

function renderLobby() {
  const r = net.room;
  if (!r) return;
  const host = net.isHost;
  $('#lobby-title').textContent = r.name;
  $('#lobby-code').textContent = r.code;
  const s = r.settings;
  const len = s.target ? 't' + s.target : String(s.length);
  $('#lobby-options').innerHTML = `
    <div class="opt">Mode ${seg('mode', [['1v1', '1 v 1'], ['2v2', '2 v 2']], r.mode, !host)}</div>
    <div class="opt">CPU ${seg('difficulty', [['easy', 'Easy'], ['medium', 'Pro'], ['hard', 'All-Star']], s.difficulty, !host)}</div>
    <div class="opt">Game ${seg('len', LENGTHS, len, !host)}</div>
    <div class="opt">Cards ${seg('powerups', [['1', 'On'], ['0', 'Off']], s.powerups ? 1 : 0, !host)}</div>
    <div class="opt">Court ${seg('court', COURT_OPTS, s.court || 'arena', !host)}</div>`;
  bindSegs($('#lobby-options'), (k, v) => {
    if (k === 'mode') net.send({ t: 'settings', mode: v });
    else if (k === 'len') net.send({ t: 'settings', settings: lengthCfg(v) });
    else if (k === 'powerups') net.send({ t: 'settings', settings: { powerups: v === '1' } });
    else net.send({ t: 'settings', settings: { [k]: v } });
  });

  for (let side = 0; side < 2; side++) {
    const team = TEAM[r.teams[side]];
    const { ids, picks } = lobbyPicks(r, side);
    const mine = ids.find(i => r.slots[i].owner === net.id);
    const canTeam = host || mine !== undefined;
    const slots = ids.map((i, k) => {
      const sl = r.slots[i];
      const who = sl.owner ? esc(sl.ownerName) + (sl.owner === net.id ? ' (you)' : '') : 'CPU';
      const btn = sl.owner ? (sl.owner === net.id ? '' : '') : `<button class="mini" data-claim="${i}">Take slot</button>`;
      return `<div class="slot"><span><span class="dot" style="background:${SLOT_COLORS[i]}"></span><b>${who}</b> · ${esc(team.players[picks[k]].name)}</span>${btn}</div>`;
    }).join('');
    const mySlotK = mine !== undefined ? ids.indexOf(mine) : -1;
    const cards = team.players.map((_, idx) => {
      const k = picks.indexOf(idx);
      const owner = k >= 0 ? r.slots[ids[k]] : null;
      return playerCard(team, idx, { sel: k >= 0 && k === mySlotK, tag: owner ? (owner.owner ? owner.ownerName : 'CPU') : '' });
    }).join('');
    const el = $('#lobby-side-' + side);
    el.innerHTML = `${teamHead(team, !canTeam)}<div class="slots">${slots}</div><div class="roster">${cards}</div>
      ${mine !== undefined ? '<div class="hint" style="margin-top:8px">Click a player card to pick your star.</div>' : ''}`;
    if (canTeam) el.querySelector('.team-head').onclick = () => openTeamModal(abbr => net.send({ t: 'team', side, team: abbr }));
    el.querySelectorAll('[data-claim]').forEach(b => b.onclick = () => net.send({ t: 'claim', slot: Number(b.dataset.claim) }));
    if (mine !== undefined) el.querySelectorAll('.card').forEach(c => c.onclick = () => {
      const idx = Number(c.dataset.idx);
      const other = ids.find(i => i !== mine && Math.min(r.slots[i].pick, team.players.length - 1) === idx);
      if (other !== undefined && r.slots[other].owner) return toast('A teammate already picked that player.');
      if (other !== undefined) net.send({ t: 'pick', slot: other, pick: r.slots[mine].pick });
      net.send({ t: 'pick', slot: mine, pick: idx });
    });
  }
  const humans = r.slots.filter(s => s.owner).length;
  $('#lobby-start').style.display = host ? '' : 'none';
  $('#lobby-hint').textContent = host ? (humans < 2 ? 'Waiting for friends to join (empty slots are played by the CPU).' : `${humans} players ready.`) : 'Waiting for the host to start…';
}
$('#lobby-start').onclick = () => net.send({ t: 'start' });

net.on('start', m => {
  const r = m.room;
  const picks = [0, 1].map(side => lobbyPicks(r, side));
  const cfg = { mode: r.mode, teams: [...r.teams], roster: picks.map(p => p.picks), powerups: r.settings.powerups, length: r.settings.length, target: r.settings.target, court: r.settings.court || 'arena' };
  const slotIds = [...picks[0].ids, ...picks[1].ids];
  const controls = slotIds.map(i => {
    const o = r.slots[i].owner;
    if (!o) return 'cpu';
    return o === net.id ? 'kb' : { net: o };
  });
  const tags = slotIds.map(i => r.slots[i].owner ? { label: r.slots[i].owner === net.id ? 'YOU' : r.slots[i].ownerName, color: SLOT_COLORS[i], spec: r.slots[i].owner === net.id ? 'E' : '' } : null);
  const kind = r.hostId === net.id ? 'host' : 'client';
  startMatch({ cfg, controls, kind, difficulty: r.settings.difficulty, home: cfg.teams[0], tags, hint: slotIds.some(i => r.slots[i].owner === net.id) ? hintFor(['kb']) : 'Spectating' });
});

net.on('input', m => {
  if (!session || session.kind !== 'host') return;
  const ni = session.netInputs[m.from] ||= { cur: {}, latch: {} };
  ni.cur = m.input;
  for (const k in m.input) if (m.input[k]) ni.latch[k] = true;
});
net.on('peerLeft', m => {
  if (!session || session.kind !== 'host') return;
  session.controls = session.controls.map(c => (c && c.net === m.id ? 'cpu' : c));
  toast('A player left. The CPU takes over.');
});

net.on('state', m => {
  const s = session;
  if (!s || s.kind !== 'client') return;
  const g = s.game;
  const prev = g.players.map(p => [p.x, p.y]), pb = [g.ball.x, g.ball.y];
  g.applySnapshot(m.s);
  s.targets = { p: g.players.map(p => [p.x, p.y]), b: [g.ball.x, g.ball.y] };
  if (s.hadSnap) {
    g.players.forEach((p, i) => { if (Math.hypot(p.x - prev[i][0], p.y - prev[i][1]) < 220) { p.x = prev[i][0]; p.y = prev[i][1]; } });
    if (Math.hypot(g.ball.x - pb[0], g.ball.y - pb[1]) < 220) { g.ball.x = pb[0]; g.ball.y = pb[1]; }
  }
  s.hadSnap = true;
  renderer.handleEvents(m.s.ev || []);
});

function smoothClient(dt) {
  const s = session, t = s.targets;
  if (!t) return;
  const k = 1 - Math.exp(-dt * 30);
  s.game.players.forEach((p, i) => { p.x += (t.p[i][0] - p.x) * k; p.y += (t.p[i][1] - p.y) * k; });
  const b = s.game.ball;
  b.x += (t.b[0] - b.x) * k; b.y += (t.b[1] - b.y) * k;
}

function sendClientInput() {
  const s = session;
  if (!s.controls.includes('kb')) return;
  const inp = readMerged(['kb', 'pad0']);
  const key = Object.values(inp).map(Number).join('');
  const now = performance.now();
  if (key !== s.lastSent || now - s.lastSentT > 250) {
    net.send({ t: 'input', input: inp });
    s.lastSent = key; s.lastSentT = now;
  }
}

// ------------------------------------------------------------------ season

const seasonForm = { team: 'BOS', picks: [0, 1], active: 0, mode: '1v1', difficulty: 'medium', len: 't21', powerups: true, games: 8 };

function renderSeason() {
  const s = Season.loadSeason();
  const body = $('#season-body');
  if (!s) return renderSeasonForm(body);
  const me = TEAM[s.team];
  const rec = s.standings[s.team];
  $('#season-title').textContent = `2026-27 Season · ${me.abbr} ${rec.w}-${rec.l}`;
  const opp = Season.nextOpponent(s);
  const st = Season.sortedStandings(s);
  const myRank = st.findIndex(x => x.abbr === s.team);
  const rows = st.map((x, i) => ({ ...x, rank: i + 1 })).filter((x, i) => i < 10 || x.abbr === s.team);
  const table = `<table class="standings"><tr><th>#</th><th>TEAM</th><th>W</th><th>L</th><th>DIFF</th></tr>${rows.map(x => `
    <tr class="${x.abbr === s.team ? 'me' : ''} ${x.rank === 8 ? 'cut' : ''}"><td>${x.rank}</td><td>${badge(TEAM[x.abbr], 'mini-badge')}${esc(TEAM[x.abbr].name)}</td><td>${x.w}</td><td>${x.l}</td><td>${x.diff > 0 ? '+' : ''}${x.diff}</td></tr>`).join('')}</table>
    <div class="hint">Top 8 make the playoffs (dashed line).</div>`;
  let main;
  if (s.phase === 'done') {
    const won = s.champion === s.team;
    main = `<div class="next-game"><div class="champ">${won ? '🏆 NBA CHAMPIONS! 🏆' : `${esc(TEAM[s.champion].city)} ${esc(TEAM[s.champion].name)} win the title`}</div>
      <p class="hint" style="text-align:center">${won ? `The ${esc(me.name)} are 2026-27 champions!` : s.missed ? `The ${esc(me.name)} missed the playoffs (finished #${myRank + 1}).` : `The ${esc(me.name)} were knocked out.`}</p>
      <div class="row center"><button class="primary" id="season-new">New Season</button></div></div>`;
  } else {
    const o = TEAM[opp];
    main = `<div class="next-game"><div class="hint">${Season.roundLabel(s)}${s.phase === 'playoffs' ? ' · win or go home' : ''}</div>
      <div class="matchup"><div>${badge(me)}<div class="tlabel">${me.abbr}</div></div><div class="vs">VS</div><div>${badge(o)}<div class="tlabel">${o.abbr}</div></div></div>
      <div class="hint" style="text-align:center">${esc(o.city)} ${esc(o.name)}: ${o.players.map(p => esc(p.name)).join(', ')}</div>
      <div class="row center" style="margin-top:14px"><button class="primary" id="season-play">PLAY ▶</button><button id="season-sim">Sim game</button></div></div>`;
  }
  const bracket = s.bracket ? `<h3>Playoffs</h3><div class="bracket">${s.bracket.map((round, ri) => `<div><h4>${Season.PLAYOFF_ROUNDS[ri]}</h4>${round.map(m => `
      <div class="bm"><div class="${m.w === m.a ? 'w' : ''} ${m.a === s.team ? 'me' : ''}"><span>${m.a}</span><span>${m.sa ?? ''}</span></div>
      <div class="${m.w === m.b ? 'w' : ''} ${m.b === s.team ? 'me' : ''}"><span>${m.b}</span><span>${m.sb ?? ''}</span></div></div>`).join('')}</div>`).join('')}</div>` : '';
  const log = s.log.length ? `<div class="results">${s.log.map(l => `<span class="res ${l.r}">${l.r} ${l.my}-${l.their} ${l.opp}</span>`).join('')}</div>` : '';
  body.innerHTML = `<div class="season-grid"><div>${main}${log}${bracket}</div><div>${table}</div></div>
    <div class="row" style="margin-top:16px;justify-content:space-between"><span class="hint">You: ${s.picks.map(i => esc(me.players[i].name)).join(' & ')} · ${s.mode} · ${s.difficulty}</span>
    <button id="season-quit">Abandon season</button></div>`;
  const pb = $('#season-play');
  if (pb) pb.onclick = () => playSeasonGame(s);
  const sb = $('#season-sim');
  if (sb) sb.onclick = () => { Season.completeGame(s, null, null); renderSeason(); };
  const nb = $('#season-new');
  if (nb) nb.onclick = () => { Season.clearSeason(); renderSeason(); };
  $('#season-quit').onclick = () => { if (confirm('Abandon this season?')) { Season.clearSeason(); renderSeason(); } };
}

function renderSeasonForm(body) {
  $('#season-title').textContent = 'New Season';
  const f = seasonForm, t = TEAM[f.team], per = f.mode === '2v2' ? 2 : 1;
  const cards = t.players.map((_, i) => { const k = f.picks.slice(0, per).indexOf(i); return playerCard(t, i, { sel: k >= 0, tag: k >= 0 ? (per > 1 ? (k === 0 ? 'YOU' : 'CPU MATE') : 'YOU') : '' }); }).join('');
  body.innerHTML = `<div class="options">
      <div class="opt">Mode ${seg('mode', [['1v1', '1 v 1'], ['2v2', '2 v 2']], f.mode)}</div>
      <div class="opt">CPU ${seg('difficulty', [['easy', 'Easy'], ['medium', 'Pro'], ['hard', 'All-Star']], f.difficulty)}</div>
      <div class="opt">Game ${seg('len', LENGTHS, f.len)}</div>
      <div class="opt">Cards ${seg('powerups', [['1', 'On'], ['0', 'Off']], f.powerups ? 1 : 0)}</div>
      <div class="opt">Season ${seg('games', [['6', '6 games'], ['8', '8 games'], ['12', '12 games']], f.games)}</div></div>
    <div class="season-grid" style="margin-top:16px"><div class="side">${teamHead(t)}<div class="roster">${cards}</div></div>
    <div><h3>How it works</h3><p class="hint">Play a short regular season against random teams from around the league while every other game is simulated. Finish in the top 8 to reach the playoffs: Quarterfinals, Semifinals, then the NBA Finals. One loss in the playoffs ends your run.</p>
    <p class="hint">Opponents field their best stars. Your progress is saved automatically.</p>
    <button class="primary" id="season-start">START SEASON ▶</button></div></div>`;
  bindSegs(body, (k, v) => { if (k === 'powerups') f.powerups = v === '1'; else if (k === 'games') f.games = Number(v); else f[k] = v; renderSeasonForm(body); });
  body.querySelector('.team-head').onclick = () => openTeamModal(abbr => { f.team = abbr; f.picks = bestPicks(abbr, 2); f.active = 0; renderSeasonForm(body); });
  body.querySelectorAll('.card').forEach(c => c.onclick = () => {
    const idx = Number(c.dataset.idx), k = f.active;
    const o = f.picks.indexOf(idx);
    if (o >= 0 && o !== k) f.picks[o] = f.picks[k];
    f.picks[k] = idx;
    if (per > 1) f.active = (k + 1) % 2;
    renderSeasonForm(body);
  });
  $('#season-start').onclick = () => {
    Season.newSeason({ team: f.team, picks: f.picks.slice(0, per), mode: f.mode, difficulty: f.difficulty, len: f.len, ...lengthCfg(f.len), powerups: f.powerups, games: f.games });
    renderSeason();
  };
}

function playSeasonGame(s) {
  const opp = Season.nextOpponent(s);
  const per = s.mode === '2v2' ? 2 : 1;
  const cfg = { mode: s.mode, teams: [s.team, opp], roster: [s.picks.slice(0, per), bestPicks(opp, per)], length: s.length, target: s.target, powerups: s.powerups, court: s.log.length % 3 === 2 ? 'street' : 'arena' };
  const controls = per === 2 ? ['kb', 'cpu', 'cpu', 'cpu'] : ['kb', 'cpu'];
  const home = s.log.length % 2 === 0 ? s.team : opp;
  startMatch({ cfg, controls, kind: 'local', difficulty: s.difficulty, home, season: true });
}

// ------------------------------------------------------------------ boot

// ?debug exposes the live session for testing from the console.
if (new URLSearchParams(location.search).has('debug')) window.__bs = { get session() { return session; } };

startAttract();
show('main');
requestAnimationFrame(frame);
