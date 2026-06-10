/**
 * generate-icons.js — Generates Shule PWA icons (no npm deps, pure Node.js)
 * Run: node generate-icons.js
 * Outputs: public/icon-192.png, public/icon-512.png, public/apple-touch-icon.png
 */
const zlib = require('zlib')
const fs   = require('fs')
const path = require('path')

// ── CRC32 ──────────────────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    t[i] = c
  }
  return t
})()
function crc32(buf) {
  let c = 0xFFFFFFFF
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xFF] ^ (c >>> 8)
  return (c ^ 0xFFFFFFFF) >>> 0
}

// ── PNG chunk ──────────────────────────────────────────────────────────────────
function chunk(type, data) {
  const t   = Buffer.from(type, 'ascii')
  const len = Buffer.allocUnsafe(4)
  const crc = Buffer.allocUnsafe(4)
  len.writeUInt32BE(data.length, 0)
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0)
  return Buffer.concat([len, t, data, crc])
}

// ── Pixel canvas ───────────────────────────────────────────────────────────────
function makeCanvas(size) {
  const buf = Buffer.alloc(size * size * 4, 0)
  const set = (x, y, r, g, b, a = 255) => {
    x = Math.round(x); y = Math.round(y)
    if (x < 0 || y < 0 || x >= size || y >= size) return
    const i = (y * size + x) * 4
    buf[i] = r; buf[i+1] = g; buf[i+2] = b; buf[i+3] = a
  }
  const get = (x, y) => {
    x = Math.round(x); y = Math.round(y)
    if (x < 0 || y < 0 || x >= size || y >= size) return [0,0,0,0]
    const i = (y * size + x) * 4
    return [buf[i], buf[i+1], buf[i+2], buf[i+3]]
  }
  return { buf, set, get, size }
}

// ── Draw helpers ───────────────────────────────────────────────────────────────
function fillRect(cv, x, y, w, h, r, g, b, a = 255) {
  for (let dy = 0; dy < h; dy++)
    for (let dx = 0; dx < w; dx++)
      cv.set(Math.floor(x + dx), Math.floor(y + dy), r, g, b, a)
}

function fillCircle(cv, cx, cy, radius, r, g, b, a = 255) {
  const r2 = radius * radius
  for (let dy = -radius; dy <= radius; dy++)
    for (let dx = -radius; dx <= radius; dx++)
      if (dx*dx + dy*dy <= r2)
        cv.set(Math.round(cx + dx), Math.round(cy + dy), r, g, b, a)
}

function fillDiamond(cv, cx, cy, hw, hh, r, g, b, a = 255) {
  for (let dy = -hh; dy <= hh; dy++) {
    const rowHW = hw * (1 - Math.abs(dy) / hh)
    for (let dx = -rowHW; dx <= rowHW; dx++)
      cv.set(Math.round(cx + dx), Math.round(cy + dy), r, g, b, a)
  }
}

// Anti-alias helper — draws a thick line
function fillLine(cv, x1, y1, x2, y2, thick, r, g, b, a = 255) {
  const dx = x2 - x1, dy = y2 - y1
  const len = Math.sqrt(dx*dx + dy*dy)
  if (len === 0) return
  const steps = Math.ceil(len * 2)
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const cx = x1 + dx * t, cy = y1 + dy * t
    fillCircle(cv, cx, cy, thick, r, g, b, a)
  }
}

// ── Round corners (mask outside the rounded rect to transparent) ───────────────
function applyRoundedMask(cv, radius) {
  const s = cv.size
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      let masked = false
      // top-left
      if (x < radius && y < radius) {
        const dx = radius - x - 0.5, dy = radius - y - 0.5
        if (dx*dx + dy*dy > radius*radius) masked = true
      }
      // top-right
      else if (x >= s - radius && y < radius) {
        const dx = x - (s - radius) + 0.5, dy = radius - y - 0.5
        if (dx*dx + dy*dy > radius*radius) masked = true
      }
      // bottom-left
      else if (x < radius && y >= s - radius) {
        const dx = radius - x - 0.5, dy = y - (s - radius) + 0.5
        if (dx*dx + dy*dy > radius*radius) masked = true
      }
      // bottom-right
      else if (x >= s - radius && y >= s - radius) {
        const dx = x - (s - radius) + 0.5, dy = y - (s - radius) + 0.5
        if (dx*dx + dy*dy > radius*radius) masked = true
      }
      if (masked) cv.set(x, y, 0, 0, 0, 0)
    }
  }
}

