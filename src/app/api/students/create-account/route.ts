import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase/admin'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { email, password, displayName, studentId } = await req.json()

    if (!email || !password || !displayName || !studentId) {
      return NextResponse.json(
        { error: 'email, password, displayName, and studentId are required' },
        { status: 400 },
      )
    }

    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName,
    })

    await adminDb.collection('users').doc(userRecord.uid).set({
      uid: userRecord.uid,
      email,
      displayName,
      role: 'student',
      studentId,
      createdAt: new Date().toISOString(),
    })

    await adminDb.collection('students').doc(studentId).set(
      {
        uid: userRecord.uid,
        email,
      },
      { merge: true },
    )

    return NextResponse.json({ uid: userRecord.uid })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Account creation failed'
    console.error('[api/students/create-account]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
