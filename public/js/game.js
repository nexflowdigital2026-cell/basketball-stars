// Core match simulation. Deterministic fixed-step (60 Hz) with no rendering.
// On LAN games only the host runs step(); clients receive snapshots.
import { TEAM } from './teams.js';

export const W = 1600, H = 900, FLOOR = 800;
export const BALL_R = 17;
// Team 0 attacks HOOPS[0] (right side), team 1 attacks HOOPS[1] (left side).
export const HOOPS = [
  { x: 1432, y: 450, dir: 1, front: 1394, back: 1470, board: 1494 },
  { x: 168, y: 450, dir: -1, front: 206, back: 130, board: 106 },
];
export const BOARD_TOP = 318, BOARD_BOT = 478;
export const THREE_DIST = 540;
export const METER_TIME = 0.72, SWEET = 0.8;
export const DT = 1 / 60;
export const IRON_TIME = 8;
const G_P = 2600, G_B = 1900, RIM_R = 4;

const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
export const EMPTY_INPUT = Object.freeze({ l: false, r: false, u: false, shoot: false, act: false, skill: false, spec: false, nitro: false });

// Body reach (feet -> fingertips) used for blocks, catches and dunk geometry.
export const reachOf = p => (p.ground && p.state !== 'shoot' ? 205 : 248) * p.h * (p.fx.big > 0 ? 1.18 : 1);
export const greenWindow = p => (p.sig === 'sniper' ? 0.085 : 0.065);
export const LYING = s => s === 'knocked' || s === 'getup';

function makePlayer(i, side, abbr, idx, lane) {
  const d = TEAM[abbr].players[idx];
  const r = {};
  for (const k in d.r) r[k] = d.r[k] / 100;
  return {
    i, side, team: abbr, idx, lane, name: d.name, num: d.num, sig: d.sig, r, h: d.height,
    skin: d.skin, hair: d.hair, beard: d.beard,
    x: 0, y: FLOOR, vx: 0, vy: 0, ground: true, face: side === 0 ? 1 : -1,
    state: 'move', st: 0, anim: 0, meter: 0, dk: null, crossDir: 1,
    power: 0, iron: 0, stamina: 1, nitro: false, immune: 0, superShot: false, hitDone: false, missed: false,
    cd: { grab: 0, punch: 0, skill: 0, shoot: 0 }, fx: { speed: 0, big: 0, frozen: 0 },
    call: 0, holdT: 0, assistFrom: -1, assistT: 0, mood: 0,
    prev: { ...EMPTY_INPUT },
    stats: { pts: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, dnk: 0, blk: 0, stl: 0, ko: 0, ank: 0, ast: 0 },
  };
}

export class Game {
  // cfg: { mode, teams:[abbrA, abbrB], roster:[[idx..],[idx..]], length (s, 0 = untimed), target (pts, 0 = none), powerups, court }
  constructor(cfg) {
    this.cfg = cfg;
    this.mode = cfg.mode;
    this.players = [];
    const per = cfg.mode === '2v2' ? 2 : 1;
    for (let side = 0; side < 2; side++) {
      for (let k = 0; k < per; k++) {
        const lane = per === 1 ? 0 : (k === 0 ? -1 : 1);
        this.players.push(makePlayer(this.players.length, side, cfg.teams[side], cfg.roster[side][k], lane));
      }
    }
    this.score = [0, 0];
    this.clock = cfg.length || 0;
    this.timed = cfg.length > 0;
    this.target = cfg.target || 0;
    this.overtime = false;
    this.phase = 'ready';
    this.phaseT = 3.2;
    this.endAfter = false;
    this.winner = -1;
    this.time = 0;
    this.events = [];
    this.ball = { x: W / 2, y: FLOOR - BALL_R, vx: 0, vy: 0, state: 'held', holder: -1, spin: 0, shot: null, pass: null, noGrab: -1, noGrabT: 0, dribble: 0, lastSide: 0, fire: false };
    this.powerups = [];
    this.puTimer = 7;
    this.puId = 0;
    this.possession = Math.random() < 0.5 ? 0 : 1;
    this.resetPositions(this.possession);
  }

  emit(type, data = {}) { this.events.push({ type, ...data }); }
  popup(text, x, y, color = '#fff', size = 1) { this.emit('popup', { text, x, y, color, size }); }
  drainEvents() { const e = this.events; this.events = []; return e; }

  team(side) { return this.players.filter(p => p.side === side); }
  mate(p) { return this.players.find(q => q.side === p.side && q !== p) || null; }
  opps(p) { return this.players.filter(q => q.side !== p.side); }
  hasBall(p) { return this.ball.state === 'held' && this.ball.holder === p.i; }
  holder() { return this.ball.state === 'held' ? this.players[this.ball.holder] : null; }

  resetPositions(side) {
    const off = this.team(side), def = this.team(1 - side);
    const dir = HOOPS[side].dir, cx = W / 2;
    const offX = [cx - dir * 340, cx - dir * 120];
    const defX = [cx - dir * 60, cx + dir * 90];
    const place = (p, x, face) => {
      Object.assign(p, { x, y: FLOOR, vx: 0, vy: 0, ground: true, state: 'move', st: 0, dk: null, meter: 0, face, call: 0, mood: 0, immune: 0 });
    };
    off.forEach((p, k) => place(p, offX[k], dir));
    def.forEach((p, k) => place(p, defX[k], -dir));
    const b = this.ball;
    Object.assign(b, { state: 'held', holder: off[0].i, vx: 0, vy: 0, shot: null, pass: null, noGrab: -1, noGrabT: 0, lastSide: side, fire: false });
    off[0].holdT = 0;
    this.powerups = [];
  }

