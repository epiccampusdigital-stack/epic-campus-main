import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase/admin'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json()
    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 400 })
    }

    await adminAuth.verifyIdToken(token)

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
    const message =
      err instanceof Error ? err.message : 'Token verification failed'
    console.error('[api/auth/session POST]', message)

    if (message.includes('Firebase Admin credentials missing')) {
      return NextResponse.json(
        { error: 'Server misconfigured: Firebase Admin credentials missing' },
        { status: 500 },
      )
    }

    return NextResponse.json({ error: message }, { status: 401 })
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true })
  response.cookies.delete('epic-session')
  return response
}
