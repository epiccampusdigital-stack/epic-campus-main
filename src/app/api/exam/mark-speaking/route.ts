export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    console.log('[mark-speaking] API key present:', !!apiKey, 'length:', apiKey?.length ?? 0)
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
    }
    const client = new Anthropic({ apiKey })

    const { transcription, prompt, partNumber, level } = await req.json()

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system:
        'You are a Japanese language examiner. Return raw JSON only. Never use markdown.',
      messages: [
        {
          role: 'user',
          content: `Mark this Japanese speaking response at ${level} level:

PART: ${partNumber}
PROMPT: ${prompt}
TRANSCRIPTION: ${transcription}

Return ONLY valid JSON:
{
  "score": 75,
  "fluency": 70,
  "vocabulary": 75,
  "grammar": 80,
  "pronunciation": 75,
  "feedback": "2-3 sentences of actionable feedback"
}`,
        },
      ],
    })

    let text =
      response.content[0].type === 'text' ? response.content[0].text : ''
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    return NextResponse.json(JSON.parse(text))
  } catch (err) {
    console.error('mark-speaking error:', err)
    return NextResponse.json({ error: 'Failed to mark speaking' }, { status: 500 })
  }
}
