import * as THREE from 'three';
import { PlayerController } from '../player/controller';
import { gameState, modStat, grantAchievement, showToast } from '../core/store';
import { keys, mouse, wasPressed } from '../core/input';
import { NAMES } from '../config/names';
import { TUNING } from '../config/tuning';
import { NOTIFICATIONS } from '../config/notifications';
import {
  showInteractPrompt, hideInteractPrompt,
  showCaptionCb as showCaption, showTitleCardCb as showTitleCard,
  showDialogueCb as showDialogue,
  hideDialogue, showPhoneOverlay, hidePhoneOverlay,
  toggleDebugMenuWithManager as toggleDebugMenu,
  toggleJournal, togglePhone, showExpenseReport,
  showObjective, updateHyperAgent
} from '../ui/hud';
import { getTerrainY } from '../world/builders';
import { playSound } from '../core/audio';

// ---- CHAPTER MANAGER ----

export class ChapterManager {
  scene: THREE.Scene;
  player: PlayerController;
  camera: THREE.PerspectiveCamera;
  chapter = 'title';
  chapterTime = 0;
  chapterObjects: THREE.Object3D[] = [];
  dialoguePending = false;

  // Minigame state
  bucketFill = [0, 0]; // [left, right] 0-1
  bucketSway = [0, 0];
  bucketVelocity = [0, 0];
  bucketDay = 1;
  bucketAttempt = 0;
  inHorseStance = false;
  horseStanceTimer = 0;
  horseStanceTarget = { x: 0.5, y: 0.5 };
  horseStanceTargetTimer = 0;

  yakPhase = 0;
  yakRopeGrabbed = false;
  yakTension = 0;
  yakBurstTimer = 0;
  yakBurnCount = 0;
  yakDistanceMoved = 0;
  yakObj: THREE.Mesh | null = null;
  yakTargetObj: THREE.Mesh | null = null;

  gerStep = 0;
  gerParts: THREE.Mesh[] = [];

  foodCourse = 0;
  foodMeter = 0;
  aaruulTimer = 0;
  courageBuilding = false;
  courageTimer = 0;

  cardHand: number[] = [];
  cardTableCards: number[][] = [[], [], [], []];
  cardScores = [15, 15, 15, 15];
  cardTrump = 0;
  cardTrick: (number | null)[] = [null, null, null, null];
  cardLedPlayer = -1;
  cardWaitingForPlayer = false;
  cardTrickCount = 0;
  cardHandCount = 0;
  cardTrickWins = [0, 0, 0, 0];
  cardExchangeDone = false;

  tagRound = 0;
  tagTimer = 0;
  taggedKids = new Set<string>();
  kidsObj: Record<string, THREE.Mesh> = {};
  kidVelocities: Record<string, THREE.Vector3> = {};

  englishWords: string[] = [];
  englishWordIndex = 0;
  englishReps = 0;
  currentStudent = 0;

  notifTimer = 0;
  notifIndex = 0;
  phonePutDownBond = false;

  gerHorseStanceOverlay: HTMLElement | null = null;
  bucketOverlay: HTMLElement | null = null;
  yakOverlay: HTMLElement | null = null;
  cardOverlay: HTMLElement | null = null;
  tagOverlay: HTMLElement | null = null;
  englishOverlay: HTMLElement | null = null;
  finaleOverlay: HTMLElement | null = null;
  oooInput: HTMLInputElement | null = null;

  constructor(scene: THREE.Scene, player: PlayerController, camera: THREE.PerspectiveCamera) {
    this.scene = scene;
    this.player = player;
    this.camera = camera;
  }

