import { gameState, on } from '../core/store';
import { NAMES } from '../config/names';

// ---- HUD ----
let hudEl: HTMLElement;
let interactPromptEl: HTMLElement;
let crosshairEl: HTMLElement;
let captionEl: HTMLElement;
let titleCardEl: HTMLElement;
let phoneOverlayEl: HTMLElement;
let phoneVisible = false;
let debugMenuEl: HTMLElement;
let debugVisible = false;
let journalEl: HTMLElement;
let journalVisible = false;

export function initUI() {
  const ui = document.getElementById('ui')!;

  // Inject CSS
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeUpToast { from { opacity:0; transform:translateX(-50%) translateY(10px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
    @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
    @keyframes typewriter { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0% 0 0); } }
    .hud-bar { background: rgba(0,0,0,0.5); border-radius: 4px; overflow: hidden; }
    .hud-bar-fill { height: 100%; border-radius: 4px; transition: width 0.3s; }
    .mongolian { border-bottom: 1px dashed #aaa; cursor: help; }
  `;
  document.head.appendChild(style);

  // HUD
  hudEl = document.createElement('div');
  hudEl.id = 'hud';
  hudEl.style.cssText = `position:absolute;top:16px;left:16px;color:#fff;font-size:13px;text-shadow:1px 1px 2px #000;pointer-events:none;`;
  ui.appendChild(hudEl);

  // Crosshair
  crosshairEl = document.createElement('div');
  crosshairEl.style.cssText = `position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
    width:12px;height:12px;pointer-events:none;`;
  crosshairEl.innerHTML = `<div style="position:absolute;top:5px;left:0;width:12px;height:2px;background:rgba(255,255,255,0.8);border-radius:1px;"></div>
    <div style="position:absolute;top:0;left:5px;width:2px;height:12px;background:rgba(255,255,255,0.8);border-radius:1px;"></div>`;
  ui.appendChild(crosshairEl);

  // Interact prompt
  interactPromptEl = document.createElement('div');
  interactPromptEl.style.cssText = `position:absolute;bottom:120px;left:50%;transform:translateX(-50%);
    background:rgba(0,0,0,0.7);color:#fff;padding:8px 16px;border-radius:8px;font-size:15px;
    pointer-events:none;display:none;border:1px solid rgba(255,255,255,0.2);`;
  ui.appendChild(interactPromptEl);

  // Caption (lower third)
  captionEl = document.createElement('div');
  captionEl.style.cssText = `position:absolute;bottom:80px;left:50%;transform:translateX(-50%);
    background:#000;color:#fff;padding:10px 20px;border-radius:8px;font-size:22px;font-weight:700;
    pointer-events:none;display:none;letter-spacing:0.02em;`;
  ui.appendChild(captionEl);

  // Title card
  titleCardEl = document.createElement('div');
  titleCardEl.style.cssText = `position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
    background:rgba(0,0,0,0.85);color:#fff;font-size:48px;font-weight:900;letter-spacing:0.1em;
    pointer-events:none;display:none;flex-direction:column;gap:16px;`;
  ui.appendChild(titleCardEl);

  // Phone overlay
  phoneOverlayEl = createPhoneOverlay(ui);

  // Debug menu
  debugMenuEl = createDebugMenu(ui);

  // Journal
  journalEl = createJournal(ui);

  updateHUD();
  setInterval(updateHUD, 200);
}

function updateHUD() {
  if (!hudEl) return;
  const s = gameState.stats;
  hudEl.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:4px;min-width:160px;">
      <div style="display:flex;align-items:center;gap:6px;">
        <span style="width:72px;opacity:0.8;">Strength</span>
        <div class="hud-bar" style="flex:1;height:6px;width:80px;">
          <div class="hud-bar-fill" style="width:${s.strength}%;background:#e84040;"></div>
        </div>
        <span style="width:28px;text-align:right;font-size:11px;">${Math.floor(s.strength)}</span>
      </div>
      <div style="display:flex;align-items:center;gap:6px;">
        <span style="width:72px;opacity:0.8;">Patience</span>
        <div class="hud-bar" style="flex:1;height:6px;width:80px;">
          <div class="hud-bar-fill" style="width:${s.patience}%;background:#40a0e8;"></div>
        </div>
        <span style="width:28px;text-align:right;font-size:11px;">${Math.floor(s.patience)}</span>
      </div>
      <div style="display:flex;align-items:center;gap:6px;">
        <span style="width:72px;opacity:0.8;">Stamina</span>
        <div class="hud-bar" style="flex:1;height:6px;width:80px;">
          <div class="hud-bar-fill" style="width:${(s.stamina/s.staminaMax)*100}%;background:#40e880;"></div>
        </div>
        <span style="width:28px;text-align:right;font-size:11px;">${Math.floor(s.stamina)}</span>
      </div>
      <div style="display:flex;align-items:center;gap:6px;">
        <span style="width:72px;opacity:0.8;">Bond</span>
        <div class="hud-bar" style="flex:1;height:6px;width:80px;">
          <div class="hud-bar-fill" style="width:${s.bond}%;background:#e8a040;"></div>
        </div>
        <span style="width:28px;text-align:right;font-size:11px;">${Math.floor(s.bond)}</span>
      </div>
      <div style="margin-top:4px;opacity:0.7;font-size:12px;">
        $${s.cash} | ${signalBars(s.signal)} | 📱 ${s.notifications.toLocaleString()}
      </div>
    </div>
  `;
}

function signalBars(n: number): string {
  let out = '';
  for (let i = 1; i <= 5; i++) out += i <= n ? '▮' : '▯';
  return out;
}

export function showInteractPrompt(text: string) {
  if (!interactPromptEl) return;
  interactPromptEl.textContent = text;
  interactPromptEl.style.display = 'block';
}
export function hideInteractPrompt() {
  if (!interactPromptEl) return;
  interactPromptEl.style.display = 'none';
}

export function showCaption(text: string, duration = 4000) {
  captionEl.textContent = text;
  captionEl.style.display = 'block';
  setTimeout(() => { captionEl.style.display = 'none'; }, duration);
}

export function showTitleCard(chapter: string, subtitle: string): Promise<void> {
  return new Promise(resolve => {
    titleCardEl.style.display = 'flex';
    titleCardEl.innerHTML = `
      <div style="font-size:14px;letter-spacing:0.3em;opacity:0.6;text-transform:uppercase;">Chapter</div>
      <div style="font-size:42px;font-weight:900;letter-spacing:0.08em;">${chapter}</div>
      <div style="font-size:18px;opacity:0.7;font-weight:400;">${subtitle}</div>
    `;
    setTimeout(() => {
      titleCardEl.style.display = 'none';
      resolve();
    }, 3000);
  });
}

// ---- Phone overlay ----
function createPhoneOverlay(parent: HTMLElement): HTMLElement {
  const el = document.createElement('div');
  el.style.cssText = `position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
    width:300px;height:480px;background:#1a1a2e;border-radius:30px;border:3px solid #333;
    display:none;flex-direction:column;pointer-events:auto;overflow:hidden;z-index:100;`;

  el.innerHTML = `
    <div style="background:#2a2a3e;padding:20px 20px 10px;color:#fff;text-align:center;">
      <div style="font-size:11px;opacity:0.6;margin-bottom:4px;">OUT OF OFFICE</div>
      <div id="phone-signal" style="font-size:16px;letter-spacing:3px;"></div>
      <div id="phone-notif" style="font-size:32px;font-weight:700;margin:8px 0;color:#ff6060;"></div>
      <div style="font-size:11px;opacity:0.5;">unread</div>
    </div>
    <div id="phone-messages" style="flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;"></div>
    <div style="padding:12px;text-align:center;background:#2a2a3e;">
      <button id="phone-close" style="background:#444;color:#fff;border:none;padding:8px 24px;border-radius:16px;cursor:pointer;font-size:13px;">Close (P)</button>
    </div>
  `;

  parent.appendChild(el);
  document.getElementById('phone-close')!.onclick = togglePhone;
  return el;
}

export function togglePhone() {
  phoneVisible = !phoneVisible;
  phoneOverlayEl.style.display = phoneVisible ? 'flex' : 'none';
  if (phoneVisible) updatePhone();
  if (phoneVisible) {
    try { document.exitPointerLock(); } catch(_) {}
  }
}

function updatePhone() {
  const s = gameState.stats;
  const sigEl = document.getElementById('phone-signal');
  const notifEl = document.getElementById('phone-notif');
  const msgEl = document.getElementById('phone-messages');
  if (sigEl) sigEl.textContent = signalBars(s.signal);
  if (notifEl) notifEl.textContent = s.notifications.toLocaleString();
  if (msgEl) {
    const msgs = getPhoneMessages(s.signal);
    msgEl.innerHTML = msgs.map(m => `
      <div style="background:rgba(255,255,255,0.05);border-radius:10px;padding:8px 12px;">
        <div style="font-size:11px;opacity:0.5;margin-bottom:2px;">${m.sender}</div>
        <div style="font-size:13px;color:#eee;">${m.text}</div>
      </div>
    `).join('');
  }
}

function getPhoneMessages(signal: number) {
  if (signal >= 4) return [
    { sender: 'Team Hyper', text: 'CLOSED!!!! 🎉🎉🎉' },
    { sender: 'Calendar', text: 'You have 47 events this week' },
    { sender: 'Unknown +1 (212)', text: "Congrats! Let's connect soon." },
    { sender: 'Mom', text: 'Are you eating ok?' },
    { sender: 'Forbes', text: 'Request for comment on the deal' },
  ];
  if (signal >= 2) return [
    { sender: 'Team Hyper', text: 'Still no word from Marc...' },
    { sender: 'Mom', text: 'It went through right?' },
    { sender: 'Calendar', text: '3 meetings rescheduled. Again.' },
  ];
  if (signal >= 1) return [
    { sender: 'System', text: 'Message delayed. Retry?' },
    { sender: 'Team Hyper', text: 'Enjoy Mongolia! (finally went through)' },
  ];
  return [
    { sender: 'System', text: 'No service.' },
    { sender: 'System', text: 'Your out-of-office is working hard for you.' },
  ];
}

// ---- Debug menu ----
type ChapterJumper = (id: string) => void;
let _chapterJumper: ChapterJumper | null = null;

export function registerChapterJumper(fn: ChapterJumper) {
  _chapterJumper = fn;
}

function createDebugMenu(parent: HTMLElement): HTMLElement {
  const el = document.createElement('div');
  el.style.cssText = `position:absolute;top:10px;right:10px;width:280px;background:rgba(0,0,0,0.9);
    color:#0f0;font-size:12px;font-family:monospace;padding:14px;border-radius:8px;
    display:none;z-index:200;pointer-events:auto;border:1px solid #333;`;

  const chapters = [
    ['prologue', 'Prologue: Closing Day'],
    ['ch1', 'Ch1: Airplane Mode'],
    ['ch2', 'Ch2: Wax On Water Off'],
    ['ch3', 'Ch3: The Yak Who Would Not'],
    ['ch4', 'Ch4: Raise the Ger'],
    ['ch5', 'Ch5: The Guest Bowl'],
    ['ch6', 'Ch6: Card Night'],
    ['ch7', 'Ch7: Tag You\'re It'],
    ['ch8', 'Ch8: English Class'],
    ['finale', 'Finale: Meaning of Life'],
  ];

  el.innerHTML = `
    <div style="color:#ff0;font-weight:700;margin-bottom:10px;">DEBUG MENU (backtick to close)</div>
    <div style="color:#888;font-size:10px;margin-bottom:8px;">Jump to chapter:</div>
    ${chapters.map(([id, label]) =>
      `<button data-chapter="${id}" style="display:block;width:100%;text-align:left;background:transparent;
       color:#0f0;border:1px solid #333;padding:4px 8px;margin-bottom:3px;cursor:pointer;
       border-radius:4px;font-family:monospace;font-size:11px;">${label}</button>`
    ).join('')}
    <hr style="border-color:#333;margin:8px 0;">
    <div style="color:#888;font-size:10px;margin-bottom:6px;">Grant stats:</div>
    <button id="debug-max-stats" style="background:#1a3a1a;color:#0f0;border:1px solid #333;padding:4px 8px;
      border-radius:4px;cursor:pointer;font-family:monospace;font-size:11px;margin-right:4px;">Max Stats</button>
    <button id="debug-reset-stats" style="background:#3a1a1a;color:#f00;border:1px solid #333;padding:4px 8px;
      border-radius:4px;cursor:pointer;font-family:monospace;font-size:11px;">Reset</button>
  `;

  parent.appendChild(el);

  el.querySelectorAll('[data-chapter]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = (btn as HTMLElement).dataset.chapter!;
      if (_chapterJumper) _chapterJumper(id);
      toggleDebugMenu();
    });
  });

  document.getElementById('debug-max-stats')?.addEventListener('click', () => {
    gameState.stats.strength = 100;
    gameState.stats.patience = 100;
    gameState.stats.stamina = gameState.stats.staminaMax;
    gameState.stats.bond = 80;
  });

  document.getElementById('debug-reset-stats')?.addEventListener('click', () => {
    gameState.stats.strength = 30;
    gameState.stats.patience = 30;
    gameState.stats.bond = 0;
  });

  return el;
}

export function toggleDebugMenu() {
  debugVisible = !debugVisible;
  debugMenuEl.style.display = debugVisible ? 'block' : 'none';
}
export function isDebugMenuVisible() { return debugVisible; }

// ---- Journal ----
function createJournal(parent: HTMLElement): HTMLElement {
  const el = document.createElement('div');
  el.style.cssText = `position:absolute;inset:0;background:rgba(20,15,10,0.95);
    display:none;flex-direction:column;align-items:center;justify-content:center;
    pointer-events:auto;z-index:150;`;

  el.innerHTML = `
    <div style="max-width:600px;width:100%;padding:32px;color:#f0e8d0;">
      <h2 style="font-size:28px;margin-bottom:4px;color:#e8c060;">Journal</h2>
      <p style="opacity:0.5;font-size:12px;margin-bottom:24px;">Tab to close</p>
      <div id="journal-body"></div>
    </div>
  `;
  parent.appendChild(el);
  return el;
}

export function toggleJournal() {
  journalVisible = !journalVisible;
  journalEl.style.display = journalVisible ? 'flex' : 'none';
  if (journalVisible) updateJournal();
}

function updateJournal() {
  const body = document.getElementById('journal-body');
  if (!body) return;
  const s = gameState.stats;
  const phrases = Array.from(gameState.phrasesLearned);
  body.innerHTML = `
    <h3 style="color:#c8a040;margin-bottom:8px;">Stats</h3>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:20px;font-size:14px;">
      <div>Strength: ${Math.floor(s.strength)}</div>
      <div>Patience: ${Math.floor(s.patience)}</div>
      <div>Bond: ${Math.floor(s.bond)}</div>
      <div>Stamina: ${Math.floor(s.stamina)}/${s.staminaMax}</div>
      <div>Cash: $${s.cash}</div>
      <div>Notifications: ${s.notifications.toLocaleString()}</div>
    </div>
    <h3 style="color:#c8a040;margin-bottom:8px;">Mongolian Phrasebook</h3>
    <div style="font-size:13px;color:#c8c0a0;margin-bottom:20px;">
      ${phrases.length === 0
        ? '<em style="opacity:0.5">No phrases learned yet. Keep playing!</em>'
        : phrases.map(p => `<div style="margin-bottom:4px;">• ${p}</div>`).join('')}
    </div>
    <h3 style="color:#c8a040;margin-bottom:8px;">Achievements</h3>
    <div style="font-size:13px;color:#c8c0a0;">
      ${gameState.achievements.size === 0
        ? '<em style="opacity:0.5">No achievements yet.</em>'
        : Array.from(gameState.achievements).map(a => `<div>✓ ${a.replace(/_/g,' ')}</div>`).join('')}
    </div>
  `;
}

export function showDialogue(speaker: string, lines: string[], onDone?: () => void) {
  const ui = document.getElementById('ui')!;
  const el = document.createElement('div');
  el.style.cssText = `position:absolute;bottom:40px;left:50%;transform:translateX(-50%);
    width:min(600px,90vw);background:rgba(0,0,0,0.88);color:#fff;border-radius:12px;
    padding:20px 24px;pointer-events:auto;border:1px solid rgba(255,255,255,0.1);z-index:90;`;

  let idx = 0;
  function showLine() {
    if (idx >= lines.length) {
      el.remove();
      if (onDone) onDone();
      return;
    }
    el.innerHTML = `
      <div style="font-size:12px;color:#aaa;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.1em;">${speaker}</div>
      <div style="font-size:16px;line-height:1.5;">${lines[idx]}</div>
      <div style="font-size:11px;color:#666;margin-top:10px;text-align:right;">Click or E to continue</div>
    `;
    idx++;
  }
  showLine();
  el.addEventListener('click', showLine);
  document.addEventListener('keydown', function handler(e) {
    if (e.code === 'KeyE') { showLine(); if (idx >= lines.length) document.removeEventListener('keydown', handler); }
  });
  ui.appendChild(el);
  return el;
}

// Expense report end screen
function showExpenseReportCore(oooMsg: string): HTMLElement {
  const ui = document.getElementById('ui')!;
  const el = document.createElement('div');
  el.style.cssText = `position:absolute;inset:0;background:#f8f9fa;color:#1a1a1a;
    display:flex;align-items:center;justify-content:center;z-index:500;
    font-family:'Segoe UI',system-ui,sans-serif;pointer-events:auto;overflow-y:auto;`;

  const t = gameState.tracking;
  const wl = `${t.cardWins}W-${t.cardLosses}L`;

  el.innerHTML = `
    <div style="max-width:640px;width:100%;padding:40px;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
        <div style="background:#0052cc;color:#fff;padding:6px 16px;border-radius:4px;font-weight:700;font-size:14px;">HYPER AGENT</div>
        <div style="font-size:22px;font-weight:700;">Expense Report</div>
      </div>
      <div style="font-size:12px;color:#666;margin-bottom:28px;">Mongolia Trip - Summer 2026 - Auto-categorized</div>

      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:28px;">
        <thead>
          <tr style="background:#f0f0f0;text-align:left;">
            <th style="padding:10px 16px;">Item</th>
            <th style="padding:10px 16px;text-align:right;">Amount</th>
            <th style="padding:10px 16px;">Category</th>
          </tr>
        </thead>
        <tbody>
          ${row(`Buckets carried: ${t.bucketsCarried}`, '', 'Facilities')}
          ${row(`Water delivered: ${Math.floor(t.waterDelivered)} L`, '', 'Utilities')}
          ${row(`Yaks negotiated: ${t.yakNegotiated ? 1 : 0}`, '', 'Professional Services')}
          ${row(`Gers raised: ${t.gersRaised}`, '', 'Real Estate')}
          ${row(`Aaruul chewed: ${t.aaruulChewed}`, '', 'Meals & Entertainment')}
          ${row(`Card nights: ${wl}`, '', 'Team Building')}
          ${row(`English words taught: ${t.englishWordsTaught}`, '', 'Education')}
          ${row(`Capital deployed: $${t.capitalDeployed} to 3 founders`, `$${t.capitalDeployed}`, 'Angel Investing')}
          ${row(`Notifications ignored: ${t.notificationsIgnored.toLocaleString()}`, '', 'Wellness')}
          ${row('Receipts missing: 0', '', '')}
        </tbody>
      </table>

      <div style="background:#e8f5e9;border-left:4px solid #4caf50;padding:14px 20px;border-radius:4px;margin-bottom:24px;">
        <div style="font-weight:700;font-size:16px;color:#1a5c1a;">Status: Approved.</div>
        <div style="font-size:12px;color:#2e7d32;margin-top:2px;">All expenses look reasonable. Especially the yak.</div>
      </div>

      <div style="background:#f5f5f0;border-radius:8px;padding:16px 20px;margin-bottom:28px;">
        <div style="font-size:11px;color:#999;margin-bottom:6px;">OUT-OF-OFFICE REPLY (sent to 4,812 people)</div>
        <div style="font-size:15px;font-style:italic;color:#333;">"${oooMsg}"</div>
      </div>

      <div style="display:flex;gap:12px;">
        <button id="exp-freeRoam" style="flex:1;background:#0052cc;color:#fff;border:none;padding:14px;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;">Free Roam</button>
        <button id="exp-replay" style="flex:1;background:#fff;color:#333;border:2px solid #ddd;padding:14px;border-radius:8px;font-size:15px;cursor:pointer;">Play Again</button>
      </div>

      <div style="text-align:center;margin-top:32px;font-size:11px;color:#bbb;">
        OUT OF OFFICE &bull; Made with love for the steppe
      </div>
    </div>
  `;

  ui.appendChild(el);
  document.getElementById('exp-replay')?.addEventListener('click', () => location.reload());
  document.getElementById('exp-freeRoam')?.addEventListener('click', () => {
    el.remove();
    on('startFreeRoam', () => {});
  });
  return el;
}

function row(label: string, amount: string, category: string): string {
  return `<tr style="border-bottom:1px solid #eee;">
    <td style="padding:10px 16px;">${label}</td>
    <td style="padding:10px 16px;text-align:right;color:#666;">${amount}</td>
    <td style="padding:10px 16px;color:#0052cc;font-size:12px;">${category}</td>
  </tr>`;
}

export function showMeaningOfLife(onDone: () => void) {
  const ui = document.getElementById('ui')!;
  const overlay = document.createElement('div');
  overlay.style.cssText = `position:absolute;inset:0;background:rgba(0,0,0,0);
    display:flex;align-items:flex-end;justify-content:center;padding-bottom:80px;
    pointer-events:none;z-index:400;transition:background 2s;`;

  const caption = document.createElement('div');
  caption.style.cssText = `background:#000;color:#fff;padding:12px 28px;border-radius:10px;
    font-size:28px;font-weight:700;opacity:0;transition:opacity 2s;letter-spacing:0.02em;`;
  caption.textContent = 'Meaning of life';
  overlay.appendChild(caption);
  ui.appendChild(overlay);

  // Fade in caption after 1s
  setTimeout(() => { caption.style.opacity = '1'; }, 1000);

  // Fade to white after 5s
  setTimeout(() => {
    const white = document.createElement('div');
    white.style.cssText = `position:absolute;inset:0;background:#fff;opacity:0;z-index:450;transition:opacity 2s;pointer-events:none;`;
    ui.appendChild(white);
    setTimeout(() => { white.style.opacity = '1'; }, 100);
    setTimeout(() => { overlay.remove(); white.remove(); onDone(); }, 2500);
  }, 5000);
}

