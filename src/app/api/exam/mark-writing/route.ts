export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { adminDb } from '@/lib/firebase/admin'
import { computeTotalScore, getGrade } from '@/lib/exam/helpers'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const {
      attemptId,
      task1Id,
      task2Id,
      task1Response,
      task1Prompt,
      task2Response,
      task2Prompt,
      level,
    } = await req.json()

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      system: `You are a Japanese language examiner marking student writing tasks at ${level} level. Return raw JSON only. Never use markdown.`,
      messages: [
        {
          role: 'user',
          content: `Mark these Japanese language writing tasks:

TASK 1 PROMPT: ${task1Prompt}
TASK 1 RESPONSE: ${task1Response}

TASK 2 PROMPT: ${task2Prompt}
TASK 2 RESPONSE: ${task2Response}

Return ONLY valid JSON:
{
  "task1Score": 75,
  "task2Score": 70,
  "overallScore": 72,
  "task1Feedback": "feedback text",
  "task2Feedback": "feedback text",
  "strengths": ["strength 1", "strength 2"],
  "improvements": ["improvement 1", "improvement 2"],
  "grade": "B"
}`,
        },
      ],
    })

    let text =
      response.content[0].type === 'text' ? response.content[0].text : ''
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    const result = JSON.parse(text) as {
      task1Score: number
      task2Score: number
      overallScore: number
      task1Feedback: string
      task2Feedback: string
      strengths: string[]
      improvements: string[]
      grade: string
    }

    if (attemptId) {
      const attemptRef = adminDb.collection('examAttempts').doc(attemptId)
      const attemptSnap = await attemptRef.get()
      const data = attemptSnap.data() ?? {}

      if (task1Id) {
        await attemptRef.collection('writingSubmissions').doc(task1Id).set(
          {
            taskNumber: 1,
            markingStatus: 'complete',
            score: result.task1Score,
            feedback: result.task1Feedback,
          },
          { merge: true },
        )
      }
      if (task2Id) {
        await attemptRef.collection('writingSubmissions').doc(task2Id).set(
          {
            taskNumber: 2,
            markingStatus: 'complete',
            score: result.task2Score,
            feedback: result.task2Feedback,
          },
          { merge: true },
        )
      }

      const writingScore = result.overallScore
      const totalScore = computeTotalScore({
        readingScore: Number(data.readingScore ?? 0),
        listeningScore: Number(data.listeningScore ?? 0),
        writingScore,
        speakingScore:
          data.speakingScore === null || data.speakingScore === undefined
            ? null
            : Number(data.speakingScore),
      })

      await attemptRef.update({
        writingScore,
        totalScore,
        grade: getGrade(totalScore),
        markingStatus: 'partial',
        writingFeedback: {
          strengths: result.strengths,
          improvements: result.improvements,
        },
      })
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('mark-writing error:', err)
    return NextResponse.json(
      { error: 'Failed to mark writing' },
      { status: 500 },
    )
  }
}
