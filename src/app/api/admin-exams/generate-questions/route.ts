export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
    }

    const { content } = await req.json() as {
      content: Array<{ type: string; source?: { type: string; media_type: string; data: string }; text?: string }>
    }

    const client = new Anthropic({ apiKey })
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4000,
      messages: [{ role: 'user', content: content as unknown as Anthropic.MessageParam['content'] }],
    })

    const block = message.content.find((c) => c.type === 'text')
    const text = block && block.type === 'text' ? block.text : ''

    return NextResponse.json({ text })
  } catch (err) {
    console.error('[AIQuestionBuilder generate]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Generation failed' },
      { status: 500 },
    )
  }
}
