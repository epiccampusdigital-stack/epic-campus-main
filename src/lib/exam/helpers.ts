import { Timestamp } from 'firebase/firestore'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
  deleteDoc,
  query,
  where,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import {
  EXAM_PAPERS,
  SAMPLE_LISTENING_QUESTIONS,
  SAMPLE_READING_QUESTIONS,
  SAMPLE_SPEAKING_PROMPTS,
  SAMPLE_WRITING_TASKS,
  getPaperById,
  withIds,
} from '@/lib/exam/questions'
import type {
  ExamAttempt,
  ExamPaper,
  ExamPaperLanguage,
  ExamPaperLevel,
  ExamPaperStatus,
  ExamSection,
  ListeningQuestion,
  ReadingQuestion,
  SpeakingPrompt,
  SpeakingSubmission,
  WritingSubmission,
  WritingTask,
} from '@/types'

export function calculateScore(
  answers: Record<string, string>,
  questionKey: Record<string, string>,
): number {
  const total = Object.keys(questionKey).length
  if (total === 0) return 0
  const correct = Object.entries(questionKey).filter(
    ([id, ans]) => answers[id]?.toUpperCase() === ans.toUpperCase(),
  ).length
  return Math.round((correct / total) * 100)
}

export function getGrade(score: number): 'S' | 'A' | 'B' | 'C' | 'D' {
  if (score >= 90) return 'S'
  if (score >= 80) return 'A'
  if (score >= 70) return 'B'
  if (score >= 60) return 'C'
  return 'D'
}

export function getGradeColor(grade: string): string {
  const colors: Record<string, string> = {
    S: 'bg-purple-100 text-purple-700 border-purple-300',
    A: 'bg-green-100 text-green-700 border-green-300',
    B: 'bg-blue-100 text-blue-700 border-blue-300',
    C: 'bg-amber-100 text-amber-700 border-amber-300',
    D: 'bg-red-100 text-red-700 border-red-300',
  }
  return colors[grade] ?? colors.D
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0
}

export function toDate(value: unknown): Date | null {
  if (!value) return null
  if (value instanceof Timestamp) return value.toDate()
  if (typeof value === 'string') return new Date(value)
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    return new Date((value as { seconds: number }).seconds * 1000)
  }
  return null
}

export function parseAttempt(id: string, data: Record<string, unknown>): ExamAttempt {
  const started = toDate(data.startedAt)
  const ended = toDate(data.endedAt)
  const created = toDate(data.createdAt)

  return {
    id,
    studentId: String(data.studentId ?? ''),
    studentName: String(data.studentName ?? ''),
    paperId: String(data.paperId ?? ''),
    paperCode: String(data.paperCode ?? ''),
    startedAt: started?.toISOString() ?? new Date().toISOString(),
    endedAt: ended?.toISOString(),
    status: (data.status as ExamAttempt['status']) ?? 'in_progress',
    readingScore: data.readingScore != null ? Number(data.readingScore) : undefined,
    listeningScore:
      data.listeningScore != null ? Number(data.listeningScore) : undefined,
    writingScore: data.writingScore != null ? Number(data.writingScore) : undefined,
    speakingScore:
      data.speakingScore === null
        ? null
        : data.speakingScore != null
          ? Number(data.speakingScore)
          : undefined,
    totalScore: data.totalScore != null ? Number(data.totalScore) : undefined,
    grade: data.grade ? String(data.grade) : undefined,
    markingStatus: (data.markingStatus as ExamAttempt['markingStatus']) ?? 'pending',
    createdAt: created?.toISOString() ?? new Date().toISOString(),
  }
}

export function computeTotalScore(scores: {
  readingScore: number
  listeningScore: number
  writingScore: number
  speakingScore: number | null
}): number {
  const speaking = scores.speakingScore ?? 0
  return Math.round(
    scores.readingScore * 0.25 +
      scores.listeningScore * 0.25 +
      scores.writingScore * 0.25 +
      speaking * 0.25,
  )
}

