export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import twilio from 'twilio'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/admin'
import { normalizeWhatsAppNumber, sendWhatsApp } from '@/lib/twilio'
import {
  isAiLeadStatus,
  isLeadScore,
  leadIdFromNormalizedPhone,
  type AiLeadStatus,
} from '@/lib/leads/aiLeads'

const MODEL = 'claude-haiku-4-5-20251001'
/** How many past messages to replay to the model. Bounds token spend per reply. */
const HISTORY_LIMIT = 40

/** Twilio expects TwiML (or at least 200) — we send the reply out-of-band via the API. */
function twimlOk() {
  return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  })
}

/**
 * Signature check. Mirrors the Stripe webhook's behaviour: verify when
 * configured, log and continue when not, so a misconfigured URL can't silently
 * take the whole line down. Set TWILIO_VALIDATE_WEBHOOK=true in production.
 */
function verifyTwilioSignature(req: NextRequest, params: Record<string, string>): boolean {
  if (process.env.TWILIO_VALIDATE_WEBHOOK !== 'true') {
    console.log('[whatsapp webhook] Signature validation disabled — skipping')
    return true
  }
  const authToken = process.env.TWILIO_AUTH_TOKEN ?? ''
  const signature = req.headers.get('x-twilio-signature') ?? ''
  if (!authToken || !signature) {
    console.error('[whatsapp webhook] Missing auth token or signature header')
    return false
  }
  // Twilio signs the exact public URL it was configured with.
  const url = process.env.TWILIO_WEBHOOK_URL || req.nextUrl.href
  return twilio.validateRequest(authToken, signature, url, params)
}

interface KnowledgeBlockRow {
  category: string
  title: string
  content: string
}

async function loadKnowledgeBase(): Promise<string> {
  const snap = await adminDb.collection('aiKnowledgeBase').get()
  if (snap.empty) return ''

  const byCategory = new Map<string, KnowledgeBlockRow[]>()
  snap.docs.forEach((d) => {
    const data = d.data()
    const row: KnowledgeBlockRow = {
      category: String(data.category ?? 'faqs'),
      title: String(data.title ?? ''),
      content: String(data.content ?? ''),
    }
    if (!row.content.trim()) return
    const list = byCategory.get(row.category) ?? []
    list.push(row)
    byCategory.set(row.category, list)
  })

  const sections: string[] = []
  for (const [category, rows] of Array.from(byCategory.entries())) {
    const body = rows.map((r) => `### ${r.title}\n${r.content}`).join('\n\n')
    sections.push(`## ${category.replace(/_/g, ' ').toUpperCase()}\n\n${body}`)
  }
  return sections.join('\n\n')
}

function buildSystemPrompt(knowledgeBase: string, lead: {
  name: string
  programInterest: string
  qualificationAnswers: Record<string, string>
}): string {
  const known = Object.entries(lead.qualificationAnswers)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n')

  return `You are the enquiry assistant for EPIC Campus, a TVEC-accredited overseas education and employment institute in Galle/Ahangama, Sri Lanka. You answer prospective students (leads) on WhatsApp.

# YOUR JOB
1. Qualify the lead. You need three things: which program they want, their education level, and their timeline for going abroad. Ask for what is still missing — one or two questions at a time, never a long form.
2. Answer their questions accurately using ONLY the knowledge base below.
3. Find them a program that fits, even if it is not the one they first asked about.
4. Decide when they are ready to be handed to a human for payment.

# ABSOLUTE RULES
- Answer ONLY from the knowledge base below. If the answer is not there, say you will check with the team and someone will follow up. NEVER invent programs, fees, dates, requirements, or outcomes.
- Do NOT discuss pricing or payment mechanics beyond exactly what the knowledge base states.
- NEVER ask for card, bank, or payment details of any kind.
- NEVER say you are sending a payment link, and never claim a payment has been received. A human colleague handles payment. If they want to pay, say a team member will send the payment details shortly.
- Never promise a visa outcome, a job placement, or a salary that is not stated in the knowledge base.
- Keep replies short and conversational — WhatsApp, not email. Usually 2-4 sentences.
- Match the language the lead writes in (English or Sinhala). Keep it simple and warm.

# WHAT YOU ALREADY KNOW ABOUT THIS LEAD
Name: ${lead.name || 'unknown'}
Program interest: ${lead.programInterest || 'unknown'}
${known || '- nothing recorded yet'}

# FINDING A BETTER FIT (CROSS-SELL)
If what the lead wants does not match what they qualify for — for example their education level is below the entry requirement a program states in the knowledge base — do NOT just tell them they do not qualify and stop. Instead:
- Say plainly and kindly which requirement is not met, quoting the requirement as the knowledge base states it.
- In the same message, suggest a program from the knowledge base whose stated requirements they DO meet, and say in one line why it suits them.
- Then ask if they would like to hear more about that one.
Only ever suggest programs that appear in the knowledge base, and only ever cite eligibility rules exactly as written there. If nothing in the knowledge base fits them, say a team member will follow up with options — never invent a program or a requirement to fill the gap.

# STATUS SIGNAL
Set status to "ready_for_payment" ONLY when all three qualification points are known AND the lead has clearly said they want to enrol or proceed. Otherwise use "qualifying". Use "lost" only if they explicitly say they are not interested.

# SCORING SIGNAL
Set leadScore every turn, re-judged from the whole conversation so far — it may go up or down:
- "hot": clear intent, meets the qualification requirements, and is actively asking next-step questions such as cost, timeline, or how to start.
- "warm": genuinely interested but still gathering information, and has not confirmed their qualification details yet.
- "cold": vague interest, not answering your qualifying questions, or just browsing early.

# KNOWLEDGE BASE
${knowledgeBase || '(The knowledge base is empty. Do not answer factual questions — say a team member will follow up shortly.)'}`
}

