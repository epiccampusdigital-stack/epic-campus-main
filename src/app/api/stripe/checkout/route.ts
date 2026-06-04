import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
  apiVersion: '2026-05-27.dahlia',
})

export async function POST(req: NextRequest) {
  try {
    const { amount, currency, studentId, studentName, description, successUrl, cancelUrl } =
      await req.json()

    if (!amount || !studentId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: (currency || 'lkr').toLowerCase(),
            product_data: {
              name: description || 'EPIC Campus Program Fee',
              description: `Payment for ${studentName || 'student'}`,
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: successUrl || `${req.nextUrl.origin}/student/payments?success=true`,
      cancel_url: cancelUrl || `${req.nextUrl.origin}/student/payments?cancelled=true`,
      metadata: {
        studentId,
        studentName: studentName || '',
      },
    })

    return NextResponse.json({ sessionId: session.id, url: session.url })
  } catch (err) {
    console.error('[Stripe checkout]', err)
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}
