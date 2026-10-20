// 2026-27 NBA teams and stars (rosters reflect the 2026 offseason).
// Ratings: spd, shot (mid-range), three, dunk, def (perimeter D / steals), blk, hnd (handles).
// sig: archetype (see SIGS) with a small passive bonus.
// look: [skinTone 0-4, hairStyle, beard 0-2]

const P = (name, num, pos, [spd, shot, three, dunk, def, blk, hnd], sig, look, height = 1) =>
  ({ name, num, pos, r: { spd, shot, three, dunk, def, blk, hnd }, sig, skin: look[0], hair: look[1], beard: look[2], height });

export const TEAMS = [
  { abbr: 'ATL', city: 'Atlanta', name: 'Hawks', c1: '#E03A3E', c2: '#C1D32F', c3: '#26282A', conf: 'E', players: [
    P('Jalen Johnson', 1, 'F', [80, 72, 70, 88, 78, 70, 76], 'slasher', [3, 'short', 1], 1.04),
    P('CJ McCollum', 3, 'G', [76, 88, 86, 50, 62, 40, 88], 'sniper', [3, 'short', 2], 0.96),
    P('Dyson Daniels', 5, 'G', [84, 70, 66, 68, 95, 62, 76], 'lockdown', [0, 'curly', 0], 1.0),
  ] },
  { abbr: 'BOS', city: 'Boston', name: 'Celtics', c1: '#007A33', c2: '#BA9653', c3: '#FFFFFF', conf: 'E', players: [
    P('Jayson Tatum', 0, 'F', [80, 88, 85, 82, 84, 72, 86], 'sniper', [3, 'short', 1], 1.04),
    P('Paul George', 8, 'F', [78, 87, 87, 72, 82, 66, 82], 'sniper', [2, 'short', 1], 1.03),
    P('Derrick White', 9, 'G', [80, 82, 82, 62, 90, 78, 80], 'lockdown', [1, 'bald', 1], 0.98),
  ] },
  { abbr: 'BKN', city: 'Brooklyn', name: 'Nets', c1: '#111111', c2: '#FFFFFF', c3: '#777777', conf: 'E', players: [
    P('Michael Porter Jr.', 1, 'F', [74, 86, 88, 74, 66, 62, 70], 'sniper', [0, 'long', 1], 1.06),
    P('Julius Randle', 30, 'F', [74, 80, 76, 82, 72, 58, 80], 'bigman', [3, 'short', 1], 1.03),
    P('Mikel Brown Jr.', 0, 'G', [86, 80, 80, 70, 70, 45, 88], 'handles', [3, 'short', 0], 0.97),
  ] },
  { abbr: 'CHA', city: 'Charlotte', name: 'Hornets', c1: '#1D1160', c2: '#00788C', c3: '#A1A1A4', conf: 'E', players: [
    P('Brandon Miller', 24, 'F', [80, 84, 85, 78, 76, 68, 80], 'sniper', [3, 'short', 0], 1.05),
    P('Kon Knueppel', 7, 'G', [76, 86, 90, 60, 70, 50, 78], 'sniper', [0, 'short', 0], 1.0),
    P('Coby White', 0, 'G', [88, 82, 82, 72, 66, 45, 86], 'handles', [3, 'curly', 1], 0.97),
  ] },
  { abbr: 'CHI', city: 'Chicago', name: 'Bulls', c1: '#CE1141', c2: '#111111', c3: '#FFFFFF', conf: 'E', players: [
    P('Josh Giddey', 3, 'G', [78, 74, 74, 70, 72, 55, 88], 'handles', [0, 'curly', 0], 1.02),
    P('Matas Buzelis', 14, 'F', [82, 78, 78, 86, 74, 80, 74], 'slasher', [0, 'short', 0], 1.05),
    P('Caleb Wilson', 5, 'F', [86, 70, 64, 90, 78, 82, 72], 'slasher', [3, 'short', 0], 1.05),
  ] },
  { abbr: 'CLE', city: 'Cleveland', name: 'Cavaliers', c1: '#860038', c2: '#FDBB30', c3: '#041E42', conf: 'E', players: [
    P('Donovan Mitchell', 45, 'G', [88, 86, 85, 84, 76, 52, 90], 'handles', [3, 'buzz', 1], 0.95),
    P('James Harden', 1, 'G', [72, 85, 86, 62, 68, 52, 94], 'handles', [3, 'curly', 2], 1.0),
    P('Evan Mobley', 4, 'F', [80, 76, 70, 88, 92, 92, 72], 'bigman', [3, 'short', 0], 1.08),
  ] },
  { abbr: 'DAL', city: 'Dallas', name: 'Mavericks', c1: '#00538C', c2: '#B8C4CA', c3: '#002B5E', conf: 'W', players: [
    P('Cooper Flagg', 32, 'F', [84, 80, 76, 86, 90, 84, 80], 'slasher', [0, 'buzz', 0], 1.05),
    P('Kyrie Irving', 11, 'G', [84, 90, 88, 72, 70, 45, 99], 'handles', [3, 'short', 1], 0.96),
    P('Dereck Lively II', 2, 'C', [78, 58, 30, 92, 86, 92, 55], 'bigman', [3, 'short', 0], 1.1),
  ] },
  { abbr: 'DEN', city: 'Denver', name: 'Nuggets', c1: '#0E2240', c2: '#FEC524', c3: '#8B2131', conf: 'W', players: [
    P('Nikola Jokic', 15, 'C', [58, 88, 80, 70, 74, 72, 92], 'bigman', [0, 'short', 1], 1.1),
    P('Jamal Murray', 27, 'G', [78, 88, 86, 70, 66, 45, 90], 'handles', [3, 'short', 1], 0.97),
    P('DeMar DeRozan', 10, 'F', [76, 90, 72, 76, 66, 50, 88], 'sniper', [3, 'buzz', 1], 1.0),
  ] },
  { abbr: 'DET', city: 'Detroit', name: 'Pistons', c1: '#C8102E', c2: '#1D42BA', c3: '#BEC0C2', conf: 'E', players: [
    P('Cade Cunningham', 2, 'G', [80, 84, 80, 78, 80, 58, 92], 'handles', [3, 'short', 1], 1.02),
    P('Jalen Duren', 0, 'C', [76, 56, 25, 96, 82, 88, 52], 'bigman', [4, 'short', 0], 1.07),
    P('Ausar Thompson', 9, 'F', [94, 62, 58, 94, 94, 84, 70], 'lockdown', [3, 'short', 0], 1.03),
  ] },
  { abbr: 'GSW', city: 'Golden State', name: 'Warriors', c1: '#1D428A', c2: '#FFC72C', c3: '#FFFFFF', conf: 'W', players: [
    P('Stephen Curry', 30, 'G', [84, 96, 99, 62, 66, 38, 94], 'sniper', [2, 'short', 1], 0.95),
    P('Jimmy Butler', 10, 'F', [78, 82, 70, 78, 86, 60, 84], 'lockdown', [3, 'short', 1], 1.0),
    P('Kristaps Porzingis', 8, 'C', [64, 82, 84, 80, 78, 94, 60], 'bigman', [0, 'short', 1], 1.12),
  ] },
  { abbr: 'HOU', city: 'Houston', name: 'Rockets', c1: '#CE1141', c2: '#C4CED4', c3: '#111111', conf: 'W', players: [
    P('Kevin Durant', 7, 'F', [80, 96, 92, 80, 76, 76, 88], 'sniper', [3, 'short', 1], 1.07),
    P('Alperen Sengun', 28, 'C', [66, 80, 62, 82, 76, 76, 86], 'bigman', [0, 'short', 1], 1.08),
    P('Amen Thompson', 1, 'G', [96, 62, 55, 95, 92, 78, 80], 'slasher', [3, 'short', 0], 1.03),
  ] },
  { abbr: 'IND', city: 'Indiana', name: 'Pacers', c1: '#002D62', c2: '#FDBB30', c3: '#BEC0C2', conf: 'E', players: [
    P('Tyrese Haliburton', 0, 'G', [82, 86, 88, 62, 68, 50, 92], 'sniper', [3, 'short', 0], 1.0),
    P('Pascal Siakam', 43, 'F', [80, 82, 72, 82, 78, 66, 82], 'slasher', [4, 'short', 1], 1.04),
    P('Ivica Zubac', 40, 'C', [58, 70, 20, 86, 84, 86, 48], 'bigman', [0, 'short', 1], 1.1),
  ] },
  { abbr: 'LAC', city: 'LA', name: 'Clippers', c1: '#C8102E', c2: '#1D428A', c3: '#BEC0C2', conf: 'W', players: [
    P('Brandon Ingram', 3, 'F', [78, 88, 82, 74, 70, 62, 86], 'sniper', [3, 'short', 0], 1.06),
    P('Darius Garland', 10, 'G', [86, 86, 86, 60, 62, 40, 92], 'handles', [3, 'braids', 0], 0.94),
    P('Keaton Wagler', 5, 'G', [80, 82, 84, 64, 66, 48, 82], 'sniper', [0, 'short', 0], 1.0),
  ] },
  { abbr: 'LAL', city: 'Los Angeles', name: 'Lakers', c1: '#552583', c2: '#FDB927', c3: '#FFFFFF', conf: 'W', players: [
    P('Luka Doncic', 77, 'G', [74, 92, 90, 68, 66, 50, 98], 'handles', [0, 'short', 1], 1.02),
    P('Austin Reaves', 15, 'G', [78, 86, 84, 64, 68, 40, 86], 'sniper', [0, 'short', 1], 0.98),
    P('Walker Kessler', 13, 'C', [66, 55, 25, 88, 84, 96, 45], 'bigman', [0, 'short', 0], 1.1),
  ] },
  { abbr: 'MEM', city: 'Memphis', name: 'Grizzlies', c1: '#5D76A9', c2: '#12173F', c3: '#F5B112', conf: 'W', players: [
    P('Cameron Boozer', 12, 'F', [80, 78, 72, 88, 78, 72, 80], 'slasher', [3, 'short', 0], 1.04),
    P('Zach Edey', 14, 'C', [52, 62, 10, 90, 78, 92, 40], 'bigman', [0, 'short', 0], 1.14),
    P('Jerami Grant', 9, 'F', [80, 78, 78, 82, 74, 72, 74], 'slasher', [3, 'short', 1], 1.04),
  ] },
  { abbr: 'MIA', city: 'Miami', name: 'Heat', c1: '#98002E', c2: '#F9A01B', c3: '#111111', conf: 'E', players: [
    P('Giannis Antetokounmpo', 34, 'F', [90, 74, 55, 99, 88, 86, 84], 'slasher', [4, 'short', 1], 1.08),
    P('Bam Adebayo', 13, 'C', [80, 72, 60, 86, 92, 84, 72], 'lockdown', [3, 'short', 1], 1.04),
    P('Andrew Wiggins', 22, 'F', [84, 78, 78, 84, 78, 66, 74], 'slasher', [3, 'short', 0], 1.03),
  ] },
  { abbr: 'MIL', city: 'Milwaukee', name: 'Bucks', c1: '#00471B', c2: '#EEE1C6', c3: '#0077C0', conf: 'E', players: [
    P('Tyler Herro', 14, 'G', [80, 88, 88, 62, 62, 40, 88], 'sniper', [0, 'short', 0], 0.98),
    P('Myles Turner', 3, 'C', [70, 74, 80, 78, 80, 94, 54], 'bigman', [3, 'short', 0], 1.1),
    P('Jaime Jaquez Jr.', 11, 'F', [76, 80, 70, 74, 74, 56, 82], 'handles', [1, 'short', 0], 1.01),
  ] },
  { abbr: 'MIN', city: 'Minnesota', name: 'Timberwolves', c1: '#0C2340', c2: '#236192', c3: '#78BE20', conf: 'W', players: [
    P('Anthony Edwards', 5, 'G', [92, 86, 86, 94, 80, 62, 88], 'slasher', [4, 'short', 0], 0.99),
    P('LaMelo Ball', 1, 'G', [84, 82, 86, 72, 64, 50, 94], 'handles', [3, 'braids', 0], 1.03),
    P('Rudy Gobert', 27, 'C', [62, 55, 10, 88, 96, 96, 40], 'lockdown', [4, 'short', 0], 1.13),
  ] },
  { abbr: 'NOP', city: 'New Orleans', name: 'Pelicans', c1: '#0C2340', c2: '#C8102E', c3: '#85714D', conf: 'W', players: [
    P('Zion Williamson', 1, 'F', [86, 70, 40, 99, 72, 66, 82], 'slasher', [4, 'buzz', 0], 1.0),
    P('Trey Murphy III', 25, 'F', [82, 84, 88, 82, 72, 62, 74], 'sniper', [3, 'short', 0], 1.05),
    P('Herbert Jones', 2, 'F', [80, 72, 72, 74, 94, 72, 70], 'lockdown', [4, 'short', 1], 1.04),
  ] },
  { abbr: 'NYK', city: 'New York', name: 'Knicks', c1: '#006BB6', c2: '#F58426', c3: '#BEC0C2', conf: 'E', players: [
    P('Jalen Brunson', 11, 'G', [78, 92, 86, 62, 66, 40, 96], 'handles', [3, 'short', 1], 0.94),
    P('Karl-Anthony Towns', 32, 'C', [68, 88, 90, 82, 70, 76, 74], 'bigman', [2, 'short', 0], 1.1),
    P('OG Anunoby', 8, 'F', [80, 76, 80, 80, 92, 70, 68], 'lockdown', [4, 'short', 0], 1.03),
  ] },
  { abbr: 'OKC', city: 'Oklahoma City', name: 'Thunder', c1: '#007AC1', c2: '#EF3B24', c3: '#FDBB30', conf: 'W', players: [
    P('Shai Gilgeous-Alexander', 2, 'G', [88, 94, 84, 78, 84, 60, 96], 'handles', [3, 'short', 0], 1.02),
    P('Jalen Williams', 8, 'F', [82, 84, 80, 82, 82, 62, 84], 'slasher', [3, 'short', 0], 1.02),
    P('Chet Holmgren', 7, 'C', [74, 80, 80, 82, 84, 96, 66], 'bigman', [0, 'short', 0], 1.12),
  ] },
  { abbr: 'ORL', city: 'Orlando', name: 'Magic', c1: '#0077C0', c2: '#C4CED4', c3: '#111111', conf: 'E', players: [
    P('Paolo Banchero', 5, 'F', [80, 82, 74, 88, 74, 62, 84], 'slasher', [2, 'short', 0], 1.06),
    P('Franz Wagner', 22, 'F', [82, 80, 76, 80, 78, 62, 82], 'slasher', [0, 'short', 0], 1.06),
    P('Desmond Bane', 3, 'G', [78, 86, 88, 70, 74, 50, 80], 'sniper', [3, 'short', 1], 0.98),
  ] },
  { abbr: 'PHI', city: 'Philadelphia', name: '76ers', c1: '#006BB6', c2: '#ED174C', c3: '#FFFFFF', conf: 'E', players: [
    P('Joel Embiid', 21, 'C', [64, 88, 76, 86, 82, 86, 74], 'bigman', [4, 'short', 1], 1.1),
    P('Tyrese Maxey', 0, 'G', [96, 86, 86, 72, 66, 42, 90], 'handles', [3, 'short', 0], 0.94),
    P('LeBron James', 23, 'F', [80, 84, 80, 90, 78, 66, 90], 'slasher', [4, 'buzz', 2], 1.04),
    P('Jaylen Brown', 7, 'F', [86, 82, 80, 90, 80, 62, 80], 'slasher', [4, 'short', 1], 1.02),
  ] },
  { abbr: 'PHX', city: 'Phoenix', name: 'Suns', c1: '#1D1160', c2: '#E56020', c3: '#F9AD1B', conf: 'W', players: [
    P('Devin Booker', 1, 'G', [80, 92, 88, 68, 66, 40, 90], 'sniper', [2, 'short', 0], 1.0),
    P('Jalen Green', 4, 'G', [92, 80, 80, 92, 62, 48, 82], 'slasher', [2, 'short', 0], 0.99),
    P('Dillon Brooks', 3, 'F', [74, 76, 78, 70, 86, 56, 68], 'lockdown', [3, 'short', 1], 1.0),
  ] },
  { abbr: 'POR', city: 'Portland', name: 'Trail Blazers', c1: '#E03A3E', c2: '#111111', c3: '#FFFFFF', conf: 'W', players: [
    P('Ja Morant', 12, 'G', [96, 76, 72, 98, 62, 50, 90], 'slasher', [3, 'short', 0], 0.96),
    P('Damian Lillard', 0, 'G', [80, 90, 94, 66, 60, 40, 92], 'sniper', [3, 'dreads', 2], 0.96),
    P('Deni Avdija', 8, 'F', [80, 78, 76, 80, 78, 60, 80], 'slasher', [0, 'short', 0], 1.06),
  ] },
  { abbr: 'SAC', city: 'Sacramento', name: 'Kings', c1: '#5A2D81', c2: '#63727A', c3: '#FFFFFF', conf: 'W', players: [
    P('Domantas Sabonis', 10, 'C', [66, 78, 60, 84, 72, 66, 84], 'bigman', [0, 'short', 1], 1.08),
    P('Zach LaVine', 8, 'G', [88, 88, 86, 96, 62, 46, 86], 'slasher', [3, 'short', 0], 1.0),
    P('Keegan Murray', 13, 'F', [76, 80, 84, 76, 76, 62, 70], 'sniper', [3, 'short', 0], 1.04),
  ] },
  { abbr: 'SAS', city: 'San Antonio', name: 'Spurs', c1: '#111111', c2: '#C4CED4', c3: '#FFFFFF', conf: 'W', players: [
    P('Victor Wembanyama', 1, 'C', [76, 84, 82, 92, 92, 99, 78], 'bigman', [4, 'short', 0], 1.16),
    P("De'Aaron Fox", 4, 'G', [96, 82, 76, 80, 74, 48, 90], 'handles', [3, 'short', 0], 0.97),
    P('Stephon Castle', 5, 'G', [82, 72, 66, 82, 84, 60, 80], 'lockdown', [3, 'short', 0], 1.01),
  ] },
  { abbr: 'TOR', city: 'Toronto', name: 'Raptors', c1: '#CE1141', c2: '#111111', c3: '#A1A1A4', conf: 'E', players: [
    P('Kawhi Leonard', 2, 'F', [76, 92, 86, 78, 90, 66, 84], 'lockdown', [4, 'buzz', 1], 1.03),
    P('Scottie Barnes', 4, 'F', [82, 76, 70, 84, 84, 74, 82], 'slasher', [4, 'dreads', 0], 1.06),
    P('RJ Barrett', 9, 'F', [80, 78, 76, 82, 68, 50, 78], 'slasher', [3, 'short', 1], 1.02),
  ] },
  { abbr: 'UTA', city: 'Utah', name: 'Jazz', c1: '#4B2E83', c2: '#111111', c3: '#FFFFFF', conf: 'W', players: [
    P('Lauri Markkanen', 23, 'F', [76, 86, 86, 84, 70, 66, 74], 'sniper', [0, 'short', 0], 1.1),
    P('Darryn Peterson', 2, 'G', [88, 84, 82, 82, 74, 52, 88], 'handles', [3, 'short', 0], 0.99),
    P('Jaren Jackson Jr.', 13, 'F', [72, 78, 76, 80, 86, 96, 62], 'bigman', [3, 'short', 0], 1.08),
  ] },
  { abbr: 'WAS', city: 'Washington', name: 'Wizards', c1: '#002B5C', c2: '#E31837', c3: '#C4CED4', conf: 'E', players: [
    P('Trae Young', 11, 'G', [84, 88, 92, 58, 52, 36, 98], 'sniper', [3, 'short', 0], 0.92),
    P('Anthony Davis', 3, 'C', [74, 82, 64, 92, 90, 96, 70], 'bigman', [4, 'short', 1], 1.1),
    P('AJ Dybantsa', 7, 'F', [86, 82, 76, 90, 78, 70, 82], 'slasher', [3, 'short', 0], 1.05),
  ] },
];

export const TEAM = Object.fromEntries(TEAMS.map(t => [t.abbr, t]));

// Archetypes give a small passive edge on top of ratings.
export const SIGS = {
  sniper: { name: 'SHARPSHOOTER', desc: 'Wider green release window' },
  slasher: { name: 'HIGH FLYER', desc: 'Dunks from farther out' },
  handles: { name: 'PLAYMAKER', desc: 'Crossovers break ankles more often' },
  lockdown: { name: 'ENFORCER', desc: 'Hits land more often, harder to knock down' },
  bigman: { name: 'BIG MAN', desc: 'Bigger block range, wins rebounds' },
};

export function ovr(p) {
  const r = p.r;
  const best = Math.max(r.shot, r.three, r.dunk);
  return Math.round(r.spd * 0.14 + r.shot * 0.16 + r.three * 0.14 + r.dunk * 0.12 + r.def * 0.14 + r.blk * 0.1 + r.hnd * 0.12 + best * 0.08);
}

export function teamStrength(t) {
  const o = t.players.map(ovr).sort((a, b) => b - a);
  return (o[0] * 0.5 + o[1] * 0.35 + (o[2] || o[1]) * 0.15);
}
