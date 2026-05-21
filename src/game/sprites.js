import { MONSTERS } from "./data.js";

/**
 * Per-element palette for procedural monster portraits.
 */
const ELEMENT_PALETTE = {
  Fire: { body: "#ff6b35", glow: "#ffd166", eye: "#fff7b6" },
  Water: { body: "#3498db", glow: "#a3e1ff", eye: "#fefefe" },
  Lightning: { body: "#f9c74f", glow: "#fff4a3", eye: "#22223b" },
  Earth: { body: "#b08968", glow: "#d4a373", eye: "#1f1f1f" },
  Rock: { body: "#8d99ae", glow: "#cfd6e1", eye: "#1f1f1f" },
  Cosmic: { body: "#7c4dff", glow: "#c0a8ff", eye: "#fefefe" },
  Nature: { body: "#52b788", glow: "#b7e4c7", eye: "#1f1f1f" },
  Wind: { body: "#a8dadc", glow: "#e6f6f7", eye: "#1f3a4a" },
  Magic: { body: "#c77dff", glow: "#e7c6ff", eye: "#1f1f1f" },
  Metal: { body: "#b0b6bd", glow: "#e2e6eb", eye: "#1f1f1f" },
};

/**
 * Cheap string hash for stable per-monster RNG.
 * @param {string} s
 */
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function makeRng(seed) {
  let s = seed | 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 0) % 100000) / 100000;
  };
}

/**
 * Produce an inline SVG markup string for a monster template id.
 * Cached in-module for repeated battles.
 * @param {string} templateId
 * @param {number} [size]
 */
const cache = new Map();
export function monsterSprite(templateId, size = 96) {
  const cacheKey = `${templateId}@${size}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  const def = MONSTERS[templateId];
  if (!def) return "";
  const palette = ELEMENT_PALETTE[def.element] ?? ELEMENT_PALETTE.Fire;
  const rand = makeRng(hashStr(templateId));

  const cx = size / 2;
  const cy = size / 2 + 4;
  const bodyR = size * 0.32;
  const eyeR = size * 0.04;
  const eyeOffsetX = bodyR * 0.45;
  const eyeOffsetY = -bodyR * 0.2;

  const isEvolved = !!(def.evolveLevel === undefined && def.id !== def.id.split("_")[0]);

  const decorations = [];
  const tags = elementTags(def.element);
  for (const tag of tags) {
    decorations.push(renderTag(tag, cx, cy, bodyR, palette, rand, isEvolved));
  }

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <defs>
    <radialGradient id="g_${templateId}" cx="50%" cy="40%" r="60%">
      <stop offset="0%" stop-color="${palette.glow}" />
      <stop offset="70%" stop-color="${palette.body}" />
      <stop offset="100%" stop-color="${shade(palette.body, -0.3)}" />
    </radialGradient>
  </defs>
  <circle cx="${cx}" cy="${size - 10}" rx="${bodyR}" ry="6" fill="rgba(0,0,0,0.35)" />
  <ellipse cx="${cx}" cy="${cy}" rx="${bodyR}" ry="${bodyR * (isEvolved ? 1.05 : 0.95)}" fill="url(#g_${templateId})" stroke="${shade(palette.body, -0.45)}" stroke-width="2"/>
  ${decorations.join("")}
  <circle cx="${cx - eyeOffsetX}" cy="${cy + eyeOffsetY}" r="${eyeR}" fill="${palette.eye}" />
  <circle cx="${cx + eyeOffsetX}" cy="${cy + eyeOffsetY}" r="${eyeR}" fill="${palette.eye}" />
  <circle cx="${cx - eyeOffsetX + 1}" cy="${cy + eyeOffsetY - 1}" r="${eyeR * 0.5}" fill="#ffffff" />
  <circle cx="${cx + eyeOffsetX + 1}" cy="${cy + eyeOffsetY - 1}" r="${eyeR * 0.5}" fill="#ffffff" />
  <path d="M ${cx - bodyR * 0.18} ${cy + bodyR * 0.32} Q ${cx} ${cy + bodyR * 0.46} ${cx + bodyR * 0.18} ${cy + bodyR * 0.32}" stroke="${shade(palette.body, -0.55)}" stroke-width="2" fill="none" stroke-linecap="round"/>
</svg>`.trim();
  cache.set(cacheKey, svg);
  return svg;
}

/**
 * @param {string} element
 * @returns {string[]}
 */
function elementTags(element) {
  switch (element) {
    case "Fire": return ["horn", "flame"];
    case "Water": return ["fin", "bubble"];
    case "Lightning": return ["spike", "bolt"];
    case "Earth": return ["ear", "rock"];
    case "Rock": return ["plate", "rock"];
    case "Cosmic": return ["star", "halo"];
    case "Nature": return ["leaf", "vine"];
    case "Wind": return ["wing", "swirl"];
    case "Magic": return ["star", "halo"];
    case "Metal": return ["plate", "bolt"];
    default: return ["horn"];
  }
}

