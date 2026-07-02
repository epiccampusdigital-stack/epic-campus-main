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

export async function POST() {
  try {
    const existing = await adminDb.collection('examPapers')
      .where('title', '==', 'JFT-Basic Sample Paper 1').get()
    if (!existing.empty) {
      return NextResponse.json({ message: 'Already seeded', paperId: existing.docs[0].id })
    }

    const paperRef = await adminDb.collection('examPapers').add({
      title: 'JFT-Basic Sample Paper 1',
      description: 'Official-style JFT-Basic practice test — Script, Vocabulary, Conversation, Listening, Reading',
      categoryId: 'jft-basic',
      totalQuestions: 10,
      timeLimitSeconds: 3600,
      passMark: 80,
      scoringScale: 250,
      hasAudioCheck: false,
      isPublished: true,
      order: 1,
      createdAt: new Date().toISOString(),
    })

    const sections = [
      { name: 'Script and Vocabulary', order: 1 },
      { name: 'Conversation and Expression', order: 2 },
      { name: 'Reading Comprehension', order: 3 },
    ]
    const sectionIds: string[] = []
    for (const sec of sections) {
      const ref = await adminDb.collection('examSections').add({ paperId: paperRef.id, ...sec })
      sectionIds.push(ref.id)
    }

    const questions = [
      { sectionId: sectionIds[0], order: 1, questionText: 'Choose the correct reading for 水 (water).', questionTextJP: '「水」の正しい読み方を選んでください。', languageMode: 'both', options: [{ index: 1, text: 'ひ (hi)' }, { index: 2, text: 'みず (mizu)' }, { index: 3, text: 'き (ki)' }], correctIndex: 2 },
      { sectionId: sectionIds[0], order: 2, questionText: 'Choose the correct reading for 学校 (school).', questionTextJP: '「学校」の正しい読み方を選んでください。', languageMode: 'both', options: [{ index: 1, text: 'がっこう (gakkou)' }, { index: 2, text: 'かいしゃ (kaisha)' }, { index: 3, text: 'びょういん (byouin)' }], correctIndex: 1 },
      { sectionId: sectionIds[0], order: 3, questionText: 'Which word means "morning"?', questionTextJP: '「朝」はどの言葉ですか？', languageMode: 'both', options: [{ index: 1, text: 'よる (yoru)' }, { index: 2, text: 'ひる (hiru)' }, { index: 3, text: 'あさ (asa)' }], correctIndex: 3 },
      { sectionId: sectionIds[1], order: 4, questionText: 'Your supervisor gives you a task. What do you say?', questionTextJP: '上司から仕事を頼まれました。何と言いますか？', languageMode: 'both', options: [{ index: 1, text: 'おつかれさまです' }, { index: 2, text: 'かしこまりました' }, { index: 3, text: 'さようなら' }], correctIndex: 2 },
      { sectionId: sectionIds[1], order: 5, questionText: 'How do you greet someone in the morning?', questionTextJP: '朝の挨拶は何ですか？', languageMode: 'both', options: [{ index: 1, text: 'こんにちは' }, { index: 2, text: 'こんばんは' }, { index: 3, text: 'おはようございます' }], correctIndex: 3 },
      { sectionId: sectionIds[1], order: 6, questionText: 'How do you say "thank you" in Japanese?', questionTextJP: '「ありがとうございます」はどういう意味ですか？', languageMode: 'both', options: [{ index: 1, text: 'I understand' }, { index: 2, text: 'Thank you' }, { index: 3, text: 'Excuse me' }], correctIndex: 2 },
      { sectionId: sectionIds[2], order: 7, questionText: 'Read the sign: 入口 — What does it mean?', questionTextJP: '「入口」はどういう意味ですか？', languageMode: 'both', options: [{ index: 1, text: 'Exit' }, { index: 2, text: 'Toilet' }, { index: 3, text: 'Entrance' }], correctIndex: 3 },
      { sectionId: sectionIds[2], order: 8, questionText: 'Read the sign: 禁煙 — What does it mean?', questionTextJP: '「禁煙」はどういう意味ですか？', languageMode: 'both', options: [{ index: 1, text: 'No Smoking' }, { index: 2, text: 'No Entry' }, { index: 3, text: 'No Parking' }], correctIndex: 1 },
      { sectionId: sectionIds[2], order: 9, questionText: 'The notice says 休業日 — What does this mean?', questionTextJP: '「休業日」はどういう意味ですか？', languageMode: 'both', options: [{ index: 1, text: 'Opening Day' }, { index: 2, text: 'Holiday / Closed' }, { index: 3, text: 'Business Hours' }], correctIndex: 2 },
      { sectionId: sectionIds[2], order: 10, questionText: 'Read: 出口 — What does it mean?', questionTextJP: '「出口」はどういう意味ですか？', languageMode: 'both', options: [{ index: 1, text: 'Entrance' }, { index: 2, text: 'Exit' }, { index: 3, text: 'Stairs' }], correctIndex: 2 },
    ]

    for (const q of questions) {
      await adminDb.collection('examQuestions').add({
        paperId: paperRef.id,
        ...q,
        audioPlayLimit: 0,
        createdAt: new Date().toISOString(),
      })
    }

    return NextResponse.json({ success: true, paperId: paperRef.id, message: 'JFT-Basic Sample Paper 1 seeded with 10 questions' })
  } catch (err) {
    console.error('[SeedPapers POST]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
