'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { collection, onSnapshot, query, where, doc } from 'firebase/firestore'
import { signOut, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth'
import { auth, db } from '@/lib/firebase/client'
import { COURSE_MAP } from '@/lib/constants/courses'
import { getCourseBadge } from '@/lib/student/portal'
import { logAuditEvent } from '@/lib/audit/helpers'
import { useStudentPortal } from '@/components/student/StudentContext'
import DarkModeToggle from '@/components/ui/DarkModeToggle'
import { isNavActive } from '@/lib/utils/nav'

function studentNavLinkClasses(active: boolean): string {
  const base = 'flex items-center gap-2 rounded-[9px] px-[10px] py-[8px] text-[12px] transition-all duration-200 min-h-[44px] sm:min-h-0 border-l-2'
  return active
    ? `${base} bg-[#0B3D6B]/8 dark:bg-[#E8A020]/12 border-[#0B3D6B] dark:border-[#E8A020] text-[#0B3D6B] dark:text-white font-bold`
    : `${base} border-transparent text-gray-500 dark:text-white/50 hover:text-[#0B3D6B] dark:hover:text-white hover:bg-[#0B3D6B]/4 dark:hover:bg-white/4`
}

function getStudentInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || 'S'
}

const BASE_NAV_ITEMS = [
  { label: 'Epic Wall', href: '/epic-wall', icon: 'ti-home' },
  { label: 'My Dashboard', href: '/my-dashboard', icon: 'ti-layout-dashboard' },
  { label: 'My Schedule', href: '/my-schedule', icon: 'ti-calendar' },
  { label: 'My ID Card', href: '/my-id', icon: 'ti-id-badge-2' },
  { label: 'My Payments', href: '/my-payments', icon: 'ti-credit-card' },
  { label: 'Pay Online', href: '/student/payments', icon: 'ti-wallet' },
  { label: 'My Results', href: '/my-results', icon: 'ti-certificate' },
  { label: 'My Materials', href: '/my-materials', icon: 'ti-books' },
  { label: 'Messages', href: '/student/messages', icon: 'ti-message' },
  { label: 'AI Study Assistant', href: '/student/assistant', icon: 'ti-robot' },
  { label: 'Book Consultation', href: '/book-consultation', icon: 'ti-calendar' },
  { label: 'My Visa', href: '/my-visa', icon: 'ti-plane' },
]

const EXAM_NAV_ITEM = { label: 'Take Exam', href: '/exams', icon: 'ti-pencil' }
const EXAM_CODE_NAV_ITEM = { label: 'Enter Exam Code', href: '/exam-code', icon: 'ti-lock-open' }