  step(inputs) {
    this.time += DT;
    const ph = this.phase;
    if (ph === 'ready') {
      const before = Math.ceil(this.phaseT);
      this.phaseT -= DT;
      const after = Math.ceil(this.phaseT);
      if (after !== before && after > 0 && after <= 3) { this.popup(String(after), W / 2, 330, '#fff', 2.2); this.emit('sound', { name: 'tick' }); }
      if (this.phaseT <= 0) {
        this.phase = 'play';
        this.popup('GO!', W / 2, 330, '#ffd23f', 2.6);
        this.emit('sound', { name: 'whistle' });
      }
      for (const p of this.players) this.updatePlayer(p, EMPTY_INPUT, false);
      this.updateBall();
      return;
    }
    if (ph === 'play' && this.timed) {
      this.clock -= DT;
      if (this.clock <= 0) {
        this.clock = 0;
        const live = this.ball.state === 'shot' || this.players.some(p => p.state === 'dunk' || p.state === 'layup');
        this.emit('sound', { name: 'buzzer' });
        if (live) { this.phase = 'buzzer'; this.phaseT = 3; }
        else { this.endRegulation(); return; }
      }
    }
    const canAct = this.phase === 'play';
    this.players.forEach((p, i) => this.updatePlayer(p, canAct ? (inputs[i] || EMPTY_INPUT) : EMPTY_INPUT, canAct));
    this.collide();
    this.updateBall();
    if (canAct) this.updatePowerups();

    if (this.phase === 'buzzer') {
      this.phaseT -= DT;
      const resolved = this.ball.state !== 'shot' && !this.players.some(p => p.state === 'dunk' || p.state === 'layup');
      if (resolved || this.phaseT <= 0) this.endRegulation();
    } else if (this.phase === 'score') {
      this.phaseT -= DT;
      if (this.phaseT <= 0) {
        if (this.endAfter) this.finish(this.score[0] > this.score[1] ? 0 : 1);
        else if (this.timed && this.clock <= 0) this.endRegulation();
        else { this.resetPositions(this.possession); this.phase = 'play'; }
      }
    } else if (this.phase === 'over') {
      this.phaseT += DT;
    }
  }

  endRegulation() {
    if (this.score[0] === this.score[1]) {
      this.overtime = true;
      this.timed = false;
      this.phase = 'ready';
      this.phaseT = 3.2;
      this.popup('OVERTIME', W / 2, 260, '#ff7a1a', 2);
      this.popup('NEXT BUCKET WINS', W / 2, 400, '#fff', 1.2);
      this.resetPositions(Math.random() < 0.5 ? 0 : 1);
    } else this.finish(this.score[0] > this.score[1] ? 0 : 1);
  }

  finish(w) {
    this.phase = 'over';
    this.phaseT = 0;
    this.winner = w;
    this.emit('sound', { name: 'buzzer' });
    this.emit('over', { winner: w });
    for (const p of this.players) {
      if (!LYING(p.state)) p.state = 'move';
      p.mood = p.side === w ? 1 : -1;
    }
  }

  // ---------------------------------------------------------------- players

  speedOf(p) {
    let s = 360 + 175 * p.r.spd;
    if (p.nitro) s *= 1.4;
    if (p.fx.speed > 0) s *= 1.3;
    if (p.iron > 0) s *= 1.08;
    if (this.hasBall(p)) s *= 0.93;
    return s;
  }

  dunkRange(p) { return 120 + 190 * p.r.dunk + (p.sig === 'slasher' ? 40 : 0); }

  updatePlayer(p, inp, canAct) {
    for (const k in p.cd) if (p.cd[k] > 0) p.cd[k] -= DT;
    for (const k in p.fx) if (p.fx[k] > 0) p.fx[k] -= DT;
    if (p.iron > 0) { p.iron -= DT; if (p.iron <= 0) this.emit('sound', { name: 'shieldOff' }); }
    if (p.immune > 0) p.immune -= DT;
    if (p.call > 0) p.call -= DT;
    if (p.assistT > 0) p.assistT -= DT; else p.assistFrom = -1;
    if (this.hasBall(p)) p.holdT += DT; else p.holdT = 0;
    if (p.fx.frozen > 0) inp = EMPTY_INPUT;

    const prev = p.prev;
    const press = k => inp[k] && !prev[k];
    const released = k => !inp[k] && prev[k];
    const hoop = HOOPS[p.side];
    const move = (inp.r ? 1 : 0) - (inp.l ? 1 : 0);
    p.prev = { ...inp };

    // Nitro sprint drains stamina; Fast Break makes it free.
    p.nitro = !!inp.nitro && move !== 0 && p.stamina > 0.04 && (p.state === 'move' || p.state === 'cross');
    if (p.nitro) { if (p.fx.speed <= 0) p.stamina = Math.max(0, p.stamina - 0.5 * DT); }
    else p.stamina = Math.min(1, p.stamina + 0.22 * DT);

    if (p.state === 'dunk' || p.state === 'layup') return this.updateDunk(p);
    if (p.state === 'hang') {
      p.st += DT;
      if (p.st > 0.38) { p.state = 'move'; p.vy = 120; p.vx = -hoop.dir * 60; }
      return;
    }

    const speed = this.speedOf(p);
    if (p.state === 'knocked') {
      p.st -= DT;
      if (p.ground) p.vx *= 0.86;
      if (p.st <= 0 && p.ground) { p.state = 'getup'; p.st = 0.3; }
    } else if (p.state === 'getup') {
      p.st -= DT; p.vx = 0;
      if (p.st <= 0) { p.state = 'move'; p.immune = 0.9; }
    } else if (p.state === 'stumble') {
      p.st -= DT;
      p.vx *= 0.9;
      if (p.st <= 0) p.state = 'move';
    } else if (p.state === 'punch' || p.state === 'whiff') {
      p.st -= DT;
      p.vx *= 0.82;
      if (p.state === 'punch' && !p.hitDone && p.st <= 0.15) { p.hitDone = true; this.resolvePunch(p); }
      if (p.st <= 0) {
        if (p.state === 'punch' && p.missed) { p.state = 'whiff'; p.st = 0.32; }
        else p.state = 'move';
      }
    } else if (p.state === 'cross' || p.state === 'slide') {
      p.st -= DT;
      p.vx = p.crossDir * speed * (p.state === 'cross' ? 1.65 : 1.8);
      if (p.st <= 0) p.state = 'move';
    } else {
      const target = move * speed;
      const acc = (p.ground ? 5200 : 900) * DT;
      p.vx += clamp(target - p.vx, -acc, acc);
      if (move) p.face = move;
      else if (p.state === 'move' && p.ground) {
        if (this.hasBall(p)) p.face = hoop.dir;
        else if (Math.abs(this.ball.x - p.x) > 12) p.face = Math.sign(this.ball.x - p.x);
      }
      if (canAct) this.handleActions(p, press, move);
    }

    if (p.state === 'shoot') {
      p.meter += DT / METER_TIME;
      p.face = hoop.dir;
      if (!this.hasBall(p)) p.state = 'move';
      else if ((canAct && released('shoot')) || p.meter >= 1.18 || !canAct) this.releaseShot(p);
    }

    if (!p.ground) {
      p.vy += G_P * DT;
      p.y += p.vy * DT;
      if (p.y >= FLOOR) {
        p.y = FLOOR; p.vy = 0; p.ground = true;
        if (p.state === 'shoot') this.releaseShot(p);
        if (p.state === 'knocked') this.emit('sound', { name: 'thud' });
        this.emit('land', { i: p.i });
      }
    }
    p.x = clamp(p.x + p.vx * DT, 36, W - 36);
    if (p.ground) p.anim += Math.abs(p.vx) * DT * 0.022;
  }

