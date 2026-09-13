import { NextRequest, NextResponse } from 'next/server'
import { verifySignedIn } from '@/lib/jp/serverAuth'
import { getJpOrder, markOrderAwaitingVerification } from '@/lib/jp/orders'

export const dynamic = 'force-dynamic'

// Called after the student has already uploaded their slip to Storage at
// payment-receipts/{uid}/... (the same path/mechanism used by
// src/app/(student)/my-payments/page.tsx) — this just links the resulting
// download URL onto their jpOrder and flips it to awaiting_verification.
// A student can never update a jpOrders doc directly under the client
// rules, so this (Admin SDK) route is the only way that transition happens.
export async function POST(req: NextRequest) {
  const uid = await verifySignedIn(req)
  if (!uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { orderId, receiptUploadPath } = await req.json()
    if (!orderId || !receiptUploadPath) {
      return NextResponse.json({ error: 'orderId and receiptUploadPath are required' }, { status: 400 })
    }

    const order = await getJpOrder(orderId)
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }
    if (order.uid !== uid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (order.rail !== 'bank_transfer') {
      return NextResponse.json({ error: 'This order is not a bank transfer' }, { status: 400 })
    }

    const updated = await markOrderAwaitingVerification(orderId, String(receiptUploadPath))
    return NextResponse.json({ order: updated })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to submit receipt'
    console.error('[api/jp/orders/bank-receipt]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
