import sharp from 'sharp'
import { readFileSync } from 'fs'
import { writeFile } from 'fs/promises'

const input = readFileSync('public/images/logo.png')

const { data, info } = await sharp(input)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })

const pixels = new Uint8ClampedArray(data.buffer)

for (let i = 0; i < pixels.length; i += 4) {
  const r = pixels[i]
  const g = pixels[i + 1]
  const b = pixels[i + 2]
  if (r < 40 && g < 40 && b < 40) {
    pixels[i + 3] = 0
  }
}

await sharp(pixels, {
  raw: {
    width: info.width,
    height: info.height,
    channels: 4,
  }
})
  .png()
  .toFile('public/images/logo-transparent.png')

console.log('✓ Saved to public/images/logo-transparent.png')
