import { createWorldScene } from "./engine/scene3d.js";
import {
  defaultState,
  loadState,
  saveState,
  wipeSave,
  makeMonster,
  isValidStarter,
  grantShard,
  tryEvolve,
  templateForOwned,
  applyBlackout,
  isPartyWiped,
  healParty,
  addCaughtMonster,
  PARTY_LIMIT,
} from "./game/state.js";
import { ISLANDS, MONSTERS, getBossMonsterIdForIsland, TIMOTHY_TEAM } from "./game/data.js";
import { BUILDINGS, NPCS } from "./game/world.js";
import {
  createBattle,
  battleStep,
  switchActive,
  awardCoins,
  awardXpForWin,
  tryRun,
  tryCapture,
  captureChance,
} from "./game/battle.js";
import { monsterSprite } from "./game/sprites.js";

const panel = document.getElementById("panel");
const hudName = document.getElementById("hud-name");
const hudCoins = document.getElementById("hud-coins");
const hudShards = document.getElementById("hud-shards");
const canvasWrap = document.getElementById("canvas-wrap");

/** @type {ReturnType<typeof defaultState>} */
let state = loadState() ?? defaultState();

const islandVisualIndex = () => state.islandIndex;

/** @type {ReturnType<typeof createWorldScene>} */
let worldScene = createWorldScene(canvasWrap, islandVisualIndex, {
  canExplore: () => state.phase === "hub" && !!state.playerName && !state.party?.[0]?.isEgg,
  onInteract(kind, id) {
    if (kind === "building") openBuilding(id);
    else openNpc(id);
  },
  onGrassEncounter() {
    startWildFromWorld();
  },
});

function setWorldFrozen(frozen) {
  worldScene?.setMovementFrozen(frozen);
}

function canExploreWorld() {
  return state.phase === "hub" && !!state.playerName && !state.party?.[0]?.isEgg;
}

function syncHud() {
  hudName.textContent = state.playerName ? `Trainer: ${state.playerName}` : "BUKER";
  hudCoins.textContent = `Coins: ${state.coins} · Capsules: ${state.capsules ?? 0}`;
  hudShards.textContent = `Shards: ${state.shards.length} / ${ISLANDS.length}`;
}

function persist() {
  saveState(state);
  syncHud();
}

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return /** @type {HTMLElement} */ (t.content.firstElementChild);
}

function render(html) {
  panel.innerHTML = "";
  const node = el(`<div class="screen">${html}</div>`);
  panel.appendChild(node);
}

function pct(x, max) {
  return `${Math.max(0, Math.round((x / max) * 100))}%`;
}

function showRegister() {
  render(`
    <h1>BUKER</h1>
    <p class="muted">Monster adventure: menus and battles meet a Three.js horizon. Saves in your browser (localStorage).</p>
    <label class="muted" for="name">Trainer name</label>
    <div class="actions" style="margin-top:0.5rem">
      <input id="name" maxlength="24" style="padding:0.5rem;border-radius:8px;border:1px solid #3a5a80;background:#0e1624;color:#e8ecf1;width:100%" placeholder="Your name" />
      <button type="button" id="go">Continue</button>
      <button type="button" id="wipe" style="border-color:#664444;background:#2a1515">Erase local save</button>
    </div>
  `);
  const input = /** @type {HTMLInputElement} */ (document.getElementById("name"));
  document.getElementById("go")?.addEventListener("click", () => {
    const name = (input?.value || "").trim();
    if (name.length < 2) {
      alert("Please enter at least 2 characters.");
      return;
    }
    state.playerName = name;
    state.phase = "starter";
    persist();
    showStarter();
  });
  document.getElementById("wipe")?.addEventListener("click", () => {
    if (confirm("Delete all local progress?")) {
      wipeSave();
      state = defaultState();
      persist();
      showRegister();
    }
  });
  syncHud();
}