  handleActions(p, press, move) {
    const has = this.hasBall(p);
    const hoop = HOOPS[p.side];

    // Super bar full: MEGA DUNK with the ball, IRON DEFENSE without it.
    if (press('spec') && p.power >= 100) {
      if (has && p.state === 'move') { p.power = 0; this.startDunk(p, 'dunk', false, true); return; }
      if (!has && p.iron <= 0) {
        p.iron = IRON_TIME; p.power = 0;
        this.popup('IRON DEFENSE!', p.x, p.y - 300, '#6fc8ff', 1.3);
        this.emit('sound', { name: 'shield' });
        this.emit('cheer', { amt: 0.8 });
      }
    }

    if (press('u') && p.ground && p.state === 'move') {
      p.vy = -(900 + 80 * p.r.blk);
      p.ground = false;
      this.emit('sound', { name: 'jump' });
    }

    if (press('shoot') && has && p.state === 'move' && p.cd.shoot <= 0) {
      const d = Math.abs(hoop.x - p.x);
      const towards = p.vx * hoop.dir > -60;
      if (p.ground && d < this.dunkRange(p) && towards) {
        this.startDunk(p, p.r.dunk >= 0.62 ? 'dunk' : 'layup', false, false);
      } else {
        p.state = 'shoot'; p.meter = 0; p.face = hoop.dir;
        if (p.ground) { p.vy = -760; p.ground = false; p.vx *= 0.3; }
        this.emit('sound', { name: 'jump' });
      }
      return;
    }

    if (press('act')) {
      const mate = this.mate(p);
      if (has && mate) { this.pass(p); return; }
      const h = this.holder();
      if (!has && h && h.side === p.side) { p.call = 1.2; this.emit('call', { i: p.i }); return; }
      if (p.cd.punch <= 0 && p.state === 'move') {
        p.state = 'punch'; p.st = 0.24; p.hitDone = false; p.missed = false;
        p.cd.punch = has ? 1.5 : 0.85;
        p.vx *= 0.3;
        this.emit('sound', { name: 'swing' });
      }
      return;
    }

    if (press('skill') && p.ground && p.state === 'move' && p.cd.skill <= 0) {
      p.crossDir = move || (has ? hoop.dir : p.face);
      p.face = p.crossDir;
      if (has) this.crossover(p);
      else { p.state = 'slide'; p.st = 0.16; p.cd.skill = 0.7; }
    }
  }

  // Punch / shove. A clean hit knocks the target down and pops the ball loose.
  resolvePunch(p) {
    const has = this.hasBall(p);
    const big = p.fx.big > 0 ? 1.3 : 1;
    let target = null, bd = 1e9;
    for (const q of this.opps(p)) {
      const dx = q.x - p.x;
      if (LYING(q.state)) continue;
      if (Math.abs(dx) > 96 * big || Math.abs(q.y - p.y) > 135) continue;
      if (Math.sign(dx) !== p.face && Math.abs(dx) > 25) continue;
      const d = Math.abs(dx) + (q.lane !== p.lane ? 20 : 0);
      if (d < bd) { bd = d; target = q; }
    }
    if (!target) { p.missed = true; return; }
    const q = target;
    if (q.iron > 0 || q.immune > 0 || (q.dk && q.dk.mega)) {
      p.missed = true;
      if (q.iron > 0) { this.popup('CLANG!', q.x, q.y - 270, '#6fc8ff', 1); this.emit('sound', { name: 'clang' }); p.vx = -p.face * 300; }
      return;
    }
    let chance = 0.38 + 0.25 * p.r.def;
    if (this.hasBall(q)) chance -= 0.3 * q.r.hnd;
    if (p.sig === 'lockdown') chance += 0.1;
    if (q.sig === 'lockdown') chance -= 0.1;
    if (q.state === 'cross') chance *= 0.3;
    if (q.state === 'shoot') chance = 0.7;
    if (q.state === 'dunk' || q.state === 'layup') chance = 0.45;
    if (has) chance *= 0.6;
    if (p.iron > 0) chance = 1;
    if (Math.random() >= chance) { p.missed = true; return; }
    this.knockDown(q, p.face, p, true);
  }

