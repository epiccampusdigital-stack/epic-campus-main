'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '@/lib/firebase/client'
import { useStudentPortal } from '@/components/student/StudentContext'
import {
  formatVisaDate,
  parseVisaDocument,
  VISA_STATUS_STYLES,
} from '@/lib/visa/documents'

export default function StudentVisaUploads() {
  const { user, student } = useStudentPortal()
  const [docs, setDocs] = useState<ReturnType<typeof parseVisaDocument>[]>([])
  const [uploading, setUploading] = useState(false)

  const loadDocs = useCallback(async () => {
    if (!student) return
    const snap = await getDocs(
      query(
        collection(db, 'visaDocuments'),
        where('studentId', '==', student.id),
        where('side', '==', 'student'),
      ),
    )
    setDocs(
      snap.docs.map((d) => parseVisaDocument(d.id, d.data() as Record<string, unknown>)),
    )
  }, [student])

  useEffect(() => {
    void loadDocs()
  }, [loadDocs])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !student || !user) return
    setUploading(true)
    try {
      const docId = doc(collection(db, 'visaDocuments')).id
      const path = `visa/${student.id}/student/${Date.now()}-${file.name}`
      const storageRef = ref(storage, path)
      await uploadBytes(storageRef, file)
      const url = await getDownloadURL(storageRef)
      await setDoc(doc(db, 'visaDocuments', docId), {
        studentId: student.id,
        side: 'student',
        fileName: file.name,
        fileUrl: url,
        uploadedAt: serverTimestamp(),
        uploadedBy: user.uid,
        uploadedByName: student.name,
        status: 'pending',
        notes: '',
      })
      await loadDocs()
    } catch (err) {
      console.error(err)
      alert('Upload failed')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  if (!student) return null

  return (
    <div className="rounded-xl border border-[#DDE3EC] bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-jakarta font-bold text-[#0B3D6B]">Your visa documents</h3>
        <label className="cursor-pointer rounded-lg bg-[#E8A020] px-4 py-2 text-sm font-bold text-[#0B3D6B]">
          {uploading ? 'Uploading…' : 'Upload file'}
          <input
            type="file"
            className="hidden"
            accept=".pdf,image/*,.doc,.docx"
            onChange={(e) => void handleUpload(e)}
            disabled={uploading}
          />
        </label>
      </div>
      <p className="mb-3 text-xs text-[#5A6A7A]">
        Upload passport copies, forms, or other documents for your visa application.
      </p>
      {docs.length === 0 ? (
        <p className="text-sm text-[#5A6A7A]">No files uploaded yet.</p>
      ) : (
        <ul className="space-y-2">
          {docs.map((d) => (
            <li
              key={d.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#DDE3EC] px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium text-[#0D1B2A]">{d.fileName}</p>
                <p className="text-xs text-[#5A6A7A]">{formatVisaDate(d.uploadedAt)}</p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full border px-2 py-0.5 text-xs capitalize ${VISA_STATUS_STYLES[d.status]}`}
                >
                  {d.status}
                </span>
                <a
                  href={d.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-[#0B3D6B]"
                >
                  View
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