function showStarter() {
  render(`
    <h1>Choose your starter</h1>
    <p class="muted">Egg first, then hatch — Crimson (Fire), Tide (Water), or Bolt (Lightning).</p>
    <div class="actions">
      <button type="button" data-id="crimson">Crimson — Fire</button>
      <button type="button" data-id="tide">Tide — Water</button>
      <button type="button" data-id="bolt">Bolt — Lightning</button>
    </div>
  `);
  document.querySelectorAll("#panel button[data-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      if (!id || !isValidStarter(id)) return;
      const egg = makeMonster(id, { isEgg: true, level: 5 });
      state.party = [egg];
      state.phase = "egg";
      state.eggRubs = 0;
      persist();
      showEgg();
    });
  });
  syncHud();
}

function showEgg() {
  const m = state.party[0];
  render(`
    <h1>The egg stirs</h1>
    <p>Warm it with care. After three focused rubs, it hatches.</p>
    <p class="muted">Rubs: ${state.eggRubs ?? 0} / 3</p>
    <div class="actions">
      <button type="button" id="rub">Rub the egg</button>
    </div>
  `);
  document.getElementById("rub")?.addEventListener("click", () => {
    state.eggRubs = (state.eggRubs || 0) + 1;
    if (state.eggRubs >= 3) {
      m.isEgg = false;
      state.phase = "hub";
      persist();
      timothyIntroFlow();
      return;
    }
    persist();
    showEgg();
  });
  syncHud();
}

function timothyIntroFlow() {
  if (state.timothyIntroDone) {
    showHub();
    return;
  }
  render(`
    <h1>Timothy appears</h1>
    <p>Your rival blocks the way. "Prove something — if you can."</p>
    <p class="muted">First meeting: his aura ends the fight. You will lose, then chase shards across ten islands.</p>
    <div class="actions">
      <button type="button" id="fight">Battle Timothy</button>
    </div>
  `);
  document.getElementById("fight")?.addEventListener("click", () => {
    openBattle({
      mode: "timothy_intro",
      enemyId: "crimson",
      enemyLevel: 22,
      enemyName: "Timothy's Crimson",
      forceLoss: true,
    });
  });
}

function startWildFromWorld() {
  if (!canExploreWorld()) return;
  const island = ISLANDS[state.islandIndex];
  const pool = island.wild;
  const enemyId = pool[Math.floor(Math.random() * pool.length)];
  const lvl = 6 + state.islandIndex + Math.floor(Math.random() * 3);
  openBattle({
    mode: "wild",
    enemyId,
    enemyLevel: lvl,
    enemyName: `Wild ${MONSTERS[enemyId].name}`,
    forceLoss: false,
  });
}

