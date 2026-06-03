import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { fetchExamPapers } from '@/lib/exam/helpers'
import { parseExamAttempt } from '@/lib/student/portal'

export interface CertificateEligibility {
  eligible: boolean
  totalPapers: number
  passedPapers: number
  message: string
}

function isPassingResult(
  data: Record<string, unknown>,
  parsed: ReturnType<typeof parseExamAttempt>,
): boolean {
  if (data.status === 'pass' || parsed.status === 'pass') return true
  const total =
    parsed.total ||
    (data.score != null ? Number(data.score) : 0) ||
    (data.total != null ? Number(data.total) : 0)
  return total >= 60
}

export async function checkCertificateEligibility(
  studentId: string,
): Promise<CertificateEligibility> {
  const [papers, resultsSnap] = await Promise.all([
    fetchExamPapers(),
    getDocs(query(collection(db, 'examResults'), where('studentId', '==', studentId))),
  ])

  const activePapers = papers.filter((p) => p.status === 'active')
  const totalPapers = activePapers.length

  if (totalPapers === 0) {
    return {
      eligible: false,
      totalPapers: 0,
      passedPapers: 0,
      message: 'Your certificate will be available after you complete all course exams.',
    }
  }

  const passedByPaper = new Set<string>()
  for (const d of resultsSnap.docs) {
    const data = d.data() as Record<string, unknown>
    const examId = String(data.examId ?? data.paperId ?? '')
    if (!examId) continue
    const parsed = parseExamAttempt(d.id, data)
    if (isPassingResult(data, parsed)) {
      passedByPaper.add(examId)
    }
  }

  const passedPapers = activePapers.filter((p) => passedByPaper.has(p.id)).length
  const eligible = passedPapers >= totalPapers

  return {
    eligible,
    totalPapers,
    passedPapers,
    message: eligible
      ? 'You have passed all course exams. Download your completion certificate below.'
      : 'Your certificate will be available after you complete all course exams.',
  }
}
