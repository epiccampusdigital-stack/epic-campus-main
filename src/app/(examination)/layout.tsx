'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase/client'
import { EXAM_PORTAL_ROLES } from '@/lib/constants/roles'
import { ExamContext } from '@/components/exam/ExamContext'
import { loadStudentProfile } from '@/lib/students/loadStudentProfile'
import type { EpicUser, Role, Student } from '@/types'

export default function ExaminationLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [user, setUser] = useState<EpicUser | null>(null)
  const [student, setStudent] = useState<Student | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.replace('/login')
        return
      }

      try {
        const snap = await getDoc(doc(db, 'users', firebaseUser.uid))
        if (!snap.exists()) {
          router.replace('/login')
          return
        }

        const data = snap.data()
        const role = data.role as Role

        if (!EXAM_PORTAL_ROLES.includes(role)) {
          router.replace('/dashboard')
          return
        }

        const epicUser: EpicUser = {
          uid: firebaseUser.uid,
          email: String(data.email ?? firebaseUser.email ?? ''),
          displayName: String(data.displayName ?? firebaseUser.displayName ?? ''),
          role,
          branchId: data.branchId ? String(data.branchId) : undefined,
          studentId: data.studentId ? String(data.studentId) : undefined,
          createdAt:
            data.createdAt?.toDate?.()?.toISOString?.() ?? new Date().toISOString(),
        }

        setUser(epicUser)

        if (role === 'student') {
          const profile = await loadStudentProfile(firebaseUser.uid, {
            studentId: epicUser.studentId,
            email: epicUser.email || firebaseUser.email || undefined,
          })
          setStudent(profile)
        } else {
          setStudent(null)
        }
      } catch {
        router.replace('/login')
      } finally {
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [router])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-[#0B3D6B] border-t-[#E8A020]" />
      </div>
    )
  }

  if (!user) return null

  return (
    <ExamContext.Provider value={{ user, student }}>
      <div className="font-['DM_Sans'] min-h-screen bg-[#F5F7FB]">
        {children}
      </div>
    </ExamContext.Provider>
  )
}