  knockDown(q, dir, by, punch) {
    const b = this.ball;
    const hadBall = this.hasBall(q);
    if (hadBall) {
      Object.assign(b, { state: 'free', holder: -1, x: q.x, y: q.y - 150 * q.h, vx: dir * rnd(80, 220), vy: -rnd(480, 650), noGrab: q.i, noGrabT: 0.7, fire: false });
    }
    Object.assign(q, { state: 'knocked', st: 1.15, vx: dir * 420, vy: -380, ground: false, dk: null, meter: 0, nitro: false });
    if (by) {
      by.stats.ko++;
      if (hadBall) by.stats.stl++;
      this.addPower(by, hadBall ? 12 : 6);
    }
    const words = ['POW!', 'BAM!', 'WHAM!', 'KO!', 'SMACK!'];
    const colors = ['#ffd23f', '#ff5a5a', '#ff7ad9', '#4fd1ff', '#5dff7a'];
    const k = Math.floor(Math.random() * words.length);
    if (punch) this.popup(words[k], q.x, q.y - 280, colors[k], 1.3);
    this.emit('hit', { x: q.x - dir * 20, y: q.y - 170 * q.h });
    this.emit('shake', { mag: 9 });
    this.emit('sound', { name: 'punch' });
    this.emit('cheer', { amt: 0.9 });
  }

  crossover(p) {
    p.state = 'cross'; p.st = 0.24; p.cd.skill = 0.85;
    this.emit('sound', { name: 'cross' });
    let best = null, bd = 1e9;
    for (const q of this.opps(p)) {
      const d = Math.abs(q.x - p.x) + (q.lane !== p.lane ? 40 : 0);
      if (d < bd) { bd = d; best = q; }
    }
    if (!best || Math.abs(best.x - p.x) > 140 || !best.ground || best.iron > 0) return;
    if (!(best.state === 'move' || best.state === 'punch' || best.state === 'whiff')) return;
    let chance = clamp(0.02 + 0.38 * p.r.hnd - 0.3 * best.r.def, 0.04, 0.4);
    if (p.sig === 'handles') chance += 0.1;
    if (best.state === 'punch' || best.state === 'whiff') chance += 0.35; // baited the swing
    if (Math.random() < chance) {
      best.state = 'stumble'; best.st = 1.0; best.vx = -p.crossDir * 80;
      p.stats.ank++;
      this.addPower(p, 15);
      this.popup('ANKLES!', best.x, best.y - 280, '#ff4fd8', 1.3);
      this.emit('sound', { name: 'ooh' });
      this.emit('cheer', { amt: 1 });
    }
  }

  pass(p) {
    const mate = this.mate(p);
    if (!mate || LYING(mate.state)) return;
    const hoop = HOOPS[p.side];
    const b = this.ball;
    const x0 = p.x + p.face * 25, y0 = p.y - 130 * p.h;
    const mateD = Math.abs(hoop.x - mate.x), myD = Math.abs(hoop.x - p.x);
    const crowded = this.opps(p).some(q => Math.abs(q.x - mate.x) < 70);
    let tx, ty, T;
    if (mateD < 380 && mateD < myD && mate.ground && mate.state === 'move' && mate.r.dunk >= 0.55 && !crowded) {
      this.startDunk(mate, 'dunk', true, false);
      const s = 0.8;
      T = mate.dk.T * s;
      const pos = dunkPos(mate.dk, s);
      tx = pos.x + hoop.dir * 10; ty = pos.y - reachOf(mate) + 20;
    } else {
      T = clamp(Math.abs(mate.x - p.x) / 1100 + 0.18, 0.25, 0.75);
      tx = mate.x + mate.vx * T * 0.7;
      ty = mate.y - (mate.ground ? 125 : 200) * mate.h;
    }
    p.face = Math.sign(mate.x - p.x) || p.face;
    Object.assign(b, {
      state: 'pass', holder: -1, x: x0, y: y0, vx: (tx - x0) / T, vy: (ty - y0 - 0.5 * G_B * T * T) / T,
      pass: { from: p.i, to: mate.i }, noGrab: p.i, noGrabT: 0.3, shot: null,
    });
    this.emit('sound', { name: 'pass' });
  }

  startDunk(p, kind, oop, mega) {
    const hoop = HOOPS[p.side];
    const d = Math.abs(hoop.x - p.x);
    const x1 = kind === 'dunk' ? hoop.x - hoop.dir * 34 : hoop.x - hoop.dir * 88;
    const y1 = kind === 'dunk' ? hoop.y + 236 * p.h : FLOOR - 120;
    p.state = kind; p.st = 0; p.ground = false; p.vy = 0; p.face = hoop.dir;
    p.dk = mega
      ? { x0: p.x, y0: p.y, x1, y1, T: 0.8 + d / 1500, arc: 230 + d * 0.12, checked: true, oop: false, poster: false, mega: true, from: d }
      : { x0: p.x, y0: p.y, x1, y1, T: 0.42 + d / 950, arc: 60 + d * 0.16, checked: false, oop, poster: false, mega: false, from: d };
    if (mega) {
      this.popup('MEGA DUNK!', p.x, p.y - 320, '#ffd23f', 1.6);
      this.emit('sound', { name: 'megaUp' });
      this.emit('cheer', { amt: 1.2 });
    } else this.emit('sound', { name: 'jump' });
  }

