'use client'

import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import {
  collection,
  collectionGroup,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { auth, db } from '@/lib/firebase/client'
import { useRouter } from 'next/navigation'

const PAGE_SIZE = 20
const ALLOWED_ROLES = ['admin', 'owner']

interface StudentSession {
  studentId: string
  studentName: string
  lastActive: string
  totalMessages: number
  modeUsed: string
}

interface PublicLog {
  id: string
  sessionId: string
  userMessage: string
  botResponse: string
  createdAt: string
  pageUrl: string
  userAgent: string
}

type Tab = 'student' | 'public'

export default function ChatLogsPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [tab, setTab] = useState<Tab>('student')

  // Student AI tab state
  const [studentSessions, setStudentSessions] = useState<StudentSession[]>([])
  const [studentLoading, setStudentLoading] = useState(true)
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null)
  const [studentMessages, setStudentMessages] = useState<{ role: string; content: string; createdAt: string; mode?: string }[]>([])
  const [studentMsgsLoading, setStudentMsgsLoading] = useState(false)
  const [studentSearch, setStudentSearch] = useState('')

  // Public chatbot tab state
  const [publicLogs, setPublicLogs] = useState<PublicLog[]>([])
  const [publicLoading, setPublicLoading] = useState(true)
  const [publicSearch, setPublicSearch] = useState('')
  const [publicDateFrom, setPublicDateFrom] = useState('')
  const [publicLastDoc, setPublicLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null)
  const [publicHasMore, setPublicHasMore] = useState(false)
  const [expandedLog, setExpandedLog] = useState<string | null>(null)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.replace('/login'); return }
      const token = await u.getIdTokenResult()
      if (!ALLOWED_ROLES.includes(token.claims.role as string)) { router.replace('/dashboard'); return }
      setAuthorized(true)
    })
    return () => unsub()
  }, [router])

  // Load student sessions from aiChatHistory (collectionGroup)
  useEffect(() => {
    if (!authorized || tab !== 'student') return
    setStudentLoading(true)

    async function load() {
      try {
        // Get all messages grouped by studentId
        const snap = await getDocs(
          query(collectionGroup(db, 'messages'), orderBy('createdAt', 'desc'), limit(500))
        )
        const byStudent: Record<string, StudentSession> = {}
        snap.docs.forEach((d) => {
          const data = d.data()
          const studentId = d.ref.parent.parent?.id ?? 'unknown'
          const createdAt = data.createdAt?.toDate?.()?.toISOString?.() ?? ''
          if (!byStudent[studentId]) {
            byStudent[studentId] = {
              studentId,
              studentName: String(data.studentName ?? studentId),
              lastActive: createdAt,
              totalMessages: 0,
              modeUsed: String(data.mode ?? 'general'),
            }
          }
          byStudent[studentId].totalMessages += 1
          if (createdAt > byStudent[studentId].lastActive) {
            byStudent[studentId].lastActive = createdAt
            byStudent[studentId].modeUsed = String(data.mode ?? byStudent[studentId].modeUsed)
          }
        })
        setStudentSessions(Object.values(byStudent).sort((a, b) => b.lastActive.localeCompare(a.lastActive)))
      } catch (err) {
        console.error('[ChatLogs student]', err)
      } finally {
        setStudentLoading(false)
      }
    }
    load()
  }, [authorized, tab])

  async function loadStudentMessages(studentId: string) {
    setStudentMsgsLoading(true)
    try {
      const snap = await getDocs(
        query(
          collection(db, 'aiChatHistory', studentId, 'messages'),
          orderBy('createdAt', 'asc'),
        )
      )
      setStudentMessages(snap.docs.map((d) => {
        const data = d.data()
        return {
          role: String(data.role ?? 'user'),
          content: String(data.content ?? ''),
          createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? '',
          mode: String(data.mode ?? ''),
        }
      }))
    } finally {
      setStudentMsgsLoading(false)
    }
  }

  function handleToggleStudent(studentId: string) {
    if (expandedStudent === studentId) {
      setExpandedStudent(null)
      setStudentMessages([])
    } else {
      setExpandedStudent(studentId)
      loadStudentMessages(studentId)
    }
  }

  // Load public logs
  async function loadPublicLogs(append = false) {
    setPublicLoading(true)
    try {
      let q = query(
        collection(db, 'publicChatLogs'),
        orderBy('createdAt', 'desc'),
        limit(PAGE_SIZE),
      )
      if (publicDateFrom) {
        q = query(q, where('createdAt', '>=', new Date(publicDateFrom)))
      }
      if (append && publicLastDoc) {
        q = query(q, startAfter(publicLastDoc))
      }
      const snap = await getDocs(q)
      const items: PublicLog[] = snap.docs.map((d) => {
        const data = d.data()
        return {
          id: d.id,
          sessionId: String(data.sessionId ?? ''),
          userMessage: String(data.userMessage ?? ''),
          botResponse: String(data.botResponse ?? ''),
          createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? '',
          pageUrl: String(data.pageUrl ?? ''),
          userAgent: String(data.userAgent ?? ''),
        }
      })
      setPublicLogs(append ? (prev) => [...prev, ...items] : items)
      setPublicLastDoc(snap.docs[snap.docs.length - 1] ?? null)
      setPublicHasMore(snap.docs.length === PAGE_SIZE)
    } catch (err) {
      console.error('[ChatLogs public]', err)
    } finally {
      setPublicLoading(false)
    }
  }

  useEffect(() => {
    if (!authorized || tab !== 'public') return
    setPublicLogs([])
    setPublicLastDoc(null)
    loadPublicLogs(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized, tab, publicDateFrom])

  function exportCsv() {
    const rows = publicLogs.map((l) => [
      l.sessionId, l.createdAt, l.userMessage.replace(/"/g, '""'), l.botResponse.replace(/"/g, '""'), l.pageUrl
    ])
    const csv = [['Session ID', 'Date', 'User Message', 'Bot Response', 'Page URL'], ...rows]
      .map((r) => r.map((c) => `"${c}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `chatbot-logs-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  const filteredStudents = studentSearch
    ? studentSessions.filter((s) =>
        s.studentId.toLowerCase().includes(studentSearch.toLowerCase()) ||
        s.studentName.toLowerCase().includes(studentSearch.toLowerCase())
      )
    : studentSessions

  const filteredPublic = publicSearch
    ? publicLogs.filter((l) =>
        l.userMessage.toLowerCase().includes(publicSearch.toLowerCase()) ||
        l.botResponse.toLowerCase().includes(publicSearch.toLowerCase()) ||
        l.sessionId.toLowerCase().includes(publicSearch.toLowerCase())
      )
    : publicLogs

  if (!authorized) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-[#0B3D6B] border-t-[#E8A020]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-jakarta text-2xl font-bold text-[#0D1B2A]">AI Chat Logs</h2>
        <p className="text-sm text-[#5A6A7A]">View AI conversations from the study assistant and public chatbot</p>
      </div>

      <div className="flex border-b border-[#DDE3EC]">
        {(['student', 'public'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === t ? 'border-[#E8A020] text-[#0B3D6B]' : 'border-transparent text-[#5A6A7A] hover:text-[#0B3D6B]'
            }`}
          >
            {t === 'student' ? 'Student AI Assistant' : 'Public Chatbot'}
          </button>
        ))}
      </div>

      {/* ── Student AI Assistant Tab ── */}
      {tab === 'student' && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <input
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              placeholder="Search by student name or ID…"
              className="flex-1 rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm focus:border-[#0B3D6B] focus:outline-none"
            />
            <span className="self-center text-sm text-[#5A6A7A]">{filteredStudents.length} students</span>
          </div>

          <div className="overflow-hidden rounded-xl border border-[#DDE3EC] bg-white">
            {studentLoading ? (
              <div className="animate-pulse divide-y divide-[#DDE3EC]">
                {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 px-4 py-4"><div className="h-3 w-full rounded bg-[#DDE3EC]" /></div>)}
              </div>
            ) : filteredStudents.length === 0 ? (
              <p className="px-6 py-12 text-center text-sm text-[#5A6A7A]">No AI chat sessions found.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[#DDE3EC] bg-[#F5F7FB]">
                  <tr>
                    {['Student', 'Last Active', 'Messages', 'Mode Used', ''].map((h) => (
                      <th key={h || 'action'} className="px-4 py-3 font-jakarta text-xs font-semibold uppercase tracking-wide text-[#5A6A7A]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DDE3EC]">
                  {filteredStudents.map((s) => (
                    <>
                      <tr key={s.studentId} className="hover:bg-[#F5F7FB]/60">
                        <td className="px-4 py-3 font-medium text-[#0D1B2A]">{s.studentName || s.studentId}</td>
                        <td className="px-4 py-3 text-[#5A6A7A]">{s.lastActive ? new Date(s.lastActive).toLocaleString() : '—'}</td>
                        <td className="px-4 py-3">{s.totalMessages}</td>
                        <td className="px-4 py-3 text-[#5A6A7A] capitalize">{s.modeUsed.replace(/-/g, ' ')}</td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => handleToggleStudent(s.studentId)}
                            className="text-xs font-semibold text-[#0B3D6B] hover:underline"
                          >
                            {expandedStudent === s.studentId ? 'Hide' : 'View'}
                          </button>
                        </td>
                      </tr>
                      {expandedStudent === s.studentId && (
                        <tr key={`${s.studentId}-msgs`}>
                          <td colSpan={5} className="bg-[#F5F7FB] px-4 py-4">
                            {studentMsgsLoading ? (
                              <p className="text-xs text-[#5A6A7A]">Loading…</p>
                            ) : (
                              <div className="max-h-80 space-y-2 overflow-y-auto">
                                {studentMessages.map((m, i) => (
                                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[80%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                                      m.role === 'user' ? 'bg-[#0B3D6B] text-white' : 'border border-gray-200 bg-white text-gray-700'
                                    }`}>
                                      {m.mode && <span className="mb-1 block text-[10px] opacity-60">[{m.mode}]</span>}
                                      {m.content}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Public Chatbot Tab ── */}
      {tab === 'public' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <input
              value={publicSearch}
              onChange={(e) => setPublicSearch(e.target.value)}
              placeholder="Search messages…"
              className="flex-1 rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm focus:border-[#0B3D6B] focus:outline-none"
            />
            <input
              type="date"
              value={publicDateFrom}
              onChange={(e) => setPublicDateFrom(e.target.value)}
              className="rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm focus:border-[#0B3D6B] focus:outline-none"
            />
            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex items-center gap-2 rounded-lg border border-[#DDE3EC] px-4 py-2 text-sm font-medium text-[#0B3D6B] hover:bg-[#F5F7FB]"
            >
              <span className="ti ti-download" /> Export CSV
            </button>
            <span className="self-center text-sm text-[#5A6A7A]">{filteredPublic.length} logs</span>
          </div>

          <div className="overflow-hidden rounded-xl border border-[#DDE3EC] bg-white">
            {publicLoading ? (
              <div className="animate-pulse divide-y divide-[#DDE3EC]">
                {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 px-4 py-4"><div className="h-3 w-full rounded bg-[#DDE3EC]" /></div>)}
              </div>
            ) : filteredPublic.length === 0 ? (
              <p className="px-6 py-12 text-center text-sm text-[#5A6A7A]">No public chat logs yet.</p>
            ) : (
              <table className="w-full min-w-[700px] text-left text-sm">
                <thead className="border-b border-[#DDE3EC] bg-[#F5F7FB]">
                  <tr>
                    {['Session', 'Date', 'User Message', 'Page', ''].map((h) => (
                      <th key={h || 'action'} className="px-4 py-3 font-jakarta text-xs font-semibold uppercase tracking-wide text-[#5A6A7A]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DDE3EC]">
                  {filteredPublic.map((l) => (
                    <>
                      <tr key={l.id} className="cursor-pointer hover:bg-[#F5F7FB]/60" onClick={() => setExpandedLog(expandedLog === l.id ? null : l.id)}>
                        <td className="px-4 py-3 font-mono text-xs text-[#5A6A7A]">{l.sessionId.slice(0, 12)}…</td>
                        <td className="px-4 py-3 text-[#5A6A7A]">{l.createdAt ? new Date(l.createdAt).toLocaleString() : '—'}</td>
                        <td className="max-w-xs px-4 py-3 truncate text-[#0D1B2A]">{l.userMessage}</td>
                        <td className="max-w-[120px] truncate px-4 py-3 text-xs text-[#5A6A7A]">{l.pageUrl.replace(/^https?:\/\/[^/]+/, '') || '/'}</td>
                        <td className="px-4 py-3 text-xs font-medium text-[#0B3D6B]">{expandedLog === l.id ? '▲' : '▼'}</td>
                      </tr>
                      {expandedLog === l.id && (
                        <tr key={`${l.id}-expand`}>
                          <td colSpan={5} className="bg-[#F5F7FB] px-6 py-4">
                            <div className="space-y-3">
                              <div>
                                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#5A6A7A]">User</p>
                                <p className="text-sm text-[#0D1B2A]">{l.userMessage}</p>
                              </div>
                              <div>
                                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[#5A6A7A]">Assistant</p>
                                <p className="whitespace-pre-wrap text-sm text-[#0D1B2A]">{l.botResponse}</p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {publicHasMore && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => loadPublicLogs(true)}
                disabled={publicLoading}
                className="rounded-lg border border-[#DDE3EC] px-5 py-2 text-sm font-medium text-[#0B3D6B] hover:bg-[#F5F7FB] disabled:opacity-60"
              >
                Load more
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
