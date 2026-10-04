import fs from "node:fs";
import path from "node:path";
import { root } from "../lib/core.mjs";

// 44-unit artboard drawn at 22pt (see `Menubar.iconSize`): one unit is one device pixel on a retina display.
// Coordinates are y-down; the content stream flips them into PDF space.
const directory = path.join(root, "resources/icons/menubar");
const kappa = 0.5523;

const keycap = { x: 11, y: 11, width: 22, height: 22, radius: 5.5 };
const tiles = [{ x: 2, y: 14.5, width: 6.5, height: 15, radius: 2 }, { x: 35.5, y: 14.5, width: 6.5, height: 15, radius: 2 }];
const glyph = [
  [[15.5, 20.85], [20.6, 20.85], [20.6, 23.15], [15.5, 23.15]],
  [[20.6, 17.4], [25.8, 22], [20.6, 26.6]],
  [[27.2, 16.6], [29.5, 16.6], [29.5, 27.4], [27.2, 27.4]],
];

const n = (value) => Number(value.toFixed(3)).toString();

function roundedRect({ x, y, width, height, radius }, inset = 0) {
  const [left, top, right, bottom, r] = [x + inset, y + inset, x + width - inset, y + height - inset, radius - inset];
  const k = r * kappa;
  return [
    `${n(left + r)} ${n(top)} m`,
    `${n(right - r)} ${n(top)} l`, `${n(right - r + k)} ${n(top)} ${n(right)} ${n(top + r - k)} ${n(right)} ${n(top + r)} c`,
    `${n(right)} ${n(bottom - r)} l`, `${n(right)} ${n(bottom - r + k)} ${n(right - r + k)} ${n(bottom)} ${n(right - r)} ${n(bottom)} c`,
    `${n(left + r)} ${n(bottom)} l`, `${n(left + r - k)} ${n(bottom)} ${n(left)} ${n(bottom - r + k)} ${n(left)} ${n(bottom - r)} c`,
    `${n(left)} ${n(top + r)} l`, `${n(left)} ${n(top + r - k)} ${n(left + r - k)} ${n(top)} ${n(left + r)} ${n(top)} c`,
    "h",
  ].join("\n");
}

const polygon = (points) => `${points.map(([x, y], index) => `${n(x)} ${n(y)} ${index === 0 ? "m" : "l"}`).join("\n")}\nh`;
const glyphPaths = () => glyph.map(polygon).join("\n");
const recededTiles = () => ["q /Receded gs", ...tiles.map((tile) => `${roundedRect(tile)}\nf`), "Q"];
const rgb = (value) => [(value >> 16) & 255, (value >> 8) & 255, value & 255].map((channel) => n(channel / 255)).join(" ");

export const variants = {
  outlined: [
    "0 g 0 G 2.2 w",
    `${roundedRect(keycap, 1.1)}\nS`,
    ...recededTiles(),
    `${glyphPaths()}\nf`,
  ],
  filled: [
    "0 g",
    `${roundedRect(keycap)}\n${glyphPaths()}\nf*`,
    ...recededTiles(),
  ],
  colored: [
    `${rgb(0xffb547)} rg`,
    ...tiles.map((tile) => `${roundedRect(tile)}\nf`),
    `${rgb(0xe8562a)} rg`,
    `${roundedRect(keycap)}\nf`,
    `${rgb(0xfff4e4)} rg`,
    `${glyphPaths()}\nf`,
  ],
};

export function pdf(operations) {
  const content = ["1 0 0 -1 0 44 cm", "1 J 1 j", ...operations].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 44 44] /Contents 4 0 R /Resources << /ExtGState << /Receded << /ca 0.45 >> >> >> >>",
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
  ];
  let body = "%PDF-1.4\n";
  const offsets = objects.map((object, index) => {
    const offset = Buffer.byteLength(body);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
    return offset;
  });
  const xref = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}`;
  return `${body}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  Object.values(variants).forEach((operations, index) => fs.writeFileSync(path.join(directory, `menubar-${index}.pdf`), pdf(operations)));
  console.log(`generate-menubar-icons: wrote ${Object.keys(variants).length} glyphs to ${path.relative(root, directory)}`);
}
