export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import {
  EXAM_PAPERS,
  SAMPLE_LISTENING_QUESTIONS,
  SAMPLE_READING_QUESTIONS,
  SAMPLE_SPEAKING_PROMPTS,
  SAMPLE_WRITING_TASKS,
  withIds,
} from '@/lib/exam/questions'

export async function GET() {
  try {
    const snap = await adminDb.collection('examPapers').get()
    if (!snap.empty) {
      return NextResponse.json({ seeded: false, message: 'Papers already exist' })
    }

    const batch = adminDb.batch()
    for (const paper of EXAM_PAPERS) {
      const ref = adminDb.collection('examPapers').doc(paper.id)
      batch.set(ref, {
        id: paper.id,
        code: paper.code,
        title: paper.title,
        level: paper.level,
        description: paper.description,
        status: paper.status,
        readingCount: paper.readingCount,
        listeningCount: paper.listeningCount,
        readingMinutes: paper.readingMinutes,
        listeningMinutes: paper.listeningMinutes,
        writingMinutes: paper.writingMinutes,
        speakingMinutes: paper.speakingMinutes,
        language: 'bilingual',
        courseIds: ['japan-ssw'],
      })
    }
    await batch.commit()

    const j001Batch = adminDb.batch()
    withIds(SAMPLE_READING_QUESTIONS, 'reading').forEach((q) => {
      j001Batch.set(
        adminDb.collection('examPapers').doc('j-001').collection('readingQuestions').doc(q.id),
        q,
      )
    })
    withIds(SAMPLE_LISTENING_QUESTIONS, 'listening').forEach((q) => {
      j001Batch.set(
        adminDb.collection('examPapers').doc('j-001').collection('listeningQuestions').doc(q.id),
        q,
      )
    })
    withIds(SAMPLE_WRITING_TASKS, 'writing').forEach((q) => {
      j001Batch.set(
        adminDb.collection('examPapers').doc('j-001').collection('writingTasks').doc(q.id),
        q,
      )
    })
    withIds(SAMPLE_SPEAKING_PROMPTS, 'speaking').forEach((q) => {
      j001Batch.set(
        adminDb.collection('examPapers').doc('j-001').collection('speakingPrompts').doc(q.id),
        q,
      )
    })
    await j001Batch.commit()

    return NextResponse.json({
      seeded: true,
      count: EXAM_PAPERS.length,
      message: `Seeded ${EXAM_PAPERS.length} exam papers with J-001 sample questions`,
    })
  } catch (err) {
    console.error('seed-papers error:', err)
    return NextResponse.json({ error: 'Failed to seed papers' }, { status: 500 })
  }
}
