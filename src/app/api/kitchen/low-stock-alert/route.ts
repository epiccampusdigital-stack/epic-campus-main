import { NextRequest, NextResponse } from 'next/server'
import { sendWhatsApp } from '@/lib/twilio'

interface LowStockItem {
  itemName: string
  emoji: string
  currentStock: number
  minStockLevel: number
  unit: string
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const lowStockItems = (body.lowStockItems ?? []) as LowStockItem[]

    if (!lowStockItems.length) {
      return NextResponse.json({ sent: false, itemCount: 0 })
    }

    const adminPhone = process.env.ADMIN_WHATSAPP_NUMBER
    if (!adminPhone) {
      console.warn('[low-stock-alert] ADMIN_WHATSAPP_NUMBER not configured')
      return NextResponse.json({ sent: false, itemCount: lowStockItems.length })
    }

    const lines = lowStockItems.map(
      (i) =>
        `${i.emoji} ${i.itemName}: ${i.currentStock}${i.unit} remaining (min: ${i.minStockLevel}${i.unit})`,
    )

    const message = `🚨 *Epic Campus Kitchen Alert*

The following items are running low at Ahangama Campus:

${lines.join('\n')}

Please arrange restocking or submit an order request.

_Sent automatically by Epic Campus Kitchen System_`

    const result = await sendWhatsApp(adminPhone, message)
    return NextResponse.json({ sent: result.ok, itemCount: lowStockItems.length })
  } catch (err) {
    console.error('[low-stock-alert]', err)
    return NextResponse.json({ sent: false, itemCount: 0 }, { status: 500 })
  }
}
