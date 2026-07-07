import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminAuth, adminDb } from '@/lib/firebase/admin'
import { buildAutoInstallments, normalizePaymentStatus, PLAN_SOURCE } from '@/lib/payments/autoInstallments'

export const dynamic = 'force-dynamic'

const ADMIN_ROLES = ['admin', 'owner']
// The hardcoded default createStudentAccount() used to write before this fix —
// only students still carrying this generic value (or no fee at all) are touched.
const LEGACY_DEFAULT_FEE = 85_000

async function verifyAdmin(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return null
  try {
    const decoded = await adminAuth.verifyIdToken(token)
    const snap = await adminDb.collection('users').doc(decoded.uid).get()
    const role = String(snap.data()?.role ?? '')
    return ADMIN_ROLES.includes(role) ? decoded.uid : null
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  const adminUid = await verifyAdmin(req)
  if (!adminUid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let fixed = 0
  let skipped = 0
  const errors: string[] = []

  try {
    // Both approval mechanisms in use across the app tag enrollments differently
    // ('approved' from the Enrollments page, 'confirmed' from /api/enrollment/confirm).
    const enrollSnap = await adminDb
      .collection('enrollmentApplications')
      .where('status', 'in', ['approved', 'confirmed'])
      .get()

    for (const enrollDoc of enrollSnap.docs) {
      const e = enrollDoc.data()
      const email = String(e.email ?? '').trim().toLowerCase()
      if (!email) {
        skipped++
        continue
      }

      try {
        const studentSnap = await adminDb
          .collection('students')
          .where('email', '==', email)
          .limit(1)
          .get()
        if (studentSnap.empty) {
          skipped++
          continue
        }

        const studentDoc = studentSnap.docs[0]
        const student = studentDoc.data()

        const enrollmentFee =
          e.totalFee != null ? Number(e.totalFee) : e.feeAmount != null ? Number(e.feeAmount) : null
        const currentFee = Number(student.feeAmount ?? 0)
        const looksDefaulted = currentFee === LEGACY_DEFAULT_FEE || currentFee <= 0

        if (enrollmentFee == null || enrollmentFee <= 0 || !looksDefaulted || enrollmentFee === currentFee) {
          skipped++
          continue
        }

        const paymentStatus = normalizePaymentStatus(
          e.paymentStatus ?? (e.courseFeePaid ? 'paid' : e.registrationFeePaid ? 'partial' : 'pending'),
        )
        const paidAmount =
          e.paidAmount != null ? Number(e.paidAmount) : paymentStatus === 'paid' ? enrollmentFee : 0
        const pendingAmount =
          e.pendingAmount != null
            ? Number(e.pendingAmount)
            : paymentStatus === 'paid'
              ? 0
              : paymentStatus === 'partial'
                ? Math.max(0, enrollmentFee - paidAmount)
                : enrollmentFee

        await studentDoc.ref.update({
          feeAmount: enrollmentFee,
          paymentStatus,
          paidAmount,
          pendingAmount,
          updatedAt: FieldValue.serverTimestamp(),
        })

        const planRef = adminDb.collection('payments').doc(studentDoc.id)
        const existingPlan = await planRef.get()
        if (!existingPlan.exists || existingPlan.data()?.source === PLAN_SOURCE.ENROLLMENT) {
          await planRef.set({
            studentId: studentDoc.id,
            studentName: student.name ?? '',
            studentCode: student.studentCode ?? '',
            courseId: student.courseId ?? '',
            location: student.location ?? '',
            branch: student.branchId ?? 'galle-main',
            totalFee: enrollmentFee,
            currency: 'LKR',
            installments: buildAutoInstallments(enrollmentFee, paymentStatus, paidAmount),
            source: PLAN_SOURCE.ENROLLMENT,
            createdAt: existingPlan.exists
              ? (existingPlan.data()?.createdAt ?? FieldValue.serverTimestamp())
              : FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          })
        }

        fixed++
      } catch (err) {
        errors.push(`${email}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    return NextResponse.json({ fixed, skipped, errors })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sync failed'
    console.error('[sync-enrollment-payments]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
