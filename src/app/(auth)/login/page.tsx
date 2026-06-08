'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  type User,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, googleProvider, db } from '@/lib/firebase/client'
import { logAuditEvent } from '@/lib/audit/helpers'
import type { Role } from '@/types'
import {
  GoogleButton,
  EmailDivider,
  BottomBorderInput,
  BottomBorderPassword,
  GoldSubmitButton,
  AuthBottomLink,
  AuthErrorBanner,
} from '@/components/auth/AuthShell'

function getRedirectPath(role: string): string {
  switch (role) {
    case 'student':
      return '/my-dashboard'
    case 'examCoordinator':
      return '/exams'
    case 'admin':
    case 'owner':
    case 'reception':
    case 'accountant':
    case 'teacher':
      return '/dashboard'
    case 'company':
      return '/company/dashboard'
    case 'parent':
      return '/parent/dashboard'
    default:
      return '/dashboard'
  }
}

function getErrorMessage(code: string): string {
  switch (code) {
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect password'
    case 'auth/user-not-found':
      return 'No account found with this email'
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later'
    default:
      return 'Sign in failed. Please try again'
  }
}

async function completeSignIn(user: User): Promise<string> {
  const token = await user.getIdToken()

  let res: Response
  try {
    res = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
  } catch (err) {
    console.error('[login] Session request failed:', err)
    throw new Error('Could not reach session API. Check your connection.')
  }

  if (!res.ok) {
    let message = `Session creation failed (${res.status})`
    try {
      const data = (await res.json()) as { error?: string }
      if (data.error) message = data.error
    } catch {
      // response body may not be JSON
    }
    console.error('[login] Session API error:', message)
    throw new Error(message)
  }

  try {
    const userDoc = await getDoc(doc(db, 'users', user.uid))
    const role: Role | string = userDoc.exists()
      ? (userDoc.data().role as Role)
      : 'student'

    await logAuditEvent({
      userId: user.uid,
      userEmail: user.email ?? userDoc.data()?.email ?? '',
      userRole: (role as Role) ?? 'student',
      action: 'login',
      entityType: 'auth',
      entityId: user.uid,
      details: 'User signed in',
    })

    return getRedirectPath(role)
  } catch (err) {
    console.error('[login] Firestore user lookup failed:', err)
    throw new Error(
      err instanceof Error
        ? err.message
        : 'Could not load user profile from Firestore',
    )
  }
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loadingGoogle, setLoadingGoogle] = useState(false)
  const [loadingEmail, setLoadingEmail] = useState(false)

  const isLoading = loadingGoogle || loadingEmail

  async function handleGoogleSignIn() {
    setError('')
    setLoadingGoogle(true)
    try {
      const result = await signInWithPopup(auth, googleProvider)
      const path = await completeSignIn(result.user)
      router.push(path)
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? ''
      if (code === 'auth/popup-closed-by-user') return
      if (code) {
        setError(getErrorMessage(code))
      } else if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Sign in failed. Please try again')
      }
    } finally {
      setLoadingGoogle(false)
    }
  }

  async function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoadingEmail(true)
    try {
      const result = await signInWithEmailAndPassword(auth, email, password)
      const path = await completeSignIn(result.user)
      router.push(path)
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? ''
      if (code) {
        setError(getErrorMessage(code))
      } else if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Sign in failed. Please try again')
      }
    } finally {
      setLoadingEmail(false)
    }
  }

  return (
    <div className="flex min-h-screen min-h-[100dvh] overflow-hidden">
      {/* Left panel — navy gradient, desktop only */}
      <div
        className="relative hidden lg:flex lg:w-1/2 flex-col items-center justify-center overflow-hidden px-12"
        style={{ background: 'linear-gradient(135deg, #0B3D6B 0%, #1A6BAD 100%)' }}
      >
        {/* Animated blob */}
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full opacity-25 animate-pulse"
          style={{ background: '#E8A020', filter: 'blur(60px)' }}
        />
        <div
          className="pointer-events-none absolute -bottom-16 -left-16 h-72 w-72 rounded-full opacity-20"
          style={{ background: '#1A6BAD', filter: 'blur(60px)' }}
        />

        <div className="relative z-10 text-center text-white">
          <div className="mb-8 flex items-center justify-center gap-3">
            <img src="/favicon.png" alt="EPIC Campus" className="h-12 w-12 rounded-xl object-cover" />
            <span className="font-jakarta text-2xl font-bold tracking-tight">EPIC Campus</span>
          </div>
          <p className="font-jakarta text-3xl font-semibold leading-tight">We Create Your Future</p>
          <p className="mt-4 max-w-xs text-white/70 text-sm leading-relaxed">
            Sri Lanka&apos;s leading overseas education and employment consultancy.
          </p>
          <div className="mt-10 space-y-4 text-left">
            {[
              { icon: 'ti-award', text: '15+ years of proven results' },
              { icon: 'ti-certificate', text: 'TVEC approved & accredited' },
              { icon: 'ti-chart-line', text: '98% visa success rate' },
            ].map((f) => (
              <div key={f.text} className="flex items-center gap-3">
                <span className={`ti ${f.icon} text-[#E8A020] text-lg`} />
                <span className="text-sm text-white/80">{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex w-full flex-col items-center justify-center bg-[#eef2f7] dark:bg-[#080d18] px-4 py-8 lg:w-1/2 lg:px-12 transition-colors duration-300">
        <div className="w-full max-w-[420px]">
          {/* Mobile logo */}
          <div className="mb-8 flex items-center justify-center gap-2 lg:hidden">
            <img src="/favicon.png" alt="EPIC Campus" className="h-9 w-9 rounded-lg object-cover" />
            <span className="font-jakarta text-xl font-bold text-[#0B3D6B] dark:text-white">EPIC Campus</span>
          </div>

          <div className="rounded-[16px] border border-white/80 dark:border-white/[0.08] bg-white/80 dark:bg-[#0d1a2e]/80 backdrop-blur-2xl shadow-2xl p-8 sm:p-10">
            <h1 className="font-jakarta text-[22px] font-bold text-[#0D1B2A] dark:text-white">
              Welcome back
            </h1>
            <p className="mt-1.5 text-sm text-[#5A6A7A] dark:text-white/50">Sign in to your portal</p>

            {error && <div className="mt-5"><AuthErrorBanner message={error} /></div>}

            <div className="mt-6">
              <GoogleButton
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                loading={loadingGoogle}
              />
            </div>

            <EmailDivider />

            <form onSubmit={handleEmailSignIn}>
              <BottomBorderInput
                id="email"
                label="Email Address"
                type="email"
                autoComplete="email"
                value={email}
                onChange={setEmail}
                disabled={isLoading}
              />

              <BottomBorderPassword
                id="password"
                label="Password"
                autoComplete="current-password"
                value={password}
                onChange={setPassword}
                disabled={isLoading}
                show={showPassword}
                onToggleShow={() => setShowPassword((v) => !v)}
              />

              <GoldSubmitButton
                loading={loadingEmail}
                disabled={isLoading}
                loadingText="Signing in..."
              >
                Sign in
              </GoldSubmitButton>

              <AuthBottomLink
                text="Don't have an account?"
                linkText="Enroll online →"
                href="/enroll"
              />
            </form>
          </div>

          <p className="mt-6 text-center text-xs text-[#5A6A7A]/60 dark:text-white/25">
            epiccampus.live
          </p>
        </div>
      </div>
    </div>
  )
}