function openBuilding(/** @type {string} */ id) {
  const b = BUILDINGS.find((x) => x.id === id);
  if (!b) return;
  setWorldFrozen(true);

  if (b.role === "heal") {
    state.party.forEach((m) => {
      if (!m.isEgg) m.hp = m.maxHp;
    });
    persist();
    render(`
      <h1>${b.name}</h1>
      <p>Warm light washes over your party. Everyone is fully restored.</p>
      <div class="actions"><button type="button" id="leave">Leave building</button></div>
    `);
    document.getElementById("leave")?.addEventListener("click", () => {
      setWorldFrozen(false);
      showHub();
    });
    return;
  }

  if (b.role === "shop") {
    render(`
      <h1>${b.name}</h1>
      <p class="muted">Coins: ${state.coins} · Capsules: ${state.capsules}</p>
      <div class="actions">
        <button type="button" id="buy-tonic" ${state.coins < 80 ? "disabled" : ""}>Vitality Tonic (80 coins) — fully heal the party</button>
        <button type="button" id="buy-capsule" ${state.coins < 50 ? "disabled" : ""}>Capture Capsule (50 coins) — catch wild monsters in battle</button>
        <button type="button" id="buy-energy" ${state.coins < 30 ? "disabled" : ""}>Energy Tonic (30 coins) — +15% HP to lead</button>
        <button type="button" id="leave">Leave</button>
      </div>
    `);
    document.getElementById("buy-tonic")?.addEventListener("click", () => {
      if (state.coins < 80) return;
      state.coins -= 80;
      healParty(state);
      persist();
      openBuilding(id);
    });
    document.getElementById("buy-capsule")?.addEventListener("click", () => {
      if (state.coins < 50) return;
      state.coins -= 50;
      state.capsules = (state.capsules || 0) + 1;
      persist();
      openBuilding(id);
    });
    document.getElementById("buy-energy")?.addEventListener("click", () => {
      if (state.coins < 30) return;
      const lead = state.party.find((m) => !m.isEgg);
      if (!lead) return;
      state.coins -= 30;
      lead.hp = Math.min(lead.maxHp, lead.hp + Math.round(lead.maxHp * 0.15));
      persist();
      openBuilding(id);
    });
    document.getElementById("leave")?.addEventListener("click", () => {
      setWorldFrozen(false);
      showHub();
    });
    return;
  }

  if (b.role === "lab") {
    showParty(() => {
      setWorldFrozen(false);
      showHub();
    });
    return;
  }

  if (b.role === "arena") {
    if (!state.arenaUnlocked) {
      render(`
        <h1>${b.name}</h1>
        <p>The gate is sealed until you hold all ten island shards.</p>
        <div class="actions"><button type="button" id="leave">Step outside</button></div>
      `);
      document.getElementById("leave")?.addEventListener("click", () => {
        setWorldFrozen(false);
        showHub();
      });
      return;
    }
    setWorldFrozen(false);
    openBattle({
      mode: "timothy_final",
      enemyId: TIMOTHY_TEAM[4],
      enemyLevel: 36,
      enemyName: `Timothy's ace ${MONSTERS[TIMOTHY_TEAM[4]].name}`,
      forceLoss: false,
    });
  }
}

function openNpc(/** @type {string} */ id) {
  const npc = NPCS.find((n) => n.id === id);
  if (!npc) return;
  setWorldFrozen(true);
  const beaten = state.defeatedTrainers?.includes(npc.id);
  const lines = (
    beaten && npc.battle
      ? [...npc.lines, "(You've already proven yourself. Well fought.)"]
      : npc.lines
  )
    .map((l) => `<p>${l}</p>`)
    .join("");
  const battleBtn = npc.battle && !beaten
    ? `<button type="button" id="npc-fight">Accept battle</button>`
    : "";
  render(`
    <h1>${npc.name}</h1>
    ${lines}
    <div class="actions">
      ${battleBtn}
      <button type="button" id="leave">Goodbye</button>
    </div>
  `);
  document.getElementById("npc-fight")?.addEventListener("click", () => {
    if (!npc.battle || beaten) return;
    openBattle({
      mode: "trainer",
      trainerId: npc.id,
      enemyId: npc.battle.enemyId,
      enemyLevel: npc.battle.level + state.islandIndex,
      enemyName: npc.battle.name,
      forceLoss: false,
    });
  });
  document.getElementById("leave")?.addEventListener("click", () => {
    setWorldFrozen(false);
    showHub();
  });
}

