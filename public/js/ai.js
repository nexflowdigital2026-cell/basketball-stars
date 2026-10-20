// CPU opponents/teammates. Produces the same input object a human would,
// so the simulation treats CPU and human players identically.
import { HOOPS, THREE_DIST, SWEET, FLOOR, LYING } from './game.js';

const LEVELS = {
  easy:   { react: 0.42, noise: 0.26, jump: 0.35, punch: 0.35, shotIQ: 0.5,  cross: 0.3, power: 0.006 },
  medium: { react: 0.24, noise: 0.16, jump: 0.6,  punch: 0.65, shotIQ: 0.72, cross: 0.5, power: 0.015 },
  hard:   { react: 0.12, noise: 0.09, jump: 0.85, punch: 1.0, shotIQ: 0.9,  cross: 0.7, power: 0.04 },
};

export function makeBrain(level = 'medium') {
  return { L: LEVELS[level] || LEVELS.medium, t: 0, seen: null, decideT: 0, release: SWEET, wantShot: 0, jumpPlan: -1, retreat: 0, cutting: false };
}

const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;

export function aiInput(g, p, b) {
  const inp = { l: false, r: false, u: false, shoot: false, act: false, skill: false, spec: false, nitro: false };
  const L = b.L, dt = 1 / 60;
  b.t += dt;
  b.decideT -= dt;
  // Delayed perception: the CPU reacts to where players were a moment ago.
  if (!b.seen || b.t >= L.react) {
    b.t = 0;
    b.seen = g.players.map(q => ({ x: q.x, state: q.state, ground: q.ground }));
  }
  if (g.phase !== 'play') return inp;

  const hoop = HOOPS[p.side], dir = hoop.dir;
  const ball = g.ball, holder = g.holder();
  const go = (tx, dead = 14) => { if (tx < p.x - dead) inp.l = true; else if (tx > p.x + dead) inp.r = true; };

  if (p.state === 'shoot') {
    inp.shoot = p.meter < b.release;
    return inp;
  }
  if (p.state !== 'move') return inp;

  const opps = g.opps(p);
  const standing = opps.filter(q => !LYING(q.state));
  const nearestOpp = opps.reduce((a, q) => (Math.abs(q.x - p.x) + (q.lane !== p.lane ? 30 : 0) < Math.abs(a.x - p.x) + (a.lane !== p.lane ? 30 : 0) ? q : a), opps[0]);

  // ---------------- offense with the ball
  if (holder === p) {
    const d = Math.abs(hoop.x - p.x);
    if (p.power >= 100 && Math.random() < L.power * (d < 900 ? 3 : 1)) { inp.spec = true; return inp; }
    const def = nearestOpp;
    const sd = b.seen[def.i];
    const gap = (sd.x - p.x) * dir; // >0: defender between me and the hoop
    const open = gap < -20 || Math.abs(sd.x - p.x) > 150 || def.state === 'stumble' || LYING(def.state) || def.fx.frozen > 0;
    const range = 300 + 520 * Math.max(p.r.three * 1.05, p.r.shot * 0.85) * (p.superShot ? 1.4 : 1);
    const mate = g.mate(p);

    if (mate && b.decideT <= 0 && !LYING(mate.state)) {
      const mateD = Math.abs(hoop.x - mate.x);
      const mateOpen = standing.every(q => Math.abs(q.x - mate.x) > 110);
      if ((mate.call > 0 && Math.random() < 0.6) || (mateOpen && mateD < d - 120 && Math.random() < 0.35) || (p.holdT > 3.5 && Math.random() < 0.3)) {
        inp.act = true; b.decideT = 0.6; return inp;
      }
    }

    if (p.ground && d < g.dunkRange(p) * 0.92 && (open || gap < 40 || Math.random() < 0.02)) {
      go(hoop.x, 0);
      inp.shoot = !p.prev.shoot;
      return inp;
    }

    if (b.decideT <= 0) {
      b.decideT = 0.25 + Math.random() * 0.35;
      const goodLook = open && d < range;
      const forced = p.holdT > 5.5;
      // A defender winding up a punch: dodge with a crossover.
      const threatened = def.state === 'punch' && Math.abs(def.x - p.x) < 120;
      if ((goodLook && Math.random() < L.shotIQ) || p.superShot || forced || (d < range * 0.75 && Math.random() < 0.12)) {
        b.release = Math.max(0.35, SWEET + gauss() * 3 * L.noise); // gauss() has sd ~1/3
        b.wantShot = 1;
      } else if ((threatened && Math.random() < L.cross) || (gap > 0 && gap < 120 && Math.random() < 0.55 * L.cross)) {
        inp.skill = true;
        inp.l = dir < 0; inp.r = dir > 0;
        return inp;
      } else if (!mate && gap > 0 && gap < 80 && p.cd.punch <= 0 && Math.random() < 0.12 * L.punch) {
        inp.act = true; // stiff-arm the defender
        return inp;
      } else if (gap > 0 && gap < 70 && Math.random() < 0.3) {
        b.retreat = 0.4;
      }
    }
    if (b.wantShot) { b.wantShot = 0; inp.shoot = true; return inp; }
    if (b.retreat > 0) { b.retreat -= dt; go(p.x - dir * 100, 0); return inp; }
    go(hoop.x, 0);
    inp.nitro = p.stamina > 0.35 && (open || gap > 250) && d > 300;
    return inp;
  }

  // ---------------- offense without the ball (2v2)
  if (holder && holder.side === p.side) {
    const d = Math.abs(hoop.x - p.x);
    if (b.decideT <= 0) { b.decideT = 0.8 + Math.random(); b.cutting = p.r.dunk > 0.7 ? Math.random() < 0.55 : Math.random() < 0.25; }
    const spot = b.cutting ? hoop.x - dir * 170 : hoop.x - dir * (THREE_DIST + 50 + (p.lane > 0 ? 60 : -40));
    go(spot, 20);
    inp.nitro = b.cutting && p.stamina > 0.5;
    const myGuard = opps.find(q => q.lane === p.lane);
    if (myGuard && Math.abs(myGuard.x - p.x) > 130 && d < THREE_DIST + 120 && Math.random() < 0.03) inp.act = true;
    return inp;
  }

  // ---------------- defense
  if (holder && holder.side !== p.side) {
    let mark = opps.find(q => q.lane === p.lane) || holder;
    const mate = g.mate(p);
    if (mark !== holder && mate && (mate.state === 'stumble' || LYING(mate.state) || Math.abs(mate.x - holder.x) > 220)) mark = holder;
    const sm = b.seen[mark.i];
    const theirDir = HOOPS[mark.side].dir;
    const cushion = mark === holder ? 62 + (1 - p.r.def) * 30 : 120;
    const tx = sm.x + theirDir * cushion;
    go(tx, 10);
    inp.nitro = Math.abs(tx - p.x) > 260 && p.stamina > 0.3;

    if (mark === holder) {
      const dx = Math.abs(holder.x - p.x);
      if (p.power >= 100 && p.iron <= 0 && dx < 500 && Math.random() < L.power * 2) { inp.spec = true; return inp; }
      if (p.ground) {
        const seenShoot = sm.state === 'shoot' || sm.state === 'dunk' || sm.state === 'layup';
        if (seenShoot && dx < 170 && b.jumpPlan < 0) b.jumpPlan = Math.random() < L.jump ? 0 : 99;
        if (!seenShoot) b.jumpPlan = -1;
        if (b.jumpPlan === 0) { inp.u = true; b.jumpPlan = 99; }
        const facing = Math.sign(holder.x - p.x) === p.face || dx < 25;
        if (dx < 85 && facing && p.cd.punch <= 0 && holder.iron <= 0 && holder.immune <= 0 && !LYING(holder.state) &&
            Math.random() < L.punch * dt * (0.6 + p.r.def)) inp.act = true;
      }
    }
    return inp;
  }

  // ---------------- loose ball / rebound
  let tx = ball.x;
  if (ball.state !== 'held') tx = ball.x + ball.vx * 0.35;
  go(tx, 8);
  inp.nitro = Math.abs(tx - p.x) > 200 && p.stamina > 0.25;
  const reach = p.y - 205 * p.h;
  if (p.ground && Math.abs(ball.x - p.x) < 90 && ball.y < reach && ball.y > reach - 260 && ball.vy > -200 && ball.y < FLOOR - 100) {
    if (Math.random() < 0.25 + L.jump * 0.3) inp.u = true;
  }
  // Clear out a rival who is about to grab the loose ball.
  const rival = standing.find(q => Math.abs(q.x - p.x) < 80 && Math.abs(q.x - ball.x) < 120);
  if (rival && p.cd.punch <= 0 && Math.sign(rival.x - p.x) === p.face && Math.random() < L.punch * dt) inp.act = true;
  return inp;
}
