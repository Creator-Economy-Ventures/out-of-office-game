// Central game state store
import { TUNING } from '../config/tuning';

export interface GameState {
  chapter: string;
  stats: {
    strength: number;
    patience: number;
    stamina: number;
    staminaMax: number;
    bond: number;
    cash: number;
    notifications: number;
    signal: number;
  };
  tracking: {
    bucketsCarried: number;
    waterDelivered: number;
    yakNegotiated: boolean;
    gersRaised: number;
    aaruulChewed: number;
    cardWins: number;
    cardLosses: number;
    englishWordsTaught: number;
    capitalDeployed: number;
    notificationsIgnored: number;
    phoneChecks: number;
  };
  achievements: Set<string>;
  oooMessage: string;
  phrasesLearned: Set<string>;
  currentDay: number;
  yakInPen: boolean;
  gerBuilt: boolean;
  deelUnlocked: boolean;
}

export const gameState: GameState = {
  chapter: 'title',
  stats: {
    strength: 30,
    patience: 30,
    stamina: TUNING.player.staminaMax,
    staminaMax: TUNING.player.staminaMax,
    bond: 0,
    cash: TUNING.startingCashUSD,
    notifications: TUNING.startingNotifications,
    signal: 5,
  },
  tracking: {
    bucketsCarried: 0,
    waterDelivered: 0,
    yakNegotiated: false,
    gersRaised: 0,
    aaruulChewed: 0,
    cardWins: 0,
    cardLosses: 0,
    englishWordsTaught: 0,
    capitalDeployed: 0,
    notificationsIgnored: 0,
    phoneChecks: 0,
  },
  achievements: new Set(),
  oooMessage: "I'm currently off the grid in Mongolia. No ETA. The yaks can't Slack.",
  phrasesLearned: new Set(),
  currentDay: 1,
  yakInPen: false,
  gerBuilt: false,
  deelUnlocked: false,
};

export function modStat(stat: keyof GameState['stats'], delta: number) {
  const s = gameState.stats as Record<string, number>;
  s[stat] = Math.max(0, Math.min(stat === 'stamina' ? gameState.stats.staminaMax : 100, s[stat] + delta));
  showStatToast(stat, delta);
}

export function grantAchievement(id: string) {
  if (gameState.achievements.has(id)) return;
  gameState.achievements.add(id);
  showAchievementToast(id);
}

// Simple event bus
type EventHandler = (...args: unknown[]) => void;
const listeners: Record<string, EventHandler[]> = {};

export function on(event: string, fn: EventHandler) {
  if (!listeners[event]) listeners[event] = [];
  listeners[event].push(fn);
}

export function off(event: string, fn: EventHandler) {
  if (listeners[event]) listeners[event] = listeners[event].filter(f => f !== fn);
}

export function emit(event: string, ...args: unknown[]) {
  (listeners[event] || []).forEach(fn => fn(...args));
}

// Toast system
function showStatToast(stat: string, delta: number) {
  if (delta === 0) return;
  const label: Record<string, string> = {
    strength: 'Strength',
    patience: 'Patience',
    bond: 'Bond',
    stamina: 'Stamina',
    cash: 'Cash',
  };
  if (!label[stat]) return;
  const sign = delta > 0 ? '+' : '';
  showToast(`${label[stat]} ${sign}${delta}`, delta > 0 ? '#4CAF50' : '#f44336');
}

function showAchievementToast(id: string) {
  showToast(`Achievement: ${id.replace(/_/g, ' ')}`, '#FFD700', 4000);
}

export function showToast(text: string, color = '#fff', duration = 2500) {
  const el = document.createElement('div');
  el.style.cssText = `
    position:fixed; bottom:${100 + Math.random() * 60}px; left:50%;
    transform:translateX(-50%); background:rgba(0,0,0,0.8);
    color:${color}; padding:6px 16px; border-radius:20px;
    font-size:14px; font-weight:600; pointer-events:none;
    z-index:999; animation:fadeUpToast 0.3s ease;
    font-family: 'Segoe UI', system-ui, sans-serif;
  `;
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), duration);
}

export function saveGame() {
  try {
    const save = {
      chapter: gameState.chapter,
      stats: gameState.stats,
      tracking: gameState.tracking,
      achievements: Array.from(gameState.achievements),
      oooMessage: gameState.oooMessage,
      phrasesLearned: Array.from(gameState.phrasesLearned),
      yakInPen: gameState.yakInPen,
      gerBuilt: gameState.gerBuilt,
      deelUnlocked: gameState.deelUnlocked,
    };
    localStorage.setItem('oof_save', JSON.stringify(save));
  } catch (_) {}
}

export function loadGame() {
  try {
    const raw = localStorage.getItem('oof_save');
    if (!raw) return false;
    const save = JSON.parse(raw);
    Object.assign(gameState.stats, save.stats);
    Object.assign(gameState.tracking, save.tracking);
    gameState.achievements = new Set(save.achievements);
    gameState.oooMessage = save.oooMessage;
    gameState.phrasesLearned = new Set(save.phrasesLearned);
    gameState.yakInPen = save.yakInPen;
    gameState.gerBuilt = save.gerBuilt;
    gameState.deelUnlocked = save.deelUnlocked;
    return true;
  } catch (_) {
    return false;
  }
}
