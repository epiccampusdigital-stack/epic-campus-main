export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminAuth, adminDb } from '@/lib/firebase/admin'
import { sendWhatsApp } from '@/lib/twilio'
import {
  createStudentAccount,
  generateEnrollmentPassword,
  generateStudentCode,
} from '@/lib/students/createStudentAccount'
import {
  programInterestToEnrollmentProgram,
  REGISTRATION_FEE_LKR,
} from '@/lib/leads/aiLeads'

/** Matches StudentForm: the 9-digit Student ID is the login username. */
function generateIdNumber(): string {
  return String(Math.floor(100000000 + Math.random() * 900000000))
}

/** The Student ID becomes {idNumber}@epiccampus.lk, so it has to be unique. */
async function generateUniqueIdNumber(): Promise<string> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const candidate = generateIdNumber()
    const clash = await adminDb
      .collection('students')
      .where('idNumber', '==', candidate)
      .limit(1)
      .get()
    if (clash.empty) return candidate
  }
  throw new Error('Could not allocate a unique Student ID')
}

async function verifyAdmin(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return null
  try {
    const decoded = await adminAuth.verifyIdToken(token)
    const snap = await adminDb.collection('users').doc(decoded.uid).get()
    const role = String(snap.data()?.role ?? '')
    return role === 'admin' || role === 'owner' || role === 'ai_manager'
      ? decoded.uid
      : null
  } catch {
    return null
  }
}

/**
 * Turns a paid AI lead into a real student — the enrollment handoff.
 *
 * Deliberately a human-clicked action, matching the payment-link gate: the AI
 * never creates a student record on its own.
 *
 * Account creation calls createStudentAccount() directly — the same helper the
 * Students page's create-account route uses — so Student ID allocation, password
 * generation, the payment plan and the welcome WhatsApp all still behave
 * identically, without a second HTTP hop that would re-authorize the caller
 * against that route's separate, narrower staff-role list.
 */
export async function POST(req: NextRequest) {
  const uid = await verifyAdmin(req)
  if (!uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { leadId, program: programOverride } = (await req.json()) as {
      leadId?: string
      program?: string
    }
    if (!leadId) {
      return NextResponse.json({ error: 'Missing leadId' }, { status: 400 })
    }

    const leadRef = adminDb.collection('leads').doc(leadId)
    const snap = await leadRef.get()
    if (!snap.exists) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    const lead = snap.data()!
    if (lead.status !== 'paid') {
      return NextResponse.json(
        { error: 'Only a lead that has paid the registration fee can be converted' },
        { status: 400 },
      )
    }
    if (lead.convertedToStudentId) {
      return NextResponse.json(
        { error: 'This lead has already been converted to a student' },
        { status: 409 },
      )
    }

    const name = String(lead.name ?? '').trim()
    const phone = String(lead.phone ?? '').trim()
    if (!name) {
      return NextResponse.json(
        { error: 'Lead has no name — add one before converting' },
        { status: 400 },
      )
    }

    const program =
      String(programOverride ?? '').trim() ||
      programInterestToEnrollmentProgram(String(lead.programInterest ?? '')) ||
      undefined

    const idNumber = await generateUniqueIdNumber()
    // What the lead actually paid via Stripe. Fee amount is left unset so
    // createStudentAccount applies the app's standard course fee and derives
    // the outstanding balance from it.
    const paidAmount = Number(lead.amountPaid ?? REGISTRATION_FEE_LKR)

    // The Student ID is the login username, so the auth email is synthetic.
    const loginEmail = `${idNumber}@epiccampus.lk`
    const studentCode = await generateStudentCode()
    const password = generateEnrollmentPassword(
      name.split(/\s+/)[0] ?? 'Student',
      phone,
    )

    const created = await createStudentAccount({
      email: loginEmail,
      password,
      displayName: name,
      studentCode,
      phone,
      address: '',
      dateOfBirth: '',
      program,
      batchCustomDays: null,
      registrationFeePaid: true,
      courseFeePaid: false,
      totalPaid: 0,
      createdBy: uid,
      paymentStatus: 'partial',
      paidAmount,
      agentId: null,
      notes: `Converted from AI WhatsApp lead ${leadId}`,
      idNumber,
      loginEmail,
    })

    // Only send login credentials when a new account was actually created — for
    // a reused existing account the real password wasn't changed.
    if (phone && created.created) {
      const firstName = name.split(/\s+/)[0] || name
      await sendWhatsApp(
        phone,
        `🎉 Welcome to Epic Campus, ${firstName}!\nYour account has been created.\nLogin at: www.epiccampus.live/login\nEmail: ${created.email}\nPassword: ${created.password}\nPlease change your password after first login.\n📞 Questions? Call us: 076 254 8383`,
      )
    }

    await leadRef.update({
      convertedToStudentId: created.studentDocId,
      convertedAt: FieldValue.serverTimestamp(),
      convertedBy: uid,
      updatedAt: FieldValue.serverTimestamp(),
    })

    return NextResponse.json({
      ok: true,
      studentId: created.studentDocId,
      studentCode: created.studentCode ?? '',
      email: created.email ?? '',
      // Only meaningful for a genuinely new account — create-account reuses an
      // existing login rather than resetting its password.
      password: created.created ? (created.password ?? '') : '',
      created: created.created === true,
    })
  } catch (err) {
    console.error('[leads/convert-to-student]', err)
    const message = err instanceof Error ? err.message : 'Failed to convert lead'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
