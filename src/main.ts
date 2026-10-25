import * as THREE from 'three';
import { initUI } from './ui/hud';
import { PlayerController } from './player/controller';
import { buildTerrain, buildWorld } from './world/builders';
import { flushInput, keys, mouse, wasPressed, requestPointerLock } from './core/input';
import { initAudio } from './core/audio';
import { gameState } from './core/store';
import { ChapterManager } from './systems/chapters';

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x7ba3c0);
scene.fog = new THREE.Fog(0x7ba3c0, 80, 300);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// FPS counter
let frameCount = 0, lastFPSTime = performance.now(), fpsEl: HTMLElement;

async function init() {
  // UI
  initUI();

  // FPS
  fpsEl = document.createElement('div');
  fpsEl.style.cssText = 'position:fixed;top:8px;right:8px;color:#fff;font-size:11px;opacity:0.5;pointer-events:none;font-family:monospace;z-index:1000;';
  document.body.appendChild(fpsEl);

  // Audio
  initAudio();

  // World
  buildTerrain(scene);
  buildWorld(scene);

  // Player
  const player = new PlayerController(camera, scene);

  // Chapter manager
  const chapterManager = new ChapterManager(scene, player, camera);
  chapterManager.start();

  // Pointer lock
  canvas.addEventListener('click', () => {
    if (!mouse.locked) requestPointerLock(canvas);
  });

  // Game loop
  let last = performance.now();
  function animate(now: number) {
    requestAnimationFrame(animate);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    flushInput();
    chapterManager.update(dt);
    player.update(dt);
    renderer.render(scene, camera);

    // FPS
    frameCount++;
    if (now - lastFPSTime > 1000) {
      fpsEl.textContent = `${Math.round(frameCount * 1000 / (now - lastFPSTime))} fps`;
      frameCount = 0;
      lastFPSTime = now;
    }
  }
  requestAnimationFrame(animate);
}

init();
