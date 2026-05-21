import * as THREE from "three";

/**
 * Deterministic pseudo-random generator so each island's decoration layout
 * is stable between renders but distinct per island index.
 */
function rng(seed) {
  let s = seed | 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 0) % 100000) / 100000;
  };
}

/** Distance from the spawn-circle origin to avoid placing decor on the player. */
const KEEP_OUT_R = 2.8;
/** Outer ring where decor can live. */
const FAR_R = 12.5;

/**
 * Build a non-colliding scatter of small props for an island.
 * Each island gets a different element-themed prop, ground tint, and skybox color.
 * @param {number} islandIndex
 * @param {{ x: number, z: number }[]} avoid axis-aligned points to avoid (buildings, NPCs)
 */
export function createIslandDecor(islandIndex, avoid = []) {
  const group = new THREE.Group();
  const rand = rng(islandIndex * 9173 + 31);

  const presets = [
    { ground: 0x3d3024, sky: 0x301810, accent: 0xff6b35, prop: "lava" },
    { ground: 0x254a5a, sky: 0x0e2a3a, accent: 0x3498db, prop: "puddle" },
    { ground: 0x44443a, sky: 0x2a2a18, accent: 0xf9c74f, prop: "pylon" },
    { ground: 0x6b5a3a, sky: 0x3a2a18, accent: 0xd4a373, prop: "cactus" },
    { ground: 0x484848, sky: 0x1a1a20, accent: 0x6c757d, prop: "stone" },
    { ground: 0x2a2440, sky: 0x100820, accent: 0xb388ff, prop: "crystal" },
    { ground: 0x2d4a2e, sky: 0x182a18, accent: 0x52b788, prop: "shroom" },
    { ground: 0x556a8a, sky: 0x2a3a55, accent: 0xa8dadc, prop: "cloud" },
    { ground: 0x4a2a55, sky: 0x1a0a25, accent: 0xc77dff, prop: "rune" },
    { ground: 0x55585a, sky: 0x2a2c30, accent: 0xb0b6bd, prop: "gear" },
  ];
  const preset = presets[islandIndex % presets.length];

  const propCount = 22;
  let attempts = 0;
  let placed = 0;
  while (placed < propCount && attempts < propCount * 6) {
    attempts++;
    const angle = rand() * Math.PI * 2;
    const radius = KEEP_OUT_R + rand() * (FAR_R - KEEP_OUT_R);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;

    const tooClose = avoid.some((p) => Math.hypot(p.x - x, p.z - z) < 1.6);
    if (tooClose) continue;

    const mesh = buildProp(preset.prop, preset.accent, rand);
    if (!mesh) continue;
    mesh.position.set(x, 0, z);
    mesh.rotation.y = rand() * Math.PI * 2;
    group.add(mesh);
    placed++;
  }

  return { group, preset };
}

/**
 * @param {string} kind
 * @param {number} accent
 * @param {() => number} rand
 */
function buildProp(kind, accent, rand) {
  switch (kind) {
    case "lava": {
      const g = new THREE.Group();
      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(0.7 + rand() * 0.5, 18),
        new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.85 }),
      );
      disc.rotation.x = -Math.PI / 2;
      disc.position.y = 0.02;
      g.add(disc);
      const glow = new THREE.PointLight(accent, 0.6, 4);
      glow.position.y = 0.4;
      g.add(glow);
      return g;
    }
    case "puddle": {
      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(0.6 + rand() * 0.6, 18),
        new THREE.MeshStandardMaterial({
          color: accent,
          roughness: 0.25,
          metalness: 0.7,
          transparent: true,
          opacity: 0.85,
        }),
      );
      disc.rotation.x = -Math.PI / 2;
      disc.position.y = 0.02;
      return disc;
    }
    case "pylon": {
      const g = new THREE.Group();
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.12, 1.4, 8),
        new THREE.MeshStandardMaterial({ color: 0x8a8a8a, roughness: 0.6, metalness: 0.5 }),
      );
      pole.position.y = 0.7;
      g.add(pole);
      const bulb = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.18, 0),
        new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 0.6 }),
      );
      bulb.position.y = 1.5;
      g.add(bulb);
      return g;
    }
    case "cactus": {
      const g = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color: 0x4a7c3a, roughness: 0.7 });
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 1.1, 8), mat);
      trunk.position.y = 0.55;
      g.add(trunk);
      if (rand() > 0.4) {
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.45, 8), mat);
        arm.position.set(0.22, 0.78, 0);
        arm.rotation.z = Math.PI / 3;
        g.add(arm);
      }
      return g;
    }
    case "stone": {
      const mat = new THREE.MeshStandardMaterial({ color: 0x6e6e74, roughness: 0.9, flatShading: true });
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.3 + rand() * 0.3, 0), mat);
      rock.position.y = 0.25;
      return rock;
    }
    case "crystal": {
      const g = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({
        color: accent,
        emissive: accent,
        emissiveIntensity: 0.35,
        roughness: 0.2,
        metalness: 0.3,
        flatShading: true,
      });
      const shard = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.2, 5), mat);
      shard.position.y = 0.6;
      g.add(shard);
      return g;
    }
    case "shroom": {
      const g = new THREE.Group();
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.1, 0.4, 8),
        new THREE.MeshStandardMaterial({ color: 0xd9d2b6, roughness: 0.85 }),
      );
      stem.position.y = 0.2;
      g.add(stem);
      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: accent, roughness: 0.5 }),
      );
      cap.position.y = 0.42;
      g.add(cap);
      return g;
    }
    case "cloud": {
      const g = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({
        color: 0xf6fbff,
        roughness: 0.95,
        emissive: 0x9fbdd8,
        emissiveIntensity: 0.15,
      });
      const a = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 10), mat);
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 10), mat);
      const c = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 10), mat);
      a.position.set(0, 1.6, 0);
      b.position.set(0.35, 1.55, 0.1);
      c.position.set(-0.32, 1.62, -0.05);
      g.add(a, b, c);
      return g;
    }
    case "rune": {
      const g = new THREE.Group();
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.42, 0.05, 8, 24),
        new THREE.MeshStandardMaterial({
          color: accent,
          emissive: accent,
          emissiveIntensity: 0.7,
          roughness: 0.4,
        }),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.06;
      g.add(ring);
      return g;
    }
    case "gear": {
      const mat = new THREE.MeshStandardMaterial({
        color: 0x9b9faa,
        roughness: 0.55,
        metalness: 0.85,
      });
      const cog = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.14, 8), mat);
      cog.rotation.x = Math.PI / 2;
      cog.position.y = 0.18;
      return cog;
    }
    default:
      return null;
  }
}
