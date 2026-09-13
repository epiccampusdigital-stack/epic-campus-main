'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { auth } from '@/lib/firebase/client'
import { formatDate } from '@/lib/students/helpers'

const JP_COURSE_ID = 'jft-foundation'

interface OnlineStudentRow {
  id: string
  name: string
  mobile: string
  district: string
  createdAt: string
  enrolledAt: string | null
  paymentStatus: string | null
  packStatus: string | null
  completedCount: number
  releasedCount: number
}

const PAYMENT_LABELS: Record<string, string> = {
  pending: 'Pending',
  awaiting_verification: 'Awaiting verification',
  paid: 'Paid',
  failed: 'Failed',
  refunded: 'Refunded',
}

const PACK_LABELS: Record<string, string> = {
  pending: 'Pending',
  packed: 'Packed',
  dispatched: 'Dispatched',
  collected: 'Collected',
  delivered: 'Delivered',
}

async function authedJson<T>(path: string): Promise<T> {
  const token = await auth.currentUser?.getIdToken()
  const res = await fetch(path, { headers: { Authorization: `Bearer ${token ?? ''}` } })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string })?.error ?? `Request failed (${res.status})`)
  return data as T
}

export default function OnlineStudentsTab() {
  const [rows, setRows] = useState<OnlineStudentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await authedJson<{ rows: OnlineStudentRow[] }>(
        `/api/jp/students-summary?courseId=${encodeURIComponent(JP_COURSE_ID)}`,
      )
      setRows(data.rows)
    } catch (err) {
      console.error('[OnlineStudentsTab] load', err)
      setError(err instanceof Error ? err.message : 'Could not load online students.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#0B3D6B] border-t-[#E8A020]" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-dashed border-red-200 bg-red-50 p-6 text-center text-sm text-red-700 dark:border-red-900 dark:bg-red-900/10 dark:text-red-300">
        {error}
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 text-center dark:border-white/10">
        <span className="ti ti-device-laptop text-2xl text-[#5A6A7A]" aria-hidden="true" />
        <p className="font-inter text-sm text-[#5A6A7A] dark:text-white/50">No online students yet</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto -mx-4 rounded-xl border border-gray-100 bg-white dark:border-white/[0.05] dark:bg-white/[0.04] sm:mx-0">
      <div className="min-w-[760px] sm:min-w-0">
        <table className="min-w-full">
          <thead className="border-b border-gray-100 bg-gray-50 dark:border-white/[0.05] dark:bg-white/[0.03]">
            <tr>
              {['Name', 'Phone', 'District', 'Payment status', 'Pack status', 'Course progress', 'Enrolled'].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left font-jakarta text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-white/40"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
            {rows.map((row) => (
              <tr key={row.id} className="bg-white dark:bg-transparent hover:bg-gray-50 dark:hover:bg-white/[0.03]">
                <td className="px-4 py-3">
                  <Link
                    href={`/students/${row.id}`}
                    className="font-jakarta text-sm font-semibold text-gray-900 dark:text-white hover:text-[#E8A020] hover:underline"
                  >
                    {row.name || '—'}
                  </Link>
                </td>
                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{row.mobile || '—'}</td>
                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{row.district || '—'}</td>
                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                  {row.paymentStatus ? PAYMENT_LABELS[row.paymentStatus] ?? row.paymentStatus : 'No order'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                  {row.packStatus ? PACK_LABELS[row.packStatus] ?? row.packStatus : '—'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                  {row.releasedCount > 0 ? `${row.completedCount}/${row.releasedCount}` : '—'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500 dark:text-white/50">
                  {formatDate(row.enrolledAt ?? row.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
