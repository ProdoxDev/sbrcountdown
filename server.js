const express = require('express');
const path = require('path');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { GifWriter } = require('omggif');

const app = express();
const PORT = process.env.PORT || 3000;

let bgImage = null;

async function init() {
  try {
    bgImage = await loadImage(path.join(__dirname, 'bg.png'));
    console.log('Background image loaded successfully.');
  } catch (err) {
    console.warn('Could not load bg.png, using solid fallback color.', err.message);
  }
}

// Convert RGBA buffer to 256-color indexed palette
function rgbaToIndexed(rgbaBuffer, width, height) {
  const palette = [];
  const paletteMap = new Map();
  const indexedPixels = new Uint8Array(width * height);

  for (let i = 0; i < rgbaBuffer.length; i += 4) {
    const r = rgbaBuffer[i];
    const g = rgbaBuffer[i + 1];
    const b = rgbaBuffer[i + 2];
    
    // Color quantization step to ensure <= 256 unique colors
    const qr = Math.floor(r / 32) * 32;
    const qg = Math.floor(g / 32) * 32;
    const qb = Math.floor(b / 32) * 32;

    const rgbHex = (qr << 16) | (qg << 8) | qb;
    let paletteIndex = paletteMap.get(rgbHex);

    if (paletteIndex === undefined) {
      if (palette.length < 256) {
        paletteIndex = palette.length;
        palette.push(rgbHex);
        paletteMap.set(rgbHex, paletteIndex);
      } else {
        paletteIndex = 0;
      }
    }
    indexedPixels[i / 4] = paletteIndex;
  }

  // Ensure power-of-two palette size
  while (palette.length < 2 || (palette.length & (palette.length - 1)) !== 0) {
    palette.push(0);
  }

  return { palette, indexedPixels };
}

app.get('/prodox.gif', async (req, res) => {
  try {
    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // 1280x720 HD Dimensions
    const width = 1280;
    const height = 720;
    const targetDate = new Date('2026-09-25T07:00:00Z').getTime();

    // Allocated larger memory buffer for 720p frames
    const buf = Buffer.alloc(width * height * 10 + 1024 * 1024);
    const gifWriter = new GifWriter(buf, width, height, { loop: 0 });

    for (let i = 0; i < 10; i++) {
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext('2d');

      const now = Date.now() + (i * 1000);
      const diff = Math.max(0, targetDate - now);

      const days = String(Math.floor(diff / (1000 * 60 * 60 * 24))).padStart(2, '0');
      const hours = String(Math.floor((diff / (1000 * 60 * 60)) % 24)).padStart(2, '0');
      const mins = String(Math.floor((diff / 1000 / 60) % 60)).padStart(2, '0');
      const secs = String(Math.floor((diff / 1000) % 60)).padStart(2, '0');

      // Draw 1280x720 Background
      if (bgImage) {
        ctx.drawImage(bgImage, 0, 0, width, height);
      } else {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, width, height);
      }

      // Draw Scaled Text Overlay
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 80px sans-serif'; // Scaled font for 720p
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 12;
      ctx.fillText(`${days}d ${hours}:${mins}:${secs}`, width / 2, height / 2);

      const imgData = ctx.getImageData(0, 0, width, height);
      const { palette, indexedPixels } = rgbaToIndexed(imgData.data, width, height);

      gifWriter.addFrame(0, 0, width, height, indexedPixels, {
        palette: palette,
        delay: 100
      });
    }

    const gifBuffer = buf.slice(0, gifWriter.end());
    res.send(gifBuffer);
  } catch (err) {
    console.error('Error generating GIF:', err);
    res.status(500).send('Internal Server Error');
  }
});

init().then(() => {
  app.listen(PORT, () => {
    console.log(`GIF Server running on port ${PORT}`);
  });
});