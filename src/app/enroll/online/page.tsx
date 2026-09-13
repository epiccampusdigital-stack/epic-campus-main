'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { onAuthStateChanged, signInWithCustomToken } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase/client'
import PublicNav from '@/components/public/PublicNav'
import PublicFooter from '@/components/public/PublicFooter'

const CHECKOUT_PATH = '/student/japanese/enroll'
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const inputClasses =
  'w-full rounded-xl border border-[#DDE3EC] bg-white px-4 py-3 font-inter text-sm text-[#0D1B2A] outline-none focus:border-[#E8A020] dark:border-white/10 dark:bg-white/[0.04] dark:text-white'
const labelClasses = 'mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300'

export default function EnrollOnlinePage() {
  const router = useRouter()

  // null = still checking; '' = not signed in as a student; otherwise the
  // signed-in student's display name.
  const [existingStudentName, setExistingStudentName] = useState<string | null | ''>(null)
  const [upgrading, setUpgrading] = useState(false)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setExistingStudentName('')
        return
      }
      try {
        const userSnap = await getDoc(doc(db, 'users', user.uid))
        const role = userSnap.exists() ? String(userSnap.data().role ?? '') : ''
        setExistingStudentName(role === 'student' ? user.displayName || 'there' : '')
      } catch (err) {
        console.error('[EnrollOnlinePage] check signed-in user', err)
        setExistingStudentName('')
      }
    })
    return () => unsubscribe()
  }, [])

  async function handleContinueAsExisting() {
    setUpgrading(true)
    setError('')
    try {
      const token = await auth.currentUser?.getIdToken()
      const res = await fetch('/api/enrollment/online-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}` },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error ?? 'Could not add the online course to your account')
      router.push(CHECKOUT_PATH)
    } catch (err) {
      console.error('[EnrollOnlinePage] upgrade', err)
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setUpgrading(false)
    }
  }

  function validate(): string {
    if (!name.trim()) return 'Full name is required'
    if (!email.trim() || !EMAIL_REGEX.test(email.trim())) return 'Enter a valid email address'
    if (!phone.trim()) return 'Phone number is required'
    if (password.length < 6) return 'Password must be at least 6 characters'
    return ''
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/enrollment/online-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), phone: phone.trim(), password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error ?? 'Signup failed. Please try again.')

      const { user } = await signInWithCustomToken(auth, data.customToken)
      const idToken = await user.getIdToken()
      await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: idToken }),
      }).catch(() => {
        // A session-cookie failure shouldn't block checkout — the client SDK
        // sign-in above already succeeded.
      })

      router.push(CHECKOUT_PATH)
    } catch (err) {
      console.error('[EnrollOnlinePage] signup', err)
      setError(err instanceof Error ? err.message : 'Signup failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F7FB] dark:bg-[#130F2A]">
      <PublicNav />
      <main className="mx-auto max-w-xl px-4 py-16 sm:px-6 lg:px-8">
        <Link
          href="/enroll"
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-[#5A6A7A] transition-colors hover:text-[#0B3D6B] dark:text-white/50 dark:hover:text-white"
        >
          <span className="ti ti-arrow-left" /> Back to enroll options
        </Link>

        <div className="rounded-2xl border border-[#DDE3EC] bg-white p-8 dark:border-white/[0.08] dark:bg-white/[0.04]">
          <h1 className="font-jakarta text-[26px] font-black text-[#0B3D6B] dark:text-white">
            Start the JFT Foundation online course
          </h1>
          <p className="mt-1 text-sm text-[#5A6A7A] dark:text-white/50">
            5-month course · LKR 25,000 plus postage · video lessons, printed study pack, one campus day a month.
          </p>

          {existingStudentName === null ? (
            <div className="mt-8 flex justify-center py-6">
              <span className="ti ti-loader-2 animate-spin text-2xl text-[#0B3D6B]" />
            </div>
          ) : existingStudentName ? (
            <div className="mt-8 rounded-xl border border-[#E8A020]/40 bg-[#E8A020]/10 p-5 text-center">
              <p className="font-jakarta text-sm font-bold text-[#0B3D6B] dark:text-white">
                Welcome back, {existingStudentName}
              </p>
              <p className="mt-1 text-sm text-[#5A6A7A] dark:text-white/60">
                You&apos;re already signed in — we&apos;ll add the online course to your existing account rather than
                creating a new one.
              </p>
              {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
              <button
                type="button"
                disabled={upgrading}
                onClick={() => void handleContinueAsExisting()}
                className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-[#E8A020] px-6 py-3 font-jakarta text-sm font-bold text-[#0B3D6B] transition-colors hover:bg-[#F5B942] disabled:opacity-50"
              >
                {upgrading ? 'Continuing…' : 'Continue to checkout'}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
                  {error}
                </div>
              )}

              <div>
                <label className={labelClasses}>Full name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={submitting}
                  className={inputClasses}
                />
              </div>
              <div>
                <label className={labelClasses}>Email</label>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                  className={inputClasses}
                />
              </div>
              <div>
                <label className={labelClasses}>Phone</label>
                <input
                  type="tel"
                  placeholder="+94 77 000 0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={submitting}
                  className={inputClasses}
                />
              </div>
              <div>
                <label className={labelClasses}>Password</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={submitting}
                  className={inputClasses}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-[#E8A020] px-6 py-3.5 font-jakarta text-sm font-bold text-[#0B3D6B] transition-colors hover:bg-[#F5B942] disabled:opacity-50"
              >
                {submitting ? 'Creating your account…' : 'Create account & continue to checkout'}
              </button>

              <p className="text-center text-xs text-[#5A6A7A] dark:text-white/40">
                No staff approval needed — access is granted as soon as payment is confirmed.
              </p>
            </form>
          )}
        </div>
      </main>
      <PublicFooter />
    </div>
  )
}
