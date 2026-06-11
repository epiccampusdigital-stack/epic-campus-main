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
import CountStepper from '@/components/kitchen/CountStepper'
import { getFoodEmoji } from '@/lib/kitchen/foodImages'
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

  useEffect(() => {
    loadData()
  }, [])

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

  const orderItemCards = (items: OrderItem[], editable: boolean) =>
    items.map((item, idx) => {
      const isLow = item.currentStock < item.minStockLevel
      return (
        <div
          key={item.itemId}
          className="rounded-xl border border-white/90 bg-white/65 p-4 dark:border-white/[0.08] dark:bg-white/[0.05]"
        >
          <div className="flex items-start gap-3">
            <span className="text-3xl">{getFoodEmoji(item.itemName)}</span>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-[#0D1B2A] dark:text-white">{item.itemName}</p>
              <p className={`text-sm ${isLow ? 'font-semibold text-red-600' : 'text-gray-500'}`}>
                Stock: {item.currentStock} {item.unit} (min {item.minStockLevel})
              </p>
            </div>
          </div>
          {editable ? (
            <div className="mt-3">
              <label className="mb-2 block text-sm font-bold text-[#0D1B2A] dark:text-white">
                Order qty ({item.unit})
              </label>
              <CountStepper
                value={String(item.orderQty)}
                onChange={(v) => updateQty(idx, v)}
                step={1}
              />
              <p className="mt-2 text-right text-sm font-bold text-[#E8A020]">
                {formatLKR(item.totalCost)}
              </p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-gray-600">
              Qty: {item.orderQty} {item.unit} · {formatLKR(item.totalCost)}
            </p>
          )}
        </div>
      )
    })

  return (
    <div className="space-y-4 pb-4 md:space-y-6">
      {toast && (
        <div className="fixed bottom-24 right-4 z-50 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-medium text-white shadow-lg md:bottom-6">
          {toast}
        </div>
      )}

      <div className="space-y-3">
        <h1 className="text-xl font-bold text-[#0D1B2A] dark:text-white">Order Requests</h1>
        <button
          type="button"
          onClick={generateOrderList}
          className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-[#E8A020] text-base font-bold text-white hover:bg-[#d4911c] md:w-auto md:px-6"
        >
          <span className="ti ti-refresh" /> Generate Order List
        </button>
      </div>

      {generated && (
        <div className="rounded-xl border border-white/90 bg-white/65 p-4 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.05] md:p-5">
          <h2 className="mb-4 text-base font-bold text-[#0D1B2A] dark:text-white">New Order</h2>
          {orderItems.length === 0 ? (
            <p className="text-sm text-emerald-600">All items are sufficiently stocked!</p>
          ) : (
            <>
              <div className="space-y-3 md:hidden">{orderItemCards(orderItems, true)}</div>

              <div className="hidden md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#DDE3EC] text-xs font-semibold uppercase text-[#5A6A7A]">
                      <th className="pb-3 text-left">Item</th>
                      <th className="pb-3 text-right">Current</th>
                      <th className="pb-3 text-right">Min</th>
                      <th className="pb-3 text-right">Order Qty</th>
                      <th className="pb-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderItems.map((item, idx) => (
                      <tr key={item.itemId} className="border-b border-[#DDE3EC] dark:border-white/[0.06]">
                        <td className="py-2 font-medium text-[#0D1B2A] dark:text-white">
                          {item.itemName} ({item.unit})
                        </td>
                        <td className="py-2 text-right text-[#5A6A7A]">{item.currentStock}</td>
                        <td className="py-2 text-right text-[#5A6A7A]">{item.minStockLevel}</td>
                        <td className="py-2 text-right">
                          <input
                            type="number"
                            min="0"
                            value={item.orderQty}
                            onChange={(e) => updateQty(idx, e.target.value)}
                            className="w-20 rounded-lg border border-[#DDE3EC] bg-white px-2 py-1 text-right dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                          />
                        </td>
                        <td className="py-2 text-right font-medium text-[#E8A020]">
                          {formatLKR(item.totalCost)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="mt-4 text-right text-lg font-bold text-[#E8A020]">
                Total: {formatLKR(totalEstimate)}
              </p>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-base font-bold text-[#0D1B2A] dark:text-white">
                    Supplier (optional)
                  </label>
                  <input
                    type="text"
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    className="w-full min-h-[48px] rounded-xl border border-[#DDE3EC] bg-white px-3 py-2 text-base dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-base font-bold text-[#0D1B2A] dark:text-white">
                    Notes
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full min-h-[48px] rounded-xl border border-[#DDE3EC] bg-white px-3 py-2 text-base dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="sticky bottom-0 z-10 -mx-4 mt-4 border-t border-[#DDE3EC] bg-white/95 p-4 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0 dark:border-white/[0.06] dark:bg-[#080d18]/95 md:dark:bg-transparent">
                <div className="flex flex-col gap-3 md:flex-row md:justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setGenerated(false)
                      setOrderItems([])
                    }}
                    className="min-h-[48px] rounded-xl border border-[#DDE3EC] px-4 text-sm font-medium text-[#5A6A7A] md:min-h-[44px]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={saving}
                    className="min-h-[56px] w-full rounded-xl bg-[#0B3D6B] text-base font-bold text-white hover:bg-[#0a3460] disabled:opacity-50 md:min-h-[44px] md:w-auto md:px-6"
                  >
                    {saving ? 'Submitting…' : 'Submit for Approval'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <div className="rounded-xl border border-white/90 bg-white/65 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.05]">
        <div className="border-b border-[#DDE3EC] px-4 py-4 dark:border-white/[0.06] md:px-5">
          <h2 className="text-base font-bold text-[#0D1B2A] dark:text-white">Order History</h2>
        </div>

        <div className="space-y-3 p-4 md:hidden">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-[#DDE3EC] dark:bg-white/10" />
            ))
          ) : orders.length === 0 ? (
            <p className="py-8 text-center text-sm text-[#5A6A7A] dark:text-white/40">No orders yet</p>
          ) : (
            orders.map((o) => (
              <div
                key={o.id}
                className="rounded-xl border border-[#DDE3EC] bg-white p-4 dark:border-white/[0.06] dark:bg-white/[0.03]"
              >
                <div className="flex items-center justify-between">
                  <p className="font-bold text-[#0D1B2A] dark:text-white">{toDate(o.createdAt)}</p>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[o.status]}`}
                  >
                    {o.status}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-600">{o.items.length} items</p>
                <p className="text-sm font-bold text-[#E8A020]">{formatLKR(o.totalEstimate)}</p>
                <p className="text-xs text-gray-400">{o.submittedByName}</p>
              </div>
            ))
          )}
        </div>

        <div className="hidden md:block">
          <table className="w-full text-left text-sm">
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
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 animate-pulse rounded bg-[#DDE3EC] dark:bg-white/10" />
                      </td>
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
                      <span
                        className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[o.status]}`}
                      >
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
