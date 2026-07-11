'use client'

import { useEffect, useState } from 'react'
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  addDoc,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useManagement } from '@/components/layout/ManagementContext'
import { formatLKR } from '@/lib/utils/formatCurrency'
import type { KitchenOrder, OrderItem, OrderStatus } from '@/types/kitchen'

const STATUS_STYLES: Record<OrderStatus, string> = {
  draft: 'bg-gray-100 text-gray-600 border-gray-200',
  submitted: 'bg-blue-50 text-blue-700 border-blue-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  ordered: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  received: 'bg-teal-50 text-teal-700 border-teal-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
}

// Bucket an order's items into the same category groups the kitchen order screen
// uses, so the admin expandable view lines up with what staff submitted.
const CATEGORY_GROUPS: { key: string; label: string; matches: string[] }[] = [
  { key: 'vegetables', label: 'Vegetables', matches: ['vegetables', 'vegetable'] },
  { key: 'protein', label: 'Meat & Protein', matches: ['protein', 'meat', 'meat & fish', 'fish'] },
  { key: 'grains', label: 'Grains & Rice', matches: ['grains', 'grain', 'rice', 'grains & rice'] },
  { key: 'dairy', label: 'Dairy', matches: ['dairy', 'dairy & eggs'] },
  { key: 'condiments', label: 'Condiments & Spices', matches: ['condiments', 'condiment', 'spices', 'spice', 'condiments & spices'] },
  { key: 'beverages', label: 'Beverages', matches: ['beverages', 'beverage'] },
  { key: 'other', label: 'Other', matches: [] },
]
const NON_OTHER = new Set(CATEGORY_GROUPS.filter((g) => g.key !== 'other').flatMap((g) => g.matches))
function groupItems(items: OrderItem[]): { key: string; label: string; items: OrderItem[] }[] {
  return CATEGORY_GROUPS.map((g) => ({
    key: g.key,
    label: g.label,
    items: items.filter((it) => {
      const c = String(it.category ?? '').toLowerCase()
      if (g.key === 'other') return !NON_OTHER.has(c)
      return g.matches.includes(c)
    }),
  })).filter((g) => g.items.length > 0)
}

function toDate(ts: unknown): string {
  if (!ts) return ''
  if (typeof ts === 'object' && ts !== null && 'seconds' in ts) {
    return new Date((ts as { seconds: number }).seconds * 1000).toLocaleDateString('en-LK')
  }
  return ''
}