function showHub() {
  setWorldFrozen(false);
  const island = ISLANDS[state.islandIndex];
  const shardHere = state.shards.includes(island.id);
  const canTravel = shardHere;
  const travelLabel = canTravel
    ? "Travel to next island"
    : `Travel locked — defeat the ${island.name} Boss first`;
  render(`
    <h1>Island hub</h1>
    <p>Current region: <strong>${island.name}</strong> — ${island.element} attunement.</p>
    <p class="muted">Walk the 3D island: enter buildings (E), talk to NPCs, or step in tall grass for wild fights. Shards: ${state.shards.length}/${ISLANDS.length}.</p>
    ${state.gameComplete ? `<p><strong>Story complete.</strong> You may still explore.</p>` : ""}
    <div class="actions">
      <button type="button" id="wild">Battle wild monsters</button>
      <button type="button" id="boss" ${shardHere ? "disabled" : ""}>Challenge island boss ${shardHere ? "(shard earned)" : ""}</button>
      <button type="button" id="party">View party & evolve info</button>
      <button type="button" id="eggmenu" ${!state.inventoryEggs?.length ? "disabled" : ""}>Hatch legendary egg</button>
      <button type="button" id="timothy">${timothyButtonLabel()}</button>
      <button type="button" id="arena" ${state.arenaUnlocked ? "" : "disabled"}>Arena — Timothy finale ${state.arenaUnlocked ? "" : "(need all shards)"}</button>
      <button type="button" id="travel" ${canTravel ? "" : "disabled"}>${travelLabel}</button>
      <button type="button" id="save">Save (auto on most actions)</button>
    </div>
  `);

  document.getElementById("wild")?.addEventListener("click", () => {
    const pool = island.wild;
    const enemyId = pool[Math.floor(Math.random() * pool.length)];
    const lvl = 6 + state.islandIndex + Math.floor(Math.random() * 3);
    openBattle({
      mode: "wild",
      enemyId,
      enemyLevel: lvl,
      enemyName: `Wild ${MONSTERS[enemyId].name}`,
      forceLoss: false,
    });
  });

  document.getElementById("boss")?.addEventListener("click", () => {
    if (state.shards.includes(island.id)) return;
    openBattle({
      mode: "boss",
      enemyId: getBossMonsterIdForIsland(state.islandIndex),
      enemyLevel: 10 + state.islandIndex * 3,
      enemyName: `${island.name} Boss`,
      forceLoss: false,
    });
  });

  document.getElementById("party")?.addEventListener("click", showParty);

  document.getElementById("eggmenu")?.addEventListener("click", showLegendaryEgg);

  document.getElementById("timothy")?.addEventListener("click", () => {
    const label = timothyButtonLabel();
    if (label.includes("rematch")) {
      openBattle({
        mode: "timothy_mid",
        enemyId: TIMOTHY_TEAM[2],
        enemyLevel: 26,
        enemyName: `Timothy's ${MONSTERS[TIMOTHY_TEAM[2]].name}`,
        forceLoss: false,
      });
      return;
    }
    if (!state.timothyIntroDone) {
      timothyIntroFlow();
      return;
    }
    alert("Timothy waits at the Arena when you hold all ten shards.");
  });

  document.getElementById("arena")?.addEventListener("click", () => {
    if (!state.arenaUnlocked) return;
    const bossMon = TIMOTHY_TEAM[4];
    openBattle({
      mode: "timothy_final",
      enemyId: bossMon,
      enemyLevel: 36,
      enemyName: `Timothy's ace ${MONSTERS[bossMon].name}`,
      forceLoss: false,
    });
  });

  document.getElementById("travel")?.addEventListener("click", () => {
    state.islandIndex = (state.islandIndex + 1) % ISLANDS.length;
    persist();
    worldScene?.respawn();
    showHub();
  });

  document.getElementById("save")?.addEventListener("click", () => {
    persist();
    alert("Saved.");
  });

  syncHud();
}

function timothyButtonLabel() {
  if (!state.timothyIntroDone) return "Timothy (prologue)";
  if (state.islandIndex >= 4 && !state.timothyMidDone) return "Timothy — rematch (~5th island era)";
  return "Timothy (story)";
}

