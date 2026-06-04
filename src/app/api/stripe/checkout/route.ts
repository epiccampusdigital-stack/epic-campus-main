import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
  apiVersion: '2026-05-27.dahlia',
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      amount,
      currency,
      studentId,
      studentName,
      description,
      successUrl,
      cancelUrl,
      metadata: extraMetadata,
    } = body

    if (!amount) {
      return NextResponse.json({ error: 'Missing amount' }, { status: 400 })
    }

    const fixedBillId =
      extraMetadata?.fixedBillId != null ? String(extraMetadata.fixedBillId) : undefined

    if (!studentId && !fixedBillId) {
      return NextResponse.json(
        { error: 'Missing studentId or fixedBillId' },
        { status: 400 },
      )
    }

    const sessionMetadata: Record<string, string> = {
      studentId: studentId ? String(studentId) : '',
      studentName: studentName ? String(studentName) : '',
      fixedBillId: fixedBillId ?? '',
      billType: extraMetadata?.billType ? String(extraMetadata.billType) : '',
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: (currency || 'lkr').toLowerCase(),
            product_data: {
              name: description || 'EPIC Campus Payment',
              description: studentName
                ? `Payment for ${studentName}`
                : description || 'Epic Campus',
            },
            unit_amount: Math.round(Number(amount) * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: successUrl || `${req.nextUrl.origin}/student/payments?success=true`,
      cancel_url: cancelUrl || `${req.nextUrl.origin}/student/payments?cancelled=true`,
      metadata: sessionMetadata,
    })

    return NextResponse.json({ sessionId: session.id, url: session.url })
  } catch (err) {
    console.error('[Stripe checkout]', err)
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
  }
}