  updateDunk(p) {
    const dk = p.dk, hoop = HOOPS[p.side];
    p.st += DT;
    const s = Math.min(1, p.st / dk.T);
    const pos = dunkPos(dk, s);
    p.vx = (pos.x - p.x) / DT; p.vy = (pos.y - p.y) / DT;
    p.x = pos.x; p.y = pos.y;
    const has = this.hasBall(p);

    if (has && s > 0.55 && !dk.checked) {
      dk.checked = true;
      const bx = p.x + hoop.dir * 20, by = p.y - reachOf(p);
      for (const q of this.opps(p)) {
        if (LYING(q.state)) continue;
        const hx = q.x, hy = q.y - reachOf(q);
        const near = Math.hypot(hx - bx, hy - by) < 90 * (q.fx.big > 0 ? 1.4 : 1);
        if (Math.abs(q.x - p.x) < 140) dk.poster = true;
        const ironNear = q.iron > 0 && Math.abs(q.x - p.x) < 170;
        if (!ironNear && (q.ground || !near)) continue;
        let chance = ironNear ? 1 : 0.2 + 0.55 * q.r.blk + (q.sig === 'bigman' ? 0.08 : 0);
        if (p.superShot) chance = 0;
        if (Math.random() < chance) {
          if (ironNear && q.ground) { q.vy = -950; q.ground = false; }
          this.blocked(q, hoop.dir);
          p.state = 'move'; p.dk = null; p.vx = -hoop.dir * 100; p.vy = 0;
          p.stats.fga++;
          return;
        }
      }
    }

    if (s >= 1) {
      if (p.state === 'dunk') {
        if (!has) { p.state = 'move'; p.dk = null; p.vy = 0; return; }
        const b = this.ball;
        const pts = dk.mega && dk.from > THREE_DIST ? 3 : 2;
        Object.assign(b, { state: 'shot', holder: -1, x: hoop.x, y: hoop.y - 28, vx: 0, vy: 650, noGrab: p.i, noGrabT: 0.6,
          shot: { side: p.side, shooter: p.i, pts, make: true, dunk: true, mega: dk.mega, oop: dk.oop, poster: dk.poster, age: 0, touched: false, checked: [] } });
        p.superShot = false;
        p.stats.fga++;
        p.state = 'hang'; p.st = 0; p.vx = 0; p.vy = 0;
        p.x = hoop.x - hoop.dir * 30;
        this.emit('rim', { side: p.side, hard: true });
        if (dk.mega) {
          this.emit('mega', { side: p.side });
          this.emit('shake', { mag: 24 });
          this.emit('sound', { name: 'mega' });
          for (const q of this.opps(p)) {
            if (Math.abs(q.x - hoop.x) < 260 && !LYING(q.state) && q.iron <= 0) this.knockDown(q, Math.sign(q.x - hoop.x) || -hoop.dir, null, false);
          }
        } else {
          this.emit('shake', { mag: dk.poster ? 16 : 10 });
          this.emit('sound', { name: 'dunk' });
        }
      } else {
        let pm = 0.72 * (0.78 + 0.3 * p.r.shot) * this.contest(p);
        if (p.superShot) pm = 0.99;
        this.launchShot(p, p.x + hoop.dir * 22, p.y - reachOf(p), Math.random() < pm, 2, 0.42, false);
        p.state = 'move'; p.dk = null; p.vy = -100; p.vx = hoop.dir * 60;
      }
    }
  }

  contest(p) {
    const dir = HOOPS[p.side].dir;
    let c = 1;
    for (const q of this.opps(p)) {
      const dx = Math.abs(q.x - p.x);
      if (dx > 125 || q.state === 'stumble' || LYING(q.state)) continue;
      const inFront = Math.sign(q.x - p.x) === dir || dx < 45;
      let cc = q.ground ? 0.8 : 0.55;
      cc += (1 - cc) * (dx / 125);
      if (!inFront) cc = (1 + cc) / 2;
      c = Math.min(c, cc);
    }
    return c;
  }

  releaseShot(p) {
    const hoop = HOOPS[p.side];
    p.state = 'move';
    p.cd.shoot = 0.25;
    const m = p.meter;
    const win = greenWindow(p);
    const err = Math.abs(m - SWEET);
    const t = err <= win ? 1 : clamp(1 - (err - win) / 0.38, 0, 1);
    const d = Math.abs(hoop.x - p.x);
    const pts = d > THREE_DIST ? 3 : 2;
    const sk = pts === 3 ? p.r.three : p.r.shot;
    let distF = d < 220 ? 1.05 : 1 - Math.max(0, d - 220) / (1150 + 800 * sk);
    if (pts === 3) distF *= 0.92;
    if (d > 1050) distF *= 0.6;
    const skillF = 0.62 + 0.45 * sk;
    let pm = (0.04 + 0.74 * Math.pow(t, 1.6)) * distF * skillF * this.contest(p);
    if (t === 1) pm = Math.min(0.93, pm * 1.08);
    const fire = p.superShot;
    if (fire) pm = 0.99;
    pm = clamp(pm, 0.02, 0.99);

    const label = fire ? ['SUPER SHOT', '#ff7a1a'] : t === 1 ? ['PERFECT', '#5dff7a'] : t > 0.6 ? ['GOOD', '#c8ff5d'] : m < SWEET ? ['EARLY', '#ffb347'] : ['LATE', '#ff6b6b'];
    this.emit('release', { i: p.i, label: label[0], color: label[1], t });
    const T = 0.78 + d / 1500;
    this.launchShot(p, p.x + p.face * 12, p.y - 235 * p.h, Math.random() < pm, pts, T, t < 0.12 && !fire);
    p.meter = 0;
  }