export function showHyperToast(text: string) {
  const el = document.createElement('div');
  el.style.cssText = `position:fixed;bottom:20px;right:20px;background:rgba(0,82,204,0.9);
    color:#fff;padding:8px 14px;border-radius:8px;font-size:12px;font-family:'Segoe UI',system-ui,sans-serif;
    max-width:240px;z-index:300;pointer-events:none;animation:fadeIn 0.3s ease;`;
  el.innerHTML = `<div style="font-size:10px;opacity:0.7;margin-bottom:2px;">HYPER AGENT</div>${text}`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 5000);
}

export function isPhoneVisible() { return phoneVisible; }
export function isJournalVisible() { return journalVisible; }

// ---- Compatibility shims for chapters.ts API ----

// showCaption with optional callback
export function showCaptionCb(text: string, duration: number, onDone?: () => void) {
  showCaption(text, duration);
  if (onDone) setTimeout(onDone, duration);
}

// showTitleCard with callback instead of promise
export function showTitleCardCb(chapter: string, subtitle: string, onDone?: () => void) {
  showTitleCard(chapter, subtitle).then(() => { if (onDone) onDone(); });
}

// showDialogue with single string (not array)
export function showDialogueCb(speaker: string, line: string, onDone?: () => void) {
  showDialogue(speaker, [line], onDone);
}

