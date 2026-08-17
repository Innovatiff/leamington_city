/**
 * Generates the directory's cover imagery.
 *
 * Every business needs a picture, and a directory of grey boxes looks dead.
 * These are rendered here rather than shipped as stock photography so the repo
 * carries no licensing baggage and no external image host can break the site.
 * Real photographs drop in over the top without any code change: set
 * `hero`/`photos` on a business and the generated cover is no longer used.
 *
 * Each cover is a layered scene — a graded sky, a horizon, a category motif and
 * a film grain — rasterised through Chromium so the output is a real WebP, not
 * an SVG the browser has to re-render on every card.
 *
 *   node scripts/generate-imagery.mjs
 *
 * Chromium comes from Playwright; the script is dev-only and is not part of
 * `pnpm build`. Output lands in apps/app/public/img/covers/.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'apps', 'app', 'public', 'img', 'covers');

/**
 * Palettes are duotone-plus-accent: a deep base, a lit top, and one warm
 * highlight so the scene reads as having a light source rather than being a
 * flat gradient.
 */
const PALETTES = {
  restaurants: { deep: '#4a1512', mid: '#a8341f', lit: '#f2a03d', accent: '#ffd9a0' },
  cafes: { deep: '#2b1a12', mid: '#7a4a2c', lit: '#d9a066', accent: '#f5e0c3' },
  bakeries: { deep: '#4a2f10', mid: '#b8802c', lit: '#f0c46a', accent: '#fff0cc' },
  grocery: { deep: '#12331d', mid: '#2f7a41', lit: '#8cc63f', accent: '#e2f5c4' },
  shops: { deep: '#331436', mid: '#7a2f78', lit: '#c264c0', accent: '#f7d4ef' },
  beauty: { deep: '#3a1428', mid: '#94356a', lit: '#e07fae', accent: '#fbd9e8' },
  health: { deep: '#0d3033', mid: '#1f7a78', lit: '#5cc4b4', accent: '#d2f2ea' },
  automotive: { deep: '#161d26', mid: '#3c5169', lit: '#7d9dc4', accent: '#dbe7f5' },
  'home-services': { deep: '#3d2a10', mid: '#8f6a24', lit: '#d9ac53', accent: '#f7e6bd' },
  professional: { deep: '#111c3a', mid: '#2f4a91', lit: '#7b96d9', accent: '#dbe3f7' },
  agriculture: { deep: '#14300f', mid: '#3f7a24', lit: '#9ec94a', accent: '#f0f5b8' },
  recreation: { deep: '#0c2a3a', mid: '#1f6f91', lit: '#57bcd9', accent: '#cdeef7' },
  lodging: { deep: '#1a1638', mid: '#443a86', lit: '#8b7fd1', accent: '#ded9f7' },
  community: { deep: '#331a2e', mid: '#8a3050', lit: '#e0748a', accent: '#fbd7d9' },
  other: { deep: '#241f1c', mid: '#5c5149', lit: '#a99a8a', accent: '#eae2d8' },
  /** Wide banner for the home page — Leamington's lake horizon at golden hour. */
  hero: { deep: '#3b1236', mid: '#d1441f', lit: '#ffb347', accent: '#fff0cf' },
};

/* ------------------------------------------------------------------ motifs */

/*
 * Motifs are abstract on purpose. An earlier pass drew literal objects — a cup,
 * a storefront — and they read as clip art, and worse, they fell apart the
 * moment a card cropped them. Geometry crops cleanly at any aspect ratio and
 * still gives each category its own character.
 */

/** Angular ridgeline. Greenhouse glass, and the only near-literal motif left. */
function peaks(p, w, h) {
  const bays = 9;
  let out = `<rect x="0" y="${h * 0.7}" width="${w}" height="${h * 0.3}" fill="${p.deep}" opacity="0.55"/>`;
  for (let i = 0; i < bays; i += 1) {
    const bw = (w * 1.25) / bays;
    const x = i * bw - w * 0.12;
    const peak = h * (0.7 - 0.1 - (i % 3) * 0.028);
    out += `<path d="M${x} ${h * 0.7} L${x + bw / 2} ${peak} L${x + bw} ${h * 0.7} Z"
      fill="${p.accent}" opacity="${0.3 - (i % 3) * 0.07}"/>`;
  }
  return out;
}

