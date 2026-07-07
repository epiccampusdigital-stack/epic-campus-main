import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase/admin'
import { sendWhatsApp } from '@/lib/twilio/helpers'
import { buildCredentialsMessage, normalizeLkPhone } from '@/lib/students/credentialsMessage'

export const dynamic = 'force-dynamic'

const STAFF_ROLES = ['admin', 'owner', 'reception']

async function verifyStaff(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return null
  try {
    const decoded = await adminAuth.verifyIdToken(token)
    const snap = await adminDb.collection('users').doc(decoded.uid).get()
    const role = String(snap.data()?.role ?? '')
    return STAFF_ROLES.includes(role) ? decoded.uid : null
  } catch {
    return null
  }
}

/** Sends a student their existing login details over WhatsApp. Does NOT change
 *  the password — used right after account creation when the caller still has
 *  the freshly generated password in hand. */
export async function POST(req: NextRequest) {
  try {
    const staffUid = await verifyStaff(req)
    if (!staffUid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { phone, studentName, email, password, studentCode } = (await req.json()) as {
      phone?: string
      studentName?: string
      email?: string
      password?: string
      studentCode?: string
    }

    if (!phone || !email || !password) {
      return NextResponse.json({ error: 'phone, email and password are required' }, { status: 400 })
    }

    const to = normalizeLkPhone(String(phone))
    if (!to) {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
    }

    const message = buildCredentialsMessage({
      studentName: String(studentName ?? 'Student'),
      email: String(email),
      password: String(password),
      studentCode: String(studentCode ?? ''),
    })

    const sent = await sendWhatsApp(to, message)
    if (!sent) {
      return NextResponse.json(
        { success: false, error: 'WhatsApp could not be sent. Check the number is active on WhatsApp.' },
        { status: 502 },
      )
    }

    return NextResponse.json({ success: true, message: 'Credentials sent via WhatsApp' })
  } catch (err) {
    console.error('[students/send-credentials]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
