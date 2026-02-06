const sharp = require('sharp');
const path = require('path');

const createIcon = async (size) => {
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#000000"/>
      <circle cx="${size/2}" cy="${size/2}" r="${size * 0.4}" fill="#D4FF00"/>
      <text x="${size/2}" y="${size/2 + size*0.12}"
            font-family="Arial, sans-serif"
            font-size="${size * 0.35}"
            font-weight="bold"
            fill="#000000"
            text-anchor="middle">SF</text>
    </svg>
  `;

  const outputPath = path.join(__dirname, '..', 'public', `icon-${size}x${size}.png`);

  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(outputPath);

  console.log(`Created icon-${size}x${size}.png`);
};

Promise.all([
  createIcon(192),
  createIcon(512)
]).then(() => {
  console.log('Done! Icons created successfully.');
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
