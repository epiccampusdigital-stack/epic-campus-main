export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey === 'your_anthropic_api_key_here') {
    return NextResponse.json({ suggestions: [] }, { status: 500 })
  }

  try {
    const body = await request.json() as { wasteData?: unknown; inventoryData?: unknown }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        system: `You are a kitchen efficiency advisor for a Sri Lankan student residential campus canteen in Ahangama, Southern Province.
Analyse waste data and provide specific, actionable recommendations to reduce food waste.
Be practical and culturally appropriate for Sri Lanka (rice-based meals, curry-based cooking, tropical climate storage issues).
Respond ONLY with a valid JSON array, no markdown, no explanation outside the array.
Format: [{"suggestion": "specific actionable advice", "priority": "high|medium|low", "potentialSaving": "e.g. Save LKR 3,000/month"}]
Provide exactly 4-5 suggestions.`,
        messages: [
          {
            role: 'user',
            content: `Waste data from last 30 days: ${JSON.stringify(body.wasteData)}\n\nCurrent inventory: ${JSON.stringify(body.inventoryData)}\n\nGive me 4-5 specific suggestions to reduce waste and save money.`,
          },
        ],
        stream: false,
      }),
    })

    const data = await response.json() as { content?: { type: string; text: string }[]; error?: unknown }

    if (!response.ok) {
      console.error('[kitchen-ai] Anthropic error:', data)
      return NextResponse.json({ suggestions: [] }, { status: 500 })
    }

    const text = data.content?.[0]?.type === 'text' ? data.content[0].text : '[]'
    const cleaned = text.replace(/```json|```/g, '').trim()
    const suggestions = JSON.parse(cleaned) as unknown[]
    return NextResponse.json({ suggestions })
  } catch (error) {
    console.error('[kitchen-ai]', error)
    return NextResponse.json({ suggestions: [] }, { status: 500 })
  }
}
