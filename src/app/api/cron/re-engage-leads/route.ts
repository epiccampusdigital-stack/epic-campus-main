export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/admin'
import { sendWhatsApp } from '@/lib/twilio'
import { isAiManagedLeadId } from '@/lib/leads/aiLeads'

const MODEL = 'claude-haiku-4-5-20251001'
const QUIET_HOURS = 48
const MAX_REENGAGEMENTS = 2
/** Ceiling per run so one invocation can't exceed the Cloud Run request timeout. */
const MAX_PER_RUN = 25
/** Candidates pulled before in-memory filtering. */
const SCAN_LIMIT = 300

/** Constant-time compare so the secret can't be recovered by timing the response. */
function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

interface Candidate {
  id: string
  name: string
  phone: string
  programInterest: string
  reengagementCount: number
}

function defaultFollowUp(lead: Candidate): string {
  const greeting = lead.name ? `Hi ${lead.name},` : 'Hi,'
  const topic = lead.programInterest
    ? `about the ${lead.programInterest} program`
    : 'about studying or working abroad'
  return (
    `${greeting}\n\nStill thinking ${topic}? Happy to answer any questions — ` +
    `just reply here whenever you are ready.\n\n— EPIC Campus`
  )
}

/** sales_approach blocks from the Knowledge Base, used to set the follow-up tone. */
async function loadSalesApproach(): Promise<string> {
  const snap = await adminDb
    .collection('aiKnowledgeBase')
    .where('category', '==', 'sales_approach')
    .get()
  if (snap.empty) return ''
  return snap.docs
    .map((d) => {
      const data = d.data()
      return `### ${String(data.title ?? '')}\n${String(data.content ?? '')}`
    })
    .filter((s) => s.trim())
    .join('\n\n')
}

/**
 * Drafts the follow-up in the tone the Knowledge Base describes. Any failure
 * falls back to the default template — a quiet lead still gets a message.
 */
async function draftFollowUp(
  client: Anthropic,
  salesApproach: string,
  lead: Candidate,
): Promise<string> {
  try {
    const completion = await client.messages.create({
      model: MODEL,
      max_tokens: 300,
      system: `You write short WhatsApp follow-up messages for EPIC Campus, an overseas education institute in Sri Lanka, to leads who stopped replying.

Rules:
- 2 sentences maximum. Warm, low pressure, easy to reply to.
- Do NOT invent programs, fees, dates, requirements or outcomes.
- Do NOT mention payment, payment links, or ask for any personal or card details.
- Do NOT apologise for messaging or guilt them for not replying.
- Return ONLY the message text, no preamble or quotes.

Write in the tone described here:
${salesApproach}`,
      messages: [
        {
          role: 'user',
          content: `Write a follow-up to ${lead.name || 'a lead'} who asked about ${
            lead.programInterest || 'studying abroad'
          } and has not replied in ${QUIET_HOURS} hours. This is follow-up number ${
            lead.reengagementCount + 1
          } of ${MAX_REENGAGEMENTS}.`,
        },
      ],
    })
    const text = completion.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('')
      .trim()
    return text || defaultFollowUp(lead)
  } catch (err) {
    console.error(`[re-engage-leads] Draft failed for ${lead.id}, using default:`, err)
    return defaultFollowUp(lead)
  }
}

export async function POST(req: NextRequest) {
  // Fail closed: an unset secret disables the route rather than opening it.
  const expected = process.env.CRON_SECRET ?? ''
  if (!expected) {
    console.error('[re-engage-leads] CRON_SECRET not configured')
    return NextResponse.json({ error: 'Not configured' }, { status: 503 })
  }
  const provided = req.headers.get('x-cron-secret') ?? ''
  if (!provided || !secretMatches(provided, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const errors: string[] = []
  let checked = 0
  let messaged = 0

  try {
    const cutoff = Timestamp.fromMillis(Date.now() - QUIET_HOURS * 60 * 60 * 1000)

    // Single-field range query — served by the automatic index, so this needs no
    // composite index deploy. The remaining conditions are applied in memory;
    // the knowledge base of leads is small and this keeps the query portable.
    const snap = await adminDb
      .collection('leads')
      .where('lastMessageAt', '<', cutoff)
      .orderBy('lastMessageAt', 'asc')
      .limit(SCAN_LIMIT)
      .get()

    const candidates: Candidate[] = []
    for (const doc of snap.docs) {
      const data = doc.data()
      checked += 1

      // Legacy CRM leads have no lastMessageAt so never reach here, but guard
      // anyway — automated WhatsApp must only ever touch AI-managed leads.
      if (!isAiManagedLeadId(doc.id)) continue

      const status = String(data.status ?? '')
      if (status !== 'qualifying' && status !== 'ready_for_payment') continue
      if (data.aiPaused === true) continue

      const count = Number(data.reengagementCount ?? 0)
      if (!Number.isFinite(count) || count >= MAX_REENGAGEMENTS) continue

      const phone = String(data.phone ?? '')
      if (!phone) continue

      candidates.push({
        id: doc.id,
        name: String(data.name ?? ''),
        phone,
        programInterest: String(data.programInterest ?? ''),
        reengagementCount: count,
      })
    }

    const batch = candidates.slice(0, MAX_PER_RUN)
    const skipped = candidates.length - batch.length

    const apiKey = process.env.ANTHROPIC_API_KEY
    const salesApproach = apiKey ? await loadSalesApproach() : ''
    const client = apiKey && salesApproach ? new Anthropic({ apiKey }) : null

    for (const lead of batch) {
      try {
        const message = client
          ? await draftFollowUp(client, salesApproach, lead)
          : defaultFollowUp(lead)

        const sent = await sendWhatsApp(lead.phone, message)
        if (!sent.ok) {
          errors.push(`${lead.id}: twilio — ${sent.error ?? 'send failed'}`)
          continue
        }

        const leadRef = adminDb.collection('leads').doc(lead.id)
        await leadRef.collection('messages').add({
          channel: 'whatsapp',
          direction: 'outbound',
          text: message,
          sender: 'ai',
          timestamp: FieldValue.serverTimestamp(),
        })
        await leadRef.update({
          reengagementCount: FieldValue.increment(1),
          lastReengagedAt: FieldValue.serverTimestamp(),
          lastMessageAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        })

        messaged += 1
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err)
        console.error(`[re-engage-leads] ${lead.id}:`, err)
        errors.push(`${lead.id}: ${detail}`)
      }
    }

    if (skipped > 0) {
      console.log(`[re-engage-leads] ${skipped} eligible leads deferred to the next run`)
    }

    return NextResponse.json({
      ok: true,
      checked,
      eligible: candidates.length,
      messaged,
      deferred: skipped,
      toneSource: client ? 'sales_approach' : 'default_template',
      errors,
    })
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    console.error('[re-engage-leads]', err)
    return NextResponse.json(
      { ok: false, checked, messaged, error: detail, errors },
      { status: 500 },
    )
  }
}
