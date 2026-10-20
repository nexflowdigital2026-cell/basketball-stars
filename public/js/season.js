// Season mode: short regular season against the league, then an 8-team playoff.
// Every non-user game is simulated from team strength. Saved in localStorage.
import { TEAMS, TEAM, teamStrength } from './teams.js';

const KEY = 'bs_season_v1';
export const PLAYOFF_ROUNDS = ['Quarterfinals', 'Semifinals', 'NBA Finals'];

const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

export function loadSeason() {
  try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; }
}
export function saveSeason(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} }
export function clearSeason() { try { localStorage.removeItem(KEY); } catch {} }

export function newSeason({ team, picks, mode, difficulty, length, target, powerups, games }) {
  const abbrs = TEAMS.map(t => t.abbr);
  const rounds = [];
  const faced = new Set();
  for (let r = 0; r < games; r++) {
    let pairs;
    for (let tries = 0; tries < 60; tries++) {
      const order = shuffle([...abbrs]);
      pairs = [];
      for (let i = 0; i < order.length; i += 2) pairs.push([order[i], order[i + 1]]);
      const mine = pairs.find(p => p.includes(team));
      const opp = mine[0] === team ? mine[1] : mine[0];
      if (!faced.has(opp)) { faced.add(opp); break; }
    }
    rounds.push(pairs);
  }
  const standings = Object.fromEntries(abbrs.map(a => [a, { w: 0, l: 0, pf: 0, pa: 0 }]));
  const s = { team, picks, mode, difficulty, length, target, powerups, games, round: 0, rounds, standings, log: [], phase: 'regular', bracket: null, pround: 0, champion: null };
  saveSeason(s);
  return s;
}

function simScore(a, b, s) {
  const sa = teamStrength(TEAM[a]), sb = teamStrength(TEAM[b]);
  const pa = 1 / (1 + Math.exp(-(sa - sb) / 3.5));
  const aWins = Math.random() < pa;
  const hi = s.target ? s.target : 16 + Math.floor(Math.random() * 16);
  const lo = Math.max(0, hi - 2 - Math.floor(Math.random() * 11));
  return aWins ? [hi, lo] : [lo, hi];
}

function record(s, a, b, sa, sb) {
  const A = s.standings[a], B = s.standings[b];
  A.pf += sa; A.pa += sb; B.pf += sb; B.pa += sa;
  if (sa > sb) { A.w++; B.l++; } else { B.w++; A.l++; }
}

export function sortedStandings(s) {
  return Object.entries(s.standings)
    .map(([abbr, r]) => ({ abbr, ...r, diff: r.pf - r.pa }))
    .sort((x, y) => y.w - x.w || y.diff - x.diff || teamStrength(TEAM[y.abbr]) - teamStrength(TEAM[x.abbr]));
}

export function nextOpponent(s) {
  if (s.phase === 'regular') {
    const m = s.rounds[s.round].find(p => p.includes(s.team));
    return m[0] === s.team ? m[1] : m[0];
  }
  if (s.phase === 'playoffs') {
    const m = s.bracket[s.pround].find(x => x.a === s.team || x.b === s.team);
    if (!m) return null;
    return m.a === s.team ? m.b : m.a;
  }
  return null;
}

export function roundLabel(s) {
  if (s.phase === 'regular') return `Game ${s.round + 1} of ${s.games}`;
  if (s.phase === 'playoffs') return PLAYOFF_ROUNDS[s.pround];
  return 'Season over';
}

// Apply the user's game result (or simulate it when myScore is null) and advance.
export function completeGame(s, myScore, oppScore) {
  const opp = nextOpponent(s);
  if (myScore == null) [myScore, oppScore] = simScore(s.team, opp, s);
  if (myScore === oppScore) myScore++;
  s.log.push({ opp, my: myScore, their: oppScore, label: roundLabel(s), r: myScore > oppScore ? 'W' : 'L' });

  if (s.phase === 'regular') {
    for (const [a, b] of s.rounds[s.round]) {
      if (a === s.team || b === s.team) record(s, s.team, opp, myScore, oppScore);
      else { const [x, y] = simScore(a, b, s); record(s, a, b, x, y); }
    }
    s.round++;
    if (s.round >= s.games) startPlayoffs(s);
  } else if (s.phase === 'playoffs') {
    const round = s.bracket[s.pround];
    for (const m of round) {
      if (m.a === s.team || m.b === s.team) {
        const mine = m.a === s.team;
        m.sa = mine ? myScore : oppScore; m.sb = mine ? oppScore : myScore;
      } else [m.sa, m.sb] = simScore(m.a, m.b, s);
      m.w = m.sa > m.sb ? m.a : m.b;
    }
    if (myScore < oppScore) { finishPlayoffs(s); }
    else if (s.pround === PLAYOFF_ROUNDS.length - 1) { s.champion = s.team; s.phase = 'done'; }
    else advanceBracket(s);
  }
  saveSeason(s);
  return s;
}

function startPlayoffs(s) {
  const seeds = sortedStandings(s).slice(0, 8).map(x => x.abbr);
  s.seeds = seeds;
  s.phase = 'playoffs';
  s.pround = 0;
  s.bracket = [[[0, 7], [3, 4], [1, 6], [2, 5]].map(([i, j]) => ({ a: seeds[i], b: seeds[j] }))];
  if (!seeds.includes(s.team)) { s.missed = true; finishPlayoffs(s); }
}

function advanceBracket(s) {
  const prev = s.bracket[s.pround];
  const next = [];
  for (let i = 0; i < prev.length; i += 2) next.push({ a: prev[i].w, b: prev[i + 1].w });
  s.bracket.push(next);
  s.pround++;
}

// User is out (or missed the playoffs): simulate the rest of the bracket to crown a champion.
function finishPlayoffs(s) {
  let round = s.bracket[s.bracket.length - 1];
  for (const m of round) if (!m.w) { [m.sa, m.sb] = simScore(m.a, m.b, s); m.w = m.sa > m.sb ? m.a : m.b; }
  while (round.length > 1) {
    const next = [];
    for (let i = 0; i < round.length; i += 2) {
      const m = { a: round[i].w, b: round[i + 1].w };
      [m.sa, m.sb] = simScore(m.a, m.b, s); m.w = m.sa > m.sb ? m.a : m.b;
      next.push(m);
    }
    s.bracket.push(next);
    round = next;
  }
  s.champion = round[0].w;
  s.phase = 'done';
}