export async function fetchExamPapers(): Promise<ExamPaper[]> {
  try {
    const snap = await getDocs(collection(db, 'examPapers'))
    if (snap.empty) return EXAM_PAPERS
    return snap.docs.map((d) => {
      const data = d.data()
      const fallback = getPaperById(d.id)
      return {
        id: d.id,
        code: String(data.code ?? fallback?.code ?? d.id),
        title: String(data.title ?? fallback?.title ?? ''),
        level: (data.level as ExamPaper['level']) ?? fallback?.level ?? 'A1',
        description: String(data.description ?? fallback?.description ?? ''),
        status: (data.status as ExamPaper['status']) ?? 'active',
        readingCount: Number(data.readingCount ?? fallback?.readingCount ?? 5),
        listeningCount: Number(data.listeningCount ?? fallback?.listeningCount ?? 5),
        readingMinutes: Number(data.readingMinutes ?? fallback?.readingMinutes ?? 60),
        listeningMinutes: Number(data.listeningMinutes ?? fallback?.listeningMinutes ?? 30),
        writingMinutes: Number(data.writingMinutes ?? fallback?.writingMinutes ?? 45),
        speakingMinutes: Number(data.speakingMinutes ?? fallback?.speakingMinutes ?? 15),
        language: data.language as ExamPaper['language'] | undefined,
        courseIds: Array.isArray(data.courseIds)
          ? (data.courseIds as string[])
          : fallback?.courseIds,
      }
    })
  } catch {
    return EXAM_PAPERS
  }
}

async function fetchSubcollection<T>(
  paperId: string,
  sub: string,
  fallback: T[],
): Promise<T[]> {
  try {
    const snap = await getDocs(collection(db, 'examPapers', paperId, sub))
    if (snap.empty) return fallback
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T)
  } catch {
    return fallback
  }
}

export async function fetchReadingQuestions(
  paperId: string,
): Promise<ReadingQuestion[]> {
  const fallback = paperId === 'j-001' ? withIds(SAMPLE_READING_QUESTIONS, 'reading') : []
  const items = await fetchSubcollection<ReadingQuestion>(
    paperId,
    'readingQuestions',
    fallback,
  )
  return items.sort((a, b) => a.questionNumber - b.questionNumber)
}

export async function fetchListeningQuestions(
  paperId: string,
): Promise<ListeningQuestion[]> {
  const fallback = paperId === 'j-001' ? withIds(SAMPLE_LISTENING_QUESTIONS, 'listening') : []
  const items = await fetchSubcollection<ListeningQuestion>(
    paperId,
    'listeningQuestions',
    fallback,
  )
  return items
    .map((q) => ({
      ...q,
      audioUrl: q.audioUrl ? String(q.audioUrl) : null,
    }))
    .sort((a, b) => a.questionNumber - b.questionNumber)
}

export async function fetchWritingTasks(paperId: string): Promise<WritingTask[]> {
  const fallback = paperId === 'j-001' ? withIds(SAMPLE_WRITING_TASKS, 'writing') : []
  const items = await fetchSubcollection<WritingTask>(paperId, 'writingTasks', fallback)
  return items.sort((a, b) => a.taskNumber - b.taskNumber)
}

export async function fetchSpeakingPrompts(
  paperId: string,
): Promise<SpeakingPrompt[]> {
  const fallback = paperId === 'j-001' ? withIds(SAMPLE_SPEAKING_PROMPTS, 'speaking') : []
  const items = await fetchSubcollection<SpeakingPrompt>(
    paperId,
    'speakingPrompts',
    fallback,
  )
  return items.sort((a, b) => a.partNumber - b.partNumber)
}

