'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { auth } from '@/lib/firebase/client'
import { useStudentPortal } from '@/components/student/StudentContext'
import {
  addJpSupportMessage,
  escalateJpSupportThread,
  getJpSupportThread,
  listJpSupportMessages,
} from '@/lib/jp/support'
import type { JpSupportMessage, JpSupportThread } from '@/types'

const AUTHOR_LABEL: Record<JpSupportMessage['author'], string> = {
  student: 'You',
  ai: 'EPIC AI Assistant',
  staff: 'EPIC Staff',
}

function bubbleClasses(author: JpSupportMessage['author']): string {
  if (author === 'student') {
    return 'ml-auto bg-[#E8A020] text-[#0B3D6B]'
  }
  if (author === 'staff') {
    return 'bg-[#0B3D6B] text-white'
  }
  return 'bg-white border border-[#DDE3EC] text-[#0D1B2A] dark:border-white/10 dark:bg-slate-800 dark:text-white'
}

export default function JapaneseSupportThreadPage() {
  const params = useParams()
  const threadId = params.threadId as string
  const router = useRouter()
  const { student } = useStudentPortal()

  const [thread, setThread] = useState<JpSupportThread | null>(null)
  const [messages, setMessages] = useState<JpSupportMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [escalating, setEscalating] = useState(false)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [threadResult, messagesResult] = await Promise.all([
        getJpSupportThread(threadId),
        listJpSupportMessages(threadId),
      ])
      if (!threadResult) {
        toast.error('Question not found.')
        router.replace('/student/japanese/support')
        return
      }
      setThread(threadResult)
      setMessages(messagesResult)
    } catch (err) {
      console.error('[JapaneseSupportThreadPage] load', err)
      toast.error('Could not load this conversation.')
    } finally {
      setLoading(false)
    }
  }, [threadId, router])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'nearest' })
  }, [messages])

  async function handleSendReply() {
    if (!reply.trim() || !student) return
    setSending(true)
    try {
      await addJpSupportMessage(threadId, { author: 'student', authorUid: student.uid ?? '', body: reply.trim() })
      setReply('')
      await load()

      // Only ask the AI again if a human hasn't already taken this thread.
      if (thread && thread.status !== 'escalated' && thread.status !== 'closed') {
        const token = await auth.currentUser?.getIdToken()
        await fetch('/api/jp/support/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}` },
          body: JSON.stringify({ threadId, question: reply.trim() }),
        }).catch((err) => console.error('[JapaneseSupportThreadPage] ask', err))
        await load()
      }
    } catch (err) {
      console.error('[JapaneseSupportThreadPage] send reply', err)
      toast.error('Could not send your message.')
    } finally {
      setSending(false)
    }
  }

  async function handleEscalate() {
    setEscalating(true)
    try {
      await escalateJpSupportThread(threadId)
      toast.success('A staff member will reply here soon.')
      await load()
    } catch (err) {
      console.error('[JapaneseSupportThreadPage] escalate', err)
      toast.error('Could not reach a human right now — please try again.')
    } finally {
      setEscalating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-[#0B3D6B] border-t-[#E8A020]" />
      </div>
    )
  }

  if (!thread) return null

  const isClosed = thread.status === 'closed'

  return (
    <div className="mx-auto flex max-w-2xl flex-col space-y-4">
      <div>
        <Link
          href="/student/japanese/support"
          className="font-inter text-xs font-medium text-[#5A6A7A] hover:text-[#0B3D6B] dark:text-white/50 dark:hover:text-white"
        >
          ← Back to Help &amp; Ask
        </Link>
        <div className="mt-2 flex items-center justify-between gap-3">
          <h1 className="font-jakarta text-lg font-bold text-[#0B3D6B] dark:text-white">{thread.subject}</h1>
          <button
            type="button"
            disabled={escalating || thread.status === 'escalated' || isClosed}
            onClick={() => void handleEscalate()}
            className="shrink-0 rounded-lg border border-[#0B3D6B] px-3 py-1.5 font-jakarta text-xs font-bold text-[#0B3D6B] hover:bg-[#0B3D6B]/5 disabled:opacity-50 dark:border-white/30 dark:text-white"
          >
            {thread.status === 'escalated' ? 'With a human' : escalating ? 'Requesting…' : 'Talk to a human'}
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-3 rounded-xl border border-[#DDE3EC] bg-[#F5F7FB] p-4 dark:border-white/10 dark:bg-slate-900/40">
        {messages.map((m) => (
          <div key={m.id} className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${bubbleClasses(m.author)}`}>
            <p className="font-inter text-[11px] font-semibold uppercase tracking-wide opacity-70">
              {AUTHOR_LABEL[m.author]}
            </p>
            <p className="mt-0.5 whitespace-pre-wrap font-inter text-sm">{m.body}</p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {isClosed ? (
        <p className="text-center font-inter text-sm text-[#5A6A7A] dark:text-white/50">
          This conversation is closed. Ask a new question if you need more help.
        </p>
      ) : (
        <div className="flex items-end gap-2">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Type a message…"
            rows={2}
            className="flex-1 rounded-lg border border-[#DDE3EC] bg-white px-3 py-2 font-inter text-sm text-[#0D1B2A] focus:border-[#1A6BAD] focus:outline-none dark:border-white/10 dark:bg-slate-800 dark:text-white"
          />
          <button
            type="button"
            disabled={sending || !reply.trim()}
            onClick={() => void handleSendReply()}
            className="rounded-lg bg-[#E8A020] px-4 py-2.5 font-jakarta text-sm font-bold text-[#0B3D6B] hover:bg-[#F5B942] disabled:opacity-50"
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      )}
    </div>
  )
}
