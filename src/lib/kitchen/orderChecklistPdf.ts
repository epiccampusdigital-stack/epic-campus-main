'use client'

import { formatQty } from '@/lib/kitchen-utils'
import type { OrderItem } from '@/types/kitchen'

/**
 * Generate and download a printable A4 (landscape) kitchen order checklist PDF.
 * Blank "Supplier" and "Received" columns let staff fill them in by hand when the
 * stock arrives, and a tick box on each row lets them check items off.
 * Lazy-loads jsPDF so it never ships in the initial bundle.
 */
export async function downloadOrderChecklistPdf(
  items: OrderItem[],
  opts?: { campus?: string },
): Promise<void> {
  const { default: jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  const pageWidth = doc.internal.pageSize.getWidth() // ~297mm
  const pageHeight = doc.internal.pageSize.getHeight() // ~210mm
  const margin = 12
  const usableWidth = pageWidth - margin * 2
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const campus = opts?.campus ?? 'Ahangama Main Campus'

  // ── Header ─────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(11, 61, 107)
  doc.text('EPIC Campus — Kitchen Order Checklist', margin, margin + 2)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(90, 106, 122)
  doc.text(`Date: ${dateStr}`, pageWidth - margin, margin + 2, { align: 'right' })
  doc.setTextColor(0, 0, 0)

  // ── Column layout (mm) ─────────────────────────────────────────────────
  const cols = [
    { key: 'check', label: '', w: 12 },
    { key: 'item', label: 'Item', w: 78 },
    { key: 'unit', label: 'Unit', w: 22 },
    { key: 'qty', label: 'Order Qty', w: 28 },
    { key: 'supplier', label: 'Supplier', w: 70 },
    { key: 'received', label: 'Received', w: 0 },
  ]
  const fixedWidth = cols.reduce((s, c) => s + c.w, 0)
  cols[cols.length - 1].w = usableWidth - fixedWidth // "Received" fills remaining width

  const xs: number[] = []
  let x = margin
  for (const c of cols) {
    xs.push(x)
    x += c.w
  }
  const tableRight = margin + usableWidth

  const tableTop = margin + 10
  const headerH = 8
  const rowH = 7.5
  doc.setFontSize(9)

  // ── Header row (navy fill, white text) ─────────────────────────────────
  let y = tableTop
  doc.setFillColor(11, 61, 107)
  doc.rect(margin, y, usableWidth, headerH, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  cols.forEach((c, i) => {
    if (c.label) doc.text(c.label, xs[i] + 2, y + headerH - 2.6)
  })
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'normal')
  y += headerH

  // ── Rows ───────────────────────────────────────────────────────────────
  const boxSize = 4
  items.forEach((item, idx) => {
    if (y + rowH > pageHeight - margin - 6) {
      doc.addPage('a4', 'landscape')
      y = margin
    }
    if (idx % 2 === 1) {
      doc.setFillColor(245, 247, 251)
      doc.rect(margin, y, usableWidth, rowH, 'F')
    }
    // Tick box in the checkbox column
    doc.setDrawColor(120, 120, 120)
    doc.rect(xs[0] + (cols[0].w - boxSize) / 2, y + (rowH - boxSize) / 2, boxSize, boxSize)
    // Text cells
    const baseline = y + rowH - 2.6
    const name = doc.splitTextToSize(String(item.itemName ?? ''), cols[1].w - 3)[0] ?? ''
    doc.text(String(name), xs[1] + 2, baseline)
    doc.text(String(item.unit ?? ''), xs[2] + 2, baseline)
    doc.text(formatQty(item.orderQty), xs[3] + 2, baseline)
    // Supplier + Received columns are intentionally left blank for handwriting.
    y += rowH
  })

  // ── Grid lines ─────────────────────────────────────────────────────────
  const tableBottom = y
  doc.setDrawColor(200, 200, 200)
  doc.rect(margin, tableTop, usableWidth, tableBottom - tableTop)
  let vx = margin
  for (let i = 0; i < cols.length - 1; i++) {
    vx += cols[i].w
    doc.line(vx, tableTop, vx, tableBottom)
  }
  let hy = tableTop + headerH
  doc.line(margin, hy, tableRight, hy)
  for (let i = 0; i < items.length; i++) {
    hy += rowH
    if (hy > tableBottom) break
    doc.line(margin, hy, tableRight, hy)
  }

  // ── Footer ─────────────────────────────────────────────────────────────
  doc.setFontSize(8)
  doc.setTextColor(90, 106, 122)
  doc.text(`Generated: ${dateStr} | ${campus}`, margin, pageHeight - margin + 2)

  doc.save(`kitchen-order-checklist-${now.toISOString().slice(0, 10)}.pdf`)
}
