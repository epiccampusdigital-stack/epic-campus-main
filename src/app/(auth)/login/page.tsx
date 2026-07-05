'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  type User,
} from 'firebase/auth'
import { doc, getDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore'
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
import Link from 'next/link'

function getRedirectPath(role: string): string {
  switch (role) {
    case 'student':
      return '/epic-wall'
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
    case 'kitchen':
      return '/kitchen/dashboard'
    case 'agent':
      return '/agent/commissions'
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

interface SignInResult {
  redirectPath: string
  role: string
  phone: string
  uid: string
  displayName: string
}

async function completeSignIn(user: User): Promise<SignInResult> {
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

    // Refresh ID token so Firestore security rules receive updated custom claims
    await user.getIdToken(true)

    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid))
    const userData = userDoc.exists() ? userDoc.data() : {}
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

    return {
      redirectPath: getRedirectPath(role),
      role: String(role),
      phone: String(userData.phone ?? ''),
      uid: user.uid,
      displayName: String(userData.displayName ?? user.displayName ?? 'Staff'),
    }
  } catch (err) {
    console.error('[login] Firestore user lookup failed:', err)
    throw new Error(
      err instanceof Error
        ? err.message
        : 'Could not load user profile from Firestore',
    )
  }
}

const STAFF_ROLES = ['admin', 'owner', 'teacher', 'reception', 'accountant', 'examCoordinator', 'kitchen']

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loadingGoogle, setLoadingGoogle] = useState(false)
  const [loadingEmail, setLoadingEmail] = useState(false)
  const [showReset, setShowReset] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [googleUser, setGoogleUser] = useState<User | null>(null)
  const [showRoleSelect, setShowRoleSelect] = useState(false)
  const [twoFactorRequired, setTwoFactorRequired] = useState(false)
  const [twoFactorCode, setTwoFactorCode] = useState('')
  const [twoFactorUserId, setTwoFactorUserId] = useState('')
  const [twoFactorRole, setTwoFactorRole] = useState('')
  const [twoFactorPhone, setTwoFactorPhone] = useState('')
  const [twoFactorName, setTwoFactorName] = useState('')
  const [twoFactorError, setTwoFactorError] = useState('')
  const [twoFactorLoading, setTwoFactorLoading] = useState(false)
  const [pendingRedirect, setPendingRedirect] = useState('')

  const isLoading = loadingGoogle || loadingEmail

  async function handleVerify2FA() {
    if (!twoFactorCode || twoFactorCode.length !== 6) {
      setTwoFactorError('Please enter the 6-digit code')
      return
    }
    setTwoFactorLoading(true)
    setTwoFactorError('')
    try {
      const res = await fetch('/api/twilio/verify-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: twoFactorUserId, code: twoFactorCode }),
      })
      const data = await res.json() as { success?: boolean; error?: string }
      if (data.success) {
        router.push(pendingRedirect)
      } else {
        setTwoFactorError(data.error ?? 'Invalid code. Please try again.')
      }
    } catch {
      setTwoFactorError('Something went wrong. Please try again.')
    } finally {
      setTwoFactorLoading(false)
    }
  }

  async function handleGoogleSignIn() {
    setError('')
    setLoadingGoogle(true)
    try {
      const result = await signInWithPopup(auth, googleProvider)
      const userDoc = await getDoc(doc(db, 'users', result.user.uid))
      if (userDoc.exists()) {
        const info = await completeSignIn(result.user)
        router.push(info.redirectPath)
      } else {
        setGoogleUser(result.user)
        setShowRoleSelect(true)
      }
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
      const info = await completeSignIn(result.user)

      if (STAFF_ROLES.includes(info.role) && info.phone) {
        await fetch('/api/twilio/send-2fa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: info.uid,
            phone: info.phone,
            name: info.displayName,
          }),
        })
        setTwoFactorUserId(info.uid)
        setTwoFactorRole(info.role)
        setTwoFactorPhone(info.phone)
        setTwoFactorName(info.displayName)
        setPendingRedirect(info.redirectPath)
        setTwoFactorRequired(true)
        return
      }

      router.push(info.redirectPath)
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

  if (twoFactorRequired) return (
    <div className="flex min-h-screen items-center justify-center bg-[#F5F7FB] p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0B3D6B]">
            <span className="ti ti-shield-check text-2xl text-[#E8A020]" />
          </div>
          <h1 className="font-jakarta text-2xl font-bold text-[#0B3D6B]">2-Step Verification</h1>
          <p className="mt-1 text-sm text-[#5A6A7A]">We sent a 6-digit code to your WhatsApp</p>
        </div>

        <div className="rounded-2xl border border-[#DDE3EC] bg-white p-6 space-y-4">
          <div>
            <label className="mb-2 block text-xs font-bold uppercase text-[#5A6A7A] tracking-wider">
              Verification Code
            </label>
            <input
              type="number"
              maxLength={6}
              value={twoFactorCode}
              onChange={e => { setTwoFactorCode(e.target.value.slice(0, 6)); setTwoFactorError('') }}
              onKeyDown={e => e.key === 'Enter' && void handleVerify2FA()}
              placeholder="000000"
              className="w-full rounded-xl border-2 border-[#DDE3EC] bg-[#F5F7FB] px-4 py-4 text-center font-mono text-3xl font-black text-[#0B3D6B] outline-none focus:border-[#E8A020] tracking-[0.5em]"
              autoFocus
            />
          </div>

          {twoFactorError && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {twoFactorError}
            </div>
          )}

          <button
            type="button"
            disabled={twoFactorCode.length !== 6 || twoFactorLoading}
            onClick={() => void handleVerify2FA()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#E8A020] py-3.5 text-sm font-bold text-[#0B3D6B] disabled:opacity-40"
          >
            {twoFactorLoading
              ? <><span className="ti ti-loader animate-spin" /> Verifying...</>
              : <><span className="ti ti-arrow-right" /> Verify & Login</>
            }
          </button>

          <button
            type="button"
            onClick={async () => {
              await fetch('/api/twilio/send-2fa', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: twoFactorUserId, phone: twoFactorPhone, name: twoFactorName }),
              })
            }}
            className="w-full text-center text-xs text-[#5A6A7A] hover:text-[#0B3D6B]"
          >
            Didn&apos;t receive it? Resend code
          </button>

          <button
            type="button"
            onClick={() => { setTwoFactorRequired(false); setTwoFactorCode('') }}
            className="w-full text-center text-xs text-[#5A6A7A] hover:text-[#0B3D6B]"
          >
            ← Back to login
          </button>
        </div>
      </div>
    </div>
  )

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
      <div
        className="relative flex w-full flex-col items-center justify-center overflow-hidden bg-[#eef2f7] dark:bg-[#080d18] px-4 py-8 lg:w-1/2 lg:px-12 transition-colors duration-300"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(11,61,107,0.06) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      >
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

              <div className="-mt-3 mb-4">
                <button
                  type="button"
                  onClick={() => setShowReset(true)}
                  className="text-xs text-[#0B3D6B] dark:text-blue-300 hover:underline mt-1 block text-right"
                >
                  Forgot password?
                </button>
              </div>

              <GoldSubmitButton
                loading={loadingEmail}
                disabled={isLoading}
                loadingText="Signing in..."
              >
                Sign in
              </GoldSubmitButton>

              <p className="mt-6 text-sm">
                <span className="text-gray-600">Already a student? </span>
                <Link href="/signup" className="font-semibold text-[#E8A020] hover:underline">
                  Create your account →
                </Link>
              </p>
            </form>
          </div>

          <p className="mt-6 text-center text-xs text-[#5A6A7A]/60 dark:text-white/25">
            epiccampus.live
          </p>
        </div>
      </div>

      {showReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowReset(false)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="font-jakarta font-bold text-[#0B3D6B] mb-2">Reset Password</h2>
            {resetSent ? (
              <div className="text-center py-4">
                <span className="ti ti-mail-check text-4xl text-emerald-500" />
                <p className="mt-2 text-sm text-[#5A6A7A]">Reset link sent to {resetEmail}</p>
                <button
                  type="button"
                  onClick={() => {
                    setShowReset(false)
                    setResetSent(false)
                  }}
                  className="mt-4 w-full rounded-xl bg-[#E8A020] py-2.5 text-sm font-bold text-[#0B3D6B]"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <p className="text-sm text-[#5A6A7A] mb-4">Enter your email and we&apos;ll send you a reset link.</p>
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full rounded-xl border border-[#DDE3EC] px-4 py-3 text-sm outline-none focus:border-[#E8A020]"
                />
                <div className="mt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowReset(false)}
                    className="flex-1 rounded-xl border border-[#DDE3EC] py-2.5 text-sm font-semibold text-[#5A6A7A]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!resetEmail.trim()}
                    onClick={async () => {
                      try {
                        await sendPasswordResetEmail(auth, resetEmail.trim())
                        setResetSent(true)
                      } catch (err) {
                        console.error('[ResetPassword]', err)
                      }
                    }}
                    className="flex-1 rounded-xl bg-[#E8A020] py-2.5 text-sm font-bold text-[#0B3D6B] disabled:opacity-40"
                  >
                    Send Reset Link
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showRoleSelect && googleUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#0B3D6B]/10">
              <span className="ti ti-user-question text-3xl text-[#0B3D6B]" />
            </div>
            <h2 className="font-jakarta font-bold text-[#0B3D6B]">Welcome to Epic Campus</h2>
            <p className="mt-1 text-sm text-[#5A6A7A]">How would you like to join?</p>
            <div className="mt-5 space-y-3">
              <button
                type="button"
                onClick={async () => {
                  await addDoc(collection(db, 'pendingApprovals'), {
                    uid: googleUser.uid,
                    email: googleUser.email,
                    displayName: googleUser.displayName,
                    photoUrl: googleUser.photoURL,
                    requestedRole: 'student',
                    status: 'pending',
                    createdAt: serverTimestamp(),
                  })
                  await signOut(auth)
                  setShowRoleSelect(false)
                  setGoogleUser(null)
                  alert('Your request has been sent to the admin. You will receive access once approved.')
                }}
                className="flex w-full items-center gap-3 rounded-xl border-2 border-[#DDE3EC] p-4 hover:border-[#E8A020]"
              >
                <span className="ti ti-school text-2xl text-[#0B3D6B]" />
                <div className="text-left">
                  <p className="font-bold text-[#0B3D6B]">Join as Student</p>
                  <p className="text-xs text-[#5A6A7A]">Enrol in courses and track your progress</p>
                </div>
              </button>
              <button
                type="button"
                onClick={async () => {
                  await addDoc(collection(db, 'pendingApprovals'), {
                    uid: googleUser.uid,
                    email: googleUser.email,
                    displayName: googleUser.displayName,
                    photoUrl: googleUser.photoURL,
                    requestedRole: 'staff',
                    status: 'pending',
                    createdAt: serverTimestamp(),
                  })
                  await signOut(auth)
                  setShowRoleSelect(false)
                  setGoogleUser(null)
                  alert('Your staff request has been sent to the admin for approval.')
                }}
                className="flex w-full items-center gap-3 rounded-xl border-2 border-[#DDE3EC] p-4 hover:border-[#E8A020]"
              >
                <span className="ti ti-briefcase text-2xl text-[#0B3D6B]" />
                <div className="text-left">
                  <p className="font-bold text-[#0B3D6B]">Join as Staff</p>
                  <p className="text-xs text-[#5A6A7A]">Access staff portal after admin approval</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
