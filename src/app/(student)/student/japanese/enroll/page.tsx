'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase/client'
import { useStudentPortal } from '@/components/student/StudentContext'
import { resolveStudentAccess } from '@/lib/access/studentAccess'
import { SRI_LANKA_DISTRICTS } from '@/lib/constants/districts'
import PayPalPayment from '@/components/payments/PayPalPayment'
import type { JpCourse, JpOrder, JpOrderRail, JpSettings } from '@/types'

// See src/app/(student)/student/japanese/page.tsx for why this is hard-coded.
const JP_COURSE_ID = 'jft-foundation'

type Step = 'delivery' | 'summary' | 'rail'

async function authedJson<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await auth.currentUser?.getIdToken()
  const headers = new Headers(init?.headers)
  headers.set('Authorization', `Bearer ${token ?? ''}`)
  const res = await fetch(path, { ...init, headers })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string })?.error ?? `Request failed (${res.status})`)
  return data as T
}

const inputClasses =
  'w-full rounded-lg border border-[#DDE3EC] bg-white px-3 py-2 font-inter text-sm text-[#0D1B2A] focus:border-[#1A6BAD] focus:outline-none dark:border-white/10 dark:bg-slate-900 dark:text-white'
const labelClasses = 'font-inter text-xs font-medium uppercase tracking-wide text-[#5A6A7A] dark:text-white/50'
const cardClasses = 'rounded-xl border border-[#DDE3EC] bg-white p-5 dark:border-white/10 dark:bg-slate-800'

function Spinner() {
  return (
    <div className="flex h-40 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#0B3D6B] border-t-[#E8A020]" />
    </div>
  )
}

