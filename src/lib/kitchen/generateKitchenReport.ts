import { PDFDocument, rgb, StandardFonts, type PDFPage, type PDFFont } from 'pdf-lib'
import { safePdfText } from '@/lib/utils/pdfText'
import type { InventoryItem, MealLog, WasteEntry, WasteReason } from '@/types/kitchen'

const NAVY = rgb(0.043, 0.239, 0.42)
const GOLD = rgb(0.91, 0.627, 0.125)
const GRAY = rgb(0.4, 0.4, 0.4)
const RED = rgb(0.85, 0.2, 0.2)
const AMBER = rgb(0.85, 0.55, 0.1)
const WHITE = rgb(1, 1, 1)
const LIGHT_GRAY = rgb(0.95, 0.96, 0.98)

export interface KitchenReportSummary {
  totalSpend: number
  totalStudents: number
  totalStaff: number
  costPerStudentPerDay: number
  totalWasteValue: number
  mostUsedIngredient: string
  mostWastedItem: string
}

export interface KitchenReportData {
  periodType: 'weekly' | 'monthly'
  periodLabel: string
  startDate: string
  endDate: string
  generatedAt: Date
  meals: MealLog[]
  waste: WasteEntry[]
  inventory: InventoryItem[]
  summary: KitchenReportSummary
}

function lkr(n: number): string {
  return `LKR ${Math.round(n).toLocaleString('en-LK')}`
}

function truncate(text: string, max: number): string {
  const t = safePdfText(text)
  return t.length > max ? `${t.slice(0, max - 1)}…` : t
}

function drawHeaderBar(page: PDFPage, width: number, height: number) {
  page.drawRectangle({ x: 0, y: height - 72, width, height: 72, color: NAVY })
}

function drawFooter(page: PDFPage, font: PDFFont, pageNum: number) {
  page.drawText(`Epic Campus Kitchen · Page ${pageNum}`, {
    x: 40,
    y: 28,
    size: 8,
    font,
    color: GRAY,
  })
}

function drawTableHeader(
  page: PDFPage,
  font: PDFFont,
  y: number,
  cols: string[],
  colX: number[],
) {
  page.drawRectangle({ x: 40, y: y - 4, width: 515, height: 18, color: LIGHT_GRAY })
  cols.forEach((col, i) => {
    page.drawText(col, { x: colX[i], y, size: 8, font, color: NAVY })
  })
}

export function buildKitchenReportSummary(
  meals: MealLog[],
  waste: WasteEntry[],
): KitchenReportSummary {
  const totalSpend = meals.reduce((s, m) => s + (m.estimatedCost || 0), 0)
  const totalStudents = meals.reduce((s, m) => s + (m.studentCount || 0), 0)
  const totalStaff = meals.reduce((s, m) => s + (m.staffCount || 0), 0)
  const uniqueDays = new Set(meals.map((m) => m.date)).size || 1
  const costPerStudentPerDay =
    totalStudents > 0 ? totalSpend / totalStudents / uniqueDays : 0

  const totalWasteValue = waste.reduce((s, w) => s + (w.estimatedLoss || 0), 0)

  const ingredientTotals: Record<string, number> = {}
  meals.forEach((m) => {
    m.ingredientsUsed?.forEach((ing) => {
      ingredientTotals[ing.itemName] =
        (ingredientTotals[ing.itemName] || 0) + ing.qtyUsed
    })
  })
  const mostUsed = Object.entries(ingredientTotals).sort((a, b) => b[1] - a[1])[0]

  const wasteTotals: Record<string, number> = {}
  waste.forEach((w) => {
    wasteTotals[w.itemName] = (wasteTotals[w.itemName] || 0) + w.estimatedLoss
  })
  const mostWasted = Object.entries(wasteTotals).sort((a, b) => b[1] - a[1])[0]

  return {
    totalSpend,
    totalStudents,
    totalStaff,
    costPerStudentPerDay,
    totalWasteValue,
    mostUsedIngredient: mostUsed
      ? `${mostUsed[0]} (${mostUsed[1]} total)`
      : '—',
    mostWastedItem: mostWasted ? mostWasted[0] : '—',
  }
}

