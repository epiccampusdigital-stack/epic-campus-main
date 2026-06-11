export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { adminAuth, adminDb } from '@/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { sendWhatsApp } from '@/lib/twilio'
import { processPaymentCommissionsAdmin } from '@/lib/commissions/admin'

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#'
  let pwd = 'Epic'
  for (let i = 0; i < 8; i++) {
    pwd += chars[Math.floor(Math.random() * chars.length)]
  }
  return pwd
}

const PROGRAM_COURSE_MAP: Record<string, string> = {
  'japan-ssw': 'japan-ssw',
  korea: 'korea-d2d4',
  china: 'china',
  ielts: 'ielts',
  nvq: 'nvq-it',
}

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
    const enrollmentId = meta.enrollmentId || ''
    const amount = (session.amount_total || 0) / 100
    const paymentDate = new Date().toISOString().slice(0, 10)

    if (enrollmentId) {
      try {
        const enrollRef = adminDb.collection('enrollmentApplications').doc(enrollmentId)
        const enrollSnap = await enrollRef.get()

        if (enrollSnap.exists) {
          const e = enrollSnap.data()!
          const registrationFeePaid = amount >= 25_000
          const courseFeePaid = amount >= 85_000

          await enrollRef.update({
            stripePaymentStatus: 'paid',
            stripeSessionId: session.id,
            registrationFeePaid,
            courseFeePaid,
            totalPaid: amount,
            status: 'confirmed',
          })

          if (!e.studentId) {
            try {
              const fullName = `${String(e.firstName ?? '')} ${String(e.lastName ?? '')}`.trim()
              const email = String(e.email ?? '')
              const phone = String(e.phone ?? '')
              const tempPassword = generateTempPassword()

              const userRecord = await adminAuth.createUser({
                email,
                password: tempPassword,
                displayName: fullName,
              })

              const allSnap = await adminDb.collection('students').get()
              const year = new Date().getFullYear()
              const seq = String(allSnap.size + 1).padStart(3, '0')
              const studentCode = `EC-${year}-${seq}`
              const courseId = PROGRAM_COURSE_MAP[String(e.program)] ?? 'japan-ssw'
              const parentAccessCode = String(Math.floor(100000 + Math.random() * 900000))

              await adminDb.collection('students').doc(userRecord.uid).set({
                studentCode,
                uid: userRecord.uid,
                name: fullName,
                nic: '',
                email,
                mobile: phone,
                address: String(e.address ?? ''),
                dateOfBirth: String(e.dateOfBirth ?? ''),
                courseId,
                batchId: `${courseId}-${year}`,
                branchId: 'galle',
                location: String(e.location ?? 'galle'),
                batchDuration: String(e.batchDuration ?? '45days'),
                batchCustomDays: e.batchCustomDays ?? null,
                registrationFee: 25_000,
                feeAmount: 85_000,
                feeCurrency: 'LKR',
                paymentStatus: courseFeePaid ? 'paid' : registrationFeePaid ? 'partial' : 'pending',
                status: 'active',
                visaStatus: 'not-started',
                parentAccessCode,
                parentAccessEnabled: true,
                createdAt: FieldValue.serverTimestamp(),
                createdBy: 'enrollment-webhook',
              })

              await adminDb.collection('users').doc(userRecord.uid).set({
                uid: userRecord.uid,
                email,
                displayName: fullName,
                role: 'student',
                studentId: userRecord.uid,
                createdAt: new Date().toISOString(),
              })

              await enrollRef.update({ studentId: userRecord.uid })

              if (phone) {
                await sendWhatsApp(
                  phone,
                  `Hi ${fullName}, welcome to EPIC Campus! 🎓\n\nYour enrollment is confirmed!\n\nStudent ID: ${studentCode}\nEmail: ${email}\nTemp Password: ${tempPassword}\n\nLogin at: epiccampus.live\n\nWe'll contact you within 24 hours. — EPIC Campus`,
                )
              }

              const adminPhone = process.env.ADMIN_WHATSAPP_PHONE
              if (adminPhone) {
                const programLabels: Record<string, string> = {
                  'japan-ssw': 'Japan SSW',
                  korea: 'Korea',
                  china: 'China',
                  ielts: 'IELTS',
                  nvq: 'NVQ',
                }
                await sendWhatsApp(
                  adminPhone,
                  `🎉 New enrollment: ${fullName} for ${programLabels[String(e.program)] ?? e.program} — LKR ${amount.toLocaleString()} paid. Student code: ${studentCode}`,
                )
              }

              await adminDb.collection('notifications').add({
                type: 'new_enrollment',
                title: 'New Online Enrollment',
                body: `${fullName} enrolled in ${String(e.program)} — LKR ${amount.toLocaleString()} paid`,
                enrollmentId,
                studentId: userRecord.uid,
                read: false,
                createdAt: FieldValue.serverTimestamp(),
              })

              console.log(`[Stripe webhook] Enrollment ${enrollmentId}: student ${userRecord.uid} created`)
            } catch (accountErr) {
              console.error('[Stripe webhook] Auto-account creation failed:', accountErr)
            }
          }

          console.log(`[Stripe webhook] Enrollment ${enrollmentId} payment confirmed: ${amount}`)
        }
      } catch (err) {
        console.error('[Stripe webhook] Enrollment update failed:', err)
      }
    }

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
        let agentId: string | null = null
        let agentName: string | null = null
        const studentSnap = await adminDb.collection('students').doc(studentId).get()
        if (studentSnap.exists) {
          const s = studentSnap.data()!
          agentId = s.agentId ? String(s.agentId) : null
          agentName = s.agentName ? String(s.agentName) : null
        }
        const feeType = meta.feeType || ''
        const paymentType =
          feeType === 'registration' || amount === 25_000 ? 'registration' : 'tuition'
        const paymentRef = await adminDb.collection('payments').add({
          studentId,
          studentName: studentName || '',
          agentId,
          agentName,
          amount,
          currency: (session.currency || 'lkr').toUpperCase(),
          stripeSessionId: session.id,
          status: 'paid',
          paidAt: FieldValue.serverTimestamp(),
          createdAt: FieldValue.serverTimestamp(),
          method: 'stripe',
          type: paymentType,
          paymentDate,
        })
        await processPaymentCommissionsAdmin(paymentRef.id, {
          type: paymentType,
          amount,
          status: 'paid',
          agentId,
          agentName,
          paymentDate,
          feeType,
          studentId,
          studentName: studentName || '',
        })
        console.log(`[Stripe webhook] Payment recorded for student ${studentId}: ${amount}`)
      } catch (err) {
        console.error('[Stripe webhook] Firestore write failed:', err)
      }
    }
  }

  return NextResponse.json({ received: true })
}
