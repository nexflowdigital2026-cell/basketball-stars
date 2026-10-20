// Keyboard + gamepad input. Each "device" maps to one player's input object.
export const LAYOUTS = {
  kb1: { l: ['KeyA'], r: ['KeyD'], u: ['KeyW'], skill: ['KeyS'], shoot: ['KeyF'], act: ['KeyG'], spec: ['KeyE'], nitro: ['ShiftLeft', 'KeyQ'] },
  kb2: { l: ['ArrowLeft'], r: ['ArrowRight'], u: ['ArrowUp'], skill: ['ArrowDown'], shoot: ['KeyK', 'Numpad1'], act: ['KeyL', 'Numpad2'], spec: ['KeyO', 'Numpad3'], nitro: ['ShiftRight', 'Numpad0', 'Slash'] },
};
LAYOUTS.kb = Object.fromEntries(Object.keys(LAYOUTS.kb1).map(k => [k, [...LAYOUTS.kb1[k], ...LAYOUTS.kb2[k], ...(k === 'u' ? ['Space'] : [])]]));

export const DEVICE_LABELS = {
  kb: 'Keyboard', kb1: 'Keyboard 1 (WASD)', kb2: 'Keyboard 2 (Arrows)',
  pad0: 'Gamepad 1', pad1: 'Gamepad 2', pad2: 'Gamepad 3', pad3: 'Gamepad 4', cpu: 'CPU',
};

const down = new Set();
const GAME_KEYS = new Set(Object.values(LAYOUTS.kb).flat());

window.addEventListener('keydown', e => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
  down.add(e.code);
  if (GAME_KEYS.has(e.code) && document.body.classList.contains('in-game')) e.preventDefault();
});
window.addEventListener('keyup', e => down.delete(e.code));
window.addEventListener('blur', () => down.clear());

export function readDevice(dev) {
  const inp = { l: false, r: false, u: false, shoot: false, act: false, skill: false, spec: false, nitro: false };
  if (dev.startsWith('kb')) {
    const map = LAYOUTS[dev];
    for (const k in map) inp[k] = map[k].some(c => down.has(c));
  } else if (dev.startsWith('pad')) {
    const gp = (navigator.getGamepads ? navigator.getGamepads() : [])[Number(dev.slice(3))];
    if (gp) {
      const bt = i => !!(gp.buttons[i] && gp.buttons[i].pressed);
      const ax = gp.axes[0] || 0;
      inp.l = ax < -0.4 || bt(14);
      inp.r = ax > 0.4 || bt(15);
      inp.u = bt(0) || (gp.axes[1] || 0) < -0.75 || bt(12);
      inp.shoot = bt(2) || bt(7);
      inp.act = bt(1);
      inp.skill = bt(3) || bt(13);
      inp.spec = bt(5);
      inp.nitro = bt(4) || bt(6);
    }
  }
  return inp;
}

export function connectedPads() {
  const pads = navigator.getGamepads ? [...navigator.getGamepads()] : [];
  return pads.map((p, i) => (p ? i : -1)).filter(i => i >= 0);
}

export function isDown(code) { return down.has(code); }
