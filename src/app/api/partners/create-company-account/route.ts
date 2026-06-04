import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase/admin'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { companyId, email, password, displayName } = body

    if (!companyId || !email || !password) {
      return NextResponse.json(
        { error: 'companyId, email, and password are required' },
        { status: 400 },
      )
    }

    const companySnap = await adminDb.collection('partnerCompanies').doc(companyId).get()
    if (!companySnap.exists) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName: displayName || companySnap.data()?.name || 'Partner Company',
    })

    await adminDb.collection('users').doc(userRecord.uid).set({
      uid: userRecord.uid,
      email,
      displayName: displayName || companySnap.data()?.name || 'Partner Company',
      role: 'company',
      companyId,
      createdAt: new Date().toISOString(),
    })

    await adminDb.collection('partnerCompanies').doc(companyId).update({
      loginUid: userRecord.uid,
      contactEmail: email,
    })

    return NextResponse.json({ uid: userRecord.uid })
  } catch (err) {
    console.error('[partners/create-company-account]', err)
    const message = err instanceof Error ? err.message : 'Failed to create account'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
