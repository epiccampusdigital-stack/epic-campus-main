'use client'

import { useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useStudentPortal } from '@/components/student/StudentContext'
import { doc, updateDoc } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '@/lib/firebase/client'
import { getInitials } from '@/lib/students/helpers'
import DarkModeToggle from '@/components/ui/DarkModeToggle'

const PAGE_TITLES: Record<string, string> = {
  '/my-dashboard': 'My Dashboard',
  '/my-id': 'My ID Card',
  '/my-payments': 'My Payments',
  '/my-results': 'My Results',
  '/my-materials': 'Study Materials',
  '/my-visa': 'Visa Tracking',
}

export default function StudentTopBar() {
  const pathname = usePathname()
  const { student, setSidebarOpen, refreshStudent } = useStudentPortal()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [editName, setEditName] = useState(student?.name ?? '')
  const [editPhone, setEditPhone] = useState(student?.mobile ?? '')
  const [editAddress, setEditAddress] = useState(student?.address ?? '')
  const [saveMsg, setSaveMsg] = useState('')

  const pageTitle = PAGE_TITLES[pathname] ?? 'Student Portal'

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !student) return
    setUploadingPhoto(true)
    try {
      const storageRef = ref(storage, `students/${student.id}/photo_${Date.now()}`)
      await uploadBytes(storageRef, file)
      const url = await getDownloadURL(storageRef)
      await updateDoc(doc(db, 'students', student.id), { photoUrl: url })
      refreshStudent()
      setSaveMsg('Photo updated!')
      setTimeout(() => setSaveMsg(''), 3000)
    } catch (err) {
      console.error(err)
      setSaveMsg('Photo upload failed')
    } finally {
      setUploadingPhoto(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleSaveProfile() {
    if (!student) return
    setSaving(true)
    try {
      await updateDoc(doc(db, 'students', student.id), {
        name: editName.trim() || student.name,
        mobile: editPhone.trim() || null,
        address: editAddress.trim() || null,
      })
      refreshStudent()
      setSaveMsg('Profile updated successfully!')
      setTimeout(() => {
        setSaveMsg('')
        setProfileOpen(false)
      }, 1500)
    } catch (err) {
      console.error(err)
      setSaveMsg('Failed to save - try again')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <header className="flex h-[52px] shrink-0 items-center justify-between border-b border-white/80 dark:border-white/[0.05] bg-white/70 dark:bg-[#080d18]/75 backdrop-blur-xl px-4 sticky top-0 z-50 transition-all duration-300 sm:px-6">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 text-[#0B3D6B] dark:text-white/70 hover:bg-[#0B3D6B]/[0.06] dark:hover:bg-white/[0.06] md:hidden transition-colors duration-200"
            aria-label="Open menu"
          >
            <span className="ti ti-menu-2 text-xl" aria-hidden="true" />
          </button>
          <h1 className="font-jakarta text-[15px] font-semibold text-[#0D1B2A] dark:text-white/90">{pageTitle}</h1>
        </div>

        <div className="flex items-center gap-2">
          <DarkModeToggle />
          {student && (
            <button
              type="button"
              onClick={() => {
                setEditName(student?.name ?? '')
                setEditPhone(student?.mobile ?? '')
                setEditAddress(student?.address ?? '')
                setSaveMsg('')
                setProfileOpen(true)
              }}
              className="flex items-center gap-2 ml-1 rounded-lg p-1 hover:bg-[#0B3D6B]/[0.06] dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
            >
              <div className="hidden text-right sm:block">
                <p className="text-[12px] font-medium text-[#0D1B2A] dark:text-white/90 leading-tight">{student.name}</p>
                <p className="text-[11px] text-[#5A6A7A] dark:text-white/40 leading-tight">{student.studentCode}</p>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0B3D6B] text-[11px] font-bold text-white overflow-hidden">
                {student.photoUrl ? (
                  <img
                    src={student.photoUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  getInitials(student.name)
                )}
              </div>
            </button>
          )}
        </div>
      </header>

      {profileOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
            onClick={() => setProfileOpen(false)}
          />
          {/* Panel */}
          <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col bg-white dark:bg-[#0D1B2A] shadow-2xl transition-transform duration-300">
            {/* Panel header */}
            <div className="flex items-center justify-between border-b border-[#DDE3EC] dark:border-white/[0.08] px-5 py-4">
              <h2 className="font-jakarta font-bold text-[#0B3D6B] dark:text-white">
                Edit Profile
              </h2>
              <button
                type="button"
                onClick={() => setProfileOpen(false)}
                className="rounded-lg p-1.5 text-[#5A6A7A] hover:bg-[#F5F7FB] dark:hover:bg-white/[0.06]"
              >
                <span className="ti ti-x text-lg" />
              </button>
            </div>

            {/* Panel body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Photo section */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  <div className="h-20 w-20 rounded-full bg-[#0B3D6B] flex items-center justify-center text-white text-2xl font-bold overflow-hidden border-4 border-[#E8A020]/30">
                    {student?.photoUrl ? (
                      <img
                        src={student.photoUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      getInitials(student?.name ?? '')
                    )}
                  </div>
                  {uploadingPhoto && (
                    <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                      <span className="ti ti-loader-2 animate-spin text-white" />
                    </div>
                  )}
                </div>
                <label className="cursor-pointer rounded-xl border border-[#DDE3EC] dark:border-white/[0.12] px-4 py-2 text-xs font-semibold text-[#0B3D6B] dark:text-white hover:bg-[#F5F7FB] dark:hover:bg-white/[0.06] transition-colors">
                  <span className="ti ti-camera mr-1.5" />
                  {uploadingPhoto ? 'Uploading…' : 'Change Photo'}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoUpload}
                    disabled={uploadingPhoto}
                  />
                </label>
              </div>

              {/* Name */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#5A6A7A] dark:text-white/50">
                  Full Name
                </label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.06] px-4 py-2.5 text-sm text-[#0D1B2A] dark:text-white outline-none focus:border-[#0B3D6B] dark:focus:border-[#E8A020]"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#5A6A7A] dark:text-white/50">
                  Phone Number
                </label>
                <input
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="e.g. 076 254 8383"
                  className="w-full rounded-xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.06] px-4 py-2.5 text-sm text-[#0D1B2A] dark:text-white outline-none focus:border-[#0B3D6B] dark:focus:border-[#E8A020]"
                />
              </div>

              {/* Address */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#5A6A7A] dark:text-white/50">
                  Address
                </label>
                <textarea
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  rows={3}
                  placeholder="Your address..."
                  className="w-full rounded-xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.06] px-4 py-2.5 text-sm text-[#0D1B2A] dark:text-white outline-none focus:border-[#0B3D6B] dark:focus:border-[#E8A020] resize-none"
                />
              </div>

              {saveMsg && (
                <p className="text-center text-sm font-medium text-emerald-600">
                  {saveMsg}
                </p>
              )}
            </div>

            {/* Panel footer */}
            <div className="border-t border-[#DDE3EC] dark:border-white/[0.08] p-4 flex gap-3">
              <button
                type="button"
                onClick={() => setProfileOpen(false)}
                className="flex-1 rounded-xl border border-[#DDE3EC] py-2.5 text-sm font-medium text-[#5A6A7A]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSaveProfile()}
                disabled={saving}
                className="flex-1 rounded-xl bg-[#E8A020] py-2.5 text-sm font-bold text-[#0B3D6B] disabled:opacity-50 hover:bg-[#d4911c]"
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
