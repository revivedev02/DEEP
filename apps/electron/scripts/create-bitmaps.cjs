#!/usr/bin/env node
/**
 * create-bitmaps.cjs
 *
 * Generates NSIS installer BMP files programmatically from hex color values.
 * These are pure solid-color / gradient rectangles — NOT artwork/images.
 *
 * Outputs:
 *   installer/header.bmp   150×57   (top header bar of the installer)
 *   installer/sidebar.bmp  164×314  (left sidebar of the installer wizard)
 *
 * Run: node scripts/create-bitmaps.cjs
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ── Color palette (Ember theme) ───────────────────────────────────────────────
const COLORS = {
  canvasTop:    [0x1c, 0x1a, 0x17],   // #1C1A17 — espresso (top of header)
  canvasBottom: [0x12, 0x11, 0x10],   // #121110 — near-black (bottom)
  sidebar:      [0x12, 0x11, 0x10],   // #121110 — uniform
  accentR: 0xd2, accentG: 0x78, accentB: 0x38,  // #D27838 amber  (unused here)
};

/**
 * Generates an uncompressed 24-bit BMP buffer.
 * pixelFn(x, y) → [r, g, b]
 */
function makeBMP(width, height, pixelFn) {
  const rowStride = Math.ceil((width * 3) / 4) * 4;   // rows padded to 4 bytes
  const pixelDataSize = rowStride * height;
  const fileSize      = 54 + pixelDataSize;

  const buf = Buffer.alloc(fileSize, 0);

  // ── File header (14 bytes) ──────────────────────────────────────────────
  buf.write('BM', 0, 'ascii');
  buf.writeUInt32LE(fileSize, 2);
  buf.writeUInt32LE(0, 6);           // reserved
  buf.writeUInt32LE(54, 10);          // pixel data offset

  // ── DIB header / BITMAPINFOHEADER (40 bytes) ────────────────────────────
  buf.writeUInt32LE(40,      14);   // header size
  buf.writeInt32LE(width,    18);
  buf.writeInt32LE(-height,  22);   // negative → top-down (row 0 = top)
  buf.writeUInt16LE(1,       26);   // color planes
  buf.writeUInt16LE(24,      28);   // bits per pixel (24 = RGB, no alpha)
  buf.writeUInt32LE(0,       30);   // BI_RGB (no compression)
  buf.writeUInt32LE(pixelDataSize, 34);
  buf.writeInt32LE(2835,     38);   // x pixels/meter (~72 DPI)
  buf.writeInt32LE(2835,     42);   // y pixels/meter

  // ── Pixel data (BGR order) ───────────────────────────────────────────────
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixelFn(x, y);
      const offset    = 54 + y * rowStride + x * 3;
      buf[offset]     = b;  // BMP is BGR
      buf[offset + 1] = g;
      buf[offset + 2] = r;
    }
  }

  return buf;
}

/** Linear interpolation between two values */
function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

// ── Header BMP: 150×57 ────────────────────────────────────────────────────────
// Vertical gradient: espresso (#1C1A17) → near-black (#121110)
// Plus a 2px amber accent line at the bottom
const headerBuf = makeBMP(150, 57, (x, y) => {
  if (y >= 55) {
    // Amber accent strip at the very bottom (2px)
    return [COLORS.accentR, COLORS.accentG, COLORS.accentB];
  }
  const t = y / 54;  // 0.0 at top → 1.0 at bottom
  return [
    lerp(COLORS.canvasTop[0], COLORS.canvasBottom[0], t),
    lerp(COLORS.canvasTop[1], COLORS.canvasBottom[1], t),
    lerp(COLORS.canvasTop[2], COLORS.canvasBottom[2], t),
  ];
});

// ── Sidebar BMP: 164×314 ─────────────────────────────────────────────────────
// Solid dark + subtle horizontal amber rule at the top (2px)
const sidebarBuf = makeBMP(164, 314, (x, y) => {
  if (y < 2) {
    // Amber rule at top to match header accent
    return [COLORS.accentR, COLORS.accentG, COLORS.accentB];
  }
  if (x >= 162) {
    // 2px right separator — slightly lighter
    return [0x2a, 0x26, 0x22];
  }
  return COLORS.sidebar;
});

// ── Write files ───────────────────────────────────────────────────────────────
const outDir = path.join(__dirname, '..', 'installer');
fs.mkdirSync(outDir, { recursive: true });

fs.writeFileSync(path.join(outDir, 'header.bmp'),  headerBuf);
fs.writeFileSync(path.join(outDir, 'sidebar.bmp'), sidebarBuf);

console.log('[prebuild] Created installer/header.bmp  (150×57)');
console.log('[prebuild] Created installer/sidebar.bmp (164×314)');
