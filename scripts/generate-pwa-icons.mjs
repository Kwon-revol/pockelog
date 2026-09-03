import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function iconSvg(size, maskable = false) {
  const radius = maskable ? 0 : Math.round(size * 0.18);
  const inset = maskable ? size * 0.2 : size * 0.12;

  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <rect width="${size}" height="${size}" rx="${radius}" fill="#059669"/>
      <path
        d="M ${inset} ${size * 0.3} Q ${size * 0.5} ${size * 0.18} ${size - inset} ${size * 0.3} V ${size * 0.72} Q ${size * 0.5} ${size * 0.84} ${inset} ${size * 0.72} Z"
        fill="#fff"
      />
      <path
        d="M ${size * 0.32} ${size * 0.55} L ${size * 0.43} ${size * 0.45} L ${size * 0.54} ${size * 0.53} L ${size * 0.7} ${size * 0.38}"
        fill="none"
        stroke="#064e3b"
        stroke-width="${size * 0.055}"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  `);
}

async function renderPng(path, size, maskable = false) {
  await sharp(iconSvg(size, maskable))
    .png()
    .toFile(resolve(root, path));
}

function icoFromPng(png) {
  const header = Buffer.alloc(22);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  header[6] = 32;
  header[7] = 32;
  header.writeUInt16LE(1, 10);
  header.writeUInt16LE(32, 12);
  header.writeUInt32LE(png.length, 14);
  header.writeUInt32LE(22, 18);
  return Buffer.concat([header, png]);
}

await mkdir(resolve(root, "public/icons"), { recursive: true });
await Promise.all([
  renderPng("public/icons/pockelog-192.png", 192),
  renderPng("public/icons/pockelog-512.png", 512),
  renderPng("public/icons/pockelog-maskable-192.png", 192, true),
  renderPng("public/icons/pockelog-maskable-512.png", 512, true),
  renderPng("src/app/apple-icon.png", 180),
]);

const faviconPng = await sharp(iconSvg(32)).png().toBuffer();
await writeFile(
  resolve(root, "src/app/favicon.ico"),
  icoFromPng(faviconPng),
);
