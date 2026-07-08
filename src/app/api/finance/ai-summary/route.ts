import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase/admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ALLOWED_ROLES = ['admin', 'owner', 'accountant']

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const SYSTEM_PROMPT = `You are an expert financial analyst for EPIC Campus, a Sri Lankan overseas education institute.
Analyze the financial data provided and return a JSON object with this exact structure:
{
  "summary": {
    "totalIncome": number,
    "totalExpenses": number,
    "netProfit": number,
    "profitMargin": number,
    "pendingFees": number,
    "collectionRate": number
  },
  "income": {
    "fromEnrollments": number,
    "fromInstallments": number,
    "fromRegistration": number,
    "total": number,
    "breakdown": [{ "source": string, "amount": number }]
  },
  "expenses": {
    "salaries": number,
    "accommodation": number,
    "utilities": number,
    "kitchen": number,
    "miscellaneous": number,
    "total": number,
    "breakdown": [{ "category": string, "amount": number }]
  },
  "students": {
    "total": number,
    "paid": number,
    "pending": number,
    "partial": number,
    "conversionRate": number
  },
  "trends": {
    "incomeVsLastMonth": number,
    "expenseVsLastMonth": number,
    "topRevenueSource": string,
    "topExpenseCategory": string
  },
  "forecasts": {
    "projectedMonthlyIncome": number,
    "projectedYearlyIncome": number,
    "expectedCollections": number,
    "commentary": string
  },
  "anomalies": [
    {
      "type": "warning"|"info"|"critical",
      "title": string,
      "description": string,
      "amount": number
    }
  ],
  "insights": [string],
  "dataQuality": {
    "score": number,
    "issues": [string]
  }
}
Be precise with numbers. Use LKR currency.
Identify anomalies like: unusually high expenses, students marked paid but no payment record, accommodation unpaid for multiple months, salary not paid this month, income significantly lower than previous months.
Return ONLY valid JSON, no markdown, no explanation.`

type AdminSnap = { docs: Array<{ id: string; data: () => Record<string, unknown> }> }
const EMPTY_SNAP: AdminSnap = { docs: [] }

// Firestore values may be an admin Timestamp, a {seconds} object, or an ISO string.
function monthKeyOf(value: unknown): string {
  if (!value) return ''
  if (typeof value === 'object' && value !== null && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString().slice(0, 7)
  }
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    return new Date((value as { seconds: number }).seconds * 1000).toISOString().slice(0, 7)
  }
  return String(value).slice(0, 7)
}

function prevMonthOf(month: string): string {
  const [y, m] = month.split('-').map(Number)
  if (!y || !m) return ''
  const d = new Date(Date.UTC(y, m - 1, 1))
  d.setUTCMonth(d.getUTCMonth() - 1)
  return d.toISOString().slice(0, 7)
}

// utilityBills is written in two shapes: {month:'YYYY-MM'} OR {month:'July', year:2026}.
function utilBillInMonth(d: Record<string, unknown>, month: string): boolean {
  const [yr, mo] = month.split('-')
  const monthName = MONTH_NAMES[Number(mo) - 1]
  const dMonth = String(d.month ?? '')
  if (dMonth === month) return true
  if (dMonth.slice(0, 7) === month) return true
  if (dMonth === monthName && String(d.year ?? '') === String(Number(yr))) return true
  return false
}

async function authorize(req: NextRequest): Promise<{ ok: boolean; status: number; error?: string }> {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return { ok: false, status: 401, error: 'Unauthorized' }
  try {
    const decoded = await adminAuth.verifyIdToken(token)
    let role = String((decoded as { role?: string }).role ?? '')
    if (!role) {
      const snap = await adminDb.collection('users').doc(decoded.uid).get()
      role = String(snap.data()?.role ?? '')
    }
    if (!ALLOWED_ROLES.includes(role)) return { ok: false, status: 403, error: 'Forbidden' }
    return { ok: true, status: 200 }
  } catch {
    return { ok: false, status: 401, error: 'Invalid token' }
  }
}

