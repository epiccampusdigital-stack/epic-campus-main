import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase/admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ALLOWED_ROLES = ['admin', 'owner', 'kitchen', 'accountant']

const SYSTEM_PROMPT = `You are an expert kitchen procurement manager and budget analyst for EPIC Campus, a student residential institute in Sri Lanka.
Analyze the kitchen data and return a JSON object:
{
  "summary": {
    "totalOrderCost": number,
    "costPerStudent": number,
    "costPerStudentPerDay": number,
    "daysOfStock": number,
    "budgetRating": "excellent"|"good"|"high"|"critical"
  },
  "optimizedList": [
    {
      "itemName": string,
      "currentStock": number,
      "unit": string,
      "recommendedQty": number,
      "unitPrice": number,
      "totalCost": number,
      "priority": "urgent"|"normal"|"optional",
      "reasoning": string
    }
  ],
  "savings": [ { "suggestion": string, "estimatedSaving": number } ],
  "warnings": [ { "type": "overstock"|"shortage"|"waste"|"budget", "item": string, "message": string } ],
  "budgetBreakdown": {
    "proteins": number,
    "vegetables": number,
    "grains": number,
    "dairy": number,
    "condiments": number,
    "other": number
  },
  "recommendation": string
}
Consider:
- Sri Lanka market prices and seasonal availability
- Reduce waste by not over-ordering perishables
- Flag items where waste is high vs usage
- Suggest bulk buying for non-perishables if it saves money
- Priority urgent = stock will run out in <7 days
- Be specific with reasoning for each item
Return ONLY valid JSON, no markdown`

type AdminSnap = { docs: Array<{ id: string; data: () => Record<string, unknown> }> }
const EMPTY_SNAP: AdminSnap = { docs: [] }

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

function dateInRange(value: unknown, from: string, to: string): boolean {
  const d = String(value ?? '').slice(0, 10)
  return d >= from && d <= to
}

interface OrderItemInput {
  itemName: string
  currentStock: number
  unit: string
  orderQty: number
  unitCost: number
  totalCost: number
}

export async function POST(req: NextRequest) {
  const authResult = await authorize(req)
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  try {
    const body = (await req.json()) as {
      from?: string
      to?: string
      studentCount?: number
      orderItems?: OrderItemInput[]
    }
    const from = typeof body.from === 'string' ? body.from : ''
    const to = typeof body.to === 'string' ? body.to : ''
    const studentCount = Number(body.studentCount ?? 0)
    const orderItems = Array.isArray(body.orderItems) ? body.orderItems : []

    const [invSnap, mealSnap, wasteSnap] = await Promise.all([
      adminDb.collection('inventory').get().catch(() => EMPTY_SNAP),
      adminDb.collection('mealLogs').get().catch(() => EMPTY_SNAP),
      adminDb.collection('wasteLog').get().catch(() => EMPTY_SNAP),
    ])

    // Inventory (with category + price) so the AI can map items to budget categories.
    const inventory = invSnap.docs.map((d) => {
      const it = d.data()
      return {
        itemName: String(it.itemName ?? ''),
        category: String(it.category ?? 'other'),
        unit: String(it.unit ?? ''),
        currentStock: Number(it.currentStock ?? 0),
        minStockLevel: Number(it.minStockLevel ?? 0),
        unitPrice: Number(it.unitCost ?? 0),
      }
    })

    // Usage in the selected range, aggregated per item.
    const usage: Record<string, { unit: string; totalUsed: number }> = {}
    let totalServings = 0
    let mealCount = 0
    for (const d of mealSnap.docs) {
      const log = d.data()
      if (!dateInRange(log.date, from, to)) continue
      mealCount++
      totalServings += Number(log.studentCount ?? 0) + Number(log.staffCount ?? 0)
      const ings = Array.isArray(log.ingredientsUsed)
        ? (log.ingredientsUsed as Array<Record<string, unknown>>)
        : []
      for (const ing of ings) {
        const name = String(ing.itemName ?? '')
        if (!usage[name]) usage[name] = { unit: String(ing.unit ?? ''), totalUsed: 0 }
        usage[name].totalUsed += Number(ing.qtyUsed ?? 0)
      }
    }

    // Waste in the selected range, aggregated per item + reason.
    const waste: Record<string, number> = {}
    let totalWasteKg = 0
    for (const d of wasteSnap.docs) {
      const w = d.data()
      if (!dateInRange(w.date, from, to)) continue
      const name = String(w.itemName ?? w.spoiledItems ?? 'unspecified')
      const kg = Number(w.weightKg ?? w.quantity ?? 0)
      waste[name] = (waste[name] ?? 0) + kg
      totalWasteKg += kg
    }

    const orderTotal = orderItems.reduce((s, i) => s + (Number(i.totalCost) || 0), 0)

    const kitchenData = {
      dateRange: { from, to },
      studentCount,
      orderItems,
      orderTotal,
      inventory,
      usage: {
        perItem: usage,
        totalServings,
        mealsLogged: mealCount,
      },
      waste: {
        perItem: waste,
        totalWasteKg,
      },
      currency: 'LKR',
    }

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
              content: `Analyze this kitchen procurement data:\n${JSON.stringify(kitchenData)}`,
            },
          ],
        }),
      })
    } catch (fetchErr) {
      console.error('[api/kitchen/ai-budget] Fetch failed:', fetchErr)
      return NextResponse.json({ error: 'AI service unreachable' }, { status: 502 })
    }

    const aiJson = (await response.json()) as {
      content?: { type: string; text: string }[]
      error?: { message?: string }
    }
    if (!response.ok) {
      console.error('[api/kitchen/ai-budget] Anthropic error:', response.status, aiJson)
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
      console.error('[api/kitchen/ai-budget] JSON parse failed:', parseErr)
      return NextResponse.json({ error: 'AI returned invalid JSON' }, { status: 502 })
    }

    return NextResponse.json(parsed)
  } catch (err) {
    console.error('[api/kitchen/ai-budget]', err)
    const message = err instanceof Error ? err.message : 'Analysis failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
