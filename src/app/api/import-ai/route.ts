export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey === 'your_anthropic_api_key_here' || apiKey.trim() === '') {
    return NextResponse.json({ error: 'AI not configured' }, { status: 500 })
  }

  try {
    const body = await req.json() as {
      rawText: string
      systemPrompt: string
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        system: body.systemPrompt,
        messages: [{ role: 'user', content: body.rawText }],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      return NextResponse.json({ error: err }, { status: response.status })
    }

    const data = await response.json() as {
      content?: { type: string; text: string }[]
    }
    const text = data.content?.[0]?.text ?? ''
    return NextResponse.json({ text })
  } catch (err) {
    console.error('[ImportAI]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
