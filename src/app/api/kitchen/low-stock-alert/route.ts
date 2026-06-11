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
    const lowStockItems = body.lowStockItems as LowStockItem[] | undefined

    if (!lowStockItems?.length) {
      return NextResponse.json({ error: 'No low stock items' }, { status: 400 })
    }

    const adminPhone = process.env.ADMIN_WHATSAPP_NUMBER
    if (!adminPhone) {
      console.warn('[low-stock-alert] ADMIN_WHATSAPP_NUMBER not configured')
      return NextResponse.json({ sent: false, itemCount: lowStockItems.length, error: 'Admin number not configured' })
    }

    const lines = lowStockItems.map(
      (item) =>
        `${item.emoji} ${item.itemName}: ${item.currentStock}${item.unit} remaining (min: ${item.minStockLevel}${item.unit})`,
    )

    const message = [
      '🚨 *Epic Campus Kitchen Alert*',
      '',
      'The following items are running low at Ahangama Campus:',
      '',
      ...lines,
      '',
      'Please arrange restocking or submit an order request.',
      '',
      '_Sent automatically by Epic Campus Kitchen System_',
    ].join('\n')

    const result = await sendWhatsApp(adminPhone, message)
    return NextResponse.json({
      sent: result.ok,
      itemCount: lowStockItems.length,
      error: result.error,
    })
  } catch (err) {
    console.error('[low-stock-alert]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
