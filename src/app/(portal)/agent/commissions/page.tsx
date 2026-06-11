'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import {
  formatCommissionStatus,
  getCommissionStatusClasses,
  parseAgentCommission,
  type AgentCommissionRecord,
} from '@/lib/commissions/helpers'
import { formatLKR } from '@/lib/payments/helpers'
import { currentMonthKey } from '@/lib/dashboard/helpers'
import { auth } from '@/lib/firebase/client'

type CommissionRow = AgentCommissionRecord & { id: string }

export default function AgentCommissionsPage() {
  const [commissions, setCommissions] = useState<CommissionRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const uid = auth.currentUser?.uid
    if (!uid) return
    setLoading(true)
    try {
      const snap = await getDocs(
        query(collection(db, 'agentCommissions'), where('agentId', '==', uid)),
      )
      setCommissions(
        snap.docs
          .map((d) => parseAgentCommission(d.id, d.data() as Record<string, unknown>))
          .sort((a, b) => b.enrollmentDate.localeCompare(a.enrollmentDate)),
      )
    } catch (err) {
      console.error('[AgentCommissions]', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const monthKey = currentMonthKey()

  const stats = useMemo(() => {
    const pending = commissions
      .filter((c) => c.status === 'pending')
      .reduce((s, c) => s + c.commissionAmount, 0)
    const paid = commissions
      .filter((c) => c.status === 'paid')
      .reduce((s, c) => s + c.commissionAmount, 0)
    const thisMonth = commissions
      .filter((c) => c.status === 'paid' && c.paidAt?.toDate().toISOString().startsWith(monthKey))
      .reduce((s, c) => s + c.commissionAmount, 0)
    return { pending, paid, thisMonth }
  }, [commissions, monthKey])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-jakarta text-2xl font-bold text-[#0D1B2A]">My Commissions</h1>
        <p className="mt-1 text-sm text-[#5A6A7A]">
          Enrollment commissions earned from your referred students
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Pending', value: formatLKR(stats.pending), color: 'text-amber-700' },
          { label: 'Paid this month', value: formatLKR(stats.thisMonth), color: 'text-emerald-700' },
          { label: 'All-time paid', value: formatLKR(stats.paid), color: 'text-[#0B3D6B]' },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-[#DDE3EC] bg-white p-5"
          >
            <p className="text-xs font-medium uppercase text-[#5A6A7A]">{card.label}</p>
            <p className={`mt-2 font-jakarta text-2xl font-bold ${card.color}`}>
              {loading ? '…' : card.value}
            </p>
          </div>
        ))}
      </section>

      {loading ? (
        <div className="h-40 animate-pulse rounded-xl bg-[#DDE3EC]/60" />
      ) : commissions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#DDE3EC] bg-white px-6 py-12 text-center">
          <p className="font-jakarta font-bold text-[#0D1B2A]">No commissions yet</p>
          <p className="mt-2 text-sm text-[#5A6A7A]">
            Commissions appear when registration fees are paid for students assigned to you.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#DDE3EC] bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#DDE3EC] bg-[#F5F7FB]">
                  {['Student', 'Enrollment', 'Amount', 'Status', 'Paid date'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-xs font-semibold uppercase text-[#5A6A7A]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {commissions.map((c) => (
                  <tr key={c.id} className="border-b border-[#DDE3EC]">
                    <td className="px-4 py-3 font-medium">{c.studentName}</td>
                    <td className="px-4 py-3 text-[#5A6A7A]">{c.enrollmentDate}</td>
                    <td className="px-4 py-3 font-semibold">{formatLKR(c.commissionAmount)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${getCommissionStatusClasses(c.status)}`}
                      >
                        {formatCommissionStatus(c.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#5A6A7A]">
                      {c.paidAt
                        ? c.paidAt.toDate().toLocaleDateString('en-GB')
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