function renderTag(tag, cx, cy, r, palette, rand, evolved) {
  const accent = palette.glow;
  switch (tag) {
    case "horn":
      return `<polygon points="${cx - r * 0.35},${cy - r * 0.85} ${cx - r * 0.15},${cy - r * 1.25} ${cx - r * 0.05},${cy - r * 0.85}" fill="${shade(palette.body, -0.2)}"/>
              <polygon points="${cx + r * 0.05},${cy - r * 0.85} ${cx + r * 0.15},${cy - r * 1.25} ${cx + r * 0.35},${cy - r * 0.85}" fill="${shade(palette.body, -0.2)}"/>`;
    case "flame":
      return `<path d="M ${cx - r * 0.55} ${cy - r * 0.7} Q ${cx - r * 0.4} ${cy - r * 1.1} ${cx - r * 0.2} ${cy - r * 0.75}" stroke="${accent}" stroke-width="3" fill="none" stroke-linecap="round"/>
              <path d="M ${cx + r * 0.2} ${cy - r * 0.7} Q ${cx + r * 0.4} ${cy - r * 1.1} ${cx + r * 0.55} ${cy - r * 0.75}" stroke="${accent}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    case "fin":
      return `<polygon points="${cx},${cy - r * 1.05} ${cx - r * 0.25},${cy - r * 0.55} ${cx + r * 0.25},${cy - r * 0.55}" fill="${shade(palette.body, -0.15)}"/>`;
    case "bubble":
      return `<circle cx="${cx - r * 0.85}" cy="${cy - r * 0.2}" r="${r * 0.12}" fill="${accent}" opacity="0.7"/>
              <circle cx="${cx + r * 0.85}" cy="${cy + r * 0.05}" r="${r * 0.09}" fill="${accent}" opacity="0.7"/>`;
    case "spike":
      return `<polygon points="${cx - r * 0.6},${cy - r * 0.95} ${cx - r * 0.45},${cy - r * 1.2} ${cx - r * 0.3},${cy - r * 0.95}" fill="${accent}"/>
              <polygon points="${cx},${cy - r * 1.05} ${cx + r * 0.15},${cy - r * 1.35} ${cx + r * 0.3},${cy - r * 1.05}" fill="${accent}"/>`;
    case "bolt":
      return `<polyline points="${cx - r * 0.2},${cy - r * 0.1} ${cx + r * 0.05},${cy - r * 0.3} ${cx - r * 0.05},${cy} ${cx + r * 0.2},${cy + r * 0.2}" stroke="${accent}" stroke-width="2.4" fill="none" stroke-linejoin="miter"/>`;
    case "ear":
      return `<ellipse cx="${cx - r * 0.55}" cy="${cy - r * 0.55}" rx="${r * 0.15}" ry="${r * 0.28}" fill="${shade(palette.body, -0.2)}"/>
              <ellipse cx="${cx + r * 0.55}" cy="${cy - r * 0.55}" rx="${r * 0.15}" ry="${r * 0.28}" fill="${shade(palette.body, -0.2)}"/>`;
    case "rock":
      return `<polygon points="${cx - r * 0.5},${cy + r * 0.55} ${cx - r * 0.7},${cy + r * 0.9} ${cx - r * 0.3},${cy + r * 0.9}" fill="${shade(palette.body, -0.35)}"/>
              <polygon points="${cx + r * 0.3},${cy + r * 0.6} ${cx + r * 0.15},${cy + r * 0.9} ${cx + r * 0.55},${cy + r * 0.9}" fill="${shade(palette.body, -0.35)}"/>`;
    case "plate":
      return `<path d="M ${cx - r * 0.7} ${cy} L ${cx} ${cy - r * 0.7} L ${cx + r * 0.7} ${cy} L ${cx} ${cy + r * 0.3} Z" fill="${shade(palette.body, -0.3)}" opacity="0.55"/>`;
    case "star":
      return `<polygon points="${starPoints(cx, cy - r * 0.95, r * 0.18, 5)}" fill="${accent}"/>`;
    case "halo":
      return `<ellipse cx="${cx}" cy="${cy - r * 1.05}" rx="${r * 0.6}" ry="${r * 0.12}" stroke="${accent}" stroke-width="3" fill="none" opacity="0.8"/>`;
    case "leaf":
      return `<path d="M ${cx} ${cy - r * 0.95} Q ${cx + r * 0.3} ${cy - r * 1.25} ${cx + r * 0.18} ${cy - r * 0.65} Q ${cx} ${cy - r * 0.85} ${cx} ${cy - r * 0.95} Z" fill="${accent}"/>`;
    case "vine":
      return `<path d="M ${cx - r * 0.6} ${cy + r * 0.4} Q ${cx - r * 0.8} ${cy + r * 0.1} ${cx - r * 0.4} ${cy - r * 0.1}" stroke="${accent}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
    case "wing":
      return `<path d="M ${cx - r * 0.95} ${cy - r * 0.05} Q ${cx - r * 1.25} ${cy + r * 0.45} ${cx - r * 0.5} ${cy + r * 0.55} Z" fill="${shade(palette.glow, -0.05)}" opacity="0.92"/>
              <path d="M ${cx + r * 0.95} ${cy - r * 0.05} Q ${cx + r * 1.25} ${cy + r * 0.45} ${cx + r * 0.5} ${cy + r * 0.55} Z" fill="${shade(palette.glow, -0.05)}" opacity="0.92"/>`;
    case "swirl":
      return `<circle cx="${cx}" cy="${cy + r * 0.2}" r="${r * 0.4}" stroke="${accent}" stroke-width="2" fill="none" opacity="0.6"/>`;
    default:
      return "";
  }
}

function starPoints(cx, cy, r, points) {
  const inner = r * 0.45;
  const out = [];
  for (let i = 0; i < points * 2; i++) {
    const ang = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const rad = i % 2 === 0 ? r : inner;
    out.push(`${(cx + Math.cos(ang) * rad).toFixed(1)},${(cy + Math.sin(ang) * rad).toFixed(1)}`);
  }
  return out.join(" ");
}

/**
 * Lighten/darken a hex color by amount in [-1, 1].
 * @param {string} hex
 * @param {number} amount
 */
function shade(hex, amount) {
  const c = hex.replace("#", "");
  const num = parseInt(c, 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;
  const t = amount < 0 ? 0 : 255;
  const f = Math.abs(amount);
  r = Math.round(r + (t - r) * f);
  g = Math.round(g + (t - g) * f);
  b = Math.round(b + (t - b) * f);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
