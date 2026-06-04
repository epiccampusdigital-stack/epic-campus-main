'use client'

import { useCallback, useEffect, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { parseStudentsFromDocs } from '@/lib/broadcast/helpers'
import BroadcastComposer from '@/components/broadcast/BroadcastComposer'
import BroadcastHistory from '@/components/broadcast/BroadcastHistory'
import type { Student } from '@/types'

type Tab = 'new' | 'history'

export default function BroadcastPage() {
  const [tab, setTab] = useState<Tab>('new')
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [historyRefresh, setHistoryRefresh] = useState(0)

  const loadStudents = useCallback(async () => {
    setLoading(true)
    try {
      const snap = await getDocs(collection(db, 'students'))
      setStudents(parseStudentsFromDocs(snap.docs))
    } catch (err) {
      console.error('[BroadcastPage]', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadStudents()
  }, [loadStudents])

  function handleSent() {
    setHistoryRefresh((t) => t + 1)
    setTab('history')
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-jakarta text-2xl font-bold text-[#0D1B2A] dark:text-white">
          WhatsApp Broadcast
        </h2>
        <p className="text-sm text-[#5A6A7A]">Send messages to students via WhatsApp</p>
      </div>

      <div className="border-b border-[#DDE3EC]">
        <nav className="-mb-px flex gap-1">
          {(
            [
              { id: 'new' as const, label: 'New Broadcast' },
              { id: 'history' as const, label: 'History' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`border-b-2 px-4 py-3 font-inter text-sm font-medium ${
                tab === t.id
                  ? 'border-[#E8A020] text-[#0B3D6B]'
                  : 'border-transparent text-[#5A6A7A] hover:text-[#0B3D6B]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {loading && tab === 'new' ? (
        <div className="animate-pulse h-64 rounded-xl bg-[#DDE3EC]" />
      ) : tab === 'new' ? (
        <BroadcastComposer students={students} onSent={handleSent} />
      ) : (
        <BroadcastHistory refreshToken={historyRefresh} />
      )}
    </div>
  )
}
