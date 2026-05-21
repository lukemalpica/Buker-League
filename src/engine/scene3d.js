import * as THREE from "three";
import {
  BUILDINGS,
  NPCS,
  GRASS_PATCHES,
  PLAYER_SPAWN,
  PLAYER_RADIUS,
  nearestInteractable,
  grassPatchAt,
  resolveCollisions,
} from "../game/world.js";

const ISLAND_PALETTES = [
  [0xff6b35, 0xff9f1c],
  [0x2ec4b6, 0x3498db],
  [0xf9c74f, 0xf8961e],
  [0xe9c46a, 0xd4a373],
  [0x8d99ae, 0x6c757d],
  [0xb388ff, 0x7c4dff],
  [0x52b788, 0x2d6a4f],
  [0xa8dadc, 0x457b9d],
  [0xc77dff, 0x7209b7],
  [0xadb5bd, 0x495057],
];

const MOVE_CODES = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
]);

function isTypingTarget(/** @type {EventTarget | null} */ t) {
  if (!t || !(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return t.isContentEditable;
}

function buildPlayerMesh() {
  const group = new THREE.Group();
  const suit = new THREE.MeshStandardMaterial({
    color: 0x5eb0ff,
    roughness: 0.42,
    metalness: 0.25,
  });
  const trim = new THREE.MeshStandardMaterial({
    color: 0x1a2a44,
    roughness: 0.55,
    metalness: 0.15,
  });
  const skin = new THREE.MeshStandardMaterial({
    color: 0xf2c6a5,
    roughness: 0.6,
    metalness: 0,
  });

  const capR = 0.34;
  const capLen = 0.72;
  const capTotal = 2 * capR + capLen;

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(capR, capLen, 6, 12), suit);
  body.position.y = capTotal / 2;
  group.add(body);

  const belt = new THREE.Mesh(new THREE.TorusGeometry(capR * 0.92, 0.05, 8, 20), trim);
  belt.rotation.x = Math.PI / 2;
  belt.position.y = capR + 0.15;
  group.add(belt);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 14), skin);
  head.position.y = capTotal + 0.12;
  group.add(head);

  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 0.1, 0.22),
    new THREE.MeshStandardMaterial({
      color: 0x0d1b2a,
      roughness: 0.25,
      metalness: 0.5,
    }),
  );
  visor.position.set(0, capTotal + 0.12, 0.18);
  group.add(visor);

  return group;
}

function buildNpcMesh(/** @type {number} */ color) {
  const group = new THREE.Group();
  const cloth = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.1 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xf2c6a5, roughness: 0.65, metalness: 0 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.5, 5, 10), cloth);
  body.position.y = 0.78;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), skin);
  head.position.y = 1.35;
  group.add(head);
  return group;
}

/**
 * @param {import("../game/world.js").WorldBuilding} def
 */
function buildBuilding(def) {
  const group = new THREE.Group();
  group.position.set(def.x, 0, def.z);

  const wallMat = new THREE.MeshStandardMaterial({
    color: def.color,
    roughness: 0.72,
    metalness: 0.08,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: def.accent,
    roughness: 0.5,
    metalness: 0.15,
  });
  const doorMat = new THREE.MeshStandardMaterial({
    color: 0x2a1810,
    roughness: 0.85,
    metalness: 0,
  });

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(def.w, 1.35, def.d),
    wallMat,
  );
  base.position.y = 0.675;
  group.add(base);

  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(def.w + 0.25, def.roof, def.d + 0.25),
    trimMat,
  );
  roof.position.y = 1.35 + def.roof / 2;
  group.add(roof);

  const door = new THREE.Mesh(new THREE.BoxGeometry(0.75, 1.05, 0.12), doorMat);
  door.position.set(0, 0.52, def.d / 2 + 0.06);
  group.add(door);

  const sign = new THREE.Mesh(new THREE.BoxGeometry(def.w * 0.7, 0.18, 0.08), trimMat);
  sign.position.set(0, 1.55, def.d / 2 + 0.12);
  group.add(sign);

  return group;
}

/**
 * @param {import("../game/world.js").GrassPatch} patch
 */
