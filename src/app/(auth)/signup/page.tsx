'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithPopup,
  type User,
} from 'firebase/auth'
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { auth, googleProvider, db } from '@/lib/firebase/client'
import { COURSES } from '@/lib/constants/courses'
import type { CourseId, Role } from '@/types'
import {
  AuthPageBackground,
  AuthCard,
  AuthBrandHeader,
  AuthHeading,
  GoogleButton,
  EmailDivider,
  BottomBorderInput,
  BottomBorderPassword,
  BottomBorderSelect,
  GoldSubmitButton,
  AuthBottomLink,
  AuthSiteFooter,
  AuthErrorBanner,
} from '@/components/auth/AuthShell'

const MOBILE_REGEX = /^(\+94|0)[0-9]{9}$/
const NIC_REGEX = /^[a-zA-Z0-9]{9,}$/
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface FieldErrors {
  fullName?: string
  nic?: string
  mobile?: string
  email?: string
  password?: string
  confirmPassword?: string
  courseInterest?: string
  batch?: string
  regNumber?: string
}

function getSubmitError(code: string): string {
  switch (code) {
    case 'auth/email-already-in-use':
      return 'An account with this email already exists'
    case 'auth/weak-password':
      return 'Password must be at least 8 characters'
    default:
      return 'Registration failed. Please try again'
  }
}

function getRedirectPath(role: string): string {
  switch (role) {
    case 'student':
      return '/my-dashboard'
    case 'examCoordinator':
      return '/exams'
    default:
      return '/dashboard'
  }
}

