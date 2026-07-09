'use client'

import { formatQty } from '@/lib/kitchen-utils'
import { formatLKR } from '@/lib/utils/formatCurrency'

/** Shape of the /api/kitchen/ai-budget response (Claude JSON). */
export interface KitchenAiBudget {
  summary: {
    totalOrderCost: number
    costPerStudent: number
    costPerStudentPerDay: number
    daysOfStock: number
    budgetRating: 'excellent' | 'good' | 'high' | 'critical'
  }
  optimizedList: {
    itemName: string
    currentStock: number
    unit: string
    recommendedQty: number
    unitPrice: number
    totalCost: number
    priority: 'urgent' | 'normal' | 'optional'
    reasoning: string
  }[]
  savings: { suggestion: string; estimatedSaving: number }[]
  warnings: { type: 'overstock' | 'shortage' | 'waste' | 'budget'; item: string; message: string }[]
  budgetBreakdown: {
    proteins: number
    vegetables: number
    grains: number
    dairy: number
    condiments: number
    other: number
  }
  recommendation: string
}

/**
 * Generate and download a portrait A4 "Kitchen Budget Analysis" PDF summarising
 * the AI result: budget summary, optimised order list, savings, warnings,
 * category breakdown and the recommendation. Lazy-loads jsPDF.
 */
export async function downloadKitchenBudgetPdf(
  data: KitchenAiBudget,
  opts?: { dateRange?: string; studentCount?: number; campus?: string },
): Promise<void> {
  const { default: jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const pageWidth = doc.internal.pageSize.getWidth() // ~210mm
  const pageHeight = doc.internal.pageSize.getHeight() // ~297mm
  const margin = 14
  const contentW = pageWidth - margin * 2
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const campus = opts?.campus ?? 'Ahangama Main Campus'

  let y = margin

  function ensureSpace(h: number) {
    if (y + h > pageHeight - margin) {
      doc.addPage('a4', 'portrait')
      y = margin
    }
  }

  function heading(text: string) {
    ensureSpace(10)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(11, 61, 107)
    doc.text(text, margin, y)
    y += 6
    doc.setTextColor(0, 0, 0)
  }

  function body(text: string, size = 9) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(size)
    doc.setTextColor(40, 40, 40)
    const lines = doc.splitTextToSize(text, contentW) as string[]
    for (const line of lines) {
      ensureSpace(size * 0.42 + 1.5)
      doc.text(line, margin, y)
      y += size * 0.42 + 1.5
    }
    doc.setTextColor(0, 0, 0)
  }

  // ── Title ──────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(11, 61, 107)
  doc.text('EPIC Campus Kitchen Budget Analysis', margin, y)
  y += 7
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(90, 106, 122)
  const meta: string[] = [`Date: ${dateStr}`]
  if (opts?.studentCount) meta.push(`Students: ${opts.studentCount}`)
  if (opts?.dateRange) meta.push(`Usage period: ${opts.dateRange}`)
  doc.text(meta.join('   |   '), margin, y)
  y += 8
  doc.setTextColor(0, 0, 0)

  // ── Budget summary ─────────────────────────────────────────────────────
  heading('Budget Summary')
  const s = data.summary
  body(
    `Total Order Cost: ${formatLKR(s?.totalOrderCost ?? 0)}    ` +
      `Cost / Student: ${formatLKR(s?.costPerStudent ?? 0)}    ` +
      `Cost / Student / Day: ${formatLKR(s?.costPerStudentPerDay ?? 0)}`,
  )
  body(`Days of Stock: ${formatQty(s?.daysOfStock ?? 0)}    Budget Rating: ${(s?.budgetRating ?? '—').toUpperCase()}`)
  y += 2

  // ── Optimised order list ───────────────────────────────────────────────
  if ((data.optimizedList ?? []).length > 0) {
    heading('AI Optimised Order List')
    doc.setFontSize(8)
    for (const it of data.optimizedList) {
      ensureSpace(9)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(11, 61, 107)
      doc.text(
        `[${(it.priority ?? 'normal').toUpperCase()}] ${it.itemName} — ${formatQty(it.recommendedQty)} ${it.unit} @ ${formatLKR(it.unitPrice)} = ${formatLKR(it.totalCost)}`,
        margin,
        y,
      )
      y += 4
      if (it.reasoning) {
        doc.setFont('helvetica', 'italic')
        doc.setTextColor(90, 106, 122)
        const rl = doc.splitTextToSize(it.reasoning, contentW - 4) as string[]
        for (const line of rl) {
          ensureSpace(4)
          doc.text(line, margin + 3, y)
          y += 3.6
        }
      }
      y += 1
    }
    doc.setTextColor(0, 0, 0)
    y += 1
  }

  // ── Savings ────────────────────────────────────────────────────────────
  if ((data.savings ?? []).length > 0) {
    heading('Savings Suggestions')
    for (const sv of data.savings) {
      body(`• ${sv.suggestion}  (save ${formatLKR(sv.estimatedSaving)})`)
    }
    y += 2
  }

  // ── Warnings ───────────────────────────────────────────────────────────
  if ((data.warnings ?? []).length > 0) {
    heading('Warnings')
    for (const w of data.warnings) {
      body(`• [${(w.type ?? '').toUpperCase()}] ${w.item}: ${w.message}`)
    }
    y += 2
  }

  // ── Category breakdown ─────────────────────────────────────────────────
  if (data.budgetBreakdown) {
    heading('Budget Breakdown by Category')
    const b = data.budgetBreakdown
    body(
      `Proteins: ${formatLKR(b.proteins ?? 0)}    Vegetables: ${formatLKR(b.vegetables ?? 0)}    Grains: ${formatLKR(b.grains ?? 0)}`,
    )
    body(
      `Dairy: ${formatLKR(b.dairy ?? 0)}    Condiments: ${formatLKR(b.condiments ?? 0)}    Other: ${formatLKR(b.other ?? 0)}`,
    )
    y += 2
  }

  // ── Recommendation ─────────────────────────────────────────────────────
  if (data.recommendation) {
    heading('AI Recommendation')
    body(data.recommendation)
  }

  // ── Footer ─────────────────────────────────────────────────────────────
  doc.setFontSize(8)
  doc.setTextColor(90, 106, 122)
  doc.text(`Generated: ${dateStr} | ${campus} | Powered by Claude AI`, margin, pageHeight - margin + 4)

  doc.save(`kitchen-budget-analysis-${now.toISOString().slice(0, 10)}.pdf`)
}