const REPLY_TOOL: Anthropic.Tool = {
  name: 'reply_to_lead',
  description:
    'Send the WhatsApp reply to the lead and report the qualification state. Always call this exactly once.',
  input_schema: {
    type: 'object',
    properties: {
      reply: {
        type: 'string',
        description: 'The WhatsApp message text to send to the lead.',
      },
      status: {
        type: 'string',
        enum: ['qualifying', 'ready_for_payment', 'lost'],
        description:
          'ready_for_payment only when program, education level and timeline are all known AND the lead wants to proceed.',
      },
      programInterest: {
        type: 'string',
        description: 'The program the lead is interested in, if known. Empty string if not.',
      },
      leadName: {
        type: 'string',
        description: 'The lead\'s name if they have given it. Empty string if not.',
      },
      leadScore: {
        type: 'string',
        enum: ['hot', 'warm', 'cold'],
        description:
          'How promising this lead is right now. hot = clear intent, meets qualification, actively asking next-step questions (cost, timeline, how to start). warm = interested, still gathering information, has not confirmed qualification details. cold = vague interest, unresponsive to qualifying questions, or early/browsing. Re-assess every turn — the score can move up or down.',
      },
      qualificationAnswers: {
        type: 'object',
        description:
          'Qualification facts learned so far, e.g. {"educationLevel":"O/L","timeline":"within 6 months"}. Include everything known, not just the newest.',
        additionalProperties: { type: 'string' },
      },
    },
    required: ['reply', 'status', 'leadScore'],
  },
}

interface ReplyToolInput {
  reply: string
  status: string
  leadScore?: string
  programInterest?: string
  leadName?: string
  qualificationAnswers?: Record<string, string>
}

/** Collapses consecutive same-role turns so the Messages API gets clean alternation. */
function toAnthropicMessages(
  rows: { direction: string; text: string }[],
): Anthropic.MessageParam[] {
  const out: Anthropic.MessageParam[] = []
  for (const row of rows) {
    if (!row.text.trim()) continue
    const role: 'user' | 'assistant' = row.direction === 'inbound' ? 'user' : 'assistant'
    const last = out[out.length - 1]
    if (last && last.role === role) {
      last.content = `${last.content as string}\n\n${row.text}`
    } else {
      out.push({ role, content: row.text })
    }
  }
  // The API requires the conversation to open with a user turn.
  while (out.length > 0 && out[0].role !== 'user') out.shift()
  return out
}

