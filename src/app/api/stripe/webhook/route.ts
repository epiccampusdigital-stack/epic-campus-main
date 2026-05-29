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
    const { studentId, studentName } = session.metadata || {}
    const amount = (session.amount_total || 0) / 100

    if (studentId) {
      try {
        await adminDb.collection('payments').add({
          studentId,
          studentName: studentName || '',
          amount,
          currency: session.currency || 'usd',
          stripeSessionId: session.id,
          status: 'paid',
          paidAt: FieldValue.serverTimestamp(),
          createdAt: FieldValue.serverTimestamp(),
          method: 'stripe',
          type: 'tuition',
          paymentDate: new Date().toISOString().slice(0, 10),
        })
        console.log(`[Stripe webhook] Payment recorded for student ${studentId}: ${amount}`)
      } catch (err) {
        console.error('[Stripe webhook] Firestore write failed:', err)
      }
    }
  }

  return NextResponse.json({ received: true })
}
