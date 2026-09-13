import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { verifyJpRole } from '@/lib/jp/serverAuth'
import { parseJpEnrollment } from '@/lib/jp/enrollments'
import { isLessonReleased } from '@/lib/jp/drip'
import { toDate } from '@/lib/students/helpers'
import type { JpLesson } from '@/types'

export const dynamic = 'force-dynamic'

// Broader than the individual jpOrders/jpFulfilment/jpProgress staff read
// roles (each of those is deliberately scoped narrower — e.g. progress
// reads are teaching-staff only, orders are finance-staff only). The
// reception Students page's Online tab needs one consolidated row per
// student combining all three, so this route does the joins itself with
// the Admin SDK and is gated to the roles that actually need that combined
// view, rather than widening any of the other routes' role lists.
const STAFF_ROLES = ['admin', 'owner', 'accountant', 'reception']

export async function GET(req: NextRequest) {
  const staff = await verifyJpRole(req, STAFF_ROLES)
  if (!staff) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const courseId = req.nextUrl.searchParams.get('courseId')
  if (!courseId) {
    return NextResponse.json({ error: 'courseId is required' }, { status: 400 })
  }

  try {
    const courseRef = adminDb.collection('jpCourses').doc(courseId)
    const [studentsSnap, enrollmentsSnap, ordersSnap, fulfilmentSnap, modulesSnap] = await Promise.all([
      adminDb.collection('students').where('enrollmentType', 'in', ['online', 'both']).get(),
      adminDb.collection('jpEnrollments').where('courseId', '==', courseId).get(),
      adminDb.collection('jpOrders').where('courseId', '==', courseId).get(),
      adminDb.collection('jpFulfilment').get(),
      courseRef.collection('modules').orderBy('order').get(),
    ])

    const lessonsByModule = await Promise.all(
      modulesSnap.docs.map((m) => courseRef.collection('modules').doc(m.id).collection('lessons').get()),
    )
    const allLessons: JpLesson[] = lessonsByModule.flatMap((snap) =>
      snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<JpLesson, 'id'>) })),
    )

    const enrollmentByStudentId = new Map(
      enrollmentsSnap.docs.map((d) => {
        const enrollment = parseJpEnrollment(d.id, d.data() as Record<string, unknown>)
        return [enrollment.studentId, enrollment] as const
      }),
    )

    // Latest order per student (createdAt is always a plain ISO string —
    // see src/lib/jp/orders.ts — so lexical comparison sorts correctly).
    const ordersByStudentId = new Map<string, { status: string; createdAt: string }>()
    ordersSnap.docs.forEach((d) => {
      const data = d.data()
      const studentId = String(data.studentId ?? '')
      const createdAt = String(data.createdAt ?? '')
      const existing = ordersByStudentId.get(studentId)
      if (!existing || createdAt > existing.createdAt) {
        ordersByStudentId.set(studentId, { status: String(data.status ?? ''), createdAt })
      }
    })

    // jpFulfilment is 1:1 with an order, but a student may have re-ordered —
    // keep the one tied to their latest order where possible.
    const fulfilmentByOrderId = new Map(fulfilmentSnap.docs.map((d) => [d.id, String(d.data().status ?? '')]))

    const uids = studentsSnap.docs
      .map((d) => String(d.data().uid ?? ''))
      .filter((uid): uid is string => Boolean(uid))
    const completedCountByUid = new Map<string, number>()
    await Promise.all(
      uids.map(async (uid) => {
        const snap = await adminDb.collection('jpProgress').doc(uid).collection('lessons').get()
        completedCountByUid.set(uid, snap.docs.filter((d) => Boolean(d.data().completed)).length)
      }),
    )

    const latestOrderIdByStudentId = new Map<string, string>()
    ordersSnap.docs.forEach((d) => {
      const data = d.data()
      const studentId = String(data.studentId ?? '')
      const createdAt = String(data.createdAt ?? '')
      const latest = ordersByStudentId.get(studentId)
      if (latest && latest.createdAt === createdAt) latestOrderIdByStudentId.set(studentId, d.id)
    })

    const rows = studentsSnap.docs.map((doc) => {
      const data = doc.data()
      const studentId = doc.id
      const uid = String(data.uid ?? '')
      const enrollment = enrollmentByStudentId.get(studentId)
      const releasedCount = enrollment ? allLessons.filter((l) => isLessonReleased(l, enrollment)).length : 0
      const latestOrderId = latestOrderIdByStudentId.get(studentId)

      return {
        id: studentId,
        name: String(data.name ?? ''),
        mobile: String(data.mobile ?? ''),
        district: String(data.deliveryDistrict ?? ''),
        createdAt: toDate(data.createdAt)?.toISOString() ?? '',
        enrolledAt: enrollment?.startedAt ?? enrollment?.grantedAt ?? null,
        paymentStatus: ordersByStudentId.get(studentId)?.status ?? null,
        packStatus: latestOrderId ? fulfilmentByOrderId.get(latestOrderId) ?? null : null,
        completedCount: uid ? completedCountByUid.get(uid) ?? 0 : 0,
        releasedCount,
      }
    })

    return NextResponse.json({ rows })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load online students summary'
    console.error('[api/jp/students-summary]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