  launchShot(p, x0, y0, make, pts, T, airball) {
    const hoop = HOOPS[p.side];
    let tx = hoop.x, ty = hoop.y - 2;
    if (make) tx += rnd(-4, 4) + hoop.dir * 3;
    else if (airball && Math.random() < 0.5) tx -= hoop.dir * rnd(70, 140);
    else tx += (Math.random() < 0.5 ? -1 : 1) * rnd(27, 44);
    const b = this.ball;
    const fire = p.superShot;
    p.superShot = false;
    Object.assign(b, {
      state: 'shot', holder: -1, x: x0, y: y0, vx: (tx - x0) / T, vy: (ty - y0 - 0.5 * G_B * T * T) / T,
      noGrab: p.i, noGrabT: 0.45, pass: null, fire,
      shot: { side: p.side, shooter: p.i, pts, make, dunk: false, age: 0, touched: false, checked: [], fire },
    });
    p.stats.fga++;
    if (pts === 3) p.stats.tpa++;
    this.emit('sound', { name: fire ? 'fireball' : 'shoot' });
  }

  blocked(q, dir) {
    const b = this.ball;
    Object.assign(b, { state: 'free', holder: -1, shot: null, fire: false, vx: -dir * rnd(300, 600), vy: rnd(-420, -80), noGrab: -1, lastSide: q.side });
    q.stats.blk++;
    this.addPower(q, 15);
    this.popup(Math.random() < 0.5 ? 'REJECTED!' : 'BLOCKED!', q.x, q.y - 300, '#ff4f4f', 1.4);
    this.emit('shake', { mag: 7 });
    this.emit('sound', { name: 'block' });
    this.emit('cheer', { amt: 1 });
  }

  addPower(p, amt) {
    const before = p.power;
    p.power = Math.min(100, p.power + amt);
    if (before < 100 && p.power >= 100) this.emit('sound', { name: 'ready' });
  }

  collide() {
    const ps = this.players;
    for (let a = 0; a < ps.length; a++) for (let c = a + 1; c < ps.length; c++) {
      const p = ps[a], q = ps[c];
      if (p.side === q.side || p.lane !== q.lane || !p.ground || !q.ground) continue;
      const free = s => s === 'move' || s === 'punch' || s === 'whiff' || s === 'shoot';
      const wall = p.iron > 0 || q.iron > 0; // Iron Defense can't be blown by
      const ok = s => free(s) || (wall && s === 'cross');
      if (!ok(p.state) || !ok(q.state)) continue;
      const dx = q.x - p.x, ov = 46 - Math.abs(dx);
      if (ov <= 0) continue;
      const s = Math.sign(dx) || 1;
      let pw = this.hasBall(p) ? 0.75 : this.hasBall(q) ? 0.25 : 0.5;
      if (p.iron > 0 && q.iron <= 0) pw = 0; else if (q.iron > 0 && p.iron <= 0) pw = 1;
      p.x -= s * ov * pw; q.x += s * ov * (1 - pw);
    }
  }

  // ---------------------------------------------------------------- ball

  updateBall() {
    const b = this.ball;
    if (b.noGrabT > 0) b.noGrabT -= DT;
    if (b.state === 'held') {
      const h = this.players[b.holder];
      const air = h.state === 'shoot' || !h.ground || h.state === 'dunk' || h.state === 'layup' || h.state === 'hang';
      if (air) {
        b.x = h.x + h.face * 14; b.y = h.y - (h.state === 'move' && !h.ground ? 150 : 235) * h.h;
      } else if (h.state === 'cross') {
        const k = 1 - h.st / 0.24;
        b.x = h.x + h.crossDir * lerp(-26, 30, k); b.y = FLOOR - BALL_R - Math.abs(Math.sin(k * Math.PI)) * 30;
      } else {
        const prev = b.dribble % 1;
        b.dribble += DT * (2.2 + Math.abs(h.vx) / 160);
        const ph = b.dribble % 1;
        if (ph < prev) this.emit('sound', { name: 'dribble' });
        b.x = h.x + h.face * 30; b.y = FLOOR - BALL_R - Math.sin(ph * Math.PI) * 82 * h.h;
      }
      b.spin += h.vx * DT * 0.05;
      return;
    }

    const px = b.x, py = b.y;
    b.vy += G_B * DT;
    b.x += b.vx * DT; b.y += b.vy * DT;
    b.spin += b.vx * DT * 0.04;
    if (b.shot) b.shot.age += DT;

    // jump-shot blocks: only early in the flight (no goaltending)
    if (b.state === 'shot' && !b.shot.dunk && !b.shot.fire && b.shot.age < 0.32 && b.vy < 0) {
      const shooter = this.players[b.shot.shooter];
      for (const q of this.opps(shooter)) {
        if (b.shot.checked.includes(q.i) || LYING(q.state)) continue;
        if (q.iron > 0 && Math.abs(q.x - shooter.x) < 170) { // Iron Defense auto-rejects
          b.shot.checked.push(q.i);
          if (q.ground) { q.vy = -950; q.ground = false; }
          this.blocked(q, HOOPS[shooter.side].dir);
          return;
        }
        if (q.ground) continue;
        const r = 42 * (q.fx.big > 0 ? 1.4 : 1) * (q.sig === 'bigman' ? 1.25 : 1);
        if (Math.hypot(b.x - (q.x + q.face * 8), b.y - (q.y - reachOf(q))) > r + BALL_R) continue;
        b.shot.checked.push(q.i);
        if (Math.random() < 0.3 + 0.6 * q.r.blk) { this.blocked(q, HOOPS[shooter.side].dir); return; }
      }
    }

    // rims & boards
    for (let h = 0; h < 2; h++) {
      const hp = HOOPS[h];
      const ghost = b.state === 'shot' && b.shot.make && b.shot.side === h;
      if (!ghost) {
        for (const rx of [hp.front, hp.back]) {
          const dx = b.x - rx, dy = b.y - hp.y, dist = Math.hypot(dx, dy);
          if (dist < BALL_R + RIM_R && dist > 0) {
            const nx = dx / dist, ny = dy / dist;
            b.x = rx + nx * (BALL_R + RIM_R); b.y = hp.y + ny * (BALL_R + RIM_R);
            const vn = b.vx * nx + b.vy * ny;
            if (vn < 0) {
              b.vx -= 1.55 * vn * nx; b.vy -= 1.55 * vn * ny;
              b.vx *= 0.85; b.vy *= 0.85;
              if (Math.abs(vn) > 120) { this.emit('sound', { name: 'rim' }); this.emit('rim', { side: h }); }
            }
            if (b.shot) b.shot.touched = true;
          }
        }
      }
      if (b.y > BOARD_TOP - BALL_R * 0.5 && b.y < BOARD_BOT + BALL_R * 0.5 && Math.abs(b.x - hp.board) < BALL_R + 5) {
        const side = -hp.dir;
        b.x = hp.board + side * (BALL_R + 5);
        if (b.vx * side < 0) {
          b.vx = -b.vx * 0.6;
          this.emit('sound', { name: 'board' });
          if (b.shot) b.shot.touched = true;
        }
      }
      const lo = Math.min(hp.front, hp.back) + 5, hi = Math.max(hp.front, hp.back) - 5;
      if (py < hp.y && b.y >= hp.y && b.vy > 0 && b.x > lo && b.x < hi && (this.phase === 'play' || this.phase === 'buzzer')) {
        this.scored(h);
        b.vx *= 0.15; b.vy = Math.min(b.vy, 260);
      }
    }

    if (b.y > FLOOR - BALL_R) {
      b.y = FLOOR - BALL_R;
      if (b.vy > 160) this.emit('sound', { name: 'bounce', vol: Math.min(1, b.vy / 900) });
      b.vy = -b.vy * 0.62; b.vx *= 0.86;
      if (Math.abs(b.vy) < 90) b.vy = 0;
      if (b.state === 'shot' || b.state === 'pass') { b.state = 'free'; b.shot = null; b.fire = false; }
    }
    if (b.x < BALL_R) { b.x = BALL_R; b.vx = Math.abs(b.vx) * 0.7; }
    if (b.x > W - BALL_R) { b.x = W - BALL_R; b.vx = -Math.abs(b.vx) * 0.7; }

    if (this.phase === 'play') this.tryPickup();
  }

