import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase/admin'
import type { StaffRole } from '@/types'

export const dynamic = 'force-dynamic'

const STAFF_ROLES: StaffRole[] = [
  'admin',
  'owner',
  'reception',
  'accountant',
  'teacher',
  'examCoordinator',
]

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      email,
      password,
      displayName,
      role,
      phone,
      nic,
      dateOfBirth,
      address,
      photoUrl,
      branchId,
      startDate,
      salaryType,
      baseSalary,
      commissionRate,
      status,
      pendingDocId,
      locationAssigned,
    } = body

    if (!email || !password || !displayName || !role) {
      return NextResponse.json(
        { error: 'email, password, displayName, and role are required' },
        { status: 400 },
      )
    }

    if (!STAFF_ROLES.includes(role as StaffRole)) {
      return NextResponse.json({ error: 'Invalid staff role' }, { status: 400 })
    }

    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName,
    })

    const now = new Date().toISOString()
    const userPayload = {
      uid: userRecord.uid,
      email,
      displayName,
      role,
      status: status ?? 'active',
      phone: phone ?? '',
      nic: nic ?? '',
      dateOfBirth: dateOfBirth ?? null,
      address: address ?? null,
      photoUrl: photoUrl ?? null,
      branchId: branchId ?? 'galle-main',
      startDate: startDate ?? null,
      salaryType: salaryType ?? 'fixed',
      baseSalary: Number(baseSalary ?? 0),
      commissionRate: commissionRate != null ? Number(commissionRate) : null,
      createdAt: now,
      approvedAt: status === 'active' ? now : null,
      locationAssigned: locationAssigned ?? null,
    }

    await adminDb.collection('users').doc(userRecord.uid).set(userPayload)

    if (pendingDocId && pendingDocId !== userRecord.uid) {
      await adminDb.collection('users').doc(pendingDocId).delete().catch(() => {})
    }

    return NextResponse.json({ uid: userRecord.uid })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Account creation failed'
    console.error('[api/staff/create-account]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