export async function seedExamPapersIfEmpty(): Promise<void> {
  const snap = await getDocs(collection(db, 'examPapers'))
  if (!snap.empty) return

  const batch = writeBatch(db)
  for (const paper of EXAM_PAPERS) {
    batch.set(doc(db, 'examPapers', paper.id), {
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
    })
  }
  await batch.commit()

  const j001Batch = writeBatch(db)
  withIds(SAMPLE_READING_QUESTIONS, 'reading').forEach((q) => {
    j001Batch.set(doc(db, 'examPapers', 'j-001', 'readingQuestions', q.id), q)
  })
  withIds(SAMPLE_LISTENING_QUESTIONS, 'listening').forEach((q) => {
    j001Batch.set(doc(db, 'examPapers', 'j-001', 'listeningQuestions', q.id), q)
  })
  withIds(SAMPLE_WRITING_TASKS, 'writing').forEach((q) => {
    j001Batch.set(doc(db, 'examPapers', 'j-001', 'writingTasks', q.id), q)
  })
  withIds(SAMPLE_SPEAKING_PROMPTS, 'speaking').forEach((q) => {
    j001Batch.set(doc(db, 'examPapers', 'j-001', 'speakingPrompts', q.id), q)
  })
  await j001Batch.commit()
}

export async function saveAnswer(
  attemptId: string,
  questionId: string,
  studentAnswer: string,
  section: ExamSection,
  correctAnswer?: string,
): Promise<void> {
  const isCorrect = correctAnswer
    ? studentAnswer.toUpperCase() === correctAnswer.toUpperCase()
    : undefined
  await setDoc(doc(db, 'examAttempts', attemptId, 'answers', questionId), {
    questionId,
    studentAnswer,
    isCorrect,
    section,
  })
}

export async function loadAnswers(
  attemptId: string,
  section?: ExamSection,
): Promise<Record<string, string>> {
  const snap = await getDocs(collection(db, 'examAttempts', attemptId, 'answers'))
  const out: Record<string, string> = {}
  snap.docs.forEach((d) => {
    const data = d.data()
    if (section && data.section !== section) return
    out[d.id] = String(data.studentAnswer ?? '')
  })
  return out
}

export async function markSection(
  attemptId: string,
  section: 'reading' | 'listening',
  questionKey: Record<string, string>,
): Promise<number> {
  const answers = await loadAnswers(attemptId, section)
  const score = calculateScore(answers, questionKey)
  const field = section === 'reading' ? 'readingScore' : 'listeningScore'
  await updateDoc(doc(db, 'examAttempts', attemptId), { [field]: score })
  return score
}

export async function getAttempt(attemptId: string): Promise<ExamAttempt | null> {
  const snap = await getDoc(doc(db, 'examAttempts', attemptId))
  if (!snap.exists()) return null
  return parseAttempt(snap.id, snap.data() as Record<string, unknown>)
}

export async function fetchAllAttempts(): Promise<ExamAttempt[]> {
  try {
    const snap = await getDocs(collection(db, 'examAttempts'))
    return snap.docs
      .map((d) => parseAttempt(d.id, d.data() as Record<string, unknown>))
      .sort(
        (a, b) =>
          new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
      )
  } catch {
    return []
  }
}

export async function updateSpeakingScore(
  attemptId: string,
  score: number,
): Promise<void> {
  const attempt = await getAttempt(attemptId)
  if (!attempt) return

  const totalScore = computeTotalScore({
    readingScore: attempt.readingScore ?? 0,
    listeningScore: attempt.listeningScore ?? 0,
    writingScore: attempt.writingScore ?? 0,
    speakingScore: score,
  })

  await updateDoc(doc(db, 'examAttempts', attemptId), {
    speakingScore: score,
    totalScore,
    grade: getGrade(totalScore),
    markingStatus: 'complete',
  })
}

