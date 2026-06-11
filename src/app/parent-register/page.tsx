'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { auth } from '@/lib/firebase/client'
import {
  AuthPageBackground,
  AuthCard,
  AuthBrandHeader,
  AuthHeading,
  BottomBorderInput,
  BottomBorderPassword,
  GoldSubmitButton,
  AuthBottomLink,
  AuthSiteFooter,
  AuthErrorBanner,
} from '@/components/auth/AuthShell'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function ParentRegisterPage() {
  const router = useRouter()
  const [parentName, setParentName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [accessCode, setAccessCode] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!parentName.trim()) {
      setError('Please enter your name')
      return
    }
    if (!EMAIL_REGEX.test(email.trim())) {
      setError('Please enter a valid email address')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    const code = accessCode.replace(/\D/g, '')
    if (code.length !== 6) {
      setError('Student access code must be 6 digits')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/parent/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentName: parentName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          password,
          accessCode: code,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Registration failed')
        return
      }

      const credential = await signInWithEmailAndPassword(
        auth,
        email.trim().toLowerCase(),
        password,
      )
      const token = await credential.user.getIdToken()
      const sessionRes = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      if (!sessionRes.ok) {
        throw new Error('Could not start session')
      }

      router.replace('/parent/dashboard')
    } catch (err) {
      console.error('[ParentRegister]', err)
      setError('Invalid code. Please check with your student\'s campus.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthPageBackground>
      <AuthCard>
        <AuthBrandHeader />
        <AuthHeading
          title="Parent / Guardian Access"
          subtitle="Link to your child's Epic Campus student record"
        />

        {error && <AuthErrorBanner message={error} />}

        <form onSubmit={(e) => void handleSubmit(e)}>
          <BottomBorderInput
            id="parentName"
            label="Your name"
            value={parentName}
            onChange={setParentName}
            disabled={loading}
            autoComplete="name"
          />
          <BottomBorderInput
            id="email"
            label="Email address"
            type="email"
            value={email}
            onChange={setEmail}
            disabled={loading}
            autoComplete="email"
          />
          <BottomBorderInput
            id="phone"
            label="Phone number"
            type="tel"
            value={phone}
            onChange={setPhone}
            disabled={loading}
            autoComplete="tel"
          />
          <BottomBorderPassword
            id="password"
            label="Password (min 8 characters)"
            value={password}
            onChange={setPassword}
            show={showPassword}
            onToggleShow={() => setShowPassword((v) => !v)}
            disabled={loading}
            autoComplete="new-password"
          />
          <BottomBorderInput
            id="accessCode"
            label="Student access code (6 digits)"
            value={accessCode}
            onChange={(v) => setAccessCode(v.replace(/\D/g, '').slice(0, 6))}
            disabled={loading}
            placeholder="000000"
          />

          <p className="font-inter text-xs leading-relaxed text-[#5A6A7A]">
            Get the 6-digit code from Epic Campus staff on your child&apos;s student profile.
          </p>

          <GoldSubmitButton
            loading={loading}
            disabled={loading}
            loadingText="Creating account..."
          >
            Create parent account
          </GoldSubmitButton>

          <AuthBottomLink
            text="Already have an account?"
            linkText="Sign in"
            href="/login"
          />
        </form>
      </AuthCard>
      <AuthSiteFooter />
    </AuthPageBackground>
  )
}
