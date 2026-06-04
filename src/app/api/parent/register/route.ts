import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminAuth, adminDb } from '@/lib/firebase/admin'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { parentName, email, phone, password, accessCode } = body

    if (!parentName?.trim() || !email?.trim() || !password || !accessCode) {
      return NextResponse.json(
        { error: 'Name, email, password, and access code are required' },
        { status: 400 },
      )
    }

    if (String(password).length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 },
      )
    }

    const code = String(accessCode).trim().replace(/\D/g, '')
    if (code.length !== 6) {
      return NextResponse.json(
        { error: 'Access code must be 6 digits' },
        { status: 400 },
      )
    }

    const studentsSnap = await adminDb
      .collection('students')
      .where('parentAccessCode', '==', code)
      .limit(1)
      .get()

    if (studentsSnap.empty) {
      return NextResponse.json(
        { error: 'Invalid access code. Check the code from Epic Campus staff.' },
        { status: 400 },
      )
    }

    const studentDoc = studentsSnap.docs[0]
    const studentData = studentDoc.data()
    const studentId = studentDoc.id

    if (studentData.parentAccessEnabled === false) {
      return NextResponse.json(
        { error: 'Parent access is disabled for this student. Contact Epic Campus.' },
        { status: 400 },
      )
    }

    if (studentData.parentId) {
      return NextResponse.json(
        { error: 'This access code has already been used. Contact Epic Campus for help.' },
        { status: 400 },
      )
    }

    const existingParent = await adminDb
      .collection('parentAccounts')
      .where('studentId', '==', studentId)
      .limit(1)
      .get()

    if (!existingParent.empty) {
      return NextResponse.json(
        { error: 'A parent account is already linked to this student.' },
        { status: 400 },
      )
    }

    const normalizedEmail = String(email).trim().toLowerCase()

    let userRecord
    try {
      userRecord = await adminAuth.createUser({
        email: normalizedEmail,
        password: String(password),
        displayName: String(parentName).trim(),
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed'
      if (message.includes('email-already-exists')) {
        return NextResponse.json(
          { error: 'An account with this email already exists. Try signing in.' },
          { status: 400 },
        )
      }
      return NextResponse.json({ error: message }, { status: 500 })
    }

    const studentName = String(studentData.name ?? 'Student')
    const now = FieldValue.serverTimestamp()

    await adminDb.collection('users').doc(userRecord.uid).set({
      uid: userRecord.uid,
      email: normalizedEmail,
      displayName: String(parentName).trim(),
      role: 'parent',
      studentId,
      createdAt: new Date().toISOString(),
    })

    await adminDb.collection('parentAccounts').doc(userRecord.uid).set({
      parentName: String(parentName).trim(),
      email: normalizedEmail,
      phone: String(phone ?? '').trim(),
      studentId,
      studentName,
      linkedAt: now,
      createdAt: now,
    })

    await studentDoc.ref.update({
      parentId: userRecord.uid,
      parentAccessEnabled: true,
    })

    return NextResponse.json({ uid: userRecord.uid, studentId })
  } catch (err) {
    console.error('[parent/register]', err)
    const message = err instanceof Error ? err.message : 'Registration failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
