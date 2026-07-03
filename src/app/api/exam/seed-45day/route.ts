export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'

const EXAM_SCHEDULE = [
  { day: 7, title: 'Day 7 Check-in Exam', description: 'Week 1 progress check — basic Japanese greetings and hiragana' },
  { day: 14, title: 'Day 14 Check-in Exam', description: 'Week 2 progress check — vocabulary and simple phrases' },
  { day: 21, title: 'Day 21 Check-in Exam', description: 'Week 3 progress check — workplace Japanese basics' },
  { day: 28, title: 'Day 28 Check-in Exam', description: 'Week 4 progress check — conversation and listening' },
  { day: 35, title: 'Day 35 Check-in Exam', description: 'Week 5 progress check — reading signs and notices' },
  { day: 42, title: 'Day 42 Check-in Exam', description: 'Week 6 progress check — advanced workplace scenarios' },
  { day: 45, title: 'Day 45 Final Exam', description: 'Course completion exam — full JFT-Basic preparation test' },
]

const PLACEHOLDER_QUESTIONS = [
  { questionText: 'What is the Japanese word for "good morning"?', questionTextJP: '「おはようございます」はどういう意味ですか？', options: [{ index: 1, text: 'Good afternoon' }, { index: 2, text: 'Good morning' }, { index: 3, text: 'Good night' }], correctIndex: 2 },
  { questionText: 'Choose the correct hiragana for "A" sound.', questionTextJP: '「あ」を選んでください。', options: [{ index: 1, text: 'い' }, { index: 2, text: 'う' }, { index: 3, text: 'あ' }], correctIndex: 3 },
  { questionText: 'What does 「はたらく」(hataraku) mean?', questionTextJP: '「はたらく」はどういう意味ですか？', options: [{ index: 1, text: 'To eat' }, { index: 2, text: 'To work' }, { index: 3, text: 'To sleep' }], correctIndex: 2 },
  { questionText: 'How do you say "thank you" in Japanese?', questionTextJP: '「ありがとうございます」を選んでください。', options: [{ index: 1, text: 'すみません' }, { index: 2, text: 'ありがとうございます' }, { index: 3, text: 'おねがいします' }], correctIndex: 2 },
  { questionText: 'What is 「やすみ」(yasumi)?', questionTextJP: '「やすみ」はどういう意味ですか？', options: [{ index: 1, text: 'Work' }, { index: 2, text: 'Rest/Holiday' }, { index: 3, text: 'Lunch' }], correctIndex: 2 },
]

export async function POST() {
  try {
    const results = []
    for (let i = 0; i < EXAM_SCHEDULE.length; i++) {
      const exam = EXAM_SCHEDULE[i]
      const existing = await adminDb.collection('examPapers')
        .where('courseTag', '==', 'japan-ssw-45day')
        .where('unlockDay', '==', exam.day)
        .get()
      if (!existing.empty) {
        results.push({ day: exam.day, status: 'already exists', paperId: existing.docs[0].id })
        continue
      }
      const paperRef = await adminDb.collection('examPapers').add({
        title: exam.title,
        description: exam.description,
        categoryId: 'japan-ssw-45day',
        courseTag: 'japan-ssw-45day',
        unlockDay: exam.day,
        isFinalExam: exam.day === 45,
        totalQuestions: 5,
        timeLimitSeconds: 1800,
        passMark: 60,
        maxAttempts: 1,
        isPublished: true,
        order: i + 1,
        createdAt: new Date().toISOString(),
      })
      const sectionRef = await adminDb.collection('examSections').add({
        paperId: paperRef.id,
        name: exam.title,
        order: 1,
        sectionType: 'general',
      })
      for (let q = 0; q < PLACEHOLDER_QUESTIONS.length; q++) {
        await adminDb.collection('examQuestions').add({
          paperId: paperRef.id,
          sectionId: sectionRef.id,
          order: q + 1,
          ...PLACEHOLDER_QUESTIONS[q],
          audioPlayLimit: 0,
          createdAt: new Date().toISOString(),
        })
      }
      results.push({ day: exam.day, status: 'created', paperId: paperRef.id })
    }
    return NextResponse.json({ success: true, results })
  } catch (err) {
    console.error('[Seed45Day]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
