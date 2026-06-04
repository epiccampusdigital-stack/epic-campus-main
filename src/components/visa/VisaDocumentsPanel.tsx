'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '@/lib/firebase/client'
import { useManagement } from '@/components/layout/ManagementContext'
import { parseStudent } from '@/lib/students/helpers'
import {
  formatVisaDate,
  parseVisaDocument,
  VISA_STATUS_STYLES,
  type VisaDocSide,
  type VisaDocStatus,
  type VisaDocumentRecord,
} from '@/lib/visa/documents'
import type { Student } from '@/types'

function DocColumn({
  title,
  side,
  docs,
  studentId,
  canUpload,
  onRefresh,
  userId,
  userName,
}: {
  title: string
  side: VisaDocSide
  docs: VisaDocumentRecord[]
  studentId: string
  canUpload: boolean
  onRefresh: () => void
  userId: string
  userName: string
}) {
  const [uploading, setUploading] = useState(false)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !studentId) return
    setUploading(true)
    try {
      const docId = doc(collection(db, 'visaDocuments')).id
      const storagePath = `visa/${studentId}/${side}/${Date.now()}-${file.name}`
      const storageRef = ref(storage, storagePath)
      await uploadBytes(storageRef, file)
      const url = await getDownloadURL(storageRef)
      await setDoc(doc(db, 'visaDocuments', docId), {
        studentId,
        side,
        fileName: file.name,
        fileUrl: url,
        uploadedAt: serverTimestamp(),
        uploadedBy: userId,
        uploadedByName: userName,
        status: 'pending',
        notes: '',
      })
      onRefresh()
    } catch (err) {
      console.error('[VisaUpload]', err)
      alert('Upload failed')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function updateDocField(
    docId: string,
    patch: Partial<{ status: VisaDocStatus; notes: string }>,
  ) {
    await updateDoc(doc(db, 'visaDocuments', docId), {
      ...patch,
      updatedAt: serverTimestamp(),
    })
    onRefresh()
  }

  return (
    <div className="rounded-xl border border-[#DDE3EC] bg-white p-5 dark:border-gray-600 dark:bg-gray-800">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-jakarta font-bold text-[#0B3D6B] dark:text-white">{title}</h3>
        {canUpload && (
          <label className="cursor-pointer rounded-lg bg-[#0B3D6B] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0a3560]">
            {uploading ? 'Uploading…' : 'Upload'}
            <input
              type="file"
              className="hidden"
              accept=".pdf,image/*,.doc,.docx"
              onChange={(e) => void handleUpload(e)}
              disabled={uploading || !studentId}
            />
          </label>
        )}
      </div>
      {docs.length === 0 ? (
        <p className="text-sm text-[#5A6A7A]">No documents yet.</p>
      ) : (
        <ul className="space-y-3">
          {docs.map((d) => (
            <li
              key={d.id}
              className="rounded-lg border border-[#DDE3EC] p-3 dark:border-gray-600"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-[#0D1B2A] dark:text-white">
                    {d.fileName}
                  </p>
                  <p className="text-xs text-[#5A6A7A]">
                    {formatVisaDate(d.uploadedAt)} · {d.uploadedByName}
                  </p>
                </div>
                <a
                  href={d.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 rounded-lg border border-[#0B3D6B] px-2 py-1 text-xs font-semibold text-[#0B3D6B]"
                >
                  Download
                </a>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <select
                  value={d.status}
                  onChange={(e) =>
                    void updateDocField(d.id, { status: e.target.value as VisaDocStatus })
                  }
                  className={`rounded-full border px-2 py-0.5 text-xs font-medium ${VISA_STATUS_STYLES[d.status]}`}
                >
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              <input
                type="text"
                defaultValue={d.notes}
                placeholder="Notes…"
                onBlur={(e) => {
                  if (e.target.value !== d.notes) {
                    void updateDocField(d.id, { notes: e.target.value })
                  }
                }}
                className="mt-2 w-full rounded border border-[#DDE3EC] px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function VisaDocumentsPanel() {
  const { user } = useManagement()
  const [students, setStudents] = useState<Student[]>([])
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [docs, setDocs] = useState<VisaDocumentRecord[]>([])
  const [loading, setLoading] = useState(true)

  const loadStudents = useCallback(async () => {
    const snap = await getDocs(collection(db, 'students'))
    setStudents(
      snap.docs
        .map((d) => parseStudent(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => a.name.localeCompare(b.name)),
    )
  }, [])

  const loadDocs = useCallback(async () => {
    if (!selectedId) {
      setDocs([])
      return
    }
    const snap = await getDocs(
      query(collection(db, 'visaDocuments'), where('studentId', '==', selectedId)),
    )
    setDocs(
      snap.docs.map((d) => parseVisaDocument(d.id, d.data() as Record<string, unknown>)),
    )
  }, [selectedId])

  useEffect(() => {
    void loadStudents().finally(() => setLoading(false))
  }, [loadStudents])

  useEffect(() => {
    void loadDocs()
  }, [loadDocs])

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return students.slice(0, 30)
    return students
      .filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.studentCode.toLowerCase().includes(q) ||
          s.mobile.includes(q),
      )
      .slice(0, 30)
  }, [students, search])

  const staffDocs = docs.filter((d) => d.side === 'staff')
  const studentDocs = docs.filter((d) => d.side === 'student')
  const selectedStudent = students.find((s) => s.id === selectedId)

  if (!user) return null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-jakarta text-2xl font-bold text-[#0B3D6B] dark:text-white">
          Visa Documents
        </h1>
        <p className="mt-1 text-sm text-[#5A6A7A]">
          Manage staff and student visa files per student
        </p>
      </div>

      <div className="rounded-xl border border-[#DDE3EC] bg-white p-4 dark:border-gray-600 dark:bg-gray-800">
        <label className="mb-1.5 block text-xs font-medium uppercase text-[#5A6A7A]">
          Select student
        </label>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, code, or phone…"
          className="mb-2 w-full rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
        />
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
        >
          <option value="">Choose a student</option>
          {filteredStudents.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.studentCode}) — {s.mobile}
            </option>
          ))}
        </select>
        {selectedStudent && (
          <p className="mt-2 text-xs text-[#5A6A7A]">
            {selectedStudent.courseId} · {selectedStudent.batchId}
          </p>
        )}
      </div>

      {loading && <div className="h-32 animate-pulse rounded-xl bg-[#DDE3EC]" />}

      {!loading && !selectedId && (
        <p className="rounded-xl border border-dashed border-[#DDE3EC] py-12 text-center text-sm text-[#5A6A7A]">
          Select a student to view and manage visa documents.
        </p>
      )}

      {selectedId && (
        <div className="grid gap-6 lg:grid-cols-2">
          <DocColumn
            title="Staff Documents"
            side="staff"
            docs={staffDocs}
            studentId={selectedId}
            canUpload
            onRefresh={loadDocs}
            userId={user.uid}
            userName={user.displayName || user.email}
          />
          <DocColumn
            title="Student Documents"
            side="student"
            docs={studentDocs}
            studentId={selectedId}
            canUpload={false}
            onRefresh={loadDocs}
            userId={user.uid}
            userName={user.displayName || user.email}
          />
        </div>
      )}
    </div>
  )
}
