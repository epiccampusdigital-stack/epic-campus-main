'use client'

import { useEffect, useRef, useState } from 'react'
import { useStudentPortal } from '@/components/student/StudentContext'
import {
  SUBMISSION_NOTE_MAX_LENGTH,
  SUBMISSION_TAGS,
  createStudentSubmission,
  deleteStudentSubmission,
  notifyOfStudentSubmission,
  subscribeStudentSubmissions,
  uploadSubmissionFile,
  validateSubmissionFile,
  type StudentSubmission,
} from '@/lib/submissions/helpers'
import { sendStudentTeacherThreadMessage } from '@/lib/messages/studentTeacherThread'

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * "My Submissions" — sits below the read-only Study Materials list on /my-materials.
 * Does not touch that list, its query, or its download logic.
 */
export default function StudentSubmissionsSection() {
  const { student } = useStudentPortal()
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [tag, setTag] = useState<string>(SUBMISSION_TAGS[0])
  const [note, setNote] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState('')
  const [progress, setProgress] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!student) return
    const unsub = subscribeStudentSubmissions(
      student.id,
      (list) => {
        setSubmissions(list)
        setLoading(false)
      },
      () => setLoading(false),
    )
    return unsub
  }, [student])

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0] ?? null
    if (!picked) {
      setFile(null)
      setFileError('')
      return
    }
    const err = validateSubmissionFile(picked)
    if (err) {
      setFile(null)
      setFileError(err)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    setFile(picked)
    setFileError('')
  }

  function resetForm() {
    setTitle('')
    setTag(SUBMISSION_TAGS[0])
    setNote('')
    setFile(null)
    setFileError('')
    setProgress(null)
    setFormError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleSubmit() {
    if (!student) return
    setFormError('')
    if (!file) {
      setFormError('Please choose a file to upload.')
      return
    }
    if (!title.trim()) {
      setFormError('Title is required.')
      return
    }

    setSubmitting(true)
    setProgress(0)
    try {
      const fileUrl = await uploadSubmissionFile(student.id, file, setProgress)
      const cleanTitle = title.trim()

      await createStudentSubmission({
        studentId: student.id,
        studentName: student.name,
        batchId: student.batchId,
        courseId: student.courseId,
        title: cleanTitle,
        tag,
        note: note.trim(),
        fileUrl,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        // No batch → teacher assignment table exists in the app, so the doc
        // stays visible to every teacher/admin/owner instead (see firestore.rules).
        teacherId: null,
      })

      await sendStudentTeacherThreadMessage({
        studentId: student.id,
        studentName: student.name,
        studentEmail: student.email ?? '',
        text: `${student.name} sent a file: ${cleanTitle} (${tag})\n${fileUrl}`,
      })

      await notifyOfStudentSubmission({
        studentId: student.id,
        studentName: student.name,
        title: cleanTitle,
        tag,
      })

      resetForm()
      setOpen(false)
    } catch (err) {
      console.error('[StudentSubmissions] submit', err)
      setFormError('Upload failed — please try again.')
    } finally {
      setSubmitting(false)
      setProgress(null)
    }
  }

  async function handleDelete(submission: StudentSubmission) {
    if (!window.confirm('Delete this submission? This cannot be undone.')) return
    setDeletingId(submission.id)
    try {
      await deleteStudentSubmission(submission)
    } catch (err) {
      console.error('[StudentSubmissions] delete', err)
      window.alert('Failed to delete — please try again.')
    } finally {
      setDeletingId(null)
    }
  }

  if (!student) return null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-jakarta text-xl font-bold text-[#0D1B2A]">My Submissions</h2>
          <p className="text-sm text-[#5A6A7A]">Send files to your teacher — exam papers, homework, certificates</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[#0B3D6B] px-4 py-2 font-jakarta text-sm font-semibold text-white hover:bg-[#0f4c81]"
        >
          <span className="ti ti-upload" aria-hidden="true" />
          Upload File
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-[#DDE3EC]" />
          ))}
        </div>
      ) : submissions.length === 0 ? (
        <div className="rounded-xl border border-[#DDE3EC] bg-white px-6 py-10 text-center">
          <span className="ti ti-file-upload text-4xl text-[#DDE3EC]" aria-hidden="true" />
          <p className="mt-3 font-jakarta font-semibold text-[#0D1B2A]">No submissions yet.</p>
          <p className="mt-1 text-sm text-[#5A6A7A]">Upload a file to send it to your teacher.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {submissions.map((s) => (
            <div
              key={s.id}
              className="flex flex-col gap-3 rounded-xl border border-[#DDE3EC] bg-white p-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-jakarta font-semibold text-[#0D1B2A]">{s.title}</p>
                  <span className="rounded-full border border-[#DDE3EC] bg-[#F5F7FB] px-2 py-0.5 text-xs font-medium text-[#5A6A7A]">
                    {s.tag}
                  </span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                      s.readByTeacher
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-amber-200 bg-amber-50 text-amber-700'
                    }`}
                  >
                    {s.readByTeacher ? 'Viewed by teacher' : 'Sent'}
                  </span>
                </div>
                <p className="mt-1 truncate text-sm text-[#5A6A7A]">
                  {s.fileName} · {formatFileSize(s.fileSize)}
                </p>
                <p className="mt-0.5 text-xs text-[#5A6A7A]">{formatDate(s.createdAt)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <a
                  href={s.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-[#DDE3EC] px-3 py-1.5 text-xs font-semibold text-[#0B3D6B] hover:bg-[#F5F7FB]"
                >
                  View
                </a>
                <button
                  type="button"
                  disabled={deletingId === s.id}
                  onClick={() => void handleDelete(s)}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  {deletingId === s.id ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={() => !submitting && setOpen(false)}
          />
          <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
            <div className="w-full max-w-lg rounded-t-3xl sm:rounded-2xl bg-white shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#DDE3EC] bg-white px-5 py-4">
                <h2 className="font-jakarta font-bold text-[#0B3D6B]">Upload File</h2>
                <button
                  type="button"
                  onClick={() => !submitting && setOpen(false)}
                  className="rounded-lg p-1.5 text-[#5A6A7A]"
                >
                  <span className="ti ti-x text-lg" />
                </button>
              </div>

              <div className="space-y-4 p-5">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#5A6A7A]">Title *</label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. JLPT N4 Mock Exam"
                    className="w-full rounded-xl border border-[#DDE3EC] bg-[#F5F7FB] px-4 py-2.5 text-sm text-[#0D1B2A] outline-none focus:border-[#E8A020]"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#5A6A7A]">Tag *</label>
                  <div className="flex flex-wrap gap-2">
                    {SUBMISSION_TAGS.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTag(t)}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                          tag === t ? 'bg-[#0B3D6B] text-white' : 'border border-[#DDE3EC] text-[#5A6A7A]'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#5A6A7A]">Note to teacher (optional)</label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value.slice(0, SUBMISSION_NOTE_MAX_LENGTH))}
                    rows={3}
                    placeholder="Anything your teacher should know..."
                    className="w-full resize-none rounded-xl border border-[#DDE3EC] bg-[#F5F7FB] px-4 py-3 text-sm text-[#0D1B2A] outline-none focus:border-[#E8A020]"
                  />
                  <p className="mt-1 text-right text-[11px] text-[#5A6A7A]">
                    {note.length}/{SUBMISSION_NOTE_MAX_LENGTH}
                  </p>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#5A6A7A]">File *</label>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#DDE3EC] px-4 py-3 text-sm font-medium text-[#5A6A7A] hover:border-[#E8A020]"
                  >
                    <span className="ti ti-paperclip" />
                    {file ? file.name : 'Choose a PDF, PNG, or JPEG (max 10MB)'}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf,image/png,image/jpeg"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  {fileError && <p className="mt-1.5 text-xs text-red-600">{fileError}</p>}
                </div>

                {progress !== null && (
                  <div className="h-1.5 overflow-hidden rounded-full bg-[#DDE3EC]">
                    <div
                      className="h-full rounded-full bg-[#E8A020] transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                )}

                {formError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {formError}
                  </div>
                )}
              </div>

              <div className="sticky bottom-0 border-t border-[#DDE3EC] bg-white px-5 py-4">
                <button
                  type="button"
                  disabled={submitting || !file || !title.trim()}
                  onClick={() => void handleSubmit()}
                  className="w-full rounded-xl bg-[#E8A020] py-3 text-sm font-bold text-[#0B3D6B] hover:bg-[#d4911c] disabled:opacity-50"
                >
                  {submitting ? (progress !== null ? `Uploading ${progress}%…` : 'Sending…') : 'Send to Teacher'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