function showParty(onBack = showHub) {
  const rows = state.party
    .map((m) => {
      const d = templateForOwned(m);
      const evo =
        d.evolveLevel && d.evolvesTo
          ? `Evolves at Lv.${d.evolveLevel} → ${MONSTERS[d.evolvesTo].name}`
          : "Final form";
      const sprite = m.isEgg
        ? `<div class="party-sprite" style="font-size:1.8rem">🥚</div>`
        : `<div class="party-sprite">${monsterSprite(m.templateId, 56)}</div>`;
      return `<li class="party-row">${sprite}<div><strong>${m.nickname}</strong> — ${d.element} Lv.${m.level}<br><span class="muted">HP ${m.hp}/${m.maxHp} · Str ${m.strength} · ${evo}</span></div></li>`;
    })
    .join("");
  const storage = state.storage?.length
    ? `<p class="muted">Storage: ${state.storage.length} caught monster${state.storage.length === 1 ? "" : "s"} (party cap ${PARTY_LIMIT}).</p>`
    : "";
  render(`
    <h1>Party</h1>
    <ul class="party-list">${rows}</ul>
    ${storage}
    <div class="actions"><button type="button" id="back">Back</button></div>
  `);
  document.getElementById("back")?.addEventListener("click", onBack);
}

function showLegendaryEgg() {
  const hasLeg = state.inventoryEggs?.some((e) => e.kind === "legendary");
  if (!hasLeg) {
    showHub();
    return;
  }
  render(`
    <h1>Legendary egg</h1>
    <p>All ten shards resonate. The shell cracks with starlight.</p>
    <div class="actions">
      <button type="button" id="hatch">Hatch Aureon</button>
      <button type="button" id="back">Not yet</button>
    </div>
  `);
  document.getElementById("hatch")?.addEventListener("click", () => {
    state.inventoryEggs = state.inventoryEggs.filter((e) => e.kind !== "legendary");
    state.party.push(makeMonster("aureon", { level: 30 }));
    state.legendaryHatched = true;
    persist();
    render(`
      <h1>Aureon emerges</h1>
      <p>The strongest legend joins your party — use it wisely in the Arena.</p>
      <div class="actions"><button type="button" id="back">Back to hub</button></div>
    `);
    document.getElementById("back")?.addEventListener("click", showHub);
  });
  document.getElementById("back")?.addEventListener("click", showHub);
}

/**
 * @param {{ mode: string, enemyId: string, enemyLevel: number, enemyName: string, forceLoss: boolean, trainerId?: string }} cfg
 */
