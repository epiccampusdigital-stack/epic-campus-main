export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey === 'your_anthropic_api_key_here') {
    return NextResponse.json({ suggestions: [] }, { status: 500 })
  }

  try {
    const body = await request.json() as {
      action?: string
      wasteData?: unknown
      inventoryData?: unknown
      billText?: string
      imageBase64?: string
      imageMediaType?: string
      existingInventory?: { id: string; itemName: string; unit: string; category: string }[]
    }

    // Bill importer — read a supplier bill (text or photo) and extract items.
    if (body.action === 'parse_bill') {
      return await parseBill(apiKey, body)
    }

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

// Reads a supplier bill (pasted text and/or a photo via Claude vision) and returns
// the extracted items as structured JSON, matched against existing inventory.
async function parseBill(
  apiKey: string,
  body: {
    billText?: string
    imageBase64?: string
    imageMediaType?: string
    existingInventory?: { id: string; itemName: string; unit: string; category: string }[]
  },
): Promise<NextResponse> {
  const inventoryList = (body.existingInventory ?? [])
    .map((i) => `${i.id} | ${i.itemName} | ${i.unit} | ${i.category}`)
    .join('\n')

  const system = `You are a kitchen inventory assistant for a Sri Lankan campus. Read this supplier bill and extract all items purchased.

For each item found:
- Match to existing inventory if possible (fuzzy match on item name).
- Extract: item name, quantity, unit, unit price, line total.
- Suggest a category if it is a new item. Category MUST be one of: grains, protein, vegetables, dairy, condiments, beverages, other.

Return ONLY valid JSON (no markdown, no commentary):
{
  "supplierName": string,
  "billDate": string (YYYY-MM-DD),
  "billTotal": number,
  "items": [
    {
      "matchedItemId": string | null,
      "matchedItemName": string | null,
      "rawName": string,
      "quantity": number,
      "unit": string,
      "unitPrice": number,
      "lineTotal": number,
      "isNewItem": boolean,
      "suggestedCategory": string
    }
  ],
  "confidence": number
}`

  const userContent: Record<string, unknown>[] = []
  if (body.imageBase64 && body.imageMediaType) {
    userContent.push({
      type: 'image',
      source: { type: 'base64', media_type: body.imageMediaType, data: body.imageBase64 },
    })
  }
  userContent.push({
    type: 'text',
    text:
      `Existing inventory (id | name | unit | category):\n${inventoryList || '(none)'}\n\n` +
      `Supplier bill:\n${body.billText?.trim() || '(see attached photo)'}\n\n` +
      `Extract every purchased line item as the JSON schema described.`,
  })

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        system,
        messages: [{ role: 'user', content: userContent }],
        stream: false,
      }),
    })

    const data = (await response.json()) as { content?: { type: string; text: string }[]; error?: unknown }
    if (!response.ok) {
      console.error('[kitchen-ai parse_bill] Anthropic error:', data)
      return NextResponse.json({ error: 'AI could not read the bill. Please try again.' }, { status: 502 })
    }

    const text = data.content?.[0]?.type === 'text' ? data.content[0].text : '{}'
    const cleaned = text.replace(/```json|```/g, '').trim()
    try {
      return NextResponse.json(JSON.parse(cleaned))
    } catch {
      return NextResponse.json(
        { error: 'Could not understand the bill. Try a clearer photo or paste the text.' },
        { status: 422 },
      )
    }
  } catch (err) {
    console.error('[kitchen-ai parse_bill]', err)
    return NextResponse.json({ error: 'AI request failed.' }, { status: 500 })
  }
}
