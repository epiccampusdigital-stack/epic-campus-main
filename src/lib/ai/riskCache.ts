import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import {
  buildRiskProfileForStudent,
  parseRiskProfile,
  type StudentRiskProfile,
} from '@/lib/ai/studentRisk'
import { parseAttendance } from '@/lib/attendance/helpers'
import { parseAttempt } from '@/lib/exam/helpers'
import { parseStudent } from '@/lib/students/helpers'
import type { ExamResult, Student } from '@/types'

function parseExamResult(id: string, data: Record<string, unknown>): ExamResult {
  return {
    id,
    examId: String(data.examId ?? ''),
    studentId: String(data.studentId ?? ''),
    score: data.score != null ? Number(data.score) : undefined,
    band: data.band ? String(data.band) : undefined,
    level: data.level ? String(data.level) : undefined,
    status: (data.status as ExamResult['status']) ?? 'pending',
    notes: data.notes ? String(data.notes) : undefined,
    createdAt: String(data.createdAt ?? new Date().toISOString()),
    createdBy: String(data.createdBy ?? ''),
  }
}

export async function fetchRiskCache(): Promise<StudentRiskProfile[]> {
  const snap = await getDocs(collection(db, 'riskCache'))
  return snap.docs.map((d) => parseRiskProfile(d.id, d.data() as Record<string, unknown>))
}

export async function saveRiskCache(profiles: StudentRiskProfile[]): Promise<void> {
  const existing = await getDocs(collection(db, 'riskCache'))
  await Promise.all(existing.docs.map((d) => deleteDoc(d.ref)))

  await Promise.all(
    profiles.map((profile) =>
      setDoc(doc(db, 'riskCache', profile.studentId), { ...profile }),
    ),
  )
}

export async function runRiskAnalysis(
  onAiRecommendations?: (
    profiles: StudentRiskProfile[],
  ) => Promise<Map<string, string>>,
): Promise<StudentRiskProfile[]> {
  const [studentsSnap, attendanceSnap, resultsSnap, attemptsSnap, studySnap] =
    await Promise.all([
      getDocs(collection(db, 'students')),
      getDocs(collection(db, 'attendance')),
      getDocs(collection(db, 'examResults')).catch(() => ({ docs: [] as { id: string; data: () => Record<string, unknown> }[] })),
      getDocs(collection(db, 'examAttempts')).catch(() => ({ docs: [] as { id: string; data: () => Record<string, unknown> }[] })),
      getDocs(collection(db, 'studySessions')).catch(() => ({ docs: [] as { id: string; data: () => Record<string, unknown> }[] })),
    ])

  const students: Student[] = studentsSnap.docs
    .map((d) => parseStudent(d.id, d.data() as Record<string, unknown>))
    .filter((s) => s.status === 'active' || s.status === 'pending')

  const attendance = attendanceSnap.docs.map((d) =>
    parseAttendance(d.id, d.data() as Record<string, unknown>),
  )

  const examResults = resultsSnap.docs.map((d) =>
    parseExamResult(d.id, d.data() as Record<string, unknown>),
  )

  const examAttempts = attemptsSnap.docs.map((d) =>
    parseAttempt(d.id, d.data() as Record<string, unknown>),
  )

  const studySessionDates = new Map<string, string>()
  for (const d of studySnap.docs) {
    const data = d.data()
    const studentId = String(data.studentId ?? '')
    if (!studentId) continue
    const endedAt = String(data.endedAt ?? data.startedAt ?? data.createdAt ?? '')
    const prev = studySessionDates.get(studentId)
    if (!prev || endedAt > prev) studySessionDates.set(studentId, endedAt)
  }

  let profiles = students.map((student) =>
    buildRiskProfileForStudent(
      student,
      attendance,
      examResults,
      examAttempts,
      studySessionDates,
    ),
  )

  const atRisk = profiles.filter(
    (p) => p.riskLevel === 'high' || p.riskLevel === 'medium',
  )

  if (onAiRecommendations && atRisk.length > 0) {
    const aiMap = await onAiRecommendations(atRisk)
    profiles = profiles.map((p) => {
      const aiRec = aiMap.get(p.studentId)
      return aiRec ? { ...p, recommendation: aiRec } : p
    })
  }

  await saveRiskCache(profiles)
  return profiles
}

export function riskCacheLastUpdated(profiles: StudentRiskProfile[]): string | null {
  if (profiles.length === 0) return null
  return profiles.reduce((latest, p) =>
    p.lastCalculated > latest ? p.lastCalculated : latest,
  profiles[0].lastCalculated)
}
