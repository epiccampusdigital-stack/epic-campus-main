import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const apiKey = process.env.ANTHROPIC_API_KEY

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
  return NextResponse.json(data, { status: response.status })
}