export async function generateKitchenReportPDF(data: KitchenReportData): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.HelveticaBold)
  const fontReg = await doc.embedFont(StandardFonts.Helvetica)
  const { width, height } = { width: 595, height: 842 }

  const generatedStr = data.generatedAt.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  // Page 1 — Cover
  const p1 = doc.addPage([width, height])
  drawHeaderBar(p1, width, height)
  p1.drawText('EPIC CAMPUS', { x: 40, y: height - 48, size: 28, font, color: WHITE })
  p1.drawText('Kitchen Cost Report', { x: 40, y: height - 100, size: 22, font, color: GOLD })
  p1.drawText('Ahangama Main Campus', { x: 40, y: height - 130, size: 14, font: fontReg, color: GRAY })
  p1.drawText(`Period: ${safePdfText(data.periodLabel)}`, {
    x: 40,
    y: height - 200,
    size: 16,
    font,
    color: NAVY,
  })
  p1.drawText(`Generated: ${safePdfText(generatedStr)}`, {
    x: 40,
    y: height - 230,
    size: 11,
    font: fontReg,
    color: GRAY,
  })
  p1.drawRectangle({ x: 40, y: 80, width: width - 80, height: 3, color: GOLD })
  drawFooter(p1, fontReg, 1)

  // Page 2 — Summary
  const p2 = doc.addPage([width, height])
  p2.drawText('SUMMARY', { x: 40, y: height - 60, size: 18, font, color: NAVY })
  const summaryLines = [
    `Total spend for period: ${lkr(data.summary.totalSpend)}`,
    `Total meals served: ${data.summary.totalStudents} students + ${data.summary.totalStaff} staff`,
    `Cost per student per day: ${lkr(data.summary.costPerStudentPerDay)}`,
    `Total waste value: ${lkr(data.summary.totalWasteValue)}`,
    `Most used ingredient: ${safePdfText(data.summary.mostUsedIngredient)}`,
    `Most wasted item: ${safePdfText(data.summary.mostWastedItem)}`,
  ]
  summaryLines.forEach((line, i) => {
    p2.drawText(line, { x: 40, y: height - 100 - i * 28, size: 12, font: fontReg, color: NAVY })
  })
  drawFooter(p2, fontReg, 2)

  // Page 3 — Daily breakdown
  const p3 = doc.addPage([width, height])
  p3.drawText('DAILY BREAKDOWN', { x: 40, y: height - 60, size: 18, font, color: NAVY })
  const colX = [42, 95, 155, 205, 255, 340, 430]
  const headers = ['Date', 'Meal', 'Stud.', 'Staff', 'Cost', 'Waste']
  drawTableHeader(p3, font, height - 88, headers, colX)

  const wasteByDate: Record<string, number> = {}
  data.waste.forEach((w) => {
    wasteByDate[w.date] = (wasteByDate[w.date] || 0) + w.estimatedLoss
  })

  let y = height - 108
  let totStud = 0
  let totStaff = 0
  let totCost = 0
  let totWaste = 0

  const sortedMeals = [...data.meals].sort((a, b) => a.date.localeCompare(b.date))

  for (const m of sortedMeals) {
    if (y < 100) break
    const wCost = wasteByDate[m.date] ?? 0
    totStud += m.studentCount
    totStaff += m.staffCount
    totCost += m.estimatedCost
    totWaste += wCost
    p3.drawText(m.date.slice(5), { x: colX[0], y, size: 8, font: fontReg, color: GRAY })
    p3.drawText(truncate(m.mealType, 10), { x: colX[1], y, size: 8, font: fontReg, color: GRAY })
    p3.drawText(String(m.studentCount), { x: colX[2], y, size: 8, font: fontReg, color: GRAY })
    p3.drawText(String(m.staffCount), { x: colX[3], y, size: 8, font: fontReg, color: GRAY })
    p3.drawText(lkr(m.estimatedCost), { x: colX[4], y, size: 8, font: fontReg, color: GRAY })
    p3.drawText(lkr(wCost), { x: colX[5], y, size: 8, font: fontReg, color: GRAY })
    y -= 14
  }

  y -= 6
  p3.drawLine({ start: { x: 40, y }, end: { x: 555, y }, thickness: 1, color: NAVY })
  y -= 14
  p3.drawText('TOTALS', { x: colX[0], y, size: 8, font, color: NAVY })
  p3.drawText(String(totStud), { x: colX[2], y, size: 8, font, color: NAVY })
  p3.drawText(String(totStaff), { x: colX[3], y, size: 8, font, color: NAVY })
  p3.drawText(lkr(totCost), { x: colX[4], y, size: 8, font, color: NAVY })
  p3.drawText(lkr(totWaste), { x: colX[5], y, size: 8, font, color: NAVY })
  drawFooter(p3, fontReg, 3)

  // Page 4 — Inventory
  const p4 = doc.addPage([width, height])
  p4.drawText('INVENTORY STATUS', { x: 40, y: height - 60, size: 18, font, color: NAVY })
  const invColX = [42, 200, 280, 360, 440]
  drawTableHeader(p4, font, height - 88, ['Item', 'Stock', 'Min', 'Unit', 'Expiry'], invColX)

  y = height - 108
  const today = new Date()
  for (const item of data.inventory.filter((i) => i.isActive !== false)) {
    if (y < 60) break
    const belowMin = item.currentStock <= item.minStockLevel
    let expiringSoon = false
    if (item.expiryDate) {
      const exp = new Date(`${item.expiryDate.slice(0, 10)}T12:00:00`)
      const days = Math.ceil((exp.getTime() - today.getTime()) / 86400000)
      expiringSoon = days >= 0 && days <= 7
    }

    if (belowMin) {
      p4.drawRectangle({ x: 38, y: y - 3, width: 520, height: 14, color: rgb(1, 0.92, 0.92) })
    } else if (expiringSoon) {
      p4.drawRectangle({ x: 38, y: y - 3, width: 520, height: 14, color: rgb(1, 0.97, 0.88) })
    }

    const textColor = belowMin ? RED : expiringSoon ? AMBER : GRAY
    p4.drawText(truncate(item.itemName, 22), { x: invColX[0], y, size: 8, font: fontReg, color: textColor })
    p4.drawText(String(item.currentStock), { x: invColX[1], y, size: 8, font: fontReg, color: textColor })
    p4.drawText(String(item.minStockLevel), { x: invColX[2], y, size: 8, font: fontReg, color: textColor })
    p4.drawText(item.unit, { x: invColX[3], y, size: 8, font: fontReg, color: textColor })
    p4.drawText(item.expiryDate?.slice(0, 10) ?? '—', {
      x: invColX[4],
      y,
      size: 8,
      font: fontReg,
      color: textColor,
    })
    y -= 14
  }
  drawFooter(p4, fontReg, 4)

  // Page 5 — Waste
  const p5 = doc.addPage([width, height])
  p5.drawText('WASTE LOG', { x: 40, y: height - 60, size: 18, font, color: NAVY })

  y = height - 90
  for (const w of data.waste) {
    if (y < 200) break
    p5.drawText(`${w.date} — ${truncate(w.itemName, 20)} (${w.quantity} ${w.unit})`, {
      x: 40,
      y,
      size: 9,
      font: fontReg,
      color: GRAY,
    })
    p5.drawText(`${w.reason} · ${lkr(w.estimatedLoss)}`, {
      x: 60,
      y: y - 12,
      size: 8,
      font: fontReg,
      color: GRAY,
    })
    y -= 28
  }

  const reasonCounts: Record<string, number> = {}
  data.waste.forEach((w) => {
    reasonCounts[w.reason] = (reasonCounts[w.reason] || 0) + 1
  })
  const totalWasteEntries = data.waste.length || 1

  p5.drawText('Reason breakdown:', { x: 40, y: 180, size: 12, font, color: NAVY })
  const reasons: WasteReason[] = ['overcooked', 'expired', 'leftover', 'spoiled', 'dropped', 'other']
  reasons.forEach((r, i) => {
    const count = reasonCounts[r] || 0
    const pct = Math.round((count / totalWasteEntries) * 100)
    const label = r.charAt(0).toUpperCase() + r.slice(1)
    p5.drawText(`${label}: ${pct}%`, { x: 40, y: 155 - i * 18, size: 10, font: fontReg, color: GRAY })
  })
  drawFooter(p5, fontReg, 5)

  return doc.save()
}

export function downloadKitchenReportPDF(bytes: Uint8Array, filename: string) {
  const copy = Uint8Array.from(bytes)
  const blob = new Blob([copy], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
