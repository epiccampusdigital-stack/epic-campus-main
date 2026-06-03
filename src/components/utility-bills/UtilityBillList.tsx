'use client'

import { deleteDoc, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useManagement } from '@/components/layout/ManagementContext'
import { logAuditEvent } from '@/lib/audit/helpers'
import {
  CATEGORY_BADGE,
  CATEGORY_LABELS,
  formatBillDate,
  formatLKR,
  type UtilityBill,
} from '@/lib/utility-bills/helpers'

interface UtilityBillListProps {
  bills: UtilityBill[]
  loading: boolean
  onDeleted: () => void
}

export default function UtilityBillList({
  bills,
  loading,
  onDeleted,
}: UtilityBillListProps) {
  const { user } = useManagement()
  const isAdmin = user?.role === 'admin' || user?.role === 'owner'

  async function handleDelete(bill: UtilityBill) {
    if (!isAdmin) return
    if (!confirm(`Delete ${CATEGORY_LABELS[bill.category]} bill for ${formatLKR(bill.amount)}?`)) {
      return
    }
    try {
      await deleteDoc(doc(db, 'utilityBills', bill.id))
      if (user) {
        await logAuditEvent({
          userId: user.uid,
          userEmail: user.email,
          userRole: user.role,
          action: 'deleted',
          entityType: 'utilityBill',
          entityId: bill.id,
          details: `Deleted ${CATEGORY_LABELS[bill.category]} bill`,
        })
      }
      onDeleted()
    } catch (err) {
      console.error('[UtilityBillList]', err)
      alert('Failed to delete bill.')
    }
  }

  if (loading) {
    return <div className="h-48 animate-pulse rounded-xl bg-[#DDE3EC]" />
  }

  if (bills.length === 0) {
    return (
      <p className="rounded-xl border border-[#DDE3EC] bg-white px-6 py-12 text-center text-sm text-[#5A6A7A]">
        No utility bills for this month.
      </p>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#DDE3EC] bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b border-[#DDE3EC] bg-[#F5F7FB]">
              {['Date', 'Category', 'Amount', 'Notes', 'Photo', 'Added by', 'Actions'].map(
                (h) => (
                  <th
                    key={h}
                    className="px-4 py-3 font-jakarta text-xs font-semibold uppercase tracking-wide text-[#5A6A7A]"
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#DDE3EC]">
            {bills.map((bill) => (
              <tr key={bill.id}>
                <td className="px-4 py-3 text-[#5A6A7A]">{formatBillDate(bill.billDate)}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${CATEGORY_BADGE[bill.category]}`}
                  >
                    {CATEGORY_LABELS[bill.category]}
                  </span>
                </td>
                <td className="px-4 py-3 font-semibold text-[#0B3D6B]">
                  {formatLKR(bill.amount)}
                </td>
                <td className="max-w-[200px] truncate px-4 py-3 text-[#5A6A7A]">
                  {bill.notes || '—'}
                </td>
                <td className="px-4 py-3">
                  {bill.photoUrl ? (
                    <a href={bill.photoUrl} target="_blank" rel="noopener noreferrer">
                      <img
                        src={bill.photoUrl}
                        alt="Bill"
                        className="h-10 w-10 rounded border border-[#DDE3EC] object-cover hover:opacity-80"
                      />
                    </a>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-4 py-3 text-[#5A6A7A]">{bill.addedByName || '—'}</td>
                <td className="px-4 py-3">
                  {isAdmin ? (
                    <button
                      type="button"
                      onClick={() => handleDelete(bill)}
                      className="rounded-lg px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
