'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore'
import { auth, db } from '@/lib/firebase/client'
import { parseStudent } from '@/lib/students/helpers'
import StudentSidebar from '@/components/student/StudentSidebar'
import StudentTopBar from '@/components/student/StudentTopBar'
import { StudentContext } from '@/components/student/StudentContext'
import type { EpicUser, Student } from '@/types'

async function loadStudentProfile(
  uid: string,
  studentId?: string,
): Promise<Student | null> {
  if (studentId) {
    const snap = await getDoc(doc(db, 'students', studentId))
    if (snap.exists()) {
      return parseStudent(snap.id, snap.data() as Record<string, unknown>)
    }
  }

  const byUid = await getDocs(query(collection(db, 'students'), where('uid', '==', uid)))
  if (!byUid.empty) {
    const d = byUid.docs[0]
    return parseStudent(d.id, d.data() as Record<string, unknown>)
  }

  return null
}

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [user, setUser] = useState<EpicUser | null>(null)
  const [student, setStudent] = useState<Student | null>(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [refreshToken, setRefreshToken] = useState(0)

  const refreshStudent = useCallback(() => {
    setRefreshToken((t) => t + 1)
  }, [])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.replace('/login')
        return
      }

      try {
        const userSnap = await getDoc(doc(db, 'users', firebaseUser.uid))
        if (!userSnap.exists()) {
          router.replace('/login')
          return
        }

        const data = userSnap.data()
        if (data.role !== 'student') {
          router.replace('/login')
          return
        }

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

        const profile = await loadStudentProfile(
          firebaseUser.uid,
          epicUser.studentId,
        )

        if (!profile) {
          router.replace('/login')
          return
        }

        setUser(epicUser)
        setStudent(profile)
      } catch {
        router.replace('/login')
      } finally {
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [router, refreshToken])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F5F7FB]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-[#0B3D6B] border-t-[#E8A020]" />
          <p className="font-inter text-sm text-[#5A6A7A]">Loading your portal…</p>
        </div>
      </div>
    )
  }

  if (!user || !student) return null

  return (
    <StudentContext.Provider
      value={{
        user,
        student,
        loading,
        sidebarOpen,
        setSidebarOpen,
        refreshStudent,
        setRefreshStudent: () => {},
      }}
    >
      <div className="flex h-screen overflow-hidden">
        <StudentSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <StudentTopBar />
          <main className="flex-1 overflow-y-auto bg-[#F5F7FB] p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </StudentContext.Provider>
  )
}