// ── Draw Shule icon (mortarboard on teal) ──────────────────────────────────────
function drawShuleIcon(size) {
  const cv = makeCanvas(size)
  const s  = size
  const cx = s / 2
  const cy = s / 2

  // Background: teal #0d9488
  fillRect(cv, 0, 0, s, s, 13, 148, 136)

  const W = [255, 255, 255]  // white

  // Scale constants to size
  const u = s / 100  // unit scale

  // ── Mortarboard flat board (diamond / rotated square) ─────────────────────
  const boardCX = cx
  const boardCY = cy - 5 * u
  const boardHW = 32 * u
  const boardHH = 13 * u
  fillDiamond(cv, boardCX, boardCY, boardHW, boardHH, ...W)

  // ── Cap body (rounded rectangle below diamond center) ─────────────────────
  const capW  = 20 * u
  const capH  = 17 * u
  const capX  = cx - capW / 2
  const capY  = boardCY + boardHH * 0.5 - 1 * u
  fillRect(cv, capX, capY, capW, capH, ...W)
  // round top corners of cap body
  fillCircle(cv, capX + 2*u, capY + 2*u, 2*u, ...W)
  fillCircle(cv, capX + capW - 2*u, capY + 2*u, 2*u, ...W)

  // ── Tassel string (from right point of diamond downward) ──────────────────
  const tasselBaseX = boardCX + boardHW - 2 * u
  const tasselBaseY = boardCY
  const tasselEndY  = tasselBaseY + 20 * u
  fillLine(cv, tasselBaseX, tasselBaseY, tasselBaseX, tasselEndY, 1.2 * u, ...W)

  // ── Tassel ball ───────────────────────────────────────────────────────────
  fillCircle(cv, tasselBaseX, tasselEndY + 3 * u, 3.5 * u, ...W)

  // ── Cap baseline ridge (thin line under the cap body) ─────────────────────
  fillLine(cv, capX - 2*u, capY + capH, capX + capW + 2*u, capY + capH, 1*u, ...W)

  // Rounded corners (20% radius = superellipse-like)
  applyRoundedMask(cv, s * 0.22)

  return cv.buf
}

// ── Build PNG from pixel buffer ────────────────────────────────────────────────
function buildPNG(size, pixelBuf) {
  const rowLen = size * 4
  const rows   = []
  for (let y = 0; y < size; y++) {
    const row = Buffer.allocUnsafe(rowLen + 1)
    row[0] = 0  // filter: None
    pixelBuf.copy(row, 1, y * rowLen, (y + 1) * rowLen)
    rows.push(row)
  }
  const raw = Buffer.concat(rows)

  const ihdr = Buffer.allocUnsafe(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 6   // 8-bit RGBA
  ihdr[10] = ihdr[11] = ihdr[12] = 0

  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),  // PNG signature
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ── Generate & write ───────────────────────────────────────────────────────────
const outDir = path.join(__dirname, 'public')

for (const size of [192, 512, 180]) {
  const pixels  = drawShuleIcon(size)
  const png     = buildPNG(size, pixels)
  const name    = size === 180 ? 'apple-touch-icon.png' : `icon-${size}.png`
  fs.writeFileSync(path.join(outDir, name), png)
  console.log(`✓ public/${name}  (${(png.length / 1024).toFixed(1)} KB)`)
}

console.log('\nDone. Run `npm run build` for production, or restart dev server.')