// toggleDebugMenu with chapterManager arg
export function toggleDebugMenuWithManager(chapterManager: { goToChapter: (id: string) => void }) {
  registerChapterJumper((id) => chapterManager.goToChapter(id));
  toggleDebugMenu();
}

// showObjective (just a toast)
export function showObjective(text: string) {
  const el = document.getElementById('ui');
  const existing = document.getElementById('objective-bar');
  if (existing) existing.remove();
  const obj = document.createElement('div');
  obj.id = 'objective-bar';
  obj.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.75);color:#fff;padding:6px 16px;border-radius:20px;font-size:13px;z-index:800;pointer-events:none;max-width:60vw;text-align:center;border:1px solid rgba(255,255,255,0.15);';
  obj.textContent = '▶ ' + text;
  document.body.appendChild(obj);
}

// hideDialogue
export function hideDialogue() {
  document.querySelectorAll('[data-dialogue]').forEach(el => el.remove());
}

// showPhoneOverlay / hidePhoneOverlay (already have togglePhone)
export function showPhoneOverlay() {
  if (!phoneVisible) togglePhone();
}
export function hidePhoneOverlay() {
  if (phoneVisible) togglePhone();
}

// updateHyperAgent
export function updateHyperAgent(text: string) {
  showHyperToast(text);
}

// showExpenseReport with GameState object (overload)
export function showExpenseReport(stateOrMsg: string | { oooMessage: string; tracking: Record<string, number>; stats: Record<string, number> }): HTMLElement {
  if (typeof stateOrMsg === 'string') {
    return showExpenseReportCore(stateOrMsg);
  }
  const gs = stateOrMsg as { oooMessage: string };
  return showExpenseReportCore(gs.oooMessage);
}
