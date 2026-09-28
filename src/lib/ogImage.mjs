// Build-time share images for presentation pages (served from
// src/pages/og/[slug].png.js). Each card is the poster system at 1200x630:
// cream paper, the NOAI logo, the talk's title, presenter, date/time and
// venue, plus the presenter's photo in an offset color frame. A talk with
// no photo gets the same card with the logo's squiggles and ringed dot in
// the photo's place.
//
// satori lays the card out (to SVG, text converted to paths) and resvg
// rasterizes it - both run in CI without a browser. sharp pre-crops photos, which also normalizes WebP
// and huge PNGs into small JPEGs satori can embed.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import { stripTags } from './text.mjs';

const require = createRequire(import.meta.url);
const PUBLIC_DIR = path.join(process.cwd(), 'public');

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

const PAPER = '#f3eddc';
const INK = '#1a1a1a';
const MUTED = '#5b5548';
const ACCENTS = ['#2250d6', '#e0261e', '#f4b714', '#1a9a9a'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Latin plus latin-ext so accented names (café, Bertuccelli-Böth...) keep
// their glyphs; satori falls back across every loaded font per glyph.
let fontsCache = null;
function fonts() {
  if (!fontsCache) {
    const dir = path.dirname(require.resolve('@fontsource/inter-tight/package.json'));
    fontsCache = [];
    for (const weight of [600, 700, 800, 900]) {
      for (const [subset, name] of [['latin', 'Inter Tight'], ['latin-ext', 'Inter Tight Ext']]) {
        fontsCache.push({
          name,
          weight,
          style: 'normal',
          data: fs.readFileSync(path.join(dir, 'files', `inter-tight-${subset}-${weight}-normal.woff`)),
        });
      }
    }
  }
  return fontsCache;
}

let logoCache = null;
function logoDataUri() {
  if (!logoCache) {
    const svg = fs.readFileSync(path.join(PUBLIC_DIR, 'media/noai-logo.svg'));
    logoCache = `data:image/svg+xml;base64,${svg.toString('base64')}`;
  }
  return logoCache;
}

// Rows of the logo's squiggle (same wave as the site's CSS masks: one
// wavelength is 56 units, 21.4 peak to trough).
function squiggleDataUri(width, height, { rows = 1, rowGap = 48, stroke = 10, scale = 1, color = INK } = {}) {
  const wl = 56 * scale;
  const amp = 21.4 * scale;
  let d = '';
  for (let r = 0; r < rows; r++) {
    const y = rows === 1 ? height / 2 : rowGap / 2 + r * rowGap;
    d += `M${-wl} ${y}q${wl / 4} ${-amp} ${wl / 2} 0`;
    for (let x = 0; x < width + 2 * wl; x += wl / 2) d += `t${wl / 2} 0`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><path d="${d}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round"/></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

// Tiny hyperscript for satori's React-element-shaped input. Every div
// with more than one child needs display:flex in satori, so it's the
// default here.
function h(type, props, ...children) {
  const flat = children.flat().filter((c) => c !== null && c !== undefined && c !== false && c !== '');
  const style = { display: 'flex', ...(props && props.style) };
  return { type, props: { ...props, style, children: flat.length === 1 ? flat[0] : flat } };
}

function formatIsoDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${WEEKDAYS[date.getDay()]}, ${MONTHS[m - 1]} ${d}, ${y}`;
}

// Date/time/venue/presenter for a talk: its row in the published schedule
// when there is one (2026), otherwise the fields scraped from the old
// WordPress pages - whose date reads like "Sunday (11/10/24)".
export function presentationEventInfo(content, pres) {
  const sf = pres.scraped_fields || {};
  const row = (content.schedule || []).find((s) => s.presentation_id === pres.id);
  if (row) {
    return {
      date: row.date ? formatIsoDate(row.date) : '',
      time: row.time || '',
      location: row.location || '',
      presenters: row.presenters || sf.presenter_name || '',
      type: row.type || '',
    };
  }
  let date = '';
  const m = /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(sf.date || '');
  if (m) {
    const year = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]);
    date = formatIsoDate(`${year}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`);
  }
  return {
    date,
    time: sf.time || '',
    location: sf.location || '',
    presenters: sf.presenter_name || '',
    type: sf.type || '',
  };
}

// Same preference as the page's old og:image: the talk's featured image,
// then the scraped presenter photo. Returns a path under public/, or null.
export function presentationPhotoPath(content, pres) {
  const media = content.media.find((m) => m.id === pres.featured_media);
  const candidates = [media && media.source_url, (pres.scraped_fields || {}).presenter_photo_url];
  for (const rel of candidates) {
    if (!rel) continue;
    const abs = path.join(PUBLIC_DIR, rel);
    if (fs.existsSync(abs)) return abs;
  }
  return null;
}

async function photoDataUri(absPath, size) {
  try {
    const buf = await sharp(absPath)
      .rotate()
      .resize(size, size, { fit: 'cover', position: sharp.strategy.attention })
      .flatten({ background: PAPER })
      .jpeg({ quality: 84 })
      .toBuffer();
    return `data:image/jpeg;base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

// Emoji and other symbols have no glyph in Inter Tight - drop them rather
// than render empty boxes.
function cleanText(s) {
  return s.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '').replace(/\s+/g, ' ').trim();
}

// Old WordPress titles often end in " by <presenter>", which the card
// already shows on its own line.
function cardTitle(pres, presenters) {
  let title = cleanText(stripTags(pres.title.rendered));
  const by = / by ([^]+)$/i.exec(title);
  if (by && presenters && presenters.toLowerCase().includes(by[1].toLowerCase().slice(0, 12))) {
    title = title.slice(0, by.index).trim();
  }
  if (title.length > 120) title = `${title.slice(0, 117).replace(/\s+\S*$/, '')}…`;
  return title;
}

function titleSize(title, wide) {
  const n = title.length;
  const sizes = wide ? [[28, 76], [50, 66], [75, 56], [100, 50]] : [[24, 70], [44, 60], [66, 52], [90, 46]];
  for (const [max, size] of sizes) if (n <= max) return size;
  return wide ? 44 : 40;
}

export async function renderPresentationOg(content, pres) {
  const info = presentationEventInfo(content, pres);
  const presenters = cleanText(info.presenters);
  const title = cardTitle(pres, presenters);
  const accent = ACCENTS[pres.id % ACCENTS.length];
  const photoPath = presentationPhotoPath(content, pres);
  const photo = photoPath ? await photoDataUri(photoPath, 400) : null;
  const when = [info.date, info.time].filter(Boolean).join(' · ');
  const where = cleanText(info.location);

  const brand = h('div', { style: { alignItems: 'center', gap: 20 } },
    h('img', { src: logoDataUri(), width: 140, height: 64 }),
    h('div', { style: { width: 3, height: 44, background: INK } }),
    h('div', { style: { fontSize: 22, fontWeight: 800, letterSpacing: -0.3, color: INK } }, 'New Orleans Arts & Ideas Festival'),
  );

  const headline = h('div', { style: { flexDirection: 'column', gap: 18 } },
    info.type ? h('div', { style: { alignSelf: 'flex-start', background: INK, color: PAPER, fontSize: 16, fontWeight: 800, letterSpacing: 1.6, padding: '5px 10px', textTransform: 'uppercase' } }, cleanText(info.type)) : null,
    h('div', {
      style: {
        fontSize: titleSize(title, !photo), fontWeight: 900, lineHeight: 1.0, letterSpacing: -0.035 * titleSize(title, !photo), color: INK,
        display: 'block', lineClamp: 4,
      },
    }, title),
    presenters ? h('div', { style: { fontSize: 26, fontWeight: 700, color: MUTED, letterSpacing: -0.3, display: 'block', lineClamp: 1 } }, presenters) : null,
  );

  const footer = h('div', { style: { flexDirection: 'column', gap: 6, borderTop: `4px solid ${INK}`, paddingTop: 16 } },
    when ? h('div', { style: { fontSize: 28, fontWeight: 900, letterSpacing: -0.6, color: INK } }, when) : null,
    where ? h('div', { style: { fontSize: 20, fontWeight: 700, color: INK, display: 'block', lineClamp: 1 } }, where) : null,
    !when && !where ? h('div', { style: { fontSize: 24, fontWeight: 800, color: INK } }, 'fest.philosophers.group') : null,
  );

  // The logo's O (red disc, cream gap, teal ring) - drawn as SVG circles;
  // a CSS box-shadow ring rasterizes as a polygon in resvg.
  const ringDot = (d, style) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 286 286"><circle cx="143" cy="143" r="130" fill="${PAPER}" stroke="#1a9a9a" stroke-width="26"/><circle cx="143" cy="143" r="98" fill="#e0261e"/></svg>`;
    return h('img', { src: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`, width: d, height: d, style: { position: 'absolute', ...style } });
  };

  const art = photo
    ? h('div', { style: { position: 'relative', width: 440, height: 630, alignItems: 'center', justifyContent: 'center' } },
      h('img', { src: squiggleDataUri(260, 300, { rows: 6, rowGap: 50, stroke: 9 }), width: 260, height: 300, style: { position: 'absolute', top: 36, right: 0 } }),
      h('div', { style: { position: 'relative', width: 380, height: 380, border: `4px solid ${INK}`, boxShadow: `18px 18px 0 ${accent}`, marginTop: 20, marginRight: 18 } },
        h('img', { src: photo, width: 372, height: 372, style: { objectFit: 'cover' } }),
      ),
      ringDot(124, { left: -14, bottom: 58 }),
    )
    : h('div', { style: { position: 'relative', width: 300, height: 630 } },
      h('div', { style: { position: 'absolute', top: 0, bottom: 0, right: 40, width: 70, background: accent } }),
      h('img', { src: squiggleDataUri(300, 630, { rows: 13, rowGap: 48, stroke: 9 }), width: 300, height: 630, style: { position: 'absolute', top: 0, left: 0 } }),
      ringDot(176, { left: 24, top: 227 }),
    );

  const tree = h('div', {
    style: {
      width: OG_WIDTH, height: OG_HEIGHT, background: PAPER, fontFamily: 'Inter Tight, Inter Tight Ext',
      color: INK, overflow: 'hidden',
    },
  },
  h('div', { style: { flex: 1, flexDirection: 'column', justifyContent: 'space-between', padding: '48px 36px 44px 64px', minWidth: 0 } },
    brand, headline, footer,
  ),
  art,
  );

  const svg = await satori(tree, { width: OG_WIDTH, height: OG_HEIGHT, fonts: fonts() });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: OG_WIDTH } }).render().asPng();
  // JPEG, not PNG: the photo cards are ~4x smaller (a PNG set adds ~40MB
  // to the deploy), and 4:4:4 chroma keeps the flat colors and type crisp.
  return sharp(png).jpeg({ quality: 86, chromaSubsampling: '4:4:4', mozjpeg: true }).toBuffer();
}
