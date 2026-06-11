'use client'

import { useEffect, useState } from 'react'
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  where,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useKitchen } from '@/app/kitchen/context'
import { formatLKR } from '@/lib/utils/formatCurrency'
import type { InventoryItem, KitchenOrder, OrderItem, OrderStatus } from '@/types/kitchen'

const STATUS_STYLES: Record<OrderStatus, string> = {
  draft: 'bg-gray-100 text-gray-600 border-gray-200',
  submitted: 'bg-blue-50 text-blue-700 border-blue-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  ordered: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  received: 'bg-teal-50 text-teal-700 border-teal-200',
  cancelled: 'bg-red-50 text-red-700 border-red-200',
}

function toDate(ts: unknown): string {
  if (!ts) return ''
  if (typeof ts === 'object' && ts !== null && 'seconds' in ts) {
    return new Date((ts as { seconds: number }).seconds * 1000).toLocaleDateString('en-LK')
  }
  return ''
}

export default function OrdersPage() {
  const { user } = useKitchen()
  const [orders, setOrders] = useState<KitchenOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [orderItems, setOrderItems] = useState<OrderItem[]>([])
  const [supplier, setSupplier] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [generated, setGenerated] = useState(false)

  async function loadData() {
    setLoading(true)
    try {
      const [orderSnap, invSnap] = await Promise.all([
        getDocs(query(collection(db, 'kitchenOrders'), orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'inventory'), where('isActive', '==', true), orderBy('itemName'))),
      ])
      setOrders(orderSnap.docs.map((d) => ({ id: d.id, ...d.data() } as KitchenOrder)))
      setInventoryItems(invSnap.docs.map((d) => ({ id: d.id, ...d.data() } as InventoryItem)))
    } catch (err) {
      console.error('[Orders]', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  function generateOrderList() {
    const lowItems = inventoryItems.filter((i) => i.currentStock < i.minStockLevel)
    const rows: OrderItem[] = lowItems.map((i) => ({
      itemId: i.id,
      itemName: i.itemName,
      unit: i.unit,
      currentStock: i.currentStock,
      minStockLevel: i.minStockLevel,
      orderQty: Math.max(i.minStockLevel * 2 - i.currentStock, 0),
      unitCost: i.unitCost,
      totalCost: Math.max(i.minStockLevel * 2 - i.currentStock, 0) * i.unitCost,
    }))
    setOrderItems(rows)
    setGenerated(true)
  }

  function updateQty(idx: number, qty: string) {
    setOrderItems((prev) => {
      const next = [...prev]
      const qtyNum = Number(qty) || 0
      next[idx] = { ...next[idx], orderQty: qtyNum, totalCost: qtyNum * next[idx].unitCost }
      return next
    })
  }

  const totalEstimate = orderItems.reduce((s, i) => s + i.totalCost, 0)

  async function handleSubmit() {
    if (orderItems.length === 0) return
    setSaving(true)
    try {
      await addDoc(collection(db, 'kitchenOrders'), {
        items: orderItems,
        status: 'submitted',
        totalEstimate,
        submittedBy: user?.uid ?? '',
        submittedByName: user?.displayName ?? '',
        supplier: supplier || null,
        notes: notes || '',
        createdAt: serverTimestamp(),
      })
      setOrderItems([])
      setSupplier('')
      setNotes('')
      setGenerated(false)
      showToast('Order submitted for approval')
      await loadData()
    } catch (err) {
      console.error('[Orders submit]', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-[#0D1B2A] dark:text-white">Order Requests</h1>
        <button
          type="button"
          onClick={generateOrderList}
          className="flex items-center gap-2 rounded-lg bg-[#E8A020] px-4 py-2 text-sm font-semibold text-white hover:bg-[#d4911c]"
        >
          <span className="ti ti-refresh" /> Generate Order List
        </button>
      </div>

      {/* Order form */}
      {generated && (
        <div className="rounded-xl border border-white/90 bg-white/65 p-5 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.05]">
          <h2 className="mb-4 text-sm font-bold text-[#0D1B2A] dark:text-white">New Order</h2>
          {orderItems.length === 0 ? (
            <p className="text-sm text-emerald-600">All items are sufficiently stocked!</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-sm">
                  <thead>
                    <tr className="border-b border-[#DDE3EC] text-xs font-semibold uppercase text-[#5A6A7A] dark:border-white/[0.06] dark:text-white/40">
                      <th className="pb-3 text-left">Item</th>
                      <th className="pb-3 text-right">Current</th>
                      <th className="pb-3 text-right">Min</th>
                      <th className="pb-3 text-right">Order Qty</th>
                      <th className="pb-3 text-right">Unit Cost</th>
                      <th className="pb-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderItems.map((item, idx) => (
                      <tr key={item.itemId} className="border-b border-[#DDE3EC] dark:border-white/[0.06]">
                        <td className="py-2 font-medium text-[#0D1B2A] dark:text-white">
                          {item.itemName} <span className="text-xs text-[#5A6A7A]">({item.unit})</span>
                        </td>
                        <td className="py-2 text-right text-[#5A6A7A] dark:text-white/60">
                          {item.currentStock}
                        </td>
                        <td className="py-2 text-right text-[#5A6A7A] dark:text-white/60">
                          {item.minStockLevel}
                        </td>
                        <td className="py-2 text-right">
                          <input
                            type="number"
                            min="0"
                            value={item.orderQty}
                            onChange={(e) => updateQty(idx, e.target.value)}
                            className="w-20 rounded-lg border border-[#DDE3EC] bg-white px-2 py-1 text-sm text-right dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                          />
                        </td>
                        <td className="py-2 text-right text-[#5A6A7A] dark:text-white/60">
                          {formatLKR(item.unitCost)}
                        </td>
                        <td className="py-2 text-right font-medium text-[#0B3D6B] dark:text-[#E8A020]">
                          {formatLKR(item.totalCost)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={5} className="pt-3 text-right text-sm font-semibold text-[#0D1B2A] dark:text-white">
                        Total Estimate:
                      </td>
                      <td className="pt-3 text-right text-base font-bold text-[#E8A020]">
                        {formatLKR(totalEstimate)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#5A6A7A]">Supplier (optional)</label>
                  <input
                    type="text"
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    className="w-full rounded-lg border border-[#DDE3EC] bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#5A6A7A]">Notes</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full rounded-lg border border-[#DDE3EC] bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  />
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => { setGenerated(false); setOrderItems([]) }}
                  className="rounded-lg border border-[#DDE3EC] px-4 py-2 text-sm font-medium text-[#5A6A7A]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={saving}
                  className="rounded-lg bg-[#0B3D6B] px-5 py-2 text-sm font-semibold text-white hover:bg-[#0a3460] disabled:opacity-50"
                >
                  {saving ? 'Submitting…' : 'Submit for Approval'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Order history */}
      <div className="overflow-hidden rounded-xl border border-white/90 bg-white/65 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.05]">
        <div className="border-b border-[#DDE3EC] px-5 py-4 dark:border-white/[0.06]">
          <h2 className="text-sm font-bold text-[#0D1B2A] dark:text-white">Order History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#DDE3EC] bg-[#F5F7FB] text-xs font-medium uppercase text-[#5A6A7A] dark:border-white/[0.06] dark:bg-white/[0.03] dark:text-white/40">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3">Total (LKR)</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Submitted By</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-b border-[#DDE3EC] dark:border-white/[0.06]">
                    {Array.from({ length: 5 }).map((__, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 animate-pulse rounded bg-[#DDE3EC] dark:bg-white/10" /></td>
                    ))}
                  </tr>
                ))
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-sm text-[#5A6A7A] dark:text-white/40">
                    No orders yet
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id} className="border-b border-[#DDE3EC] last:border-0 dark:border-white/[0.06]">
                    <td className="px-4 py-3 text-[#5A6A7A] dark:text-white/60">{toDate(o.createdAt)}</td>
                    <td className="px-4 py-3 text-[#0D1B2A] dark:text-white">{o.items.length} items</td>
                    <td className="px-4 py-3 font-medium text-[#0B3D6B] dark:text-[#E8A020]">
                      {formatLKR(o.totalEstimate)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[o.status]}`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#5A6A7A] dark:text-white/60">{o.submittedByName}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
