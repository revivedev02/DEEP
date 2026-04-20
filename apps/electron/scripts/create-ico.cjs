#!/usr/bin/env node
/**
 * create-ico.cjs
 *
 * Creates a valid .ico file (with embedded PNG) from icon.png.
 * Windows Vista+ supports PNG inside ICO — works perfectly on Win10/11.
 * No external dependencies required.
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, '..', 'assets');
const pngPath   = path.join(assetsDir, 'icon.png');
const icoPath   = path.join(assetsDir, 'icon.ico');

const pngData = fs.readFileSync(pngPath);

// ICO file layout:
//   6  bytes  ICONDIR   header  (reserved, type=1, count=1)
//  16  bytes  ICONDIRENTRY      (width, height, colors, reserved, planes, bitcount, size, offset)
//   N  bytes  PNG image data

const ICONDIR_SIZE     = 6;
const ICONDIRENTRY_SIZE = 16;
const imageOffset      = ICONDIR_SIZE + ICONDIRENTRY_SIZE;
const totalSize        = imageOffset + pngData.length;

const buf = Buffer.alloc(totalSize, 0);

// ── ICONDIR ────────────────────────────────────────────────────────────────
buf.writeUInt16LE(0, 0);   // reserved, must be 0
buf.writeUInt16LE(1, 2);   // type: 1 = ICO
buf.writeUInt16LE(1, 4);   // image count

// ── ICONDIRENTRY ──────────────────────────────────────────────────────────
buf[6]  = 0;               // width  — 0 = 256
buf[7]  = 0;               // height — 0 = 256
buf[8]  = 0;               // color count (0 = use bitcount)
buf[9]  = 0;               // reserved
buf.writeUInt16LE(1,  10); // planes
buf.writeUInt16LE(32, 12); // bit count (32 bpp)
buf.writeUInt32LE(pngData.length, 14); // image data size in bytes
buf.writeUInt32LE(imageOffset,    18); // offset of image data

// ── PNG image data ─────────────────────────────────────────────────────────
pngData.copy(buf, imageOffset);

fs.writeFileSync(icoPath, buf);
console.log(`[setup] Created assets/icon.ico  (${buf.length} bytes, PNG-in-ICO)`);
