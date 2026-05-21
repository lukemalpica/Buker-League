import { MONSTERS, ISLANDS, STARTERS } from "./data.js";

const SAVE_KEY = "buker_save_v1";

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function defaultState() {
  return {
    phase: "register",
    playerName: "",
    coins: 0,
    shards: [],
    islandIndex: 0,
    /** @type {import('./types').OwnedMonster[]} */
    party: [],
    inventoryEggs: [],
    timothyIntroDone: false,
    timothyMidDone: false,
    legendaryHatched: false,
    arenaUnlocked: false,
    gameComplete: false,
  };
}

/**
 * @param {string} templateId
 * @param {{ level?: number, isEgg?: boolean, nickname?: string }} opts
 */
export function makeMonster(templateId, opts = {}) {
  const def = MONSTERS[templateId];
  if (!def) throw new Error("Unknown monster " + templateId);
  const level = Math.max(1, opts.level ?? 5);
  const scale = 1 + (level - 1) * 0.08;
  const maxHp = Math.round(def.baseHp * scale);
  return {
    uid: uid(),
    templateId,
    nickname: opts.nickname ?? def.name,
    level,
    xp: 0,
    maxHp,
    hp: maxHp,
    strength: Math.round(def.baseStr * scale),
    isEgg: opts.isEgg ?? false,
  };
}

export function templateForOwned(m) {
  return MONSTERS[m.templateId];
}

export function xpToNextLevel(level) {
  return 40 + level * 12;
}

export function addXp(mon, amount) {
  let xp = mon.xp + amount;
  let level = mon.level;
  const def = templateForOwned(mon);
  let next = xpToNextLevel(level);
  while (xp >= next) {
    xp -= next;
    level += 1;
    next = xpToNextLevel(level);
  }
  mon.xp = xp;
  if (level !== mon.level) {
    mon.level = level;
    const scale = 1 + (level - 1) * 0.08;
    mon.maxHp = Math.round(def.baseHp * scale);
    mon.strength = Math.round(def.baseStr * scale);
    mon.hp = Math.min(mon.maxHp, mon.hp + Math.round(mon.maxHp * 0.15));
    tryEvolve(mon);
  }
}

export function tryEvolve(mon) {
  const def = templateForOwned(mon);
  if (!def.evolvesTo || !def.evolveLevel) return false;
  if (mon.level < def.evolveLevel || mon.isEgg) return false;
  const nextDef = MONSTERS[def.evolvesTo];
  if (!nextDef) return false;
  mon.templateId = def.evolvesTo;
  mon.nickname = nextDef.name;
  const scale = 1 + (mon.level - 1) * 0.08;
  mon.maxHp = Math.round(nextDef.baseHp * scale);
  mon.strength = Math.round(nextDef.baseStr * scale);
  mon.hp = mon.maxHp;
  return true;
}

export function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveState(state) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

export function wipeSave() {
  localStorage.removeItem(SAVE_KEY);
}

export function allShardsCollected(state) {
  return state.shards.length >= ISLANDS.length;
}

export function grantShard(state, islandId) {
  if (state.shards.includes(islandId)) return false;
  state.shards.push(islandId);
  if (allShardsCollected(state)) {
    state.arenaUnlocked = true;
    if (!state.inventoryEggs.some((e) => e.kind === "legendary")) {
      state.inventoryEggs.push({ kind: "legendary", uid: uid() });
    }
  }
  return true;
}

export function isValidStarter(id) {
  return STARTERS.includes(id);
}