export async function POST(req: NextRequest) {
  const params: Record<string, string> = {}
  try {
    const form = await req.formData()
    form.forEach((value, key) => {
      params[key] = String(value)
    })
  } catch (err) {
    console.error('[whatsapp webhook] Could not parse form body', err)
    return twimlOk()
  }

  if (!verifyTwilioSignature(req, params)) {
    console.error('[whatsapp webhook] Invalid Twilio signature')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
  }

  const from = params.From ?? ''
  const body = (params.Body ?? '').trim()
  const profileName = (params.ProfileName ?? '').trim()

  if (!from) {
    console.error('[whatsapp webhook] Missing From')
    return twimlOk()
  }

  const digits = normalizeWhatsAppNumber(from)
  const leadId = leadIdFromNormalizedPhone(digits)
  const leadRef = adminDb.collection('leads').doc(leadId)

  try {
    const snap = await leadRef.get()
    const existing = snap.exists ? snap.data()! : null

    if (!existing) {
      await leadRef.set({
        phone: `+${digits}`,
        name: profileName,
        programInterest: '',
        qualificationAnswers: {},
        status: 'new' as AiLeadStatus,
        channels: ['whatsapp'],
        aiPaused: false,
        // Kept so the existing CRM list/table can parse these rows sanely.
        source: 'whatsapp',
        branchId: 'galle-main',
        createdAt: FieldValue.serverTimestamp(),
        createdBy: 'whatsapp-ai',
        lastMessageAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      })
    } else {
      await leadRef.update({
        channels: FieldValue.arrayUnion('whatsapp'),
        lastMessageAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        ...(profileName && !existing.name ? { name: profileName } : {}),
      })
    }

    // Always log the inbound message, whether or not the AI replies.
    await leadRef.collection('messages').add({
      channel: 'whatsapp',
      direction: 'inbound',
      text: body,
      sender: 'lead',
      timestamp: FieldValue.serverTimestamp(),
    })

    // Human takeover hook (Phase C builds the toggle — here we only respect it).
    if (existing?.aiPaused === true) {
      console.log(`[whatsapp webhook] ${leadId} is AI-paused — logged inbound only`)
      return twimlOk()
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      console.error('[whatsapp webhook] ANTHROPIC_API_KEY not configured')
      return twimlOk()
    }

    const [knowledgeBase, historySnap] = await Promise.all([
      loadKnowledgeBase(),
      leadRef.collection('messages').orderBy('timestamp', 'asc').limitToLast(HISTORY_LIMIT).get(),
    ])

    const history = historySnap.docs.map((d) => ({
      direction: String(d.data().direction ?? 'inbound'),
      text: String(d.data().text ?? ''),
    }))
    const messages = toAnthropicMessages(history)
    if (messages.length === 0) {
      messages.push({ role: 'user', content: body || '(no text)' })
    }

    const system = buildSystemPrompt(knowledgeBase, {
      name: String(existing?.name ?? profileName ?? ''),
      programInterest: String(existing?.programInterest ?? ''),
      qualificationAnswers: (existing?.qualificationAnswers ?? {}) as Record<string, string>,
    })

    const client = new Anthropic({ apiKey })
    const completion = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system,
      messages,
      tools: [REPLY_TOOL],
      tool_choice: { type: 'tool', name: 'reply_to_lead' },
    })

    const toolBlock = completion.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
    )
    if (!toolBlock) {
      console.error('[whatsapp webhook] Model returned no tool_use block')
      return twimlOk()
    }

    const result = toolBlock.input as ReplyToolInput
    const replyText = String(result.reply ?? '').trim()
    if (!replyText) {
      console.error('[whatsapp webhook] Empty reply from model')
      return twimlOk()
    }

    const sent = await sendWhatsApp(from, replyText)
    if (!sent.ok) {
      console.error('[whatsapp webhook] Twilio send failed:', sent.error)
    }

    await leadRef.collection('messages').add({
      channel: 'whatsapp',
      direction: 'outbound',
      text: replyText,
      sender: 'ai',
      timestamp: FieldValue.serverTimestamp(),
    })

    const signalled = isAiLeadStatus(result.status) ? result.status : 'qualifying'
    // 'new' and 'paid' are never model-assigned; 'paid' comes from the Stripe webhook.
    const nextStatus: AiLeadStatus = signalled === 'new' || signalled === 'paid' ? 'qualifying' : signalled

    const update: Record<string, unknown> = {
      status: nextStatus,
      // Re-scored on every AI turn — always overwritten, never set once.
      leadScore: isLeadScore(result.leadScore) ? result.leadScore : 'warm',
      lastMessageAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }
    if (result.leadName?.trim()) update.name = result.leadName.trim()
    if (result.programInterest?.trim()) update.programInterest = result.programInterest.trim()
    if (result.qualificationAnswers && typeof result.qualificationAnswers === 'object') {
      update.qualificationAnswers = result.qualificationAnswers
    }
    // A lead ready to pay is handed to a human — the AI stops here.
    if (nextStatus === 'ready_for_payment') update.aiPaused = true

    await leadRef.update(update)

    return twimlOk()
  } catch (err) {
    console.error('[whatsapp webhook]', err)
    // Always 200 to Twilio — a 500 makes it retry and duplicate the conversation.
    return twimlOk()
  }
}
