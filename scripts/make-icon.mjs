// Generates icon.png (128x128): a monochrome "C" ring on a dark rounded square. No dependencies.
import fs from "node:fs";
import zlib from "node:zlib";

const S = 128, SS = 4;
const BG = [29, 33, 43], FG = [226, 232, 240], ACCENT = [122, 138, 160];
const cx = 64, cy = 64, R = 31, W = 13, GAP = (42 * Math.PI) / 180;

function sdfRoundRect(x, y, r) {
  const hx = S / 2 - 6, hy = S / 2 - 6;
  const qx = Math.abs(x - S / 2) - (hx - r), qy = Math.abs(y - S / 2) - (hy - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}
function inC(x, y) {
  const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy);
  const ang = Math.atan2(dy, dx);
  const ring = Math.abs(d - R) <= W / 2;
  if (ring && Math.abs(ang) > GAP) return true;
  // rounded terminals
  for (const s of [-1, 1]) {
    const a = s * GAP;
    const ex = cx + R * Math.cos(a), ey = cy + R * Math.sin(a);
    if (Math.hypot(x - ex, y - ey) <= W / 2) return true;
  }
  return false;
}
const raw = Buffer.alloc((S * 4 + 1) * S);
for (let y = 0; y < S; y++) {
  raw[y * (S * 4 + 1)] = 0;
  for (let x = 0; x < S; x++) {
    let cov = 0, ccov = 0, acov = 0;
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      const px = x + (sx + 0.5) / SS, py = y + (sy + 0.5) / SS;
      if (sdfRoundRect(px, py, 22) <= 0) {
        cov++;
        if (inC(px, py)) ccov++;
        // thin baseline accent bar under the C
        else if (py > 104 && py < 108 && px > 40 && px < 88) acov++;
      }
    }
    const n = SS * SS, a = cov / n;
    const cf = ccov / n, af = acov / n, bf = Math.max(0, 1 - cf - af);
    const o = y * (S * 4 + 1) + 1 + x * 4;
    for (let k = 0; k < 3; k++) {
      const v = cov ? (BG[k] * bf + FG[k] * cf + ACCENT[k] * af) / Math.max(bf + cf + af, 1e-6) : 0;
      raw[o + k] = Math.round(v);
    }
    raw[o + 3] = Math.round(a * 255);
  }
}
const crcTable = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc = (buf) => { let c = -1; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
};
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4); ihdr[8] = 8; ihdr[9] = 6;
fs.writeFileSync(new URL("../icon.png", import.meta.url), Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0)),
]));
console.log("icon.png written");
