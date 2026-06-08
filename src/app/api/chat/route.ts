export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const apiKey = process.env.ANTHROPIC_API_KEY

    console.log('[api/chat] API key present:', !!apiKey, 'length:', apiKey?.length ?? 0)

    if (!apiKey || apiKey === 'your_anthropic_api_key_here') {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()
    if (!response.ok) {
      console.error('[api/chat] Anthropic error:', response.status, data)
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
