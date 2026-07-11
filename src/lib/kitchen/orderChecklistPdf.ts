'use client'

import { formatQty } from '@/lib/kitchen-utils'
import { formatLKR } from '@/lib/utils/formatCurrency'
import type { OrderItem } from '@/types/kitchen'

type RGB = [number, number, number]

interface PdfCategoryGroup {
  key: string
  label: string
  color: RGB
  matches: string[]
}

// Mirrors the on-screen category grouping so the PDF sections line up 1:1 with
// what the kitchen sees on the Orders page. Colours per the checklist spec
// (dark, print-friendly fills; white text on top).
const PDF_CATEGORY_GROUPS: PdfCategoryGroup[] = [
  { key: 'vegetables', label: 'Vegetables',          color: [45, 106, 45],  matches: ['vegetables', 'vegetable'] },
  { key: 'protein',    label: 'Meat & Protein',      color: [139, 26, 26],  matches: ['protein', 'meat', 'meat & fish', 'fish'] },
  { key: 'grains',     label: 'Grains & Rice',       color: [139, 105, 20], matches: ['grains', 'grain', 'rice', 'grains & rice'] },
  { key: 'dairy',      label: 'Dairy',               color: [26, 74, 123],  matches: ['dairy', 'dairy & eggs'] },
  { key: 'condiments', label: 'Condiments & Spices', color: [123, 58, 16],  matches: ['condiments', 'condiment', 'spices', 'spice', 'condiments & spices'] },
  { key: 'beverages',  label: 'Beverages',           color: [74, 26, 123],  matches: ['beverages', 'beverage'] },
  { key: 'other',      label: 'Other',               color: [58, 58, 58],   matches: [] },
]

const NON_OTHER = new Set(
  PDF_CATEGORY_GROUPS.filter((g) => g.key !== 'other').flatMap((g) => g.matches),
)

/** Buckets order items into the display groups above, preserving group order and
 *  dropping empty groups — matches the Orders page grouping exactly. */
function groupItems(items: OrderItem[]): (PdfCategoryGroup & { items: OrderItem[] })[] {
  return PDF_CATEGORY_GROUPS.map((g) => ({
    ...g,
    items: items.filter((it) => {
      const c = String(it.category ?? '').toLowerCase()
      if (g.key === 'other') return !NON_OTHER.has(c)
      return g.matches.includes(c)
    }),
  })).filter((g) => g.items.length > 0)
}

interface UsageStat {
  daysOfData: number
  dataQuality: 'ok' | 'limited' | 'no-history'
  daysLeft?: number | null
}

interface OrderChecklistOpts {
  campus?: string
  dateRange?: string
  manualItems?: OrderItem[]
  studentCount?: number
  scaleNote?: { target: number; actual: number } | null
  usageStats?: Record<string, UsageStat>
  /** Override the saved file name (without extension). Defaults to a dated checklist name. */
  fileName?: string
}

interface PdfCol {
  key: string
  label: string
  w: number
  align: 'left' | 'right' | 'center'
}

// Subtotal for a group = priced items only (matches the screen's group subtotals,
// where items with no unit cost are excluded so a missing price never reads as 0).
function pricedSubtotal(items: OrderItem[]): number {
  return items.reduce((s, it) => s + (it.unitCost > 0 ? it.totalCost : 0), 0)
}

/**
 * Generate and download the A4 (portrait) kitchen order checklist PDF, laid out
 * to match the Orders page: coloured category header bars, a table section per
 * category with per-item status, an order summary with category breakdown, and
 * blank supplier / received lines to fill in when stock arrives. Lazy-loads jsPDF
 * so it never ships in the initial bundle.
 */