function buildGrassPatch(patch) {
  const group = new THREE.Group();
  group.position.set(patch.x, 0.02, patch.z);

  const floorGrass = new THREE.Mesh(
    new THREE.PlaneGeometry(patch.w, patch.d),
    new THREE.MeshStandardMaterial({
      color: 0x2d6a3f,
      roughness: 0.9,
      metalness: 0,
      emissive: 0x0a2818,
      emissiveIntensity: 0.15,
    }),
  );
  floorGrass.rotation.x = -Math.PI / 2;
  group.add(floorGrass);

  const bladeMat = new THREE.MeshStandardMaterial({
    color: 0x40916c,
    roughness: 0.85,
    metalness: 0,
  });
  const count = Math.floor((patch.w * patch.d) * 2.2);
  for (let i = 0; i < count; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.35 + Math.random() * 0.25, 0.04), bladeMat);
    blade.position.set(
      (Math.random() - 0.5) * patch.w * 0.85,
      0.2,
      (Math.random() - 0.5) * patch.d * 0.85,
    );
    blade.rotation.y = Math.random() * Math.PI;
    blade.userData.blade = true;
    group.add(blade);
  }

  return group;
}

/**
 * @param {HTMLElement} container
 * @param {() => number} getIslandIndex
 * @param {{
 *   onInteract?: (kind: "building" | "npc", id: string) => void,
 *   onGrassEncounter?: (grassId: string) => void,
 *   canExplore?: () => boolean,
 * }} [hooks]
 */
