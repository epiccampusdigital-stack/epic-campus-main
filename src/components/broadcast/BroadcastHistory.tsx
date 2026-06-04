'use client'

import { Fragment, useCallback, useEffect, useState } from 'react'
import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
} from 'firebase/firestore'
import { auth, db } from '@/lib/firebase/client'
import {
  BROADCAST_STATUS_STYLES,
  formatBroadcastDate,
  LOG_STATUS_STYLES,
  parseBroadcast,
  parseBroadcastLog,
} from '@/lib/broadcast/helpers'
import type { BroadcastLog, BroadcastMessage } from '@/types'

interface BroadcastHistoryProps {
  refreshToken?: number
}

export default function BroadcastHistory({ refreshToken = 0 }: BroadcastHistoryProps) {
  const [broadcasts, setBroadcasts] = useState<BroadcastMessage[]>([])
  const [logsByBroadcast, setLogsByBroadcast] = useState<Record<string, BroadcastLog[]>>({})
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [resendingId, setResendingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const snap = await getDocs(
        query(collection(db, 'broadcastMessages'), orderBy('createdAt', 'desc')),
      )
      setBroadcasts(
        snap.docs.map((d) =>
          parseBroadcast(d.id, d.data() as Record<string, unknown>),
        ),
      )
    } catch (err) {
      console.error('[BroadcastHistory]', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load, refreshToken])

  async function loadLogs(broadcastId: string) {
    if (logsByBroadcast[broadcastId]) return
    const snap = await getDocs(
      query(collection(db, 'broadcastLogs'), where('broadcastId', '==', broadcastId)),
    )
    const logs = snap.docs
      .map((d) => parseBroadcastLog(d.id, d.data() as Record<string, unknown>))
      .sort((a, b) => b.sentAt.localeCompare(a.sentAt))
    setLogsByBroadcast((prev) => ({ ...prev, [broadcastId]: logs }))
  }

  async function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null)
      return
    }
    setExpandedId(id)
    await loadLogs(id)
  }

  async function resendFailed(broadcastId: string) {
    setResendingId(broadcastId)
    try {
      const token = await auth.currentUser?.getIdToken()
      if (!token) throw new Error('Not signed in')
      const res = await fetch('/api/broadcast/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ broadcastId, retryFailed: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Resend failed')
      setLogsByBroadcast((prev) => {
        const next = { ...prev }
        delete next[broadcastId]
        return next
      })
      if (expandedId === broadcastId) await loadLogs(broadcastId)
      await load()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Resend failed')
    } finally {
      setResendingId(null)
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-14 rounded-xl bg-[#DDE3EC]" />
        ))}
      </div>
    )
  }

  if (broadcasts.length === 0) {
    return (
      <p className="rounded-xl border border-[#DDE3EC] bg-white px-6 py-12 text-center text-sm text-[#5A6A7A]">
        No broadcasts yet. Create one in the New Broadcast tab.
      </p>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#DDE3EC] bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-[#DDE3EC] bg-[#F5F7FB]">
              {['Title', 'Recipients', 'Status', 'Sent at', 'Created by', ''].map((h) => (
                <th
                  key={h || 'actions'}
                  className="px-4 py-3 text-xs font-semibold uppercase text-[#5A6A7A]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {broadcasts.map((b) => {
              const expanded = expandedId === b.id
              const logs = logsByBroadcast[b.id] ?? []
              const failedCount = logs.filter((l) => l.status === 'failed').length

              return (
                <Fragment key={b.id}>
                  <tr
                    className="cursor-pointer border-b border-[#DDE3EC] hover:bg-[#F5F7FB]/60"
                    onClick={() => void toggleExpand(b.id)}
                  >
                    <td className="px-4 py-3 font-medium text-[#0D1B2A]">{b.title}</td>
                    <td className="px-4 py-3 text-[#5A6A7A]">{b.recipientCount}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${BROADCAST_STATUS_STYLES[b.status]}`}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#5A6A7A]">
                      {formatBroadcastDate(b.sentAt ?? b.scheduledAt)}
                    </td>
                    <td className="px-4 py-3 text-[#5A6A7A]">{b.createdByName}</td>
                    <td className="px-4 py-3">
                      <span className="ti ti-chevron-down text-[#0B3D6B]" />
                    </td>
                  </tr>
                  {expanded && (
                    <tr>
                      <td colSpan={6} className="bg-[#F5F7FB] px-4 py-4">
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs font-semibold uppercase text-[#5A6A7A]">
                            Delivery log
                          </p>
                          {(b.status === 'partial' || b.status === 'failed' || failedCount > 0) && (
                            <button
                              type="button"
                              disabled={resendingId === b.id}
                              onClick={(e) => {
                                e.stopPropagation()
                                void resendFailed(b.id)
                              }}
                              className="rounded-lg bg-[#E8A020] px-3 py-1.5 text-xs font-bold text-[#0B3D6B] hover:bg-[#F5B942] disabled:opacity-60"
                            >
                              {resendingId === b.id ? 'Sending…' : 'Resend failed'}
                            </button>
                          )}
                        </div>
                        {logs.length === 0 ? (
                          <p className="text-sm text-[#5A6A7A]">Loading delivery log…</p>
                        ) : (
                          <ul className="max-h-48 space-y-1 overflow-y-auto">
                            {logs.map((log) => (
                              <li
                                key={log.id}
                                className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm"
                              >
                                <span>
                                  {log.studentName}{' '}
                                  <span className="text-[#5A6A7A]">({log.phone})</span>
                                </span>
                                <span
                                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${LOG_STATUS_STYLES[log.status]}`}
                                >
                                  {log.status}
                                  {log.error ? ` — ${log.error}` : ''}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
