'use client'

import { useEffect, useState } from 'react'
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

// TODO: Remove sandbox notice when Twilio live number is activated
const TWILIO_SANDBOX_KEYWORD = process.env.NEXT_PUBLIC_TWILIO_SANDBOX_KEYWORD || 'your-sandbox-keyword'
const RESEND_COOLDOWN_SECONDS = 60

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
  const [resendCooldown, setResendCooldown] = useState(0)
  const [resending, setResending] = useState(false)
  const [showSandboxInfo, setShowSandboxInfo] = useState(true)

  const isLoading = loadingGoogle || loadingEmail

  // Start the resend cooldown as soon as the 2FA screen appears (an OTP was just sent)
  useEffect(() => {
    if (twoFactorRequired) setResendCooldown(RESEND_COOLDOWN_SECONDS)
  }, [twoFactorRequired])

  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

  async function handleResendOTP() {
    if (resendCooldown > 0 || resending) return
    setResending(true)
    setTwoFactorError('')
    try {
      const res = await fetch('/api/twilio/send-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: twoFactorUserId, phone: twoFactorPhone, name: twoFactorName }),
      })
      if (!res.ok) throw new Error('Failed to resend code')
      setResendCooldown(RESEND_COOLDOWN_SECONDS)
    } catch (err) {
      console.error('[login] Resend OTP failed:', err)
      setTwoFactorError('Could not resend the code. Please check your connection and try again.')
    } finally {
      setResending(false)
    }
  }

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

      // TODO: Re-enable 2FA when Twilio live number is activated
      // The send-2fa and verify-2fa API routes are preserved
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

          {/* TODO: Remove sandbox notice when Twilio live number is activated */}
          <div className="rounded-xl border border-yellow-200 bg-yellow-50 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowSandboxInfo((v) => !v)}
              className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-xs font-bold text-yellow-800"
            >
              <span className="flex items-center gap-2">
                <span className="ti ti-info-circle text-sm" />
                Not receiving the code?
              </span>
              <span className={`ti ti-chevron-down text-sm transition-transform ${showSandboxInfo ? 'rotate-180' : ''}`} />
            </button>
            {showSandboxInfo && (
              <div className="border-t border-yellow-200 px-4 pb-3 pt-2 text-xs leading-relaxed text-yellow-800">
                Our WhatsApp messaging is in test mode. To receive codes, please send the message{' '}
                <strong>&quot;join {TWILIO_SANDBOX_KEYWORD}&quot;</strong> to <strong>+1-415-523-8886</strong> on
                WhatsApp first, then request a new OTP.
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={resendCooldown > 0 || resending}
            onClick={() => void handleResendOTP()}
            className="w-full text-center text-xs font-semibold text-[#5A6A7A] hover:text-[#0B3D6B] disabled:opacity-50 disabled:hover:text-[#5A6A7A]"
          >
            {resending
              ? 'Sending...'
              : resendCooldown > 0
                ? `Resend OTP (${resendCooldown}s)`
                : "Didn't receive it? Resend OTP"}
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
    <div className="relative min-h-screen overflow-hidden bg-[#F0F4FA] dark:bg-[#050d1a]">
      {/* Light mode background */}
      <div
        className="pointer-events-none absolute inset-0 dark:hidden"
        style={{ background: 'radial-gradient(ellipse at center, #ffffff 0%, #F0F4FA 100%)' }}
      />
      {/* Dark mode background */}
      <div
        className="pointer-events-none absolute inset-0 hidden dark:block"
        style={{ background: 'radial-gradient(ellipse at center, #0d1f3c 0%, #050d1a 100%)' }}
      />
      {/* Dark mode ambient glows */}
      <div className="pointer-events-none absolute -left-20 top-10 hidden h-[420px] w-[420px] rounded-full bg-[#1A6BAD] opacity-[0.15] blur-3xl dark:block" />
      <div className="pointer-events-none absolute -right-24 top-1/3 hidden h-[380px] w-[380px] rounded-full bg-[#0B3D6B] opacity-[0.15] blur-3xl dark:block" />
      <div className="pointer-events-none absolute bottom-0 left-1/4 hidden h-[360px] w-[360px] rounded-full bg-[#1A6BAD] opacity-[0.15] blur-3xl dark:block" />
      <div className="pointer-events-none absolute bottom-10 right-1/4 hidden h-[300px] w-[300px] rounded-full bg-[#0f4c81] opacity-[0.15] blur-3xl dark:block" />

      <div className="relative z-10 mx-auto grid min-h-screen max-w-5xl grid-cols-1 items-center gap-8 px-4 py-12 sm:px-6 lg:grid-cols-5">
        {/* Left panel — navy gradient, desktop only */}
        <div className="hidden lg:flex lg:col-span-2 flex-col justify-center rounded-2xl bg-gradient-to-br from-[#0B3D6B] to-[#071428] p-10">
          <div className="mb-8">
            <h2 className="font-jakarta text-[32px] font-black text-white leading-tight mb-3">Welcome<br/>back.</h2>
            <p className="text-[14px] text-white/40 leading-relaxed">Access your EPIC Campus portal. Your role determines what you see after login.</p>
          </div>
          <div className="space-y-3">
            {[
              { color: '#E8A020', role: 'Students', desc: 'Exams, schedule, visa tracker and more' },
              { color: '#10b981', role: 'Teachers', desc: 'Sessions, exam papers and attendance' },
              { color: '#1A6BAD', role: 'Admin & Reception', desc: 'Full system management access' },
              { color: '#8b5cf6', role: 'Kitchen Staff', desc: 'Inventory and meal portal' },
            ].map(r => (
              <div key={r.role} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
                <div className="h-2 w-2 shrink-0 rounded-full" style={{ background: r.color }} />
                <div>
                  <p className="text-[12px] font-bold text-white/70">{r.role}</p>
                  <p className="text-[10px] text-white/30">{r.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right panel — login form */}
        <div className="lg:col-span-3">
        <div className="w-full max-w-[420px] mx-auto">
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
