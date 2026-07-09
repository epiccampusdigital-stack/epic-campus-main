import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase/admin'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  // ── Parse request body ──────────────────────────────────────────────
  let token: string | undefined
  try {
    const body = await req.json()
    token = body?.token
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[api/auth/session POST] Invalid request body:', message, err)
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!token) {
    return NextResponse.json({ error: 'No token provided' }, { status: 400 })
  }

  // ── Verify the ID token (also triggers Firebase Admin init) ─────────
  let decoded
  try {
    decoded = await adminAuth.verifyIdToken(token)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[api/auth/session POST] Token verification failed:', message, err)

    // Admin SDK failed to initialize — treat as service unavailable
    if (
      message.includes('Firebase Admin credentials missing') ||
      message.includes('Firebase Admin initialization failed')
    ) {
      return NextResponse.json(
        { error: 'Service unavailable', detail: message },
        { status: 503 },
      )
    }

    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  // ── Look up role and set custom claims (best-effort) ────────────────
  try {
    const userSnap = await adminDb.collection('users').doc(decoded.uid).get()
    const role = userSnap.data()?.role
    if (role && typeof role === 'string') {
      await adminAuth.setCustomUserClaims(decoded.uid, { role })
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[api/auth/session POST] Role/claims lookup failed:', message, err)

    if (
      message.includes('Firebase Admin credentials missing') ||
      message.includes('Firebase Admin initialization failed')
    ) {
      return NextResponse.json(
        { error: 'Service unavailable', detail: message },
        { status: 503 },
      )
    }
    // Non-fatal — proceed to establish the session even if claims couldn't be set
  }

  // ── Set the session cookie ──────────────────────────────────────────
  try {
    const response = NextResponse.json({ success: true })
    response.cookies.set('epic-session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })
    return response
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[api/auth/session POST] Cookie set failed:', message, err)
    return NextResponse.json({ error: 'Cookie error' }, { status: 500 })
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true })
  response.cookies.delete('epic-session')
  return response
}
