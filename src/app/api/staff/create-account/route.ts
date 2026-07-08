import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase/admin'
import { STAFF_ROLES } from '@/lib/staff/helpers'
import type { StaffRole } from '@/types'

export const dynamic = 'force-dynamic'

async function verifyAdmin(req: NextRequest): Promise<boolean> {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return false
  try {
    const decoded = await adminAuth.verifyIdToken(token)
    const snap = await adminDb.collection('users').doc(decoded.uid).get()
    const role = String(snap.data()?.role ?? '')
    return role === 'admin' || role === 'owner'
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  if (!(await verifyAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const {
      email,
      password,
      displayName,
      role,
      roles,
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

    const validRoles: StaffRole[] = Array.isArray(roles)
      ? roles.filter((r): r is StaffRole => STAFF_ROLES.includes(r))
      : []
    if (validRoles.length === 0) validRoles.push(role as StaffRole)
    const primaryRole = validRoles[0]

    // If Auth already has an account for this email (orphaned from a previous
    // delete that couldn't reach Auth), reuse it instead of failing outright.
    let userRecord: Awaited<ReturnType<typeof adminAuth.createUser>>
    try {
      userRecord = await adminAuth.createUser({
        email,
        password,
        displayName,
      })
    } catch (err: unknown) {
      const code = (err as { code?: string }).code
      if (code !== 'auth/email-already-exists') throw err
      userRecord = await adminAuth.getUserByEmail(email)
      await adminAuth.updateUser(userRecord.uid, { password })
      console.warn(`[api/staff/create-account] Reused existing Auth account for ${email}`)
    }

    const now = new Date().toISOString()
    const userPayload = {
      uid: userRecord.uid,
      email,
      displayName,
      role: primaryRole,
      roles: validRoles,
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
      updatedAt: now,
      approvedAt: status === 'active' ? now : null,
      locationAssigned: locationAssigned ?? null,
    }

    await adminDb.collection('users').doc(userRecord.uid).set(userPayload)
    await adminAuth.setCustomUserClaims(userRecord.uid, { role: primaryRole })

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
