const sharp = require('sharp');
const toIco = require('to-ico');
const https = require('https');
const fs = require('fs');
const path = require('path');

const SVG_URL = 'https://github.com/pfuni/main/raw/refs/heads/main/shlogo.svg';
const BUILD_DIR = path.join(__dirname, '..', 'build');
const TEMP_SVG = path.join(BUILD_DIR, 'temp-logo.svg');

// Download file helper
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const doRequest = (reqUrl) => {
      https.get(reqUrl, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          doRequest(response.headers.location);
          return;
        }
        const file = fs.createWriteStream(dest);
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      }).on('error', reject);
    };
    doRequest(url);
  });
}

async function generateIcons() {
  console.log('Downloading SVG...');
  await downloadFile(SVG_URL, TEMP_SVG);
  
  console.log('Generating PNG icons...');
  
  // Generate main icon (512x512 for best quality)
  await sharp(TEMP_SVG)
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(BUILD_DIR, 'icon.png'));
  console.log('Created icon.png (512x512)');
  
  // Generate various sizes for ICO as buffers
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const pngBuffers = [];
  
  for (const size of sizes) {
    const buffer = await sharp(TEMP_SVG)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    pngBuffers.push(buffer);
    console.log(`Generated ${size}x${size} PNG buffer`);
  }
  
  // Create ICO file
  console.log('Creating ICO file...');
  const icoBuffer = await toIco(pngBuffers);
  fs.writeFileSync(path.join(BUILD_DIR, 'icon.ico'), icoBuffer);
  console.log('Created icon.ico');
  
  // Generate DMG icon (for macOS)
  await sharp(TEMP_SVG)
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(BUILD_DIR, 'dmg-icon.png'));
  console.log('Created dmg-icon.png');
  
  // Clean up temp file
  fs.unlinkSync(TEMP_SVG);
  
  console.log('\nIcon generation complete!');
  console.log('Note: For macOS .icns files, you may need to use iconutil on macOS or an online converter.');
}

generateIcons().catch(console.error);