  tryPickup() {
    const b = this.ball;
    let ok = b.state === 'free' || b.state === 'pass';
    if (b.state === 'shot') {
      const hp = HOOPS[b.shot.side];
      ok = b.shot.touched || (b.vy > 0 && b.y > hp.y + 30) || b.shot.age > 2.5;
      if (b.shot.make && !b.shot.touched) ok = false;
    }
    if (!ok) return;
    let best = null, bd = 1e9;
    for (const p of this.players) {
      if (p.i === b.noGrab && b.noGrabT > 0) continue;
      if (p.cd.grab > 0 || p.state === 'stumble' || p.state === 'hang' || LYING(p.state) || p.fx.frozen > 0) continue;
      if ((p.state === 'dunk' || p.state === 'layup') && !(p.dk && p.dk.oop)) continue;
      const big = p.fx.big > 0 ? 1.25 : 1;
      const magnet = p.sig === 'bigman' ? 1.2 : 1;
      const extra = b.pass && b.pass.to === p.i ? 22 : 0;
      const halfW = (40 + extra) * big * magnet + BALL_R;
      const top = p.y - reachOf(p) - BALL_R - extra;
      if (Math.abs(b.x - p.x) > halfW || b.y < top || b.y > p.y + 5) continue;
      const d = Math.abs(b.x - p.x) + Math.random() * 6;
      if (d < bd) { bd = d; best = p; }
    }
    if (!best) return;
    const wasPass = b.state === 'pass' ? b.pass : null;
    Object.assign(b, { state: 'held', holder: best.i, shot: null, pass: null, vx: 0, vy: 0, lastSide: best.side, fire: false });
    best.holdT = 0;
    if (best.state === 'punch' || best.state === 'whiff') best.state = 'move';
    if (wasPass && this.players[wasPass.from].side !== best.side) {
      best.stats.stl++; this.addPower(best, 15);
      this.popup('PICKED OFF!', best.x, best.y - 280, '#4fd1ff', 1.1);
      this.emit('sound', { name: 'steal' });
    } else {
      if (wasPass) { best.assistFrom = wasPass.from; best.assistT = 4; }
      this.emit('sound', { name: 'catch' });
    }
  }

  scored(h) {
    const b = this.ball;
    const shot = b.state === 'shot' ? b.shot : null;
    const shooter = shot && shot.side === h ? this.players[shot.shooter] : null;
    const pts = shooter ? shot.pts : 2;
    this.score[h] += pts;
    b.state = 'free';
    b.shot = null;
    b.fire = false;
    this.emit('net', { side: h, swish: shooter && !shot.touched && !shot.dunk });
    this.emit('cheer', { amt: pts === 3 || (shot && shot.dunk) ? 1.3 : 0.8 });
    const hp = HOOPS[h];
    if (shooter) {
      shooter.stats.pts += pts;
      shooter.stats.fgm++;
      if (pts === 3 && !shot.dunk) shooter.stats.tpm++;
      if (shot.dunk) shooter.stats.dnk++;
      if (shooter.assistFrom >= 0) { this.players[shooter.assistFrom].stats.ast++; shooter.assistFrom = -1; }
      if (!shot.mega) this.addPower(shooter, shot.dunk ? 16 : pts === 3 ? 20 : 14);
      let text, color = '#fff';
      if (shot.mega) { text = pts === 3 ? 'MEGA DUNK! +3' : 'MEGA DUNK!'; color = '#ffd23f'; }
      else if (shot.oop) { text = 'ALLEY-OOP!'; color = '#ffd23f'; }
      else if (shot.dunk && shot.poster) { text = 'POSTERIZED!'; color = '#ff4fd8'; }
      else if (shot.dunk) { text = 'SLAM!'; color = '#ff7a1a'; }
      else if (shot.fire) { text = pts === 3 ? 'SUPER SHOT! +3' : 'SUPER SHOT!'; color = '#ff7a1a'; }
      else if (pts === 3 && !shot.touched) { text = 'SPLASH! +3'; color = '#4fd1ff'; }
      else if (pts === 3) text = '+3';
      else if (!shot.touched) { text = 'SWISH!'; color = '#5dff7a'; }
      else text = '+2';
      this.popup(text, hp.x - hp.dir * 140, hp.y - 120, color, 1.5);
      shooter.mood = 1;
    } else this.popup('+2', hp.x - hp.dir * 120, hp.y - 120);
    this.emit('sound', { name: shot && shot.dunk ? 'cheer' : 'swish' });
    for (const p of this.team(1 - h)) this.addPower(p, 5);

    if (this.timed && this.clock <= 0) this.popup('BUZZER BEATER!', W / 2, 300, '#ffd23f', 1.6);
    this.phase = 'score';
    this.phaseT = 1.5;
    this.possession = 1 - h;
    if (this.overtime || (this.target && this.score[h] >= this.target)) { this.endAfter = true; this.phaseT = 1.2; }
  }