export function getLevelBadgeColor(level: string): string {
  switch (level) {
    case 'A1':
      return 'bg-sky-100 text-sky-800 border-sky-200'
    case 'A2':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200'
    case 'A2-B1':
      return 'bg-amber-100 text-amber-800 border-amber-200'
    case 'B1':
      return 'bg-[#0B3D6B]/10 text-[#0B3D6B] border-[#0B3D6B]/20'
    case 'N5':
      return 'bg-violet-100 text-violet-800 border-violet-200'
    case 'N4':
      return 'bg-indigo-100 text-indigo-800 border-indigo-200'
    default:
      return 'bg-[#F5F7FB] text-[#5A6A7A] border-[#DDE3EC]'
  }
}

export function codeToPaperId(code: string): string {
  return code.trim().toLowerCase()
}

export async function countPaperQuestions(paperId: string): Promise<number> {
  const [r, l, w, s] = await Promise.all([
    getDocs(collection(db, 'examPapers', paperId, 'readingQuestions')),
    getDocs(collection(db, 'examPapers', paperId, 'listeningQuestions')),
    getDocs(collection(db, 'examPapers', paperId, 'writingTasks')),
    getDocs(collection(db, 'examPapers', paperId, 'speakingPrompts')),
  ])
  return r.size + l.size + w.size + s.size
}

export async function saveExamPaper(
  paper: ExamPaper & { description?: string },
): Promise<void> {
  await setDoc(
    doc(db, 'examPapers', paper.id),
    {
      id: paper.id,
      code: paper.code,
      title: paper.title,
      level: paper.level,
      description: paper.description ?? '',
      status: paper.status,
      readingCount: paper.readingCount,
      listeningCount: paper.listeningCount,
      readingMinutes: paper.readingMinutes,
      listeningMinutes: paper.listeningMinutes,
      writingMinutes: paper.writingMinutes,
      speakingMinutes: paper.speakingMinutes,
      language: paper.language ?? 'bilingual',
      courseIds: paper.courseIds ?? ['japan-ssw'],
    },
    { merge: true },
  )
}

export async function deleteExamPaper(paperId: string): Promise<void> {
  const subs = ['readingQuestions', 'listeningQuestions', 'writingTasks', 'speakingPrompts']
  for (const sub of subs) {
    const snap = await getDocs(collection(db, 'examPapers', paperId, sub))
    const batch = writeBatch(db)
    snap.docs.forEach((d) => batch.delete(d.ref))
    if (snap.size > 0) await batch.commit()
  }
  await deleteDoc(doc(db, 'examPapers', paperId))
}

export async function togglePaperStatus(paperId: string): Promise<ExamPaperStatus> {
  const ref = doc(db, 'examPapers', paperId)
  const snap = await getDoc(ref)
  const current = (snap.data()?.status as ExamPaperStatus) ?? 'draft'
  const next: ExamPaperStatus = current === 'active' ? 'draft' : 'active'
  await updateDoc(ref, { status: next })
  return next
}

export interface LeaderboardEntry {
  rank: number
  attemptId: string
  studentId: string
  studentName: string
  totalScore: number
  grade: string
  date: string
  isCurrentStudent: boolean
}

export async function fetchLeaderboard(
  paperId: string,
  limit = 10,
  currentStudentId?: string,
): Promise<LeaderboardEntry[]> {
  const snap = await getDocs(
    query(
      collection(db, 'examAttempts'),
      where('paperId', '==', paperId),
      where('status', '==', 'completed'),
    ),
  )
  const sorted = snap.docs
    .map((d) => parseAttempt(d.id, d.data() as Record<string, unknown>))
    .filter((a) => a.totalScore != null)
    .sort((a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0))
    .slice(0, limit)

  return sorted.map((a, i) => ({
    rank: i + 1,
    attemptId: a.id,
    studentId: a.studentId,
    studentName: a.studentName,
    totalScore: a.totalScore ?? 0,
    grade: a.grade ?? 'D',
    date: a.startedAt,
    isCurrentStudent: currentStudentId != null && a.studentId === currentStudentId,
  }))
}