export async function POST(req: NextRequest) {
  const authResult = await authorize(req)
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    const body = (await req.json()) as { month?: string }
    const month = typeof body.month === 'string' && /^\d{4}-\d{2}$/.test(body.month)
      ? body.month
      : new Date().toISOString().slice(0, 7)
    const prevMonth = prevMonthOf(month)

    const [studentsSnap, paymentsSnap, expensesSnap, payrollSnap, housesSnap, utilSnap, wasteSnap] =
      await Promise.all([
        adminDb.collection('students').get().catch(() => EMPTY_SNAP),
        adminDb.collection('payments').get().catch(() => EMPTY_SNAP),
        adminDb.collection('expenses').get().catch(() => EMPTY_SNAP),
        adminDb.collection('payroll').get().catch(() => EMPTY_SNAP),
        adminDb.collection('accommodations').get().catch(() => EMPTY_SNAP),
        adminDb.collection('utilityBills').get().catch(() => EMPTY_SNAP),
        adminDb.collection('wasteLog').get().catch(() => EMPTY_SNAP),
      ])

    // ── Students ──
    const paymentPlanIds = new Set(paymentsSnap.docs.map((d) => d.id))
    let sTotal = 0, sPaid = 0, sPending = 0, sPartial = 0
    let enrollmentsPaidThisMonth = 0, enrollmentsPaidCount = 0, registrationFeesThisMonth = 0
    let studentPending = 0
    let totalFeeAllStudents = 0
    const markedPaidNoRecord: string[] = []
    for (const docSnap of studentsSnap.docs) {
      const s = docSnap.data()
      sTotal++
      const status = String(s.paymentStatus ?? '').toLowerCase()
      const fee = Number(s.feeAmount ?? s.totalFee ?? 0)
      totalFeeAllStudents += fee
      const paidAmt = Number(s.amountPaid ?? s.paidAmount ?? 0)
      if (status === 'paid') {
        sPaid++
        const enrollMk = monthKeyOf(s.enrollmentDate) || monthKeyOf(s.createdAt)
        if (enrollMk === month) {
          enrollmentsPaidThisMonth += fee
          enrollmentsPaidCount++
          registrationFeesThisMonth += Number(s.registrationFee ?? 0)
        }
        if (!paymentPlanIds.has(docSnap.id)) markedPaidNoRecord.push(String(s.name ?? docSnap.id))
      } else if (status === 'partial') {
        sPartial++
        studentPending += paidAmt > 0 ? Math.max(0, fee - paidAmt) : fee
      } else {
        sPending++
        studentPending += paidAmt > 0 ? Math.max(0, fee - paidAmt) : fee
      }
    }

    // ── Payment installments by month ──
    const incomeByMonth: Record<string, number> = {}
    for (const docSnap of paymentsSnap.docs) {
      const d = docSnap.data()
      const installments = Array.isArray(d.installments) ? (d.installments as Array<Record<string, unknown>>) : []
      for (const inst of installments) {
        if (!inst?.paidAt) continue
        const mk = monthKeyOf(inst.paidAt)
        incomeByMonth[mk] = (incomeByMonth[mk] ?? 0) + Number(inst.amount ?? 0)
      }
    }
    const installmentsThisMonth = incomeByMonth[month] ?? 0
    const installmentsLastMonth = incomeByMonth[prevMonth] ?? 0

    // ── Expenses ──
    let salariesFromExpenses = 0, kitchenExpenses = 0, utilitiesFromExpenses = 0, miscExpenses = 0
    let expensesThisMonthTotal = 0, expensesLastMonthTotal = 0
    const byCategoryThisMonth: Record<string, number> = {}
    const recentExpenses: Array<{ category: string; amount: number; date: string; description: string }> = []
    for (const docSnap of expensesSnap.docs) {
      const d = docSnap.data()
      const mk = String(d.month ?? String(d.date ?? '').slice(0, 7))
      const amt = Number(d.amount ?? 0)
      const cat = String(d.category ?? 'Other')
      if (mk === month) {
        expensesThisMonthTotal += amt
        byCategoryThisMonth[cat] = (byCategoryThisMonth[cat] ?? 0) + amt
        const lc = cat.toLowerCase()
        if (cat === 'Salary') salariesFromExpenses += amt
        else if (lc.includes('kitchen')) kitchenExpenses += amt
        else if (lc.includes('utilit') || lc.includes('telecom')) utilitiesFromExpenses += amt
        else if (cat !== 'Rent') miscExpenses += amt
        if (recentExpenses.length < 25) {
          recentExpenses.push({ category: cat, amount: amt, date: String(d.date ?? ''), description: String(d.description ?? '') })
        }
      } else if (mk === prevMonth) {
        expensesLastMonthTotal += amt
      }
    }

    // ── Payroll (current period) ──
    let payrollThisMonth = 0
    const payrollRecords: Array<{ staffName: string; netPay: number; status: string }> = []
    const unpaidStaff: string[] = []
    for (const docSnap of payrollSnap.docs) {
      const d = docSnap.data()
      if (String(d.period ?? '') !== month) continue
      const net = Number(d.netPay ?? 0)
      const status = String(d.status ?? '')
      payrollThisMonth += net
      payrollRecords.push({ staffName: String(d.staffName ?? ''), netPay: net, status })
      if (status !== 'paid') unpaidStaff.push(String(d.staffName ?? ''))
    }
    const salaries = payrollThisMonth > 0 ? payrollThisMonth : salariesFromExpenses

    // ── Accommodation ──
    let rentActive = 0
    const houses: Array<{ name: string; monthlyRent: number; status: string }> = []
    for (const docSnap of housesSnap.docs) {
      const d = docSnap.data()
      const status = String(d.status ?? 'active')
      const rent = Number(d.monthlyRent ?? 0)
      houses.push({ name: String(d.name ?? ''), monthlyRent: rent, status })
      if (status !== 'inactive') rentActive += rent
    }

    // ── Utility bills (requested month) ──
    let utilitiesThisMonth = 0
    const utilityBills: Array<{ houseId: string; ceb: number; water: number; internet: number; other: number }> = []
    for (const docSnap of utilSnap.docs) {
      const d = docSnap.data()
      if (!utilBillInMonth(d, month)) continue
      const ceb = Number(d.ceb ?? 0)
      const water = Number(d.water ?? 0)
      const internet = Number(d.internet ?? 0)
      const other = Number(d.other ?? 0)
      utilitiesThisMonth += ceb + water + internet + other
      utilityBills.push({ houseId: String(d.houseId ?? ''), ceb, water, internet, other })
    }

    // ── Waste (requested month) ──
    let wasteKg = 0, wasteEntries = 0
    for (const docSnap of wasteSnap.docs) {
      const d = docSnap.data()
      if (monthKeyOf(d.date) !== month) continue
      wasteKg += Number(d.weightKg ?? 0)
      wasteEntries++
    }

    const financeData = {
      month,
      prevMonth,
      currency: 'LKR',
      students: {
        total: sTotal,
        paid: sPaid,
        pending: sPending,
        partial: sPartial,
        totalFullyPaidStudents: sPaid,
        totalPendingStudents: sPending,
        totalPartialStudents: sPartial,
        averageFeeAmount: sTotal > 0 ? Math.round(totalFeeAllStudents / sTotal) : 0,
        totalExpectedRevenue: totalFeeAllStudents,
        enrollmentsPaidThisMonthCount: enrollmentsPaidCount,
        enrollmentsPaidThisMonthFees: enrollmentsPaidThisMonth,
        markedPaidWithoutPaymentRecord: markedPaidNoRecord.slice(0, 25),
      },
      income: {
        fromInstallmentsThisMonth: installmentsThisMonth,
        fromEnrollmentsThisMonth: enrollmentsPaidThisMonth,
        fromRegistrationThisMonth: registrationFeesThisMonth,
        installmentsLastMonth,
        byMonth: incomeByMonth,
      },
      expenses: {
        salaries,
        salariesFromPayroll: payrollThisMonth,
        salariesFromExpenses,
        accommodationRent: rentActive,
        utilities: utilitiesThisMonth + utilitiesFromExpenses,
        kitchen: kitchenExpenses,
        miscellaneous: miscExpenses,
        expensesThisMonthTotal,
        expensesLastMonthTotal,
        byCategoryThisMonth,
        recent: recentExpenses,
      },
      payroll: {
        thisMonthTotal: payrollThisMonth,
        records: payrollRecords,
        unpaidStaff,
      },
      accommodation: { houses, totalRentActive: rentActive },
      utilities: { thisMonthTotal: utilitiesThisMonth, bills: utilityBills },
      waste: { thisMonthKg: wasteKg, entries: wasteEntries },
      pendingFeesFromStudents: studentPending,
    }

    // ── Claude analysis ──
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey || apiKey.trim() === '' || apiKey === 'your_anthropic_api_key_here') {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
    }

    let response: Response
    try {
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 3000,
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: 'user',
              content: `Analyze this financial data for ${month}:\n${JSON.stringify(financeData)}`,
            },
          ],
        }),
      })
    } catch (fetchErr) {
      console.error('[api/finance/ai-summary] Fetch failed:', fetchErr)
      return NextResponse.json({ error: 'AI service unreachable' }, { status: 502 })
    }

    const aiJson = (await response.json()) as {
      content?: { type: string; text: string }[]
      error?: { message?: string }
    }
    if (!response.ok) {
      console.error('[api/finance/ai-summary] Anthropic error:', response.status, aiJson)
      return NextResponse.json({ error: aiJson.error?.message ?? 'AI analysis failed' }, { status: 502 })
    }

    const text = aiJson.content?.[0]?.text ?? ''
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start === -1 || end === -1) {
      return NextResponse.json({ error: 'AI returned no JSON' }, { status: 502 })
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(text.slice(start, end + 1))
    } catch (parseErr) {
      console.error('[api/finance/ai-summary] JSON parse failed:', parseErr)
      return NextResponse.json({ error: 'AI returned invalid JSON' }, { status: 502 })
    }

    return NextResponse.json(parsed)
  } catch (err) {
    console.error('[api/finance/ai-summary]', err)
    const message = err instanceof Error ? err.message : 'Analysis failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
