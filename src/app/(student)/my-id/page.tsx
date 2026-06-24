'use client'

import { useRef, useState } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage'
import { db, storage } from '@/lib/firebase/client'
import StudentIDCard from '@/components/students/StudentIDCard'
import { useStudentPortal } from '@/components/student/StudentContext'
import { studentToIdCardProps } from '@/lib/students/idCard'
import { downloadIDCard } from '@/lib/utils/downloadIDCard'

export default function MyIdPage() {
  const { student, user, refreshStudent } = useStudentPortal()
  const [downloading, setDownloading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [toast, setToast] = useState('')
  const fileRef = useRef<HTMLInputElement | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const fallbackId = user?.uid
    ? `EC-${new Date().getFullYear()}-${user.uid.slice(0, 4).toUpperCase()}`
    : undefined

  const effectiveStudent = student ?? {
    id: user?.uid ?? 'unknown',
    name: user?.displayName ?? user?.email ?? 'Student',
    courseId: undefined,
    enrollmentDate: undefined,
    batchStartDate: undefined,
    location: undefined,
    photoUrl: undefined,
    studentCode: undefined,
  }

  const cardProps = studentToIdCardProps(effectiveStudent as any, fallbackId)

  async function handlePhotoUpload(file: File) {
    if (!student) return
    if (!file.type.startsWith('image/')) {
      showToast('Please upload an image file (JPG, PNG)')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('Photo must be under 5MB')
      return
    }
    setUploadProgress(0)
    try {
      const ext = file.name.split('.').pop() ?? 'jpg'
      const storagePath = `students/${student.id}/photo.${ext}`
      const storageRef = ref(storage, storagePath)
      const task = uploadBytesResumable(storageRef, file)

      await new Promise<void>((resolve, reject) => {
        task.on(
          'state_changed',
          (snap) => {
            const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100)
            setUploadProgress(pct)
          },
          reject,
          resolve,
        )
      })

      const url = await getDownloadURL(storageRef)
      await updateDoc(doc(db, 'students', student.id), { photoUrl: url })
      showToast('Photo updated! Your ID card now shows your photo.')
      refreshStudent()
    } catch (err) {
      console.error('[MyId] photo upload', err)
      showToast('Upload failed — please try again')
    } finally {
      setUploadProgress(null)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleDownload() {
    setDownloading(true)
    try {
      await downloadIDCard('student-id-card', effectiveStudent.name ?? 'student')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      {toast && (
        <div className="fixed bottom-6 right-4 z-50 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}

      <div>
        <h1 className="font-jakarta text-2xl font-bold text-[#0D1B2A] dark:text-white">
          My Student ID Card
        </h1>
        <p className="mt-1 text-sm text-[#5A6A7A] dark:text-white/50">
          Download your official Epic Campus ID
        </p>
      </div>

      {/* ID Card preview */}
      <div className="flex justify-center rounded-xl bg-[#F5F7FB] dark:bg-white/[0.04] p-6 sm:p-8">
        <div id="student-id-card">
          <StudentIDCard {...cardProps} />
        </div>
      </div>

      {/* Photo upload section */}
      <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-5">
        <h2 className="font-jakarta font-bold text-[#0B3D6B] dark:text-white mb-1">
          Profile Photo
        </h2>
        <p className="text-sm text-[#5A6A7A] dark:text-white/50 mb-4">
          {student?.photoUrl
            ? 'Your photo is showing on the ID card above. Upload a new one to replace it.'
            : 'Upload your photo to appear on your ID card. Use a clear front-facing photo.'}
        </p>

        {student?.photoUrl && (
          <div className="mb-4 flex items-center gap-3">
            <img
              src={student.photoUrl}
              alt="Profile"
              className="h-16 w-16 rounded-full object-cover border-2 border-[#E8A020]"
            />
            <div>
              <p className="text-sm font-medium text-[#0D1B2A] dark:text-white">
                Photo uploaded
              </p>
              <p className="text-xs text-[#5A6A7A] dark:text-white/50">
                Showing on your ID card
              </p>
            </div>
          </div>
        )}

        {uploadProgress !== null && (
          <div className="mb-3">
            <div className="mb-1 flex justify-between text-xs text-[#5A6A7A] dark:text-white/50">
              <span>Uploading…</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#DDE3EC] dark:bg-white/10">
              <div
                className="h-full rounded-full bg-[#E8A020] transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        <button
          type="button"
          disabled={uploadProgress !== null}
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-2 rounded-xl border-2 border-dashed border-[#DDE3EC] dark:border-white/20 px-5 py-3 text-sm font-semibold text-[#0B3D6B] dark:text-white hover:border-[#E8A020] hover:bg-[#F5F7FB] dark:hover:bg-white/[0.04] disabled:opacity-50 transition-all w-full justify-center"
        >
          <span className="ti ti-camera text-lg" />
          {uploadProgress !== null
            ? `Uploading ${uploadProgress}%…`
            : student?.photoUrl
              ? 'Change Photo'
              : 'Upload Photo'}
        </button>

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void handlePhotoUpload(file)
          }}
        />

        <p className="mt-2 text-center text-xs text-[#5A6A7A] dark:text-white/40">
          JPG, PNG or WebP · Max 5MB · Front-facing photo recommended
        </p>
      </div>

      {/* Download button */}
      <button
        type="button"
        onClick={handleDownload}
        disabled={downloading}
        className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-[#E8A020] text-base font-bold text-[#0B3D6B] hover:bg-[#d4911c] disabled:opacity-60"
      >
        <span className="ti ti-download" aria-hidden="true" />
        {downloading ? 'Preparing download…' : 'Download ID Card'}
      </button>

      <p className="text-center text-xs text-[#5A6A7A] dark:text-white/40">
        Your QR code can be scanned for quick check-in
      </p>
    </div>
  )
}