function openBattle(cfg) {
  setWorldFrozen(true);
  worldScene?.bumpGrassCooldown(6000);
  let rewardsApplied = false;

  const firstAlive = state.party.findIndex((m) => !m.isEgg && m.hp > 0);
  if (firstAlive < 0 && cfg.mode !== "timothy_intro") {
    setWorldFrozen(false);
    render(`
      <h1>Out cold</h1>
      <p>Your whole team needs rest. Find a Healing Center on the island first.</p>
      <div class="actions"><button type="button" id="ok">Okay</button></div>
    `);
    document.getElementById("ok")?.addEventListener("click", showHub);
    return;
  }

  const battle = createBattle({
    playerName: state.playerName,
    playerParty: state.party,
    activeIndex: Math.max(0, firstAlive),
    enemyTemplateId: cfg.enemyId,
    enemyLevel: cfg.enemyLevel,
    enemyName: cfg.enemyName,
    rules: { forcePlayerLoss: cfg.forceLoss },
  });

  if (!battle.player.mon) {
    setWorldFrozen(false);
    alert("No able monsters! Visit the Healing Center.");
    showHub();
    return;
  }

  const canRun = cfg.mode === "wild";

  function paint() {
    const p = battle.player.mon;
    const e = battle.enemy.mon;
    const defP = p ? templateForOwned(p) : null;
    const defE = templateForOwned(e);

    const moves =
      defP && !battle.needsSwitch
        ? defP.moves
            .map(
              (mv, i) =>
                `<button type="button" data-mv="${i}" ${battle.over ? "disabled" : ""}>${mv.name} (${mv.element}) — ${mv.power}</button>`,
            )
            .join("")
        : "";

    const switches = battle.party
      .map(
        (m, i) =>
          `<button type="button" data-sw="${i}" ${m.hp <= 0 || (i === battle.activeIndex && !battle.needsSwitch) ? "disabled" : ""}>${m.nickname} Lv.${m.level} — ${m.hp}/${m.maxHp} HP</button>`,
      )
      .join("");

    const canCatch = cfg.mode === "wild" && !battle.needsSwitch && !battle.over;
    const runBtn = canRun && !battle.needsSwitch && !battle.over
      ? `<button type="button" id="run">Run away</button>`
      : "";
    const catchBtn = canCatch
      ? `<button type="button" id="catch" ${state.capsules > 0 ? "" : "disabled"}>Throw Capsule (${state.capsules} left, ~${Math.round(captureChance(battle) * 100)}% catch)</button>`
      : "";

    render(`
      <h1>Battle</h1>
      <div class="battle-row">
        <div class="battle-sprite enemy">${monsterSprite(e.templateId, 88)}</div>
        <div class="battle-info">
          <p><strong>${e.nickname}</strong> Lv.${e.level} — ${defE.element}</p>
          <div class="battle-bar enemy"><div style="width:${pct(e.hp, e.maxHp)}"></div></div>
        </div>
      </div>
      <div class="battle-row">
        <div class="battle-sprite player">${p ? monsterSprite(p.templateId, 88) : ""}</div>
        <div class="battle-info">
          <p><strong>${p?.nickname ?? ""}</strong> Lv.${p?.level ?? ""} — ${defP?.element ?? ""}</p>
          <div class="battle-bar"><div style="width:${pct(p?.hp ?? 0, p?.maxHp ?? 1)}"></div></div>
        </div>
      </div>
      <div class="log">${battle.log.slice(-14).join("\n")}</div>
      <div class="actions">
        ${battle.needsSwitch ? `<p class="muted">Choose your next fighter:</p>${switches}` : ""}
        ${!battle.needsSwitch && !battle.over ? `<p class="muted">Moves</p>${moves}<p class="muted">Switch (enemy strikes after you swap)</p>${switches}${catchBtn}${runBtn}` : ""}
        ${battle.over ? `<button type="button" id="done">Continue</button>` : ""}
      </div>
    `);

    if (battle.over) {
      document.getElementById("done")?.addEventListener("click", () => finishBattle());
      return;
    }

    document.querySelectorAll("#panel button[data-mv]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = Number(btn.getAttribute("data-mv"));
        battleStep(battle, i);
        afterStep();
      });
    });

    document.querySelectorAll("#panel button[data-sw]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = Number(btn.getAttribute("data-sw"));
        if (battle.needsSwitch) {
          switchActive(battle, i);
          paint();
          return;
        }
        if (battle.over) return;
        switchActive(battle, i);
        const def = templateForOwned(battle.player.mon);
        battleStep(battle, Math.floor(Math.random() * def.moves.length));
        afterStep();
      });
    });

    document.getElementById("run")?.addEventListener("click", () => {
      tryRun(battle);
      afterStep();
    });

    document.getElementById("catch")?.addEventListener("click", () => {
      if (!state.capsules || state.capsules <= 0) return;
      state.capsules -= 1;
      const result = tryCapture(battle);
      if (result.caught && result.captured) {
        const dest = addCaughtMonster(state, result.captured);
        if (dest === "storage") {
          battle.log.push(`Party full — sent to storage (${state.storage.length}).`);
        } else {
          battle.log.push("Added to your party!");
        }
      }
      afterStep();
    });
  }

  function afterStep() {
    if (cfg.mode === "timothy_intro" && battle.winner === "player") {
      battle.player.mon.hp = 0;
      battle.enemy.mon.hp = Math.max(1, battle.enemy.mon.hp);
      battle.over = true;
      battle.winner = "enemy";
      battle.log.push("Timothy's legend aura shrugs off your last hope…");
    }
    if (battle.winner === "player" && !rewardsApplied) {
      rewardsApplied = true;
      applyWinRewards();
    } else if (battle.winner === "captured" && !rewardsApplied) {
      rewardsApplied = true;
      applyCaptureRewards();
    } else if (battle.over && battle.winner === "enemy" && !rewardsApplied) {
      rewardsApplied = true;
      applyLoss();
    }
    paint();
  }

  function applyCaptureRewards() {
    state.coins += Math.floor(awardCoins() * 0.6);
    if (battle.player.mon) addXpForCapture(battle.player.mon);
  }

  function addXpForCapture(mon) {
    awardXpForWin(mon);
    tryEvolve(mon);
  }

  function applyWinRewards() {
    if (cfg.mode === "wild") {
      state.coins += awardCoins();
      if (battle.player.mon) awardXpForWin(battle.player.mon);
      tryEvolve(battle.player.mon);
    }
    if (cfg.mode === "trainer") {
      state.coins += 15 + awardCoins();
      if (cfg.trainerId && !state.defeatedTrainers.includes(cfg.trainerId)) {
        state.defeatedTrainers.push(cfg.trainerId);
      }
      if (battle.player.mon) awardXpForWin(battle.player.mon);
      tryEvolve(battle.player.mon);
    }
    if (cfg.mode === "boss") {
      const island = ISLANDS[state.islandIndex];
      grantShard(state, island.id);
      state.coins += 25 + awardCoins();
      if (battle.player.mon) awardXpForWin(battle.player.mon);
      tryEvolve(battle.player.mon);
    }
    if (cfg.mode === "timothy_mid") {
      state.timothyMidDone = true;
      state.coins += awardCoins() + 10;
      if (battle.player.mon) awardXpForWin(battle.player.mon);
      tryEvolve(battle.player.mon);
    }
    if (cfg.mode === "timothy_final") {
      state.gameComplete = true;
      state.coins += 100;
      if (battle.player.mon) awardXpForWin(battle.player.mon);
    }
  }

  function applyLoss() {
    if (cfg.mode === "timothy_intro") {
      state.timothyIntroDone = true;
    }
  }

  function finishBattle() {
    persist();
    if (cfg.mode === "timothy_intro") {
      render(`
        <h1>Blackout</h1>
        <p>You wake on the shore. Ten islands shimmer on the horizon — each boss holds a shard.</p>
        <div class="actions"><button type="button" id="ok">Continue</button></div>
      `);
      document.getElementById("ok")?.addEventListener("click", () => {
        setWorldFrozen(false);
        worldScene?.respawn();
        showHub();
      });
      return;
    }

    if (battle.winner === "captured") {
      setWorldFrozen(false);
      showHub();
      return;
    }

    if (battle.winner === "enemy" && isPartyWiped(state)) {
      const lostCoins = Math.floor((state.coins || 0) / 2);
      applyBlackout(state);
      persist();
      render(`
        <h1>You blacked out…</h1>
        <p>Kind hands carried you to the Healing Center. Your team is restored, but ${lostCoins} coins slipped from your pouch.</p>
        <div class="actions"><button type="button" id="ok">Back to the world</button></div>
      `);
      document.getElementById("ok")?.addEventListener("click", () => {
        setWorldFrozen(false);
        worldScene?.moveToBuildingDoor("center");
        showHub();
      });
      return;
    }

    setWorldFrozen(false);
    showHub();
  }

  paint();
}

function route() {
  if (state.playerName && state.party?.[0] && !state.party[0].isEgg && state.phase === "egg") {
    state.phase = "hub";
    persist();
  }
  setWorldFrozen(state.phase !== "hub");
  syncHud();
  if (!state.playerName) {
    showRegister();
    return;
  }
  if (state.phase === "starter") {
    showStarter();
    return;
  }
  if (state.phase === "egg") {
    showEgg();
    return;
  }
  showHub();
}

route();
