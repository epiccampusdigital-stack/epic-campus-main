'use client'

import { useCallback, useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { useManagement } from '@/components/layout/ManagementContext'
import ConversationList from '@/components/messages/ConversationList'
import ChatWindow from '@/components/messages/ChatWindow'
import WhatsAppFollowUpModal, {
  type WhatsAppFollowUpStudent,
} from '@/components/students/WhatsAppFollowUpModal'
import { db } from '@/lib/firebase/client'
import { COURSE_MAP } from '@/lib/constants/courses'
import { parseStudent } from '@/lib/students/helpers'
import {
  markConversationReadByStaff,
  subscribeConversations,
  subscribeMessages,
  type ChatMessage,
  type Conversation,
} from '@/lib/messages/helpers'

export default function MessagesPage() {
  const { user } = useManagement()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [followUpStudent, setFollowUpStudent] = useState<WhatsAppFollowUpStudent | null>(null)

  const selected = conversations.find((c) => c.id === selectedId) ?? null

  const openAiFollowUp = useCallback(async (conv: Conversation) => {
    let course = ''
    try {
      const snap = await getDoc(doc(db, 'students', conv.studentId))
      if (snap.exists()) {
        const s = parseStudent(snap.id, snap.data() as Record<string, unknown>)
        course = COURSE_MAP[s.courseId]?.label ?? s.courseId
      }
    } catch {
      // course optional for draft
    }
    setFollowUpStudent({
      id: conv.studentId,
      name: conv.studentName,
      phone: conv.studentPhone,
      course,
      riskFlags: [],
      recommendation: '',
    })
  }, [])

  useEffect(() => {
    const unsub = subscribeConversations(
      (list) => {
        setConversations(list)
        setLoading(false)
        setSelectedId((prev) => prev ?? list[0]?.id ?? null)
      },
      () => setLoading(false),
    )
    return unsub
  }, [])

  useEffect(() => {
    if (!selectedId) {
      setMessages([])
      return
    }
    markConversationReadByStaff(selectedId).catch(console.error)
    const unsub = subscribeMessages(selectedId, setMessages)
    return unsub
  }, [selectedId])

  if (!user) return null

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-jakarta text-2xl font-bold text-[#0B3D6B] dark:text-white">
          Messages
        </h1>
        <div className="mt-1 h-1 w-16 rounded bg-[#E8A020]" />
        <p className="mt-2 text-sm text-[#5A6A7A]">In-app chat with students</p>
      </div>

      <div className="flex h-[calc(100vh-14rem)] overflow-hidden rounded-2xl border border-[#DDE3EC] bg-white shadow-sm dark:border-gray-600 dark:bg-gray-800">
        <ConversationList
          conversations={conversations}
          loading={loading}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onCreated={setSelectedId}
          user={user}
          onAiFollowUp={(conv) => void openAiFollowUp(conv)}
        />
        <div className="hidden flex-1 flex-col md:flex">
          <ChatWindow
            conversation={selected}
            messages={messages}
            user={user}
            onAiFollowUp={selected ? () => void openAiFollowUp(selected) : undefined}
          />
        </div>
      </div>

      <WhatsAppFollowUpModal
        student={followUpStudent}
        staffName={user.displayName || user.email || 'Epic Campus'}
        open={!!followUpStudent}
        onClose={() => setFollowUpStudent(null)}
        defaultMessageType="general"
      />
    </div>
  )
}