async function completeGoogleSignIn(user: User): Promise<string> {
  const token = await user.getIdToken()
  const res = await fetch('/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  })
  if (!res.ok) throw new Error('Session creation failed')
  const userDoc = await getDoc(doc(db, 'users', user.uid))
  const role: Role | string = userDoc.exists() ? (userDoc.data().role as Role) : 'student'
  return getRedirectPath(role)
}

export default function SignupPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [nic, setNic] = useState('')
  const [mobile, setMobile] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [courseInterest, setCourseInterest] = useState('')
  const [batch, setBatch] = useState('')
  const [regNumber, setRegNumber] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [submitError, setSubmitError] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingGoogle, setLoadingGoogle] = useState(false)

  const isLoading = loading || loadingGoogle

  function validate(): FieldErrors {
    const errors: FieldErrors = {}

    if (!fullName.trim()) errors.fullName = 'Full name is required'
    if (!nic.trim()) {
      errors.nic = 'NIC / Passport number is required'
    } else if (!NIC_REGEX.test(nic.trim())) {
      errors.nic = 'NIC must be at least 9 alphanumeric characters'
    }
    if (!mobile.trim()) {
      errors.mobile = 'Mobile number is required'
    } else if (!MOBILE_REGEX.test(mobile.trim())) {
      errors.mobile = 'Enter a valid Sri Lankan number (+94 or 0 prefix)'
    }
    if (!email.trim()) {
      errors.email = 'Email is required'
    } else if (!EMAIL_REGEX.test(email.trim())) {
      errors.email = 'Enter a valid email address'
    }
    if (!password) {
      errors.password = 'Password is required'
    } else if (password.length < 8) {
      errors.password = 'Password must be at least 8 characters'
    }
    if (!confirmPassword) {
      errors.confirmPassword = 'Please confirm your password'
    } else if (confirmPassword !== password) {
      errors.confirmPassword = 'Passwords do not match'
    }
    if (!courseInterest) errors.courseInterest = 'Please select a course'
    if (!batch.trim()) errors.batch = 'Batch / intake is required'

    return errors
  }

  async function handleGoogleSignIn() {
    setSubmitError('')
    setLoadingGoogle(true)
    try {
      const result = await signInWithPopup(auth, googleProvider)
      const path = await completeGoogleSignIn(result.user)
      router.push(path)
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? ''
      if (code !== 'auth/popup-closed-by-user') {
        setSubmitError('Sign in failed. Please try again')
      }
    } finally {
      setLoadingGoogle(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError('')

    const errors = validate()
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setLoading(true)
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email.trim(), password)
      await updateProfile(user, { displayName: fullName.trim() })

      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: email.trim(),
        displayName: fullName.trim(),
        role: 'student',
        createdAt: serverTimestamp(),
      })

      await setDoc(doc(db, 'students', user.uid), {
        uid: user.uid,
        name: fullName.trim(),
        nic: nic.trim().toUpperCase(),
        mobile: mobile.trim(),
        courseId: courseInterest as CourseId,
        batchId: batch.trim(),
        registrationNumber: regNumber.trim() || null,
        branchId: 'galle-main',
        registrationFee: 0,
        status: 'pending',
        visaStatus: 'not-started',
        createdAt: serverTimestamp(),
        createdBy: user.uid,
      })

      const token = await user.getIdToken()
      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })

      if (!res.ok) {
        throw new Error('Session creation failed')
      }

      router.push('/my-dashboard')
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? ''
      setSubmitError(getSubmitError(code))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthPageBackground>
      <AuthCard>
        <AuthBrandHeader />
        <AuthHeading title="Create your account" subtitle="Join Epic Campus today" />

        {submitError && <AuthErrorBanner message={submitError} />}

        <GoogleButton
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          loading={loadingGoogle}
        />

        <EmailDivider />

        <form onSubmit={handleSubmit}>
          <BottomBorderInput
            id="fullName"
            label="Full Name"
            autoComplete="name"
            value={fullName}
            onChange={setFullName}
            disabled={isLoading}
            error={fieldErrors.fullName}
          />

          <BottomBorderInput
            id="nic"
            label="NIC / Passport No."
            value={nic}
            onChange={setNic}
            disabled={isLoading}
            error={fieldErrors.nic}
          />

          <BottomBorderInput
            id="mobile"
            label="Mobile Number"
            type="tel"
            autoComplete="tel"
            placeholder="+94 77 000 0000"
            value={mobile}
            onChange={setMobile}
            disabled={isLoading}
            error={fieldErrors.mobile}
          />

          <BottomBorderInput
            id="email"
            label="Email Address"
            type="email"
            autoComplete="email"
            value={email}
            onChange={setEmail}
            disabled={isLoading}
            error={fieldErrors.email}
          />

          <BottomBorderPassword
            id="password"
            label="Password"
            autoComplete="new-password"
            value={password}
            onChange={setPassword}
            disabled={isLoading}
            error={fieldErrors.password}
            show={showPassword}
            onToggleShow={() => setShowPassword((v) => !v)}
          />

          <BottomBorderPassword
            id="confirmPassword"
            label="Confirm Password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            disabled={isLoading}
            error={fieldErrors.confirmPassword}
            show={showConfirmPassword}
            onToggleShow={() => setShowConfirmPassword((v) => !v)}
          />

          <BottomBorderSelect
            id="courseInterest"
            label="Course Interest"
            value={courseInterest}
            onChange={setCourseInterest}
            disabled={isLoading}
            error={fieldErrors.courseInterest}
          >
            <option value="">Select a course</option>
            {COURSES.map((course) => (
              <option key={course.id} value={course.id}>
                {course.label} {course.flag}
              </option>
            ))}
          </BottomBorderSelect>

          <BottomBorderInput
            id="batch"
            label="Batch / Intake"
            placeholder="e.g. 2026-June"
            value={batch}
            onChange={setBatch}
            disabled={isLoading}
            error={fieldErrors.batch}
          />

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Registration Number{' '}
              <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={regNumber}
              onChange={(e) => setRegNumber(e.target.value)}
              placeholder="e.g. REG-2024-001"
              className="w-full border-b border-gray-300 bg-transparent py-2 px-0 text-sm font-medium focus:border-[#E8A020] focus:outline-none"
            />
          </div>

          <GoldSubmitButton
            loading={loading}
            disabled={isLoading}
            loadingText="Creating account..."
          >
            Create account
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
