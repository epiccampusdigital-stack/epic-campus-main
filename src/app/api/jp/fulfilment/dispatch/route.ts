import { NextRequest, NextResponse } from 'next/server'
import { verifyJpRole } from '@/lib/jp/serverAuth'
import { markDispatched } from '@/lib/jp/fulfilment'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const staff = await verifyJpRole(req, ['admin', 'owner', 'reception'])
  if (!staff) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { orderId, postalRef } = await req.json()
    if (!orderId || !postalRef) {
      return NextResponse.json({ error: 'orderId and postalRef are required' }, { status: 400 })
    }
    await markDispatched(orderId, String(postalRef))
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to mark dispatched'
    console.error('[api/jp/fulfilment/dispatch]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
