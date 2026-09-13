import { NextRequest, NextResponse } from 'next/server'
import { verifyJpRole } from '@/lib/jp/serverAuth'
import { markPacked } from '@/lib/jp/fulfilment'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const staff = await verifyJpRole(req, ['admin', 'owner', 'reception'])
  if (!staff) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { orderId } = await req.json()
    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 })
    }
    await markPacked(orderId, staff.uid)
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to mark packed'
    console.error('[api/jp/fulfilment/pack]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
