export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey || apiKey === 'your_anthropic_api_key_here') {
    return NextResponse.json({ error: 'Anthropic API key not configured' }, { status: 500 })
  }

  try {
    const body = await req.json() as {
      model?: string
      max_tokens?: number
      system?: string
      messages?: { role: string; content: string }[]
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: body.model ?? 'claude-haiku-4-5-20251001',
        max_tokens: body.max_tokens ?? 1024,
        system: body.system ?? 'You are a helpful study assistant at EPIC Campus Sri Lanka.',
        messages: body.messages ?? [],
        stream: false,
      }),
    })

    const data = await response.json() as { content?: { type: string; text: string }[]; error?: unknown }

    if (!response.ok) {
      console.error('[chat/stream] Anthropic error:', response.status, data)
      return NextResponse.json({ error: 'AI service error' }, { status: response.status })
    }

    const text = data.content?.[0]?.type === 'text' ? data.content[0].text : ''
    return NextResponse.json({ content: text })
  } catch (err) {
    console.error('[chat/stream]', err)
    return NextResponse.json({ error: 'Failed to connect to AI service' }, { status: 500 })
  }
}
