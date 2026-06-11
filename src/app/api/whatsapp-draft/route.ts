export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

type MessageType = 'check-in' | 'payment-reminder' | 'attendance-alert' | 'general'

interface DraftRequest {
  studentName?: string
  course?: string
  riskFlags?: string[]
  recommendation?: string
  staffName?: string
  messageType?: MessageType
}

function fallbackMessage(body: DraftRequest): string {
  const name = body.studentName?.trim() || 'there'
  const course = body.course?.trim() || 'your course'
  const staff = body.staffName?.trim() || 'Epic Campus team'
  const flags = body.riskFlags?.filter(Boolean) ?? []
  const situation =
    flags.length > 0
      ? flags[0]
      : body.recommendation?.trim() || 'we wanted to check in on your progress'

  switch (body.messageType) {
    case 'payment-reminder':
      return `Hi ${name}, hope you're doing well. We noticed your course fees for ${course} need attention. Please let us know if you need help with payment — we're happy to support you. — ${staff}`
    case 'attendance-alert':
      return `Hi ${name}, we missed you in class recently for ${course}. Regular attendance really helps you succeed — please reach out if anything is making it hard to come. We believe in you! — ${staff}`
    case 'general':
      return `Hi ${name}, ${situation}. We're here to help you stay on track with ${course}. Feel free to message us anytime. — ${staff}`
    case 'check-in':
    default:
      return `Hi ${name}, just checking in on how ${course} is going for you. ${situation.charAt(0).toUpperCase() + situation.slice(1)} — please reach out if you need anything. You've got this! — ${staff}`
  }
}

function buildSystemPrompt(staffName: string): string {
  return `You are a caring student advisor at Epic Campus, a Sri Lankan overseas education institute. Write a short warm WhatsApp message (under 100 words) to a student who needs support. The message must:
- Feel personal and caring, NOT automated or formal
- Be in simple English appropriate for Sri Lankan students
- Address their specific situation based on the flags provided
- End with an encouraging line
- NOT mention AI or automated message
- Sound like it was written by a real staff member named ${staffName}
Format: just the message text only, no greeting prefix, no subject line.`
}

function buildUserPrompt(body: Required<Pick<DraftRequest, 'studentName' | 'course' | 'staffName' | 'messageType'>> & {
  riskFlags: string[]
  recommendation: string
}): string {
  const typeLabel = {
    'check-in': 'friendly check-in',
    'payment-reminder': 'gentle payment reminder',
    'attendance-alert': 'attendance concern follow-up',
    general: 'general supportive follow-up',
  }[body.messageType]

  return `Write a ${typeLabel} WhatsApp message for:
Student: ${body.studentName}
Course: ${body.course}
Risk flags: ${body.riskFlags.length ? body.riskFlags.join('; ') : 'None specified'}
Staff recommendation: ${body.recommendation || 'None'}
Message type: ${body.messageType}`
}

export async function POST(request: NextRequest) {
  let body: DraftRequest = {}

  try {
    body = (await request.json()) as DraftRequest
  } catch {
    return NextResponse.json({ message: fallbackMessage({}) })
  }

  const studentName = body.studentName?.trim() || 'Student'
  const course = body.course?.trim() || 'their course'
  const staffName = body.staffName?.trim() || 'Epic Campus'
  const riskFlags = Array.isArray(body.riskFlags) ? body.riskFlags.filter(Boolean) : []
  const recommendation = body.recommendation?.trim() || ''
  const messageType: MessageType =
    body.messageType === 'payment-reminder' ||
    body.messageType === 'attendance-alert' ||
    body.messageType === 'general'
      ? body.messageType
      : 'check-in'

  const normalized: DraftRequest = {
    studentName,
    course,
    staffName,
    riskFlags,
    recommendation,
    messageType,
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey === 'your_anthropic_api_key_here') {
    return NextResponse.json({ message: fallbackMessage(normalized) })
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        system: buildSystemPrompt(staffName),
        messages: [
          {
            role: 'user',
            content: buildUserPrompt({
              studentName,
              course,
              staffName,
              messageType,
              riskFlags,
              recommendation,
            }),
          },
        ],
      }),
    })

    const data = (await response.json()) as {
      content?: { type: string; text: string }[]
      error?: unknown
    }

    if (!response.ok) {
      console.error('[whatsapp-draft] Anthropic error:', data)
      return NextResponse.json({ message: fallbackMessage(normalized) })
    }

    const text = data.content?.[0]?.type === 'text' ? data.content[0].text.trim() : ''
    if (!text) {
      return NextResponse.json({ message: fallbackMessage(normalized) })
    }

    return NextResponse.json({ message: text })
  } catch (error) {
    console.error('[whatsapp-draft]', error)
    return NextResponse.json({ message: fallbackMessage(normalized) })
  }
}
