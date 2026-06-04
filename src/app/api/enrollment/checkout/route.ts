import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/admin'

export const dynamic = 'force-dynamic'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
  apiVersion: '2026-05-27.dahlia',
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      firstName,
      lastName,
      email,
      phone,
      dateOfBirth,
      address,
      program,
      location,
      batchDuration,
      batchCustomDays,
      paymentAmount,
    } = body

    if (!firstName || !lastName || !email || !phone || !program || !location || !paymentAmount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const amount = Number(paymentAmount)
    if (isNaN(amount) || amount < 1000) {
      return NextResponse.json(
        { error: 'Invalid payment amount — minimum LKR 1,000' },
        { status: 400 },
      )
    }

    const enrollmentRef = adminDb.collection('enrollmentApplications').doc()
    const enrollmentId = enrollmentRef.id
    const fullName = `${String(firstName).trim()} ${String(lastName).trim()}`

    await enrollmentRef.set({
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      email: String(email).trim().toLowerCase(),
      phone: String(phone).trim(),
      dateOfBirth: String(dateOfBirth ?? ''),
      address: String(address ?? '').trim(),
      program: String(program),
      location: String(location),
      batchDuration: String(batchDuration ?? '45days'),
      batchCustomDays: batchCustomDays ? Number(batchCustomDays) : null,
      registrationFeePaid: false,
      courseFeePaid: false,
      totalPaid: 0,
      stripeSessionId: null,
      stripePaymentStatus: 'pending',
      status: 'pending',
      studentId: null,
      createdAt: FieldValue.serverTimestamp(),
    })

    const programLabels: Record<string, string> = {
      'japan-ssw': 'Japan SSW Program',
      korea: 'Korea Program',
      china: 'China Program',
      ielts: 'IELTS Residential',
      nvq: 'NVQ Skills Program',
    }
    const programLabel = programLabels[String(program)] || String(program)

    const origin = req.nextUrl.origin
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'lkr',
            product_data: {
              name: `EPIC Campus — ${programLabel}`,
              description: `Enrollment fee for ${fullName}`,
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      customer_email: String(email).trim().toLowerCase(),
      success_url: `${origin}/enroll/success?enrollment_id=${enrollmentId}`,
      cancel_url: `${origin}/enroll?cancelled=true`,
      metadata: {
        enrollmentId,
        firstName: String(firstName).trim(),
        lastName: String(lastName).trim(),
        program: String(program),
        amount: String(amount),
      },
    })

    await enrollmentRef.update({ stripeSessionId: session.id })

    return NextResponse.json({ url: session.url, enrollmentId })
  } catch (err) {
    console.error('[enrollment/checkout]', err)
    const message = err instanceof Error ? err.message : 'Failed to create checkout session'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
