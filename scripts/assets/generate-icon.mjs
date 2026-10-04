import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { root } from "../lib/core.mjs";

const iconset = path.join(root, "resources/icons/app/app.iconset");
const icns = path.join(root, "resources/icons/app/app.icns");
const sizes = [[16, 1], [16, 2], [32, 1], [32, 2], [128, 1], [128, 2], [256, 1], [256, 2], [512, 1], [512, 2]];
const icnsTypes = { 16: "icp4", 32: "icp5", 64: "ic12", 128: "ic07", 256: "ic08", 512: "ic09", 1024: "ic10" };

const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const hex = (value) => [(value >> 16) & 255, (value >> 8) & 255, value & 255];

function roundedRect(x, y, cx, cy, halfW, halfH, radius) {
  const qx = Math.abs(x - cx) - halfW + radius;
  const qy = Math.abs(y - cy) - halfH + radius;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
}

function segment(x, y, ax, ay, bx, by, thickness) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy));
  return Math.hypot(x - (ax + dx * t), y - (ay + dy * t)) - thickness;
}

const coverage = (distance, pixel) => clamp(0.5 - distance / pixel);

function over(dst, color, alpha) {
  const a = alpha + dst[3] * (1 - alpha);
  if (a === 0) return dst;
  const rgb = [0, 1, 2].map((i) => (color[i] * alpha + dst[i] * dst[3] * (1 - alpha)) / a);
  return [...rgb, a];
}

const palette = {
  amber: hex(0xffb547),
  ember: hex(0xe8562a),
  cream: hex(0xfff4e4),
  shadow: hex(0x2a0f05),
  lip: hex(0x1a1528),
  faceTop: hex(0x3d3359),
  faceBottom: hex(0x29223f),
  glyph: hex(0xffc266),
};

function shade(px, py, unit) {
  const x = px / unit;
  const y = py / unit;
  const pixel = 1 / unit;
  const body = coverage(roundedRect(x, y, 512, 512, 412, 412, 186), pixel);
  let out = over([0, 0, 0, 0], mix(palette.amber, palette.ember, clamp((y - 100) / 824)), body);
  const glow = clamp(1 - Math.hypot(x - 360, y - 230) / 620);
  out = over(out, palette.cream, body * glow * glow * 0.35);
  out = sideTiles(out, x, y, pixel, body);
  out = keycap(out, x, y, pixel, body);
  return glyph(out, x, y, pixel);
}

function sideTiles(out, x, y, pixel, body) {
  for (const cx of [204, 820]) {
    const tile = roundedRect(x, y, cx, 540, 76, 138, 28);
    out = over(out, palette.shadow, body * clamp(0.5 - (tile - 14) / 36) * 0.2);
    out = over(out, palette.cream, body * coverage(tile, pixel) * 0.66);
    out = over(out, palette.ember, body * coverage(roundedRect(x, y, cx, 430, 46, 8, 8), pixel) * 0.6);
  }
  return out;
}

function keycap(out, x, y, pixel, body) {
  out = over(out, palette.shadow, body * clamp(0.5 - roundedRect(x, y, 512, 600, 180, 180, 76) / 80) * 0.5);
  out = over(out, palette.cream, coverage(Math.abs(roundedRect(x, y, 512, 540, 206, 212, 84)) - 10, pixel));
  out = over(out, palette.lip, coverage(roundedRect(x, y, 512, 554, 176, 176, 64), pixel));
  return over(out, mix(palette.faceTop, palette.faceBottom, clamp((y - 370) / 320)), coverage(roundedRect(x, y, 512, 528, 158, 156, 52), pixel));
}

function glyph(out, x, y, pixel) {
  const scale = 0.85;
  const at = (gx, gy) => [512 + (gx - 525) * scale, 528 + (gy - 526) * scale];
  const stroke = (a, b) => segment(x, y, ...at(...a), ...at(...b), 22 * scale);
  const marks = [
    stroke([404, 526], [600, 526]),
    stroke([540, 466], [600, 526]),
    stroke([540, 586], [600, 526]),
    stroke([646, 456], [646, 596]),
  ];
  return over(out, palette.glyph, coverage(Math.min(...marks), pixel));
}

function render(size) {
  const data = Buffer.alloc(size * size * 4);
  const unit = size / 1024;
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const [r, g, b, a] = shade(col + 0.5, row + 0.5, unit);
      data.set([Math.round(r), Math.round(g), Math.round(b), Math.round(a * 255)], (row * size + col) * 4);
    }
  }
  return encodePng(size, data);
}

function chunk(type, body) {
  const head = Buffer.alloc(4);
  head.writeUInt32BE(body.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(Buffer.concat([Buffer.from(type), body])));
  return Buffer.concat([head, Buffer.from(type), body, crc]);
}

function encodePng(size, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 6, 0, 0, 0], 8);
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let row = 0; row < size; row++) rgba.copy(raw, row * (stride + 1) + 1, row * stride, (row + 1) * stride);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

function buildIcns(pngs) {
  const entries = Object.entries(icnsTypes).map(([size, type]) => {
    const head = Buffer.from(type);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(pngs.get(Number(size)).length + 8);
    return Buffer.concat([head, length, pngs.get(Number(size))]);
  });
  const total = Buffer.alloc(4);
  total.writeUInt32BE(8 + entries.reduce((sum, entry) => sum + entry.length, 0));
  return Buffer.concat([Buffer.from("icns"), total, ...entries]);
}

const pngs = new Map();
for (const size of new Set([...sizes.map(([base, scale]) => base * scale), ...Object.keys(icnsTypes).map(Number)])) pngs.set(size, render(size));
fs.rmSync(iconset, { recursive: true, force: true });
fs.mkdirSync(iconset, { recursive: true });
for (const [base, scale] of sizes) fs.writeFileSync(path.join(iconset, `icon_${base}x${base}${scale === 2 ? "@2x" : ""}.png`), pngs.get(base * scale));
fs.writeFileSync(icns, buildIcns(pngs));
console.log(`generate-icon: wrote ${pngs.size} sizes to ${path.relative(root, iconset)} and ${path.relative(root, icns)}`);
