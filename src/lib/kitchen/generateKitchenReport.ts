import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { collection, getDocs, query, orderBy } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { daysUntilExpiry } from '@/lib/kitchen/expiryHelpers'
import type { ReportPeriod } from '@/lib/kitchen/reportPeriods'
import { safePdfText } from '@/lib/utils/pdfText'
import type { InventoryItem, MealLog, WasteEntry, WasteReason } from '@/types/kitchen'

const NAVY = rgb(0.043, 0.239, 0.42)
const GOLD = rgb(0.91, 0.627, 0.125)
const GRAY = rgb(0.45, 0.45, 0.45)
const RED = rgb(0.85, 0.2, 0.2)
const AMBER = rgb(0.85, 0.55, 0.1)
const GREEN = rgb(0.1, 0.55, 0.35)
const WHITE = rgb(1, 1, 1)

function normalizeDate(date: unknown): string {
  if (!date) return ''
  if (typeof date === 'string') return date.slice(0, 10)
  if (typeof date === 'object' && date !== null && 'toDate' in date) {
    const toDate = (date as { toDate?: () => Date }).toDate
    if (typeof toDate === 'function') {
      return toDate.call(date).toISOString().slice(0, 10)
    }
  }
  if (typeof date === 'object' && date !== null && 'seconds' in date) {
    return new Date((date as { seconds: number }).seconds * 1000).toISOString().slice(0, 10)
  }
  return String(date).slice(0, 10)
}

function parseMealLog(id: string, data: Record<string, unknown>): MealLog {
  return {
    id,
    date: normalizeDate(data.date),
    mealType: data.mealType as MealLog['mealType'],
    studentCount: Number(data.studentCount ?? 0),
    staffCount: Number(data.staffCount ?? 0),
    totalServings: Number(data.totalServings ?? 0),
    ingredientsUsed: Array.isArray(data.ingredientsUsed)
      ? (data.ingredientsUsed as MealLog['ingredientsUsed'])
      : [],
    estimatedCost: Number(data.estimatedCost ?? 0),
    costPerPerson: Number(data.costPerPerson ?? 0),
    notes: String(data.notes ?? ''),
    loggedBy: String(data.loggedBy ?? ''),
    loggedByName: String(data.loggedByName ?? ''),
    createdAt: data.createdAt as MealLog['createdAt'],
  }
}

function parseWaste(id: string, data: Record<string, unknown>): WasteEntry {
  return {
    id,
    date: normalizeDate(data.date),
    itemId: String(data.itemId ?? ''),
    itemName: String(data.itemName ?? ''),
    quantity: Number(data.quantity ?? 0),
    unit: data.unit as WasteEntry['unit'],
    reason: data.reason as WasteReason,
    estimatedLoss: Number(data.estimatedLoss ?? 0),
    mealLogId: data.mealLogId ? String(data.mealLogId) : undefined,
    notes: String(data.notes ?? ''),
    loggedBy: String(data.loggedBy ?? ''),
    loggedByName: String(data.loggedByName ?? ''),
    createdAt: data.createdAt as WasteEntry['createdAt'],
  }
}

function lkr(n: number): string {
  return `LKR ${Math.round(n).toLocaleString('en-LK')}`
}

function truncate(text: string, max: number): string {
  const t = safePdfText(text)
  return t.length > max ? `${t.slice(0, max - 1)}…` : t
}

async function fetchReportData(period: ReportPeriod) {
  const [mealSnap, wasteSnap, invSnap] = await Promise.all([
    getDocs(query(collection(db, 'mealLogs'), orderBy('createdAt', 'desc'))).catch(() =>
      getDocs(collection(db, 'mealLogs')),
    ),
    getDocs(query(collection(db, 'wasteLog'), orderBy('date', 'asc'))).catch(() =>
      getDocs(collection(db, 'wasteLog')),
    ),
    getDocs(collection(db, 'inventory')),
  ])

  const meals = mealSnap.docs
    .map((d) => parseMealLog(d.id, d.data() as Record<string, unknown>))
    .filter((m) => m.date >= period.startDate && m.date <= period.endDate)
    .sort((a, b) => a.date.localeCompare(b.date) || a.mealType.localeCompare(b.mealType))

  const waste = wasteSnap.docs
    .map((d) => parseWaste(d.id, d.data() as Record<string, unknown>))
    .filter((w) => w.date >= period.startDate && w.date <= period.endDate)

  const inventory = invSnap.docs
    .map((d) => ({ id: d.id, ...d.data() } as InventoryItem))
    .filter((i) => i.isActive !== false)
    .sort((a, b) => a.itemName.localeCompare(b.itemName))

  return { meals, waste, inventory }
}

