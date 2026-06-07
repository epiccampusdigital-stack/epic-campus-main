// Generates public/og-image.png — 1200x630, navy background, white+gold text
import sharp from 'sharp'
import { writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outPath = resolve(__dirname, '../public/og-image.png')

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0B3D6B"/>
      <stop offset="100%" stop-color="#0a3460"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)"/>

  <!-- Decorative circles -->
  <circle cx="1050" cy="100" r="200" fill="#ffffff" fill-opacity="0.04"/>
  <circle cx="150" cy="530" r="160" fill="#ffffff" fill-opacity="0.04"/>
  <circle cx="1100" cy="550" r="120" fill="#E8A020" fill-opacity="0.08"/>

  <!-- Gold accent bar -->
  <rect x="80" y="265" width="6" height="100" rx="3" fill="#E8A020"/>

  <!-- Main logo text -->
  <text
    x="110"
    y="320"
    font-family="Arial, Helvetica, sans-serif"
    font-size="88"
    font-weight="bold"
    fill="#ffffff"
    letter-spacing="-2"
  >EPIC Campus</text>

  <!-- Tagline -->
  <text
    x="112"
    y="375"
    font-family="Arial, Helvetica, sans-serif"
    font-size="38"
    font-weight="400"
    fill="#E8A020"
    letter-spacing="1"
  >We Create Your Future</text>

  <!-- Sub-description -->
  <text
    x="112"
    y="435"
    font-family="Arial, Helvetica, sans-serif"
    font-size="26"
    fill="#ffffff"
    fill-opacity="0.65"
    letter-spacing="0.5"
  >Sri Lanka's gateway to Japan · Korea · China · Global Careers</text>

  <!-- Divider -->
  <line x1="80" y1="490" x2="400" y2="490" stroke="#E8A020" stroke-width="1.5" stroke-opacity="0.5"/>

  <!-- URL -->
  <text
    x="112"
    y="530"
    font-family="Arial, Helvetica, sans-serif"
    font-size="24"
    fill="#ffffff"
    fill-opacity="0.5"
    letter-spacing="0.5"
  >epiccampus.live</text>

  <!-- Emoji-style flag strip -->
  <text x="750" y="350" font-size="72" text-anchor="middle" fill="white" fill-opacity="0.85">🇯🇵 🇰🇷 🇨🇳</text>
</svg>`

try {
  await sharp(Buffer.from(svg))
    .resize(1200, 630)
    .png({ quality: 95, compressionLevel: 8 })
    .toFile(outPath)

  console.log(`✅ og-image.png generated at ${outPath} (1200x630)`)
} catch (err) {
  console.error('❌ Failed to generate og-image:', err.message)
  // Fallback: write a minimal valid PNG placeholder via sharp
  try {
    await sharp({
      create: {
        width: 1200,
        height: 630,
        channels: 3,
        background: { r: 11, g: 61, b: 107 },
      },
    })
      .png()
      .toFile(outPath)
    console.log('✅ Fallback solid-color og-image.png written (1200x630)')
  } catch (err2) {
    console.error('❌ Fallback also failed:', err2.message)
    process.exit(1)
  }
}
