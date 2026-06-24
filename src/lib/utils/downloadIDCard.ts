export async function downloadIDCard(
  elementId: string,
  studentName: string,
): Promise<void> {
  const element = document.getElementById(elementId)
  if (!element) return

  const svg = element.querySelector('svg')
  if (!svg) return

  const serializer = new XMLSerializer()
  const svgStr = serializer.serializeToString(svg)

  const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const img = new Image()
  img.onload = () => {
    const canvas = document.createElement('canvas')
    const scale = 3
    canvas.width = svg.width.baseVal.value * scale
    canvas.height = svg.height.baseVal.value * scale
    const ctx = canvas.getContext('2d')!
    ctx.scale(scale, scale)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0)
    URL.revokeObjectURL(url)

    const link = document.createElement('a')
    link.download = `EpicCampus-ID-${studentName.replace(/\s+/g, '-')}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }
  img.crossOrigin = 'anonymous'
  img.src = url
}
