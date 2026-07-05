import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { sendExamReminder } from '@/lib/twilio/helpers'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { paperId } = await req.json() as { paperId: string }

    const paperSnap = await adminDb.collection('examPapers').doc(paperId).get()
    if (!paperSnap.exists) return NextResponse.json({ error: 'Paper not found' }, { status: 404 })
    const paper = paperSnap.data()!

    if (!paper.examDate || !paper.examTime || !paper.isLive) {
      return NextResponse.json({ error: 'Not a live exam with date/time' }, { status: 400 })
    }

    const studentsSnap = await adminDb.collection('students')
      .where('courseId', '==', paper.examCourseId ?? '')
      .get()

    let sent = 0
    for (const studentDoc of studentsSnap.docs) {
      const student = studentDoc.data()
      const phone = student.phone ?? student.mobile
      if (phone) {
        await sendExamReminder(
          String(phone),
          String(student.name ?? 'Student'),
          String(paper.title),
          String(paper.examDate),
          String(paper.examTime)
        ).catch(() => {})
        sent++
      }
    }

    return NextResponse.json({ success: true, sent, total: studentsSnap.size })
  } catch (err) {
    console.error('[ExamReminder]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
