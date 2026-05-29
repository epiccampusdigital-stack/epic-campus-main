import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import type { Role } from '@/types'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      userId,
      userEmail,
      userRole,
      action,
      entityType,
      entityId,
      details,
    } = body

    if (!userId || !action || !entityType) {
      return NextResponse.json({ error: 'Missing required audit fields' }, { status: 400 })
    }

    const forwarded = req.headers.get('x-forwarded-for')
    const ipAddress = forwarded?.split(',')[0]?.trim() ?? req.headers.get('x-real-ip') ?? 'unknown'

    await adminDb.collection('auditLog').add({
      userId: String(userId),
      userEmail: String(userEmail ?? ''),
      userRole: (userRole as Role) ?? 'admin',
      action: String(action),
      entityType: String(entityType),
      entityId: String(entityId ?? ''),
      details: String(details ?? ''),
      ipAddress,
      createdAt: FieldValue.serverTimestamp(),
    })

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Audit log failed'
    console.error('[api/audit/log]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
