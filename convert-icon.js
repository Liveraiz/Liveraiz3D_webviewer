#!/usr/bin/env node

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function convertSvgToPng() {
  try {
    const svgPath = path.join(__dirname, 'public', 'icon.svg');
    const iconDir = path.join(__dirname, 'public', 'icon');
    const pngPath = path.join(iconDir, 'app.png');

    // Create icon directory if it doesn't exist
    if (!fs.existsSync(iconDir)) {
      fs.mkdirSync(iconDir, { recursive: true });
    }

    // Read SVG file
    if (!fs.existsSync(svgPath)) {
      console.error(`SVG file not found: ${svgPath}`);
      process.exit(1);
    }

    console.log('Converting SVG to PNG (256x256)...');

    // Convert SVG to PNG
    await sharp(svgPath)
      .png()
      .resize(256, 256, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      })
      .toFile(pngPath);

    console.log('✓ PNG created at:', pngPath);
    console.log('✓ electron-builder will automatically convert this to .ico format');

  } catch (error) {
    console.error('Error converting icon:', error.message);
    process.exit(1);
  }
}

convertSvgToPng();