  start() {
    this.goToChapter('title');
    // Debug menu listener
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Backquote') toggleDebugMenu(this);
      if (e.code === 'Tab') { e.preventDefault(); toggleJournal(); }
      if (e.code === 'KeyP') togglePhone();
      if (e.code === 'Escape') this.showPause();
    });
  }

  goToChapter(id: string) {
    this.clearChapterObjects();
    this.chapter = id;
    this.chapterTime = 0;
    gameState.chapter = id;
    hideDialogue();
    hidePhoneOverlay();
    this.removeAllOverlays();

    switch (id) {
      case 'title': this.initTitle(); break;
      case 'prologue': this.initPrologue(); break;
      case 'ch1': this.initCh1(); break;
      case 'ch2': this.initCh2(); break;
      case 'ch3': this.initCh3(); break;
      case 'ch4': this.initCh4(); break;
      case 'ch5': this.initCh5(); break;
      case 'ch6': this.initCh6(); break;
      case 'ch7': this.initCh7(); break;
      case 'ch8': this.initCh8(); break;
      case 'finale': this.initFinale(); break;
      case 'freeroam': this.initFreeRoamMode(); break;
    }
  }

  update(dt: number) {
    this.chapterTime += dt;
    this.tickNotifications(dt);

    switch (this.chapter) {
      case 'title': this.updateTitle(dt); break;
      case 'prologue': this.updatePrologue(dt); break;
      case 'ch1': this.updateCh1(dt); break;
      case 'ch2': this.updateCh2(dt); break;
      case 'ch3': this.updateCh3(dt); break;
      case 'ch4': this.updateCh4(dt); break;
      case 'ch5': this.updateCh5(dt); break;
      case 'ch6': this.updateCh6(dt); break;
      case 'ch7': this.updateCh7(dt); break;
      case 'ch8': this.updateCh8(dt); break;
      case 'finale': this.updateFinale(dt); break;
    }
  }

  clearChapterObjects() {
    for (const obj of this.chapterObjects) this.scene.remove(obj);
    this.chapterObjects = [];
  }

  addToChapter(obj: THREE.Object3D) {
    this.scene.add(obj);
    this.chapterObjects.push(obj);
    return obj;
  }

  removeAllOverlays() {
    [this.bucketOverlay, this.yakOverlay, this.cardOverlay, this.tagOverlay,
     this.englishOverlay, this.finaleOverlay, this.gerHorseStanceOverlay].forEach(el => el?.remove());
    this.bucketOverlay = null;
    this.yakOverlay = null;
    this.cardOverlay = null;
    this.tagOverlay = null;
    this.englishOverlay = null;
    this.finaleOverlay = null;
    this.gerHorseStanceOverlay = null;
    this.oooInput = null;
  }

  tickNotifications(dt: number) {
    if (gameState.stats.signal === 0) return;
    this.notifTimer += dt;
    if (this.notifTimer > 8) {
      this.notifTimer = 0;
      gameState.stats.notifications += Math.floor(Math.random() * 3) + 1;
    }
  }

  showPause() {
    const el = document.createElement('div');
    el.id = 'pause-menu';
    el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9999;gap:16px;color:#fff;font-family:system-ui;';
    el.innerHTML = `
      <h2 style="font-size:32px;font-weight:900;margin:0;">PAUSED</h2>
      <button id="p-resume" style="${btnStyle}">Resume</button>
      <button id="p-restart" style="${btnStyle}">Restart Chapter</button>
      <button id="p-title" style="${btnStyle}">Title Screen</button>
    `;
    document.body.appendChild(el);
    el.querySelector('#p-resume')!.addEventListener('click', () => el.remove());
    el.querySelector('#p-restart')!.addEventListener('click', () => { el.remove(); this.goToChapter(this.chapter); });
    el.querySelector('#p-title')!.addEventListener('click', () => { el.remove(); this.goToChapter('title'); });
  }

  // ---- TITLE ----
  initTitle() {
    this.player.enabled = false;
    this.player.camera.position.set(0, 3, 20);
    this.player.yaw = 0;
    this.player.pitch = -0.05;

    // Sky color for Mongolia
    this.scene.background = new THREE.Color(0x4a6b8a);

    const el = document.createElement('div');
    el.id = 'title-screen';
    el.style.cssText = 'position:fixed;inset:0;background:linear-gradient(180deg,#1a2a3a 0%,#2d4a2d 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9999;gap:20px;font-family:system-ui;';
    el.innerHTML = `
      <h1 style="font-size:72px;font-weight:900;color:#fff;margin:0;letter-spacing:0.08em;text-shadow:2px 4px 8px rgba(0,0,0,0.8);">OUT OF OFFICE</h1>
      <p style="color:rgba(255,255,255,0.7);font-size:18px;max-width:480px;text-align:center;line-height:1.6;margin:0;">
        A first-person adventure: ${NAMES.player} Baghadjian goes from closing a deal in NYC to living with a nomadic family on the Mongolian steppe.
      </p>
      <div style="display:flex;gap:12px;margin-top:16px;">
        <button id="btn-start" style="${btnStyle}">New Game</button>
        <button id="btn-debug" style="${btnStyleSecondary}">Chapter Select</button>
      </div>
      <p style="color:rgba(255,255,255,0.4);font-size:13px;margin-top:8px;">Click to lock mouse. WASD move, mouse look, E interact.</p>
    `;
    document.body.appendChild(el);
    this.chapterObjects.push({ userData: { cleanup: () => el.remove() } } as any);
    el.querySelector('#btn-start')!.addEventListener('click', () => {
      el.remove();
      this.goToChapter('prologue');
    });
    el.querySelector('#btn-debug')!.addEventListener('click', () => {
      el.remove();
      toggleDebugMenu(this);
    });
  }

  updateTitle(_dt: number) {}

  // ---- PROLOGUE: Closing Day ----
  initPrologue() {
    this.player.enabled = true;
    this.player.camera.position.set(0, 1.7, 8);
    this.player.yaw = Math.PI;
    this.scene.background = new THREE.Color(0x8ab0cc);
    showObjective('Pack your duffel bag. Set your out-of-office. Walk out the door.');

    // NYC room
    const room = this.buildNYCRoom();
    this.chapterObjects.push(room);
    this.scene.add(room);

    showTitleCard('PROLOGUE: Closing Day', 'NYC | 7:14 AM', () => {
      setTimeout(() => this.startPrologueDialogue(), 500);
    });
  }

  buildNYCRoom(): THREE.Group {
    const g = new THREE.Group();

    // Floor
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 12),
      new THREE.MeshLambertMaterial({ color: 0x8b7355 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 0);
    g.add(floor);

    // Walls
    const wallMat = new THREE.MeshLambertMaterial({ color: 0xe8e0d0 });
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(12, 4), wallMat);
    backWall.position.set(0, 2, -6);
    g.add(backWall);

    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(12, 4), wallMat);
    leftWall.position.set(-6, 2, 0);
    leftWall.rotation.y = Math.PI / 2;
    g.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(12, 4), wallMat);
    rightWall.position.set(6, 2, 0);
    rightWall.rotation.y = -Math.PI / 2;
    g.add(rightWall);

    // Window with procedural NYC skyline
    const windowFrame = new THREE.Mesh(
      new THREE.PlaneGeometry(4, 2.5),
      new THREE.MeshLambertMaterial({ color: 0x6a9bc0 })
    );
    windowFrame.position.set(3, 2.2, -5.9);
    g.add(windowFrame);

    // City buildings behind window
    for (let i = 0; i < 8; i++) {
      const h = 0.3 + Math.random() * 1.2;
      const w = 0.2 + Math.random() * 0.3;
      const bldg = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, 0.05),
        new THREE.MeshLambertMaterial({ color: 0x333344 })
      );
      bldg.position.set(1.5 + (i - 4) * 0.5, 2 - (1 - h) * 0.5, -5.85);
      // lit windows
      for (let j = 0; j < 3; j++) {
        const win = new THREE.Mesh(
          new THREE.PlaneGeometry(0.05, 0.05),
          new THREE.MeshBasicMaterial({ color: Math.random() > 0.5 ? 0xffff88 : 0x888888 })
        );
        win.position.set((j - 1) * 0.08, (Math.random() - 0.5) * h * 0.6, 0.03);
        bldg.add(win);
      }
      g.add(bldg);
    }

    // Desk
    const deskMat = new THREE.MeshLambertMaterial({ color: 0x6b4f2a });
    const desk = new THREE.Mesh(new THREE.BoxGeometry(2, 0.08, 0.9), deskMat);
    desk.position.set(0, 0.74, -3);
    g.add(desk);

    // Laptop on desk
    const laptop = this.makeInteractable('laptop', new THREE.Vector3(0, 0.82, -3.1),
      'E: Check email', 0x222222, new THREE.BoxGeometry(0.6, 0.02, 0.4));
    g.add(laptop);

    // Duffel bag
    const duffel = this.makeInteractable('duffel', new THREE.Vector3(-0.5, 0.05, -1),
      'E: Duffel bag', 0x2a4020, new THREE.CapsuleGeometry(0.15, 0.5, 3, 6));
    g.add(duffel);

    // 30 under 30 cert on wall
    const cert = new THREE.Mesh(
      new THREE.PlaneGeometry(0.5, 0.35),
      new THREE.MeshLambertMaterial({ color: 0xf5e6c8 })
    );
    cert.position.set(-2, 2.5, -5.9);
    g.add(cert);

    const certText = new THREE.Mesh(
      new THREE.PlaneGeometry(0.4, 0.05),
      new THREE.MeshBasicMaterial({ color: 0x333300 })
    );
    certText.position.set(-2, 2.55, -5.88);
    g.add(certText);

    // Door out
    const doorFrame = new THREE.Mesh(
      new THREE.BoxGeometry(1.0, 2.2, 0.1),
      new THREE.MeshLambertMaterial({ color: 0x5a3a1a })
    );
    doorFrame.position.set(-4.5, 1.1, 2);
    doorFrame.rotation.y = Math.PI / 2;
    g.add(doorFrame);

    const doorLabel = this.makeInteractable('door', new THREE.Vector3(-4.5, 1.1, 2),
      'E: Leave for the airport', 0x5a3a1a, new THREE.BoxGeometry(0.1, 2.2, 1.0));
    g.add(doorLabel);

    // Ambient light
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    g.add(ambient);
    const sun = new THREE.DirectionalLight(0xfff4e0, 1.0);
    sun.position.set(5, 8, 5);
    g.add(sun);

    return g;
  }

  makeInteractable(id: string, pos: THREE.Vector3, prompt: string, color: number, geo: THREE.BufferGeometry): THREE.Mesh {
    const mat = new THREE.MeshLambertMaterial({ color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    mesh.userData = { interactable: true, id, prompt };
    return mesh;
  }

  startPrologueDialogue() {
    showDialogue('Calendar', 'Subject: Closed. The deal is done. Congratulations, Marc.', () => {
      showDialogue('Team Hyper', '🎉🎉🎉 LETS GOO!!! Sam is thrilled. You earned this.', () => {
        showObjective('Pack your bag. Set OOO. Walk out the door.');
      });
    });
  }

  prologuePacked = false;
  prologueOOOSet = false;
  prologueStep = 0;

  updatePrologue(dt: number) {
    // Interaction raycast
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const objs = this.chapterObjects.flatMap(o => {
      const hits: THREE.Object3D[] = [];
      o.traverse(c => { if (c.userData.interactable) hits.push(c); });
      return hits;
    });
    const hits = raycaster.intersectObjects(objs, false);
    if (hits.length > 0 && hits[0].distance < 4) {
      const obj = hits[0].object;
      showInteractPrompt(obj.userData.prompt);
      if (wasPressed('KeyE')) {
        this.handlePrologueInteract(obj.userData.id);
      }
    } else {
      hideInteractPrompt();
    }
  }

  handlePrologueInteract(id: string) {
    if (id === 'laptop') {
      if (!this.prologuePacked) {
        showDialogue(NAMES.player, 'Better pack first.', undefined);
        return;
      }
      // OOO screen
      this.showOOOScreen();
    } else if (id === 'duffel') {
      if (!this.prologuePacked) {
        this.prologuePacked = true;
        showToast('Duffel packed! Passport, cards, $50 cash.', '#4CAF50', 2500);
        showObjective('Set your out-of-office reply on the laptop.');
      }
    } else if (id === 'door') {
      if (!this.prologuePacked || !this.prologueOOOSet) {
        showDialogue(NAMES.player, !this.prologuePacked ? 'I should pack first.' : 'Better set OOO first.', undefined);
        return;
      }
      // Go to ch1
      this.taxiCutscene();
    }
  }

  showOOOScreen() {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.9);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9999;gap:16px;font-family:system-ui;color:#fff;';
    el.innerHTML = `
      <div style="background:#1a1a2e;border-radius:12px;padding:32px;max-width:500px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.5);">
        <div style="font-size:12px;color:#888;margin-bottom:4px;">Gmail – Compose</div>
        <div style="font-size:16px;font-weight:700;margin-bottom:16px;">Out of Office Auto-Reply</div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;">
          ${['I\'m currently off the grid in Mongolia. No ETA. The yaks can\'t Slack.',
             'Status: acquired. Location: steppe. Returns: unclear.',
             'Inbox zero achieved via geography. Try again in 6 weeks.',
             'For urgent matters, the answer is still no.'].map((opt, i) =>
            `<label style="display:flex;align-items:center;gap:8px;padding:8px;border-radius:6px;border:1px solid #333;cursor:pointer;">
              <input type="radio" name="ooo" value="${i}" ${i === 0 ? 'checked' : ''}> ${opt}
            </label>`
          ).join('')}
        </div>
        <div style="margin-bottom:12px;">
          <div style="font-size:13px;color:#888;margin-bottom:6px;">Or write your own:</div>
          <input id="ooo-custom" type="text" placeholder="Type your OOO message..." maxlength="120"
            style="width:100%;padding:8px;border-radius:6px;border:1px solid #444;background:#0d0d1a;color:#fff;font-size:14px;box-sizing:border-box;">
        </div>
        <button id="ooo-set" style="${btnStyle}">Set Auto-Reply &amp; Pack Up</button>
      </div>
    `;
    document.body.appendChild(el);
    el.querySelector('#ooo-set')!.addEventListener('click', () => {
      const custom = (el.querySelector('#ooo-custom') as HTMLInputElement).value.trim();
      const radios = el.querySelectorAll('input[type=radio]') as NodeListOf<HTMLInputElement>;
      const presets = [
        "I'm currently off the grid in Mongolia. No ETA. The yaks can't Slack.",
        'Status: acquired. Location: steppe. Returns: unclear.',
        'Inbox zero achieved via geography. Try again in 6 weeks.',
        'For urgent matters, the answer is still no.'
      ];
      let chosen = presets[0];
      for (const r of Array.from(radios)) {
        if (r.checked) chosen = presets[parseInt(r.value)];
      }
      if (custom) chosen = custom;
      gameState.oooMessage = chosen;
      this.prologueOOOSet = true;
      el.remove();
      showToast('OOO set. You\'re done here.', '#4CAF50', 2500);
      showObjective('Walk out the door.');
    });
  }

  taxiCutscene() {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;background:#1a1008;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9999;font-family:system-ui;overflow:hidden;';
    el.innerHTML = `
      <div id="taxi-scroll" style="width:100%;height:120px;position:relative;overflow:hidden;background:#0a0a15;">
        <div id="skyline" style="position:absolute;bottom:0;left:0;width:2000px;height:100%;display:flex;align-items:flex-end;"></div>
      </div>
      <div style="position:absolute;bottom:40px;color:rgba(255,255,255,0.7);font-size:16px;">JFK International Airport...</div>
      <div style="position:absolute;top:20px;color:#fff;font-size:13px;opacity:0.6;">Notifications: ${gameState.stats.notifications} and climbing...</div>
    `;
    document.body.appendChild(el);

    // Build skyline
    const skyline = el.querySelector('#skyline') as HTMLElement;
    for (let i = 0; i < 40; i++) {
      const h = 20 + Math.random() * 80;
      const w = 15 + Math.random() * 25;
      const b = document.createElement('div');
      b.style.cssText = `width:${w}px;height:${h}px;background:#1a1a2e;border-top:1px solid #2a2a4e;flex-shrink:0;margin-right:2px;`;
      skyline.appendChild(b);
    }

    // Scroll animation
    let scroll = 0;
    const interval = setInterval(() => {
      scroll += 2;
      (el.querySelector('#taxi-scroll') as HTMLElement).scrollLeft = scroll;
    }, 16);

    setTimeout(() => {
      clearInterval(interval);
      el.remove();
      this.goToChapter('ch1');
    }, 3000);
  }

  // ---- CHAPTER 1: Airplane Mode ----
  initCh1() {
    this.player.enabled = true;
    this.player.camera.position.set(0, 2, 10);
    this.player.yaw = Math.PI;
    this.scene.background = new THREE.Color(0x7ba3c0);
    showObjective('Board the plane. Toggle airplane mode. Land in Ulaanbaatar.');
    showTitleCard('Chapter 1', 'Airplane Mode', () => {
      this.buildPlane();
    });
    gameState.stats.signal = 5;
  }

  buildPlane() {
    const g = new THREE.Group();
    // Cabin floor
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(4, 20), new THREE.MeshLambertMaterial({ color: 0x5a4a3a }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 0);
    g.add(floor);

    // Walls/ceiling
    const wallMat = new THREE.MeshLambertMaterial({ color: 0xd4c8b8 });
    [[-2, 1.5, 0, 0], [2, 1.5, 0, Math.PI]].forEach(([x, y, z, ry]) => {
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(20, 3), wallMat);
      wall.position.set(x as number, y as number, z as number);
      wall.rotation.y = (ry as number) + Math.PI / 2;
      g.add(wall);
    });

    // Seats
    for (let row = 0; row < 8; row++) {
      for (let side = 0; side < 2; side++) {
        const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.5), new THREE.MeshLambertMaterial({ color: 0x2a4060 }));
        seat.position.set((side === 0 ? -1.2 : 1.2), 0.4, -2 + row * 2);
        g.add(seat);
      }
    }

    // Window seat marker (interactive)
    const seatInteract = this.makeInteractable('plane_seat', new THREE.Vector3(-1.2, 0.4, -8), 'E: Take window seat', 0x3a5080, new THREE.BoxGeometry(0.5, 0.6, 0.5));
    g.add(seatInteract);

    // Overhead bins
    for (let row = 0; row < 8; row++) {
      const bin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.4, 0.5), new THREE.MeshLambertMaterial({ color: 0xd0c8b8 }));
      bin.position.set(0, 2.2, -2 + row * 2);
      g.add(bin);
    }

    // Window
    const window1 = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.4), new THREE.MeshLambertMaterial({ color: 0x4a80cc }));
    window1.position.set(-1.95, 1.6, -8);
    window1.rotation.y = Math.PI / 2;
    g.add(window1);

    // Lights
    g.add(new THREE.AmbientLight(0xfff8f0, 0.7));
    const overhead = new THREE.DirectionalLight(0xffffff, 0.3);
    overhead.position.set(0, 3, 0);
    g.add(overhead);

    this.addToChapter(g);
    this.ch1Phase = 0;
  }

  ch1Phase = 0;
  ch1Seated = false;
  ch1PhoneDone = false;
  ch1TurbulenceActive = false;
  ch1TurbulenceTimer = 0;
  ch1CoffeeSpill = 0;
  ch1CoffeeEl: HTMLElement | null = null;

  updateCh1(dt: number) {
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const objs: THREE.Object3D[] = [];
    this.chapterObjects.forEach(o => o.traverse(c => { if (c.userData.interactable) objs.push(c); }));
    const hits = raycaster.intersectObjects(objs, false);

    if (hits.length > 0 && hits[0].distance < 4) {
      showInteractPrompt(hits[0].object.userData.prompt);
      if (wasPressed('KeyE')) this.handleCh1Interact(hits[0].object.userData.id);
    } else {
      hideInteractPrompt();
    }

    // Turbulence coffee minigame
    if (this.ch1TurbulenceActive) {
      this.ch1TurbulenceTimer -= dt;
      const spill = (Math.abs(mouse.dx) + Math.abs(mouse.dy)) * 0.002;
      this.ch1CoffeeSpill = Math.min(1, this.ch1CoffeeSpill + spill * dt * 3);
      if (this.ch1CoffeeEl) {
        (this.ch1CoffeeEl.querySelector('#spill-fill') as HTMLElement).style.width = `${this.ch1CoffeeSpill * 100}%`;
      }
      if (this.ch1TurbulenceTimer <= 0 || this.ch1CoffeeSpill >= 1) {
        this.ch1TurbulenceActive = false;
        this.ch1CoffeeEl?.remove();
        this.ch1CoffeeEl = null;
        if (this.ch1CoffeeSpill < 0.3) { showToast('Coffee saved! Patience +3', '#4CAF50'); modStat('patience', 3); }
        else showToast('Coffee spilled... at least the deal closed.', '#ff8800');
        this.ch1ContinueAfterTurbulence();
      }
    }

    // Phase: window timelapse -> arrival
    if (this.ch1Phase === 2 && this.chapterTime > 5) {
      this.ch1Phase = 3;
      this.showWindowTimelapse();
    }
  }

  handleCh1Interact(id: string) {
    if (id === 'plane_seat' && !this.ch1Seated) {
      this.ch1Seated = true;
      showDialogue('Flight Attendant', 'Can I get you some coffee before takeoff?', () => {
        this.ch1Phase = 1;
        setTimeout(() => this.triggerTurbulence(), 2000);
      });
    }
  }

  triggerTurbulence() {
    this.ch1TurbulenceActive = true;
    this.ch1TurbulenceTimer = 4;
    this.ch1CoffeeSpill = 0;
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;bottom:140px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.8);color:#fff;padding:16px 24px;border-radius:12px;z-index:9998;text-align:center;font-family:system-ui;';
    el.innerHTML = `
      <div style="font-size:15px;margin-bottom:8px;">TURBULENCE. Hold still. Don't spill the coffee.</div>
      <div style="font-size:12px;color:#aaa;margin-bottom:8px;">Move mouse slowly to avoid spilling.</div>
      <div style="background:rgba(255,255,255,0.2);border-radius:4px;height:12px;width:200px;overflow:hidden;">
        <div id="spill-fill" style="height:100%;width:0%;background:#ff6644;border-radius:4px;transition:width 0.1s;"></div>
      </div>
      <div style="font-size:11px;color:#aaa;margin-top:4px;">Spill meter</div>
    `;
    document.body.appendChild(el);
    this.ch1CoffeeEl = el;
  }

  ch1ContinueAfterTurbulence() {
    showDialogue(NAMES.player, 'Time to go dark.', () => {
      this.showAirplaneMode();
    });
  }

  showAirplaneMode() {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;bottom:160px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.9);border-radius:12px;padding:16px 20px;z-index:9998;font-family:system-ui;color:#fff;min-width:220px;';
    el.innerHTML = `
      <div style="font-size:16px;font-weight:700;margin-bottom:4px;">iPhone</div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-top:1px solid #333;">
        <span>Airplane Mode</span>
        <div id="airplane-toggle" style="width:44px;height:24px;background:#555;border-radius:12px;cursor:pointer;transition:background 0.2s;">
          <div style="width:20px;height:20px;background:#fff;border-radius:50%;margin:2px;transition:margin 0.2s;"></div>
        </div>
      </div>
      <div style="font-size:12px;color:#888;margin-top:4px;">Signal: ${gameState.stats.signal} bars | ${gameState.stats.notifications} unread</div>
    `;
    document.body.appendChild(el);
    el.querySelector('#airplane-toggle')!.addEventListener('click', () => {
      gameState.stats.signal = 0;
      gameState.stats.notifications; // freeze
      el.remove();
      showCaption('First time in four years.', 3000, () => {
        this.ch1Phase = 2;
        this.chapterTime = 0;
      });
    });
  }

  showWindowTimelapse() {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;z-index:9997;pointer-events:none;';
    el.innerHTML = `
      <canvas id="window-canvas" style="width:100%;height:100%;"></canvas>
    `;
    document.body.appendChild(el);

    const canvas = el.querySelector('#window-canvas') as HTMLCanvasElement;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext('2d')!;

    let t = 0;
    const frames = ['city', 'ocean', 'clouds', 'steppe'];
    const frameInterval = setInterval(() => {
      t++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw black bars to simulate window
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, canvas.width * 0.2, canvas.height);
      ctx.fillRect(canvas.width * 0.8, 0, canvas.width * 0.2, canvas.height);
      ctx.fillRect(0, 0, canvas.width, canvas.height * 0.15);
      ctx.fillRect(0, canvas.height * 0.85, canvas.width, canvas.height * 0.15);

      const phase = frames[Math.min(t - 1, frames.length - 1)];
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(canvas.width * 0.22, canvas.height * 0.17, canvas.width * 0.56, canvas.height * 0.66, 10);
      ctx.clip();

      if (phase === 'city') {
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < 20; i++) {
          ctx.fillStyle = `hsl(${200 + i * 5},30%,${20 + i}%)`;
          ctx.fillRect(i * 30, canvas.height * 0.4 + Math.sin(i) * 50, 25, 80 + Math.random() * 60);
        }
      } else if (phase === 'ocean') {
        ctx.fillStyle = '#0a2a4a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#4a90c0';
        ctx.fillRect(0, canvas.height * 0.5, canvas.width, canvas.height * 0.5);
      } else if (phase === 'clouds') {
        ctx.fillStyle = '#aaccee';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        for (let i = 0; i < 5; i++) {
          ctx.beginPath();
          ctx.arc(i * 120, canvas.height * 0.5 + Math.sin(i) * 30, 40, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        ctx.fillStyle = '#4a7a3a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#5a9a4a';
        for (let i = 0; i < 30; i++) {
          ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 2, 2);
        }
      }
      ctx.restore();

      if (t >= 4) {
        clearInterval(frameInterval);
        setTimeout(() => {
          el.remove();
          this.arriveUlaanbaatar();
        }, 800);
      }
    }, 1200);
    this.chapterObjects.push({ userData: { cleanup: () => el.remove() } } as any);
  }

  arriveUlaanbaatar() {
    showCaption('Chinggis Khaan International Airport, Ulaanbaatar', 3000, () => {
      showDialogue('Ganbold', '"MARC" *holds up a sign and nods*', () => {
        this.driveToSteppe();
      });
    });
  }

  driveToSteppe() {
    // Transition to Mongolia scene
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;background:#2a4a2a;z-index:9997;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:system-ui;color:#fff;overflow:hidden;';
    el.innerHTML = `
      <div style="font-size:20px;margin-bottom:12px;">Bouncing across the steppe...</div>
      <div id="road" style="width:200px;height:8px;background:#5a4a2a;border-radius:4px;overflow:hidden;position:relative;">
        <div style="position:absolute;width:40px;height:100%;background:#fff;animation:roadAnim 0.5s linear infinite;border-radius:4px;"></div>
      </div>
      <style>@keyframes roadAnim { from { left:-40px; } to { left:200px; } }</style>
      <div style="margin-top:16px;font-size:14px;color:rgba(255,255,255,0.6);">UAZ van, dirt tracks, 4 hours of bumps</div>
    `;
    document.body.appendChild(el);

    setTimeout(() => {
      // Ovoo
      el.innerHTML = `
        <div style="text-align:center;max-width:500px;padding:24px;">
          <div style="font-size:48px;margin-bottom:12px;">🗿</div>
          <div style="font-size:22px;font-weight:700;margin-bottom:8px;">Ovoo</div>
          <div style="font-size:15px;color:rgba(255,255,255,0.8);line-height:1.6;">Ganbold stops at a sacred stone cairn wrapped in blue silk scarves. He walks clockwise three times and adds a stone. He looks at you.</div>
          <button id="ovoo-walk" style="${btnStyle};margin-top:16px;">Walk clockwise three times and add a stone (E)</button>
        </div>
      `;
      el.querySelector('#ovoo-walk')!.addEventListener('click', () => {
        modStat('bond', 2);
        showToast('Bond +2 (Respect for local customs)', '#4CAF50', 2500);
        el.remove();
        this.arrivalAtCamp();
      });
    }, 3000);
    this.chapterObjects.push({ userData: { cleanup: () => el.remove() } } as any);
  }

  arrivalAtCamp() {
    this.player.camera.position.set(0, 1.7, 50);
    this.scene.background = new THREE.Color(0x2a3a4a);
    showCaption('The camp at dusk.', 2000, () => {
      showDialogue('Baatar', '"Sain baina uu!" *huge warm grin, gestures to enter the ger*', () => {
        this.gerEntryEtiquette();
      });
    });
  }

  gerEntryEtiquette() {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;bottom:100px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.9);border-radius:12px;padding:20px 28px;z-index:9998;font-family:system-ui;color:#fff;max-width:480px;text-align:center;';
    el.innerHTML = `
      <div style="font-size:18px;font-weight:700;margin-bottom:12px;">Entering the Ger</div>
      <div style="font-size:14px;color:#ccc;margin-bottom:16px;">You remember reading about this. The etiquette matters.</div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${[
          ['Step OVER the threshold', 'threshold'],
          ['Move clockwise inside', 'clockwise'],
          ['Accept the tea with RIGHT hand, left supporting elbow', 'tea_right']
        ].map(([label, id]) =>
          `<button data-etiq="${id}" style="${btnStyle}">${label}</button>`
        ).join('')}
      </div>
      <div id="etiq-feedback" style="min-height:24px;margin-top:12px;font-size:13px;color:#aaa;"></div>
    `;
    document.body.appendChild(el);

    let correct = 0;
    el.querySelectorAll('[data-etiq]').forEach((btn: Element) => {
      btn.addEventListener('click', () => {
        (btn as HTMLElement).style.background = '#2a6a2a';
        (btn as HTMLButtonElement).disabled = true;
        correct++;
        if (correct === 3) {
          (el.querySelector('#etiq-feedback') as HTMLElement).textContent = 'Baatar nods approvingly. "Sain!" (Good!)';
          modStat('bond', 5);
          showToast('Bond +5 (Perfect etiquette!)', '#4CAF50', 2500);
          setTimeout(() => {
            el.remove();
            this.goToChapter('ch2');
          }, 1800);
        }
      });
    });
    this.chapterObjects.push({ userData: { cleanup: () => el.remove() } } as any);
  }

  // ---- CHAPTER 2: Wax On, Water Off ----
  initCh2() {
    this.player.enabled = true;
    this.player.camera.position.set(0, 1.7, 30);
    this.player.yaw = 0;
    this.scene.background = new THREE.Color(0x4a7a9a);
    this.bucketFill = [0, 0];
    this.bucketSway = [0, 0];
    this.bucketVelocity = [0, 0];
    this.bucketDay = 1;
    this.bucketAttempt = 0;
    this.inHorseStance = false;
    showObjective(`Day ${this.bucketDay}/3: Carry water from the river. Deliver 70%+ to pass.`);
    showTitleCard('Chapter 2', 'Wax On, Water Off', () => {
      this.startBucketDay();
    });
  }

  startBucketDay() {
    showDialogue('Baatar', `*hands you two buckets and points downhill* "Daily."`, () => {
      this.bucketFill = [1, 1];
      this.bucketSway = [0, 0];
      this.buildBucketOverlay();
    });
  }

  buildBucketOverlay() {
    if (this.bucketOverlay) this.bucketOverlay.remove();
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;bottom:60px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.75);border-radius:12px;padding:12px 20px;z-index:9990;font-family:system-ui;color:#fff;text-align:center;min-width:300px;pointer-events:none;';
    el.innerHTML = `
      <div style="font-size:13px;color:#aaa;margin-bottom:6px;">Buckets (move gently, hold RMB to brace)</div>
      <div style="display:flex;gap:16px;justify-content:center;">
        <div>
          <div style="font-size:11px;color:#aaa;">Left</div>
          <div style="background:#333;border-radius:4px;height:60px;width:24px;margin:0 auto;overflow:hidden;position:relative;">
            <div id="bucket-left" style="position:absolute;bottom:0;width:100%;background:#4a9fd4;transition:height 0.1s;"></div>
          </div>
        </div>
        <div>
          <div style="font-size:11px;color:#aaa;">Right</div>
          <div style="background:#333;border-radius:4px;height:60px;width:24px;margin:0 auto;overflow:hidden;position:relative;">
            <div id="bucket-right" style="position:absolute;bottom:0;width:100%;background:#4a9fd4;transition:height 0.1s;"></div>
          </div>
        </div>
      </div>
      <div id="bucket-status" style="font-size:12px;margin-top:8px;color:#ccc;">Walk to the ger. Don't spill!</div>
    `;
    document.body.appendChild(el);
    this.bucketOverlay = el;
  }

  bucketAtGer = false;
  bucketFilledFromRiver = false;

  updateCh2(dt: number) {
    if (!this.bucketOverlay) return;

    // Spill physics based on mouse movement and movement speed
    const movingFast = keys['ShiftLeft'];
    const bracing = mouse.buttons[2];
    const turnRate = (Math.abs(mouse.dx) + Math.abs(mouse.dy)) * 0.01;
    const accelRate = movingFast ? 0.8 : 0.2;

    for (let i = 0; i < 2; i++) {
      if (this.bucketFill[i] <= 0) continue;
      // Sway physics
      const force = turnRate * TUNING.buckets.swayFromTurn + accelRate * TUNING.buckets.swayFromAccel;
      const damping = bracing ? 0.85 : 0.92;
      this.bucketVelocity[i] = this.bucketVelocity[i] * damping + force * (Math.random() > 0.5 ? 1 : -1) * dt * 3;
      this.bucketSway[i] += this.bucketVelocity[i];
      this.bucketSway[i] *= 0.95;

      const swayAngle = Math.abs(this.bucketSway[i]);
      const spillThreshold = TUNING.buckets.spillAngleDeg * Math.PI / 180;
      if (swayAngle > spillThreshold) {
        const excess = swayAngle - spillThreshold;
        const spill = excess * TUNING.buckets.spillRatePerSec * dt;
        this.bucketFill[i] = Math.max(0, this.bucketFill[i] - spill);
      }
    }

    // Update UI
    const leftFill = this.bucketOverlay.querySelector('#bucket-left') as HTMLElement;
    const rightFill = this.bucketOverlay.querySelector('#bucket-right') as HTMLElement;
    if (leftFill) leftFill.style.height = `${this.bucketFill[0] * 100}%`;
    if (rightFill) rightFill.style.height = `${this.bucketFill[1] * 100}%`;

    const status = this.bucketOverlay.querySelector('#bucket-status') as HTMLElement;
    const avg = (this.bucketFill[0] + this.bucketFill[1]) / 2;
    if (status) {
      if (avg > 0.8) status.textContent = 'Looking good! Keep it steady.';
      else if (avg > 0.5) status.textContent = 'Careful, you\'re losing water...';
      else status.textContent = 'Almost empty! Slow down!';
    }

    // Check if player is at ger position (0,0,0 area)
    const pos = this.player.camera.position;
    const distFromGer = Math.sqrt(pos.x * pos.x + pos.z * pos.z);
    if (distFromGer < 15 && !this.bucketAtGer && this.chapterTime > 5) {
      this.bucketAtGer = true;
      this.completeBucketDay();
    }

    // Horse stance
    if (this.inHorseStance) {
      this.updateHorseStance(dt);
    }
  }

  completeBucketDay() {
    const avg = (this.bucketFill[0] + this.bucketFill[1]) / 2;
    this.bucketOverlay?.remove();
    this.bucketOverlay = null;

    gameState.tracking.bucketsCarried += 2;
    gameState.tracking.waterDelivered += Math.round(avg * 20);

    if (this.bucketDay < 3) {
      // Fail first two days intentionally
      if (this.bucketDay === 1) {
        showDialogue('Baatar', '*laughs warmly, takes the buckets, then demonstrates carrying them perfectly still*', () => {
          this.startHorseStance();
        });
      } else if (avg >= TUNING.buckets.passThreshold || this.bucketDay === 2) {
        showDialogue('Baatar', '*nods approvingly, slaps you on the back*', () => {
          this.startHorseStance();
        });
      } else {
        showDialogue('Baatar', '*shakes head gently, mimes the stance again*', () => {
          this.startHorseStance();
        });
      }
      this.bucketDay++;
    } else {
      // Day 3 final check
      if (avg >= TUNING.buckets.passThreshold) {
        grantAchievement('Wax On Water Off');
        modStat('strength', 10);
        modStat('patience', 10);
        showDialogue('Baatar', '"Sain, sain! Very good!" *thumbs up*', () => {
          // Saraa toddler moment
          showCaption('Saraa toddles over and pours her tiny cup into the barrel too.', 3000, () => {
            this.goToChapter('ch3');
          });
        });
      } else {
        // Give one more try
        this.bucketDay = 3;
        this.bucketAtGer = false;
        showDialogue('Baatar', '*encouragingly mimes: slower, steadier*', () => {
          this.bucketFill = [1, 1];
          this.buildBucketOverlay();
        });
      }
    }
  }

  startHorseStance() {
    const target = TUNING.buckets.horseStanceSeconds[this.bucketDay - 1] || 20;
    this.inHorseStance = true;
    this.horseStanceTimer = 0;
    this.horseStanceTargetTimer = 0;
    this.horseStanceTarget = { x: 0.5, y: 0.5 };

    const el = document.createElement('div');
    el.id = 'horse-stance-overlay';
    el.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.85);border-radius:16px;padding:24px;z-index:9995;font-family:system-ui;color:#fff;text-align:center;width:300px;';
    el.innerHTML = `
      <div style="font-size:18px;font-weight:700;margin-bottom:8px;">Horse Stance Training</div>
      <div style="font-size:13px;color:#aaa;margin-bottom:16px;">Keep the crosshair in the circle for ${target} seconds. Stay perfectly still.</div>
      <div id="hs-arena" style="width:240px;height:240px;background:#1a1a1a;border-radius:8px;position:relative;margin:0 auto 12px;">
        <div id="hs-target" style="width:48px;height:48px;border:3px solid #4CAF50;border-radius:50%;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);"></div>
        <div id="hs-cursor" style="width:12px;height:12px;background:#fff;border-radius:50%;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);"></div>
      </div>
      <div id="hs-timer" style="font-size:24px;font-weight:900;">0 / ${target}s</div>
    `;
    document.body.appendChild(el);
    this.gerHorseStanceOverlay = el;

    showObjective(`Horse stance: hold for ${target} seconds. Move mouse gently.`);
  }

  updateHorseStance(dt: number) {
    const el = this.gerHorseStanceOverlay;
    if (!el) return;

    const arena = el.querySelector('#hs-arena') as HTMLElement;
    const target = el.querySelector('#hs-target') as HTMLElement;
    const cursor = el.querySelector('#hs-cursor') as HTMLElement;
    const timerEl = el.querySelector('#hs-timer') as HTMLElement;

    if (!arena) return;

    // Move target slowly
    this.horseStanceTargetTimer += dt;
    if (this.horseStanceTargetTimer > 2) {
      this.horseStanceTargetTimer = 0;
      this.horseStanceTarget.x = 0.15 + Math.random() * 0.7;
      this.horseStanceTarget.y = 0.15 + Math.random() * 0.7;
    }

    const targetIdx = this.bucketDay - 1;
    const targetTime = TUNING.buckets.horseStanceSeconds[Math.min(targetIdx, 2)] || 20;

    // Map mouse to cursor in arena (180px arena after padding)
    const cumX = Math.min(1, Math.max(0, 0.5 + mouse.dx * 0.01));
    const cumY = Math.min(1, Math.max(0, 0.5 + mouse.dy * 0.01));

    target.style.left = `${this.horseStanceTarget.x * 100}%`;
    target.style.top = `${this.horseStanceTarget.y * 100}%`;
    cursor.style.left = `${cumX * 100}%`;
    cursor.style.top = `${cumY * 100}%`;

    // Check if in circle
    const dx = cumX - this.horseStanceTarget.x;
    const dy = cumY - this.horseStanceTarget.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const inCircle = dist < 0.12;

    if (inCircle) {
      this.horseStanceTimer += dt;
      target.style.borderColor = '#4CAF50';
    } else {
      target.style.borderColor = '#ff4444';
    }

    timerEl.textContent = `${Math.floor(this.horseStanceTimer)} / ${targetTime}s`;

    if (this.horseStanceTimer >= targetTime) {
      this.inHorseStance = false;
      el.remove();
      this.gerHorseStanceOverlay = null;
      modStat('strength', 5);
      modStat('patience', 5);
      showToast('Strength +5, Patience +5! Ready for tomorrow.', '#4CAF50', 2500);

      setTimeout(() => {
        this.bucketAtGer = false;
        this.bucketFill = [1, 1];
        this.bucketSway = [0, 0];
        this.bucketVelocity = [0, 0];
        showObjective(`Day ${this.bucketDay}/3: Carry water. Deliver 70%+ to pass.`);
        this.buildBucketOverlay();
      }, 1500);
    }
  }

  // ---- CHAPTER 3: The Yak Who Would Not ----
  initCh3() {
    this.player.enabled = true;
    this.player.camera.position.set(10, 1.7, 40);
    this.player.yaw = -0.5;
    this.scene.background = new THREE.Color(0x5a8a6a);
    this.yakPhase = 0;
    this.yakRopeGrabbed = false;
    this.yakTension = 0;
    this.yakBurnCount = 0;
    this.yakDistanceMoved = 0;

    // Build yak
    const yakGroup = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.2, 2.5), new THREE.MeshLambertMaterial({ color: 0x4a3a2a }));
    body.position.set(0, 1.2, 0);
    yakGroup.add(body);
    // Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.7, 0.8), new THREE.MeshLambertMaterial({ color: 0x3a2a1a }));
    head.position.set(0, 1.8, -1.4);
    yakGroup.add(head);
    // Shaggy belly
    const belly = new THREE.Mesh(new THREE.CapsuleGeometry(0.6, 1.5, 3, 6), new THREE.MeshLambertMaterial({ color: 0x6a5a4a }));
    belly.position.set(0, 0.4, 0);
    belly.rotation.z = Math.PI / 2;
    yakGroup.add(belly);
    // Horns
    for (const side of [-0.35, 0.35]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.5, 4), new THREE.MeshLambertMaterial({ color: 0xd4c090 }));
      horn.position.set(side, 2.1, -1.4);
      horn.rotation.z = side * 0.8;
      yakGroup.add(horn);
    }
    yakGroup.position.set(20, 0, 20);
    this.yakObj = body;
    this.scene.add(yakGroup);
    this.chapterObjects.push(yakGroup);

    // Pen target
    const penTarget = new THREE.Mesh(
      new THREE.BoxGeometry(4, 1.5, 4),
      new THREE.MeshLambertMaterial({ color: 0x5a3a1a, transparent: true, opacity: 0.4 })
    );
    penTarget.position.set(0, 0.75, 10);
    this.scene.add(penTarget);
    this.chapterObjects.push(penTarget);
    this.yakTargetObj = penTarget;

    showTitleCard('Chapter 3', 'The Yak Who Would Not', () => {
      showDialogue('Baatar', '*points at Gerel who has wandered toward the forest, shrugs apologetically*', () => {
        showObjective('Approach Gerel carefully. Grab the rope. Lead her back to the pen.');
        this.buildYakOverlay();
      });
    });
  }

  buildYakOverlay() {
    if (this.yakOverlay) this.yakOverlay.remove();
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;bottom:60px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.8);border-radius:12px;padding:12px 20px;z-index:9990;font-family:system-ui;color:#fff;text-align:center;min-width:320px;pointer-events:none;';
    el.innerHTML = `
      <div style="font-size:13px;color:#aaa;margin-bottom:8px;">Rope Tension</div>
      <div style="background:#333;border-radius:4px;height:16px;width:280px;margin:0 auto 8px;overflow:hidden;position:relative;">
        <div id="yak-tension" style="height:100%;width:50%;background:#4CAF50;border-radius:4px;transition:width 0.1s;"></div>
        <div style="position:absolute;top:0;left:35%;height:100%;width:70px;border:2px solid #fff;border-radius:3px;pointer-events:none;"></div>
      </div>
      <div id="yak-status" style="font-size:12px;color:#ccc;">Get close to grab the rope (E)</div>
      <div id="yak-dist" style="font-size:11px;color:#888;margin-top:4px;"></div>
    `;
    document.body.appendChild(el);
    this.yakOverlay = el;
  }

  updateCh3(dt: number) {
    if (!this.yakObj) return;
    const yakPos = this.yakObj.parent!.position;
    const playerPos = this.player.camera.position;
    const dist = yakPos.distanceTo(new THREE.Vector3(playerPos.x, 0, playerPos.z));

    if (this.yakOverlay) {
      const distEl = this.yakOverlay.querySelector('#yak-dist') as HTMLElement;
      if (distEl) {
        if (!this.yakRopeGrabbed) distEl.textContent = `Distance: ${Math.round(dist)}m`;
        else {
          const penPos = this.yakTargetObj?.position || new THREE.Vector3(0, 0, 10);
          distEl.textContent = `To pen: ${Math.round(yakPos.distanceTo(penPos))}m`;
        }
      }
    }

    if (!this.yakRopeGrabbed) {
      // Phase 1: approach
      if (dist < 6) {
        showInteractPrompt('E: Grab rope');
        if (wasPressed('KeyE')) {
          this.yakRopeGrabbed = true;
          showToast('Rope grabbed!', '#4CAF50', 1500);
          const statusEl = this.yakOverlay?.querySelector('#yak-status') as HTMLElement;
          if (statusEl) statusEl.textContent = 'Hold LMB to pull. Release when she lunges!';
          this.yakBurstTimer = 2 + Math.random() * 2;
        }
      } else {
        hideInteractPrompt();
      }
    } else {
      hideInteractPrompt();
      // Phase 2: tug of war
      const pulling = mouse.buttons[0];
      const leaningBack = keys['KeyS'];

      let pullForce = 0;
      if (pulling) pullForce = 0.4 + gameState.stats.strength * 0.003;
      if (leaningBack) pullForce += 0.2;

      this.yakBurstTimer -= dt;
      if (this.yakBurstTimer <= 0) {
        // Gerel lunges
        this.yakBurstTimer = TUNING.yak.pullBurstEverySec[0] + Math.random() * (TUNING.yak.pullBurstEverySec[1] - TUNING.yak.pullBurstEverySec[0]);
        if (pulling) {
          // Rope burn
          this.yakBurnCount++;
          showToast('Rope burn! Release when she lunges!', '#ff4444', 1500);
          this.yakTension = 0.9;
        }
        const statusEl = this.yakOverlay?.querySelector('#yak-status') as HTMLElement;
        if (statusEl) statusEl.textContent = '*Gerel snorts and lunges! Release the rope!*';
        setTimeout(() => {
          if (statusEl) statusEl.textContent = 'Hold LMB to pull steadily.';
        }, 1200);
      }

      // Update tension
      this.yakTension += (pullForce - 0.2) * dt;
      this.yakTension = Math.max(0, Math.min(1, this.yakTension));

      // Move yak toward pen
      if (this.yakTension > 0.5) {
        const penPos = this.yakTargetObj?.position || new THREE.Vector3(0, 0, 10);
        const dir = penPos.clone().sub(yakPos).normalize();
        yakPos.addScaledVector(dir, 0.5 * dt);
        this.yakDistanceMoved += 0.5 * dt;
      }

      // Update tension UI
      const tensionEl = this.yakOverlay?.querySelector('#yak-tension') as HTMLElement;
      if (tensionEl) {
        const pct = this.yakTension * 100;
        tensionEl.style.width = `${pct}%`;
        tensionEl.style.background = pct < 35 ? '#888' : pct < 70 ? '#4CAF50' : '#ff4444';
      }

      // Check if at pen
      const penPos = this.yakTargetObj?.position || new THREE.Vector3(0, 0, 10);
      if (yakPos.distanceTo(penPos) < 4) {
        // Phase 3: gate moment
        this.yakOverlay?.remove();
        this.yakOverlay = null;
        this.completeYakPhase3();
      }
    }
  }

  completeYakPhase3() {
    showDialogue(NAMES.yak, '*Gerel plants all four hooves and will not move*', () => {
      showDialogue(NAMES.player, '...more force isn\'t working. Maybe...',  () => {
        // Show options
        const el = document.createElement('div');
        el.style.cssText = 'position:fixed;bottom:100px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.9);border-radius:12px;padding:16px 20px;z-index:9998;font-family:system-ui;color:#fff;text-align:center;';
        el.innerHTML = `
          <div style="font-size:15px;margin-bottom:12px;">Gerel won't budge. What do you do?</div>
          <div style="display:flex;gap:8px;justify-content:center;">
            <button id="yak-pull" style="${btnStyleSecondary}">Pull harder (LMB)</button>
            <button id="yak-salt" style="${btnStyle}">Offer salt (F)</button>
          </div>
        `;
        document.body.appendChild(el);
        el.querySelector('#yak-pull')!.addEventListener('click', () => {
          showToast('Gerel snorts. Pulling harder does nothing.', '#ff8800', 2500);
        });
        el.querySelector('#yak-salt')!.addEventListener('click', () => {
          el.remove();
          showToast('Salt offered! Kindness wins where force did not.', '#4CAF50', 2500);
          showDialogue('Baatar', '*arrives, sees Gerel in the pen* "Sain!" *laughs*', () => {
            if (this.yakBurnCount === 0) grantAchievement('Yak Whisperer');
            modStat('strength', 10);
            modStat('bond', 5);
            this.goToChapter('ch4');
          });
        });
        this.chapterObjects.push({ userData: { cleanup: () => el.remove() } } as any);
      });
    });
  }

  // ---- CHAPTER 4: Raise the Ger ----
  initCh4() {
    this.player.enabled = true;
    this.player.camera.position.set(0, 1.7, 20);
    this.player.yaw = Math.PI;
    this.scene.background = new THREE.Color(0x5a8a9a);
    this.gerStep = 0;

    showTitleCard('Chapter 4', 'Raise the Ger', () => {
      showDialogue('Baatar', '"Today we build your ger!" *family gathers with parts*', () => {
        showObjective('Build the ger in order: door, walls, crown, roof poles, felt, canvas.');
        this.buildGerOverlay();
      });
    });
  }

  buildGerOverlay() {
    const steps = [
      { name: 'Set the door frame (south)', icon: '🚪', action: 'Place door frame facing south' },
      { name: 'Unfold khana (lattice walls)', icon: '🔲', action: 'Drag to unfold each lattice section' },
      { name: 'Raise the crown (toono)', icon: '👑', action: 'Hold steady while family slots roof poles' },
      { name: 'Lay uni (roof poles)', icon: '🪵', action: 'Carry poles and slot them in' },
      { name: 'Layer the felt', icon: '🧱', action: 'Drag felt sheets over the frame' },
      { name: 'Canvas and ropes', icon: '⛺', action: 'Pull canvas over, cinch ropes' },
      { name: 'Choose your door', icon: '🎨', action: 'Plain orange or ornate teal and gold?' },
    ];

    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;right:20px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,0.85);border-radius:12px;padding:16px;z-index:9990;font-family:system-ui;color:#fff;min-width:220px;';
    el.innerHTML = `
      <div style="font-size:15px;font-weight:700;margin-bottom:12px;">Build the Ger</div>
      ${steps.map((s, i) =>
        `<div id="ger-step-${i}" style="display:flex;align-items:center;gap:8px;padding:8px;border-radius:8px;margin-bottom:4px;background:${i === 0 ? 'rgba(74,207,74,0.2)' : 'rgba(255,255,255,0.05)'};border:1px solid ${i === 0 ? '#4CAF50' : '#333'};">
          <span>${s.icon}</span>
          <div>
            <div style="font-size:12px;font-weight:600;">${s.name}</div>
            <div style="font-size:10px;color:#888;">${i === 0 ? s.action : ''}</div>
          </div>
          <span id="ger-check-${i}" style="margin-left:auto;">${i < this.gerStep ? '✓' : ''}</span>
        </div>`
      ).join('')}
      <button id="ger-do-step" style="${btnStyle};margin-top:8px;width:100%;">Do it (E)</button>
    `;
    document.body.appendChild(el);
    this.gerHorseStanceOverlay = el;

    el.querySelector('#ger-do-step')!.addEventListener('click', () => {
      this.advanceGerStep(el, steps);
    });
  }

  advanceGerStep(el: HTMLElement, steps: {name: string; icon: string; action: string}[]) {
    if (this.gerStep >= steps.length) return;

    if (this.gerStep === 2) {
      // Crown balance moment
      showCaption('You and Baatar raise the crown together. Hold it steady!', 2000);
      showToast('Patience +3 (steady hands!)', '#4CAF50', 1500);
      modStat('patience', 3);
    }
    if (this.gerStep === 6) {
      // Door choice
      const doorEl = document.createElement('div');
      doorEl.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.9);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9999;font-family:system-ui;color:#fff;gap:16px;';
      doorEl.innerHTML = `
        <div style="font-size:24px;font-weight:700;">Choose Your Door</div>
        <div style="display:flex;gap:20px;">
          <div style="text-align:center;cursor:pointer;" id="door-plain">
            <div style="width:80px;height:120px;background:#e07020;border-radius:4px;margin:0 auto 8px;border:3px solid #333;"></div>
            <div>Plain Orange</div>
          </div>
          <div style="text-align:center;cursor:pointer;" id="door-ornate">
            <div style="width:80px;height:120px;background:linear-gradient(180deg,#1a8a8a,#c09020);border-radius:4px;margin:0 auto 8px;border:3px solid #c09020;position:relative;overflow:hidden;">
              <div style="position:absolute;inset:4px;border:2px solid rgba(255,200,0,0.5);border-radius:2px;"></div>
            </div>
            <div>Ornate Teal and Gold</div>
          </div>
        </div>
      `;
      document.body.appendChild(doorEl);
      ['door-plain', 'door-ornate'].forEach(id => {
        doorEl.querySelector(`#${id}`)!.addEventListener('click', () => {
          doorEl.remove();
          this.finishGer(el);
        });
      });
      return;
    }

    // Mark done
    const check = el.querySelector(`#ger-check-${this.gerStep}`) as HTMLElement;
    if (check) check.textContent = '✓';
    const stepEl = el.querySelector(`#ger-step-${this.gerStep}`) as HTMLElement;
    if (stepEl) { stepEl.style.background = 'rgba(74,207,74,0.1)'; stepEl.style.borderColor = '#4CAF50'; }

    this.gerStep++;
    modStat('strength', 2);

    if (this.gerStep < steps.length) {
      const nextEl = el.querySelector(`#ger-step-${this.gerStep}`) as HTMLElement;
      if (nextEl) { nextEl.style.background = 'rgba(74,207,74,0.2)'; nextEl.style.borderColor = '#4CAF50'; }
      const nextAction = el.querySelector(`#ger-step-${this.gerStep} div div:last-child`) as HTMLElement;
      if (nextAction) nextAction.textContent = steps[this.gerStep].action;
    }
  }

  finishGer(el: HTMLElement) {
    el.remove();
    this.gerHorseStanceOverlay = null;
    gameState.gerBuilt = true;
    gameState.tracking.gersRaised++;
    modStat('bond', 10);
    grantAchievement('Ger Speedrun');
    showCaption('Your ger stands. This is home.', 3000, () => {
      this.player.setSleeveColor(0xe8d0a0); // white tee
      this.goToChapter('ch5');
    });
  }

  updateCh4(_dt: number) {}

  // ---- CHAPTER 5: The Guest Bowl ----
  initCh5() {
    this.player.enabled = false;
    this.scene.background = new THREE.Color(0x2a1a0a);
    this.foodCourse = 0;
    this.foodMeter = 0;

    showTitleCard('Chapter 5', 'The Guest Bowl', () => {
      showDialogue('Oyuna', '"Sit, sit! Eat, eat!" *sets out an incredible spread*', () => {
        this.startNextCourse();
      });
    });
  }

  readonly COURSES = [
    { name: 'Suutei Tsai', desc: 'Salty milk tea', tooltip: 'Salty milk tea', mechanic: 'sip' },
    { name: 'Aaruul', desc: 'Sun-dried curd', tooltip: 'Sun-dried curd (rock hard)', mechanic: 'chew' },
    { name: 'Buuz', desc: 'Steamed dumplings', tooltip: 'Steamed dumplings', mechanic: 'bite' },
    { name: 'Tsuivan', desc: 'Stir-fried noodles', tooltip: 'Stir-fried noodles', mechanic: 'feed' },
    { name: 'Airag', desc: 'Fermented mare\'s milk', tooltip: 'Fermented mare\'s milk', mechanic: 'courage' },
  ];

  startNextCourse() {
    if (this.foodCourse >= this.COURSES.length) {
      this.completeCh5();
      return;
    }
    const course = this.COURSES[this.foodCourse];
    this.showFoodMechanic(course);
  }

  showFoodMechanic(course: {name: string; desc: string; tooltip: string; mechanic: string}) {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9998;font-family:system-ui;color:#fff;gap:16px;';

    let innerHtml = `<div style="font-size:28px;font-weight:700;">${course.name}</div>
      <div style="font-size:16px;color:#ccc;">${course.tooltip}</div>`;

    if (course.mechanic === 'sip') {
      innerHtml += `
        <div style="font-size:14px;color:#aaa;max-width:360px;text-align:center;">Salty milk tea. Take small sips without grimacing.</div>
        <div style="background:#333;border-radius:4px;height:16px;width:250px;overflow:hidden;">
          <div id="grimace-meter" style="height:100%;width:0%;background:#ff6644;border-radius:4px;transition:width 0.2s;"></div>
        </div>
        <div style="font-size:12px;color:#888;">Click slowly and rhythmically to sip without grimacing.</div>
        <button id="food-action" style="${btnStyle}">Take a sip (click)</button>`;
    } else if (course.mechanic === 'chew') {
      innerHtml += `
        <div style="font-size:14px;color:#aaa;max-width:360px;text-align:center;">Rock hard. Temuulen eats his in 2 seconds and grins. You'll need 30.</div>
        <div style="background:#333;border-radius:4px;height:16px;width:250px;overflow:hidden;">
          <div id="chew-fill" style="height:100%;width:100%;background:#c4a050;border-radius:4px;transition:width 0.1s;"></div>
        </div>
        <div style="font-size:12px;color:#888;">Click rapidly to chew!</div>
        <button id="food-action" style="${btnStyle}">Chew! (LMB)</button>`;
    } else if (course.mechanic === 'bite') {
      innerHtml += `
        <div style="font-size:14px;color:#aaa;max-width:360px;text-align:center;">Bite a small hole first and sip the hot broth -- or burn your mouth.</div>
        <div style="display:flex;gap:12px;margin-top:8px;">
          <button id="food-action" style="${btnStyle}">Bite hole, sip broth first</button>
          <button id="food-wrong" style="${btnStyleSecondary}">Just bite in</button>
        </div>`;
    } else if (course.mechanic === 'feed') {
      innerHtml += `
        <div style="font-size:14px;color:#aaa;max-width:360px;text-align:center;">Tsuivan! Recreate the photo -- feed your buddy a forkful as he leans in.</div>
        <button id="food-action" style="${btnStyle}">Feed Leo a forkful (F)</button>`;
    } else if (course.mechanic === 'courage') {
      innerHtml += `
        <div style="font-size:14px;color:#aaa;max-width:360px;text-align:center;">Fermented mare's milk. Oyuna watches expectantly. You need courage.</div>
        <div id="courage-fill-wrap" style="background:#333;border-radius:4px;height:16px;width:250px;overflow:hidden;display:none;">
          <div id="courage-fill" style="height:100%;width:0%;background:#8a4a9a;border-radius:4px;transition:width 0.1s;"></div>
        </div>
        <div style="display:flex;gap:12px;margin-top:8px;">
          <button id="food-action" style="${btnStyle}">Build courage...</button>
        </div>`;
    }

    innerHtml += `<div id="food-feedback" style="min-height:20px;font-size:13px;color:#aaa;"></div>`;
    el.innerHTML = innerHtml;
    document.body.appendChild(el);

    let chewFill = 100;
    let sipCount = 0;
    let grimace = 0;

    if (course.mechanic === 'sip') {
      el.querySelector('#food-action')!.addEventListener('click', () => {
        sipCount++;
        grimace = Math.max(0, grimace + (Math.random() > 0.6 ? -5 : 15));
        (el.querySelector('#grimace-meter') as HTMLElement).style.width = `${grimace}%`;
        if (sipCount >= 3) {
          el.remove();
          modStat('bond', 3);
          gameState.tracking.aaruulChewed++;
          this.foodCourse++;
          updateHyperAgent('Suutei tsai x1, Meals & Entertainment, receipt matched.');
          setTimeout(() => this.startNextCourse(), 500);
        }
      });
    } else if (course.mechanic === 'chew') {
      const chewInterval = setInterval(() => {
        chewFill -= 1;
        (el.querySelector('#chew-fill') as HTMLElement).style.width = `${chewFill}%`;
        if (chewFill <= 0) {
          clearInterval(chewInterval);
          el.remove();
          modStat('bond', 3);
          gameState.tracking.aaruulChewed++;
          this.foodCourse++;
          showToast('Aaruul conquered!', '#4CAF50', 1500);
          setTimeout(() => this.startNextCourse(), 500);
        }
      }, 80);
      el.querySelector('#food-action')!.addEventListener('click', () => {
        chewFill = Math.max(0, chewFill - 5);
        (el.querySelector('#chew-fill') as HTMLElement).style.width = `${chewFill}%`;
      });
      this.chapterObjects.push({ userData: { cleanup: () => clearInterval(chewInterval) } } as any);
    } else if (course.mechanic === 'bite') {
      el.querySelector('#food-action')!.addEventListener('click', () => {
        el.remove();
        modStat('bond', 3);
        this.foodCourse++;
        showToast('Perfect! Hot broth without the burn.', '#4CAF50', 1500);
        setTimeout(() => this.startNextCourse(), 500);
      });
      el.querySelector('#food-wrong')!.addEventListener('click', () => {
        (el.querySelector('#food-feedback') as HTMLElement).textContent = '*fans mouth dramatically* Next time, bite the hole first.';
        this.foodCourse++;
        setTimeout(() => { el.remove(); this.startNextCourse(); }, 2000);
      });
    } else if (course.mechanic === 'feed') {
      el.querySelector('#food-action')!.addEventListener('click', () => {
        el.remove();
        grantAchievement('Photo Op');
        modStat('bond', 5);
        this.foodCourse++;
        showToast('Photo Op achievement! Bond +5', '#FFD700', 2500);
        setTimeout(() => this.startNextCourse(), 500);
      });
    } else if (course.mechanic === 'courage') {
      let courageVal = 0;
      let courageInterval: ReturnType<typeof setInterval> | null = null;
      let courageBuildStarted = false;
      el.querySelector('#food-action')!.addEventListener('click', () => {
        if (!courageBuildStarted) {
          courageBuildStarted = true;
          (el.querySelector('#courage-fill-wrap') as HTMLElement).style.display = 'block';
          (el.querySelector('#food-action') as HTMLElement).textContent = 'Drink!';
          courageInterval = setInterval(() => {
            courageVal = Math.min(100, courageVal + 5);
            (el.querySelector('#courage-fill') as HTMLElement).style.width = `${courageVal}%`;
            if (courageVal >= 100) {
              clearInterval(courageInterval!);
            }
          }, 100);
        } else {
          clearInterval(courageInterval!);
          el.remove();
          modStat('bond', 5);
          this.foodCourse++;
          showToast('Airag! Brief wobble... Bond +5', '#8a4a9a', 2500);
          updateHyperAgent('Airag x1, Meals & Entertainment, categorized.');
          setTimeout(() => this.startNextCourse(), 500);
        }
      });
    }

    this.chapterObjects.push({ userData: { cleanup: () => el.remove() } } as any);
  }

  completeCh5() {
    showDialogue('Oyuna', '"More?" *holds up the bowl*', () => {
      // Show etiquette: small sip and return
      const el = document.createElement('div');
      el.style.cssText = 'position:fixed;bottom:120px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.9);border-radius:12px;padding:16px 20px;z-index:9998;font-family:system-ui;color:#fff;text-align:center;';
      el.innerHTML = `
        <div style="font-size:15px;margin-bottom:12px;">Oyuna offers more airag. How do you politely decline?</div>
        <div style="display:flex;gap:8px;justify-content:center;">
          <button id="decline-right" style="${btnStyle}">Take a small sip, hand it back politely</button>
          <button id="decline-wrong" style="${btnStyleSecondary}">Push it away saying "no no no"</button>
        </div>
      `;
      document.body.appendChild(el);
      el.querySelector('#decline-right')!.addEventListener('click', () => {
        el.remove();
        modStat('bond', 5);
        showToast('Perfect etiquette! Bond +5', '#4CAF50', 2500);
        updateHyperAgent('Full dinner, Meals & Entertainment, categorized.');
        this.goToChapter('ch6');
      });
      el.querySelector('#decline-wrong')!.addEventListener('click', () => {
        el.remove();
        showDialogue('Oyuna', '*gentle laugh, demonstrates the correct way*', () => {
          this.goToChapter('ch6');
        });
      });
    });
  }

  updateCh5(_dt: number) {}

  // ---- CHAPTER 6: Card Night ----
  initCh6() {
    this.player.enabled = false;
    this.scene.background = new THREE.Color(0x1a0a04);
    this.cardScores = [15, 15, 15, 15];
    this.cardTrickCount = 0;
    this.cardHandCount = 0;

    showTitleCard('Chapter 6', 'Card Night', () => {
      showDialogue('Temuulen', '"Cards? You and me." *shuffles like a pro*', () => {
        this.buildCardOverlay();
        this.dealCards();
      });
    });
  }

  dealCards() {
    const deck: number[] = [];
    for (let suit = 0; suit < 4; suit++)
      for (let rank = 0; rank < 8; rank++) // 7,8,9,10,J,Q,K,A
        deck.push(suit * 8 + rank);

    // Shuffle
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    this.cardHand = deck.slice(0, 5);
    this.cardTableCards = [
      deck.slice(0, 5), // player
      deck.slice(5, 10), // Temuulen
      deck.slice(10, 15), // Anu
      deck.slice(15, 20), // Buddy
    ];
    this.cardTrump = deck[20] % 4;
    this.cardTrick = [null, null, null, null];
    this.cardLedPlayer = 0;
    this.cardWaitingForPlayer = true;
    this.cardTrickWins = [0, 0, 0, 0];
    this.cardExchangeDone = false;
    this.renderCardHand();
  }

  buildCardOverlay() {
    if (this.cardOverlay) this.cardOverlay.remove();
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;background:rgba(10,5,2,0.95);z-index:9990;font-family:system-ui;color:#fff;';
    el.innerHTML = `
      <div style="position:absolute;top:20px;left:50%;transform:translateX(-50%);font-size:24px;font-weight:700;">Card Night</div>
      <div id="card-scores" style="position:absolute;top:20px;right:20px;font-size:13px;text-align:right;line-height:1.8;"></div>
      <div id="card-trump" style="position:absolute;top:20px;left:20px;font-size:14px;"></div>
      <div id="card-table" style="position:absolute;top:40%;left:50%;transform:translateX(-50%);display:flex;gap:16px;"></div>
      <div id="card-status" style="position:absolute;top:35%;left:50%;transform:translateX(-50%);font-size:14px;color:#ccc;text-align:center;max-width:400px;"></div>
      <div id="card-hand" style="position:absolute;bottom:20px;left:50%;transform:translateX(-50%);display:flex;gap:8px;"></div>
      <div id="card-exchange" style="position:absolute;bottom:100px;left:50%;transform:translateX(-50%);display:none;">
        <button id="exchange-done" style="${btnStyle}">Keep these cards (0 to 3 swaps allowed)</button>
      </div>
    `;
    document.body.appendChild(el);
    this.cardOverlay = el;
  }

  readonly SUITS = ['♠', '♥', '♦', '♣'];
  readonly RANKS = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  readonly SUIT_COLORS = ['#fff', '#ff4444', '#ff4444', '#fff'];

  cardName(card: number): string {
    return this.RANKS[card % 8] + this.SUITS[Math.floor(card / 8)];
  }

  cardSuit(card: number): number { return Math.floor(card / 8); }
  cardRank(card: number): number { return card % 8; }

  renderCardHand() {
    if (!this.cardOverlay) return;
    const handEl = this.cardOverlay.querySelector('#card-hand') as HTMLElement;
    const scoresEl = this.cardOverlay.querySelector('#card-scores') as HTMLElement;
    const trumpEl = this.cardOverlay.querySelector('#card-trump') as HTMLElement;

    handEl.innerHTML = '';
    this.cardHand.forEach((card, i) => {
      const btn = document.createElement('button');
      const suit = this.cardSuit(card);
      btn.style.cssText = `background:#f5f0e8;color:${this.SUIT_COLORS[suit]};border:2px solid #333;border-radius:8px;padding:8px 12px;font-size:18px;font-weight:700;cursor:pointer;min-width:52px;transition:transform 0.1s;`;
      btn.textContent = this.cardName(card);
      btn.addEventListener('click', () => {
        if (this.cardWaitingForPlayer) this.playerPlaysCard(i);
      });
      btn.addEventListener('mouseover', () => btn.style.transform = 'translateY(-8px)');
      btn.addEventListener('mouseout', () => btn.style.transform = 'translateY(0)');
      handEl.appendChild(btn);
    });

    scoresEl.innerHTML = `Score (lower = better, first to 0 wins):<br>
      You: ${this.cardScores[0]} | Temuulen: ${this.cardScores[1]}<br>
      Anu: ${this.cardScores[2]} | Leo: ${this.cardScores[3]}`;

    trumpEl.textContent = `Trump: ${this.SUITS[this.cardTrump]} (${['Spades','Hearts','Diamonds','Clubs'][this.cardTrump]})`;

    if (!this.cardExchangeDone) {
      const exEl = this.cardOverlay.querySelector('#card-exchange') as HTMLElement;
      exEl.style.display = 'block';
      (this.cardOverlay.querySelector('#exchange-done') as HTMLElement).onclick = () => {
        exEl.style.display = 'none';
        this.cardExchangeDone = true;
        this.startTrick();
      };
      (this.cardOverlay.querySelector('#card-status') as HTMLElement).textContent = 'Exchange phase: click cards to swap (max 3), then click "Keep these cards".';
      let swapsLeft = 3;
      const deck = Array.from({ length: 32 }, (_, i) => i).filter(c => !this.cardHand.includes(c));
      handEl.querySelectorAll('button').forEach((btn, i) => {
        btn.addEventListener('click', () => {
          if (swapsLeft <= 0 || this.cardExchangeDone) return;
          // Draw new card
          const newCard = deck.splice(Math.floor(Math.random() * deck.length), 1)[0];
          if (newCard !== undefined) {
            this.cardHand[i] = newCard;
            swapsLeft--;
            this.renderCardHand();
          }
        }, { once: false });
      });
    }
  }

  startTrick() {
    this.cardTrick = [null, null, null, null];
    (this.cardOverlay?.querySelector('#card-status') as HTMLElement).textContent = 'Your turn to lead.' ;
    this.cardWaitingForPlayer = this.cardLedPlayer === 0;
    if (!this.cardWaitingForPlayer) this.aiPlayCards();
  }

  playerPlaysCard(handIndex: number) {
    const card = this.cardHand[handIndex];
    this.cardHand.splice(handIndex, 1);
    this.cardTrick[0] = card;
    this.cardWaitingForPlayer = false;
    this.renderTrickTable();
    // AI plays
    setTimeout(() => this.aiPlayCards(), 600);
  }

  aiPlayCards() {
    const players = [1, 2, 3];
    let delay = 400;
    players.forEach(p => {
      if (this.cardTrick[p] !== null) return;
      setTimeout(() => {
        if (this.cardTableCards[p].length === 0) return;
        // Simple AI: play first valid card
        const ledSuit = this.cardTrick.find(c => c !== null) !== null
          ? this.cardSuit(this.cardTrick.find(c => c !== null)!)
          : -1;
        let playIdx = 0;
        if (ledSuit >= 0) {
          const suitMatch = this.cardTableCards[p].findIndex(c => this.cardSuit(c) === ledSuit);
          if (suitMatch >= 0) playIdx = suitMatch;
          else {
            const trumpCard = this.cardTableCards[p].findIndex(c => this.cardSuit(c) === this.cardTrump);
            if (trumpCard >= 0 && p === 1) playIdx = trumpCard; // Temuulen plays trump
          }
        }
        this.cardTrick[p] = this.cardTableCards[p][playIdx];
        this.cardTableCards[p].splice(playIdx, 1);

        // Buddy commentary
        if (p === 3) {
          const buddyLines = ['Classic Leo move.', 'Bold strategy.', '"I meant to do that."', 'Outstanding play.'];
          showToast(`Leo: "${buddyLines[Math.floor(Math.random() * buddyLines.length)]}"`, '#888', 2500);
        }

        this.renderTrickTable();
        if (this.cardTrick.every(c => c !== null)) {
          setTimeout(() => this.resolveTrick(), 800);
        }
      }, delay);
      delay += 400;
    });
  }

  renderTrickTable() {
    if (!this.cardOverlay) return;
    const tableEl = this.cardOverlay.querySelector('#card-table') as HTMLElement;
    const names = ['You', 'Temuulen', 'Anu', 'Leo'];
    tableEl.innerHTML = names.map((name, i) => {
      const card = this.cardTrick[i];
      const suit = card !== null ? this.cardSuit(card) : -1;
      return `<div style="text-align:center;">
        <div style="font-size:11px;color:#aaa;margin-bottom:4px;">${name}</div>
        <div style="background:${card !== null ? '#f5f0e8' : 'rgba(255,255,255,0.1)'};border-radius:6px;padding:12px 8px;min-width:44px;min-height:56px;color:${card !== null ? this.SUIT_COLORS[suit] : '#555'};font-size:20px;font-weight:700;border:2px solid ${card !== null ? '#aaa' : '#333'};">
          ${card !== null ? this.cardName(card) : ''}
        </div>
      </div>`;
    }).join('');
  }

  resolveTrick() {
    // Find trick winner
    const ledCard = this.cardTrick.find(c => c !== null);
    if (ledCard === null || ledCard === undefined) return;
    const ledSuit = this.cardSuit(ledCard);

    let winnerIdx = 0;
    let bestCard = -1;

    this.cardTrick.forEach((card, i) => {
      if (card === null) return;
      const isTrump = this.cardSuit(card) === this.cardTrump;
      const isLedSuit = this.cardSuit(card) === ledSuit;
      const rank = this.cardRank(card);

      if (bestCard === -1) { bestCard = card; winnerIdx = i; return; }

      const bestIsTrump = this.cardSuit(bestCard) === this.cardTrump;
      const bestIsLedSuit = this.cardSuit(bestCard) === ledSuit;

      if (isTrump && !bestIsTrump) { bestCard = card; winnerIdx = i; }
      else if (isTrump && bestIsTrump && rank > this.cardRank(bestCard)) { bestCard = card; winnerIdx = i; }
      else if (!bestIsTrump && isLedSuit && rank > this.cardRank(bestCard)) { bestCard = card; winnerIdx = i; }
    });

    this.cardTrickWins[winnerIdx]++;
    const names = ['You', 'Temuulen', 'Anu', 'Leo'];
    const statusEl = this.cardOverlay?.querySelector('#card-status') as HTMLElement;
    if (statusEl) statusEl.textContent = `${names[winnerIdx]} wins the trick!`;

    this.cardTrickCount++;
    this.cardLedPlayer = winnerIdx;

    if (this.cardTrickCount >= 5) {
      // Hand over, score
      setTimeout(() => this.scoreHand(), 1200);
    } else {
      setTimeout(() => {
        this.cardTrick = [null, null, null, null];
        this.cardWaitingForPlayer = winnerIdx === 0;
        this.renderTrickTable();
        if (!this.cardWaitingForPlayer) this.aiPlayCards();
        if (statusEl) statusEl.textContent = winnerIdx === 0 ? 'You lead the next trick.' : `${names[winnerIdx]} leads.`;
      }, 1200);
    }
  }

  scoreHand() {
    // Apply trick scoring: won tricks subtract from score, 0 tricks wins 5 pts
    for (let i = 0; i < 4; i++) {
      if (this.cardTrickWins[i] === 0) this.cardScores[i] -= TUNING.cards.zeroTrickPenalty;
      else this.cardScores[i] -= this.cardTrickWins[i];
    }

    this.cardHandCount++;
    const winner = this.cardScores.findIndex(s => s <= 0);
    if (winner >= 0) {
      this.finishCards(winner);
    } else {
      // Deal again
      this.dealCards();
    }
  }

  finishCards(winner: number) {
    const names = ['You', 'Temuulen', 'Anu', 'Leo'];
    const won = winner === 0;
    if (won) {
      gameState.tracking.cardWins++;
      grantAchievement('Card Shark');
    } else {
      gameState.tracking.cardLosses++;
    }
    modStat('bond', 8);

    this.cardOverlay?.remove();
    this.cardOverlay = null;

    showDialogue('Temuulen', won ? '"Again. Best of 3." *shuffles immediately*' : `"${names[winner]} wins! Sain!"`, () => {
      showCaption('The stove crackles. Saraa wanders by and flips someone\'s card face up. Everyone pretends not to see.', 3000, () => {
        this.goToChapter('ch7');
      });
    });
  }

  updateCh6(_dt: number) {}

  // ---- CHAPTER 7: Tag, You're It ----
  initCh7() {
    this.player.enabled = true;
    this.player.camera.position.set(0, 1.7, 30);
    this.player.yaw = Math.PI;
    this.scene.background = new THREE.Color(0x7ab06a);
    this.tagRound = 1;
    this.tagTimer = TUNING.tag.round1Sec;
    this.taggedKids = new Set();

    // Build kids
    this.kidsObj = {};
    this.kidVelocities = {};
    const kidData = [
      { name: 'Temuulen', x: 15, z: 15, color: 0x2a4a6a },
      { name: 'Anu', x: -10, z: 20, color: 0x6a2a4a },
      { name: 'Saraa', x: 5, z: 10, color: 0xe8e0c8 },
    ];
    for (const kid of kidData) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.6, 3, 6), new THREE.MeshLambertMaterial({ color: kid.color }));
      body.position.y = 0.6;
      g.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 5), new THREE.MeshLambertMaterial({ color: 0xd4956a }));
      head.position.y = 1.3;
      g.add(head);
      g.position.set(kid.x, getTerrainY(kid.x, kid.z), kid.z);
      this.scene.add(g);
      this.chapterObjects.push(g);
      this.kidsObj[kid.name] = body;
      body.userData = { group: g, name: kid.name };
      this.kidVelocities[kid.name] = new THREE.Vector3(
        (Math.random() - 0.5) * 4,
        0,
        (Math.random() - 0.5) * 4
      );
    }

    showTitleCard('Chapter 7', 'Tag, You\'re It', () => {
      showDialogue('Temuulen', '"Catch us if you can!" *kids scatter*', () => {
        showObjective('Round 1: Tag Temuulen and Anu within 90 seconds!');
        this.buildTagOverlay();
      });
    });
  }

  buildTagOverlay() {
    if (this.tagOverlay) this.tagOverlay.remove();
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;top:80px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.8);border-radius:12px;padding:10px 20px;z-index:9990;font-family:system-ui;color:#fff;text-align:center;pointer-events:none;';
    el.innerHTML = `
      <div id="tag-round" style="font-size:18px;font-weight:700;"></div>
      <div id="tag-timer" style="font-size:32px;font-weight:900;"></div>
      <div id="tag-status" style="font-size:13px;color:#ccc;"></div>
    `;
    document.body.appendChild(el);
    this.tagOverlay = el;
  }

  updateCh7(dt: number) {
    if (!this.tagOverlay) return;
    this.tagTimer -= dt;

    const roundEl = this.tagOverlay.querySelector('#tag-round') as HTMLElement;
    const timerEl = this.tagOverlay.querySelector('#tag-timer') as HTMLElement;
    const statusEl = this.tagOverlay.querySelector('#tag-status') as HTMLElement;

    roundEl.textContent = `Round ${this.tagRound}`;
    timerEl.textContent = `${Math.ceil(Math.max(0, this.tagTimer))}s`;

    const playerPos = new THREE.Vector3(
      this.player.camera.position.x,
      0,
      this.player.camera.position.z
    );

    // Move kids
    for (const [name, velVec] of Object.entries(this.kidVelocities)) {
      const kidMesh = this.kidsObj[name];
      if (!kidMesh) continue;
      const group = kidMesh.userData.group as THREE.Group;

      if (this.tagRound === 1) {
        // Kids flee from player
        if (!this.taggedKids.has(name)) {
          const kidPos = group.position;
          const awayDir = kidPos.clone().sub(playerPos).normalize();
          const speed = name === 'Temuulen' ? 3.5 : 2.8;
          // Add some juke behavior
          if (playerPos.distanceTo(kidPos) < 8) {
            const juke = new THREE.Vector3((Math.random() - 0.5) * 4, 0, (Math.random() - 0.5) * 4);
            awayDir.add(juke).normalize();
          }
          velVec.lerp(awayDir.multiplyScalar(speed), 0.1);
          group.position.addScaledVector(velVec, dt);
          group.position.y = getTerrainY(group.position.x, group.position.z);
          // Bounds
          group.position.x = Math.max(-120, Math.min(120, group.position.x));
          group.position.z = Math.max(-120, Math.min(120, group.position.z));
        }
        // Tag check
        if (playerPos.distanceTo(group.position) < 2 && !this.taggedKids.has(name) && name !== 'Saraa') {
          this.taggedKids.add(name);
          showToast(`Tagged ${name}!`, '#4CAF50', 1500);
        }
      } else if (this.tagRound === 2) {
        // Kids chase player
        const chaseDir = playerPos.clone().sub(group.position).normalize();
        const speed = name === 'Temuulen' ? 4.5 : 3.5;
        velVec.lerp(chaseDir.multiplyScalar(speed), 0.1);
        group.position.addScaledVector(velVec, dt);
        group.position.y = getTerrainY(group.position.x, group.position.z);
      } else if (this.tagRound === 3 && name === 'Saraa') {
        // Saraa toddles slowly
        const toddleDir = playerPos.clone().sub(group.position).normalize();
        group.position.addScaledVector(toddleDir, 0.8 * dt);
        group.position.y = getTerrainY(group.position.x, group.position.z);
        // When player gets close, trip!
        if (playerPos.distanceTo(group.position) < 3) {
          // Marc trips
          showToast('*Marc trips dramatically into the grass*', '#fff', 2000);
          showToast('Saraa: "TAG!" *squeals*', '#FFD700', 2500);
          grantAchievement('Mercy Rule');
          setTimeout(() => this.finishTag(), 1500);
        }
      }
    }

    statusEl.textContent = this.tagRound === 1
      ? `Tagged: ${this.taggedKids.size}/2 (Temuulen, Anu)`
      : this.tagRound === 2 ? 'SURVIVE! Manage your stamina, vault rocks with Space!'
      : 'Chase Saraa... or don\'t.';

    // Round transitions
    if (this.tagRound === 1 && (this.taggedKids.size >= 2 || this.tagTimer <= 0)) {
      this.tagRound = 2;
      this.tagTimer = TUNING.tag.round2Sec;
      showToast('Round 2: The kids chase YOU now!', '#ff8800', 2500);
      showObjective('Round 2: Survive 60 seconds while the kids chase you!');
    } else if (this.tagRound === 2 && this.tagTimer <= 0) {
      this.tagRound = 3;
      this.tagTimer = 999;
      showToast('Round 3: Chase Saraa!', '#FFD700', 2500);
      showObjective('Round 3: Try to catch Saraa...');
      // Hide Temuulen and Anu
      for (const name of ['Temuulen', 'Anu']) {
        const mesh = this.kidsObj[name];
        if (mesh) (mesh.userData.group as THREE.Group).visible = false;
      }
    }
  }

  finishTag() {
    this.tagOverlay?.remove();
    this.tagOverlay = null;
    modStat('stamina', 20);
    modStat('bond', 10);
    showDialogue('Saraa', '"Haha! Marc fall down!"', () => {
      this.goToChapter('ch8');
    });
  }

  // ---- CHAPTER 8: English Class ----
  initCh8() {
    this.player.enabled = false;
    this.scene.background = new THREE.Color(0x6a9a6a);
    this.englishWordIndex = 0;
    this.englishReps = 0;
    this.currentStudent = 0;

    const wordSets = [
      ['yak', 'horse', 'water'],
      ['sky', 'mountain', 'friend'],
      ['hello', 'thank you', 'My name is Leo'],
    ];
    this.englishWords = wordSets.flat();

    showTitleCard('Chapter 8', 'English Class', () => {
      showDialogue('Anu', '"Marc, can you teach us English? Please?"', () => {
        showObjective('Teach words to the kids. Point at things and repeat after you. Press E on each syllable.');
        this.buildEnglishOverlay();
      });
    });
  }

  buildEnglishOverlay() {
    if (this.englishOverlay) this.englishOverlay.remove();
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.88);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9990;font-family:system-ui;color:#fff;gap:16px;';

    const students = [
      { name: 'Anu', sets: 3, desc: 'Fast learner. Eager.' },
      { name: 'Temuulen', sets: 2, desc: 'Pretends not to care. Secretly competitive.' },
      { name: 'Saraa', sets: 1, desc: 'One word: "hi". She says it to everything.' },
    ];
    const student = students[Math.min(this.currentStudent, students.length - 1)];

    const wordGroups = [
      ['yak', 'horse', 'water'],
      ['sky', 'mountain', 'friend'],
      ['My name is Leo'],
    ];
    const setIndex = this.englishWordIndex % 3;
    const words = wordGroups[setIndex] || ['hi'];
    const currentWord = words[this.englishReps % words.length] || 'hi';

    const isGraduation = currentWord === 'My name is Leo';
    const attempts: string[][] = [
      ['yek?', 'yaaak', 'YAK!'],
      ['ors?', 'hoorse', 'HORSE!'],
      ['waa...ter?', 'waater', 'WATER!'],
      ['skai?', 'skyyy', 'SKY!'],
      ['moun... tain?', 'mountain!', 'MOUNTAIN!'],
      ['frrrend?', 'friend!', 'FRIEND!'],
      ['my... name...', 'My name is...', 'MY NAME IS LEO!!!'],
    ];
    const wordIdx = this.englishWords.indexOf(currentWord);
    const attempts_for_word = attempts[Math.min(wordIdx, attempts.length - 1)] || ['hi!', 'HI!', 'HI EVERYTHING!'];

    el.innerHTML = `
      <div style="font-size:22px;font-weight:700;">Student: ${student.name}</div>
      <div style="font-size:14px;color:#aaa;margin-bottom:4px;">${student.desc}</div>
      <div style="background:rgba(255,255,255,0.1);border-radius:12px;padding:24px 32px;text-align:center;max-width:400px;">
        <div style="font-size:40px;font-weight:900;margin-bottom:16px;">${currentWord}</div>
        <div id="student-attempt" style="font-size:18px;color:#aaa;font-style:italic;min-height:28px;">
          ${attempts_for_word[0]}
        </div>
        <div style="font-size:13px;color:#888;margin-top:8px;">Press E on each syllable beat to help:</div>
        <div id="rep-dots" style="display:flex;justify-content:center;gap:8px;margin-top:12px;">
          ${[0,1,2].map(i => `<div style="width:20px;height:20px;border-radius:50%;background:${i < this.englishReps % 3 ? '#4CAF50' : '#333'};transition:background 0.2s;"></div>`).join('')}
        </div>
      </div>
      <button id="english-e" style="${btnStyle}">Repeat with student (E)</button>
      <div id="english-ledger" style="font-size:13px;color:#aaa;margin-top:4px;">
        Capital deployed: $${gameState.tracking.capitalDeployed} | Words taught: ${gameState.tracking.englishWordsTaught}
      </div>
    `;
    document.body.appendChild(el);
    this.englishOverlay = el;

    let repInWord = 0;
    el.querySelector('#english-e')!.addEventListener('click', () => {
      repInWord++;
      const attemptEl = el.querySelector('#student-attempt') as HTMLElement;
      if (repInWord <= attempts_for_word.length) {
        attemptEl.textContent = attempts_for_word[Math.min(repInWord - 1, attempts_for_word.length - 1)];
      }
      // Update dots
      const dots = el.querySelectorAll('#rep-dots div') as NodeListOf<HTMLElement>;
      dots.forEach((d, i) => { d.style.background = i < repInWord ? '#4CAF50' : '#333'; });

      if (repInWord >= 3) {
        // Word mastered!
        gameState.tracking.englishWordsTaught++;
        showToast(`${student.name} learned "${currentWord}"!`, '#FFD700', 2000);

        if (repInWord === 3 && (this.englishWordIndex + 1) % 3 === 0) {
          // Set complete -> give cash
          const reward = isGraduation ? TUNING.english.graduationUSD : TUNING.english.rewardPerSetUSD;
          gameState.tracking.capitalDeployed += reward;
          gameState.stats.cash -= reward;
          showToast(`$${reward} handed to ${student.name}! Best ROI of your career.`, '#4CAF50', 3000);
        }

        this.englishWordIndex++;
        const totalSets = student.sets * 3;
        if (this.englishWordIndex >= totalSets || (isGraduation)) {
          // Student done
          el.remove();
          this.englishOverlay = null;
          this.currentStudent++;
          modStat('patience', 5);
          modStat('bond', isGraduation ? 10 : 5);

          if (this.currentStudent >= 3) {
            if (gameState.tracking.capitalDeployed >= 14) grantAchievement('Angel Investor');
            this.finishEnglish();
          } else {
            setTimeout(() => this.buildEnglishOverlay(), 800);
          }
        } else {
          // Next word in set
          el.remove();
          this.englishOverlay = null;
          setTimeout(() => this.buildEnglishOverlay(), 500);
        }
      }
    });
    // Keyboard E support
    const keyHandler = (e: KeyboardEvent) => {
      if (e.code === 'KeyE') (el.querySelector('#english-e') as HTMLButtonElement)?.click();
    };
    document.addEventListener('keydown', keyHandler);
    this.chapterObjects.push({ userData: { cleanup: () => document.removeEventListener('keydown', keyHandler) } } as any);
  }

  finishEnglish() {
    showDialogue('Anu', '"Thank you, Marc! Bayarlalaa!"', () => {
      showCaption('HUD ledger: "Capital deployed: $14. Portfolio: 3 future founders. Best ROI of your career."', 4000, () => {
        this.goToChapter('finale');
      });
    });
  }

  updateCh8(_dt: number) {}

  // ---- FINALE: Meaning of Life ----
  initFinale() {
    this.player.enabled = true;
    this.player.camera.position.set(0, 1.7, 80);
    this.player.yaw = 0;
    this.scene.background = new THREE.Color(0x4a6a9a);
    this.player.setSleeveColor(0x1a4a9a); // blue deel

    showTitleCard('Finale', 'Meaning of Life', () => {
      showDialogue('Baatar', '"For you." *holds out a royal blue deel and helps you put it on*', () => {
        gameState.deelUnlocked = true;
        this.player.setSleeveColor(0x1a4a9a);
        this.startFinaleSequence();
      });
    });
  }

  startFinaleSequence() {
    // One bar of signal on the ovoo hill
    gameState.stats.signal = 1;
    const notifBurst = 4812 - gameState.stats.notifications;
    gameState.stats.notifications = 4812;
    showCaption('One bar. 4,812 notifications flood in.', 2500, () => {
      this.showFinaleChoice();
    });
  }

  showFinaleChoice() {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;bottom:140px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.9);border-radius:12px;padding:16px 24px;z-index:9998;font-family:system-ui;color:#fff;text-align:center;';
    el.innerHTML = `
      <div style="font-size:14px;color:#aaa;margin-bottom:12px;">The phone buzzes. 4,000+ notifications.</div>
      <div style="display:flex;gap:12px;justify-content:center;">
        <button id="finale-open" style="${btnStyleSecondary}">Open the laptop</button>
        <button id="finale-put" style="${btnStyle}">Put the phone away</button>
      </div>
    `;
    document.body.appendChild(el);

    const afterChoice = () => {
      el.remove();
      // Either way: the final shot
      showDialogue(NAMES.player, '*smiles, closes it* Some things can wait.', () => {
        this.theFinalShot();
      });
    };

    el.querySelector('#finale-open')!.addEventListener('click', () => {
      showDialogue(NAMES.player, '*opens laptop, reads one line, smiles* Nah.', () => {
        afterChoice();
      });
    });
    el.querySelector('#finale-put')!.addEventListener('click', afterChoice);
    this.chapterObjects.push({ userData: { cleanup: () => el.remove() } } as any);
  }

  theFinalShot() {
    this.player.enabled = false;
    // Move camera for cinematic
    this.player.camera.position.set(-5, 2, -20);
    this.player.pitch = 0.05;

    // Build the final scene procedurally
    const g = new THREE.Group();

    // Steppe lighting: golden hour
    const goldenLight = new THREE.DirectionalLight(0xffd080, 1.5);
    goldenLight.position.set(-20, 15, 30);
    g.add(goldenLight);
    g.add(new THREE.AmbientLight(0xffa060, 0.4));

    // Baatar figure walking toward camera with buckets
    const baatarGroup = new THREE.Group();
    const baatarBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 1.0, 3, 6), new THREE.MeshLambertMaterial({ color: 0x1a4a9a }));
    baatarBody.position.y = 1.0;
    baatarGroup.add(baatarBody);
    const baatarHead = new THREE.Mesh(new THREE.SphereGeometry(0.25, 6, 5), new THREE.MeshLambertMaterial({ color: 0xd4956a }));
    baatarHead.position.y = 1.9;
    baatarGroup.add(baatarHead);
    // Belt
    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.04, 4, 8), new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
    belt.position.y = 0.7;
    belt.rotation.x = Math.PI / 2;
    baatarGroup.add(belt);
    // Buckets
    for (const side of [-0.5, 0.5]) {
      const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.22, 6), new THREE.MeshLambertMaterial({ color: 0xb0b8c0 }));
      bucket.position.set(side, 0.7, 0);
      baatarGroup.add(bucket);
    }
    baatarGroup.position.set(0, getTerrainY(0, 10), 10);
    g.add(baatarGroup);
    this.addToChapter(g);

    // Saraa toddler running toward him
    const saraaGroup = new THREE.Group();
    const saraaBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.4, 3, 4), new THREE.MeshLambertMaterial({ color: 0xe8e0c8 }));
    saraaBody.position.y = 0.5;
    saraaGroup.add(saraaBody);
    const saraaHead = new THREE.Mesh(new THREE.SphereGeometry(0.14, 5, 4), new THREE.MeshLambertMaterial({ color: 0xd4956a }));
    saraaHead.position.y = 1.0;
    saraaGroup.add(saraaHead);
    saraaGroup.position.set(-3, getTerrainY(-3, 5), 5);
    g.add(saraaGroup);

    // Yaks in background
    for (let i = 0; i < 5; i++) {
      const yak = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 1.8), new THREE.MeshLambertMaterial({ color: [0x3a2a1a, 0x1a1a1a, 0xe8e8d8][i % 3] }));
      yak.position.set(-10 + i * 5, getTerrainY(-10 + i * 5, 25), 25);
      yak.position.y += 0.45;
      g.add(yak);
    }

    // Animate: Baatar walks toward camera, Saraa runs
    let animT = 0;
    const animate = () => {
      animT += 0.016;
      baatarGroup.position.z -= 0.05;
      // Slight bob
      baatarGroup.position.y = getTerrainY(baatarGroup.position.x, baatarGroup.position.z) + Math.sin(animT * 4) * 0.02;
      saraaGroup.position.z -= 0.12;
      saraaGroup.position.y = getTerrainY(saraaGroup.position.x, saraaGroup.position.z);
      // Toddler bob
      saraaGroup.rotation.z = Math.sin(animT * 8) * 0.15;

      if (animT < 5) requestAnimationFrame(animate);
      else this.showMeaningOfLife();
    };
    setTimeout(animate, 500);

    // Slow motion feel via caption
    showCaption('', 500);
  }

  showMeaningOfLife() {
    // The "Meaning of life" caption -- exact recreation of photo 1 style
    const el = document.createElement('div');
    el.style.cssText = `
      position:fixed;
      bottom:10%;
      left:50%;
      transform:translateX(-50%);
      background:#000;
      color:#fff;
      padding:14px 28px;
      border-radius:12px;
      font-size:28px;
      font-weight:900;
      letter-spacing:0.04em;
      font-family:'Helvetica Neue','Arial',system-ui,sans-serif;
      z-index:9999;
      opacity:0;
      transition:opacity 1.5s ease;
      pointer-events:none;
    `;
    el.textContent = 'Meaning of life';
    document.body.appendChild(el);
    setTimeout(() => { el.style.opacity = '1'; }, 100);

    setTimeout(() => {
      // Fade to white
      const fade = document.createElement('div');
      fade.style.cssText = 'position:fixed;inset:0;background:#fff;opacity:0;transition:opacity 2s;z-index:99999;pointer-events:none;';
      document.body.appendChild(fade);
      setTimeout(() => { fade.style.opacity = '1'; }, 100);
      setTimeout(() => {
        el.remove();
        fade.remove();
        this.showExpenseReport();
      }, 2200);
    }, 4000);
  }

  showExpenseReport() {
    showExpenseReport(gameState as unknown as { oooMessage: string; tracking: Record<string, number>; stats: Record<string, number> });
  }

  updateFinale(_dt: number) {}

  initFreeRoamMode() {
    this.player.enabled = true;
    this.scene.background = new THREE.Color(0x5a8a6a);
    showObjective('Free Roam! Explore the steppe. All chapters in debug menu.');
    showToast('Welcome to Free Roam. The steppe is yours.', '#FFD700', 4000);
  }
}

const btnStyle = `background:#4CAF50;color:#fff;border:none;border-radius:8px;padding:10px 20px;font-size:15px;font-weight:700;cursor:pointer;font-family:system-ui;`;
const btnStyleSecondary = `background:rgba(255,255,255,0.15);color:#fff;border:1px solid rgba(255,255,255,0.3);border-radius:8px;padding:10px 20px;font-size:15px;cursor:pointer;font-family:system-ui;`;
