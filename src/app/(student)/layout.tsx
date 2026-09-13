'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import {
  doc,
  getDoc,
} from 'firebase/firestore'
import toast from 'react-hot-toast'
import { auth, db } from '@/lib/firebase/client'
import { loadStudentProfile } from '@/lib/students/loadStudentProfile'
import { getBatchAccountSettings, isLockedRoute, resolveAccountActivation } from '@/lib/access/accountActivation'
import StudentSidebar from '@/components/student/StudentSidebar'
import StudentBottomNav from '@/components/student/StudentBottomNav'
import StudentTopBar from '@/components/student/StudentTopBar'
import {
  StudentContext,
  type StudentPortalStatus,
} from '@/components/student/StudentContext'
import type { EpicUser, Student } from '@/types'

function PortalLoadingScreen() {
  return (
    <div className="flex h-screen flex-col items-center justify-center bg-[#eef2f7] dark:bg-[#080d18] px-6 transition-colors duration-300">
      <div className="mb-8 flex items-center justify-center rounded-xl bg-[#0B3D6B] px-6 py-4">
        <img
          src="/images/logo-transparent.png"
          alt="Epic Campus"
          className="h-14 w-auto"
        />
      </div>
      <div
        className="h-12 w-12 animate-spin rounded-full border-4 border-[#0B3D6B]/20 border-t-[#0B3D6B]"
        role="status"
        aria-label="Loading"
      />
      <p className="mt-6 font-jakarta text-base font-semibold text-[#0B3D6B]">
        Loading your portal…
      </p>
      <p className="mt-1 font-inter text-sm text-[#5A6A7A]">Please wait a moment</p>
    </div>
  )
}

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  // Dark mode is managed by useDarkMode hook via localStorage
  const [user, setUser] = useState<EpicUser | null>(null)
  const [student, setStudent] = useState<Student | null>(null)
  const [status, setStatus] = useState<StudentPortalStatus>('idle')
  const [isAccountActive, setIsAccountActive] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [refreshToken, setRefreshToken] = useState(0)
  const lockNoticeShownFor = useRef<string | null>(null)

  const refreshStudent = useCallback(() => {
    setStatus('idle')
    setUser(null)
    setStudent(null)
    setIsAccountActive(false)
    setRefreshToken((t) => t + 1)
  }, [])

  useEffect(() => {
    let cancelled = false

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (cancelled) return

      if (!firebaseUser) {
        router.replace('/login')
        return
      }

      try {
        const userSnap = await getDoc(doc(db, 'users', firebaseUser.uid))
        if (cancelled) return

        if (!userSnap.exists()) {
          router.replace('/login')
          return
        }

        const data = userSnap.data()
        const role = String(data.role ?? '')

        if (role !== 'student') {
          router.replace('/dashboard')
          return
        }

        setStatus('loading')

        const epicUser: EpicUser = {
          uid: firebaseUser.uid,
          email: String(data.email ?? firebaseUser.email ?? ''),
          displayName: String(data.displayName ?? firebaseUser.displayName ?? ''),
          role: 'student',
          branchId: data.branchId ? String(data.branchId) : undefined,
          studentId: data.studentId ? String(data.studentId) : undefined,
          createdAt:
            data.createdAt?.toDate?.()?.toISOString?.() ?? new Date().toISOString(),
        }

        const profile = await loadStudentProfile(firebaseUser.uid, {
          studentId: epicUser.studentId,
          email: epicUser.email || firebaseUser.email || undefined,
        })

        if (cancelled) return

        setUser(epicUser)
        if (!profile) {
          console.error('[StudentLayout] Profile load failed for authenticated student:', firebaseUser.uid)
          setStatus('profile_unavailable')
          return
        }

        const batchSettings = profile.batchId ? await getBatchAccountSettings(profile.batchId) : null
        if (cancelled) return

        setStudent(profile)
        setIsAccountActive(resolveAccountActivation(profile, batchSettings))
        setStatus('ready')
      } catch (err) {
        if (!cancelled) {
          console.error('[StudentLayout] Auth/profile error:', err)
          setStatus('loading')
        }
      }
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [router, refreshToken])

  // Route guard — the actual security boundary for the Account Activation gate.
  // Greyed-out nav only prevents casual clicks; an inactive student typing a
  // locked URL directly must still be bounced back to Epic Wall on mount.
  useEffect(() => {
    if (status !== 'ready' || isAccountActive) return
    if (!isLockedRoute(pathname)) return
    if (lockNoticeShownFor.current !== pathname) {
      lockNoticeShownFor.current = pathname
      toast.error('Your account is not activated yet — contact your teacher.')
    }
    router.replace('/epic-wall')
  }, [status, isAccountActive, pathname, router])

  if (status === 'loading') {
    return <PortalLoadingScreen />
  }

  if (status !== 'ready' || !user || !student) {
    return <PortalLoadingScreen />
  }

  // Block rendering of the locked page's own content while the redirect above
  // fires, so an inactive student never even mounts (or triggers data fetches
  // from) a gated route by typing its URL directly.
  if (!isAccountActive && isLockedRoute(pathname)) {
    return <PortalLoadingScreen />
  }

  const enrollmentType = student.enrollmentType ?? 'residential'
  // Residential/'both' students keep today's row shell (sidebar + column)
  // byte-for-byte — only 'online' switches to a stacked column so the top
  // bar StudentSidebar renders for them spans the full width naturally
  // instead of being squeezed into a row's sidebar slot.
  const shellClassName = `flex h-screen overflow-hidden bg-[#eef2f7] dark:bg-[#080d18] text-[#0D1B2A] dark:text-white/90 transition-colors duration-300 font-['DM_Sans']${
    enrollmentType === 'online' ? ' flex-col' : ''
  }`

  return (
    <StudentContext.Provider
      value={{
        user,
        student,
        status,
        isAccountActive,
        enrollmentType,
        sidebarOpen,
        setSidebarOpen,
        refreshStudent,
      }}
    >
      <div className={shellClassName}>
        <StudentSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <StudentTopBar />
          <main className="flex-1 overflow-y-auto bg-[#eef2f7] dark:bg-[#080d18] p-4 pb-28 sm:p-6 md:pb-6 transition-colors duration-300">
            {children}
          </main>
        </div>
        <StudentBottomNav />
      </div>
    </StudentContext.Provider>
  )
}