export default function JapaneseEnrollPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, student } = useStudentPortal()

  const [loading, setLoading] = useState(true)
  const [alreadyEnrolled, setAlreadyEnrolled] = useState(false)
  const [course, setCourse] = useState<JpCourse | null>(null)
  const [settings, setSettings] = useState<JpSettings | null>(null)

  const [step, setStep] = useState<Step>('delivery')
  const [deliveryName, setDeliveryName] = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [deliveryDistrict, setDeliveryDistrict] = useState('')
  const [deliveryPhone, setDeliveryPhone] = useState('')
  const [collectAtCampus, setCollectAtCampus] = useState(false)

  const [creatingOrder, setCreatingOrder] = useState<JpOrderRail | null>(null)
  const [order, setOrder] = useState<JpOrder | null>(null)

  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [uploadingReceipt, setUploadingReceipt] = useState(false)
  const [receiptSubmitted, setReceiptSubmitted] = useState(false)

  const [awaitingWebhook, setAwaitingWebhook] = useState(false)

  const load = useCallback(async () => {
    if (!student || !user) return
    setLoading(true)
    try {
      const access = await resolveStudentAccess(student, user)
      if (access.hasActiveJpEnrollment) {
        setAlreadyEnrolled(true)
        return
      }

      const [courseSnap, settingsResult] = await Promise.all([
        getDoc(doc(db, 'jpCourses', JP_COURSE_ID)),
        authedJson<{ settings: JpSettings }>('/api/jp/settings'),
      ])
      setCourse(courseSnap.exists() ? { id: courseSnap.id, ...(courseSnap.data() as Omit<JpCourse, 'id'>) } : null)
      setSettings(settingsResult.settings)

      setDeliveryName(student.name ?? '')
      setDeliveryAddress(student.deliveryAddress ?? student.address ?? '')
      setDeliveryDistrict(student.deliveryDistrict ?? '')
      setDeliveryPhone(student.deliveryPhone ?? student.mobile ?? '')
    } catch (err) {
      console.error('[JapaneseEnrollPage] load', err)
      toast.error('Could not load checkout details.')
    } finally {
      setLoading(false)
    }
  }, [student, user])

  useEffect(() => {
    void load()
  }, [load])

  // Returning from a Stripe redirect — the webhook grants the enrollment
  // asynchronously, so poll briefly for it rather than assuming it's done.
  useEffect(() => {
    if (searchParams.get('paid') !== '1' || !student || !user) return
    setAwaitingWebhook(true)
    let cancelled = false
    let attempts = 0

    async function poll() {
      if (cancelled) return
      attempts += 1
      try {
        const access = await resolveStudentAccess(student!, user!)
        if (access.hasActiveJpEnrollment) {
          router.replace('/student/japanese')
          return
        }
      } catch (err) {
        console.error('[JapaneseEnrollPage] poll access', err)
      }
      if (attempts >= 8 || cancelled) {
        setAwaitingWebhook(false)
        return
      }
      setTimeout(poll, 2000)
    }
    void poll()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, student, user, router])

  const postageLKR = collectAtCampus ? 0 : (settings?.postageFlatLKR ?? 0)
  const courseFeeLKR = course?.priceLKR ?? 0
  const totalLKR = courseFeeLKR + postageLKR

  const deliveryValid = useMemo(() => {
    if (!deliveryName.trim() || !deliveryPhone.trim()) return false
    if (!collectAtCampus && (!deliveryAddress.trim() || !deliveryDistrict.trim())) return false
    return true
  }, [deliveryName, deliveryPhone, deliveryAddress, deliveryDistrict, collectAtCampus])

  async function handleChooseRail(rail: JpOrderRail) {
    setCreatingOrder(rail)
    try {
      const { order: created } = await authedJson<{ order: JpOrder }>('/api/jp/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: JP_COURSE_ID,
          deliveryName: deliveryName.trim(),
          deliveryAddress: collectAtCampus ? '' : deliveryAddress.trim(),
          deliveryDistrict: collectAtCampus ? '' : deliveryDistrict.trim(),
          deliveryPhone: deliveryPhone.trim(),
          collectAtCampus,
          rail,
        }),
      })
      setOrder(created)

      if (rail === 'stripe') {
        const origin = window.location.origin
        const data = await authedJson<{ url?: string; error?: string }>('/api/stripe/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: created.totalLKR,
            currency: 'lkr',
            studentId: student?.id,
            studentName: student?.name,
            description: 'EPIC Campus — JFT Foundation (Japanese Online)',
            successUrl: `${origin}/student/japanese/enroll?paid=1`,
            cancelUrl: `${origin}/student/japanese/enroll?cancelled=1`,
            metadata: { jpOrderId: created.id },
          }),
        })
        if (data.url) {
          window.location.href = data.url
          return
        }
        throw new Error(data.error ?? 'Could not start Stripe checkout')
      }
    } catch (err) {
      console.error('[JapaneseEnrollPage] create order', err)
      toast.error(err instanceof Error ? err.message : 'Could not start checkout.')
      setOrder(null)
    } finally {
      setCreatingOrder(null)
    }
  }

  async function handleUploadReceipt() {
    if (!receiptFile || !order || !user) return
    setUploadingReceipt(true)
    try {
      const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage')
      const { storage } = await import('@/lib/firebase/client')
      const storageRef = ref(storage, `payment-receipts/${user.uid}/${Date.now()}-${receiptFile.name}`)
      await uploadBytes(storageRef, receiptFile)
      const downloadUrl = await getDownloadURL(storageRef)

      await authedJson('/api/jp/orders/bank-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id, receiptUploadPath: downloadUrl }),
      })
      setReceiptSubmitted(true)
      toast.success('Receipt submitted — reception will verify it shortly.')
    } catch (err) {
      console.error('[JapaneseEnrollPage] upload receipt', err)
      toast.error(err instanceof Error ? err.message : 'Could not submit receipt.')
    } finally {
      setUploadingReceipt(false)
    }
  }

  if (loading || awaitingWebhook) {
    return (
      <div className="space-y-4">
        <Spinner />
        {awaitingWebhook && (
          <p className="text-center font-inter text-sm text-[#5A6A7A] dark:text-white/50">
            Confirming your payment…
          </p>
        )}
      </div>
    )
  }

  if (alreadyEnrolled) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#DDE3EC] text-center dark:border-white/10">
        <span className="ti ti-circle-check text-3xl text-emerald-500" aria-hidden="true" />
        <p className="font-jakarta text-lg font-bold text-[#0B3D6B] dark:text-white">You&apos;re already enrolled</p>
        <Link href="/student/japanese" className="font-inter text-sm text-[#1A6BAD] hover:underline">
          Go to your course →
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-jakarta text-2xl font-bold text-[#0B3D6B] dark:text-white">
          Enroll — {course?.title ?? 'JFT Foundation'}
        </h1>
        <p className="mt-1 font-inter text-sm text-[#5A6A7A] dark:text-white/60">{course?.level}</p>
      </div>

      <div className="flex items-center gap-2">
        {(['delivery', 'summary', 'rail'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full font-jakarta text-xs font-bold ${
                step === s
                  ? 'bg-[#E8A020] text-[#0B3D6B]'
                  : 'bg-[#DDE3EC] text-[#5A6A7A] dark:bg-white/10 dark:text-white/50'
              }`}
            >
              {i + 1}
            </div>
            {i < 2 && <div className="h-px w-8 bg-[#DDE3EC] dark:bg-white/10" />}
          </div>
        ))}
      </div>

      {step === 'delivery' && (
        <div className={cardClasses}>
          <p className="font-jakarta text-sm font-bold text-[#0B3D6B] dark:text-white">Delivery details</p>
          <div className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <label className={labelClasses}>Full name</label>
              <input
                type="text"
                value={deliveryName}
                onChange={(e) => setDeliveryName(e.target.value)}
                className={inputClasses}
              />
            </div>

            <label className="flex items-center gap-2 font-inter text-sm text-[#0D1B2A] dark:text-white">
              <input
                type="checkbox"
                checked={collectAtCampus}
                onChange={(e) => setCollectAtCampus(e.target.checked)}
                className="h-4 w-4 rounded border-[#DDE3EC]"
              />
              I&apos;ll collect my study pack at the campus day instead
            </label>

            {!collectAtCampus && (
              <>
                <div className="space-y-1.5">
                  <label className={labelClasses}>Address</label>
                  <textarea
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    rows={2}
                    className={inputClasses}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className={labelClasses}>District</label>
                  <select
                    value={deliveryDistrict}
                    onChange={(e) => setDeliveryDistrict(e.target.value)}
                    className={inputClasses}
                  >
                    <option value="">Select district…</option>
                    {SRI_LANKA_DISTRICTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <label className={labelClasses}>Phone</label>
              <input
                type="tel"
                value={deliveryPhone}
                onChange={(e) => setDeliveryPhone(e.target.value)}
                className={inputClasses}
              />
            </div>
          </div>

          <button
            type="button"
            disabled={!deliveryValid}
            onClick={() => setStep('summary')}
            className="mt-5 rounded-lg bg-[#E8A020] px-4 py-2 font-jakarta text-sm font-bold text-[#0B3D6B] hover:bg-[#F5B942] disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      )}

      {step === 'summary' && (
        <div className={cardClasses}>
          <p className="font-jakarta text-sm font-bold text-[#0B3D6B] dark:text-white">Order summary</p>
          <div className="mt-4 space-y-2 font-inter text-sm">
            <div className="flex justify-between text-[#0D1B2A] dark:text-white">
              <span>Course fee</span>
              <span>LKR {courseFeeLKR.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-[#0D1B2A] dark:text-white">
              <span>Postage{collectAtCampus ? ' (collecting at campus)' : ''}</span>
              <span>LKR {postageLKR.toLocaleString()}</span>
            </div>
            <div className="flex justify-between border-t border-[#DDE3EC] pt-2 font-jakarta text-base font-bold text-[#0B3D6B] dark:border-white/10 dark:text-white">
              <span>Total (one payment)</span>
              <span>LKR {totalLKR.toLocaleString()}</span>
            </div>
          </div>
          <div className="mt-5 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setStep('delivery')}
              className="font-inter text-xs text-[#5A6A7A] hover:text-[#0B3D6B] dark:text-white/50"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={() => setStep('rail')}
              className="ml-auto rounded-lg bg-[#E8A020] px-4 py-2 font-jakarta text-sm font-bold text-[#0B3D6B] hover:bg-[#F5B942]"
            >
              Choose payment method
            </button>
          </div>
        </div>
      )}

      {step === 'rail' && (
        <div className="space-y-4">
          {!order && (
            <div className={cardClasses}>
              <p className="font-jakarta text-sm font-bold text-[#0B3D6B] dark:text-white">
                Pay LKR {totalLKR.toLocaleString()}
              </p>
              <div className="mt-4 space-y-3">
                <button
                  type="button"
                  disabled={creatingOrder !== null}
                  onClick={() => void handleChooseRail('stripe')}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0B3D6B] py-3 font-jakarta text-sm font-bold text-white hover:bg-[#0a3660] disabled:opacity-50"
                >
                  <span className="ti ti-credit-card" aria-hidden="true" />
                  {creatingOrder === 'stripe' ? 'Redirecting…' : 'Card (Stripe)'}
                </button>

                <button
                  type="button"
                  disabled={creatingOrder !== null}
                  onClick={() => void handleChooseRail('bank_transfer')}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#1A6BAD] py-3 font-jakarta text-sm font-bold text-[#1A6BAD] hover:bg-[#1A6BAD]/10 disabled:opacity-50"
                >
                  <span className="ti ti-building-bank" aria-hidden="true" />
                  {creatingOrder === 'bank_transfer' ? 'Preparing…' : 'Bank transfer'}
                </button>

                <div className="rounded-lg border border-dashed border-[#DDE3EC] p-3 dark:border-white/10">
                  <p className="font-inter text-xs font-semibold text-[#0B3D6B] dark:text-white">
                    Paying from abroad?
                  </p>
                  <button
                    type="button"
                    disabled={creatingOrder !== null}
                    onClick={() => void handleChooseRail('paypal')}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-[#FFC439] py-3 font-jakarta text-sm font-black text-[#003087] disabled:opacity-50"
                  >
                    {creatingOrder === 'paypal' ? 'Preparing…' : 'PayPal'}
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStep('summary')}
                className="mt-4 font-inter text-xs text-[#5A6A7A] hover:text-[#0B3D6B] dark:text-white/50"
              >
                ← Back
              </button>
            </div>
          )}

          {order && order.rail === 'paypal' && (
            <div className={cardClasses}>
              <PayPalPayment
                amount={order.totalLKR}
                currency="LKR"
                description="EPIC Campus — JFT Foundation (Japanese Online)"
                extraCaptureFields={{ jpOrderId: order.id }}
                onSuccess={() => {
                  toast.success('Payment received!')
                  router.replace('/student/japanese')
                }}
                onCancel={() => setOrder(null)}
                onError={(err) => {
                  console.error('[JapaneseEnrollPage] paypal', err)
                  toast.error('PayPal payment failed.')
                }}
              />
            </div>
          )}

          {order && order.rail === 'bank_transfer' && (
            <div className={cardClasses}>
              {receiptSubmitted ? (
                <div className="text-center">
                  <span className="ti ti-circle-check text-3xl text-emerald-500" aria-hidden="true" />
                  <p className="mt-2 font-jakarta text-sm font-bold text-[#0B3D6B] dark:text-white">
                    Receipt submitted
                  </p>
                  <p className="mt-1 font-inter text-sm text-[#5A6A7A] dark:text-white/60">
                    Reception will verify your payment and your course will unlock shortly.
                  </p>
                  <Link href="/student/japanese" className="mt-3 inline-block font-inter text-sm text-[#1A6BAD] hover:underline">
                    Back to course →
                  </Link>
                </div>
              ) : (
                <>
                  <p className="font-jakarta text-sm font-bold text-[#0B3D6B] dark:text-white">Bank transfer details</p>
                  <div className="mt-3 space-y-1.5 rounded-lg bg-[#F5F7FB] p-4 font-inter text-sm dark:bg-white/5">
                    <div className="flex justify-between">
                      <span className="text-[#5A6A7A] dark:text-white/50">Bank</span>
                      <span className="font-semibold text-[#0D1B2A] dark:text-white">{settings?.bankName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#5A6A7A] dark:text-white/50">Account name</span>
                      <span className="font-semibold text-[#0D1B2A] dark:text-white">{settings?.bankAccountName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#5A6A7A] dark:text-white/50">Account no.</span>
                      <span className="font-mono font-bold text-[#0B3D6B] dark:text-blue-300">
                        {settings?.bankAccountNumber}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#5A6A7A] dark:text-white/50">Branch</span>
                      <span className="font-semibold text-[#0D1B2A] dark:text-white">{settings?.bankBranch}</span>
                    </div>
                    <div className="flex justify-between border-t border-[#DDE3EC] pt-1.5 dark:border-white/10">
                      <span className="text-[#5A6A7A] dark:text-white/50">Reference (write this on your slip)</span>
                      <span className="font-mono font-bold text-[#E8A020]">{order.paymentRef}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#5A6A7A] dark:text-white/50">Amount</span>
                      <span className="font-semibold text-[#0D1B2A] dark:text-white">
                        LKR {order.totalLKR.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 space-y-1.5">
                    <label className={labelClasses}>Upload your transfer slip (photo/PDF)</label>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
                      className="w-full font-inter text-xs text-[#5A6A7A] dark:text-white/50"
                    />
                  </div>

                  <button
                    type="button"
                    disabled={!receiptFile || uploadingReceipt}
                    onClick={() => void handleUploadReceipt()}
                    className="mt-4 rounded-lg bg-[#E8A020] px-4 py-2 font-jakarta text-sm font-bold text-[#0B3D6B] hover:bg-[#F5B942] disabled:opacity-50"
                  >
                    {uploadingReceipt ? 'Uploading…' : 'Submit receipt'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
