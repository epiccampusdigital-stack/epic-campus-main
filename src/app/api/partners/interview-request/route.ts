import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { sendWhatsApp } from '@/lib/twilio'
import { privacyDisplayName } from '@/lib/partners/helpers'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { candidateShortlistId, companyId, companyName, studentId, studentName } = body

    if (!candidateShortlistId || !companyId || !studentName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const displayName = privacyDisplayName(String(studentName))

    await adminDb.collection('notifications').add({
      type: 'partner_interview_request',
      title: 'Interview requested',
      message: `${companyName || 'A partner company'} requested an interview for ${displayName}.`,
      companyId,
      companyName: companyName || '',
      studentId: studentId || '',
      studentDisplayName: displayName,
      candidateShortlistId,
      read: false,
      createdAt: new Date().toISOString(),
    })

    const adminPhone = process.env.ADMIN_WHATSAPP_PHONE
    if (adminPhone) {
      await sendWhatsApp(
        adminPhone,
        `[EPIC Campus] ${companyName} requested an interview for candidate ${displayName}. Review in Partner Companies.`,
      )
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[partners/interview-request]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
