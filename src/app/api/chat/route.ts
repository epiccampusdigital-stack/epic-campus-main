export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'

const FALLBACK_MESSAGE =
  'Our AI assistant is temporarily unavailable. Please contact us directly at info@epiccampus.lk or call +94 91 222 83 83.'

function friendlyResponse() {
  return NextResponse.json({ message: FALLBACK_MESSAGE, content: [{ type: 'text', text: FALLBACK_MESSAGE }] })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const apiKey = process.env.ANTHROPIC_API_KEY

    if (!apiKey || apiKey === 'your_anthropic_api_key_here' || apiKey.trim() === '') {
      return friendlyResponse()
    }

    const { sessionId, userMessage, ...anthropicBody } = body as {
      sessionId?: string
      userMessage?: string
      model: string
      max_tokens: number
      system: string
      messages: { role: string; content: string }[]
    }

    let response: Response
    try {
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(anthropicBody),
      })
    } catch (fetchErr) {
      console.error('[api/chat] Fetch failed:', fetchErr)
      return friendlyResponse()
    }

    const data = (await response.json()) as {
      content?: { type: string; text: string }[]
      error?: { message?: string }
    }

    if (!response.ok) {
      console.error('[api/chat] Anthropic error:', response.status, data)
      return friendlyResponse()
    }

    const botResponse = data.content?.[0]?.text ?? ''
    if (userMessage && botResponse) {
      adminDb
        .collection('publicChatLogs')
        .add({
          sessionId: sessionId ?? 'unknown',
          userMessage,
          botResponse,
          createdAt: new Date(),
          pageUrl: req.headers.get('referer') ?? '',
          userAgent: req.headers.get('user-agent') ?? '',
        })
        .catch((err: unknown) => console.error('[api/chat] Log save failed:', err))
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('[api/chat] Unexpected error:', err)
    return friendlyResponse()
  }
}
