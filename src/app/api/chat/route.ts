export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const apiKey = process.env.ANTHROPIC_API_KEY

    console.log('[api/chat] API key present:', !!apiKey, 'length:', apiKey?.length ?? 0)

    if (!apiKey || apiKey === 'your_anthropic_api_key_here') {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
    }

    // Strip internal fields before forwarding to Anthropic
    const { sessionId, userMessage, ...anthropicBody } = body as {
      sessionId?: string
      userMessage?: string
      model: string
      max_tokens: number
      system: string
      messages: { role: string; content: string }[]
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(anthropicBody),
    })

    const data = await response.json() as { content?: { type: string; text: string }[] }
    if (!response.ok) {
      console.error('[api/chat] Anthropic error:', response.status, data)
      return NextResponse.json(data, { status: response.status })
    }

    // Save chat log to Firestore (best-effort)
    const botResponse = data.content?.[0]?.text ?? ''
    if (userMessage && botResponse) {
      adminDb.collection('publicChatLogs').add({
        sessionId: sessionId ?? 'unknown',
        userMessage,
        botResponse,
        createdAt: new Date(),
        pageUrl: req.headers.get('referer') ?? '',
        userAgent: req.headers.get('user-agent') ?? '',
      }).catch((err: unknown) => console.error('[api/chat] Log save failed:', err))
    }

    return NextResponse.json(data, { status: response.status })
  } catch (err) {
    console.error('[api/chat] Unexpected error:', err)
    return NextResponse.json(
      { error: 'Failed to connect to AI service' },
      { status: 500 },
    )
  }
}
