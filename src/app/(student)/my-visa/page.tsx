'use client'

import { useEffect, useRef, useState } from 'react'
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore'
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytesResumable,
} from 'firebase/storage'
import { db, storage } from '@/lib/firebase/client'
import { useStudentPortal } from '@/components/student/StudentContext'

const VISA_STAGES = [
  { key: 'not_started', label: 'Not Started', icon: 'ti-clock' },
  { key: 'documents', label: 'Documents Prep', icon: 'ti-file-text' },
  { key: 'submitted', label: 'Submitted', icon: 'ti-send' },
  { key: 'in-progress', label: 'Processing', icon: 'ti-loader-2' },
  { key: 'approved', label: 'Approved', icon: 'ti-circle-check' },
]

const JAPAN_DOCS = [
  { key: 'passport', label: 'Passport' },
  { key: 'nic', label: 'NIC (National ID Card)' },
  { key: 'birth_certificate', label: 'Birth Certificate' },
  { key: 'police_report', label: 'Police Report' },
  { key: 'medical', label: 'Medical Certificate' },
  { key: 'photos', label: 'Passport Photos' },
  { key: 'bank_statement', label: 'Bank Statement' },
  { key: 'jft_certificate', label: 'JFT Certificate' },
  { key: 'skills_test', label: 'Skills Test Certificate' },
  { key: 'job_offer', label: 'Job Offer Letter' },
]

const KYC_DOCS = [
  { key: 'passport', label: 'Passport' },
  { key: 'nic', label: 'NIC (National ID Card)' },
  { key: 'birth_certificate', label: 'Birth Certificate' },
  { key: 'photos', label: 'Passport Photos' },
  { key: 'bank_statement', label: 'Bank Statement' },
]

interface VisaDoc {
  key: string
  label: string
  fileUrl: string
  fileName: string
  uploadedAt: string
}

