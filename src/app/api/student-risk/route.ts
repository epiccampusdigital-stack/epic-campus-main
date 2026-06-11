export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import type { StudentRiskProfile } from '@/lib/ai/studentRisk'

const SYSTEM_PROMPT = `You are a student success advisor for a Sri Lankan overseas education institute.
You receive student risk data and provide one specific, actionable recommendation per student.
Be empathetic and practical. Recommendations should be things staff can actually do today.
Respond ONLY with a JSON array: [{studentId: string, recommendation: string}]
Keep each recommendation under 20 words.`

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey === 'your_anthropic_api_key_here') {
    return NextResponse.json({ recommendations: [] })
  }

  try {
    const body = (await request.json()) as { profiles?: StudentRiskProfile[] }
    const profiles = (body.profiles ?? []).filter(
      (p) => p.riskLevel === 'high' || p.riskLevel === 'medium',
    )

    if (profiles.length === 0) {
      return NextResponse.json({ recommendations: [] })
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
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Generate recommendations for these at-risk students:\n${JSON.stringify(
              profiles.map((p) => ({
                studentId: p.studentId,
                studentName: p.studentName,
                course: p.course,
                riskLevel: p.riskLevel,
                riskScore: p.riskScore,
                flags: p.flags,
                attendancePercent: p.attendancePercent,
                examAverage: p.examAverage,
                daysSinceLastLogin: p.daysSinceLastLogin,
              })),
            )}`,
          },
        ],
        stream: false,
      }),
    })

    const data = (await response.json()) as {
      content?: { type: string; text: string }[]
      error?: unknown
    }

    if (!response.ok) {
      console.error('[student-risk] Anthropic error:', data)
      return NextResponse.json({ recommendations: [] })
    }

    const text = data.content?.[0]?.type === 'text' ? data.content[0].text : '[]'
    const cleaned = text.replace(/```json|```/g, '').trim()
    const recommendations = JSON.parse(cleaned) as { studentId: string; recommendation: string }[]
    return NextResponse.json({ recommendations })
  } catch (error) {
    console.error('[student-risk]', error)
    return NextResponse.json({ recommendations: [] })
  }
}
