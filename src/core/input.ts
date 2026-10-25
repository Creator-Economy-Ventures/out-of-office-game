// Input manager - keyboard and mouse state
export const keys: Record<string, boolean> = {};
export const mouse = { dx: 0, dy: 0, buttons: [false, false, false], locked: false };
export const justPressed: Set<string> = new Set();
export const justReleased: Set<string> = new Set();

let _pendingDx = 0, _pendingDy = 0;

document.addEventListener('keydown', (e) => {
  if (!keys[e.code]) justPressed.add(e.code);
  keys[e.code] = true;
});
document.addEventListener('keyup', (e) => {
  keys[e.code] = false;
  justReleased.add(e.code);
});
document.addEventListener('mousemove', (e) => {
  if (mouse.locked) {
    _pendingDx += e.movementX;
    _pendingDy += e.movementY;
  }
});
document.addEventListener('mousedown', (e) => { mouse.buttons[e.button] = true; });
document.addEventListener('mouseup', (e) => { mouse.buttons[e.button] = false; });

document.addEventListener('pointerlockchange', () => {
  mouse.locked = !!document.pointerLockElement;
});

export function flushInput() {
  mouse.dx = _pendingDx;
  mouse.dy = _pendingDy;
  _pendingDx = 0;
  _pendingDy = 0;
  justPressed.clear();
  justReleased.clear();
}

export function requestPointerLock(el: HTMLElement) {
  el.requestPointerLock();
}

export function exitPointerLock() {
  document.exitPointerLock();
}

export function isDown(code: string): boolean { return !!keys[code]; }
export function wasPressed(code: string): boolean { return justPressed.has(code); }
