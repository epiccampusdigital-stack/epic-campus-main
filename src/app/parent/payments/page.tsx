'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { parsePayment } from '@/lib/payments/helpers'
import ParentFeePanel from '@/components/parent/ParentFeePanel'
import { useParentPortal } from '@/components/parent/ParentContext'
import type { Payment } from '@/types'

export default function ParentPaymentsPage() {
  const { student } = useParentPortal()
  const searchParams = useSearchParams()
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)

  const success = searchParams.get('success') === 'true'
  const cancelled = searchParams.get('cancelled') === 'true'

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const snap = await getDocs(
          query(collection(db, 'payments'), where('studentId', '==', student.id)),
        )
        const list = snap.docs
          .map((d) => parsePayment(d.id, d.data() as Record<string, unknown>))
          .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate))
        setPayments(list)
      } catch (err) {
        console.error('[ParentPayments]', err)
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [student.id])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-jakarta text-2xl font-bold text-[#0D1B2A]">Payments</h2>
        <p className="text-sm text-[#5A6A7A]">
          Fee schedule and payment history for {student.name}
        </p>
      </div>

      {success && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Payment successful. Thank you!
        </div>
      )}
      {cancelled && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Payment cancelled. No charge was made.
        </div>
      )}

      <ParentFeePanel payments={payments} loading={loading} />
    </div>
  )
}
