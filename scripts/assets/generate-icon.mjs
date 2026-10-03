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

function shade(px, py, unit) {
  const x = px / unit;
  const y = py / unit;
  const pixel = 1 / unit;
  let out = [0, 0, 0, 0];
  const body = roundedRect(x, y, 512, 512, 412, 412, 186);
  out = over(out, mix(hex(0x6c63ff), hex(0x17163f), clamp((y - 100) / 824)), coverage(body, pixel));
  const glow = clamp(1 - Math.hypot(x - 512, y - 330) / 560);
  out = over(out, hex(0x9d8cff), coverage(body, pixel) * glow * glow * 0.45);
  const shadow = roundedRect(x, y, 512, 600, 290, 252, 76);
  out = over(out, hex(0x0a0924), coverage(body, pixel) * clamp(0.5 - shadow / 90) * 0.55);
  const side = roundedRect(x, y, 512, 560, 290, 262, 78);
  out = over(out, hex(0xb4b9f2), coverage(side, pixel));
  const face = roundedRect(x, y, 512, 530, 270, 242, 66);
  out = over(out, mix(hex(0xffffff), hex(0xdfe2ff), clamp((y - 290) / 480)), coverage(face, pixel));
  return glyph(out, x, y, pixel);
}

function glyph(out, x, y, pixel) {
  const ink = hex(0x2a2878);
  const thickness = 26;
  const marks = [
    segment(x, y, 330, 530, 640, 530, thickness),
    segment(x, y, 560, 450, 640, 530, thickness),
    segment(x, y, 560, 610, 640, 530, thickness),
    segment(x, y, 716, 440, 716, 620, thickness),
  ];
  return over(out, ink, coverage(Math.min(...marks), pixel));
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
