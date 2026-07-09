'use client'

import { formatQty } from '@/lib/kitchen-utils'
import { formatLKR } from '@/lib/utils/formatCurrency'
import type { OrderItem } from '@/types/kitchen'

interface Col {
  key: string
  label: string
  w: number
  align?: 'left' | 'right'
}

/**
 * Generate and download a printable A4 (landscape) kitchen order checklist PDF.
 * Blank "Supplier" and "Received" columns let staff fill them in by hand when the
 * stock arrives, and a tick box on each row lets them check items off. Now also
 * carries unit price + estimated total columns, a grand total, and a separate
 * "Manual Review" section for below-min items with no usage history.
 * Lazy-loads jsPDF so it never ships in the initial bundle.
 */
export async function downloadOrderChecklistPdf(
  items: OrderItem[],
  opts?: { campus?: string; dateRange?: string; manualItems?: OrderItem[] },
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
  const manualItems = opts?.manualItems ?? []

  const headerH = 8
  const rowH = 7
  const boxSize = 4
  const FONT = 8 // 8pt keeps the extra price columns on one page

  // ── Title ──────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(11, 61, 107)
  doc.text('EPIC Campus — Kitchen Order Checklist', margin, margin + 2)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(90, 106, 122)
  doc.text(`Date: ${dateStr}`, pageWidth - margin, margin + 2, { align: 'right' })
  if (opts?.dateRange) {
    doc.text(`Usage period: ${opts.dateRange}`, margin, margin + 7)
  }
  doc.setTextColor(0, 0, 0)

  let y = margin + 11

  // Draws a header + rows table starting at `y`, returns the bottom Y.
  function drawTable(cols: Col[], rows: string[][], hasTickBox: boolean): void {
    // Resolve the fill (last col with w === 0 stretches to fill).
    const fixed = cols.reduce((s, c) => s + c.w, 0)
    const fillIdx = cols.findIndex((c) => c.w === 0)
    if (fillIdx >= 0) cols[fillIdx].w = usableWidth - fixed
    const xs: number[] = []
    let x = margin
    for (const c of cols) {
      xs.push(x)
      x += c.w
    }
    const tableRight = margin + usableWidth
    const tableTop = y

    // Header row
    doc.setFillColor(11, 61, 107)
    doc.rect(margin, y, usableWidth, headerH, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(FONT)
    cols.forEach((c, i) => {
      if (!c.label) return
      if (c.align === 'right') doc.text(c.label, xs[i] + c.w - 2, y + headerH - 2.6, { align: 'right' })
      else doc.text(c.label, xs[i] + 2, y + headerH - 2.6)
    })
    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'normal')
    y += headerH

    rows.forEach((row, idx) => {
      if (y + rowH > pageHeight - margin - 6) {
        doc.addPage('a4', 'landscape')
        y = margin
      }
      if (idx % 2 === 1) {
        doc.setFillColor(245, 247, 251)
        doc.rect(margin, y, usableWidth, rowH, 'F')
      }
      const baseline = y + rowH - 2.4
      cols.forEach((c, i) => {
        if (hasTickBox && c.key === 'check') {
          doc.setDrawColor(120, 120, 120)
          doc.rect(xs[i] + (c.w - boxSize) / 2, y + (rowH - boxSize) / 2, boxSize, boxSize)
          return
        }
        const text = row[i] ?? ''
        if (!text) return
        if (c.key === 'item') {
          const name = (doc.splitTextToSize(text, c.w - 3) as string[])[0] ?? ''
          doc.text(String(name), xs[i] + 2, baseline)
        } else if (c.align === 'right') {
          doc.text(text, xs[i] + c.w - 2, baseline, { align: 'right' })
        } else {
          doc.text(text, xs[i] + 2, baseline)
        }
      })
      y += rowH
    })

    // Grid lines
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
    for (let i = 0; i < rows.length; i++) {
      hy += rowH
      if (hy > tableBottom) break
      doc.line(margin, hy, tableRight, hy)
    }
  }

  // ── Main order table (with price columns) ──────────────────────────────
  const mainCols: Col[] = [
    { key: 'check', label: '', w: 10 },
    { key: 'item', label: 'Item', w: 52 },
    { key: 'unit', label: 'Unit', w: 15 },
    { key: 'qty', label: 'Order Qty', w: 20, align: 'right' },
    { key: 'price', label: 'Unit Price (LKR)', w: 30, align: 'right' },
    { key: 'total', label: 'Estimated Total (LKR)', w: 34, align: 'right' },
    { key: 'supplier', label: 'Supplier', w: 52 },
    { key: 'received', label: 'Received', w: 0 },
  ]
  const mainRows = items.map((item) => [
    '',
    String(item.itemName ?? ''),
    String(item.unit ?? ''),
    formatQty(item.orderQty),
    item.unitCost > 0 ? formatLKR(item.unitCost) : '—',
    item.unitCost > 0 ? formatLKR(item.totalCost) : '—',
    '',
    '',
  ])
  if (mainRows.length > 0) {
    drawTable(mainCols, mainRows, true)

    // Grand total (priced items only)
    const priced = items.filter((i) => i.unitCost > 0)
    const grand = priced.reduce((s, i) => s + i.totalCost, 0)
    const noPrice = items.length - priced.length
    y += 5
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(11, 61, 107)
    doc.text(`Estimated Order Total: ${formatLKR(grand)}`, margin + usableWidth, y, { align: 'right' })
    y += 5
    if (noPrice > 0) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(90, 106, 122)
      doc.text(`${noPrice} item${noPrice === 1 ? '' : 's'} with no price data excluded`, margin + usableWidth, y, { align: 'right' })
      y += 5
    }
    doc.setTextColor(0, 0, 0)
  }

  // ── Manual review section ──────────────────────────────────────────────
  if (manualItems.length > 0) {
    y += 6
    if (y + 24 > pageHeight - margin) {
      doc.addPage('a4', 'landscape')
      y = margin
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(180, 120, 20)
    doc.text('Manual Review Items — no usage recorded', margin, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(90, 106, 122)
    doc.text('These items are below minimum stock but have no recorded usage. Enter order quantities by hand.', margin, y)
    y += 4
    doc.setTextColor(0, 0, 0)

    const manualCols: Col[] = [
      { key: 'check', label: '', w: 10 },
      { key: 'item', label: 'Item', w: 70 },
      { key: 'unit', label: 'Unit', w: 18 },
      { key: 'current', label: 'Current', w: 28, align: 'right' },
      { key: 'min', label: 'Min', w: 28, align: 'right' },
      { key: 'order', label: 'Order Qty (enter)', w: 0 },
    ]
    const manualRows = manualItems.map((item) => [
      '',
      String(item.itemName ?? ''),
      String(item.unit ?? ''),
      formatQty(item.currentStock),
      formatQty(item.minStockLevel),
      '',
    ])
    drawTable(manualCols, manualRows, true)
  }

  // ── Footer ─────────────────────────────────────────────────────────────
  doc.setFontSize(8)
  doc.setTextColor(90, 106, 122)
  doc.text(`Generated: ${dateStr} | ${campus}`, margin, pageHeight - margin + 2)

  doc.save(`kitchen-order-checklist-${now.toISOString().slice(0, 10)}.pdf`)
}
