'use client'

import { useCallback, useEffect, useState } from 'react'
import { fetchListeningQuestions } from '@/lib/exam/helpers'
import {
  isValidListeningAudioFile,
  removeListeningQuestionAudio,
  uploadListeningQuestionAudio,
} from '@/lib/exam/listening-audio'
import type { ExamPaper, ListeningQuestion } from '@/types'

interface ListeningQuestionsEditorProps {
  paper: ExamPaper
  open: boolean
  onClose: () => void
}

export default function ListeningQuestionsEditor({
  paper,
  open,
  onClose,
}: ListeningQuestionsEditorProps) {
  const [questions, setQuestions] = useState<ListeningQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const loadQuestions = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const list = await fetchListeningQuestions(paper.id)
      setQuestions(
        list.map((q) => ({
          ...q,
          audioUrl: q.audioUrl || null,
        })),
      )
    } catch (err) {
      console.error('[ListeningQuestionsEditor]', err)
      setError('Failed to load listening questions.')
    } finally {
      setLoading(false)
    }
  }, [paper.id])

  useEffect(() => {
    if (open) loadQuestions()
  }, [open, loadQuestions])

  if (!open) return null

  async function handleUpload(question: ListeningQuestion, file: File) {
    if (!isValidListeningAudioFile(file)) {
      setError('Only .mp3 and .wav files are allowed.')
      return
    }
    setUploadingId(question.id)
    setError('')
    try {
      const url = await uploadListeningQuestionAudio(paper.id, question.id, file)
      setQuestions((prev) =>
        prev.map((q) => (q.id === question.id ? { ...q, audioUrl: url } : q)),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setUploadingId(null)
    }
  }

  async function handleRemove(question: ListeningQuestion) {
    if (!confirm(`Remove audio for question ${question.questionNumber}?`)) return
    setRemovingId(question.id)
    setError('')
    try {
      await removeListeningQuestionAudio(paper.id, question.id)
      setQuestions((prev) =>
        prev.map((q) => (q.id === question.id ? { ...q, audioUrl: null } : q)),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove audio.')
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col bg-white/90 dark:bg-[#0d1a2e]/90 backdrop-blur-2xl border-l border-white/80 dark:border-white/[0.08] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#DDE3EC] px-6 py-4">
          <div>
            <h2 className="font-jakarta text-lg font-bold text-[#0B3D6B]">
              Listening — Audio Upload
            </h2>
            <p className="text-sm text-[#5A6A7A]">
              {paper.code} · {paper.title}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-2xl leading-none text-[#5A6A7A] hover:text-[#0B3D6B]"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
          )}

          {loading ? (
            <div className="h-40 animate-pulse rounded-xl bg-[#DDE3EC]" />
          ) : questions.length === 0 ? (
            <p className="text-center text-sm text-[#5A6A7A]">
              No listening questions on this paper. Import questions via JSON first.
            </p>
          ) : (
            <div className="space-y-6">
              {questions.map((q) => (
                <div
                  key={q.id}
                  className="rounded-xl border border-[#DDE3EC] bg-[#F5F7FB] p-4"
                >
                  <p className="font-jakarta text-sm font-semibold text-[#0B3D6B]">
                    Question {q.questionNumber}
                  </p>
                  <p className="mt-1 text-sm text-[#5A6A7A]">{q.questionText}</p>

                  <div className="mt-4">
                    {q.audioUrl ? (
                      <div className="space-y-3">
                        <audio controls className="w-full" src={q.audioUrl} preload="metadata">
                          <track kind="captions" />
                        </audio>
                        <button
                          type="button"
                          onClick={() => handleRemove(q)}
                          disabled={removingId === q.id}
                          className="text-sm font-semibold text-red-600 hover:underline disabled:opacity-50"
                        >
                          {removingId === q.id ? 'Removing…' : 'Remove audio'}
                        </button>
                      </div>
                    ) : (
                      <p className="mb-2 text-xs text-[#5A6A7A]">No audio uploaded yet.</p>
                    )}

                    <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#DDE3EC] bg-white px-4 py-2 text-sm font-semibold text-[#0B3D6B] hover:bg-white/80">
                      <span className="ti ti-upload" aria-hidden="true" />
                      {uploadingId === q.id
                        ? 'Uploading…'
                        : q.audioUrl
                          ? 'Replace audio'
                          : 'Upload audio (.mp3 / .wav)'}
                      <input
                        type="file"
                        accept=".mp3,.wav,audio/mpeg,audio/wav"
                        className="hidden"
                        disabled={uploadingId === q.id}
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleUpload(q, file)
                          e.target.value = ''
                        }}
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </>
  )
}