export async function fetchWritingSubmissions(
  attemptId: string,
): Promise<WritingSubmission[]> {
  const snap = await getDocs(
    collection(db, 'examAttempts', attemptId, 'writingSubmissions'),
  )
  return snap.docs
    .map((d) => ({ ...d.data() }) as WritingSubmission)
    .sort((a, b) => a.taskNumber - b.taskNumber)
}

export async function fetchSpeakingSubmissions(
  attemptId: string,
): Promise<(SpeakingSubmission & { id: string })[]> {
  const snap = await getDocs(
    collection(db, 'examAttempts', attemptId, 'speakingSubmissions'),
  )
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as SpeakingSubmission & { id: string })
    .sort((a, b) => a.partNumber - b.partNumber)
}

export interface ExamImportPayload {
  code: string
  title: string
  level: ExamPaperLevel
  language?: ExamPaperLanguage
  courseIds?: string[]
  description?: string
  timeLimits?: {
    reading?: number
    listening?: number
    writing?: number
    speaking?: number
  }
  readingQuestions?: ImportQuestionGroup[]
  listeningQuestions?: ImportListeningGroup[]
  writingTasks?: Omit<WritingTask, 'id' | 'timeMinutes'>[]
  speakingPrompts?: Omit<SpeakingPrompt, 'id'>[]
}

interface ImportQuestionGroup {
  groupType: string
  groupInstruction?: string
  audioUrl?: string | null
  questions: {
    questionNumber: number
    passageText?: string
    questionText: string
    options?: string[]
    correctAnswer: string
    explanation?: string
    audioUrl?: string | null
  }[]
}

interface ImportListeningGroup extends ImportQuestionGroup {
  audioUrl?: string | null
}

export async function importExamPaper(data: ExamImportPayload): Promise<string> {
  const paperId = codeToPaperId(data.code)
  const readingFlat =
    data.readingQuestions?.flatMap((g) =>
      g.questions.map((q) => ({
        questionNumber: q.questionNumber,
        passageText: q.passageText ?? '',
        questionText: q.questionText,
        options: q.options ?? [],
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
      })),
    ) ?? []
  const listeningFlat =
    data.listeningQuestions?.flatMap((g) =>
      g.questions.map((q) => ({
        questionNumber: q.questionNumber,
        audioUrl:
          (q as { audioUrl?: string | null }).audioUrl ?? g.audioUrl ?? null,
        questionText: q.questionText,
        options: q.options ?? [],
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
      })),
    ) ?? []

  const paper: ExamPaper = {
    id: paperId,
    code: data.code,
    title: data.title,
    level: data.level,
    description: data.description ?? '',
    status: 'draft',
    readingCount: readingFlat.length,
    listeningCount: listeningFlat.length,
    readingMinutes: data.timeLimits?.reading ?? 60,
    listeningMinutes: data.timeLimits?.listening ?? 30,
    writingMinutes: data.timeLimits?.writing ?? 45,
    speakingMinutes: data.timeLimits?.speaking ?? 15,
    language: data.language ?? 'bilingual',
    courseIds: data.courseIds ?? ['japan-ssw'],
  }

  await saveExamPaper(paper)

  const batch = writeBatch(db)
  withIds(readingFlat, 'reading').forEach((q) => {
    batch.set(doc(db, 'examPapers', paperId, 'readingQuestions', q.id), q)
  })
  withIds(listeningFlat, 'listening').forEach((q) => {
    batch.set(doc(db, 'examPapers', paperId, 'listeningQuestions', q.id), q)
  })
  withIds(data.writingTasks ?? [], 'writing').forEach((q) => {
    batch.set(doc(db, 'examPapers', paperId, 'writingTasks', q.id), {
      ...q,
      timeMinutes: data.timeLimits?.writing ?? 45,
    })
  })
  withIds(data.speakingPrompts ?? [], 'speaking').forEach((q) => {
    batch.set(doc(db, 'examPapers', paperId, 'speakingPrompts', q.id), q)
  })
  await batch.commit()
  return paperId
}
