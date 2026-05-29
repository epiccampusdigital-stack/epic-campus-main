'use client'

import { useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import {
  fetchListeningQuestions,
  fetchReadingQuestions,
  fetchSpeakingSubmissions,
  fetchWritingSubmissions,
  getGradeColor,
  loadAnswers,
  updateSpeakingScore,
} from '@/lib/exam/helpers'
import { db } from '@/lib/firebase/client'
import type { ExamAttempt, ListeningQuestion, ReadingQuestion } from '@/types'

interface WritingFeedback {
  strengths?: string[]
  improvements?: string[]
}

interface AttemptDetailPanelProps {
  attempt: ExamAttempt
  paperTitle: string
  onClose: () => void
  onUpdated?: () => void
}

function ScoreBar({ label, score }: { label: string; score?: number | null }) {
  const value = score ?? 0
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-[#5A6A7A]">{label}</span>
        <span className="font-semibold text-[#0B3D6B]">
          {score != null ? `${score}%` : 'Pending'}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#DDE3EC]">
        <div
          className="h-full rounded-full bg-[#0B3D6B] transition-all"
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
    </div>
  )
}

export default function AttemptDetailPanel({
  attempt,
  paperTitle,
  onClose,
  onUpdated,
}: AttemptDetailPanelProps) {
  const [readingQs, setReadingQs] = useState<ReadingQuestion[]>([])
  const [listeningQs, setListeningQs] = useState<ListeningQuestion[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [writingFeedback, setWritingFeedback] = useState<WritingFeedback | null>(null)
  const [writingSubs, setWritingSubs] = useState<
    { taskNumber: number; feedback?: string; score?: number }[]
  >([])
  const [speakingSubs, setSpeakingSubs] = useState<
    { partNumber: number; audioUrl?: string; transcription?: string; feedback?: string }[]
  >([])
  const [speakingInput, setSpeakingInput] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    ;(async () => {
      const [rq, lq, ans, ws, ss] = await Promise.all([
        fetchReadingQuestions(attempt.paperId),
        fetchListeningQuestions(attempt.paperId),
        loadAnswers(attempt.id),
        fetchWritingSubmissions(attempt.id),
        fetchSpeakingSubmissions(attempt.id),
      ])
      setReadingQs(rq)
      setListeningQs(lq)
      setAnswers(ans)
      setWritingSubs(ws)
      setSpeakingSubs(ss)
      setSpeakingInput(attempt.speakingScore != null ? String(attempt.speakingScore) : '')

      const snap = await getDoc(doc(db, 'examAttempts', attempt.id))
      const raw = snap.data()
      if (raw?.writingFeedback) {
        setWritingFeedback(raw.writingFeedback as WritingFeedback)
      }
    })()
  }, [attempt])

  const handleSaveSpeaking = async () => {
    const score = Number(speakingInput)
    if (Number.isNaN(score) || score < 0 || score > 100 || saving) return
    setSaving(true)
    try {
      await updateSpeakingScore(attempt.id, score)
      onUpdated?.()
    } finally {
      setSaving(false)
    }
  }

  const speakingPending = attempt.speakingScore == null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-[#DDE3EC] px-6 py-4">
          <div>
            <h2 className="font-jakarta text-lg font-bold text-[#0B3D6B]">Attempt detail</h2>
            <p className="mt-1 text-sm text-[#5A6A7A]">
              {attempt.studentName} · {paperTitle} ·{' '}
              {new Date(attempt.startedAt).toLocaleString()}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-2xl leading-none text-[#5A6A7A] hover:text-[#0B3D6B]"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="mb-4 flex items-center gap-3">
            {attempt.grade && (
              <span
                className={`rounded border px-3 py-1 text-lg font-bold ${getGradeColor(attempt.grade)}`}
              >
                {attempt.grade}
              </span>
            )}
            <span className="font-jakarta text-xl font-bold text-[#0B3D6B]">
              {attempt.totalScore ?? 0}% total
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <ScoreBar label="Reading" score={attempt.readingScore} />
            <ScoreBar label="Listening" score={attempt.listeningScore} />
            <ScoreBar label="Writing" score={attempt.writingScore} />
            <ScoreBar label="Speaking" score={attempt.speakingScore} />
          </div>

          {(writingFeedback || writingSubs.length > 0) && (
            <div className="mt-6 rounded-lg bg-[#F5F7FB] p-4">
              <h3 className="font-jakarta font-semibold text-[#0B3D6B]">Writing feedback</h3>
              {writingSubs.map((w) => (
                <div key={w.taskNumber} className="mt-2 text-sm">
                  <p className="font-medium">Task {w.taskNumber}: {w.score ?? '—'}%</p>
                  {w.feedback && <p className="text-[#5A6A7A]">{w.feedback}</p>}
                </div>
              ))}
              {writingFeedback?.strengths && writingFeedback.strengths.length > 0 && (
                <ul className="mt-2 list-inside list-disc text-sm text-green-800">
                  {writingFeedback.strengths.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              )}
              {writingFeedback?.improvements && writingFeedback.improvements.length > 0 && (
                <ul className="mt-2 list-inside list-disc text-sm text-amber-800">
                  {writingFeedback.improvements.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="mt-6">
            <h3 className="font-jakarta font-semibold text-[#0B3D6B]">Speaking</h3>
            {speakingPending && (
              <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                Pending review
              </span>
            )}
            {speakingSubs.map((s) => (
              <div key={s.partNumber} className="mt-3 rounded-lg border border-[#DDE3EC] p-3">
                <p className="text-xs font-medium text-[#5A6A7A]">Part {s.partNumber}</p>
                {s.transcription && (
                  <p className="mt-1 text-sm text-[#0D1B2A]">{s.transcription}</p>
                )}
                {s.audioUrl && (
                  <audio controls src={s.audioUrl} className="mt-2 w-full" />
                )}
                {s.feedback && (
                  <p className="mt-2 text-sm text-[#5A6A7A]">{s.feedback}</p>
                )}
              </div>
            ))}
            {speakingPending && (
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <div>
                  <label className="text-xs font-medium text-[#5A6A7A]">
                    Manual score (0–100)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={speakingInput}
                    onChange={(e) => setSpeakingInput(e.target.value)}
                    className="mt-1 block w-32 rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm"
                  />
                </div>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSaveSpeaking}
                  className="rounded-lg bg-[#E8A020] px-4 py-2 text-sm font-bold text-[#0B3D6B] disabled:opacity-60"
                >
                  {saving ? 'Saving…' : 'Save speaking score'}
                </button>
              </div>
            )}
          </div>

          <div className="mt-6">
            <h3 className="font-jakarta font-semibold text-[#0B3D6B]">Answer review</h3>
            <div className="mt-3 space-y-3">
              {readingQs.map((q) => {
                const ans = answers[q.id]
                const correct = ans?.toUpperCase() === q.correctAnswer.toUpperCase()
                return (
                  <div
                    key={q.id}
                    className={`rounded-lg border p-3 text-sm ${correct ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50'}`}
                  >
                    <p className="text-xs text-[#5A6A7A]">Reading Q{q.questionNumber}</p>
                    <p className="font-medium">{q.questionText}</p>
                    <p className="mt-1">
                      Your answer: <strong>{ans ?? '—'}</strong> · Correct:{' '}
                      <strong>{q.correctAnswer}</strong>
                    </p>
                  </div>
                )
              })}
              {listeningQs.map((q) => {
                const ans = answers[q.id]
                const correct = ans?.toUpperCase() === q.correctAnswer.toUpperCase()
                return (
                  <div
                    key={q.id}
                    className={`rounded-lg border p-3 text-sm ${correct ? 'border-green-200 bg-green-50/50' : 'border-red-200 bg-red-50/50'}`}
                  >
                    <p className="text-xs text-[#5A6A7A]">Listening Q{q.questionNumber}</p>
                    <p className="font-medium">{q.questionText}</p>
                    <p className="mt-1">
                      Your answer: <strong>{ans ?? '—'}</strong> · Correct:{' '}
                      <strong>{q.correctAnswer}</strong>
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
