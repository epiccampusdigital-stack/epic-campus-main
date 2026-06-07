// Generates public/favicon.png (32x32 PNG) and public/favicon.ico (ICO with embedded PNG)
import sharp from 'sharp'
import { writeFileSync, readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const logoPath = resolve(__dirname, '../public/images/logo.png')
const faviconPngPath = resolve(__dirname, '../public/favicon.png')
const faviconIcoPath = resolve(__dirname, '../public/favicon.ico')

// --- Generate favicon.png (32x32 + 180x180 stored as single 180x180 PNG) ---
const png180 = await sharp(logoPath)
  .resize(180, 180, { fit: 'contain', background: { r: 11, g: 61, b: 107, alpha: 1 } })
  .png()
  .toBuffer()

writeFileSync(faviconPngPath, png180)
console.log('✅ favicon.png written (180x180 PNG)')

// --- Generate favicon.ico with embedded 32x32 and 16x16 PNG images ---
async function makePngBuf(size) {
  return sharp(logoPath)
    .resize(size, size, { fit: 'contain', background: { r: 11, g: 61, b: 107, alpha: 1 } })
    .png()
    .toBuffer()
}

const png32 = await makePngBuf(32)
const png16 = await makePngBuf(16)

function writeIco(images) {
  // ICO header: 6 bytes
  // For each image: ICONDIRENTRY 16 bytes
  // Then image data
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)          // reserved
  header.writeUInt16LE(1, 2)          // type: 1 = ICO
  header.writeUInt16LE(images.length, 4) // count

  const entrySize = 16
  const dataOffset = 6 + images.length * entrySize

  const entries = []
  const dataChunks = []
  let offset = dataOffset

  for (const { size, buf } of images) {
    const entry = Buffer.alloc(entrySize)
    entry.writeUInt8(size === 256 ? 0 : size, 0)  // width (0 = 256)
    entry.writeUInt8(size === 256 ? 0 : size, 1)  // height
    entry.writeUInt8(0, 2)                         // color count (0 = no palette)
    entry.writeUInt8(0, 3)                         // reserved
    entry.writeUInt16LE(1, 4)                      // color planes
    entry.writeUInt16LE(32, 6)                     // bits per pixel
    entry.writeUInt32LE(buf.length, 8)             // size of image data
    entry.writeUInt32LE(offset, 12)                // offset to image data
    entries.push(entry)
    dataChunks.push(buf)
    offset += buf.length
  }

  return Buffer.concat([header, ...entries, ...dataChunks])
}

const icoBuffer = writeIco([
  { size: 32, buf: png32 },
  { size: 16, buf: png16 },
])

writeFileSync(faviconIcoPath, icoBuffer)
console.log(`✅ favicon.ico written (${icoBuffer.length} bytes, 2 sizes: 32x32 + 16x16)`)

// Verify
const magic = readFileSync(faviconIcoPath).slice(0, 4)
console.log('   ICO magic bytes:', magic.toString('hex'), '(expected: 00000100)')
