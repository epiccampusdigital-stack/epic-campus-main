'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase/client'
import type { EpicUser, Role } from '@/types'

export default function AgentPortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [user, setUser] = useState<EpicUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
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
        if (role !== 'agent') {
          router.replace('/login')
          return
        }
        setUser({
          uid: firebaseUser.uid,
          email: data.email ?? firebaseUser.email ?? '',
          displayName: data.displayName ?? firebaseUser.displayName ?? '',
          role,
          branchId: data.branchId,
          locationAssigned: data.locationAssigned,
          createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? new Date().toISOString(),
        })
      } catch {
        router.replace('/login')
      } finally {
        setLoading(false)
      }
    })
    return () => unsub()
  }, [router])

  async function handleLogout() {
    await fetch('/api/auth/session', { method: 'DELETE' })
    await signOut(auth)
    router.replace('/login')
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#eef2f7]">
        <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-[#0B3D6B] border-t-[#E8A020]" />
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-[#eef2f7]">
      <header className="border-b border-[#DDE3EC] bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/favicon.png" alt="" className="h-8 w-8 rounded-md" />
            <div>
              <p className="font-jakarta text-sm font-bold text-[#0B3D6B]">EPIC Campus</p>
              <p className="text-xs text-[#5A6A7A]">Agent Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-[#5A6A7A] sm:inline">{user.displayName}</span>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="rounded-lg border border-[#DDE3EC] px-3 py-1.5 text-sm font-medium text-[#0B3D6B] hover:bg-[#F5F7FB]"
            >
              Sign out
            </button>
          </div>
        </div>
        <nav className="mx-auto mt-3 flex max-w-5xl gap-4">
          <Link
            href="/agent/commissions"
            className="text-sm font-semibold text-[#0B3D6B] hover:text-[#E8A020]"
          >
            My Commissions
          </Link>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  )
}
