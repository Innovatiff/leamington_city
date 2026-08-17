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
/*
 * Every palette lives on the arc from deep lake blue to Sun Parlour yellow.
 *
 * An earlier pass gave each category its own hue and the result was a rainbow
 * that fought the brand — fifteen accent colours on one page. Categories are
 * still told apart, but by where they sit along that single arc and by their
 * composition, not by breaking out of it. The whole directory reads as one
 * thing.
 */
/*
 * Every palette lives on the arc from deep lake blue to Sun Parlour yellow.
 *
 * An earlier pass gave each category its own hue and the result was a rainbow
 * that fought the brand. A second pass over-corrected: constrained to blue, half
 * the tiles collapsed into the same navy. So categories are separated by
 * *lightness and temperature* along the arc — pale sky, steel, teal, green,
 * gold — which keeps them apart at thumbnail size without leaving the family.
 */
const PALETTES = {
  // Warm end — the Sun Parlour. Bright tops, so they read first.
  bakeries: { deep: '#3a2c0c', mid: '#9c7a20', lit: '#f2d770', accent: '#fff8d8' },
  restaurants: { deep: '#241d34', mid: '#8a6c18', lit: '#e9be3c', accent: '#fdf1cc' },
  cafes: { deep: '#2a2410', mid: '#6f5a1c', lit: '#c9a63c', accent: '#f8ecc4' },
  agriculture: { deep: '#16321f', mid: '#4a7a2c', lit: '#b6cc55', accent: '#f2f7c8' },

  // Middle — the lake itself.
  grocery: { deep: '#08302c', mid: '#177a63', lit: '#5fc79c', accent: '#d6f7e4' },
  recreation: { deep: '#052c3e', mid: '#106a8c', lit: '#48c2dc', accent: '#cbf3fb' },
  health: { deep: '#07293a', mid: '#1a6c86', lit: '#74d0dc', accent: '#d6f6fa' },

  // Sky blues — light, so they separate from the navies below.
  community: { deep: '#0b2544', mid: '#2a72b8', lit: '#8ecbf2', accent: '#dcf0fd' },
  shops: { deep: '#141f46', mid: '#3f5bb0', lit: '#9db2ee', accent: '#e4eafd' },
  'home-services': { deep: '#12203c', mid: '#3a63a8', lit: '#a6c6ec', accent: '#e2eefb' },

  // Cooler and deeper.
  beauty: { deep: '#1b1a42', mid: '#5a52a2', lit: '#b8a6e4', accent: '#eae4fb' },
  lodging: { deep: '#0d1638', mid: '#3b45a8', lit: '#8089e2', accent: '#e0e3fc' },
  automotive: { deep: '#0f1a2c', mid: '#2c4a70', lit: '#6f93c0', accent: '#d5e4f4' },
  professional: { deep: '#091530', mid: '#1f3f80', lit: '#5578cc', accent: '#cfdcf8' },
  other: { deep: '#161d2e', mid: '#41506b', lit: '#8b9bb4', accent: '#dee6f0' },

  /** Home banner: the sun going down over Lake Erie. */
  hero: { deep: '#071230', mid: '#1b4a90', lit: '#e8a92e', accent: '#fff2cc', sun: '#ffd24a' },
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
  // A near-white disc goes grey the moment the page lays a scrim over it, so the
  // core is a saturated yellow and the bloom is a real radial gradient — stacked
  // discs left visible rings that read as a target rather than a light.
  const core = p.sun ?? p.accent;
  const cx = w * 0.74;
  const cy = h * 0.34;
  let out = `<defs>
      <radialGradient id="bloom" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="${core}" stop-opacity="0.62"/>
        <stop offset="38%" stop-color="${core}" stop-opacity="0.24"/>
        <stop offset="72%" stop-color="${core}" stop-opacity="0.07"/>
        <stop offset="100%" stop-color="${core}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <circle cx="${cx}" cy="${cy}" r="${h * 0.42}" fill="url(#bloom)"/>
    <circle cx="${cx}" cy="${cy}" r="${h * 0.115}" fill="${core}"/>`;
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
    // Carried through unshifted: the sun's colour is the point, not a variant.
    sun: source.sun,
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
    <linearGradient id="sky" x1="${isBanner ? 0 : 0}" y1="${isBanner ? 1 : 0}"
      x2="${isBanner ? 1 : 0.2}" y2="${isBanner ? 0 : 1}">
      <stop offset="0%" stop-color="${isBanner ? p.deep : p.lit}"/>
      <stop offset="46%" stop-color="${p.mid}"/>
      <stop offset="100%" stop-color="${isBanner ? p.lit : p.deep}"/>
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
