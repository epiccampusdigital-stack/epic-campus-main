'use client'

import { useEffect, useRef, useState } from 'react'
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  limit,
  updateDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/client'

interface NotificationItem {
  id: string
  type: string
  title: string
  body: string
  read: boolean
  createdAt: unknown
}

function formatWhen(val: unknown): string {
  if (!val) return ''
  try {
    const date =
      typeof val === 'object' && val !== null && 'toDate' in val
        ? (val as { toDate: () => Date }).toDate()
        : new Date(String(val))
    const diffMs = Date.now() - date.getTime()
    const mins = Math.floor(diffMs / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  } catch {
    return ''
  }
}

export default function NotificationCenter() {
  const [items, setItems] = useState<NotificationItem[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const q = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(20))
    const unsub = onSnapshot(
      q,
      (snap) => {
        setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() } as NotificationItem)))
      },
      () => setItems([]),
    )
    return () => unsub()
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const unreadCount = items.filter((n) => !n.read).length

  async function markRead(id: string) {
    await updateDoc(doc(db, 'notifications', id), { read: true }).catch(() => {})
  }

  async function markAllRead() {
    await Promise.all(
      items.filter((n) => !n.read).map((n) => updateDoc(doc(db, 'notifications', n.id), { read: true }).catch(() => {})),
    )
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg text-[#5A6A7A] dark:text-white/50 hover:bg-[#0B3D6B]/[0.06] dark:hover:bg-white/[0.06] transition-colors duration-200"
        aria-label="Notifications"
      >
        <span className="ti ti-bell text-[18px]" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-w-[90vw] rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-[#0d1a2e] shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#DDE3EC] dark:border-white/[0.08] px-4 py-3">
            <p className="text-sm font-bold text-[#0D1B2A] dark:text-white">Notifications</p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="text-xs font-semibold text-[#0B3D6B] dark:text-blue-300 hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-[#5A6A7A] dark:text-white/40">No notifications yet</p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => void markRead(n.id)}
                  className={`flex w-full flex-col items-start gap-0.5 border-b border-[#DDE3EC] dark:border-white/[0.06] px-4 py-3 text-left last:border-0 hover:bg-[#F5F7FB] dark:hover:bg-white/[0.04] transition-colors ${
                    n.read ? '' : 'bg-[#E8A020]/5'
                  }`}
                >
                  <div className="flex w-full items-center gap-2">
                    {!n.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#E8A020]" />}
                    <p className="flex-1 truncate text-sm font-semibold text-[#0D1B2A] dark:text-white">{n.title}</p>
                    <span className="shrink-0 text-[10px] text-[#5A6A7A] dark:text-white/40">{formatWhen(n.createdAt)}</span>
                  </div>
                  <p className="line-clamp-2 text-xs text-[#5A6A7A] dark:text-white/50">{n.body}</p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
