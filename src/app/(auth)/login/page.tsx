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
  AuthPageBackground,
  AuthCard,
  AuthBrandHeader,
  AuthHeading,
  GoogleButton,
  EmailDivider,
  BottomBorderInput,
  BottomBorderPassword,
  GoldSubmitButton,
  AuthBottomLink,
  AuthSiteFooter,
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
    <AuthPageBackground>
      <AuthCard>
        <AuthBrandHeader />
        <AuthHeading title="Welcome back" subtitle="Sign in to continue" />

        {error && <AuthErrorBanner message={error} />}

        <GoogleButton
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          loading={loadingGoogle}
        />

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
            linkText="Create account"
            href="/signup"
          />
        </form>
      </AuthCard>

      <AuthSiteFooter />
    </AuthPageBackground>
  )
}
