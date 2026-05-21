/** Overworld layout: buildings, NPCs, and tall-grass battle patches (island-local coords). */

/** @typedef {{ id: string, name: string, x: number, z: number, w: number, d: number, roof: number, color: number, accent: number, role: string }} WorldBuilding */
/** @typedef {{ id: string, name: string, x: number, z: number, color: number, lines: string[], battle?: { enemyId: string, level: number, name: string } | null }} WorldNpc */
/** @typedef {{ id: string, x: number, z: number, w: number, d: number }} GrassPatch */

/** @type {WorldBuilding[]} */
export const BUILDINGS = [
  {
    id: "center",
    name: "Healing Center",
    x: -6.5,
    z: -1.5,
    w: 2.8,
    d: 2.4,
    roof: 1.1,
    color: 0xe85d7a,
    accent: 0xffb3c6,
    role: "heal",
  },
  {
    id: "shop",
    name: "Supply Shop",
    x: 5.8,
    z: -3.2,
    w: 2.6,
    d: 2.2,
    roof: 0.95,
    color: 0x4a7c59,
    accent: 0x9fd4a8,
    role: "shop",
  },
  {
    id: "lab",
    name: "Research Lab",
    x: -2.8,
    z: 6.2,
    w: 3.0,
    d: 2.6,
    roof: 1.2,
    color: 0x5c6bc0,
    accent: 0xa5b4fc,
    role: "lab",
  },
  {
    id: "gate",
    name: "Arena Gate",
    x: 0.2,
    z: -9.2,
    w: 3.4,
    d: 2.0,
    roof: 0.75,
    color: 0x8d6e63,
    accent: 0xffd54f,
    role: "arena",
  },
];

/** @type {WorldNpc[]} */
export const NPCS = [
  {
    id: "elder",
    name: "Island Elder",
    x: 3.5,
    z: 2.8,
    color: 0xd4a574,
    lines: [
      "Welcome, young trainer. The tall grass hides wild Buker.",
      "Shards sleep in each island's boss. Ten gates, ten lights.",
    ],
  },
  {
    id: "scout",
    name: "Trail Scout",
    x: -4.2,
    z: -5.5,
    color: 0x7eb8da,
    lines: [
      "I mark safe paths in green. Darker patches? That's battle grass.",
      "Press E at doors to enter buildings.",
    ],
  },
  {
    id: "duelist",
    name: "Rival Fan",
    x: 7.2,
    z: 4.5,
    color: 0xc77dff,
    lines: ["Think you're strong? One bout, right here."],
    battle: { enemyId: "bolt", level: 12, name: "Fan's Spark" },
  },
];

/** @type {GrassPatch[]} */
export const GRASS_PATCHES = [
  { id: "grass_nw", x: -3.5, z: 4.0, w: 3.2, d: 2.4 },
  { id: "grass_ne", x: 4.8, z: 5.5, w: 2.8, d: 2.6 },
  { id: "grass_sw", x: -7.0, z: 3.5, w: 2.4, d: 2.2 },
  { id: "grass_e", x: 8.0, z: -0.5, w: 2.6, d: 3.0 },
  { id: "grass_center", x: 1.2, z: -4.5, w: 3.5, d: 2.8 },
];

export const INTERACT_RADIUS = 2.0;
export const GRASS_ENCOUNTER_COOLDOWN_MS = 1500;
export const PLAYER_SPAWN = { x: 0, z: 3.2 };
export const PLAYER_RADIUS = 0.42;
export const NPC_RADIUS = 0.45;

/**
 * Axis-aligned solid rects (in XZ plane) that block player movement.
 * Buildings get a small padding so the player can stand at the door but not pass through walls.
 * @returns {{ x: number, z: number, w: number, d: number }[]}
 */
export function getSolidRects() {
  const pad = 0.15;
  return BUILDINGS.map((b) => ({
    x: b.x,
    z: b.z,
    w: b.w + pad * 2,
    d: b.d + pad * 2,
  }));
}

/**
 * Resolve circle-vs-AABB collision by pushing the player out along the shallowest axis.
 * Returns adjusted position.
 * @param {number} px
 * @param {number} pz
 * @param {number} radius
 */
export function resolveCollisions(px, pz, radius = PLAYER_RADIUS) {
  let x = px;
  let z = pz;

  for (const rect of getSolidRects()) {
    const halfW = rect.w / 2;
    const halfD = rect.d / 2;
    const dx = x - rect.x;
    const dz = z - rect.z;
    const overlapX = halfW + radius - Math.abs(dx);
    const overlapZ = halfD + radius - Math.abs(dz);
    if (overlapX > 0 && overlapZ > 0) {
      if (overlapX < overlapZ) {
        x = rect.x + Math.sign(dx || 1) * (halfW + radius);
      } else {
        z = rect.z + Math.sign(dz || 1) * (halfD + radius);
      }
    }
  }

  for (const npc of NPCS) {
    const dx = x - npc.x;
    const dz = z - npc.z;
    const minDist = radius + NPC_RADIUS;
    const dist = Math.hypot(dx, dz);
    if (dist > 0 && dist < minDist) {
      const push = (minDist - dist) / dist;
      x += dx * push;
      z += dz * push;
    } else if (dist === 0) {
      x += minDist;
    }
  }

  return { x, z };
}

/**
 * @param {number} px
 * @param {number} pz
 * @param {number} x
 * @param {number} z
 */
export function distXZ(px, pz, x, z) {
  return Math.hypot(px - x, pz - z);
}

/**
 * @param {number} px
 * @param {number} pz
 * @param {GrassPatch} patch
 */
export function pointInGrass(px, pz, patch) {
  return (
    Math.abs(px - patch.x) <= patch.w * 0.5 && Math.abs(pz - patch.z) <= patch.d * 0.5
  );
}

/**
 * @param {number} px
 * @param {number} pz
 */
export function grassPatchAt(px, pz) {
  return GRASS_PATCHES.find((g) => pointInGrass(px, pz, g)) ?? null;
}

/**
 * @param {number} px
 * @param {number} pz
 * @returns {{ kind: "building" | "npc", target: WorldBuilding | WorldNpc, dist: number } | null}
 */
export function nearestInteractable(px, pz) {
  let best = null;
  let bestDist = INTERACT_RADIUS;

  for (const b of BUILDINGS) {
    const d = distXZ(px, pz, b.x, b.z);
    if (d < bestDist) {
      bestDist = d;
      best = { kind: /** @type {"building"} */ ("building"), target: b, dist: d };
    }
  }
  for (const n of NPCS) {
    const d = distXZ(px, pz, n.x, n.z);
    if (d < bestDist) {
      bestDist = d;
      best = { kind: /** @type {"npc"} */ ("npc"), target: n, dist: d };
    }
  }
  return best;
}