export function createWorldScene(container, getIslandIndex, hooks = {}) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x1a2838, 0.028);

  const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 200);
  camera.position.set(0, 5.2, -4.8);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.tabIndex = 0;
  renderer.domElement.style.outline = "none";

  const clock = new THREE.Clock();
  const keysDown = new Set();
  let movementFrozen = false;
  let grassCooldownUntil = 0;
  let grassStepProgress = 0;
  const STEP_DIST = 0.45;
  const STEP_ENCOUNTER_CHANCE = 0.18;

  const hemi = new THREE.HemisphereLight(0x9fd4ff, 0x2d4a2a, 0.9);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffffff, 0.6);
  dir.position.set(4, 10, 6);
  scene.add(dir);

  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.1, 1),
    new THREE.MeshStandardMaterial({
      color: 0x66aaff,
      emissive: 0x112244,
      roughness: 0.35,
      metalness: 0.45,
      flatShading: true,
    }),
  );
  core.position.y = 1.35;
  scene.add(core);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.4, 0.04, 12, 64),
    new THREE.MeshBasicMaterial({ color: 0x4488cc, transparent: true, opacity: 0.35 }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.15;
  scene.add(ring);

  const floorRadius = 14;
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(floorRadius, 48),
    new THREE.MeshStandardMaterial({
      color: 0x3d5a3a,
      roughness: 0.92,
      metalness: 0.02,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const path = new THREE.Mesh(
    new THREE.RingGeometry(1.8, 3.2, 32),
    new THREE.MeshStandardMaterial({ color: 0xc4b59a, roughness: 0.95, metalness: 0 }),
  );
  path.rotation.x = -Math.PI / 2;
  path.position.y = 0.01;
  scene.add(path);

  const grassGroups = GRASS_PATCHES.map(buildGrassPatch);
  grassGroups.forEach((g) => scene.add(g));

  const buildingGroups = BUILDINGS.map(buildBuilding);
  buildingGroups.forEach((g) => scene.add(g));

  /** @type {{ npc: import("../game/world.js").WorldNpc, mesh: THREE.Group, label: HTMLDivElement }[]} */
  const npcEntries = [];

  const labelLayer = document.createElement("div");
  labelLayer.className = "world-labels";
  container.appendChild(labelLayer);

  for (const npc of NPCS) {
    const mesh = buildNpcMesh(npc.color);
    mesh.position.set(npc.x, 0, npc.z);
    scene.add(mesh);
    const label = document.createElement("div");
    label.className = "world-npc-label";
    label.textContent = npc.name;
    labelLayer.appendChild(label);
    npcEntries.push({ npc, mesh, label });
  }

  const player = buildPlayerMesh();
  player.position.set(PLAYER_SPAWN.x, 0, PLAYER_SPAWN.z);
  scene.add(player);

  const walkRadius = floorRadius - 1.2;
  const moveSpeed = 7.2;
  const orbitBack = 4.35;
  const orbitUp = 5.55;
  const lookHeight = 0.92;
  const lookLead = 0.28;
  const camLerpMove = 0.28;
  const camLerpIdle = 0.14;
  let facing = 0;

  const camSmooth = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const camDesired = new THREE.Vector3();
  const lookTarget = new THREE.Vector3();
  const proj = new THREE.Vector3();

  const starsGeo = new THREE.BufferGeometry();
  const starCount = 900;
  const positions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 80;
    positions[i * 3 + 1] = Math.random() * 40 + 4;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 80;
  }
  starsGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const stars = new THREE.Points(
    starsGeo,
    new THREE.PointsMaterial({ color: 0xaaccff, size: 0.06, transparent: true, opacity: 0.7 }),
  );
  scene.add(stars);

  const hint = document.createElement("div");
  hint.className = "world-move-hint";
  hint.textContent = "WASD move · E interact · tall grass triggers wild battles";
  container.appendChild(hint);

  const prompt = document.createElement("div");
  prompt.className = "world-prompt hidden";
  container.appendChild(prompt);

  function onKeyDown(/** @type {KeyboardEvent} */ e) {
    if (isTypingTarget(e.target)) return;
    if (e.code === "KeyE") {
      if (movementFrozen || !hooks.canExplore?.()) return;
      const near = nearestInteractable(player.position.x, player.position.z);
      if (near) {
        hooks.onInteract?.(near.kind, near.target.id);
        e.preventDefault();
      }
      return;
    }
    if (!MOVE_CODES.has(e.code)) return;
    keysDown.add(e.code);
    e.preventDefault();
  }

  function onKeyUp(/** @type {KeyboardEvent} */ e) {
    keysDown.delete(e.code);
  }

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  function resize() {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    updateLabels();
  }

  function updateLabels() {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    for (const { npc, label } of npcEntries) {
      proj.set(npc.x, 1.65, npc.z);
      proj.project(camera);
      const sx = (proj.x * 0.5 + 0.5) * w;
      const sy = (-proj.y * 0.5 + 0.5) * h;
      label.style.left = `${sx}px`;
      label.style.top = `${sy}px`;
      const behind = proj.z > 1;
      label.style.opacity = behind ? "0" : "0.92";
    }
  }

  container.appendChild(renderer.domElement);
  resize();
  window.addEventListener("resize", resize);

  {
    const px = player.position.x;
    const pz = player.position.z;
    forward.set(Math.sin(facing), 0, Math.cos(facing));
    camDesired.set(px, 0, pz).addScaledVector(forward, -orbitBack);
    camDesired.y = orbitUp;
    camSmooth.copy(camDesired);
    camera.position.copy(camSmooth);
    lookTarget.set(px, lookHeight, pz).addScaledVector(forward, lookLead);
    camera.lookAt(lookTarget);
  }

  let t = 0;
  function tick() {
    if (document.hidden) {
      clock.getDelta();
      renderer.render(scene, camera);
      return;
    }
    const dt = Math.min(clock.getDelta(), 0.05);
    t += dt;

    let mx = 0;
    let mz = 0;
    if (!movementFrozen) {
      if (keysDown.has("KeyW") || keysDown.has("ArrowUp")) mz -= 1;
      if (keysDown.has("KeyS") || keysDown.has("ArrowDown")) mz += 1;
      if (keysDown.has("KeyA") || keysDown.has("ArrowLeft")) mx -= 1;
      if (keysDown.has("KeyD") || keysDown.has("ArrowRight")) mx += 1;
    }

    let moved = 0;
    if (mx !== 0 || mz !== 0) {
      const len = Math.hypot(mx, mz);
      mx /= len;
      mz /= len;
      const stepX = mx * moveSpeed * dt;
      const stepZ = mz * moveSpeed * dt;
      const prevX = player.position.x;
      const prevZ = player.position.z;
      player.position.x += stepX;
      player.position.z += stepZ;
      const resolved = resolveCollisions(
        player.position.x,
        player.position.z,
        PLAYER_RADIUS,
      );
      player.position.x = resolved.x;
      player.position.z = resolved.z;
      moved = Math.hypot(player.position.x - prevX, player.position.z - prevZ);
      facing = Math.atan2(mx, mz);
      player.rotation.y = facing;
    }

    {
      const px0 = player.position.x;
      const pz0 = player.position.z;
      const r0 = Math.hypot(px0, pz0);
      if (r0 > walkRadius) {
        const k = walkRadius / r0;
        player.position.x = px0 * k;
        player.position.z = pz0 * k;
      }
    }

    const exploring = !!hooks.canExplore?.() && !movementFrozen;
    const px = player.position.x;
    const pz = player.position.z;
    const patch = grassPatchAt(px, pz);

    if (exploring && patch) {
      prompt.classList.remove("hidden");
      prompt.textContent = "Tall grass — wild Buker may appear!";
      const now = performance.now();
      grassStepProgress += moved;
      if (grassStepProgress >= STEP_DIST && now >= grassCooldownUntil) {
        grassStepProgress = 0;
        if (Math.random() < STEP_ENCOUNTER_CHANCE && hooks.onGrassEncounter) {
          grassCooldownUntil = now + 6000;
          hooks.onGrassEncounter(patch.id);
        }
      }
    } else {
      grassStepProgress = 0;
      const near = exploring ? nearestInteractable(px, pz) : null;
      if (near) {
        prompt.classList.remove("hidden");
        const name = near.target.name;
        if (near.kind === "building") {
          prompt.textContent = `Press E — Enter ${name}`;
        } else {
          prompt.textContent = `Press E — Talk to ${name}`;
        }
      } else {
        prompt.classList.add("hidden");
      }
    }

    for (const g of grassGroups) {
      g.children.forEach((ch) => {
        if (ch.userData.blade) {
          ch.rotation.z = Math.sin(t * 3 + ch.position.x * 2) * 0.08;
        }
      });
    }

    for (const { mesh } of npcEntries) {
      mesh.rotation.y = Math.sin(t * 0.5 + mesh.position.x) * 0.12;
    }

    const idx = typeof getIslandIndex === "function" ? getIslandIndex() : 0;
    const [a, b] = ISLAND_PALETTES[idx] ?? ISLAND_PALETTES[0];
    const mix = (Math.sin(t * 0.4) + 1) * 0.5;
    const c = new THREE.Color(a).lerp(new THREE.Color(b), mix);
    core.material.color.copy(c);
    core.material.emissive.copy(c).multiplyScalar(0.12);
    core.rotation.y += 0.008;
    core.rotation.x += 0.003;
    ring.rotation.z += 0.004;

    const moving = mx !== 0 || mz !== 0;
    const camLerp = moving ? camLerpMove : camLerpIdle;

    forward.set(Math.sin(facing), 0, Math.cos(facing));
    camDesired.set(px, 0, pz);
    camDesired.addScaledVector(forward, -orbitBack);
    camDesired.y = orbitUp;

    camSmooth.lerp(camDesired, camLerp);
    camera.position.copy(camSmooth);

    lookTarget.set(px, lookHeight, pz);
    lookTarget.addScaledVector(forward, lookLead);
    camera.lookAt(lookTarget);

    updateLabels();
    renderer.render(scene, camera);
  }

  renderer.setAnimationLoop(tick);

  return {
    setMovementFrozen(frozen) {
      movementFrozen = frozen;
      if (frozen) keysDown.clear();
    },
    bumpGrassCooldown(ms = 6000) {
      grassCooldownUntil = performance.now() + ms;
      grassStepProgress = 0;
    },
    /** Move player back to a safe spawn (e.g. after blackout or island travel). */
    respawn(x = PLAYER_SPAWN.x, z = PLAYER_SPAWN.z) {
      player.position.set(x, 0, z);
      facing = 0;
      player.rotation.y = facing;
      grassCooldownUntil = performance.now() + 6000;
      grassStepProgress = 0;
      camSmooth.set(x, orbitUp, z - orbitBack);
      camera.position.copy(camSmooth);
    },
    /** Move player to stand just in front of a named building's door. */
    moveToBuildingDoor(buildingId) {
      const b = BUILDINGS.find((x) => x.id === buildingId);
      if (!b) return;
      const doorZ = b.z + b.d / 2 + 1.0;
      this.respawn(b.x, doorZ);
    },
    dispose() {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("resize", resize);
      renderer.setAnimationLoop(null);
      renderer.dispose();
      if (hint.parentNode === container) container.removeChild(hint);
      if (prompt.parentNode === container) container.removeChild(prompt);
      if (labelLayer.parentNode === container) container.removeChild(labelLayer);
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    },
  };
}
