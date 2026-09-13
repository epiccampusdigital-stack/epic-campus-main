import { NextRequest, NextResponse } from 'next/server'
import { verifyJpRole } from '@/lib/jp/serverAuth'
import { listFulfilmentQueue } from '@/lib/jp/fulfilment'
import { getJpOrder } from '@/lib/jp/orders'
import type { JpFulfilmentStatus } from '@/types'

export const dynamic = 'force-dynamic'

const STAFF_ROLES = ['admin', 'owner', 'accountant', 'reception']

// Joins each jpFulfilment row with its jpOrder (for delivery name/address/
// district/phone) so the management Fulfilment tab doesn't need a second
// round trip per row.
export async function GET(req: NextRequest) {
  const staff = await verifyJpRole(req, STAFF_ROLES)
  if (!staff) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const status = req.nextUrl.searchParams.get('status') as JpFulfilmentStatus | null

  try {
    const queue = await listFulfilmentQueue(status ?? undefined)
    const rows = await Promise.all(
      queue.map(async (fulfilment) => ({ ...fulfilment, order: await getJpOrder(fulfilment.orderId) })),
    )
    return NextResponse.json({ rows })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load fulfilment queue'
    console.error('[api/jp/fulfilment GET]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
