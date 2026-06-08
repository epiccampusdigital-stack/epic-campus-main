'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ENROLLMENT_PROGRAMS,
  LOCATION_OPTIONS,
  BATCH_OPTIONS,
  REGISTRATION_FEE,
  COURSE_FEE,
  TOTAL_FEE,
  formatLKR,
} from '@/lib/enrollment/helpers'
import type { EnrollmentProgram, StudentLocation, BatchDuration } from '@/types'

interface FormData {
  firstName: string
  lastName: string
  email: string
  phone: string
  dateOfBirth: string
  address: string
  program: EnrollmentProgram | ''
  location: StudentLocation | ''
  batchDuration: BatchDuration | ''
  batchCustomDays: string
  paymentOption: 'registration' | 'full' | 'custom' | ''
  customAmount: string
}

const EMPTY: FormData = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  dateOfBirth: '',
  address: '',
  program: '',
  location: '',
  batchDuration: '',
  batchCustomDays: '',
  paymentOption: '',
  customAmount: '',
}

const STEP_LABELS = ['Personal Details', 'Program Selection', 'Payment']

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-3">
      {Array.from({ length: total }).map((_, i) => {
        const done = i < current
        const active = i === current
        return (
          <div key={i} className="flex items-center gap-3">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition-all ${
                  done
                    ? 'bg-[#0B3D6B] text-white'
                    : active
                      ? 'border-2 border-[#E8A020] bg-white text-[#E8A020]'
                      : 'border-2 border-gray-200 bg-white text-gray-400'
                }`}
              >
                {done ? <span className="ti ti-check text-sm" /> : i + 1}
              </div>
              <span
                className={`hidden text-xs font-medium sm:block ${
                  active ? 'text-[#0B3D6B]' : done ? 'text-gray-600' : 'text-gray-400'
                }`}
              >
                {STEP_LABELS[i]}
              </span>
            </div>
            {i < total - 1 && (
              <div className={`h-px w-10 ${done ? 'bg-[#0B3D6B]' : 'bg-gray-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function FormField({
  label,
  required,
  children,
  error,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
  error?: string
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

const inputCls =
  'w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-[#0B3D6B] focus:ring-2 focus:ring-[#0B3D6B]/10 disabled:bg-gray-50 disabled:text-gray-400'

export default function EnrollmentForm() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<FormData>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({})
  const [loading, setLoading] = useState(false)
  const [apiError, setApiError] = useState('')

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function validateStep0(): boolean {
    const errs: Partial<Record<keyof FormData, string>> = {}
    if (!form.firstName.trim()) errs.firstName = 'First name is required'
    if (!form.lastName.trim()) errs.lastName = 'Last name is required'
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      errs.email = 'Enter a valid email address'
    if (!form.phone.trim()) errs.phone = 'Phone number is required'
    if (!form.dateOfBirth) errs.dateOfBirth = 'Date of birth is required'
    if (!form.address.trim()) errs.address = 'Address is required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function validateStep1(): boolean {
    const errs: Partial<Record<keyof FormData, string>> = {}
    if (!form.program) errs.program = 'Select a program'
    if (!form.location) errs.location = 'Select a campus location'
    if (!form.batchDuration) errs.batchDuration = 'Select a batch duration'
    if (
      form.batchDuration === 'custom' &&
      (!form.batchCustomDays || isNaN(Number(form.batchCustomDays)))
    )
      errs.batchCustomDays = 'Enter number of days'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function validateStep2(): boolean {
    const errs: Partial<Record<keyof FormData, string>> = {}
    if (!form.paymentOption) errs.paymentOption = 'Select a payment option'
    if (form.paymentOption === 'custom') {
      const amt = Number(form.customAmount)
      if (!form.customAmount || isNaN(amt) || amt < 1000) {
        errs.customAmount = 'Enter a valid amount (minimum LKR 1,000)'
      }
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function nextStep() {
    if (step === 0 && !validateStep0()) return
    if (step === 1 && !validateStep1()) return
    setStep((s) => s + 1)
  }

  function getPaymentAmount(): number {
    if (form.paymentOption === 'registration') return REGISTRATION_FEE
    if (form.paymentOption === 'full') return TOTAL_FEE
    return Number(form.customAmount) || 0
  }

  async function handleSubmit() {
    if (!validateStep2()) return
    setApiError('')
    setLoading(true)
    try {
      const phone = form.phone.startsWith('+94') ? form.phone : `+94${form.phone.replace(/^0/, '')}`
      const res = await fetch('/api/enrollment/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          phone,
          dateOfBirth: form.dateOfBirth,
          address: form.address.trim(),
          program: form.program,
          location: form.location,
          batchDuration: form.batchDuration,
          batchCustomDays: form.batchCustomDays ? Number(form.batchCustomDays) : undefined,
          paymentAmount: getPaymentAmount(),
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setApiError(data.error || 'Failed to create checkout session. Please try again.')
        return
      }

      if (data.url) {
        router.push(data.url)
      }
    } catch {
      setApiError('Network error. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <StepIndicator current={step} total={3} />

      <div className="mt-8 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
        {/* Step 0 — Personal Details */}
        {step === 0 && (
          <div className="space-y-5">
            <h2 className="font-jakarta text-xl font-bold text-[#0B3D6B]">Personal Details</h2>
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField label="First Name" required error={errors.firstName}>
                <input
                  className={inputCls}
                  value={form.firstName}
                  onChange={(e) => set('firstName', e.target.value)}
                  placeholder="Kasun"
                  autoComplete="given-name"
                />
              </FormField>
              <FormField label="Last Name" required error={errors.lastName}>
                <input
                  className={inputCls}
                  value={form.lastName}
                  onChange={(e) => set('lastName', e.target.value)}
                  placeholder="Perera"
                  autoComplete="family-name"
                />
              </FormField>
            </div>
            <FormField label="Email Address" required error={errors.email}>
              <input
                className={inputCls}
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                placeholder="kasun@example.com"
                autoComplete="email"
              />
            </FormField>
            <FormField label="Phone Number" required error={errors.phone}>
              <div className="flex overflow-hidden rounded-xl border border-gray-200 focus-within:border-[#0B3D6B] focus-within:ring-2 focus-within:ring-[#0B3D6B]/10">
                <span className="flex items-center border-r border-gray-200 bg-gray-50 px-4 text-sm font-medium text-gray-500">
                  +94
                </span>
                <input
                  className="flex-1 px-4 py-3 text-sm text-gray-900 outline-none"
                  value={form.phone.replace(/^\+94/, '').replace(/^0/, '')}
                  onChange={(e) => set('phone', e.target.value.replace(/\D/g, ''))}
                  placeholder="771234567"
                  autoComplete="tel"
                />
              </div>
            </FormField>
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField label="Date of Birth" required error={errors.dateOfBirth}>
                <input
                  className={inputCls}
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(e) => set('dateOfBirth', e.target.value)}
                  max={new Date().toISOString().slice(0, 10)}
                />
              </FormField>
            </div>
            <FormField label="Address" required error={errors.address}>
              <textarea
                className={inputCls}
                rows={2}
                value={form.address}
                onChange={(e) => set('address', e.target.value)}
                placeholder="No. 59, Galle Road, Galle"
              />
            </FormField>
          </div>
        )}

        {/* Step 1 — Program Selection */}
        {step === 1 && (
          <div className="space-y-6">
            <h2 className="font-jakarta text-xl font-bold text-[#0B3D6B]">Program Selection</h2>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Choose a Program <span className="text-red-500">*</span>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                {ENROLLMENT_PROGRAMS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => set('program', p.id)}
                    className={`flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all ${
                      form.program === p.id
                        ? 'border-[#0B3D6B] bg-[#0B3D6B]/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#0B3D6B]/10 text-[10px] font-bold text-[#0B3D6B]">{p.flag}</span>
                    <div>
                      <p className="font-semibold text-[#0B3D6B]">{p.label}</p>
                      <p className="mt-0.5 text-xs text-gray-500">{p.subtitle}</p>
                    </div>
                  </button>
                ))}
              </div>
              {errors.program && <p className="mt-1 text-xs text-red-600">{errors.program}</p>}
            </div>

            <FormField label="Campus Location" required error={errors.location}>
              <select
                className={inputCls}
                value={form.location}
                onChange={(e) => set('location', e.target.value as StudentLocation)}
              >
                <option value="">Select campus location...</option>
                {LOCATION_OPTIONS.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </FormField>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Batch Duration <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-3">
                {BATCH_OPTIONS.map((b) => (
                  <button
                    key={b.value}
                    type="button"
                    onClick={() => set('batchDuration', b.value)}
                    className={`flex-1 rounded-xl border-2 py-3 text-sm font-medium transition-all ${
                      form.batchDuration === b.value
                        ? 'border-[#0B3D6B] bg-[#0B3D6B]/5 text-[#0B3D6B]'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
              {errors.batchDuration && (
                <p className="mt-1 text-xs text-red-600">{errors.batchDuration}</p>
              )}
              {form.batchDuration === 'custom' && (
                <div className="mt-3">
                  <FormField label="Number of Days" error={errors.batchCustomDays}>
                    <input
                      className={inputCls}
                      type="number"
                      min={1}
                      value={form.batchCustomDays}
                      onChange={(e) => set('batchCustomDays', e.target.value)}
                      placeholder="e.g. 60"
                    />
                  </FormField>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 2 — Payment */}
        {step === 2 && (
          <div className="space-y-6">
            <h2 className="font-jakarta text-xl font-bold text-[#0B3D6B]">Payment</h2>

            <div className="rounded-xl border border-gray-100 bg-[#F5F7FB] p-5">
              <h3 className="mb-3 text-sm font-semibold text-gray-700">Fee Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Registration Fee</span>
                  <span>{formatLKR(REGISTRATION_FEE)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Course Fee</span>
                  <span>{formatLKR(COURSE_FEE)}</span>
                </div>
                <div className="mt-2 flex justify-between border-t border-gray-200 pt-2 font-semibold text-[#0B3D6B]">
                  <span>Total</span>
                  <span>{formatLKR(TOTAL_FEE)}</span>
                </div>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Payment Option <span className="text-red-500">*</span>
              </label>
              <div className="space-y-3">
                {[
                  {
                    value: 'registration' as const,
                    label: 'Pay Registration Fee only',
                    amount: formatLKR(REGISTRATION_FEE),
                  },
                  {
                    value: 'full' as const,
                    label: 'Pay Full Amount',
                    amount: formatLKR(TOTAL_FEE),
                  },
                  {
                    value: 'custom' as const,
                    label: 'Pay Custom Amount',
                    amount: '',
                  },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 px-5 py-4 transition-all ${
                      form.paymentOption === opt.value
                        ? 'border-[#0B3D6B] bg-[#0B3D6B]/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentOption"
                      value={opt.value}
                      checked={form.paymentOption === opt.value}
                      onChange={() => set('paymentOption', opt.value)}
                      className="accent-[#0B3D6B]"
                    />
                    <span className="flex-1 text-sm font-medium text-gray-800">{opt.label}</span>
                    {opt.amount && (
                      <span className="font-semibold text-[#0B3D6B]">{opt.amount}</span>
                    )}
                  </label>
                ))}
              </div>
              {errors.paymentOption && (
                <p className="mt-1 text-xs text-red-600">{errors.paymentOption}</p>
              )}
            </div>

            {form.paymentOption === 'custom' && (
              <FormField label="Custom Amount (LKR)" required error={errors.customAmount}>
                <div className="flex overflow-hidden rounded-xl border border-gray-200 focus-within:border-[#0B3D6B] focus-within:ring-2 focus-within:ring-[#0B3D6B]/10">
                  <span className="flex items-center border-r border-gray-200 bg-gray-50 px-4 text-sm font-medium text-gray-500">
                    LKR
                  </span>
                  <input
                    className="flex-1 px-4 py-3 text-sm text-gray-900 outline-none"
                    type="number"
                    min={1000}
                    value={form.customAmount}
                    onChange={(e) => set('customAmount', e.target.value)}
                    placeholder="Enter amount"
                  />
                </div>
              </FormField>
            )}

            {form.paymentOption && form.paymentOption !== 'custom' && (
              <div className="rounded-xl border border-[#E8A020]/30 bg-[#E8A020]/5 px-5 py-4">
                <p className="text-sm text-gray-700">
                  You will be charged{' '}
                  <strong className="text-[#0B3D6B]">{formatLKR(getPaymentAmount())}</strong> via
                  Stripe secure payment.
                </p>
              </div>
            )}

            {apiError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
                {apiError}
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className={`mt-8 flex gap-4 ${step === 0 ? 'justify-end' : 'justify-between'}`}>
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="flex items-center gap-2 rounded-xl border border-gray-200 px-6 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              <span className="ti ti-arrow-left" />
              Back
            </button>
          )}

          {step < 2 ? (
            <button
              type="button"
              onClick={nextStep}
              className="flex items-center gap-2 rounded-xl bg-[#0B3D6B] px-8 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0a3460]"
            >
              Continue
              <span className="ti ti-arrow-right" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="flex items-center gap-2 rounded-xl bg-[#E8A020] px-8 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#d4911c] disabled:opacity-60"
            >
              {loading ? (
                <>
                  <span className="ti ti-loader-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <span className="ti ti-lock" />
                  Proceed to Payment
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
