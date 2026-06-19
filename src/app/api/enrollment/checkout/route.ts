import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/admin'

export const dynamic = 'force-dynamic'

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
      paymentOption,
      paymentAmount,
    } = body

    if (!firstName || !lastName || !email || !phone || !program || !location || !paymentOption) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const amount = Number(paymentAmount ?? 0)
    if (paymentOption === 'custom' && (isNaN(amount) || amount < 1000)) {
      return NextResponse.json(
        { error: 'Invalid payment amount — minimum LKR 1,000' },
        { status: 400 },
      )
    }

    const enrollmentRef = adminDb.collection('enrollmentApplications').doc()
    const enrollmentId = enrollmentRef.id

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
      requestedAmount: paymentOption === 'custom' ? amount : paymentOption === 'full' ? 85000 : 25000,
      paymentOption: String(paymentOption),
      stripeSessionId: null,
      stripePaymentStatus: 'pending',
      status: 'pending',
      studentId: null,
      createdAt: FieldValue.serverTimestamp(),
    })

    return NextResponse.json({ enrollmentId })
  } catch (err) {
    console.error('[enrollment/checkout]', err)
    const message = err instanceof Error ? err.message : 'Failed to submit application'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