export async function downloadOrderChecklistPdf(
  items: OrderItem[],
  opts?: OrderChecklistOpts,
): Promise<void> {
  const { default: jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const pageWidth = doc.internal.pageSize.getWidth() // 210mm
  const pageHeight = doc.internal.pageSize.getHeight() // 297mm
  const margin = 20 // 20mm all sides
  const usableWidth = pageWidth - margin * 2 // 170mm
  const right = margin + usableWidth
  const contentLimit = pageHeight - margin - 10 // leave room above the footer

  const now = new Date()
  const dateStr = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const campus = opts?.campus ?? 'Ahangama Main Campus'
  const manualItems = opts?.manualItems ?? []
  const usageStats = opts?.usageStats ?? {}

  const barH = 8
  const colHeadH = 6
  const rowH = 6.5

  // ── Table column layout (Item stretches to fill the remaining width) ────────
  const cols: PdfCol[] = [
    { key: 'item',   label: 'ITEM',       w: 37, align: 'left' },
    { key: 'stock',  label: 'STOCK',      w: 20, align: 'right' },
    { key: 'min',    label: 'MIN',        w: 15, align: 'right' },
    { key: 'days',   label: 'DAYS DATA',  w: 18, align: 'right' },
    { key: 'order',  label: 'ORDER QTY',  w: 16, align: 'right' },
    { key: 'price',  label: 'UNIT PRICE', w: 22, align: 'right' },
    { key: 'total',  label: 'TOTAL',      w: 22, align: 'right' },
    { key: 'status', label: 'STATUS',     w: 20, align: 'center' },
  ]
  const xs: number[] = []
  {
    let x = margin
    for (const c of cols) {
      xs.push(x)
      x += c.w
    }
  }
  const colIdx = (key: string) => cols.findIndex((c) => c.key === key)

  let y = margin

  // ── Header ──────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(11, 61, 107)
  doc.text('EPIC Campus', margin, y + 2)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(90, 106, 122)
  doc.text(`Date: ${dateStr}`, right, y + 2, { align: 'right' })

  doc.setFontSize(11)
  doc.text('Kitchen Order Checklist', margin, y + 9)
  y += 14

  doc.setFontSize(8.5)
  doc.setTextColor(90, 106, 122)
  if (opts?.dateRange) {
    doc.text(`Based on usage from ${opts.dateRange}`, margin, y)
    y += 5
  }
  if (opts?.scaleNote) {
    doc.text(`Scaled for ${opts.scaleNote.target} students (actual: ${opts.scaleNote.actual})`, margin, y)
    y += 5
  } else if (opts?.studentCount && opts.studentCount > 0) {
    doc.text(`Scaled for ${opts.studentCount} students`, margin, y)
    y += 5
  }

  doc.setDrawColor(221, 227, 236)
  doc.line(margin, y, right, y)
  y += 6

  // ── Drawing helpers ─────────────────────────────────────────────────────
  function drawCategoryBar(g: PdfCategoryGroup & { items: OrderItem[] }, subtotal: number, continued = false): void {
    doc.setFillColor(g.color[0], g.color[1], g.color[2])
    doc.rect(margin, y, usableWidth, barH, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    const count = `${g.items.length} ITEM${g.items.length === 1 ? '' : 'S'}`
    const label = `${g.label.toUpperCase()} (${count})${continued ? ' — CONTINUED' : ''}`
    doc.text(label, margin + 2.5, y + barH - 2.6)
    doc.text(formatLKR(subtotal), right - 2.5, y + barH - 2.6, { align: 'right' })
    y += barH
  }

  function drawColumnHeaders(): void {
    doc.setFillColor(238, 241, 245)
    doc.rect(margin, y, usableWidth, colHeadH, 'F')
    doc.setTextColor(90, 106, 122)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.5)
    cols.forEach((c, i) => {
      if (c.align === 'right') doc.text(c.label, xs[i] + c.w - 1.5, y + colHeadH - 1.8, { align: 'right' })
      else if (c.align === 'center') doc.text(c.label, xs[i] + c.w / 2, y + colHeadH - 1.8, { align: 'center' })
      else doc.text(c.label, xs[i] + 1.5, y + colHeadH - 1.8)
    })
    y += colHeadH
  }

  function drawItemRow(item: OrderItem, index: number, g: PdfCategoryGroup & { items: OrderItem[] }, subtotal: number): void {
    // Continue on a fresh page (repeat the category bar + column headers) if the
    // row would spill past the content area.
    if (y + rowH > contentLimit) {
      doc.addPage('a4', 'portrait')
      y = margin
      drawCategoryBar(g, subtotal, true)
      drawColumnHeaders()
    }
    if (index % 2 === 1) {
      doc.setFillColor(247, 249, 252)
      doc.rect(margin, y, usableWidth, rowH, 'F')
    }
    const baseline = y + rowH - 2

    const isCritical = item.currentStock === 0
    const isLow = item.currentStock < item.minStockLevel
    const noPrice = !(item.unitCost > 0)
    const stat = usageStats[item.itemId]

    // Item name (bold if critical), with a small grey data badge after it.
    doc.setFontSize(8)
    doc.setFont('helvetica', isCritical ? 'bold' : 'normal')
    doc.setTextColor(13, 27, 42)
    const ic = colIdx('item')
    const name = String((doc.splitTextToSize(String(item.itemName ?? ''), cols[ic].w - 3) as string[])[0] ?? '')
    doc.text(name, xs[ic] + 1.5, baseline)
    const badge = stat?.dataQuality === 'no-history' ? 'No History' : stat?.dataQuality === 'limited' ? 'Limited Data' : ''
    if (badge) {
      const nameW = doc.getTextWidth(name)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(5.6)
      doc.setTextColor(120, 120, 120)
      doc.text(badge, xs[ic] + 1.5 + nameW + 2, baseline)
    }

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)

    // Stock (red when out of stock)
    const sc = colIdx('stock')
    doc.setTextColor(...(isCritical ? [197, 48, 48] : [90, 106, 122]) as RGB)
    doc.text(`${formatQty(item.currentStock)} ${item.unit}`, xs[sc] + cols[sc].w - 1.5, baseline, { align: 'right' })

    // Min
    const mc = colIdx('min')
    doc.setTextColor(90, 106, 122)
    doc.text(`${formatQty(item.minStockLevel)} ${item.unit}`, xs[mc] + cols[mc].w - 1.5, baseline, { align: 'right' })

    // Days of data ("New Item" when there is no usage history)
    const dc = colIdx('days')
    const daysText = stat ? (stat.dataQuality === 'no-history' ? 'New Item' : `${stat.daysOfData}d`) : '—'
    doc.setTextColor(120, 130, 140)
    doc.text(daysText, xs[dc] + cols[dc].w - 1.5, baseline, { align: 'right' })

    // Order qty (the editable value carried over from the screen)
    const oc = colIdx('order')
    doc.setTextColor(13, 27, 42)
    doc.text(formatQty(item.orderQty), xs[oc] + cols[oc].w - 1.5, baseline, { align: 'right' })

    // Unit price
    const pc = colIdx('price')
    doc.setTextColor(120, 130, 140)
    doc.text(noPrice ? '—' : `${formatLKR(item.unitCost)}`, xs[pc] + cols[pc].w - 1.5, baseline, { align: 'right' })

    // Line total (bold, gold)
    const tc = colIdx('total')
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(232, 160, 32)
    doc.text(noPrice ? '—' : formatLKR(item.totalCost), xs[tc] + cols[tc].w - 1.5, baseline, { align: 'right' })
    doc.setFont('helvetica', 'normal')

    // Status badge (CRITICAL red / LOW amber / OK green)
    const stc = colIdx('status')
    const status: { label: string; color: RGB } = isCritical
      ? { label: 'CRITICAL', color: [197, 48, 48] }
      : isLow
        ? { label: 'LOW', color: [180, 120, 20] }
        : { label: 'OK', color: [46, 125, 50] }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.8)
    doc.setTextColor(...status.color)
    doc.text(status.label, xs[stc] + cols[stc].w / 2, baseline, { align: 'center' })
    doc.setFont('helvetica', 'normal')

    y += rowH
  }

  function drawSubtotalRow(subtotal: number): void {
    if (y + rowH > contentLimit) {
      doc.addPage('a4', 'portrait')
      y = margin
    }
    doc.setFillColor(238, 241, 245)
    doc.rect(margin, y, usableWidth, rowH, 'F')
    doc.setTextColor(13, 27, 42)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text(`Subtotal: ${formatLKR(subtotal)}`, right - 2.5, y + rowH - 2, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    y += rowH
  }

  // ── Category sections ───────────────────────────────────────────────────
  const groups = groupItems(items)
  for (const g of groups) {
    const subtotal = pricedSubtotal(g.items)
    // Keep the bar + headers + first row together on one page.
    if (y + barH + colHeadH + rowH > contentLimit) {
      doc.addPage('a4', 'portrait')
      y = margin
    }
    drawCategoryBar(g, subtotal)
    drawColumnHeaders()
    g.items.forEach((item, i) => drawItemRow(item, i, g, subtotal))
    drawSubtotalRow(subtotal)
    y += 3 // ~8px gap between categories
  }

  // ── Order summary (grand total + per-category breakdown) ────────────────
  const grand = pricedSubtotal(items)
  const noPriceCount = items.filter((i) => !(i.unitCost > 0)).length
  const studentCount = opts?.studentCount && opts.studentCount > 0 ? opts.studentCount : 0
  const perStudent = studentCount > 0 ? grand / studentCount : null

  const breakdownStr = groups.map((g) => `${g.label}: ${formatLKR(pricedSubtotal(g.items))}`).join('    ·    ')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  const breakdownLines = doc.splitTextToSize(breakdownStr, usableWidth - 8) as string[]

  const summaryH = 26 + breakdownLines.length * 3.6 + (noPriceCount > 0 ? 5 : 0)
  y += 4
  if (y + summaryH > contentLimit) {
    doc.addPage('a4', 'portrait')
    y = margin
  }
  const boxTop = y
  let by = boxTop + 6

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(11, 61, 107)
  doc.text('ORDER SUMMARY', margin + 4, by)

  // Grand total, large and gold, on the right.
  doc.setFontSize(15)
  doc.setTextColor(232, 160, 32)
  doc.text(formatLKR(grand), right - 4, by + 1, { align: 'right' })
  by += 7

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(90, 106, 122)
  doc.text(`Total items: ${items.length}`, margin + 4, by)
  by += 5
  if (perStudent != null) {
    doc.text(`Per student: ${formatLKR(perStudent)}  (÷ ${studentCount})`, margin + 4, by)
    by += 5
  }
  if (noPriceCount > 0) {
    doc.setTextColor(180, 120, 20)
    doc.text(`${noPriceCount} item${noPriceCount === 1 ? '' : 's'} with no unit cost — excluded from totals.`, margin + 4, by)
    by += 5
  }

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(90, 106, 122)
  breakdownLines.forEach((ln) => {
    doc.text(ln, margin + 4, by)
    by += 3.6
  })

  const boxBottom = by + 2
  doc.setDrawColor(11, 61, 107)
  doc.rect(margin, boxTop, usableWidth, boxBottom - boxTop)
  y = boxBottom + 6

  // ── Manual review section (below-min items with no usage history) ───────
  if (manualItems.length > 0) {
    if (y + 26 > contentLimit) {
      doc.addPage('a4', 'portrait')
      y = margin
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.setTextColor(180, 120, 20)
    doc.text('Manual Review Items — no usage recorded', margin, y)
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(90, 106, 122)
    doc.text('Below minimum stock but no recorded usage. Enter order quantities by hand.', margin, y)
    y += 5

    // Column headers
    doc.setFillColor(238, 241, 245)
    doc.rect(margin, y, usableWidth, colHeadH, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.5)
    doc.setTextColor(90, 106, 122)
    doc.text('ITEM', margin + 1.5, y + colHeadH - 1.8)
    doc.text('CURRENT', margin + 100, y + colHeadH - 1.8, { align: 'right' })
    doc.text('MIN', margin + 125, y + colHeadH - 1.8, { align: 'right' })
    doc.text('ORDER QTY', right - 1.5, y + colHeadH - 1.8, { align: 'right' })
    y += colHeadH

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    manualItems.forEach((item, i) => {
      if (y + rowH > contentLimit) {
        doc.addPage('a4', 'portrait')
        y = margin
      }
      if (i % 2 === 1) {
        doc.setFillColor(247, 249, 252)
        doc.rect(margin, y, usableWidth, rowH, 'F')
      }
      const baseline = y + rowH - 2
      doc.setTextColor(13, 27, 42)
      doc.text(`${item.itemName} (${item.unit})`, margin + 1.5, baseline)
      doc.setTextColor(90, 106, 122)
      doc.text(formatQty(item.currentStock), margin + 100, baseline, { align: 'right' })
      doc.text(formatQty(item.minStockLevel), margin + 125, baseline, { align: 'right' })
      // Blank line for the hand-entered order qty.
      doc.setDrawColor(180, 180, 180)
      doc.line(right - 26, baseline + 0.5, right - 1.5, baseline + 0.5)
      y += rowH
    })
    y += 4
  }

  // ── Supplier / received sign-off lines ──────────────────────────────────
  if (y + 26 > contentLimit) {
    doc.addPage('a4', 'portrait')
    y = margin
  }
  doc.setDrawColor(120, 130, 140)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(13, 27, 42)
  const half = usableWidth / 2
  const signRows: [string, string][] = [
    ['Supplier:', 'Notes:'],
    ['Received by:', 'Date received:'],
  ]
  for (const [left, rightLabel] of signRows) {
    doc.text(left, margin, y)
    doc.line(margin + 26, y + 0.5, margin + half - 6, y + 0.5)
    doc.text(rightLabel, margin + half, y)
    doc.line(margin + half + 30, y + 0.5, right, y + 0.5)
    y += 9
  }

  // ── Footer (every page) ─────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages()
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(90, 106, 122)
    doc.text(`Generated: ${dateStr} | ${campus}`, margin, pageHeight - margin + 4)
    doc.text('EPIC Campus Kitchen Management System', right, pageHeight - margin + 4, { align: 'right' })
  }

  const fileName = opts?.fileName ?? `kitchen-order-checklist-${now.toISOString().slice(0, 10)}`
  doc.save(`${fileName}.pdf`)
}