export async function generateKitchenReportPDF(period: ReportPeriod): Promise<Uint8Array> {
  const { meals, waste, inventory } = await fetchReportData(period)

  const totalSpent = meals.reduce((s, m) => s + m.estimatedCost, 0)
  const totalStudents = meals.reduce((s, m) => s + m.studentCount, 0)
  const totalStaff = meals.reduce((s, m) => s + m.staffCount, 0)
  const totalWaste = waste.reduce((s, w) => s + w.estimatedLoss, 0)
  const uniqueDays = new Set(meals.map((m) => m.date)).size || 1
  const costPerStudentDay =
    totalStudents > 0 ? totalSpent / totalStudents / uniqueDays : 0

  const ingredientTotals: Record<string, number> = {}
  meals.forEach((m) => {
    m.ingredientsUsed?.forEach((ing) => {
      ingredientTotals[ing.itemName] = (ingredientTotals[ing.itemName] ?? 0) + ing.qtyUsed
    })
  })
  const mostUsed = Object.entries(ingredientTotals).sort((a, b) => b[1] - a[1])[0]

  const wasteByItem: Record<string, number> = {}
  waste.forEach((w) => {
    wasteByItem[w.itemName] = (wasteByItem[w.itemName] ?? 0) + w.estimatedLoss
  })
  const mostWasted = Object.entries(wasteByItem).sort((a, b) => b[1] - a[1])[0]

  const wasteByReason: Record<string, number> = {}
  waste.forEach((w) => {
    wasteByReason[w.reason] = (wasteByReason[w.reason] ?? 0) + w.estimatedLoss
  })

  const wasteByDate: Record<string, number> = {}
  waste.forEach((w) => {
    wasteByDate[w.date] = (wasteByDate[w.date] ?? 0) + w.estimatedLoss
  })

  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.HelveticaBold)
  const fontReg = await doc.embedFont(StandardFonts.Helvetica)
  const now = new Date()
  const generatedAt = now.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  // Page 1 — Cover
  {
    const page = doc.addPage([595, 842])
    const { width, height } = page.getSize()
    page.drawRectangle({ x: 0, y: height - 120, width, height: 120, color: NAVY })
    page.drawText('EPIC CAMPUS', { x: 50, y: height - 70, size: 28, font, color: WHITE })
    page.drawText('Kitchen Cost Report', { x: 50, y: height - 100, size: 16, font, color: GOLD })
    page.drawText('Ahangama Main Campus', { x: 50, y: height - 200, size: 14, font: fontReg, color: GRAY })
    page.drawText(`Period: ${safePdfText(period.label)}`, { x: 50, y: height - 240, size: 18, font, color: NAVY })
    page.drawText(`Generated: ${safePdfText(generatedAt)}`, { x: 50, y: height - 280, size: 11, font: fontReg, color: GRAY })
    page.drawRectangle({ x: 0, y: 0, width, height: 40, color: GOLD })
    page.drawText('www.epiccampus.live', { x: 50, y: 14, size: 10, font: fontReg, color: NAVY })
  }

  // Page 2 — Summary
  {
    const page = doc.addPage([595, 842])
    let y = 780
    page.drawText('Summary', { x: 50, y, size: 20, font, color: NAVY })
    y -= 40
    const lines = [
      `Total spend for period: ${lkr(totalSpent)}`,
      `Total meals served: ${totalStudents} students + ${totalStaff} staff`,
      `Cost per student per day: ${lkr(costPerStudentDay)}`,
      `Total waste value: ${lkr(totalWaste)}`,
      mostUsed
        ? `Most used ingredient: ${mostUsed[0]} (${mostUsed[1].toFixed(1)} units)`
        : 'Most used ingredient: —',
      mostWasted
        ? `Most wasted item: ${mostWasted[0]} (${lkr(mostWasted[1])})`
        : 'Most wasted item: —',
    ]
    lines.forEach((line) => {
      page.drawText(safePdfText(line), { x: 50, y, size: 12, font: fontReg, color: GRAY })
      y -= 28
    })
  }

  // Page 3 — Daily breakdown
  {
    const page = doc.addPage([595, 842])
    let y = 780
    page.drawText('Daily Breakdown', { x: 50, y, size: 18, font, color: NAVY })
    y -= 30
    const headers = ['Date', 'Meal', 'Students', 'Staff', 'Cost', 'Waste']
    const colX = [50, 110, 200, 260, 320, 420]
    headers.forEach((h, i) => {
      page.drawText(h, { x: colX[i], y, size: 9, font, color: NAVY })
    })
    y -= 8
    page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 1, color: GRAY })
    y -= 16

    let sumStudents = 0
    let sumStaff = 0
    let sumCost = 0
    let sumWaste = 0

    meals.forEach((m) => {
      if (y < 80) return
      const dayWaste = wasteByDate[m.date] ?? 0
      sumStudents += m.studentCount
      sumStaff += m.staffCount
      sumCost += m.estimatedCost
      sumWaste += dayWaste
      const row = [
        m.date.slice(5),
        m.mealType,
        String(m.studentCount),
        String(m.staffCount),
        lkr(m.estimatedCost),
        lkr(dayWaste),
      ]
      row.forEach((cell, i) => {
        page.drawText(truncate(cell, i === 4 || i === 5 ? 14 : 12), {
          x: colX[i],
          y,
          size: 8,
          font: fontReg,
          color: GRAY,
        })
      })
      y -= 14
    })

    y -= 6
    page.drawLine({ start: { x: 50, y: y + 10 }, end: { x: 545, y: y + 10 }, thickness: 1, color: NAVY })
    const totals = ['TOTAL', '', String(sumStudents), String(sumStaff), lkr(sumCost), lkr(sumWaste)]
    totals.forEach((cell, i) => {
      page.drawText(truncate(cell, 14), { x: colX[i], y, size: 9, font, color: NAVY })
    })
  }

  // Page 4 — Inventory status
  {
    const page = doc.addPage([595, 842])
    let y = 780
    page.drawText('Inventory Status', { x: 50, y, size: 18, font, color: NAVY })
    y -= 28
    const headers = ['Item', 'Stock', 'Min', 'Unit', 'Status']
    const colX = [50, 220, 290, 350, 420]
    headers.forEach((h, i) => {
      page.drawText(h, { x: colX[i], y, size: 9, font, color: NAVY })
    })
    y -= 16

    inventory.forEach((item) => {
      if (y < 60) return
      const belowMin = item.currentStock <= item.minStockLevel
      const expiringSoon =
        item.expiryDate != null && daysUntilExpiry(item.expiryDate) <= 7 && daysUntilExpiry(item.expiryDate) >= 0
      const expired = item.expiryDate != null && daysUntilExpiry(item.expiryDate) < 0

      let status = 'OK'
      let statusColor = GREEN
      if (expired) {
        status = 'EXPIRED'
        statusColor = RED
      } else if (belowMin) {
        status = 'LOW STOCK'
        statusColor = RED
      } else if (expiringSoon) {
        status = 'EXPIRING'
        statusColor = AMBER
      }

      if (belowMin || expiringSoon) {
        page.drawRectangle({ x: 48, y: y - 4, width: 500, height: 14, color: belowMin ? rgb(1, 0.92, 0.92) : rgb(1, 0.96, 0.88) })
      }

      page.drawText(truncate(item.itemName, 22), { x: colX[0], y, size: 8, font: fontReg, color: GRAY })
      page.drawText(String(item.currentStock), { x: colX[1], y, size: 8, font: fontReg, color: GRAY })
      page.drawText(String(item.minStockLevel), { x: colX[2], y, size: 8, font: fontReg, color: GRAY })
      page.drawText(item.unit, { x: colX[3], y, size: 8, font: fontReg, color: GRAY })
      page.drawText(status, { x: colX[4], y, size: 8, font, color: statusColor })
      y -= 16
    })
  }

  // Page 5 — Waste log
  {
    const page = doc.addPage([595, 842])
    let y = 780
    page.drawText('Waste Log', { x: 50, y, size: 18, font, color: NAVY })
    y -= 28

    if (waste.length === 0) {
      page.drawText('No waste entries for this period.', { x: 50, y, size: 11, font: fontReg, color: GRAY })
    } else {
      waste.slice(0, 25).forEach((w) => {
        if (y < 120) return
        page.drawText(
          safePdfText(`${w.date.slice(5)} | ${w.itemName} | ${w.quantity} ${w.unit} | ${w.reason} | ${lkr(w.estimatedLoss)}`),
          { x: 50, y, size: 8, font: fontReg, color: GRAY },
        )
        y -= 14
      })
    }

    y -= 20
    page.drawText('Reason breakdown:', { x: 50, y, size: 12, font, color: NAVY })
    y -= 22
    const totalReasonValue = Object.values(wasteByReason).reduce((s, v) => s + v, 0) || 1
    Object.entries(wasteByReason).forEach(([reason, value]) => {
      const pct = ((value / totalReasonValue) * 100).toFixed(0)
      page.drawText(
        safePdfText(`${reason.charAt(0).toUpperCase() + reason.slice(1)}: ${pct}% (${lkr(value)})`),
        { x: 50, y, size: 10, font: fontReg, color: GRAY },
      )
      y -= 18
    })
  }

  return doc.save()
}

export async function downloadKitchenReportPDF(period: ReportPeriod): Promise<void> {
  const bytes = await generateKitchenReportPDF(period)
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `EpicCampus-Kitchen-${period.filenameSlug}.pdf`
  link.click()
  URL.revokeObjectURL(url)
}
