export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase/admin'

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
    const snap = await adminDb.collection('students').get()
    let fixed = 0
    let alreadyCorrect = 0
    const notFound: string[] = []
    const errors: string[] = []

    for (const docSnap of snap.docs) {
      const data = docSnap.data()
      const email = String(data.email ?? '').trim().toLowerCase()
      const currentUid = data.uid ? String(data.uid) : ''

      if (!email) {
        if (!currentUid) {
          notFound.push(`${docSnap.id} (no email)`)
        } else {
          alreadyCorrect += 1
        }
        continue
      }

      try {
        const authUser = await adminAuth.getUserByEmail(email)

        if (currentUid === authUser.uid) {
          alreadyCorrect += 1
          continue
        }

        await docSnap.ref.update({ uid: authUser.uid })

        const userRef = adminDb.collection('users').doc(authUser.uid)
        const userSnap = await userRef.get()
        if (!userSnap.exists || !userSnap.data()?.studentId) {
          await userRef.set(
            {
              uid: authUser.uid,
              email: authUser.email ?? email,
              displayName: authUser.displayName ?? String(data.name ?? ''),
              role: 'student',
              studentId: docSnap.id,
            },
            { merge: true },
          )
        } else if (String(userSnap.data()?.studentId) !== docSnap.id) {
          await userRef.set({ studentId: docSnap.id }, { merge: true })
        }

        fixed += 1
      } catch (err: unknown) {
        const code =
          err && typeof err === 'object' && 'code' in err
            ? String((err as { code: string }).code)
            : ''
        if (code === 'auth/user-not-found') {
          notFound.push(`${data.name ?? docSnap.id} <${email}>`)
        } else {
          const message = err instanceof Error ? err.message : 'Unknown error'
          errors.push(`${email}: ${message}`)
        }
      }
    }

    return NextResponse.json({
      fixed,
      alreadyCorrect,
      notFound,
      errors,
      total: snap.size,
    })
  } catch (error) {
    console.error('[fix-student-uids]', error)
    return NextResponse.json({ error: 'Fix failed' }, { status: 500 })
  }
}
