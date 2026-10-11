import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

// Minimal PNG encoder in pure Node.js
function createPNG(width, height, r, g, b) {
  // RGBA buffer with filter byte 0 at start of each scanline
  const scanlineLength = width * 4 + 1;
  const rawData = Buffer.alloc(scanlineLength * height);

  for (let y = 0; y < height; y++) {
    const lineOffset = y * scanlineLength;
    rawData[lineOffset] = 0; // Filter: None

    for (let x = 0; x < width; x++) {
      const pixelOffset = lineOffset + 1 + x * 4;

      // Draw rounded blue badge with white emblem
      const cx = width / 2;
      const cy = height / 2;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Gradient background in blue
      const gradFactor = (y / height);
      let curR = Math.round(r * (1 - gradFactor * 0.3));
      let curG = Math.round(g * (1 - gradFactor * 0.2));
      let curB = Math.round(b);

      // Inner white delivery bag shape simulation
      const inBag = (Math.abs(dx) < width * 0.25 && Math.abs(dy) < height * 0.22 && dy > -height * 0.1);
      const inHandle = (Math.abs(dx) < width * 0.14 && dy >= -height * 0.28 && dy <= -height * 0.1 && (Math.abs(dx) > width * 0.08 || dy < -height * 0.22));

      if (inBag || inHandle) {
        rawData[pixelOffset] = 255;
        rawData[pixelOffset + 1] = 255;
        rawData[pixelOffset + 2] = 255;
        rawData[pixelOffset + 3] = 255;
      } else {
        rawData[pixelOffset] = curR;
        rawData[pixelOffset + 1] = curG;
        rawData[pixelOffset + 2] = curB;
        rawData[pixelOffset + 3] = 255;
      }
    }
  }

  const compressed = zlib.deflateSync(rawData);

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR Chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const ihdrChunk = makeChunk('IHDR', ihdr);

  // IDAT Chunk
  const idatChunk = makeChunk('IDAT', compressed);

  // IEND Chunk
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c ^= buf[n];
    for (let k = 0; k < 8; k++) {
      c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(4 + 4 + len + 4);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);

  const crcData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = crc32(crcData);
  chunk.writeUInt32BE(crc, 8 + len);
  return chunk;
}

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Write icons
const blueR = 37, blueG = 99, blueB = 235; // #2563eb
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), createPNG(192, 192, blueR, blueG, blueB));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), createPNG(512, 512, blueR, blueG, blueB));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), createPNG(512, 512, blueR, blueG, blueB));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), createPNG(180, 180, blueR, blueG, blueB));
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), createPNG(64, 64, blueR, blueG, blueB));

console.log('PWA PNG icons generated successfully!');