/** Broad diagonal colour fields. Reads as deliberate at any crop. */
function bands(p, w, h) {
  const span = Math.hypot(w, h);
  let out = '';
  const widths = [0.16, 0.07, 0.2, 0.05, 0.12];
  let cursor = -0.15;
  widths.forEach((band, i) => {
    out += `<rect x="${cursor * span}" y="${-span}" width="${band * span}" height="${span * 3}"
      fill="${i % 2 ? p.accent : p.deep}" opacity="${i % 2 ? 0.22 : 0.3}"/>`;
    cursor += band + 0.06;
  });
  return `<g transform="rotate(-24 ${w / 2} ${h / 2})">${out}</g>`;
}

/** Concentric rings, off-centre so the crop never looks like a target. */
function rings(p, w, h) {
  let out = '';
  for (let i = 7; i >= 1; i -= 1) {
    out += `<circle cx="${w * 0.78}" cy="${h * 0.28}" r="${h * i * 0.15}"
      fill="none" stroke="${p.accent}" stroke-width="${h * 0.035}"
      opacity="${0.05 + (7 - i) * 0.028}"/>`;
  }
  return out;
}

/** Flowing horizontal curves — water, and anything that should feel calm. */
function waves(p, w, h) {
  let out = `<circle cx="${w * 0.74}" cy="${h * 0.34}" r="${h * 0.13}" fill="${p.accent}" opacity="0.92"/>`;
  for (let i = 0; i < 7; i += 1) {
    const y = h * 0.56 + i * (h * 0.075);
    out += `<path d="M${-w * 0.05} ${y} Q ${w * 0.28} ${y - h * 0.05} ${w * 0.55} ${y}
      T ${w * 1.05} ${y - h * 0.02}" stroke="${p.accent}" fill="none"
      stroke-width="${h * (0.014 - i * 0.0014)}" opacity="${0.42 - i * 0.05}"/>`;
  }
  return out;
}

/** A field of dots that thins toward the top. Retail, services, anything busy. */
function dots(p, w, h) {
  let out = '';
  const cols = 12;
  const rows = 8;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const x = (c + (r % 2 ? 0.5 : 0)) * (w / cols);
      const y = h * 0.2 + r * (h / rows) * 0.9;
      const radius = (h / rows) * 0.13 * (0.4 + r / rows);
      out += `<circle cx="${x}" cy="${y}" r="${radius}" fill="${p.accent}"
        opacity="${0.06 + (r / rows) * 0.2}"/>`;
    }
  }
  return out;
}

/** Tall soft columns. Reads as light through a window. */
function columns(p, w, h) {
  let out = '';
  const n = 6;
  for (let i = 0; i < n; i += 1) {
    const cw = w / (n * 1.9);
    const x = i * (w / n) + cw * 0.4;
    out += `<rect x="${x}" y="${-h * 0.1}" width="${cw}" height="${h * 1.2}"
      fill="${p.accent}" opacity="${0.07 + (i % 3) * 0.05}" rx="${cw / 2}"/>`;
  }
  return `<g transform="rotate(9 ${w / 2} ${h / 2})">${out}</g>`;
}

/*
 * Pool of compositions that are visually distinct from one another. `columns`
 * is deliberately absent: at these sizes it is hard to tell from `bands`, and
 * two cards side by side looked like the same picture twice.
 */
const POOL = [bands, rings, dots, waves, peaks];

/**
 * Three compositions for a category: its own, then two others from the pool.
 * Picking by exclusion — rather than by rotation — is what guarantees that no
 * two variants can collide.
 */
function variantMotifs(key, base) {
  const others = POOL.filter((motif) => motif !== base);
  const offset = hashKey(key) % others.length;
  return [
    base,
    others[offset] ?? base,
    others[(offset + 1 + (others.length >> 1)) % others.length] ?? base,
  ];
}

const MOTIFS = {
  restaurants: bands,
  cafes: rings,
  bakeries: dots,
  grocery: dots,
  shops: columns,
  beauty: rings,
  health: rings,
  automotive: bands,
  'home-services': columns,
  professional: columns,
  agriculture: peaks,
  recreation: waves,
  lodging: waves,
  community: dots,
  other: bands,
  hero: waves,
};

/* ------------------------------------------------------------------- scene */

/** Stable per-category index into the variant rotation. */
function hashKey(value) {
  let out = 0;
  for (let i = 0; i < value.length; i += 1) out = (out * 31 + value.charCodeAt(i)) >>> 0;
  return out;
}

