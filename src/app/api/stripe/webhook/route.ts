import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { adminDb } from '@/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
  apiVersion: '2026-05-27.dahlia',
})

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature') || ''
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || ''

  let event: Stripe.Event

  try {
    if (!webhookSecret || webhookSecret.startsWith('whsec_placeholder')) {
      console.log('[Stripe webhook] Secret not configured — skipping verification')
      event = JSON.parse(body) as Stripe.Event
    } else {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
    }
  } catch (err) {
    console.error('[Stripe webhook] Invalid signature:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const meta = session.metadata || {}
    const studentId = meta.studentId || ''
    const studentName = meta.studentName || ''
    const fixedBillId = meta.fixedBillId || ''
    const amount = (session.amount_total || 0) / 100
    const paymentDate = new Date().toISOString().slice(0, 10)

    if (fixedBillId) {
      try {
        await adminDb.collection('fixedUtilityBills').doc(fixedBillId).set(
          {
            paid: true,
            actualAmount: amount,
            paymentDate,
            stripeSessionId: session.id,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        )
        console.log(`[Stripe webhook] Fixed utility bill ${fixedBillId} marked paid`)
      } catch (err) {
        console.error('[Stripe webhook] Fixed bill update failed:', err)
      }
    }

    if (studentId) {
      try {
        await adminDb.collection('payments').add({
          studentId,
          studentName: studentName || '',
          amount,
          currency: (session.currency || 'lkr').toUpperCase(),
          stripeSessionId: session.id,
          status: 'paid',
          paidAt: FieldValue.serverTimestamp(),
          createdAt: FieldValue.serverTimestamp(),
          method: 'stripe',
          type: 'tuition',
          paymentDate,
        })
        console.log(`[Stripe webhook] Payment recorded for student ${studentId}: ${amount}`)
      } catch (err) {
        console.error('[Stripe webhook] Firestore write failed:', err)
      }
    }
  }

  return NextResponse.json({ received: true })
}
