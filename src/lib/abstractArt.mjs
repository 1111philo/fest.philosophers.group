// Abstract compositions built from the brand's shapes - the logo's squiggle,
// its ringed O, flat bars and circles - in the poster's palette. Each is a
// 1080x1080 SVG string for components/AbstractArt.astro. The same pieces
// were made as standalone social images.
//
// Squiggle rows are wrapped in <g class="art-waves" style="--wl:..."> so
// the site's scroll motion can drift them by exactly one wavelength
// (styles/app.css); they start well off the left edge so the drift never
// exposes a line's end.
const CREAM = '#f3eddc';
const INK = '#1a1a1a';
const BLUE = '#2250d6';
const RED = '#e0261e';
const YEL = '#f4b714';
const TEAL = '#1a9a9a';
const W = 1080;

// The logo's squiggle: quadratic humps, `wl` units per full wave.
function wave(x0, y, length, { wl = 56, amp = 21.4, stroke = 16, color = INK } = {}) {
  const half = wl / 2;
  const n = Math.max(1, Math.floor(length / half));
  const d = `M${x0} ${y}q${wl / 4} ${-amp} ${half} 0${`t${half} 0`.repeat(n - 1)}`;
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

// Waves in a drift group; x0 sits a couple of wavelengths off-canvas.
function waves(wl, body) {
  return `<g class="art-waves" style="--wl:${wl}px">${body}</g>`;
}

function field(y, h, { gap = 64, ...opts } = {}) {
  const wl = opts.wl || 56;
  let out = '';
  for (let i = 0; i < Math.floor(h / gap); i++) out += wave(-3 * wl, y + gap / 2 + i * gap, W + 6 * wl, opts);
  return waves(wl, out);
}

// Logo proportions: outer radius 143u, ring stroke 26u centred on 130u,
// disc 98u.
function ring(cx, cy, r, { disc = RED, gap = CREAM, ring: ringColor = TEAL } = {}) {
  const s = r / 143;
  return `<circle cx="${cx}" cy="${cy}" r="${130 * s}" fill="${gap}" stroke="${ringColor}" stroke-width="${26 * s}"/>`
    + `<circle cx="${cx}" cy="${cy}" r="${98 * s}" fill="${disc}"/>`;
}

const PIECES = {
  // Cream squiggle rows over a yellow bar; a big ringed O, bottom right.
  field: () => [BLUE,
    `<rect x="690" y="-20" width="170" height="1120" fill="${YEL}"/>`
    + field(20, 1060, { gap: 72, color: CREAM, stroke: 15 })
    + ring(760, 760, 250, { disc: RED, gap: BLUE, ring: CREAM })],

  // A half-sunk ink circle with a red core, three heavy squiggles, a teal band.
  sun: () => [YEL,
    `<rect x="-10" y="160" width="1100" height="120" fill="${TEAL}"/>`
    + `<circle cx="300" cy="1080" r="420" fill="${INK}"/><circle cx="300" cy="1080" r="230" fill="${RED}"/>`
    + `<clipPath id="sun-clip"><rect x="470" y="0" width="610" height="1080"/></clipPath>`
    + `<g clip-path="url(#sun-clip)">${waves(110, [430, 540, 650].map((y) => wave(470 - 330, y, 1000, { wl: 110, amp: 42, stroke: 30 })).join(''))}</g>`
    + ring(830, 220, 120, { disc: CREAM, gap: YEL, ring: INK })],

  // Concentric target over diagonal squiggles.
  target: () => [RED,
    `<g transform="rotate(-30 540 540)"><g transform="translate(-400 -400)">`
    + waves(56, Array.from({ length: 17 }, (_, i) => wave(-168, 55 + i * 110, 2100, { stroke: 18 })).join(''))
    + `</g></g>`
    + [[380, CREAM], [300, BLUE], [220, YEL], [140, INK], [62, RED]].map(([r, c]) => `<circle cx="540" cy="540" r="${r}" fill="${c}"/>`).join('')],

  // A 4x4 grid of ringed Os in rotating colorways, one squiggle through.
  dots: () => [TEAL,
    Array.from({ length: 16 }, (_, k) => {
      const i = k % 4;
      const j = Math.floor(k / 4);
      return ring(135 + i * 270, 135 + j * 270, 96, {
        disc: [RED, YEL, BLUE, CREAM][(i + j) % 4],
        gap: TEAL,
        ring: [CREAM, INK, YEL, RED][(i * 3 + j) % 4],
      });
    }).join('')
    + waves(135, wave(-405, 540, 1900, { wl: 135, amp: 52, stroke: 28 }))],

  // Squiggle rows cycling through the palette, a big ringed O.
  rows: () => [INK,
    waves(56, Array.from({ length: 13 }, (_, i) => wave(-168, 60 + i * 80, W + 336, { color: [BLUE, RED, YEL, TEAL, CREAM][i % 5] })).join(''))
    + ring(540, 560, 300, { disc: RED, gap: INK, ring: CREAM })],

  // The logo, abstracted: blue slab, ringed O, yellow slant, ink squiggles.
  shapes: () => [CREAM,
    ring(560, 520, 330)
    + `<rect x="90" y="120" width="230" height="820" fill="${BLUE}"/>`
    + `<path d="M700 120h170l190 820h-170z" fill="${YEL}"/>`
    + field(40, 240, { gap: 72, stroke: 14 })
    + field(830, 240, { gap: 72, stroke: 14 })],
};

export const ART_NAMES = Object.keys(PIECES);

export function abstractArtSvg(name) {
  const piece = PIECES[name];
  if (!piece) throw new Error(`Unknown abstract art "${name}" (have: ${ART_NAMES.join(', ')})`);
  const [bg, body] = piece();
  // Paper grain over the whole piece, matching the site's CSS texture
  // (styles/app.css --grain): calibrated noise blended with soft-light, so
  // it speckles every color without shifting it. The frequency is in the
  // SVG's 1080-unit space, scaled for the ~300-420px it's shown at.
  const grain = `<filter id="grain-${name}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">`
    + '<feTurbulence type="fractalNoise" baseFrequency=".3" numOctaves="3" stitchTiles="stitch"/>'
    + '<feColorMatrix type="saturate" values="0"/>'
    + '<feComponentTransfer><feFuncR type="linear" slope="2.2" intercept="-0.6"/><feFuncG type="linear" slope="2.2" intercept="-0.6"/>'
    + '<feFuncB type="linear" slope="2.2" intercept="-0.6"/><feFuncA type="linear" slope="0" intercept="1"/></feComponentTransfer></filter>';
  return `<svg class="abstract-art-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${W}" aria-hidden="true" focusable="false">`
    + `<defs>${grain}</defs>`
    + `<rect width="${W}" height="${W}" fill="${bg}"/>${body}`
    + `<rect width="${W}" height="${W}" filter="url(#grain-${name})" style="mix-blend-mode:soft-light"/></svg>`;
}