  // ---------------------------------------------------------------- action cards (power-ups)

  updatePowerups() {
    if (!this.cfg.powerups) return;
    this.puTimer -= DT;
    if (this.puTimer <= 0) {
      this.puTimer = rnd(12, 18);
      if (this.powerups.length < 2) {
        const kinds = ['mega', 'iron', 'fast', 'super', 'freeze'];
        this.powerups.push({ id: ++this.puId, kind: kinds[Math.floor(Math.random() * kinds.length)], x: rnd(380, 1220), y: Math.random() < 0.6 ? FLOOR - 75 : FLOOR - 250, t: 9 });
        this.emit('sound', { name: 'spawn' });
      }
    }
    for (const pu of this.powerups) {
      pu.t -= DT;
      for (const p of this.players) {
        if (pu.t <= 0) break;
        if (LYING(p.state)) continue;
        if (Math.abs(p.x - pu.x) < 44 && pu.y > p.y - reachOf(p) && pu.y < p.y) { this.applyPowerup(p, pu.kind); pu.t = 0; }
      }
    }
    this.powerups = this.powerups.filter(pu => pu.t > 0);
  }

  applyPowerup(p, kind) {
    const label = { mega: 'MEGA DUNK READY', iron: 'IRON DEFENSE!', fast: 'FAST BREAK!', super: 'SUPER SHOT!', freeze: 'FREEZE!' }[kind];
    if (kind === 'mega') this.addPower(p, 100);
    else if (kind === 'iron') { p.iron = IRON_TIME; this.emit('sound', { name: 'shield' }); }
    else if (kind === 'fast') { p.fx.speed = 7; p.stamina = 1; }
    else if (kind === 'super') p.superShot = true;
    else if (kind === 'freeze') for (const q of this.opps(p)) if (q.iron <= 0) q.fx.frozen = 1.7;
    this.popup(label, p.x, p.y - 290, '#ffd23f', 1.1);
    this.emit('sound', { name: 'power' });
  }

  // ---------------------------------------------------------------- networking

  snapshot() {
    const b = this.ball, r = v => Math.round(v * 10) / 10;
    return {
      ph: this.phase, pt: r(this.phaseT), sc: this.score, ck: r(this.clock), tm: this.timed, ot: this.overtime, w: this.winner,
      b: [r(b.x), r(b.y), b.state, b.holder, r(b.spin), b.fire ? 1 : 0],
      p: this.players.map(p => [r(p.x), r(p.y), Math.round(p.vx), p.face, p.state, r(p.st), r(p.anim), r(p.meter), Math.round(p.power), r(p.iron),
        p.ground ? 1 : 0, r(p.fx.speed), r(p.fx.big), r(p.fx.frozen), p.superShot ? 1 : 0, r(p.call), p.mood, Object.values(p.stats),
        p.dk ? [r(p.dk.T), p.dk.mega ? 1 : 0] : 0, Math.round(p.stamina * 100), p.nitro ? 1 : 0, r(p.immune), p.crossDir]),
      pu: this.powerups.map(u => [u.id, u.kind, Math.round(u.x), Math.round(u.y), r(u.t)]),
    };
  }

  applySnapshot(s) {
    this.phase = s.ph; this.phaseT = s.pt; this.score = s.sc; this.clock = s.ck; this.timed = s.tm; this.overtime = s.ot; this.winner = s.w;
    const b = this.ball;
    [b.x, b.y, b.state, b.holder, b.spin] = s.b;
    b.fire = !!s.b[5];
    s.p.forEach((a, i) => {
      const p = this.players[i];
      [p.x, p.y, p.vx, p.face, p.state, p.st, p.anim, p.meter, p.power, p.iron] = a;
      p.ground = !!a[10];
      p.fx.speed = a[11]; p.fx.big = a[12]; p.fx.frozen = a[13]; p.superShot = !!a[14]; p.call = a[15]; p.mood = a[16];
      Object.keys(p.stats).forEach((k, j) => { p.stats[k] = a[17][j]; });
      p.dk = a[18] ? { T: a[18][0], mega: !!a[18][1] } : null;
      p.stamina = a[19] / 100; p.nitro = !!a[20]; p.immune = a[21]; p.crossDir = a[22];
    });
    this.powerups = s.pu.map(([id, kind, x, y, t]) => ({ id, kind, x, y, t }));
  }
}

export function dunkPos(dk, s) {
  const e = 1 - (1 - s) * (1 - s);
  return { x: lerp(dk.x0, dk.x1, e), y: lerp(dk.y0, dk.y1, s) - Math.sin(Math.PI * s) * dk.arc };
}
