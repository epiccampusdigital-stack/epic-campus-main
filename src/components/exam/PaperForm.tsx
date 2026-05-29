'use client'

import { useEffect, useState } from 'react'
import { COURSES } from '@/lib/constants/courses'
import { codeToPaperId, saveExamPaper } from '@/lib/exam/helpers'
import type { ExamPaper, ExamPaperLanguage, ExamPaperLevel, ExamPaperStatus } from '@/types'

const LEVELS: ExamPaperLevel[] = ['A1', 'A2', 'A2-B1', 'B1', 'N5', 'N4']
const LANGUAGES: ExamPaperLanguage[] = ['bilingual', 'japanese']

interface PaperFormProps {
  open: boolean
  paper?: ExamPaper | null
  onClose: () => void
  onSaved: () => void
}

const emptyForm = (): Omit<ExamPaper, 'id'> & { id: string } => ({
  id: '',
  code: '',
  title: '',
  level: 'A1',
  description: '',
  status: 'draft',
  readingCount: 0,
  listeningCount: 0,
  readingMinutes: 60,
  listeningMinutes: 30,
  writingMinutes: 45,
  speakingMinutes: 15,
  language: 'bilingual',
  courseIds: ['japan-ssw'],
})

export default function PaperForm({ open, paper, onClose, onSaved }: PaperFormProps) {
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (paper) {
      setForm({
        ...paper,
        courseIds: paper.courseIds ?? ['japan-ssw'],
        language: paper.language ?? 'bilingual',
      })
    } else {
      setForm(emptyForm())
    }
    setError('')
  }, [paper, open])

  if (!open) return null

  const toggleCourse = (courseId: string) => {
    setForm((f) => {
      const ids = f.courseIds ?? []
      return {
        ...f,
        courseIds: ids.includes(courseId)
          ? ids.filter((c) => c !== courseId)
          : [...ids, courseId],
      }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.code.trim() || !form.title.trim()) {
      setError('Code and title are required')
      return
    }
    setSaving(true)
    setError('')
    try {
      const id = paper?.id ?? codeToPaperId(form.code)
      await saveExamPaper({ ...form, id })
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save paper')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#DDE3EC] px-6 py-4">
          <h2 className="font-jakarta text-lg font-bold text-[#0B3D6B]">
            {paper ? 'Edit paper' : 'Create new paper'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-2xl leading-none text-[#5A6A7A] hover:text-[#0B3D6B]"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto p-6">
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-[#5A6A7A]">Paper code</label>
              <input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="J-007"
                disabled={!!paper}
                className="mt-1 w-full rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm disabled:bg-[#F5F7FB]"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[#5A6A7A]">Title</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="mt-1 w-full rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-[#5A6A7A]">Level</label>
                <select
                  value={form.level}
                  onChange={(e) =>
                    setForm({ ...form, level: e.target.value as ExamPaperLevel })
                  }
                  className="mt-1 w-full rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm"
                >
                  {LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-[#5A6A7A]">Language</label>
                <select
                  value={form.language ?? 'bilingual'}
                  onChange={(e) =>
                    setForm({ ...form, language: e.target.value as ExamPaperLanguage })
                  }
                  className="mt-1 w-full rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-[#5A6A7A]">Status</label>
              <select
                value={form.status}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value as ExamPaperStatus })
                }
                className="mt-1 w-full rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm"
              >
                <option value="draft">Draft</option>
                <option value="active">Published</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-[#5A6A7A]">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                className="mt-1 w-full rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[#5A6A7A]">Courses</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {COURSES.map((c) => (
                  <label
                    key={c.id}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#DDE3EC] px-3 py-1.5 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={(form.courseIds ?? []).includes(c.id)}
                      onChange={() => toggleCourse(c.id)}
                    />
                    {c.flag} {c.label}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-[#5A6A7A]">Time limits (minutes)</label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(
                  [
                    ['readingMinutes', 'Reading'],
                    ['listeningMinutes', 'Listening'],
                    ['writingMinutes', 'Writing'],
                    ['speakingMinutes', 'Speaking'],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key}>
                    <span className="text-xs text-[#5A6A7A]">{label}</span>
                    <input
                      type="number"
                      min={1}
                      value={form[key]}
                      onChange={(e) =>
                        setForm({ ...form, [key]: Number(e.target.value) })
                      }
                      className="mt-0.5 w-full rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

          <div className="mt-auto flex gap-3 pt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-[#DDE3EC] py-2.5 text-sm font-semibold text-[#0B3D6B]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-lg bg-[#0B3D6B] py-2.5 text-sm font-bold text-white disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save paper'}
            </button>
          </div>
        </form>
      </aside>
    </>
  )
}
