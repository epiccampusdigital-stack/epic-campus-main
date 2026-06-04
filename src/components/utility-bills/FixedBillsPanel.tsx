'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { formatLKR } from '@/lib/utility-bills/helpers'
import {
  buildDefaultFixedBills,
  FIXED_BILL_CATEGORIES,
  fixedBillDocId,
  parseFixedUtilityBill,
  summarizeFixedBills,
  type FixedUtilityBill,
} from '@/lib/utility-bills/fixed-bills'
import type { StudentLocation } from '@/types'
import FixedBillPayModal from './FixedBillPayModal'

interface FixedBillsPanelProps {
  location: StudentLocation
  month: string
}

export default function FixedBillsPanel({ location, month }: FixedBillsPanelProps) {
  const [bills, setBills] = useState<FixedUtilityBill[]>([])
  const [loading, setLoading] = useState(true)
  const [payModalBill, setPayModalBill] = useState<FixedUtilityBill | null>(null)
  const [linkLoading, setLinkLoading] = useState<string | null>(null)
  const [generatedLink, setGeneratedLink] = useState<string | null>(null)
  const [error, setError] = useState('')

  const ensureMonthBills = useCallback(async () => {
    const defaults = buildDefaultFixedBills(location, month)
    for (const template of defaults) {
      const id = fixedBillDocId(location, template.category, month)
      const ref = doc(db, 'fixedUtilityBills', id)
      await setDoc(
        ref,
        {
          ...template,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )
    }
  }, [location, month])

  const loadBills = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      await ensureMonthBills()
      const snap = await getDocs(
        query(
          collection(db, 'fixedUtilityBills'),
          where('location', '==', location),
          where('month', '==', month),
        ),
      )
      const parsed = snap.docs
        .map((d) => parseFixedUtilityBill(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) =>
          FIXED_BILL_CATEGORIES.indexOf(a.category) -
          FIXED_BILL_CATEGORIES.indexOf(b.category),
        )
      setBills(parsed)
    } catch (err) {
      console.error('[FixedBillsPanel]', err)
      setError('Failed to load fixed bills.')
      setBills([])
    } finally {
      setLoading(false)
    }
  }, [ensureMonthBills, location, month])

  useEffect(() => {
    void loadBills()
  }, [loadBills])

  const summary = useMemo(() => summarizeFixedBills(bills), [bills])

  async function updateExpectedAmount(bill: FixedUtilityBill, amount: number) {
    await updateDoc(doc(db, 'fixedUtilityBills', bill.id), {
      expectedAmount: amount,
      updatedAt: serverTimestamp(),
    })
    void loadBills()
  }

  async function toggleUnpaid(bill: FixedUtilityBill, checked: boolean) {
    if (checked) {
      setPayModalBill(bill)
      return
    }
    await updateDoc(doc(db, 'fixedUtilityBills', bill.id), {
      paid: false,
      actualAmount: null,
      paymentDate: null,
      updatedAt: serverTimestamp(),
    })
    void loadBills()
  }

  async function payOnline(bill: FixedUtilityBill) {
    setLinkLoading(bill.id)
    setGeneratedLink(null)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: bill.expectedAmount,
          currency: 'lkr',
          description: `${bill.billName} — ${location} (${month})`,
          successUrl: `${window.location.origin}/utility-bills?location=${location}&month=${month}&paid=${bill.id}`,
          cancelUrl: `${window.location.origin}/utility-bills?location=${location}&month=${month}`,
          metadata: {
            fixedBillId: bill.id,
            billType: 'fixedUtility',
          },
        }),
      })
      const data = (await res.json()) as { url?: string; error?: string }
      if (!res.ok || !data.url) throw new Error(data.error ?? 'Failed to create link')
      setGeneratedLink(data.url)
      await updateDoc(doc(db, 'fixedUtilityBills', bill.id), {
        stripePaymentLinkUrl: data.url,
        updatedAt: serverTimestamp(),
      })
      void loadBills()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Stripe link failed')
    } finally {
      setLinkLoading(null)
    }
  }

  if (loading) {
    return <div className="h-40 animate-pulse rounded-xl bg-[#DDE3EC]" />
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-[#DDE3EC] bg-[#F5F7FB] p-3 dark:border-gray-600 dark:bg-gray-800">
          <p className="text-xs text-[#5A6A7A]">Total fixed bills</p>
          <p className="font-jakarta text-xl font-bold text-[#0B3D6B]">{summary.total}</p>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:bg-emerald-900/20">
          <p className="text-xs text-emerald-800 dark:text-emerald-200">Paid</p>
          <p className="font-jakarta text-xl font-bold text-emerald-700">{summary.paid}</p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:bg-amber-900/20">
          <p className="text-xs text-amber-800 dark:text-amber-200">Unpaid</p>
          <p className="font-jakarta text-xl font-bold text-amber-700">{summary.unpaid}</p>
        </div>
        <div className="rounded-lg border border-[#DDE3EC] bg-white p-3 dark:bg-gray-800">
          <p className="text-xs text-[#5A6A7A]">Amount remaining</p>
          <p className="font-jakarta text-lg font-bold text-[#0D1B2A] dark:text-white">
            {formatLKR(summary.remaining)}
          </p>
        </div>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-[#DDE3EC] bg-white dark:border-gray-600 dark:bg-gray-800">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-[#DDE3EC] bg-[#F5F7FB] dark:bg-gray-900">
              <th className="px-4 py-3 text-xs font-semibold uppercase text-[#5A6A7A]">Paid</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase text-[#5A6A7A]">Bill</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase text-[#5A6A7A]">
                Expected (LKR)
              </th>
              <th className="px-4 py-3 text-xs font-semibold uppercase text-[#5A6A7A]">Status</th>
              <th className="px-4 py-3 text-xs font-semibold uppercase text-[#5A6A7A]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#DDE3EC] dark:divide-gray-600">
            {bills.map((bill) => (
              <tr key={bill.id}>
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={bill.paid}
                    onChange={(e) => void toggleUnpaid(bill, e.target.checked)}
                    className="h-4 w-4 rounded border-[#DDE3EC] text-[#E8A020]"
                  />
                </td>
                <td className="px-4 py-3 font-medium text-[#0D1B2A] dark:text-white">
                  {bill.billName}
                </td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    min="0"
                    defaultValue={bill.expectedAmount}
                    key={`${bill.id}-${bill.expectedAmount}`}
                    onBlur={(e) => {
                      const v = Number(e.target.value)
                      if (v > 0 && v !== bill.expectedAmount) {
                        void updateExpectedAmount(bill, v)
                      }
                    }}
                    className="w-28 rounded border border-[#DDE3EC] px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  />
                </td>
                <td className="px-4 py-3">
                  {bill.paid ? (
                    <span className="text-xs text-emerald-700">
                      Paid {bill.actualAmount != null ? formatLKR(bill.actualAmount) : ''}
                      {bill.paymentDate ? ` · ${bill.paymentDate}` : ''}
                    </span>
                  ) : (
                    <span className="text-xs text-amber-700">Unpaid</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {!bill.paid && (
                      <button
                        type="button"
                        disabled={linkLoading === bill.id}
                        onClick={() => void payOnline(bill)}
                        className="rounded-lg bg-[#0B3D6B] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0a3560] disabled:opacity-60"
                      >
                        {linkLoading === bill.id ? '…' : 'Pay Online'}
                      </button>
                    )}
                    {bill.stripePaymentLinkUrl && (
                      <button
                        type="button"
                        onClick={() => void navigator.clipboard.writeText(bill.stripePaymentLinkUrl!)}
                        className="rounded-lg border border-[#DDE3EC] px-2 py-1 text-xs dark:border-gray-600"
                      >
                        Copy link
                      </button>
                    )}
                    {bill.receiptUrl && (
                      <a
                        href={bill.receiptUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[#0B3D6B] underline"
                      >
                        Receipt
                      </a>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {generatedLink && (
        <p className="text-xs text-[#5A6A7A]">
          Payment link ready — use Copy link on the row or{' '}
          <a href={generatedLink} className="text-[#0B3D6B] underline" target="_blank" rel="noreferrer">
            open
          </a>
        </p>
      )}

      <FixedBillPayModal
        bill={payModalBill}
        open={!!payModalBill}
        onClose={() => setPayModalBill(null)}
        onSaved={loadBills}
      />
    </div>
  )
}
