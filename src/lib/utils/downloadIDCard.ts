'use client'

import html2canvas from 'html2canvas'

export async function downloadIDCard(
  elementId: string,
  studentName: string,
): Promise<void> {
  const element = document.getElementById(elementId)
  if (!element) return

  const canvas = await html2canvas(element, {
    scale: 3,
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
  })

  const link = document.createElement('a')
  link.download = `EpicCampus-ID-${studentName.replace(/\s+/g, '-')}.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
}
