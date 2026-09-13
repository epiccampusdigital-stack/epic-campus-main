import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { verifySignedIn } from '@/lib/jp/serverAuth'
import type { JpCourse, JpLesson, JpModule } from '@/types'

export const dynamic = 'force-dynamic'

const JP_COURSE_ID = 'jft-foundation'
const MODEL = 'claude-haiku-4-5-20251001'

const FALLBACK_REPLY =
  "I'm not able to answer right now — please press \"Talk to a human\" and a staff member will help you shortly."

async function buildCourseContext(): Promise<string> {
  const courseRef = adminDb.collection('jpCourses').doc(JP_COURSE_ID)
  const [courseSnap, modulesSnap] = await Promise.all([
    courseRef.get(),
    courseRef.collection('modules').orderBy('order').get(),
  ])
  const course = courseSnap.exists ? (courseSnap.data() as Omit<JpCourse, 'id'>) : null

  const lines: string[] = []
  lines.push(`Course: ${course?.title ?? 'JFT Foundation'} (${course?.level ?? 'JFT-Basic / N5'})`)

  for (const moduleDoc of modulesSnap.docs) {
    const moduleData = moduleDoc.data() as Omit<JpModule, 'id'>
    lines.push(`Module ${moduleData.order}: ${moduleData.title}`)
    const lessonsSnap = await courseRef.collection('modules').doc(moduleDoc.id).collection('lessons').orderBy('order').get()
    for (const lessonDoc of lessonsSnap.docs) {
      const lesson = lessonDoc.data() as Omit<JpLesson, 'id'>
      const desc = lesson.description ? ` — ${lesson.description}` : ''
      lines.push(`  Lesson ${lesson.order} (${lesson.type}): ${lesson.title}${desc}`)
    }
  }

  return lines.join('\n')
}

function buildSystemPrompt(courseContext: string): string {
  return `You are the support assistant for EPIC Campus's JFT Foundation online Japanese course.

COURSE CONTENT — this is your only source of truth about this course. Do not invent lessons, dates, prices, or policies beyond what's listed here plus your own general knowledge of the Japanese language:
${courseContext}

Rules:
- Answer questions about the Japanese language (grammar, vocabulary, JLPT/JFT concepts) using your general knowledge.
- Answer questions about this course's structure and content using ONLY the course content listed above.
- Reply in the same language the student wrote in.
- If you don't know the answer, say so plainly rather than guessing.
- Never answer questions about payments, refunds, billing, dates/deadlines, or anything specific to the student's own account or enrollment status — for those, say clearly that a staff member needs to help and that the student can press "Talk to a human" to reach one. Do not guess at account-specific details.`
}

interface AnthropicMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function POST(req: NextRequest) {
  const uid = await verifySignedIn(req)
  if (!uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { threadId, question } = await req.json()
    if (!threadId || !question) {
      return NextResponse.json({ error: 'threadId and question are required' }, { status: 400 })
    }

    const threadRef = adminDb.collection('jpSupportThreads').doc(threadId)
    const threadSnap = await threadRef.get()
    if (!threadSnap.exists) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
    }
    const thread = threadSnap.data() as { uid?: string }
    if (thread.uid !== uid) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const now = new Date().toISOString()
    const apiKey = process.env.ANTHROPIC_API_KEY

    const saveReply = async (body: string) => {
      const messageRef = threadRef.collection('messages').doc()
      await messageRef.set({
        threadId,
        author: 'ai',
        authorUid: null,
        body,
        createdAt: now,
      })
      await threadRef.set({ status: 'ai_answered', lastMessageAt: now }, { merge: true })
      return body
    }

    if (!apiKey || apiKey === 'your_anthropic_api_key_here' || apiKey.trim() === '') {
      const reply = await saveReply(FALLBACK_REPLY)
      return NextResponse.json({ reply })
    }

    // Prior messages give the model conversational context beyond just this
    // one question — student/staff turns map to 'user', prior AI replies to
    // 'assistant'.
    const priorSnap = await threadRef.collection('messages').orderBy('createdAt', 'asc').get()
    const history: AnthropicMessage[] = priorSnap.docs.map((d) => {
      const data = d.data()
      return {
        role: data.author === 'ai' ? 'assistant' : 'user',
        content: String(data.body ?? ''),
      }
    })
    history.push({ role: 'user', content: String(question) })

    const courseContext = await buildCourseContext()
    const systemPrompt = buildSystemPrompt(courseContext)

    let anthropicRes: Response
    try {
      anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 1024,
          system: systemPrompt,
          messages: history,
        }),
      })
    } catch (fetchErr) {
      console.error('[api/jp/support/ask] fetch failed', fetchErr)
      const reply = await saveReply(FALLBACK_REPLY)
      return NextResponse.json({ reply })
    }

    const data = (await anthropicRes.json()) as {
      content?: { type: string; text: string }[]
      error?: { message?: string }
    }

    if (!anthropicRes.ok) {
      console.error('[api/jp/support/ask] Anthropic error', anthropicRes.status, data)
      const reply = await saveReply(FALLBACK_REPLY)
      return NextResponse.json({ reply })
    }

    const replyText = data.content?.[0]?.text?.trim() || FALLBACK_REPLY
    const reply = await saveReply(replyText)
    return NextResponse.json({ reply })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to get a reply'
    console.error('[api/jp/support/ask]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