/** Nudges a hex colour's channels so variants are not the same picture twice. */
function shift(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  const r = clamp(((n >> 16) & 255) * (1 + amount));
  const g = clamp(((n >> 8) & 255) * (1 + amount * 0.45));
  const b = clamp((n & 255) * (1 - amount * 0.35));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function svg(key, variant, w, h) {
  const source = PALETTES[key] ?? PALETTES.other;
  const tone = [0, 0.14, -0.12][variant % 3] ?? 0;
  const p = {
    deep: shift(source.deep, tone * 0.5),
    mid: shift(source.mid, tone),
    lit: shift(source.lit, tone),
    accent: source.accent,
  };
  // The category's own motif leads; the other two are pulled from the pool so
  // no two cards in the same list look like the same photograph.
  const base = MOTIFS[key] ?? bands;
  const choices = variantMotifs(key, base);
  const motif = (choices[variant % choices.length] ?? base)(p, w, h);
  // The banner gets its scrim from CSS. Baking the card shading in as well
  // turned it to mud, so it is graded lighter and left more saturated.
  const isBanner = key === 'hero';
  const shadeBottom = isBanner ? 0.42 : 0.88;
  const shadeMid = isBanner ? 0.08 : 0.28;
  const vignette = isBanner ? 0.2 : 0.42;
  // Variants shift the light and rotate the hue slightly so three businesses in
  // the same category do not look like the same photograph.
  const tilt = [0, -14, 11][variant % 3];
  const lift = [0, 0.06, -0.05][variant % 3];

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0.2" y2="1">
      <stop offset="0%" stop-color="${p.lit}"/>
      <stop offset="46%" stop-color="${p.mid}"/>
      <stop offset="100%" stop-color="${p.deep}"/>
    </linearGradient>
    <radialGradient id="glow" cx="72%" cy="${34 + lift * 100}%" r="62%">
      <stop offset="0%" stop-color="${p.accent}" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="${p.accent}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="shade" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0%" stop-color="${p.deep}" stop-opacity="${shadeBottom}"/>
      <stop offset="42%" stop-color="${p.deep}" stop-opacity="${shadeMid}"/>
      <stop offset="100%" stop-color="${p.deep}" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="vignette" cx="50%" cy="42%" r="78%">
      <stop offset="55%" stop-color="${p.deep}" stop-opacity="0"/>
      <stop offset="100%" stop-color="${p.deep}" stop-opacity="${vignette}"/>
    </radialGradient>
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="${variant + 3}"/>
      <feColorMatrix type="saturate" values="0"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.26"/></feComponentTransfer>
    </filter>
  </defs>

  <rect width="${w}" height="${h}" fill="url(#sky)"/>
  <rect width="${w}" height="${h}" fill="url(#glow)"/>
  <g transform="rotate(${tilt} ${w / 2} ${h / 2})">${motif}</g>
  <rect width="${w}" height="${h}" fill="url(#vignette)"/>
  <rect width="${w}" height="${h}" fill="url(#shade)"/>
  <rect width="${w}" height="${h}" filter="url(#grain)" opacity="0.7" style="mix-blend-mode:overlay"/>
</svg>`;
}

/* ------------------------------------------------------------------ render */

const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ?? 'playwright'
).catch(() => {
  console.error(
    'playwright is not installed. This script is a dev-only tool:\n' +
      '  npm i -D playwright   (or run it from a scratch directory)',
  );
  process.exit(1);
});

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
});
const page = await browser.newPage();

const VARIANTS = 3;
const SIZE = { w: 1200, h: 800 };
const HERO = { w: 1800, h: 900 };
let written = 0;

for (const key of Object.keys(PALETTES)) {
  const isHero = key === 'hero';
  const { w, h } = isHero ? HERO : SIZE;
  const count = isHero ? 1 : VARIANTS;

  for (let variant = 0; variant < count; variant += 1) {
    const markup = svg(key, variant, w, h);
    await page.setViewportSize({ width: w, height: h });
    await page.setContent(
      `<style>html,body{margin:0;padding:0;overflow:hidden}</style>${markup}`,
      { waitUntil: 'load' },
    );
    const buffer = await page.screenshot({ type: 'jpeg', quality: 82 });
    const name = isHero ? 'hero.jpg' : `${key}-${variant + 1}.jpg`;
    await writeFile(join(OUT, name), buffer);
    written += 1;
  }
}

await browser.close();
console.log(`wrote ${written} covers to ${OUT}`);
