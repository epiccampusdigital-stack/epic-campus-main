import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { resolveStudentId, verifyJpRole, verifySignedIn } from '@/lib/jp/serverAuth'
import { getJpCourse } from '@/lib/jp/courses'
import { getJpSettings } from '@/lib/jp/settings'
import { createJpOrder, generateBankReference, listJpOrders } from '@/lib/jp/orders'
import type { JpOrderRail, JpOrderStatus } from '@/types'

export const dynamic = 'force-dynamic'

const STAFF_ROLES = ['admin', 'owner', 'accountant']
const VALID_RAILS: JpOrderRail[] = ['stripe', 'bank_transfer', 'paypal']

// Staff (admin/owner/accountant) can list/filter every order; anyone else
// signed in only ever sees their own (matched by uid, not studentId — see
// src/lib/jp/orders.ts).
export async function GET(req: NextRequest) {
  const staff = await verifyJpRole(req, STAFF_ROLES)
  const status = req.nextUrl.searchParams.get('status') as JpOrderStatus | null
  const rail = req.nextUrl.searchParams.get('rail') as JpOrderRail | null

  try {
    if (staff) {
      const orders = await listJpOrders({ status: status ?? undefined, rail: rail ?? undefined })
      return NextResponse.json({ orders })
    }

    const uid = await verifySignedIn(req)
    if (!uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const orders = await listJpOrders({ uid })
    return NextResponse.json({ orders })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load orders'
    console.error('[api/jp/orders GET]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// Starts checkout for the signed-in student. Amounts are computed here from
// jpCourses/jpSettings — never trust a client-supplied price. This is also
// where the student's delivery details get saved onto their own record
// (checkout step 1), and where a bank-transfer order gets its reference
// code up front, before any payment happens.
export async function POST(req: NextRequest) {
  const uid = await verifySignedIn(req)
  if (!uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const courseId = String(body?.courseId ?? '')
    const deliveryName = String(body?.deliveryName ?? '').trim()
    const deliveryPhone = String(body?.deliveryPhone ?? '').trim()
    const collectAtCampus = Boolean(body?.collectAtCampus)
    const deliveryAddress = collectAtCampus ? '' : String(body?.deliveryAddress ?? '').trim()
    const deliveryDistrict = collectAtCampus ? '' : String(body?.deliveryDistrict ?? '').trim()
    const rail = body?.rail as JpOrderRail

    if (!courseId || !deliveryName || !deliveryPhone || !rail) {
      return NextResponse.json({ error: 'courseId, deliveryName, deliveryPhone and rail are required' }, { status: 400 })
    }
    if (!VALID_RAILS.includes(rail)) {
      return NextResponse.json({ error: 'Invalid rail' }, { status: 400 })
    }
    if (!collectAtCampus && (!deliveryAddress || !deliveryDistrict)) {
      return NextResponse.json(
        { error: 'deliveryAddress and deliveryDistrict are required unless collecting at campus' },
        { status: 400 },
      )
    }

    const studentId = await resolveStudentId(uid)
    if (!studentId) {
      return NextResponse.json({ error: 'Could not resolve your student profile' }, { status: 404 })
    }

    const [course, settings] = await Promise.all([getJpCourse(courseId), getJpSettings()])
    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }

    // Checkout step 1: persist delivery details onto the student's own record.
    await adminDb
      .collection('students')
      .doc(studentId)
      .set({ deliveryAddress, deliveryDistrict, deliveryPhone }, { merge: true })

    const postageLKR = collectAtCampus ? 0 : settings.postageFlatLKR
    const paymentRef = rail === 'bank_transfer' ? generateBankReference(studentId) : null

    const order = await createJpOrder({
      studentId,
      uid,
      courseId,
      courseFeeLKR: course.priceLKR,
      postageLKR,
      rail,
      deliveryName,
      deliveryAddress,
      deliveryDistrict,
      deliveryPhone,
      paymentRef,
    })

    return NextResponse.json({ order })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create order'
    console.error('[api/jp/orders POST]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
