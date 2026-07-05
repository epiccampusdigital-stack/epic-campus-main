'use client'

import { usePathname } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth'
import { auth } from '@/lib/firebase/client'
import { ROLE_LABELS } from '@/lib/constants/roles'
import { useManagement } from '@/components/layout/ManagementContext'
import DarkModeToggle from '@/components/ui/DarkModeToggle'
import NotificationCenter from '@/components/layout/NotificationCenter'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/students': 'Students',
  '/payments': 'Payments',
  '/attendance': 'Attendance',
  '/staff': 'Staff',
  '/audit-log': 'Audit Log',
  '/reports': 'Reports',
  '/partner-companies': 'Partner Companies',
  '/broadcast': 'WhatsApp Broadcast',
  '/enrollments': 'Online Enrollments',
  '/materials': 'Study Materials',
  '/chat-logs': 'AI Chat Logs',
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'EC'
}

export default function TopBar() {
  const pathname = usePathname()
  const { user, setSidebarOpen } = useManagement()

  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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

  const pageTitle =
    Object.entries(PAGE_TITLES).find(([path]) =>
      pathname === path || pathname.startsWith(`${path}/`)
    )?.[1] ?? 'Epic Campus'

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
        <h1 className="font-jakarta text-[15px] font-semibold text-[#0D1B2A] dark:text-white/90">
          {pageTitle}
        </h1>
      </div>

      <div className="flex items-center gap-2">
        <DarkModeToggle />

        <NotificationCenter />

        {user && (
          <div className="relative ml-1" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setDropdownOpen(o => !o)}
              className="flex items-center gap-2 rounded-xl px-2 py-1 hover:bg-[#0B3D6B]/[0.06] dark:hover:bg-white/[0.06] transition-colors"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0B3D6B] text-[11px] font-bold text-white">
                {getInitials(user.displayName)}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-[12px] font-medium text-[#0D1B2A] dark:text-white/90 leading-tight">
                  {user.displayName}
                </p>
                <p className="text-[11px] text-[#5A6A7A] dark:text-white/40 leading-tight">
                  {ROLE_LABELS[user.role] ?? user.role}
                </p>
              </div>
              <span className="ti ti-chevron-down text-xs text-[#5A6A7A] dark:text-white/40 hidden sm:block" />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-[#0d1a2e] shadow-xl z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-[#DDE3EC] dark:border-white/[0.08]">
                  <p className="text-xs font-bold text-[#0D1B2A] dark:text-white truncate">{user.displayName}</p>
                  <p className="text-[10px] text-[#5A6A7A] dark:text-white/40 truncate">{user.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setDropdownOpen(false); setPasswordModalOpen(true) }}
                  className="flex w-full items-center gap-2 px-4 py-3 text-sm text-[#0D1B2A] dark:text-white hover:bg-[#F5F7FB] dark:hover:bg-white/[0.04] transition-colors"
                >
                  <span className="ti ti-lock text-[#0B3D6B] dark:text-blue-300" />
                  Change Password
                </button>
                <div className="border-t border-[#DDE3EC] dark:border-white/[0.08]">
                  <button
                    type="button"
                    onClick={async () => {
                      const { signOut } = await import('firebase/auth')
                      await signOut(auth)
                      window.location.href = '/login'
                    }}
                    className="flex w-full items-center gap-2 px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <span className="ti ti-logout" />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>

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