export default function AdminKitchenOrdersPage() {
  const { user } = useManagement()
  const [submitted, setSubmitted] = useState<KitchenOrder[]>([])
  const [history, setHistory] = useState<KitchenOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [rejectModal, setRejectModal] = useState<KitchenOrder | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [processing, setProcessing] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  async function loadOrders() {
    setLoading(true)
    try {
      const [pendSnap, histSnap] = await Promise.all([
        getDocs(query(collection(db, 'kitchenOrders'), where('status', '==', 'submitted'), orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'kitchenOrders'), where('status', 'in', ['approved', 'received', 'cancelled', 'rejected']), orderBy('createdAt', 'desc'))),
      ])
      setSubmitted(pendSnap.docs.map((d) => ({ id: d.id, ...d.data() } as KitchenOrder)))
      setHistory(histSnap.docs.map((d) => ({ id: d.id, ...d.data() } as KitchenOrder)))
    } catch (err) {
      console.error('[AdminKitchenOrders]', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadOrders() }, [])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  async function handleApprove(order: KitchenOrder) {
    if (!user) return
    setProcessing(order.id)
    try {
      await updateDoc(doc(db, 'kitchenOrders', order.id), {
        status: 'approved',
        approvedBy: user.uid,
        approvedByName: user.displayName,
        approvedAt: serverTimestamp(),
      })
      // Create expense entry
      await addDoc(collection(db, 'expenses'), {
        category: 'Kitchen & Canteen',
        description: `Kitchen supply order (${order.items.length} items)`,
        amount: order.totalEstimate,
        date: new Date().toISOString().slice(0, 10),
        createdBy: user.uid,
        createdByName: user.displayName,
        source: 'kitchen-order',
        sourceId: order.id,
        createdAt: serverTimestamp(),
      })
      showToast('Order approved and expense entry created')
      await loadOrders()
    } catch (err) {
      console.error('[Approve]', err)
    } finally {
      setProcessing(null)
    }
  }

  async function handleReject() {
    if (!rejectModal || !user) return
    setProcessing(rejectModal.id)
    try {
      await updateDoc(doc(db, 'kitchenOrders', rejectModal.id), {
        status: 'rejected',
        rejectedBy: user.uid,
        rejectedByName: user.displayName,
        rejectedAt: serverTimestamp(),
        rejectionReason: rejectReason || '',
      })
      setRejectModal(null)
      setRejectReason('')
      showToast('Order rejected')
      await loadOrders()
    } catch (err) {
      console.error('[Reject]', err)
    } finally {
      setProcessing(null)
    }
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}

      <h1 className="text-xl font-bold text-[#0D1B2A] dark:text-white">Kitchen Order Approvals</h1>

      {/* Pending orders */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-[#5A6A7A] uppercase tracking-wide dark:text-white/40">
          Pending Approval ({submitted.length})
        </h2>
        {loading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-[#DDE3EC] dark:bg-white/10" />
          ))
        ) : submitted.length === 0 ? (
          <div className="rounded-xl border border-white/90 bg-white/65 py-12 text-center dark:border-white/[0.08] dark:bg-white/[0.05]">
            <span className="ti ti-check text-3xl text-emerald-400" />
            <p className="mt-2 text-sm text-[#5A6A7A] dark:text-white/40">No pending orders</p>
          </div>
        ) : (
          submitted.map((order) => (
            <div
              key={order.id}
              className="rounded-xl border border-white/90 bg-white/65 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.05]"
            >
              <div className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div>
                  <p className="font-semibold text-[#0D1B2A] dark:text-white">
                    {order.items.length} items · {formatLKR(order.totalEstimate)}
                  </p>
                  <p className="mt-0.5 text-xs text-[#5A6A7A] dark:text-white/40">
                    Submitted by {order.submittedByName} · {toDate(order.createdAt)}
                    {' · '}
                    <span className="inline-flex items-center gap-1">
                      <span className="ti ti-map-pin" />{order.location ?? 'Ahangama'}
                    </span>
                    {order.supplier && ` · Supplier: ${order.supplier}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setExpanded(expanded === order.id ? null : order.id)}
                    className="rounded-lg border border-[#DDE3EC] px-3 py-1.5 text-xs font-medium text-[#5A6A7A] hover:bg-[#F5F7FB] dark:border-white/[0.08] dark:text-white/60 dark:hover:bg-white/[0.05]"
                  >
                    {expanded === order.id ? 'Hide' : 'View Items'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setRejectModal(order); setRejectReason('') }}
                    disabled={processing === order.id}
                    className="rounded-lg bg-red-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-50"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApprove(order)}
                    disabled={processing === order.id}
                    className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {processing === order.id ? 'Processing…' : 'Approve'}
                  </button>
                </div>
              </div>
              {expanded === order.id && (
                <div className="space-y-4 border-t border-[#DDE3EC] p-5 dark:border-white/[0.06]">
                  {groupItems(order.items).map((g) => (
                    <div key={g.key}>
                      <p className="mb-1 text-xs font-bold uppercase tracking-wide text-[#5A6A7A] dark:text-white/50">
                        {g.label} ({g.items.length} item{g.items.length === 1 ? '' : 's'}) ·{' '}
                        {formatLKR(g.items.reduce((s, it) => s + (it.unitCost > 0 ? it.totalCost : 0), 0))}
                      </p>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-xs uppercase text-[#5A6A7A] dark:text-white/40">
                            <th className="pb-1 text-left">Item</th>
                            <th className="pb-1 text-right">Qty</th>
                            <th className="pb-1 text-right">Unit</th>
                            <th className="pb-1 text-right">Unit Cost</th>
                            <th className="pb-1 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {g.items.map((item) => (
                            <tr key={item.itemId} className="border-b border-[#DDE3EC] dark:border-white/[0.06]">
                              <td className="py-2 text-[#0D1B2A] dark:text-white">{item.itemName}</td>
                              <td className="py-2 text-right text-[#5A6A7A] dark:text-white/60">{item.orderQty}</td>
                              <td className="py-2 text-right text-[#5A6A7A] dark:text-white/60">{item.unit}</td>
                              <td className="py-2 text-right text-[#5A6A7A] dark:text-white/60">{formatLKR(item.unitCost)}</td>
                              <td className="py-2 text-right font-medium text-[#0B3D6B] dark:text-[#E8A020]">{formatLKR(item.totalCost)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                  {order.notes && <p className="text-xs text-[#5A6A7A] dark:text-white/40">Notes: {order.notes}</p>}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Order history */}
      {history.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-white/90 bg-white/65 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.05]">
          <div className="border-b border-[#DDE3EC] px-5 py-4 dark:border-white/[0.06]">
            <h2 className="text-sm font-bold text-[#0D1B2A] dark:text-white">Order History</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#DDE3EC] bg-[#F5F7FB] text-xs font-medium uppercase text-[#5A6A7A] dark:border-white/[0.06] dark:bg-white/[0.03] dark:text-white/40">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Items</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">By</th>
                  <th className="px-4 py-3">Approved By</th>
                </tr>
              </thead>
              <tbody>
                {history.map((o) => (
                  <tr key={o.id} className="border-b border-[#DDE3EC] last:border-0 dark:border-white/[0.06]">
                    <td className="px-4 py-3 text-[#5A6A7A] dark:text-white/60">{toDate(o.createdAt)}</td>
                    <td className="px-4 py-3 text-[#0D1B2A] dark:text-white">{o.items.length}</td>
                    <td className="px-4 py-3 font-medium text-[#0B3D6B] dark:text-[#E8A020]">{formatLKR(o.totalEstimate)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[o.status]}`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#5A6A7A] dark:text-white/60">{o.submittedByName}</td>
                    <td className="px-4 py-3 text-[#5A6A7A] dark:text-white/60">{o.approvedByName ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {rejectModal && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setRejectModal(null)} />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/80 bg-white/90 p-6 backdrop-blur-2xl shadow-2xl dark:border-white/[0.08] dark:bg-[#0d1a2e]/90">
            <h3 className="font-bold text-[#0D1B2A] dark:text-white">Reject Order</h3>
            <p className="mt-1 text-sm text-[#5A6A7A] dark:text-white/50">
              {rejectModal.items.length} items · {formatLKR(rejectModal.totalEstimate)}
            </p>
            <div className="mt-4">
              <label className="mb-1 block text-xs font-medium text-[#5A6A7A]">Reason (optional)</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-[#DDE3EC] bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              />
            </div>
            <div className="mt-4 flex gap-3">
              <button type="button" onClick={() => setRejectModal(null)} className="flex-1 rounded-lg border border-[#DDE3EC] py-2 text-sm font-medium text-[#5A6A7A]">
                Cancel
              </button>
              <button type="button" onClick={handleReject} disabled={!!processing}
                className="flex-1 rounded-lg bg-red-500 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50">
                {processing ? 'Rejecting…' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
