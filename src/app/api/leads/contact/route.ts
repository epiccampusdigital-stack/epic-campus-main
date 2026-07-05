export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/admin'

interface Body {
  name?: string
  phone?: string
  email?: string
  program?: string
  message?: string
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Body
    const name = body.name?.trim()
    const email = body.email?.trim()
    const phone = body.phone?.trim()

    if (!name || name.length < 2) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }
    if (!email && !phone) {
      return NextResponse.json({ error: 'Email or phone number is required' }, { status: 400 })
    }

    await adminDb.collection('leads').add({
      name,
      email: email ?? '',
      phone: phone ?? '',
      program: body.program?.trim() ?? '',
      message: body.message?.trim() ?? '',
      source: 'contact-form',
      status: 'new',
      branchId: 'galle-main',
      createdAt: FieldValue.serverTimestamp(),
      createdBy: 'contact-form',
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[contact-form lead]', error)
    return NextResponse.json({ error: 'Could not send your message. Please try again.' }, { status: 500 })
  }
}