export default function StudentSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, student, sidebarOpen, setSidebarOpen } = useStudentPortal()
  const [mounted, setMounted] = useState(false)
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!student) return
    const docRef = doc(db, 'messages', student.id)
    const unsub = onSnapshot(docRef, (snap: any) => {
      const data = snap.exists() ? (snap.data() as Record<string, any>) : {}
      setUnreadMessages(Number(data.unreadByStudent) || 0)
    }, (err: any) => console.error('[StudentSidebar] messages doc snapshot', err))
    return () => unsub()
  }, [student])

  async function handleLogout() {
    if (user) {
      await logAuditEvent({
        userId: user.uid,
        userEmail: user.email,
        userRole: user.role,
        action: 'logout',
        entityType: 'auth',
        entityId: user.uid,
        details: 'Student signed out',
      })
    }
    await fetch('/api/auth/session', { method: 'DELETE' })
    await signOut(auth)
    router.replace('/login')
  }

  async function handleChangePassword() {
    setPwError('')
    if (!newPassword || newPassword.length < 6) {
      setPwError('New password must be at least 6 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setPwError('Passwords do not match')
      return
    }
    const firebaseUser = auth.currentUser
    if (!firebaseUser || !firebaseUser.email) {
      setPwError('Not authenticated')
      return
    }
    setPwSaving(true)
    try {
      const credential = EmailAuthProvider.credential(firebaseUser.email, currentPassword)
      await reauthenticateWithCredential(firebaseUser, credential)
      await updatePassword(firebaseUser, newPassword)
      setPwSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => {
        setPwSuccess(false)
        setPasswordModalOpen(false)
      }, 2000)
    } catch (err: unknown) {
      const code = (err as { code?: string }).code
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setPwError('Current password is incorrect')
      } else if (code === 'auth/too-many-requests') {
        setPwError('Too many attempts. Please try again later.')
      } else {
        setPwError('Failed to change password. Please try again.')
      }
    } finally {
      setPwSaving(false)
    }
  }

  const courseLabel = student ? getCourseBadge(student.courseId) : ''
  const courseName = student ? (COURSE_MAP[student.courseId]?.label ?? courseLabel) : ''

  const navItems = [...BASE_NAV_ITEMS.slice(0, 1), EXAM_NAV_ITEM, EXAM_CODE_NAV_ITEM, ...BASE_NAV_ITEMS.slice(1)]

  const sidebarContent = (
    <div className="flex h-full w-[240px] flex-col bg-white/95 dark:bg-[#0D0B1E]/95 backdrop-blur-xl border-r border-[#0B3D6B]/8 dark:border-white/[0.06] transition-all duration-300">
      {/* Logo */}
      <div className="px-4 py-4">
        <div className="flex items-center gap-2 px-2 py-1">
          <img src="/favicon.png" alt="EPIC Campus" className="h-7 w-7 rounded-md object-cover" />
          <span className="text-[14px] font-semibold text-[#0B3D6B] dark:text-[#E8A020] transition-colors duration-300">
            EPIC Campus
          </span>
        </div>
      </div>

      <div className="mx-4 border-t border-[#0B3D6B]/10 dark:border-white/[0.06]" />

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
        {navItems.map((item) => {
          const active = isNavActive(pathname, item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={studentNavLinkClasses(active)}
            >
              <span className={`ti ${item.icon} text-[14px] leading-none`} aria-hidden="true" />
              {item.label}
              {item.href === '/student/messages' && unreadMessages > 0 && (
                <span className="ml-auto rounded-full bg-[#E8A020] px-2 py-0.5 text-[10px] font-bold text-[#0B3D6B]">
                  {unreadMessages}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      <div className="mx-4 border-t border-[#0B3D6B]/10 dark:border-white/[0.06]" />

      <div className="p-3">
        {student && (
          <div className="mb-2 flex items-start gap-2 px-1">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#E8A020] to-[#c8891a] text-[11px] font-bold text-white">
              {getStudentInitials(student.name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-medium text-[#0B3D6B] dark:text-white/80">{student.name}</p>
              <span className="mt-0.5 inline-flex max-w-full items-center gap-1 truncate rounded-full bg-[#E8A020]/15 px-2 py-0.5 text-[10px] font-medium text-[#E8A020]">
                <span className="truncate">{courseName || courseLabel}</span>
              </span>
              <button
                type="button"
                onClick={() => setPasswordModalOpen(true)}
                className="mt-1.5 block text-[11px] font-medium text-[#5A6A7A] dark:text-white/40 hover:text-[#0B3D6B] dark:hover:text-white/70"
              >
                🔒 Change Password
              </button>
            </div>
          </div>
        )}
        <div className="flex items-center gap-2 px-1">
          <DarkModeToggle />
          <button
            type="button"
            onClick={handleLogout}
            className="flex flex-1 items-center gap-2 rounded-[9px] px-[10px] py-[8px] text-[12px] font-medium text-gray-500 dark:text-white/45 transition-all duration-200 hover:bg-[#0B3D6B]/[0.06] dark:hover:bg-white/[0.05] hover:text-[#0B3D6B] dark:hover:text-white/70"
          >
            <span className="ti ti-logout text-[14px]" aria-hidden="true" />
            Logout
          </button>
        </div>
      </div>
    </div>
  )

  if (!mounted) return null

  return (
    <>
      <aside className="hidden shrink-0 md:block">{sidebarContent}</aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 transform transition-transform duration-200 md:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </aside>

      {passwordModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setPasswordModalOpen(false); setPwError(''); setPwSuccess(false) }} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white dark:bg-[#0d1a2e] p-6 shadow-2xl">
            <h2 className="font-jakarta font-bold text-[#0B3D6B] dark:text-white mb-1">Change Password</h2>
            <p className="text-xs text-[#5A6A7A] dark:text-white/50 mb-4">{user?.email}</p>

            {pwSuccess ? (
              <div className="text-center py-6">
                <span className="ti ti-circle-check text-5xl text-emerald-500" />
                <p className="mt-2 font-semibold text-emerald-600">Password changed successfully!</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-bold text-[#5A6A7A] dark:text-white/50">Current Password</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    className="w-full rounded-xl border border-[#DDE3EC] dark:border-white/20 bg-[#F5F7FB] dark:bg-white/[0.04] px-4 py-3 text-sm text-[#0D1B2A] dark:text-white outline-none focus:border-[#E8A020]"
                    placeholder="Enter current password"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-[#5A6A7A] dark:text-white/50">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full rounded-xl border border-[#DDE3EC] dark:border-white/20 bg-[#F5F7FB] dark:bg-white/[0.04] px-4 py-3 text-sm text-[#0D1B2A] dark:text-white outline-none focus:border-[#E8A020]"
                    placeholder="Min 6 characters"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold text-[#5A6A7A] dark:text-white/50">Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="w-full rounded-xl border border-[#DDE3EC] dark:border-white/20 bg-[#F5F7FB] dark:bg-white/[0.04] px-4 py-3 text-sm text-[#0D1B2A] dark:text-white outline-none focus:border-[#E8A020]"
                    placeholder="Repeat new password"
                  />
                </div>
                {pwError && (
                  <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                    {pwError}
                  </div>
                )}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => { setPasswordModalOpen(false); setPwError(''); setCurrentPassword(''); setNewPassword(''); setConfirmPassword('') }}
                    className="flex-1 rounded-xl border border-[#DDE3EC] dark:border-white/20 py-3 text-sm font-semibold text-[#5A6A7A] dark:text-white/60"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!currentPassword || !newPassword || !confirmPassword || pwSaving}
                    onClick={() => void handleChangePassword()}
                    className="flex-1 rounded-xl bg-[#E8A020] py-3 text-sm font-bold text-[#0B3D6B] disabled:opacity-40"
                  >
                    {pwSaving ? 'Saving...' : 'Change Password'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
