// Canvas renderer: courts, outlined big-head cartoon players, ball, effects and HUD.
import { W, H, FLOOR, BALL_R, HOOPS, BOARD_TOP, BOARD_BOT, SWEET, THREE_DIST, greenWindow, LYING } from './game.js';
import { TEAM } from './teams.js';
import { play, setCrowd } from './audio.js';

const SKIN = ['#f6d3b3', '#e0ad84', '#bf8052', '#8f5a37', '#603d26'];
const SKIN_SHADE = ['#dfb391', '#c69068', '#9e6440', '#704429', '#452a19'];
const OUT = '#16120f';
const PU = {
  mega: { icon: '💥', label: 'MEGA DUNK', c: '#ffb020' },
  iron: { icon: '🛡️', label: 'IRON D', c: '#4fb6ff' },
  fast: { icon: '⚡', label: 'FAST BREAK', c: '#ffe14d' },
  super: { icon: '🔥', label: 'SUPER SHOT', c: '#ff5a2a' },
  freeze: { icon: '❄️', label: 'FREEZE', c: '#9eeaff' },
};
export const COURTS = { arena: 'Home Arena', street: 'Street Court', beach: 'Beach Court' };

const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const EMOJI_FONT = '"Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif';

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = c => clamp(Math.round(c + amt * 255), 0, 255);
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
function lum(hex) {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}
// Pick a readable trim color for jersey numbers.
export function trimFor(team) {
  const c1 = lum(team.c1);
  if (Math.abs(lum(team.c2) - c1) > 0.25) return team.c2;
  if (Math.abs(lum(team.c3) - c1) > 0.25) return team.c3;
  return c1 > 0.5 ? '#111' : '#fff';
}

