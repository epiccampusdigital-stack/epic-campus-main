'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase/client'
import { parseParentAccount } from '@/lib/parent/helpers'
import { parseStudent } from '@/lib/students/helpers'
import ParentSidebar from '@/components/parent/ParentSidebar'
import {
  ParentContext,
  type ParentPortalStatus,
} from '@/components/parent/ParentContext'
import type { EpicUser, ParentAccount, Student } from '@/types'

function LoadingScreen() {
  return (
    <div className="flex h-screen flex-col items-center justify-center bg-[#F5F7FB] px-6">
      <div className="mb-6 flex items-center justify-center rounded-xl bg-[#0B3D6B] px-6 py-4">
        <img
          src="/images/logo-transparent.png"
          alt="Epic Campus"
          className="h-12 w-auto"
        />
      </div>
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#0B3D6B]/20 border-t-[#0B3D6B]" />
      <p className="mt-6 font-jakarta text-base font-semibold text-[#0B3D6B]">
        Loading parent portal…
      </p>
    </div>
  )
}

function UnavailableScreen() {
  return (
    <div className="flex h-screen items-center justify-center bg-[#F5F7FB] px-6">
      <div className="max-w-md rounded-xl border border-[#DDE3EC] bg-white p-8 text-center">
        <span className="ti ti-alert-circle mb-4 block text-4xl text-[#E8A020]" />
        <h1 className="font-jakarta text-xl font-bold text-[#0D1B2A]">
          Access unavailable
        </h1>
        <p className="mt-2 text-sm text-[#5A6A7A]">
          Your parent account could not be loaded. Please contact Epic Campus.
        </p>
        <a
          href="/login"
          className="mt-6 inline-block rounded-lg bg-[#0B3D6B] px-5 py-2.5 text-sm font-bold text-white"
        >
          Back to login
        </a>
      </div>
    </div>
  )
}

export default function ParentLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [user, setUser] = useState<EpicUser | null>(null)
  const [parent, setParent] = useState<ParentAccount | null>(null)
  const [student, setStudent] = useState<Student | null>(null)
  const [status, setStatus] = useState<ParentPortalStatus>('idle')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [refreshToken, setRefreshToken] = useState(0)

  const refresh = useCallback(() => {
    setRefreshToken((t) => t + 1)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('dark')
    root.classList.add('light')
    root.style.colorScheme = 'light'
    return () => {
      root.style.colorScheme = ''
    }
  }, [])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.replace('/login')
        return
      }

      setStatus('loading')

      try {
        const userSnap = await getDoc(doc(db, 'users', firebaseUser.uid))
        if (!userSnap.exists()) {
          router.replace('/login')
          return
        }

        const data = userSnap.data()
        if (String(data.role) !== 'parent') {
          router.replace('/dashboard')
          return
        }

        const studentId = String(data.studentId ?? '')
        if (!studentId) {
          setStatus('unavailable')
          return
        }

        const [parentSnap, studentSnap] = await Promise.all([
          getDoc(doc(db, 'parentAccounts', firebaseUser.uid)),
          getDoc(doc(db, 'students', studentId)),
        ])

        if (!studentSnap.exists()) {
          setStatus('unavailable')
          return
        }

        const epicUser: EpicUser = {
          uid: firebaseUser.uid,
          email: String(data.email ?? firebaseUser.email ?? ''),
          displayName: String(data.displayName ?? firebaseUser.displayName ?? ''),
          role: 'parent',
          studentId,
          createdAt:
            data.createdAt?.toDate?.()?.toISOString?.() ?? new Date().toISOString(),
        }

        setUser(epicUser)
        setStudent(
          parseStudent(studentSnap.id, studentSnap.data() as Record<string, unknown>),
        )
        setParent(
          parentSnap.exists()
            ? parseParentAccount(
                parentSnap.id,
                parentSnap.data() as Record<string, unknown>,
              )
            : null,
        )
        setStatus('ready')
      } catch {
        setStatus('unavailable')
      }
    })

    return () => unsubscribe()
  }, [router, refreshToken])

  if (status === 'loading' || status === 'idle') {
    return <LoadingScreen />
  }

  if (status === 'unavailable' || !user || !student) {
    return <UnavailableScreen />
  }

  return (
    <ParentContext.Provider
      value={{
        user,
        parent,
        student,
        status,
        sidebarOpen,
        setSidebarOpen,
        refresh,
      }}
    >
      <div className="light flex h-screen overflow-hidden bg-[#F5F7FB] text-[#0D1B2A]">
        <ParentSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <header className="flex items-center gap-3 border-b border-[#DDE3EC] bg-white px-4 py-3 md:hidden">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-2 text-[#0B3D6B] hover:bg-[#F5F7FB]"
              aria-label="Open menu"
            >
              <span className="ti ti-menu-2 text-xl" />
            </button>
            <span className="font-jakarta text-sm font-bold text-[#0B3D6B]">
              Parent Portal
            </span>
          </header>
          <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </ParentContext.Provider>
  )
}
