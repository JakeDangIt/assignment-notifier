/**
 * Generates the PWA icon set as real PNG files.
 *
 * Icons are rasterised and PNG-encoded here rather than committed as binaries
 * so the whole icon set stays reviewable in source control and can be
 * re-themed by editing the constants below. Requires no dependencies beyond
 * Node's built-in zlib.
 *
 * Usage: npm run icons
 */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const OUT_DIR = resolve(import.meta.dirname, "../public/icons");

/** Brand gradient endpoints (indigo -> violet), matching the app accent. */
const GRADIENT_FROM = [79, 70, 229];
const GRADIENT_TO = [139, 92, 246];
const GLYPH_COLOR = [255, 255, 255];

// ---------------------------------------------------------------------------
// PNG encoding
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBuf, data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), body.length + 4);
  return out;
}

/** Encodes raw RGBA pixel data (size x size) as an 8-bit RGBA PNG. */
function encodePng(rgba, size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  // Each scanline is prefixed with its filter type byte (0 = None).
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Rasterisation
// ---------------------------------------------------------------------------

/** Shortest distance from point p to the line segment ab. */
function distanceToSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const lengthSq = abx * abx + aby * aby;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / lengthSq));
  const dx = px - (ax + t * abx);
  const dy = py - (ay + t * aby);
  return Math.hypot(dx, dy);
}

/** Signed distance to a rounded rectangle; negative inside. */
function roundedRectDistance(px, py, cx, cy, halfW, halfH, radius) {
  const qx = Math.abs(px - cx) - (halfW - radius);
  const qy = Math.abs(py - cy) - (halfH - radius);
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  return outside + Math.min(Math.max(qx, qy), 0) - radius;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Draws the app icon: a rounded-square badge carrying a checkmark.
 *
 * `padding` is the fraction of the canvas left empty around the badge. Maskable
 * icons pass 0 (full bleed) because the launcher applies its own mask and will
 * crop up to 20% on every edge.
 */
function drawIcon(size, { padding, glyphScale }) {
  const rgba = Buffer.alloc(size * size * 4);
  const center = size / 2;
  const half = center * (1 - padding);
  const radius = half * 0.28;

  // Supersample to keep the curves and the glyph smooth at 192px and below.
  const samples = 3;
  const step = 1 / (samples + 1);

  const glyph = half * glyphScale;
  // Checkmark vertices, expressed relative to the badge centre.
  const ax = center - glyph * 0.62, ay = center + glyph * 0.02;
  const bx = center - glyph * 0.16, by = center + glyph * 0.46;
  const cx2 = center + glyph * 0.62, cy2 = center - glyph * 0.46;
  const strokeHalf = glyph * 0.15;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let badgeCoverage = 0;
      let glyphCoverage = 0;

      for (let sy = 1; sy <= samples; sy++) {
        for (let sx = 1; sx <= samples; sx++) {
          const px = x + sx * step;
          const py = y + sy * step;

          const badgeDist = roundedRectDistance(px, py, center, center, half, half, radius);
          if (badgeDist < 0) badgeCoverage++;

          const glyphDist = distanceToSegment(px, py, ax, ay, bx, by);
          const glyphDist2 = distanceToSegment(px, py, bx, by, cx2, cy2);
          if (Math.min(glyphDist, glyphDist2) < strokeHalf) glyphCoverage++;
        }
      }

      const total = samples * samples;
      const badgeAlpha = badgeCoverage / total;
      const glyphAlpha = glyphCoverage / total;

      // Diagonal gradient across the badge.
      const t = (x / size + y / size) / 2;
      const base = [
        lerp(GRADIENT_FROM[0], GRADIENT_TO[0], t),
        lerp(GRADIENT_FROM[1], GRADIENT_TO[1], t),
        lerp(GRADIENT_FROM[2], GRADIENT_TO[2], t),
      ];

      const i = (y * size + x) * 4;
      rgba[i] = Math.round(lerp(base[0], GLYPH_COLOR[0], glyphAlpha));
      rgba[i + 1] = Math.round(lerp(base[1], GLYPH_COLOR[1], glyphAlpha));
      rgba[i + 2] = Math.round(lerp(base[2], GLYPH_COLOR[2], glyphAlpha));
      rgba[i + 3] = Math.round(255 * badgeAlpha);
    }
  }

  return rgba;
}

/**
 * Apple ignores transparency and corner rounding on apple-touch-icon, compositing
 * the image onto an opaque tile itself, so this variant is drawn square and flat.
 */
function drawAppleIcon(size) {
  const rgba = drawIcon(size, { padding: 0, glyphScale: 0.62 });
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      if (rgba[i + 3] === 255) continue;
      const t = (x / size + y / size) / 2;
      rgba[i] = Math.round(lerp(GRADIENT_FROM[0], GRADIENT_TO[0], t));
      rgba[i + 1] = Math.round(lerp(GRADIENT_FROM[1], GRADIENT_TO[1], t));
      rgba[i + 2] = Math.round(lerp(GRADIENT_FROM[2], GRADIENT_TO[2], t));
      rgba[i + 3] = 255;
    }
  }
  return rgba;
}

const targets = [
  { file: "icon-192.png", size: 192, draw: (s) => drawIcon(s, { padding: 0.04, glyphScale: 0.62 }) },
  { file: "icon-512.png", size: 512, draw: (s) => drawIcon(s, { padding: 0.04, glyphScale: 0.62 }) },
  // Maskable: full bleed, glyph pulled well inside the 80% safe zone.
  { file: "maskable-192.png", size: 192, draw: (s) => drawIcon(s, { padding: 0, glyphScale: 0.42 }) },
  { file: "maskable-512.png", size: 512, draw: (s) => drawIcon(s, { padding: 0, glyphScale: 0.42 }) },
  { file: "apple-touch-icon.png", size: 180, draw: (s) => drawAppleIcon(s) },
  // Monochrome-ish small badge used for the notification badge slot on Android.
  { file: "badge-96.png", size: 96, draw: (s) => drawIcon(s, { padding: 0.04, glyphScale: 0.66 }) },
];

mkdirSync(OUT_DIR, { recursive: true });
for (const target of targets) {
  const png = encodePng(target.draw(target.size), target.size);
  const outPath = resolve(OUT_DIR, target.file);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, png);
  console.log(`wrote ${target.file} (${target.size}x${target.size}, ${png.length} bytes)`);
}