function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function fillOut(ctx, fill, lw = 5) { ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = OUT; ctx.stroke(); }
// Thick outlined stroke for limbs.
function limb(ctx, pts, w, color) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.strokeStyle = OUT; ctx.lineWidth = w + 8; ctx.stroke();
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.stroke();
}
function outlinedText(ctx, text, x, y, fill, lw = 8) {
  ctx.lineJoin = 'round'; ctx.lineWidth = lw; ctx.strokeStyle = OUT; ctx.strokeText(text, x, y);
  ctx.fillStyle = fill; ctx.fillText(text, x, y);
}
function star(ctx, x, y, r1, r2, n, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? r2 : r1, a = rot + (i * Math.PI) / n;
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.popups = []; this.particles = []; this.rings = []; this.bursts = []; this.labels = [];
    this.shake = 0; this.cheer = 0; this.flash = 0;
    this.net = [0, 0]; this.rimWob = [0, 0]; this.boardCrack = [0, 0];
    this.t = 0;
    this.meta = { tags: [] };
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(innerWidth * dpr);
    this.canvas.height = Math.round(innerHeight * dpr);
    this.canvas.style.width = innerWidth + 'px';
    this.canvas.style.height = innerHeight + 'px';
    const s = Math.min(this.canvas.width / W, this.canvas.height / H);
    this.scale = s;
    this.ox = (this.canvas.width - W * s) / 2;
    this.oy = (this.canvas.height - H * s) / 2;
  }

  // meta: { home: abbr, court, tags: [{label, color, spec}|null per player], hint, mute, noHud }
  setMatch(game, meta) {
    this.game = game;
    this.meta = meta;
    this.court = COURTS[meta.court] ? meta.court : 'arena';
    this.popups = []; this.particles = []; this.labels = []; this.rings = []; this.bursts = [];
    this.cheer = 0.3; this.flash = 0; this.boardCrack = [0, 0];
    const home = TEAM[meta.home];
    const away = TEAM[game.cfg.teams[game.cfg.teams[0] === meta.home ? 1 : 0]];
    this.home = home;
    this.fans = [];
    const addFan = (x, y, sc) => {
      const roll = Math.random();
      const team = roll < 0.2 ? away : home;
      const shirt = roll < 0.07 ? '#e8e8e8' : Math.random() < 0.6 ? team.c1 : team.c2;
      this.fans.push({ x, y, sc, shirt, skin: SKIN[Math.floor(Math.random() * 5)], ph: Math.random() * 6.28, sp: rnd(3, 6), hat: Math.random() < 0.15, hair: Math.random() < 0.5 });
    };
    if (this.court === 'arena') {
      for (let r = 0; r < 9; r++) {
        const y = 205 + r * 40, sc = 0.7 + r * 0.04;
        for (let x = 10 + (r % 2) * 12; x < W; x += 24 * sc + rnd(0, 6)) addFan(x, y, sc);
      }
    } else {
      const y = this.court === 'street' ? 618 : 612;
      for (let x = 30; x < W; x += rnd(40, 110)) if (Math.abs(x - W / 2) > 40) addFan(x, y + rnd(-6, 6), rnd(1.5, 1.8));
    }
    this.bg = this.buildBackground();
  }

  handleEvents(evts) {
    const g = this.game, mute = this.meta.mute;
    for (const e of evts) {
      switch (e.type) {
        case 'sound': if (!mute) play(e.name, e.vol); break;
        case 'popup': this.popups.push({ ...e, t: 0 }); break;
        case 'shake': this.shake = Math.max(this.shake, e.mag); break;
        case 'net': this.net[e.side] = 1; this.burst(HOOPS[e.side].x, HOOPS[e.side].y + 30, e.swish ? '#ffffff' : '#ffd23f', 18); break;
        case 'rim': this.rimWob[e.side] = e.hard ? 1 : 0.5; break;
        case 'cheer': this.cheer = Math.min(2, this.cheer + e.amt); if (e.amt >= 1 && !mute) play('cheer'); break;
        case 'release': {
          const p = g.players[e.i];
          this.labels.push({ text: e.label, color: e.color, x: p.x, y: p.y - 320, t: 0 });
          break;
        }
        case 'hit':
          this.bursts.push({ x: e.x, y: e.y, t: 0, rot: rnd(0, 1) });
          this.burst(e.x, e.y, '#ffd23f', 14);
          break;
        case 'mega': {
          const hp = HOOPS[e.side];
          this.flash = 1;
          this.boardCrack[e.side] = 1;
          this.rings.push({ x: hp.x, y: FLOOR, t: 0, c: '#ffd23f' }, { x: hp.x, y: FLOOR, t: -0.12, c: '#ff7a1a' });
          for (let i = 0; i < 40; i++) this.particles.push({ kind: 'shard', x: hp.board + rnd(-8, 8), y: rnd(BOARD_TOP, BOARD_BOT), vx: -hp.dir * rnd(80, 420), vy: rnd(-420, 50), life: rnd(0.8, 1.6), c: 'rgba(210,240,255,0.9)', rot: rnd(0, 6), r: rnd(4, 10) });
          this.burst(hp.x, hp.y, '#ffd23f', 40);
          break;
        }
        case 'over': {
          if (!mute) play('win');
          this.cheer = 2;
          const t = TEAM[g.cfg.teams[e.winner]];
          for (let i = 0; i < 160; i++) this.particles.push({ kind: 'confetti', x: rnd(0, W), y: rnd(-300, 0), vx: rnd(-60, 60), vy: rnd(80, 220), life: rnd(3, 6), c: Math.random() < 0.5 ? t.c1 : t.c2, rot: rnd(0, 6) });
          break;
        }
      }
    }
  }

  burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = rnd(0, Math.PI * 2), v = rnd(80, 360);
      this.particles.push({ kind: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, life: rnd(0.4, 0.9), c: color });
    }
  }

  // ---------------------------------------------------------------- static backgrounds
  buildBackground() {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    if (this.court === 'street') this.bgStreet(ctx);
    else if (this.court === 'beach') this.bgBeach(ctx);
    else this.bgArena(ctx);
    this.courtLines(ctx);
    this.stanchions(ctx);
    return c;
  }

  bgArena(ctx) {
    const home = this.home;
    let gr = ctx.createLinearGradient(0, 0, 0, 640);
    gr.addColorStop(0, '#07080d'); gr.addColorStop(0.35, '#141826'); gr.addColorStop(1, '#1d2235');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, 660);
    for (let i = 0; i < 6; i++) {
      const x = 130 + i * 270;
      const lg = ctx.createLinearGradient(x, 0, x, 600);
      lg.addColorStop(0, 'rgba(255,255,230,0.12)'); lg.addColorStop(1, 'rgba(255,255,230,0)');
      ctx.fillStyle = lg;
      ctx.beginPath(); ctx.moveTo(x - 10, 0); ctx.lineTo(x + 10, 0); ctx.lineTo(x + 140, 640); ctx.lineTo(x - 140, 640); ctx.fill();
      ctx.fillStyle = '#fffbe0'; ctx.beginPath(); ctx.arc(x, 18, 7, 0, 7); ctx.fill();
    }
    for (let i = 0; i < 4; i++) {
      const x = [330, 410, 1140, 1220][i];
      ctx.beginPath(); ctx.moveTo(x, 40); ctx.lineTo(x + 50, 40); ctx.lineTo(x + 50, 130); ctx.lineTo(x + 25, 115); ctx.lineTo(x, 130); ctx.closePath();
      fillOut(ctx, i % 2 ? home.c1 : home.c2, 3);
      ctx.fillStyle = trimFor(home); ctx.font = 'bold 14px Arial'; ctx.textAlign = 'center';
      ctx.fillText(String([2008, 2016, 2020, 2024][i]), x + 25, 85);
    }
    for (let r = 0; r < 10; r++) {
      ctx.fillStyle = r % 2 ? shade(home.c1, -0.25) : shade(home.c1, -0.32);
      ctx.fillRect(0, 190 + r * 40, W, 40);
    }
    ctx.fillStyle = '#05060a'; ctx.fillRect(0, 588, W, 66);
    gr = ctx.createLinearGradient(0, 650, 0, H);
    gr.addColorStop(0, '#b97a43'); gr.addColorStop(0.5, '#d89a5c'); gr.addColorStop(1, '#e3ab6c');
    ctx.fillStyle = gr; ctx.fillRect(0, 650, W, H - 650);
    this.planks(ctx, 'rgba(90,50,20,0.22)');
    gr = ctx.createRadialGradient(W / 2, 760, 50, W / 2, 760, 700);
    gr.addColorStop(0, 'rgba(255,255,255,0.2)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gr; ctx.fillRect(0, 650, W, 250);
    this.paint = { color: home.c1, alpha: 0.85, line: '#ffffffdd', logo: true };
  }

  bgStreet(ctx) {
    let gr = ctx.createLinearGradient(0, 0, 0, 600);
    gr.addColorStop(0, '#2a1d4f'); gr.addColorStop(0.55, '#c2477a'); gr.addColorStop(1, '#ffb15c');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, 660);
    ctx.fillStyle = 'rgba(255,230,150,0.9)'; ctx.beginPath(); ctx.arc(1180, 330, 70, 0, 7); ctx.fill();
    let x = 0;
    while (x < W) {
      const w = rnd(60, 140), h = rnd(160, 380);
      ctx.fillStyle = '#1c1530'; ctx.fillRect(x, 560 - h, w, h + 10);
      ctx.fillStyle = 'rgba(255,214,120,0.75)';
      for (let wy = 560 - h + 14; wy < 540; wy += 22) for (let wx = x + 8; wx < x + w - 10; wx += 18) if (Math.random() < 0.35) ctx.fillRect(wx, wy, 8, 10);
      x += w + rnd(0, 12);
    }
    ctx.fillStyle = '#5b4a5e'; ctx.fillRect(0, 520, W, 140);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2;
    for (let y = 540; y < 660; y += 24) for (let bx = (y / 24) % 2 ? 0 : 30; bx < W; bx += 60) ctx.strokeRect(bx, y, 60, 24);
    ctx.font = '900 70px "Arial Black", Impact, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.save(); ctx.translate(W / 2, 590); ctx.rotate(-0.04);
    outlinedText(ctx, this.home.abbr + ' STREET', 0, 0, this.home.c2 === '#FFFFFF' ? '#ffd23f' : this.home.c2, 10);
    ctx.restore();
    ctx.font = '900 46px "Arial Black", Impact, sans-serif';
    outlinedText(ctx, 'BALL!', 260, 585, '#4fd1ff', 8);
    outlinedText(ctx, 'STARS', 1340, 585, '#ff5aa8', 8);
    ctx.strokeStyle = 'rgba(220,220,230,0.35)'; ctx.lineWidth = 2;
    for (let fx = -400; fx < W + 400; fx += 26) { ctx.beginPath(); ctx.moveTo(fx, 380); ctx.lineTo(fx + 280, 660); ctx.moveTo(fx + 280, 380); ctx.lineTo(fx, 660); ctx.stroke(); }
    ctx.fillStyle = '#888'; for (let fx = 0; fx <= W; fx += 200) ctx.fillRect(fx - 4, 370, 8, 290);
    ctx.fillRect(0, 370, W, 6);
    gr = ctx.createLinearGradient(0, 650, 0, H);
    gr.addColorStop(0, '#3a4150'); gr.addColorStop(1, '#4b5262');
    ctx.fillStyle = gr; ctx.fillRect(0, 650, W, H - 650);
    for (let i = 0; i < 900; i++) { ctx.fillStyle = `rgba(255,255,255,${rnd(0.02, 0.07)})`; ctx.fillRect(rnd(0, W), rnd(652, H), 2, 2); }
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) { ctx.beginPath(); let cx = rnd(0, W), cy = rnd(680, 880); ctx.moveTo(cx, cy); for (let k = 0; k < 5; k++) { cx += rnd(-30, 30); cy += rnd(-8, 8); ctx.lineTo(cx, cy); } ctx.stroke(); }
    this.paint = { color: '#c0392b', alpha: 0.75, line: '#f4f1e6', logo: false };
  }

  bgBeach(ctx) {
    let gr = ctx.createLinearGradient(0, 0, 0, 520);
    gr.addColorStop(0, '#3aa7f0'); gr.addColorStop(1, '#bfe8ff');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, 520);
    ctx.fillStyle = '#fff6b0'; ctx.beginPath(); ctx.arc(300, 140, 62, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    for (const [cx, cy] of [[600, 120], [1100, 90], [1380, 170]]) for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(cx + k * 34, cy + (k % 2) * 8, 30, 0, 7); ctx.fill(); }
    gr = ctx.createLinearGradient(0, 470, 0, 560);
    gr.addColorStop(0, '#137fc4'); gr.addColorStop(1, '#36b8d8');
    ctx.fillStyle = gr; ctx.fillRect(0, 470, W, 100);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 3;
    for (let y = 490; y < 565; y += 18) { ctx.beginPath(); for (let x = 0; x <= W; x += 20) ctx.lineTo(x, y + Math.sin(x * 0.03 + y) * 3); ctx.stroke(); }
    ctx.fillStyle = '#f2d59a'; ctx.fillRect(0, 560, W, 100);
    for (const px of [70, 1530]) {
      ctx.lineCap = 'round';
      ctx.strokeStyle = OUT; ctx.lineWidth = 26; ctx.beginPath(); ctx.moveTo(px, 660); ctx.quadraticCurveTo(px + 40, 450, px + 10, 260); ctx.stroke();
      ctx.strokeStyle = '#9b6a3a'; ctx.lineWidth = 18; ctx.stroke();
      for (let k = 0; k < 6; k++) {
        const a = -Math.PI / 2 + (k - 2.5) * 0.55;
        ctx.beginPath(); ctx.moveTo(px + 10, 260); ctx.quadraticCurveTo(px + 10 + Math.cos(a) * 80, 260 + Math.sin(a) * 60 - 30, px + 10 + Math.cos(a) * 150, 260 + Math.sin(a) * 40 + 50);
        ctx.strokeStyle = OUT; ctx.lineWidth = 22; ctx.stroke(); ctx.strokeStyle = '#2f9d4a'; ctx.lineWidth = 15; ctx.stroke();
      }
    }
    gr = ctx.createLinearGradient(0, 650, 0, H);
    gr.addColorStop(0, '#2b8fd6'); gr.addColorStop(1, '#3aa6ea');
    ctx.fillStyle = gr; ctx.fillRect(0, 650, W, H - 650);
    this.planks(ctx, 'rgba(0,40,90,0.18)');
    this.paint = { color: '#ffb84d', alpha: 0.85, line: '#ffffff', logo: true };
  }

  planks(ctx, color) {
    ctx.strokeStyle = color; ctx.lineWidth = 1;
    for (let k = 0, y = 652; y < H; k++) { y += 6 + k * 1.2; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    for (let i = 0; i < 70; i++) {
      const y = rnd(655, H), x = rnd(0, W);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 6 + (y - 650) * 0.04); ctx.stroke();
    }
  }

  courtLines(ctx) {
    const home = this.home, pt = this.paint;
    ctx.strokeStyle = pt.line; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(40, 668); ctx.lineTo(W - 40, 668); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(10, 880); ctx.lineTo(W - 10, 880); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(40, 668); ctx.lineTo(10, 880); ctx.moveTo(W - 40, 668); ctx.lineTo(W - 10, 880); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W / 2, 668); ctx.lineTo(W / 2, 880); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(W / 2, 774, 118, 44, 0, 0, 7);
    if (pt.logo) {
      ctx.fillStyle = home.c1; ctx.fill(); ctx.stroke();
      ctx.fillStyle = home.c2; ctx.beginPath(); ctx.ellipse(W / 2, 774, 92, 33, 0, 0, 7); ctx.fill();
      ctx.save(); ctx.translate(W / 2, 774); ctx.scale(1, 0.42);
      ctx.fillStyle = home.c1; ctx.font = '900 82px "Arial Black", Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(home.abbr, 0, 4); ctx.restore();
    } else ctx.stroke();
    for (const hp of HOOPS) {
      const base = hp.x + hp.dir * 70, ftx = hp.x - hp.dir * 300;
      ctx.fillStyle = pt.color; ctx.globalAlpha = pt.alpha;
      ctx.beginPath(); ctx.moveTo(base, 705); ctx.lineTo(ftx, 705); ctx.lineTo(ftx, 845); ctx.lineTo(base + hp.dir * 8, 845); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(ftx, 775, 58, 70, 0, hp.dir > 0 ? Math.PI / 2 : -Math.PI / 2, hp.dir > 0 ? Math.PI * 1.5 : Math.PI / 2); ctx.stroke();
      ctx.beginPath();
      const a0 = hp.dir > 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
      ctx.ellipse(hp.x, 770, THREE_DIST + 18, 120, 0, a0, a0 + Math.PI);
      ctx.save(); ctx.clip(new Path2D(`M0 668 L${W} 668 L${W} 880 L0 880 Z`)); ctx.stroke(); ctx.restore();
    }
  }

  stanchions(ctx) {
    const street = this.court === 'street';
    for (const hp of HOOPS) {
      const px = hp.board + hp.dir * 48;
      rrect(ctx, px - 13, 300, 26, FLOOR - 290, 6); fillOut(ctx, street ? '#2d6a4f' : '#2a2f3a', 4);
      rrect(ctx, px - 40, 760, 80, 100, 12); fillOut(ctx, street ? '#5a5f6b' : this.home.c1, 4);
      if (!street) { ctx.fillStyle = '#fff'; ctx.font = 'bold 16px Arial'; ctx.textAlign = 'center'; ctx.fillText(this.home.abbr, px, 815); }
      ctx.lineCap = 'round';
      ctx.strokeStyle = OUT; ctx.lineWidth = 18; ctx.beginPath(); ctx.moveTo(px, 330); ctx.lineTo(hp.board, 400); ctx.stroke();
      ctx.strokeStyle = '#3a404d'; ctx.lineWidth = 10; ctx.stroke();
    }
  }

  // ---------------------------------------------------------------- frame
  render(dt) {
    const g = this.game, ctx = this.ctx;
    this.t += dt;
    this.cheer = Math.max(0.25, this.cheer - dt * 0.45);
    setCrowd(this.meta.mute ? 0 : (this.court === 'arena' ? 0.4 : 0.15) + this.cheer * 0.5);
    for (let i = 0; i < 2; i++) {
      this.net[i] = Math.max(0, this.net[i] - dt * 1.4);
      this.rimWob[i] = Math.max(0, this.rimWob[i] - dt * 3);
      this.boardCrack[i] = Math.max(0, this.boardCrack[i] - dt * 0.4);
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#05060a';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    let sx = 0, sy = 0;
    if (this.shake > 0.1) { sx = rnd(-1, 1) * this.shake; sy = rnd(-1, 1) * this.shake; this.shake *= Math.pow(0.02, dt); } else this.shake = 0;
    ctx.setTransform(this.scale, 0, 0, this.scale, this.ox + sx * this.scale, this.oy + sy * this.scale);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();

    ctx.drawImage(this.bg, 0, 0);
    this.drawCrowd(ctx);
    if (this.court === 'arena') this.drawAdBoard(ctx);
    for (const pu of g.powerups) this.drawCard(ctx, pu);

    for (let h = 0; h < 2; h++) this.drawHoopBack(ctx, h);
    const order = [...g.players].sort((a, b) => a.lane - b.lane);
    for (const p of order) this.drawShadow(ctx, p);
    this.drawBallShadow(ctx);
    this.drawRings(ctx, dt);
    const ballLane = g.ball.state === 'held' ? g.players[g.ball.holder].lane : 0;
    let ballDrawn = false;
    for (const p of order) {
      if (p.lane > ballLane && !ballDrawn) { this.drawBall(ctx); ballDrawn = true; }
      this.drawPlayer(ctx, p);
    }
    if (!ballDrawn) this.drawBall(ctx);
    for (let h = 0; h < 2; h++) this.drawHoopFront(ctx, h);

    this.updateParticles(ctx, dt);
    this.drawBursts(ctx, dt);
    for (const p of g.players) if (p.state === 'shoot') this.drawMeter(ctx, p);
    this.drawPopups(ctx, dt);
    if (this.flash > 0) { ctx.fillStyle = `rgba(255,250,220,${this.flash * 0.6})`; ctx.fillRect(0, 0, W, H); this.flash = Math.max(0, this.flash - dt * 3); }
    if (!this.meta.noHud) this.drawHUD(ctx);
    ctx.restore();
  }

  drawCrowd(ctx) {
    const t = this.t, ex = this.cheer;
    for (const f of this.fans) {
      const bob = Math.max(0, Math.sin(t * f.sp + f.ph)) * (1.5 + ex * 5) * f.sc;
      const y = f.y - bob, s = f.sc;
      ctx.fillStyle = f.shirt;
      rrect(ctx, f.x - 9 * s, y - 4 * s, 18 * s, 26 * s, 5 * s); ctx.fill();
      if (s > 1.2) { ctx.lineWidth = 2.5; ctx.strokeStyle = OUT; ctx.stroke(); }
      ctx.fillStyle = f.skin;
      ctx.beginPath(); ctx.arc(f.x, y - 11 * s, 7.5 * s, 0, 7); ctx.fill();
      if (s > 1.2) { ctx.lineWidth = 2.5; ctx.stroke(); if (f.hair) { ctx.fillStyle = '#2a1a10'; ctx.beginPath(); ctx.arc(f.x, y - 12 * s, 7.5 * s, Math.PI, 0); ctx.fill(); } }
      if (f.hat) { ctx.fillStyle = f.shirt; ctx.fillRect(f.x - 8 * s, y - 19 * s, 16 * s, 5 * s); }
      if (ex > 1.1 && Math.sin(f.ph * 7) > 0.3) {
        ctx.strokeStyle = f.skin; ctx.lineWidth = 3 * s;
        ctx.beginPath(); ctx.moveTo(f.x - 8 * s, y); ctx.lineTo(f.x - 12 * s, y - 22 * s);
        ctx.moveTo(f.x + 8 * s, y); ctx.lineTo(f.x + 12 * s, y - 22 * s); ctx.stroke();
      }
    }
    if (this.court === 'arena') { ctx.fillStyle = '#0b0d14'; ctx.fillRect(0, 572, W, 18); }
  }

  drawAdBoard(ctx) {
    const home = this.home;
    const msg = `  ${home.city.toUpperCase()} ${home.name.toUpperCase()}  ★  BASKETBALL STARS 26-27  ★  NBA SEASON 2026-27  ★`;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 592, W, 58); ctx.clip();
    const gr = ctx.createLinearGradient(0, 592, 0, 650);
    gr.addColorStop(0, shade(home.c1, 0.05)); gr.addColorStop(1, shade(home.c1, -0.2));
    ctx.fillStyle = gr; ctx.fillRect(0, 592, W, 58);
    ctx.font = '900 34px "Arial Black", Arial'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillStyle = trimFor(home);
    const wMsg = ctx.measureText(msg).width;
    let x = -((this.t * 90) % wMsg);
    while (x < W) { ctx.fillText(msg, x, 622); x += wMsg; }
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let i = 0; i < 58; i += 3) ctx.fillRect(0, 592 + i, W, 1);
    ctx.restore();
  }

  drawHoopBack(ctx, h) {
    const hp = HOOPS[h], w = this.rimWob[h] * Math.sin(this.t * 50) * 3;
    const street = this.court === 'street';
    ctx.save();
    ctx.translate(hp.board, 0);
    ctx.beginPath();
    ctx.moveTo(-hp.dir * 6, BOARD_TOP); ctx.lineTo(hp.dir * 12, BOARD_TOP - 14);
    ctx.lineTo(hp.dir * 12, BOARD_BOT - 14); ctx.lineTo(-hp.dir * 6, BOARD_BOT); ctx.closePath();
    fillOut(ctx, street ? '#e9e9e9' : 'rgba(220,240,255,0.45)', 5);
    ctx.strokeStyle = '#ff5a36'; ctx.lineWidth = 3;
    ctx.strokeRect(Math.min(-hp.dir * 2, hp.dir * 6), hp.y - 70, 4, 52);
    if (this.boardCrack[h] > 0) {
      ctx.strokeStyle = `rgba(255,255,255,${this.boardCrack[h]})`; ctx.lineWidth = 1.5;
      for (let k = 0; k < 7; k++) { ctx.beginPath(); ctx.moveTo(hp.dir * 3, hp.y - 40); ctx.lineTo(hp.dir * 3 + Math.cos(k) * 10, hp.y - 40 + Math.sin(k * 2.3) * 70); ctx.stroke(); }
    }
    ctx.restore();
    ctx.strokeStyle = OUT; ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(hp.board, hp.y + 6); ctx.lineTo(hp.back, hp.y + w); ctx.stroke();
    ctx.strokeStyle = '#9aa0aa'; ctx.lineWidth = 5; ctx.stroke();
    ctx.strokeStyle = OUT; ctx.lineWidth = 9;
    ctx.beginPath(); ctx.ellipse(hp.x, hp.y + w, 38, 8, 0, Math.PI, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#ff6a1a'; ctx.lineWidth = 5; ctx.stroke();
    this.drawNet(ctx, h, true);
  }

  drawHoopFront(ctx, h) {
    const hp = HOOPS[h], w = this.rimWob[h] * Math.sin(this.t * 50) * 3;
    this.drawNet(ctx, h, false);
    ctx.strokeStyle = OUT; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.ellipse(hp.x, hp.y + w, 38, 8, 0, 0, Math.PI); ctx.stroke();
    ctx.strokeStyle = '#ff7a2a'; ctx.lineWidth = 5.5; ctx.stroke();
  }

  drawNet(ctx, h, back) {
    const hp = HOOPS[h], n = this.net[h];
    const len = 56 + n * 22, sway = Math.sin(this.t * 22) * n * 8;
    const chain = this.court === 'street';
    ctx.strokeStyle = chain ? (back ? 'rgba(170,170,180,0.5)' : '#b8bcc6') : back ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.95)';
    ctx.lineWidth = chain ? 3 : 2.2;
    if (chain) ctx.setLineDash([4, 3]);
    const N = 8;
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI;
      const ang = back ? Math.PI + a : a;
      const x0 = hp.x + Math.cos(ang) * 38, y0 = hp.y + Math.sin(ang) * 8;
      const x1 = hp.x + Math.cos(ang) * 22 + sway, y1 = hp.y + len + Math.sin(ang) * 5;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2 - sway * 0.5, (y0 + y1) / 2, x1, y1); ctx.stroke();
    }
    if (!chain) for (let k = 1; k <= 3; k++) {
      const f = k / 3.4, rx = 38 - 16 * f, y = hp.y + len * f;
      ctx.beginPath(); ctx.ellipse(hp.x + sway * f, y, rx, 7 - f * 2, 0, back ? Math.PI : 0, back ? Math.PI * 2 : Math.PI); ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  laneOf(p) { return { dy: p.lane * 16, s: 1 + p.lane * 0.04 }; }

  drawShadow(ctx, p) {
    const { dy, s } = this.laneOf(p);
    const k = clamp(1 - (FLOOR - p.y) / 500, 0.35, 1);
    const wide = LYING(p.state) && p.ground ? 1.9 : 1;
    ctx.fillStyle = `rgba(0,0,0,${0.32 * k})`;
    ctx.beginPath(); ctx.ellipse(p.x - (wide > 1 ? p.face * 70 : 0), FLOOR + dy + 4, 46 * k * s * wide, 11 * k * s, 0, 0, 7); ctx.fill();
  }

  ballPos() {
    const g = this.game, b = g.ball;
    const h = b.state === 'held' ? g.players[b.holder] : null;
    if (h) {
      // Keep the ball in the hands while a Mega Dunk scales the player up.
      const k = h.dk && h.dk.mega && h.state === 'dunk' ? 1 + 0.35 * Math.sin(Math.PI * clamp(h.st / (h.dk.T || 1), 0, 1)) : 1;
      return { x: h.x + (b.x - h.x) * k, y: h.y + (b.y - h.y) * k + this.laneOf(h).dy };
    }
    return { x: b.x, y: b.y };
  }

  drawBallShadow(ctx) {
    const { x, y } = this.ballPos();
    const k = clamp(1 - (FLOOR - y) / 600, 0.25, 1);
    ctx.fillStyle = `rgba(0,0,0,${0.35 * k})`;
    ctx.beginPath(); ctx.ellipse(x, FLOOR + 4, 18 * k, 5 * k, 0, 0, 7); ctx.fill();
  }

  drawBall(ctx) {
    const g = this.game, b = g.ball;
    const { x, y } = this.ballPos();
    const holder = b.state === 'held' ? g.players[b.holder] : null;
    const fire = b.fire || (holder && holder.superShot);
    if (fire) for (let k = 0; k < 2; k++) this.particles.push({ kind: 'flame', x: x + rnd(-10, 10), y: y + rnd(-10, 10), vx: rnd(-30, 30) - b.vx * 0.1, vy: rnd(-140, -60), life: rnd(0.25, 0.5), c: Math.random() < 0.5 ? '#ffb020' : '#ff4a1a', r: rnd(6, 12) });
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath(); ctx.arc(0, 0, BALL_R + 2.5, 0, 7); ctx.fillStyle = OUT; ctx.fill();
    const gr = ctx.createRadialGradient(-6, -6, 2, 0, 0, BALL_R);
    gr.addColorStop(0, fire ? '#fff3a0' : '#ffb067'); gr.addColorStop(1, fire ? '#ff6a00' : '#d8561a');
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.arc(0, 0, BALL_R, 0, 7); ctx.fill();
    ctx.rotate(b.spin);
    ctx.strokeStyle = 'rgba(40,15,5,0.9)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-BALL_R, 0); ctx.lineTo(BALL_R, 0); ctx.moveTo(0, -BALL_R); ctx.lineTo(0, BALL_R); ctx.stroke();
    ctx.beginPath(); ctx.arc(-BALL_R * 1.25, 0, BALL_R * 0.95, -0.9, 0.9); ctx.stroke();
    ctx.beginPath(); ctx.arc(BALL_R * 1.25, 0, BALL_R * 0.95, Math.PI - 0.9, Math.PI + 0.9); ctx.stroke();
    ctx.restore();
  }

  // Action cards floating on court.
  drawCard(ctx, pu) {
    const bob = Math.sin(this.t * 4 + pu.id) * 6;
    if (pu.t < 2 && Math.floor(this.t * 8) % 2 === 0) return;
    const info = PU[pu.kind];
    ctx.save();
    ctx.translate(pu.x, pu.y + bob);
    ctx.rotate(Math.sin(this.t * 2 + pu.id) * 0.1);
    ctx.shadowColor = info.c; ctx.shadowBlur = 24;
    rrect(ctx, -30, -40, 60, 80, 10); fillOut(ctx, '#fffaf0', 4);
    ctx.shadowBlur = 0;
    rrect(ctx, -24, -34, 48, 50, 7); ctx.fillStyle = info.c; ctx.fill();
    ctx.font = `30px ${EMOJI_FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(info.icon, 0, -8);
    ctx.font = '900 9px "Arial Black", Arial'; ctx.fillStyle = OUT;
    ctx.fillText(info.label, 0, 28);
    ctx.restore();
  }

  drawRings(ctx, dt) {
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.t += dt;
      if (r.t > 0.8) { this.rings.splice(i, 1); continue; }
      if (r.t < 0) continue;
      const k = r.t / 0.8;
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = r.c; ctx.lineWidth = 14 * (1 - k) + 2;
      ctx.beginPath(); ctx.ellipse(r.x, r.y, 40 + k * 420, 14 + k * 70, 0, 0, 7); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  // ---------------------------------------------------------------- players
  drawPlayer(ctx, p) {
    const g = this.game, team = TEAM[p.team];
    const { dy, s: ls } = this.laneOf(p);
    let sc = ls * p.h;
    const has = g.ball.state === 'held' && g.ball.holder === p.i;
    const st = p.state;
    const air = !p.ground;
    const moving = Math.abs(p.vx) > 30 && p.ground;
    const a = p.anim * Math.PI * 2;
    const skin = SKIN[p.skin], skinD = SKIN_SHADE[p.skin];
    const trim = trimFor(team);
    const celebrate = (g.phase === 'over' && p.mood > 0) || (g.phase === 'score' && p.mood > 0 && st === 'move');
    const mega = p.dk && p.dk.mega && st === 'dunk';
    const lying = LYING(st);

    if (mega) {
      const s = clamp(p.st / (p.dk.T || 1), 0, 1);
      sc *= 1 + 0.35 * Math.sin(Math.PI * s);
      for (let k = 0; k < 3; k++) this.particles.push({ kind: 'flame', x: p.x + rnd(-30, 30), y: p.y + dy - rnd(20, 200), vx: -p.vx * 0.15, vy: rnd(-60, 40), life: rnd(0.3, 0.6), c: Math.random() < 0.5 ? '#ffd23f' : '#ff7a1a', r: rnd(7, 14) });
    }
    if (p.nitro && Math.random() < 0.8) {
      this.particles.push({ kind: 'flame', x: p.x - p.face * 18, y: p.y + dy - rnd(0, 14), vx: -p.vx * 0.4, vy: rnd(-60, -10), life: 0.3, c: Math.random() < 0.5 ? '#4fd1ff' : '#a8f0ff', r: rnd(5, 9) });
      if (Math.random() < 0.5) this.particles.push({ kind: 'streak', x: p.x - p.face * 40, y: p.y + dy - rnd(30, 200) * sc, vx: -p.vx * 0.3, vy: 0, life: 0.2, c: 'rgba(255,255,255,0.7)' });
    }
    if (p.fx.speed > 0 && moving && Math.random() < 0.5) {
      this.particles.push({ kind: 'streak', x: p.x - p.face * 30, y: p.y + dy - rnd(30, 150) * sc, vx: -p.vx * 0.3, vy: 0, life: 0.25, c: '#ffe14d' });
    }

    if (p.iron > 0) this.drawShield(ctx, p, dy, sc, false);

    ctx.save();
    ctx.translate(p.x, p.y + dy);
    if (lying) {
      // Knocked flat: rotate the whole body onto its back.
      const k = st === 'getup' ? clamp(p.st / 0.3, 0, 1) : clamp((1.15 - p.st) / 0.3, 0, 1);
      ctx.rotate(-p.face * (Math.PI / 2) * k);
      ctx.translate(0, -8 * k);
    } else {
      let tilt = 0;
      if (st === 'stumble') tilt = -0.5 * Math.sin(Math.min(1, (1 - p.st) * 3) * Math.PI / 2) * p.face;
      else if (moving) tilt = (p.nitro ? 0.16 : 0.08) * Math.sign(p.vx);
      if (st === 'cross') tilt = 0.18 * p.crossDir;
      if (st === 'punch') tilt = 0.12 * p.face;
      ctx.rotate(tilt);
    }
    ctx.scale(sc * p.face, sc);

    // ----- pose
    const hip = { x: 0, y: -66 };
    const shoulder = { x: 4, y: -128 };
    let legA, legB;
    if (lying) { legA = [0.35, 0.5]; legB = [-0.1, 0.3]; }
    else if (st === 'hang') { legA = [0.2, 0.3]; legB = [-0.1, 0.4]; }
    else if (air) { legA = [0.6, 1.2]; legB = [-0.25, 0.8]; }
    else if (st === 'stumble') { legA = [0.6, 0.2]; legB = [-0.7, 0.3]; }
    else if (st === 'punch') { legA = [0.45, 0.25]; legB = [-0.45, 0.15]; }
    else if (moving) { const k = Math.sin(a); legA = [k * 0.75, Math.max(0, -Math.cos(a)) * 0.9 + 0.15]; legB = [-k * 0.75, Math.max(0, Math.cos(a)) * 0.9 + 0.15]; }
    else { legA = [0.18, 0.3]; legB = [-0.18, 0.3]; }

    const ballLocal = has ? { x: (g.ball.x - p.x) * p.face / sc, y: (g.ball.y - p.y) / sc } : null;
    let handF, handB, punchArm = false;
    const punchK = st === 'punch' ? clamp(1 - (p.st - 0.09) / 0.12, 0, 1) : 0;
    if (lying) { handF = { x: 40, y: -150 }; handB = { x: -40, y: -140 }; }
    else if (st === 'hang') { handF = { x: 30, y: -205 }; handB = { x: 18, y: -205 }; }
    else if (st === 'dunk' || st === 'layup') { handF = { x: 30, y: -205 }; handB = { x: -24, y: -120 }; }
    else if (st === 'shoot' || (has && air)) { handF = { x: 16, y: -200 }; handB = { x: 4, y: -194 }; }
    else if (air && !has) { handF = { x: 16, y: -205 }; handB = { x: -6, y: -204 }; }
    else if (st === 'punch') { handF = { x: 20 + 60 * punchK, y: -126 }; handB = { x: -20, y: -112 }; punchArm = punchK > 0.6; }
    else if (st === 'whiff') { handF = { x: 70, y: -100 }; handB = { x: -30, y: -150 }; }
    else if (st === 'stumble') { handF = { x: 40, y: -190 + Math.sin(this.t * 25) * 14 }; handB = { x: -50, y: -175 }; }
    else if (celebrate) { const k = Math.sin(this.t * 10) * 10; handF = { x: 20, y: -205 + k }; handB = { x: -16, y: -205 - k }; }
    else if (has && ballLocal) { handF = { x: ballLocal.x, y: Math.min(ballLocal.y - 14, -70) }; handB = { x: -16, y: -90 }; }
    else if (moving) { const k = Math.sin(a); handF = { x: -k * 30 + 8, y: -80 }; handB = { x: k * 30 - 6, y: -82 }; }
    else { handF = { x: 36, y: -104 }; handB = { x: -24, y: -100 }; } // defensive stance

    this.leg(ctx, hip, legB, team, skinD, true);
    this.arm(ctx, { x: shoulder.x - 10, y: shoulder.y + 3 }, handB, skinD, false);

    // shorts
    ctx.beginPath(); ctx.moveTo(-26, -90); ctx.lineTo(30, -90); ctx.lineTo(32, -54); ctx.lineTo(6, -54); ctx.lineTo(3, -62); ctx.lineTo(0, -54); ctx.lineTo(-28, -54); ctx.closePath();
    fillOut(ctx, shade(team.c1, -0.03), 5);
    ctx.fillStyle = trim; ctx.fillRect(25, -88, 5, 32);

    // jersey (tank top)
    ctx.beginPath();
    ctx.moveTo(-22, -140); ctx.quadraticCurveTo(-10, -126, 4, -128); ctx.quadraticCurveTo(16, -126, 24, -140);
    ctx.lineTo(30, -132); ctx.quadraticCurveTo(26, -116, 30, -100); ctx.lineTo(30, -84); ctx.lineTo(-26, -84); ctx.lineTo(-26, -100);
    ctx.quadraticCurveTo(-22, -116, -28, -132); ctx.closePath();
    fillOut(ctx, team.c1, 5);
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(-25, -100, 13, 15);
    ctx.strokeStyle = trim; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-18, -137); ctx.quadraticCurveTo(-8, -124, 4, -125); ctx.quadraticCurveTo(14, -124, 21, -137); ctx.stroke();
    ctx.save(); ctx.scale(p.face, 1);
    ctx.font = '900 25px "Arial Black", Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    outlinedText(ctx, String(p.num), p.face * 2, -106, trim, 5);
    ctx.restore();

    this.leg(ctx, hip, legA, team, skin, false);

    // Raised arms go behind the big head so they don't cover the face.
    const raised = handF.y < -150 && !lying;
    if (raised) this.arm(ctx, shoulder, handF, skin, false);
    const big = p.fx.big > 0 ? 1.4 : 1;
    ctx.save();
    ctx.translate(6, -176);
    ctx.scale(big, big);
    this.head(ctx, p, skin, skinD, team, celebrate);
    ctx.restore();

    if (!raised) this.arm(ctx, shoulder, handF, skin, punchArm);
    if (punchArm) {
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 3;
      for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(handF.x - 28 - k * 6, handF.y - 12 + k * 12); ctx.lineTo(handF.x - 52 - k * 6, handF.y - 12 + k * 12); ctx.stroke(); }
    }

    if (p.fx.frozen > 0) {
      ctx.fillStyle = 'rgba(160,230,255,0.5)'; ctx.strokeStyle = 'rgba(230,252,255,0.95)'; ctx.lineWidth = 4;
      rrect(ctx, -58, -238, 116, 244, 16); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-40, -220); ctx.lineTo(-20, -190); ctx.moveTo(30, -60); ctx.lineTo(44, -30); ctx.stroke();
    }
    ctx.restore();

    if (p.iron > 0) this.drawShield(ctx, p, dy, sc, true);

    // dizzy stars
    if (lying || st === 'stumble') {
      const hx = lying ? p.x - p.face * 175 * sc : p.x, hy = lying ? p.y + dy - 50 : p.y + dy - 245 * sc;
      for (let k = 0; k < 3; k++) {
        const an = this.t * 6 + (k * Math.PI * 2) / 3;
        star(ctx, hx + Math.cos(an) * 36, hy + Math.sin(an) * 10, 9, 4, 5, an);
        fillOut(ctx, '#ffe14d', 2.5);
      }
    }

    if (lying) return;
    const topY = p.y + dy - (232 * sc + 34 + (p.fx.big > 0 ? 40 : 0));
    const tag = this.meta.tags[p.i];
    if (tag) {
      ctx.beginPath(); ctx.moveTo(p.x - 11, topY - 4); ctx.lineTo(p.x + 11, topY - 4); ctx.lineTo(p.x, topY + 9); ctx.closePath();
      fillOut(ctx, tag.color, 3);
      ctx.font = '900 18px "Arial Black", Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      outlinedText(ctx, tag.label, p.x, topY - 8, tag.color, 5);
    }
    if (p.call > 0) {
      rrect(ctx, p.x + 22, topY - 54, 34, 30, 8); fillOut(ctx, '#fff', 3);
      ctx.fillStyle = '#e33'; ctx.font = '900 24px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('!', p.x + 39, topY - 39);
    }
  }

  drawShield(ctx, p, dy, sc, front) {
    const pulse = 1 + Math.sin(this.t * 8) * 0.03;
    const cx = p.x, cy = p.y + dy - 120 * sc, rx = 82 * sc * pulse, ry = 140 * sc * pulse;
    ctx.save();
    if (!front) {
      const gr = ctx.createRadialGradient(cx, cy, 20, cx, cy, ry);
      gr.addColorStop(0, 'rgba(80,180,255,0.05)'); gr.addColorStop(1, 'rgba(80,180,255,0.35)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, 7); ctx.fill();
    } else {
      ctx.strokeStyle = 'rgba(140,215,255,0.95)'; ctx.lineWidth = 5;
      ctx.shadowColor = '#4fb6ff'; ctx.shadowBlur = 18;
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, 7); ctx.stroke();
      ctx.shadowBlur = 0; ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(200,240,255,0.5)';
      for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.ellipse(cx, cy, Math.abs(rx * Math.cos(k * 0.45 + this.t)), ry, 0, 0, 7); ctx.stroke(); }
    }
    ctx.restore();
  }

  leg(ctx, hip, [ang, bend], team, skin, back) {
    const L1 = 32, L2 = 32;
    const kx = hip.x + Math.sin(ang) * L1, ky = hip.y + Math.cos(ang) * L1;
    const a2 = ang - bend;
    const fx = kx + Math.sin(a2) * L2, fy = ky + Math.cos(a2) * L2;
    limb(ctx, [hip, { x: kx, y: ky }, { x: fx, y: fy }], 15, skin);
    limb(ctx, [{ x: kx + (fx - kx) * 0.55, y: ky + (fy - ky) * 0.55 }, { x: fx, y: fy }], 15, back ? '#dcdcdc' : '#f6f6f6');
    ctx.strokeStyle = team.c1; ctx.lineWidth = 4;
    const sx = kx + (fx - kx) * 0.62, sy = ky + (fy - ky) * 0.62;
    ctx.beginPath(); ctx.moveTo(sx - 7, sy); ctx.lineTo(sx + 7, sy); ctx.stroke();
    const base = team.c2 === '#FFFFFF' ? '#333333' : team.c2;
    ctx.beginPath(); ctx.moveTo(fx - 12, fy - 9); ctx.quadraticCurveTo(fx + 4, fy - 14, fx + 14, fy - 5); ctx.quadraticCurveTo(fx + 26, fy - 3, fx + 26, fy + 4);
    ctx.lineTo(fx + 26, fy + 8); ctx.lineTo(fx - 13, fy + 8); ctx.closePath();
    fillOut(ctx, back ? shade(base, -0.12) : base, 4);
    ctx.fillStyle = '#fff'; ctx.fillRect(fx - 12, fy + 3, 37, 4);
  }

  arm(ctx, s, h, skin, fist) {
    const L = 34;
    let dx = h.x - s.x, dy = h.y - s.y;
    let d = Math.hypot(dx, dy) || 1;
    if (d > L * 2) { dx *= (L * 2) / d; dy *= (L * 2) / d; d = L * 2; }
    const hx = s.x + dx, hy = s.y + dy;
    const k = Math.sqrt(Math.max(0, L * L - (d / 2) * (d / 2)));
    const ex = s.x + dx / 2 + (dy / d) * k, ey = s.y + dy / 2 - (dx / d) * k;
    limb(ctx, [s, { x: ex, y: ey }, { x: hx, y: hy }], 13, skin);
    ctx.beginPath(); ctx.arc(hx, hy, fist ? 12 : 9, 0, 7); fillOut(ctx, skin, 4);
  }

  head(ctx, p, skin, skinD, team, celebrate) {
    const R = 46;
    const hairC = p.skin === 0 ? '#6b4426' : '#1a120d';
    const st = p.state;
    const lying = LYING(st);
    if (p.hair === 'dreads' || p.hair === 'braids') {
      for (let i = 0; i < 5; i++) {
        ctx.beginPath(); ctx.moveTo(-20 - i * 5, -24 + i * 8); ctx.quadraticCurveTo(-46, 6 + i * 5, -40 + i * 2, 40 + i * 4);
        ctx.lineCap = 'round'; ctx.strokeStyle = OUT; ctx.lineWidth = p.hair === 'dreads' ? 14 : 10; ctx.stroke();
        ctx.strokeStyle = hairC; ctx.lineWidth = p.hair === 'dreads' ? 8 : 5; ctx.stroke();
      }
    }
    if (p.hair === 'long') { rrect(ctx, -50, -28, 46, 70, 18); fillOut(ctx, hairC, 4); }
    rrect(ctx, -11, 28, 24, 26, 6); fillOut(ctx, skinD, 4);
    ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); fillOut(ctx, skin, 5);
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, R - 2.5, 0, 7); ctx.clip();
    ctx.fillStyle = skinD; ctx.globalAlpha = 0.55; ctx.beginPath(); ctx.arc(-28, 14, R, 0, 7); ctx.fill(); ctx.restore();
    ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.ellipse(-12, 6, 9, 12, 0, 0, 7); fillOut(ctx, skin, 4);
    ctx.fillStyle = skinD; ctx.beginPath(); ctx.ellipse(-12, 6, 4, 6, 0, 0, 7); ctx.fill();
    if (p.hair === 'short' || p.hair === 'braids' || p.hair === 'dreads' || p.hair === 'long') {
      ctx.beginPath(); ctx.arc(0, 0, R + 2, Math.PI * 1.02, Math.PI * 1.97); ctx.quadraticCurveTo(20, -22, -2, -18); ctx.quadraticCurveTo(-20, -12, -30, 6); ctx.quadraticCurveTo(-44, 4, -47, -6); ctx.closePath();
      fillOut(ctx, hairC, 4);
      if (p.hair === 'braids') { ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 2; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(-30 + i * 9, -30); ctx.lineTo(-6 + i * 11, -44); ctx.stroke(); } }
    } else if (p.hair === 'buzz') {
      ctx.globalAlpha = 0.6;
      ctx.beginPath(); ctx.arc(0, 0, R, Math.PI * 1.05, Math.PI * 1.95); ctx.quadraticCurveTo(16, -26, -26, -14); ctx.closePath(); ctx.fillStyle = hairC; ctx.fill();
      ctx.globalAlpha = 1;
    } else if (p.hair === 'curly') {
      for (let i = 0; i < 9; i++) { const an = Math.PI * (0.95 + i / 8.4); ctx.beginPath(); ctx.arc(Math.cos(an) * (R - 3), Math.sin(an) * (R - 3) - 3, 13, 0, 7); fillOut(ctx, hairC, 3.5); }
    } else if (p.hair === 'bald') {
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(10, -30, 13, 6, -0.3, 0, 7); ctx.fill();
    }
    if (p.iron > 0) { rrect(ctx, -R + 2, -26, R * 2 - 4, 11, 4); fillOut(ctx, '#4fb6ff', 3); }
    else if (p.nitro || p.fx.speed > 0) { rrect(ctx, -R + 2, -26, R * 2 - 4, 11, 4); fillOut(ctx, team.c2, 3); }
    if (p.beard) {
      ctx.beginPath(); ctx.moveTo(-8, 18); ctx.quadraticCurveTo(14, p.beard === 2 ? 62 : 50, R - 2, 16); ctx.lineTo(R - 8, 28); ctx.quadraticCurveTo(14, 38, 2, 22); ctx.closePath();
      ctx.globalAlpha = p.beard === 2 ? 1 : 0.85; fillOut(ctx, hairC, 3); ctx.globalAlpha = 1;
    }
    // eyes (3/4 view: near eye big, far eye narrower)
    const angry = st === 'dunk' || st === 'punch' || p.iron > 0 || p.nitro;
    const dizzy = lying || st === 'stumble';
    const eye = (ex, rx, ry) => {
      ctx.beginPath(); ctx.ellipse(ex, -6, rx, ry, 0, 0, 7); fillOut(ctx, '#fff', 3);
      if (dizzy) {
        ctx.strokeStyle = OUT; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(ex - 5, -11); ctx.lineTo(ex + 5, -1); ctx.moveTo(ex + 5, -11); ctx.lineTo(ex - 5, -1); ctx.stroke();
      } else {
        ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(ex + rx * 0.35, -5, Math.min(rx, ry) * 0.55, 0, 7); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex + rx * 0.5, -8, 2, 0, 7); ctx.fill();
      }
    };
    eye(20, 10, 12);
    eye(38, 6.5, 11);
    ctx.strokeStyle = hairC; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(10, angry ? -24 : -22); ctx.lineTo(28, angry ? -17 : -23); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(33, angry ? -18 : -23); ctx.lineTo(44, angry ? -23 : -21); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(R - 1, 8, 7, 8, 0, -Math.PI * 0.6, Math.PI * 0.8); fillOut(ctx, skin, 3);
    ctx.lineCap = 'round';
    const shout = celebrate || st === 'dunk' || st === 'hang' || st === 'punch' || p.mood > 0;
    if (shout) {
      ctx.beginPath(); ctx.moveTo(18, 22); ctx.quadraticCurveTo(30, 44, 42, 22); ctx.closePath(); fillOut(ctx, '#5a1a14', 3);
      ctx.fillStyle = '#fff'; ctx.fillRect(21, 22, 19, 5);
    } else if (p.mood < 0 || dizzy) {
      ctx.strokeStyle = OUT; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.arc(30, 36, 9, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
    } else {
      ctx.strokeStyle = OUT; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.moveTo(22, 26); ctx.quadraticCurveTo(31, 30, 40, 24); ctx.stroke();
    }
  }

  drawMeter(ctx, p) {
    const { dy } = this.laneOf(p);
    const x = p.x - p.face * 70, y0 = p.y + dy - 270, hgt = 130;
    const win = greenWindow(p);
    const max = 1.18;
    rrect(ctx, x - 13, y0 - 5, 26, hgt + 10, 9); fillOut(ctx, 'rgba(20,20,30,0.85)', 4);
    const toY = v => y0 + hgt - (v / max) * hgt;
    ctx.fillStyle = 'rgba(93,255,122,0.55)';
    ctx.fillRect(x - 8, toY(SWEET + win), 16, toY(SWEET - win) - toY(SWEET + win));
    const m = Math.min(p.meter, max);
    const err = Math.abs(m - SWEET);
    ctx.fillStyle = p.superShot ? '#ff7a1a' : err <= win ? '#5dff7a' : m < SWEET ? '#ffd23f' : '#ff5a5a';
    ctx.fillRect(x - 8, toY(m), 16, y0 + hgt - toY(m));
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(x - 8, toY(SWEET + win), 16, toY(SWEET - win) - toY(SWEET + win));
  }

  updateParticles(ctx, dt) {
    const ps = this.particles;
    for (let i = ps.length - 1; i >= 0; i--) {
      const q = ps[i];
      q.life -= dt;
      if (q.life <= 0) { ps.splice(i, 1); continue; }
      q.x += q.vx * dt; q.y += q.vy * dt;
      if (q.kind === 'spark' || q.kind === 'shard') q.vy += 700 * dt;
      if (q.kind === 'shard' && q.y > FLOOR) { q.y = FLOOR; q.vy *= -0.3; q.vx *= 0.6; }
      if (q.kind === 'confetti') { q.rot += dt * 6; q.vx += Math.sin(this.t * 3 + q.y * 0.01) * 10 * dt; }
      ctx.globalAlpha = Math.min(1, q.life * 2.5);
      ctx.fillStyle = q.c;
      if (q.kind === 'flame') { ctx.beginPath(); ctx.arc(q.x, q.y, q.r * Math.min(1, q.life * 3), 0, 7); ctx.fill(); }
      else if (q.kind === 'streak') ctx.fillRect(q.x - 20, q.y, 40, 3);
      else if (q.kind === 'confetti') { ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.fillRect(-5, -3, 10, 6); ctx.restore(); }
      else if (q.kind === 'shard') { q.rot += dt * 8; ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.beginPath(); ctx.moveTo(-q.r, 0); ctx.lineTo(0, -q.r * 0.6); ctx.lineTo(q.r, q.r * 0.4); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke(); ctx.restore(); }
      else { ctx.beginPath(); ctx.arc(q.x, q.y, 4, 0, 7); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
    if (ps.length > 1000) ps.splice(0, ps.length - 1000);
  }

  // Comic-book impact bursts for punches.
  drawBursts(ctx, dt) {
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.t += dt;
      if (b.t > 0.35) { this.bursts.splice(i, 1); continue; }
      const k = b.t / 0.35, s = 0.6 + k * 0.8;
      ctx.globalAlpha = 1 - k * 0.8;
      star(ctx, b.x, b.y, 58 * s, 26 * s, 10, b.rot);
      fillOut(ctx, '#ffe14d', 4);
      star(ctx, b.x, b.y, 32 * s, 15 * s, 10, b.rot + 0.3);
      ctx.fillStyle = '#ff5a2a'; ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  drawPopups(ctx, dt) {
    const draw = (list, life, rise) => {
      for (let i = list.length - 1; i >= 0; i--) {
        const q = list[i];
        q.t += dt;
        if (q.t > life) { list.splice(i, 1); continue; }
        const k = q.t / life;
        const pop = q.t < 0.12 ? 0.5 + (q.t / 0.12) * 0.7 : q.t < 0.22 ? 1.2 - ((q.t - 0.12) / 0.1) * 0.2 : 1;
        ctx.save();
        ctx.globalAlpha = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
        ctx.translate(clamp(q.x, 180, W - 180), q.y - k * rise);
        ctx.rotate(-0.04);
        ctx.scale(pop * (q.size || 1), pop * (q.size || 1));
        ctx.font = '900 44px "Arial Black", Impact, Arial';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 12; ctx.strokeStyle = OUT; ctx.lineJoin = 'round';
        ctx.strokeText(q.text, 0, 3);
        outlinedText(ctx, q.text, 0, 0, q.color, 7);
        ctx.restore();
      }
    };
    draw(this.popups, 1.4, 60);
    for (const l of this.labels) l.size = 0.5;
    draw(this.labels, 0.8, 40);
  }

  drawHUD(ctx) {
    const g = this.game;
    const tA = TEAM[g.cfg.teams[0]], tB = TEAM[g.cfg.teams[1]];
    const cx = W / 2, y = 12;
    // Two team score blocks with a clock pill between, Basketball Stars style.
    const block = (t, x, score, flip) => {
      rrect(ctx, x, y, 230, 78, 16); fillOut(ctx, t.c1, 5);
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; rrect(ctx, x + 5, y + 5, 220, 30, 12); ctx.fill();
      ctx.font = '900 26px "Arial Black", Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      outlinedText(ctx, t.abbr, flip ? x + 172 : x + 58, y + 40, trimFor(t), 6);
      ctx.font = '900 54px "Arial Black", Arial';
      outlinedText(ctx, String(score), flip ? x + 62 : x + 168, y + 42, '#fff', 8);
    };
    block(tA, cx - 360, g.score[0], false);
    block(tB, cx + 130, g.score[1], true);
    let clockTxt;
    if (g.overtime) clockTxt = 'OT';
    else if (g.timed) { const c = Math.ceil(g.clock * 10) / 10; clockTxt = c < 10 ? c.toFixed(1) : `${Math.floor(Math.ceil(c) / 60)}:${String(Math.ceil(c) % 60).padStart(2, '0')}`; }
    else clockTxt = `TO ${g.target}`;
    rrect(ctx, cx - 112, y + 6, 224, 66, 33); fillOut(ctx, '#151a2b', 5);
    ctx.font = '900 34px "Arial Black", Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    outlinedText(ctx, clockTxt, cx, y + 32, g.timed && g.clock < 10 && !g.overtime ? '#ff5a5a' : '#ffd23f', 6);
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = 'bold 12px Arial';
    ctx.fillText(g.overtime ? 'NEXT BUCKET WINS' : g.timed ? 'TIME' : 'FIRST TO', cx, y + 59);

    // Player cards: SUPER bar + nitro stamina.
    g.players.forEach(p => {
      const k = g.players.filter(q => q.side === p.side).indexOf(p);
      const left = p.side === 0;
      const x = left ? 12 : W - 12 - 250, yy = 104 + k * 70;
      const t = TEAM[p.team];
      rrect(ctx, x, yy, 250, 62, 14); fillOut(ctx, 'rgba(14,18,32,0.9)', 4);
      rrect(ctx, x + 6, yy + 6, 40, 40, 9); fillOut(ctx, t.c1, 3);
      ctx.font = '900 18px "Arial Black", Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      outlinedText(ctx, String(p.num), x + 26, yy + 27, trimFor(t), 4);
      const tag = this.meta.tags[p.i];
      ctx.textAlign = 'left'; ctx.font = 'bold 14px Arial'; ctx.fillStyle = '#fff';
      const nm = p.name.length > 17 ? p.name.split(' ').slice(-1)[0] : p.name;
      ctx.fillText(nm, x + 54, yy + 14);
      if (tag) { ctx.font = '900 12px Arial'; ctx.textAlign = 'right'; ctx.fillStyle = tag.color; ctx.fillText(tag.label, x + 242, yy + 14); }
      const mx = x + 54, my = yy + 26, mw = 188;
      rrect(ctx, mx, my, mw, 16, 8); fillOut(ctx, '#2a2f44', 3);
      const full = p.power >= 100;
      const fill = Math.min(1, p.power / 100);
      if (fill > 0.02) {
        const grd = ctx.createLinearGradient(mx, 0, mx + mw, 0);
        grd.addColorStop(0, '#ffd23f'); grd.addColorStop(1, '#ff6a1a');
        ctx.fillStyle = full && Math.floor(this.t * 6) % 2 ? '#fff6a0' : grd;
        rrect(ctx, mx + 2, my + 2, Math.max(12, (mw - 4) * fill), 12, 6); ctx.fill();
      }
      for (let s = 1; s < 4; s++) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(mx + (mw * s) / 4, my + 2, 2, 12); }
      ctx.fillStyle = '#fff'; ctx.font = '900 10px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const has = g.ball.state === 'held' && g.ball.holder === p.i;
      let lbl = 'SUPER';
      if (p.iron > 0) lbl = `IRON DEFENSE ${Math.ceil(p.iron)}s`;
      else if (full) lbl = `${tag && tag.spec ? tag.spec + ': ' : ''}${has ? 'MEGA DUNK!' : 'IRON DEFENSE'}`;
      ctx.fillText(lbl, mx + mw / 2, my + 9);
      const ny = yy + 48;
      rrect(ctx, mx, ny, mw, 7, 3.5); ctx.fillStyle = '#2a2f44'; ctx.fill();
      ctx.fillStyle = p.fx.speed > 0 ? '#ffe14d' : p.stamina < 0.2 ? '#ff6b6b' : '#4fd1ff';
      rrect(ctx, mx, ny, Math.max(4, mw * p.stamina), 7, 3.5); ctx.fill();
      if (p.superShot) { ctx.font = `16px ${EMOJI_FONT}`; ctx.textAlign = 'center'; ctx.fillText('🔥', x + 26, yy + 54); }
    });

    if (g.phase === 'ready' && this.meta.hint) {
      ctx.font = 'bold 16px Arial';
      const wHint = Math.min(W - 80, ctx.measureText(this.meta.hint).width + 40);
      rrect(ctx, cx - wHint / 2, 470, wHint, 44, 12); fillOut(ctx, 'rgba(0,0,0,0.65)', 3);
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(this.meta.hint, cx, 492);
    }
  }
}
