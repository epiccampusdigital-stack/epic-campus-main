'use client'

import { useMemo, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { parseStudent } from '@/lib/students/helpers'
import { getOrCreateConversation, formatMessageTime } from '@/lib/messages/helpers'
import type { Conversation } from '@/lib/messages/helpers'
import type { EpicUser } from '@/types'

interface ConversationListProps {
  conversations: Conversation[]
  loading: boolean
  selectedId: string | null
  onSelect: (id: string) => void
  onCreated: (id: string) => void
  user: EpicUser
  onAiFollowUp?: (conversation: Conversation) => void
}

export default function ConversationList({
  conversations,
  loading,
  selectedId,
  onSelect,
  onCreated,
  user,
  onAiFollowUp,
}: ConversationListProps) {
  const [search, setSearch] = useState('')
  const [newOpen, setNewOpen] = useState(false)
  const [students, setStudents] = useState<{ id: string; name: string; mobile: string }[]>([])
  const [pickStudentId, setPickStudentId] = useState('')
  const [creating, setCreating] = useState(false)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return conversations
    return conversations.filter(
      (c) =>
        c.studentName.toLowerCase().includes(q) ||
        c.studentPhone.includes(q),
    )
  }, [conversations, search])

  async function openNewDialog() {
    setNewOpen(true)
    if (students.length > 0) return
    const snap = await getDocs(collection(db, 'students'))
    setStudents(
      snap.docs
        .map((d) => {
          const s = parseStudent(d.id, d.data() as Record<string, unknown>)
          return { id: s.id, name: s.name, mobile: s.mobile }
        })
        .sort((a, b) => a.name.localeCompare(b.name)),
    )
  }

  async function handleNewConversation() {
    if (!pickStudentId) return
    const st = students.find((s) => s.id === pickStudentId)
    if (!st) return
    setCreating(true)
    try {
      const conv = await getOrCreateConversation({
        studentId: st.id,
        studentName: st.name,
        studentPhone: st.mobile,
        staffId: user.uid,
        staffName: user.displayName || user.email,
      })
      onCreated(conv.id)
      onSelect(conv.id)
      setNewOpen(false)
      setPickStudentId('')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex h-full w-full flex-col border-r border-[#DDE3EC] md:w-80 lg:w-96 dark:border-gray-600">
      <div className="space-y-3 border-b border-[#DDE3EC] p-4 dark:border-gray-600">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search student…"
          className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
        />
        <button
          type="button"
          onClick={() => void openNewDialog()}
          className="w-full rounded-lg bg-[#0B3D6B] px-3 py-2 text-sm font-semibold text-white hover:bg-[#0a3560]"
        >
          New Conversation
        </button>
      </div>

      {newOpen && (
        <div className="border-b border-[#DDE3EC] bg-[#F5F7FB] p-4 dark:border-gray-600 dark:bg-gray-900">
          <select
            value={pickStudentId}
            onChange={(e) => setPickStudentId(e.target.value)}
            className="mb-2 w-full rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          >
            <option value="">Select student</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — {s.mobile}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setNewOpen(false)}
              className="flex-1 rounded-lg border border-[#DDE3EC] py-1.5 text-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!pickStudentId || creating}
              onClick={() => void handleNewConversation()}
              className="flex-1 rounded-lg bg-[#E8A020] py-1.5 text-xs font-bold text-[#0B3D6B] disabled:opacity-50"
            >
              {creating ? '…' : 'Start'}
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-[#DDE3EC]" />
            ))}
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <p className="p-6 text-center text-sm text-[#5A6A7A]">No conversations</p>
        )}
        {filtered.map((c) => {
          const active = c.id === selectedId
          return (
            <div
              key={c.id}
              className={`flex items-stretch border-b border-[#DDE3EC]/60 dark:border-gray-600 ${
                active ? 'bg-[#F5F7FB] dark:bg-gray-700/60' : ''
              }`}
            >
              <button
                type="button"
                onClick={() => onSelect(c.id)}
                className="min-w-0 flex-1 px-4 py-3 text-left hover:bg-[#F5F7FB] dark:hover:bg-gray-700/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate font-medium text-[#0D1B2A] dark:text-white">
                    {c.studentName}
                  </p>
                  {c.unreadCount > 0 && (
                    <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#E8A020] px-1.5 text-xs font-bold text-[#0B3D6B]">
                      {c.unreadCount}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-xs text-[#5A6A7A]">
                  {c.lastMessage || 'No messages yet'}
                </p>
                <p className="mt-1 text-xs text-gray-400">{formatMessageTime(c.lastMessageAt)}</p>
              </button>
              {onAiFollowUp && (
                <button
                  type="button"
                  title="AI Follow-up"
                  onClick={() => onAiFollowUp(c)}
                  className="shrink-0 self-center px-2 py-3 text-[10px] font-semibold text-[#0B3D6B] hover:text-[#E8A020]"
                >
                  AI Follow-up
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
