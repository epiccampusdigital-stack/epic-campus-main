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
      const batch = adminDb.batch()
      let patched = 0
      snap.docs.forEach((docSnap, index) => {
        const data = docSnap.data()
        if (data.isPublished === false) return
        if (data.isPublished === true && data.order != null) return
        batch.set(
          docSnap.ref,
          {
            isPublished: true,
            order: data.order ?? index + 1,
            status: data.status ?? 'active',
          },
          { merge: true },
        )
        patched += 1
      })
      if (patched > 0) await batch.commit()
      return NextResponse.json({
        seeded: false,
        patched,
        message:
          patched > 0
            ? `Papers already exist — published ${patched} paper(s)`
            : 'Papers already exist',
      })
    }

    const batch = adminDb.batch()
    EXAM_PAPERS.forEach((paper, index) => {
      const ref = adminDb.collection('examPapers').doc(paper.id)
      batch.set(ref, {
        id: paper.id,
        code: paper.code,
        title: paper.title,
        level: paper.level,
        description: paper.description,
        status: paper.status,
        isPublished: true,
        order: index + 1,
        readingCount: paper.readingCount,
        listeningCount: paper.listeningCount,
        readingMinutes: paper.readingMinutes,
        listeningMinutes: paper.listeningMinutes,
        writingMinutes: paper.writingMinutes,
        speakingMinutes: paper.speakingMinutes,
        language: 'bilingual',
        courseIds: ['japan-ssw'],
      })
    })
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

    const j002Batch = adminDb.batch()
    withIds(SAMPLE_READING_QUESTIONS, 'reading').forEach((q) => {
      j002Batch.set(
        adminDb.collection('examPapers').doc('j-002').collection('readingQuestions').doc(q.id),
        q,
      )
    })
    withIds(SAMPLE_LISTENING_QUESTIONS, 'listening').forEach((q) => {
      j002Batch.set(
        adminDb.collection('examPapers').doc('j-002').collection('listeningQuestions').doc(q.id),
        q,
      )
    })
    withIds(SAMPLE_WRITING_TASKS, 'writing').forEach((q) => {
      j002Batch.set(
        adminDb.collection('examPapers').doc('j-002').collection('writingTasks').doc(q.id),
        q,
      )
    })
    withIds(SAMPLE_SPEAKING_PROMPTS, 'speaking').forEach((q) => {
      j002Batch.set(
        adminDb.collection('examPapers').doc('j-002').collection('speakingPrompts').doc(q.id),
        q,
      )
    })
    await j002Batch.commit()

    const j003Batch = adminDb.batch()
    withIds(SAMPLE_READING_QUESTIONS, 'reading').forEach((q) => {
      j003Batch.set(
        adminDb.collection('examPapers').doc('j-003').collection('readingQuestions').doc(q.id),
        q,
      )
    })
    withIds(SAMPLE_LISTENING_QUESTIONS, 'listening').forEach((q) => {
      j003Batch.set(
        adminDb.collection('examPapers').doc('j-003').collection('listeningQuestions').doc(q.id),
        q,
      )
    })
    withIds(SAMPLE_WRITING_TASKS, 'writing').forEach((q) => {
      j003Batch.set(
        adminDb.collection('examPapers').doc('j-003').collection('writingTasks').doc(q.id),
        q,
      )
    })
    withIds(SAMPLE_SPEAKING_PROMPTS, 'speaking').forEach((q) => {
      j003Batch.set(
        adminDb.collection('examPapers').doc('j-003').collection('speakingPrompts').doc(q.id),
        q,
      )
    })
    await j003Batch.commit()

    const j004Batch = adminDb.batch()
    withIds(SAMPLE_READING_QUESTIONS, 'reading').forEach((q) => {
      j004Batch.set(
        adminDb.collection('examPapers').doc('j-004').collection('readingQuestions').doc(q.id),
        q,
      )
    })
    withIds(SAMPLE_LISTENING_QUESTIONS, 'listening').forEach((q) => {
      j004Batch.set(
        adminDb.collection('examPapers').doc('j-004').collection('listeningQuestions').doc(q.id),
        q,
      )
    })
    withIds(SAMPLE_WRITING_TASKS, 'writing').forEach((q) => {
      j004Batch.set(
        adminDb.collection('examPapers').doc('j-004').collection('writingTasks').doc(q.id),
        q,
      )
    })
    withIds(SAMPLE_SPEAKING_PROMPTS, 'speaking').forEach((q) => {
      j004Batch.set(
        adminDb.collection('examPapers').doc('j-004').collection('speakingPrompts').doc(q.id),
        q,
      )
    })
    await j004Batch.commit()

    const j005Batch = adminDb.batch()
    withIds(SAMPLE_READING_QUESTIONS, 'reading').forEach((q) => {
      j005Batch.set(
        adminDb.collection('examPapers').doc('j-005').collection('readingQuestions').doc(q.id),
        q,
      )
    })
    withIds(SAMPLE_LISTENING_QUESTIONS, 'listening').forEach((q) => {
      j005Batch.set(
        adminDb.collection('examPapers').doc('j-005').collection('listeningQuestions').doc(q.id),
        q,
      )
    })
    withIds(SAMPLE_WRITING_TASKS, 'writing').forEach((q) => {
      j005Batch.set(
        adminDb.collection('examPapers').doc('j-005').collection('writingTasks').doc(q.id),
        q,
      )
    })
    withIds(SAMPLE_SPEAKING_PROMPTS, 'speaking').forEach((q) => {
      j005Batch.set(
        adminDb.collection('examPapers').doc('j-005').collection('speakingPrompts').doc(q.id),
        q,
      )
    })
    await j005Batch.commit()

    const j006Batch = adminDb.batch()
    withIds(SAMPLE_READING_QUESTIONS, 'reading').forEach((q) => {
      j006Batch.set(
        adminDb.collection('examPapers').doc('j-006').collection('readingQuestions').doc(q.id),
        q,
      )
    })
    withIds(SAMPLE_LISTENING_QUESTIONS, 'listening').forEach((q) => {
      j006Batch.set(
        adminDb.collection('examPapers').doc('j-006').collection('listeningQuestions').doc(q.id),
        q,
      )
    })
    withIds(SAMPLE_WRITING_TASKS, 'writing').forEach((q) => {
      j006Batch.set(
        adminDb.collection('examPapers').doc('j-006').collection('writingTasks').doc(q.id),
        q,
      )
    })
    withIds(SAMPLE_SPEAKING_PROMPTS, 'speaking').forEach((q) => {
      j006Batch.set(
        adminDb.collection('examPapers').doc('j-006').collection('speakingPrompts').doc(q.id),
        q,
      )
    })
    await j006Batch.commit()

    return NextResponse.json({
      seeded: true,
      count: EXAM_PAPERS.length,
      message: `Seeded ${EXAM_PAPERS.length} exam papers with questions for all papers`,
    })
  } catch (err) {
    console.error('seed-papers error:', err)
    return NextResponse.json({ error: 'Failed to seed papers' }, { status: 500 })
  }
}
