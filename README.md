# Basketball Stars 26-27

An arcade 1v1 / 2v2 basketball game in the spirit of *Basketball Stars*, with all 30 NBA teams and their stars on 2026-27 rosters (after the 2026 draft and offseason moves).

## Run it

```bash
npm install
npm start
```

Open **http://localhost:3000**. The server also prints a "Same network" address (for example `http://192.168.1.20:3000`) that friends on your Wi-Fi/LAN can open.

## Modes

- **Quick Match**: you against the CPU (Easy / Pro / All-Star), 1v1 or 2v2.
- **Same Device**: 2 players on one keyboard, up to 4 with gamepads. Any slot can be CPU.
- **Network Play**: create a room, and friends on the same network join from the room list or by its 4-letter code. Empty slots are played by the CPU. The host's browser runs the game.
- **Season Mode**: a 6, 8 or 12 game season against the league (other games are simulated), then an 8-team playoff to the NBA Finals. Progress saves automatically.

## Controls

| Action | Player 1 | Player 2 | Gamepad |
|---|---|---|---|
| Move | A / D | ← / → | Stick / D-pad |
| Jump / block | W | ↑ | A |
| Shoot (hold, release in the green) | F | K / Num1 | X |
| Hit (knock down + steal) / pass | G | L / Num2 | B |
| Crossover / defensive slide | S | ↓ | Y |
| Nitro sprint (hold) | Shift / Q | Right Shift / Num0 | LB |
| Super: Mega Dunk / Iron Defense | E | O / Num3 | RB |
| Pause | Esc / P | | |

## Abilities

- **Hit**: knock your opponent flat and pop the ball loose. A whiff leaves you off-balance, a crossover can dodge it, and players who get back up are briefly immune.
- **SUPER bar** fills with buckets, knockdowns, blocks and ankle-breakers. When full:
  - with the ball, **MEGA DUNK**: fly in from anywhere for a guaranteed, unblockable slam (3 points from behind the arc) that knocks nearby defenders down.
  - on defense, **IRON DEFENSE**: an 8-second shield. You can't be knocked down or crossed over, your hits always land, and nearby shots are auto-blocked.
- **Nitro**: sprint on a stamina bar.
- **Action cards** (optional): Mega Dunk, Iron Defense, Fast Break, Super Shot, Freeze.
- **Courts**: Home Arena, Street Court and Beach Court.

## Code layout

- `server.js`: static server plus WebSocket lobby/relay for LAN play
- `public/js/game.js`: fixed-step match simulation (physics, shots, dunks, blocks, power-ups)
- `public/js/ai.js`: CPU players
- `public/js/render.js`: canvas renderer (arena, cartoon players, effects, HUD)
- `public/js/teams.js`: 30 teams, rosters, ratings
- `public/js/season.js`: season and playoff logic
- `public/js/main.js`: menus, game loop, network sessions
