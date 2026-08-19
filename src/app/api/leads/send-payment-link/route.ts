export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminAuth, adminDb } from '@/lib/firebase/admin'
import { sendWhatsApp } from '@/lib/twilio'
import { REGISTRATION_FEE_LKR } from '@/lib/leads/aiLeads'

async function verifyAdmin(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return null
  try {
    const decoded = await adminAuth.verifyIdToken(token)
    const snap = await adminDb.collection('users').doc(decoded.uid).get()
    const role = String(snap.data()?.role ?? '')
    return role === 'admin' || role === 'owner' ? decoded.uid : null
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  const uid = await verifyAdmin(req)
  if (!uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { leadId } = (await req.json()) as { leadId?: string }
    if (!leadId) {
      return NextResponse.json({ error: 'Missing leadId' }, { status: 400 })
    }

    const leadRef = adminDb.collection('leads').doc(leadId)
    const snap = await leadRef.get()
    if (!snap.exists) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    const lead = snap.data()!
    const phone = String(lead.phone ?? '')
    const name = String(lead.name ?? '').trim()
    if (!phone) {
      return NextResponse.json({ error: 'Lead has no phone number' }, { status: 400 })
    }
    if (lead.status !== 'ready_for_payment') {
      return NextResponse.json(
        { error: 'Lead is not marked ready for payment' },
        { status: 400 },
      )
    }

    // Reuse the existing Stripe LKR checkout route rather than building a second
    // Stripe client. leadId in metadata is what the Stripe webhook settles against.
    const origin = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin
    const checkoutRes = await fetch(`${origin}/api/stripe/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: REGISTRATION_FEE_LKR,
        currency: 'lkr',
        description: 'EPIC Campus — Registration Fee',
        studentName: name,
        successUrl: `${origin}/enroll/success`,
        cancelUrl: `${origin}/contact`,
        metadata: { leadId, feeType: 'registration' },
      }),
    })

    if (!checkoutRes.ok) {
      const detail = await checkoutRes.text()
      console.error('[send-payment-link] Stripe checkout failed:', detail)
      return NextResponse.json({ error: 'Could not create payment link' }, { status: 502 })
    }

    const { url } = (await checkoutRes.json()) as { url?: string }
    if (!url) {
      return NextResponse.json({ error: 'Stripe returned no checkout URL' }, { status: 502 })
    }

    const greeting = name ? `Hi ${name},` : 'Hi,'
    const message =
      `${greeting}\n\nHere is your EPIC Campus registration payment link for ` +
      `LKR ${REGISTRATION_FEE_LKR.toLocaleString('en-LK')}:\n\n${url}\n\n` +
      `This is our official secure payment page. We will never ask you for card ` +
      `details over WhatsApp.\n\n— EPIC Campus`

    const sent = await sendWhatsApp(phone, message)
    if (!sent.ok) {
      console.error('[send-payment-link] Twilio send failed:', sent.error)
      return NextResponse.json({ error: 'Could not send WhatsApp message' }, { status: 502 })
    }

    await leadRef.collection('messages').add({
      channel: 'whatsapp',
      direction: 'outbound',
      text: message,
      sender: 'human',
      timestamp: FieldValue.serverTimestamp(),
    })

    await leadRef.update({
      status: 'payment_sent',
      paymentLinkSentBy: uid,
      paymentLinkSentAt: FieldValue.serverTimestamp(),
      lastMessageAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })

    return NextResponse.json({ ok: true, url })
  } catch (err) {
    console.error('[send-payment-link]', err)
    return NextResponse.json({ error: 'Failed to send payment link' }, { status: 500 })
  }
}
