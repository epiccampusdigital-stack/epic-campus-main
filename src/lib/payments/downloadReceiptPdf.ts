'use client'

/** Client-only PDF export — lazy-loads heavy deps on demand */
export async function downloadReceiptPdf(
  element: HTMLElement,
  filename: string,
): Promise<void> {
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ])

  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: '#ffffff',
  })
  const imgData = canvas.toDataURL('image/png')
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a5' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const imgWidth = pageWidth - 20
  const imgHeight = (canvas.height * imgWidth) / canvas.width
  pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, Math.min(imgHeight, pageHeight - 20))
  pdf.save(filename)
}
