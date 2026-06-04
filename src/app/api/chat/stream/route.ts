import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey || apiKey === 'your_anthropic_api_key_here') {
    return new Response(
      JSON.stringify({ error: 'Anthropic API key not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ ...body, stream: true }),
    })

    if (!response.ok || !response.body) {
      const err = await response.text()
      return new Response(err, { status: response.status, headers: { 'Content-Type': 'application/json' } })
    }

    return new Response(response.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (err) {
    console.error('[chat/stream]', err)
    return new Response(
      JSON.stringify({ error: 'Failed to connect to AI service' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}
