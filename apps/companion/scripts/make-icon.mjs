// Draws the source icon (a four-point star on black) as a PNG, with no image dependencies.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const SIZE = 1024;
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const head = Buffer.alloc(4);
  head.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc(body));
  return Buffer.concat([head, body, tail]);
};

const raw = Buffer.alloc((SIZE * 4 + 1) * SIZE);
for (let y = 0; y < SIZE; y++) {
  raw[y * (SIZE * 4 + 1)] = 0;
  for (let x = 0; x < SIZE; x++) {
    const nx = Math.abs(x - SIZE / 2) / (SIZE / 2);
    const ny = Math.abs(y - SIZE / 2) / (SIZE / 2);
    const star = Math.sqrt(nx) + Math.sqrt(ny) < 1.08;
    const corner = Math.hypot(Math.max(0, nx - 0.78), Math.max(0, ny - 0.78)) > 0.22;
    const offset = y * (SIZE * 4 + 1) + 1 + x * 4;
    const t = x / SIZE;
    raw[offset] = star ? 139 + 100 * t : 10;
    raw[offset + 1] = star ? 92 - 20 * t : 10;
    raw[offset + 2] = star ? 246 - 90 * t : 14;
    raw[offset + 3] = corner ? 0 : 255;
  }
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8;
ihdr[9] = 6;
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw)),
  chunk("IEND", Buffer.alloc(0)),
]);
writeFileSync(join(dirname(fileURLToPath(import.meta.url)), "icon-source.png"), png);
