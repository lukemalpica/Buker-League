import { MONSTERS } from "./data.js";
import { makeMonster, templateForOwned, addXp } from "./state.js";

/**
 * @param {import('./types').OwnedMonster} mon
 * @param {number} level
 */
function cloneWild(monId, level) {
  return makeMonster(monId, { level });
}

/**
 * @param {object} opts
 * @param {import('./types').OwnedMonster[]} playerParty
 * @param {number} activeIndex
 * @param {string} enemyTemplateId
 * @param {number} enemyLevel
 * @param {{ forcePlayerLoss?: boolean }} rules
 */
export function createBattle(opts) {
  const enemy = cloneWild(opts.enemyTemplateId, opts.enemyLevel);
  const party = opts.playerParty.filter((m) => !m.isEgg);
  const activeIndex = Math.min(
    Math.max(0, opts.activeIndex),
    Math.max(0, party.length - 1),
  );
  const playerMon = party[activeIndex];
  return {
    rules: { forcePlayerLoss: !!opts.rules?.forcePlayerLoss },
    party,
    activeIndex,
    player: { label: opts.playerName || "You", mon: playerMon },
    enemy: { label: opts.enemyName || "Foe", mon: enemy },
    log: [],
    over: false,
    winner: null,
    needsSwitch: false,
  };
}

/**
 * @param {import('./types').OwnedMonster} attacker
 * @param {import('./types').OwnedMonster} defender
 * @param {number} moveIndex
 */
export function rollDamage(attacker, defender, moveIndex) {
  const def = templateForOwned(attacker);
  const move = def.moves[moveIndex];
  if (!move) return { damage: 0, crit: false, move: { name: "Struggle", power: 1 } };
  const str = attacker.strength;
  const base = move.power + str * 0.35;
  const variance = 0.85 + Math.random() * 0.3;
  let damage = Math.max(1, Math.round(base * variance));
  const crit = Math.random() < Math.min(0.22, 0.08 + attacker.strength * 0.004);
  if (crit) damage = Math.round(damage * 1.45);
  return { damage, crit, move };
}

function appendTurn(battle, attackerSide, moveIndex) {
  const atkSide = attackerSide === "player" ? battle.player : battle.enemy;
  const defSide = attackerSide === "player" ? battle.enemy : battle.player;
  if (!atkSide.mon || atkSide.mon.hp <= 0) return;
  const r = rollDamage(atkSide.mon, defSide.mon, moveIndex);
  defSide.mon.hp -= r.damage;
  battle.log.push(
    `${atkSide.mon.nickname} used ${r.move.name} for ${r.damage}${r.crit ? " (CRIT!)" : ""}!`,
  );
  if (defSide.mon.hp <= 0) {
    defSide.mon.hp = 0;
    battle.over = true;
    battle.winner = attackerSide === "player" ? "player" : "enemy";
  }
}

/**
 * @param {ReturnType<typeof createBattle>} battle
 * @param {number} playerMoveIndex
 */
export function battleStep(battle, playerMoveIndex) {
  if (battle.over || battle.needsSwitch) return;

  const em = MONSTERS[battle.enemy.mon.templateId];
  const enemyMove = Math.floor(Math.random() * em.moves.length);

  const playerFirst = battle.player.mon.strength >= battle.enemy.mon.strength
    ? Math.random() < 0.58
    : Math.random() < 0.42;

  const first = playerFirst ? "player" : "enemy";
  const second = playerFirst ? "enemy" : "player";

  appendTurn(battle, first, first === "player" ? playerMoveIndex : enemyMove);
  if (!battle.over) {
    appendTurn(battle, second, second === "player" ? playerMoveIndex : enemyMove);
  }

  if (battle.rules.forcePlayerLoss && battle.winner !== "enemy") {
    battle.player.mon.hp = 0;
    battle.log.push("Timothy's legend aura pins you down…");
    battle.over = true;
    battle.winner = "enemy";
  }

  if (battle.winner === "enemy" && battle.player.mon.hp <= 0) {
    const backup = battle.party.findIndex(
      (m, i) => i !== battle.activeIndex && m.hp > 0,
    );
    if (backup !== -1 && !battle.rules.forcePlayerLoss) {
      battle.over = false;
      battle.winner = null;
      battle.needsSwitch = true;
      battle.log.push(`${battle.player.mon.nickname} fainted! Choose another monster.`);
    }
  }
}

export function switchActive(battle, partyIndex) {
  const m = battle.party[partyIndex];
  if (!m || m.hp <= 0) return false;
  battle.activeIndex = partyIndex;
  battle.player.mon = m;
  battle.needsSwitch = false;
  battle.log.push(`Go, ${m.nickname}!`);
  return true;
}

export function awardCoins() {
  return 8 + Math.floor(Math.random() * 18);
}

export function awardXpForWin(playerMon) {
  addXp(playerMon, 22 + Math.floor(Math.random() * 16));
}
