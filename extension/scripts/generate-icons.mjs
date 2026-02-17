/**
 * Generate placeholder PNG icons for the Chrome extension.
 * Creates simple colored squares with a "T" letter in the center.
 * Uses raw PNG encoding (no external dependencies).
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import zlib from 'zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, '..', 'public');

// Ensure public directory exists
mkdirSync(PUBLIC_DIR, { recursive: true });

const SIZES = [16, 32, 48, 128];

// Brand color: a nice blue matching the extension theme
const BG_R = 59, BG_G = 130, BG_B = 246; // #3B82F6 (blue-500)
const FG_R = 255, FG_G = 255, FG_B = 255; // white

function createPNG(size) {
  const width = size;
  const height = size;

  // Create raw pixel data (RGBA) with filter byte per row
  const rawData = Buffer.alloc((width * 4 + 1) * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * (width * 4 + 1);
    rawData[rowOffset] = 0; // filter: none

    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;

      // Determine if this pixel is part of the "T" letter
      const isT = isTLetter(x, y, width, height);

      // Add rounded corner check
      const cornerRadius = Math.max(2, Math.floor(size / 8));
      const isInRoundedRect = isInsideRoundedRect(x, y, width, height, cornerRadius);

      if (!isInRoundedRect) {
        // Transparent outside rounded rect
        rawData[pixelOffset] = 0;
        rawData[pixelOffset + 1] = 0;
        rawData[pixelOffset + 2] = 0;
        rawData[pixelOffset + 3] = 0;
      } else if (isT) {
        rawData[pixelOffset] = FG_R;
        rawData[pixelOffset + 1] = FG_G;
        rawData[pixelOffset + 2] = FG_B;
        rawData[pixelOffset + 3] = 255;
      } else {
        rawData[pixelOffset] = BG_R;
        rawData[pixelOffset + 1] = BG_G;
        rawData[pixelOffset + 2] = BG_B;
        rawData[pixelOffset + 3] = 255;
      }
    }
  }

  // Compress the raw data
  const compressed = zlib.deflateSync(rawData);

  // Build PNG file
  const chunks = [];

  // PNG signature
  chunks.push(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  chunks.push(createChunk('IHDR', ihdr));

  // IDAT chunk
  chunks.push(createChunk('IDAT', compressed));

  // IEND chunk
  chunks.push(createChunk('IEND', Buffer.alloc(0)));

  return Buffer.concat(chunks);
}

function isTLetter(x, y, w, h) {
  // Define T proportions relative to the icon size
  const margin = Math.max(2, Math.floor(w * 0.2));
  const barHeight = Math.max(2, Math.floor(h * 0.15));
  const stemWidth = Math.max(2, Math.floor(w * 0.22));

  const left = margin;
  const right = w - margin;
  const top = margin;
  const bottom = h - margin;

  const stemLeft = Math.floor((w - stemWidth) / 2);
  const stemRight = stemLeft + stemWidth;

  // Top horizontal bar of T
  if (y >= top && y < top + barHeight && x >= left && x < right) {
    return true;
  }

  // Vertical stem of T
  if (y >= top + barHeight && y < bottom && x >= stemLeft && x < stemRight) {
    return true;
  }

  return false;
}

function isInsideRoundedRect(x, y, w, h, r) {
  // Check if point is inside a rounded rectangle
  if (x < r && y < r) {
    return (x - r) ** 2 + (y - r) ** 2 <= r ** 2;
  }
  if (x >= w - r && y < r) {
    return (x - (w - r - 1)) ** 2 + (y - r) ** 2 <= r ** 2;
  }
  if (x < r && y >= h - r) {
    return (x - r) ** 2 + (y - (h - r - 1)) ** 2 <= r ** 2;
  }
  if (x >= w - r && y >= h - r) {
    return (x - (w - r - 1)) ** 2 + (y - (h - r - 1)) ** 2 <= r ** 2;
  }
  return true;
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuffer = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBuffer, data]);

  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcData), 0);

  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buf) {
  // CRC32 lookup table
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }

  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// Generate all icon sizes
for (const size of SIZES) {
  const png = createPNG(size);
  const filePath = join(PUBLIC_DIR, `icon-${size}.png`);
  writeFileSync(filePath, png);
  console.log(`Generated ${filePath} (${png.length} bytes)`);
}

console.log('\nAll icons generated successfully!');
