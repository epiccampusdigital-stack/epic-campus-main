'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { parseEnrollment, PROGRAM_LABEL_MAP, formatLKR, formatEnrollmentDate } from '@/lib/enrollment/helpers'
import type { EnrollmentApplication } from '@/types'

function ReceiptRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-2 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-800">{value}</span>
    </div>
  )
}

export default function EnrollmentSuccess({ enrollmentId }: { enrollmentId: string }) {
  const [enrollment, setEnrollment] = useState<EnrollmentApplication | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!enrollmentId) {
      setLoading(false)
      return
    }

    getDoc(doc(db, 'enrollmentApplications', enrollmentId))
      .then((snap) => {
        if (snap.exists()) {
          setEnrollment(parseEnrollment(snap.id, snap.data() as Record<string, unknown>))
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [enrollmentId])

  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <span className="ti ti-loader-2 animate-spin text-3xl text-[#0B3D6B]" />
      </div>
    )
  }

  if (!enrollment) {
    return (
      <div className="text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
          <span className="ti ti-circle-check text-4xl text-emerald-600" />
        </div>
        <h1 className="mt-6 font-jakarta text-3xl font-bold text-[#0B3D6B]">
          Application Received!
        </h1>
        <p className="mt-4 text-gray-600">
          Your enrollment application has been received. Our team will contact you within 24
          hours with the next steps.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex rounded-full bg-[#0B3D6B] px-8 py-3 text-sm font-semibold text-white hover:bg-[#0a3460]"
        >
          Back to Home
        </Link>
      </div>
    )
  }

  const fullName = `${enrollment.firstName} ${enrollment.lastName}`

  return (
    <div>
      <div className="text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
          <span className="ti ti-circle-check text-4xl text-emerald-600" />
        </div>
        <h1 className="mt-6 font-jakarta text-3xl font-bold text-[#0B3D6B]">
          Application Received!
        </h1>
        <p className="mt-3 text-gray-600">
          Thank you, <strong>{enrollment.firstName}</strong>. Your enrollment application is now
          pending approval. Our admissions team will contact you shortly.
        </p>
      </div>

      <div className="mt-8 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-jakarta text-lg font-bold text-[#0B3D6B]">Enrollment Details</h2>
        <div className="divide-y divide-gray-100">
          <ReceiptRow label="Name" value={fullName} />
          <ReceiptRow label="Email" value={enrollment.email} />
          <ReceiptRow label="Program" value={PROGRAM_LABEL_MAP[enrollment.program]} />
          <ReceiptRow
            label="Location"
            value={
              enrollment.location.charAt(0).toUpperCase() + enrollment.location.slice(1)
            }
          />
          <ReceiptRow
            label="Amount Requested"
            value={enrollment.requestedAmount != null ? formatLKR(enrollment.requestedAmount) : 'Pending'}
          />
          {enrollment.paymentOption && (
            <ReceiptRow
              label="Payment Option"
              value={enrollment.paymentOption === 'registration' ? 'Registration only' : enrollment.paymentOption === 'full' ? 'Full payment' : 'Custom amount'}
            />
          )}
          <ReceiptRow label="Reference" value={enrollment.id.slice(0, 12).toUpperCase()} />
          <ReceiptRow label="Date" value={formatEnrollmentDate(enrollment.createdAt)} />
          <ReceiptRow
            label="Application Status"
            value={enrollment.status === 'pending' ? 'Pending approval' : 'Approved'}
          />
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-[#E8A020]/30 bg-[#E8A020]/5 p-5">
        <div className="flex gap-3">
          <span className="ti ti-message-circle text-2xl text-[#E8A020]" />
          <div>
            <p className="font-semibold text-[#0B3D6B]">What happens next?</p>
            <p className="mt-1 text-sm text-gray-600">
              You will receive your login details via <strong>WhatsApp</strong> and{' '}
              <strong>email</strong> within 24 hours. Our team will guide you through the next
              steps.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-4">
        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-xl border border-gray-200 px-6 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          <span className="ti ti-printer" />
          Download Receipt
        </button>
        <Link
          href="/"
          className="flex items-center gap-2 rounded-xl bg-[#0B3D6B] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#0a3460]"
        >
          <span className="ti ti-home" />
          Back to Home
        </Link>
      </div>
    </div>
  )
}