export default function MyVisaPage() {
  const { student } = useStudentPortal()
  const [uploadedDocs, setUploadedDocs] = useState<Record<string, VisaDoc>>({})
  const [uploading, setUploading] = useState<Record<string, number | null>>({})
  const [deleting, setDeleting] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const courseId = student?.courseId ?? ''
  const isJapan = courseId === 'japan-ssw' || courseId.includes('japan')
  const docList = isJapan ? JAPAN_DOCS : KYC_DOCS

  const currentStage = student?.visaStatus ?? 'not_started'
  const currentIdx = VISA_STAGES.findIndex((s) => s.key === currentStage)
  const activeIdx = currentIdx === -1 ? 0 : currentIdx

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  useEffect(() => {
    if (!student) return
    async function loadDocs() {
      setLoading(true)
      try {
        const snap = await getDocs(
          query(
            collection(db, 'visaDocuments'),
            where('studentId', '==', student!.id),
          ),
        )
        const map: Record<string, VisaDoc> = {}
        snap.docs.forEach((d) => {
          const data = d.data() as VisaDoc & { studentId: string }
          map[data.key] = { ...data }
        })
        setUploadedDocs(map)
      } catch (err) {
        console.error('[MyVisa] loadDocs', err)
      } finally {
        setLoading(false)
      }
    }
    void loadDocs()
  }, [student])

  async function handleUpload(docKey: string, docLabel: string, file: File) {
    if (!student) return
    setUploading((p) => ({ ...p, [docKey]: 0 }))
    try {
      const ext = file.name.split('.').pop() ?? 'pdf'
      const storagePath = `visaDocs/${student.id}/${docKey}.${ext}`
      const storageRef = ref(storage, storagePath)
      const task = uploadBytesResumable(storageRef, file)

      await new Promise<void>((resolve, reject) => {
        task.on(
          'state_changed',
          (snap) => {
            const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100)
            setUploading((p) => ({ ...p, [docKey]: pct }))
          },
          reject,
          resolve,
        )
      })

      const url = await getDownloadURL(storageRef)
      const docData: VisaDoc & { studentId: string; studentName: string } = {
        key: docKey,
        label: docLabel,
        fileUrl: url,
        fileName: file.name,
        uploadedAt: new Date().toISOString(),
        studentId: student.id,
        studentName: student.name,
      }
      await setDoc(
        doc(db, 'visaDocuments', `${student.id}_${docKey}`),
        { ...docData, createdAt: serverTimestamp() },
      )
      setUploadedDocs((p) => ({ ...p, [docKey]: docData }))
      showToast(`${docLabel} uploaded successfully`)
    } catch (err) {
      console.error('[MyVisa] upload', err)
      showToast('Upload failed — please try again')
    } finally {
      setUploading((p) => ({ ...p, [docKey]: null }))
      if (fileRefs.current[docKey]) fileRefs.current[docKey]!.value = ''
    }
  }

  async function handleDelete(docKey: string, docLabel: string) {
    if (!student) return
    setDeleting((p) => ({ ...p, [docKey]: true }))
    try {
      const existing = uploadedDocs[docKey]
      if (existing) {
        const ext = existing.fileName.split('.').pop() ?? 'pdf'
        const storageRef = ref(storage, `visaDocs/${student.id}/${docKey}.${ext}`)
        await deleteObject(storageRef).catch(() => {})
      }
      await deleteDoc(doc(db, 'visaDocuments', `${student.id}_${docKey}`))
      setUploadedDocs((p) => {
        const next = { ...p }
        delete next[docKey]
        return next
      })
      showToast(`${docLabel} removed`)
    } catch (err) {
      console.error('[MyVisa] delete', err)
      showToast('Failed to remove document')
    } finally {
      setDeleting((p) => ({ ...p, [docKey]: false }))
    }
  }

  if (!student) return null

  const uploadedCount = Object.keys(uploadedDocs).length
  const totalCount = docList.length

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed bottom-6 right-4 z-50 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}

      <div>
        <h1 className="font-jakarta text-2xl font-bold text-[#0D1B2A] dark:text-white">
          Visa Status
        </h1>
        <p className="text-sm text-[#5A6A7A] dark:text-white/50">
          Track your visa application and upload required documents
        </p>
      </div>

      {/* Progress tracker */}
      <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-jakarta font-bold text-[#0B3D6B] dark:text-[#E8A020]">
            Application Progress
          </h2>
          <span className="rounded-full bg-[#0B3D6B]/10 dark:bg-[#E8A020]/10 px-3 py-1 text-xs font-semibold text-[#0B3D6B] dark:text-[#E8A020] capitalize">
            {currentStage.replace(/-/g, ' ')}
          </span>
        </div>
        <div className="flex flex-col gap-4">
          {VISA_STAGES.map((stage, idx) => {
            const done = idx < activeIdx
            const active = idx === activeIdx
            return (
              <div key={stage.key} className="flex items-center gap-4">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  done ? 'bg-emerald-500 text-white'
                    : active ? 'bg-[#E8A020] text-[#0B3D6B]'
                    : 'bg-[#DDE3EC] dark:bg-white/10 text-[#5A6A7A] dark:text-white/40'
                }`}>
                  <span className={`ti ${stage.icon}`} />
                </div>
                <div className="flex-1">
                  <p className={`font-medium ${
                    active ? 'text-[#0B3D6B] dark:text-[#E8A020]'
                      : done ? 'text-emerald-600'
                      : 'text-[#5A6A7A] dark:text-white/40'
                  }`}>
                    {stage.label}
                  </p>
                  {active && (
                    <p className="mt-0.5 text-xs text-[#5A6A7A] dark:text-white/40">
                      Current stage — contact admin for updates
                    </p>
                  )}
                </div>
                {done && <span className="ti ti-check text-emerald-500" />}
              </div>
            )
          })}
        </div>
      </div>

      {/* Document upload section */}
      <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="font-jakarta font-bold text-[#0B3D6B] dark:text-white">
              Required Documents
            </h2>
            <p className="mt-0.5 text-sm text-[#5A6A7A] dark:text-white/50">
              Upload clear scans or photos (PDF, JPG, PNG — max 10MB each)
            </p>
          </div>
          <span className="rounded-full bg-[#0B3D6B]/10 dark:bg-[#E8A020]/10 px-3 py-1 text-xs font-semibold text-[#0B3D6B] dark:text-[#E8A020]">
            {uploadedCount}/{totalCount} uploaded
          </span>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-[#DDE3EC] dark:bg-white/10" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {docList.map((docItem) => {
              const uploaded = uploadedDocs[docItem.key]
              const progress = uploading[docItem.key]
              const isDeleting = deleting[docItem.key]
              const isUploading = progress !== null && progress !== undefined

              return (
                <div
                  key={docItem.key}
                  className={`rounded-xl border p-4 transition-all ${
                    uploaded
                      ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/10'
                      : 'border-[#DDE3EC] dark:border-white/[0.08] bg-[#F5F7FB] dark:bg-white/[0.02]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                        uploaded ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-[#DDE3EC] dark:bg-white/10'
                      }`}>
                        <span className={`ti ${uploaded ? 'ti-circle-check text-emerald-600' : 'ti-file text-[#5A6A7A] dark:text-white/40'} text-lg`} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm text-[#0D1B2A] dark:text-white truncate">
                          {docItem.label}
                        </p>
                        {uploaded && (
                          <p className="text-xs text-emerald-600 dark:text-emerald-400 truncate">
                            {uploaded.fileName}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {uploaded ? (
                        <>
                          <a
                            href={uploaded.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg border border-[#DDE3EC] dark:border-white/20 px-3 py-1.5 text-xs font-semibold text-[#0B3D6B] dark:text-white hover:bg-white dark:hover:bg-white/10"
                          >
                            View
                          </a>
                          <button
                            type="button"
                            disabled={isDeleting}
                            onClick={() => void handleDelete(docItem.key, docItem.label)}
                            className="rounded-lg border border-red-200 dark:border-red-800 px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                          >
                            {isDeleting ? 'Removing…' : 'Remove'}
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          disabled={isUploading}
                          onClick={() => fileRefs.current[docItem.key]?.click()}
                          className="rounded-xl bg-[#0B3D6B] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#0a3460] disabled:opacity-50"
                        >
                          {isUploading ? `${progress}%` : 'Upload'}
                        </button>
                      )}
                    </div>
                  </div>

                  {isUploading && (
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#DDE3EC] dark:bg-white/10">
                      <div
                        className="h-full rounded-full bg-[#E8A020] transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  )}

                  <input
                    ref={(el) => { fileRefs.current[docItem.key] = el }}
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) void handleUpload(docItem.key, docItem.label, file)
                    }}
                  />
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Contact help */}
      <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-5">
        <h3 className="font-jakarta font-bold text-[#0B3D6B] dark:text-white mb-2">
          Need help?
        </h3>
        <p className="text-sm text-[#5A6A7A] dark:text-white/50">
          Contact your coordinator for visa updates or document requirements.
        </p>
        <a
          href="tel:+94762548383"
          className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#0B3D6B] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0a3460]"
        >
          <span className="ti ti-phone" />
          076 254 8383
        </a>
      </div>
    </div>
  )
}
