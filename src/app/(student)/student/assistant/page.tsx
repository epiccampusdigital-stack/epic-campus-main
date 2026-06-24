'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  doc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useStudentPortal } from '@/components/student/StudentContext'
import {
  STUDY_MODE_CONFIGS,
  getModeConfig,
  getDefaultModeForCourse,
} from '@/lib/ai/studyModes'
import type { StudyMode } from '@/types'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface PracticeQuestion {
  id: string
  question: string
  userAnswer: string
  submitted: boolean
  feedback?: string
}

const MODEL = 'claude-haiku-4-5-20251001'

function renderMarkdown(text: string): string {
  return text
    // Code blocks (must come before inline code)
    .replace(/```[\w]*\n?([\s\S]*?)```/g, '<pre class="mt-2 mb-2 rounded-xl bg-[#0B3D6B]/10 dark:bg-white/[0.06] p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap">$1</pre>')
    // Headers
    .replace(/^### (.+)$/gm, '<h3 class="text-sm font-bold text-[#0B3D6B] dark:text-[#E8A020] mt-3 mb-1">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-sm font-bold text-[#0B3D6B] dark:text-[#E8A020] mt-4 mb-1">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-base font-bold text-[#0B3D6B] dark:text-[#E8A020] mt-4 mb-2">$1</h1>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold">$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em class="italic">$1</em>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="rounded bg-[#0B3D6B]/10 dark:bg-white/10 px-1.5 py-0.5 text-xs font-mono text-[#0B3D6B] dark:text-[#E8A020]">$1</code>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr class="my-3 border-[#DDE3EC] dark:border-white/20" />')
    // Tables
    .replace(/\|(.+)\|\n\|[-| :]+\|\n((?:\|.+\|\n?)*)/g, (_: string, header: string, body: string) => {
      const heads = header.split('|').map((h: string) => h.trim()).filter(Boolean)
      const rows = body.trim().split('\n').map((r: string) =>
        r.split('|').map((c: string) => c.trim()).filter(Boolean)
      )
      const headHtml = heads.map((h: string) => `<th class="px-3 py-2 text-left text-xs font-bold text-[#0B3D6B] dark:text-[#E8A020] border-b border-[#DDE3EC] dark:border-white/20">${h}</th>`).join('')
      const rowHtml = rows.map((cells: string[]) =>
        `<tr class="border-b border-[#DDE3EC]/50 dark:border-white/10">${cells.map((c: string) => `<td class="px-3 py-2 text-xs">${c}</td>`).join('')}</tr>`
      ).join('')
      return `<div class="overflow-x-auto my-2"><table class="w-full text-left rounded-xl overflow-hidden border border-[#DDE3EC] dark:border-white/20"><thead><tr>${headHtml}</tr></thead><tbody>${rowHtml}</tbody></table></div>`
    })
    // Unordered lists
    .replace(/^[-•] (.+)$/gm, '<li class="ml-4 list-disc text-sm leading-relaxed">$1</li>')
    .replace(/(<li[\s\S]*?<\/li>)+/g, '<ul class="my-1.5 space-y-0.5">$&</ul>')
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal text-sm leading-relaxed">$1</li>')
    // Spoiler tags
    .replace(/>!(.+?)!</g, '<span class="rounded bg-[#5A6A7A]/20 px-1 text-[#5A6A7A] dark:text-white/50 cursor-pointer hover:bg-transparent hover:text-inherit">$1</span>')
    // Newlines
    .replace(/\n\n/g, '</p><p class="mt-2">')
    .replace(/\n/g, '<br/>')
}
const MAX_HISTORY = 30

async function chatRequest(
  messages: { role: string; content: string }[],
  system: string,
): Promise<string> {
  const response = await fetch('/api/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1536,
      system,
      messages,
    }),
  })

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`)
  }

  const data = await response.json() as { content?: string; error?: string }
  if (data.error) throw new Error(data.error)
  return data.content ?? ''
}

export default function StudentAssistantPage() {
  const { student } = useStudentPortal()

  const defaultMode: StudyMode = student
    ? getDefaultModeForCourse(student.courseId)
    : 'general'

  const [mode, setMode] = useState<StudyMode>(defaultMode)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [historyLoading, setHistoryLoading] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [practiceQs, setPracticeQs] = useState<PracticeQuestion[] | null>(null)
  const [generatingPractice, setGeneratingPractice] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const sessionDocRef = useRef<ReturnType<typeof doc> | null>(null)
  const sessionMsgCount = useRef(0)

  const modeConfig = getModeConfig(mode)

  // ── Load chat history from Firestore ────────────────────────────────────────
  const loadHistory = useCallback(
    async (forMode: StudyMode) => {
      if (!student) return
      setHistoryLoading(true)
      try {
        const snap = await getDocs(
          query(
            collection(db, 'aiChatHistory', student.id, 'messages'),
            where('mode', '==', forMode),
            orderBy('createdAt', 'desc'),
            limit(MAX_HISTORY),
          ),
        )
        const loaded: ChatMessage[] = snap.docs
          .reverse()
          .map((d) => ({
            id: d.id,
            role: d.data().role as 'user' | 'assistant',
            content: String(d.data().content ?? ''),
          }))

        const config = getModeConfig(forMode)
        setMessages(
          loaded.length > 0
            ? loaded
            : [{ id: 'greeting', role: 'assistant', content: config.greeting }],
        )
      } catch {
        const config = getModeConfig(forMode)
        setMessages([{ id: 'greeting', role: 'assistant', content: config.greeting }])
      } finally {
        setHistoryLoading(false)
      }
    },
    [student],
  )

  // ── Start a study session ────────────────────────────────────────────────────
  const startSession = useCallback(
    async (forMode: StudyMode) => {
      if (!student) return
      sessionMsgCount.current = 0
      try {
        const ref = await addDoc(collection(db, 'studySessions'), {
          studentId: student.id,
          mode: forMode,
          startedAt: serverTimestamp(),
          endedAt: null,
          messageCount: 0,
          practiceQuestionsAnswered: 0,
          practiceQuestionsCorrect: 0,
        })
        sessionDocRef.current = doc(db, 'studySessions', ref.id)
      } catch {
        // non-critical
      }
    },
    [student],
  )

  const endSession = useCallback(async () => {
    if (!sessionDocRef.current) return
    try {
      await updateDoc(sessionDocRef.current, {
        endedAt: serverTimestamp(),
        messageCount: sessionMsgCount.current,
      })
    } catch {
      // non-critical
    }
    sessionDocRef.current = null
  }, [])

  // ── Initialise on mount ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!student) return
    void loadHistory(mode)
    void startSession(mode)
    return () => {
      void endSession()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student])

  // ── Change mode ──────────────────────────────────────────────────────────────
  async function changeMode(newMode: StudyMode) {
    if (newMode === mode || loading) return
    setPracticeQs(null)
    setInput('')
    await endSession()
    setMode(newMode)
    await loadHistory(newMode)
    await startSession(newMode)
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText])

  // ── Save a message to Firestore ──────────────────────────────────────────────
  async function saveMessage(
    role: 'user' | 'assistant',
    content: string,
    currentMode: StudyMode,
  ) {
    if (!student) return
    try {
      await addDoc(collection(db, 'aiChatHistory', student.id, 'messages'), {
        role,
        content,
        mode: currentMode,
        createdAt: serverTimestamp(),
      })
    } catch {
      // non-critical
    }
  }

  // ── Send a message ───────────────────────────────────────────────────────────
  async function sendMessage(text: string) {
    const trimmed = text.trim()
    if (!trimmed || loading) return

    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', content: trimmed }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setInput('')
    setLoading(true)
    setStreamingText('')
    setPracticeQs(null)

    await saveMessage('user', trimmed, mode)
    sessionMsgCount.current += 1

    const apiMessages = nextMessages
      .filter((m) => m.id !== 'greeting')
      .map((m) => ({ role: m.role, content: m.content }))

    try {
      const reply = await chatRequest(apiMessages, modeConfig.systemPrompt)

      const aiMsg: ChatMessage = { id: `a-${Date.now()}`, role: 'assistant', content: reply }
      setMessages((prev) => [...prev, aiMsg])
      setStreamingText('')
      await saveMessage('assistant', reply, mode)
      sessionMsgCount.current += 1
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: 'Connection error. Please try again or contact info@epiccampus.lk',
        },
      ])
      setStreamingText('')
    } finally {
      setLoading(false)
    }
  }

  // ── Clear chat ───────────────────────────────────────────────────────────────
  async function clearChat() {
    if (!student || loading) return
    setMessages([{ id: 'greeting', role: 'assistant', content: modeConfig.greeting }])
    setPracticeQs(null)
    setInput('')
    // Delete Firestore history for this mode
    try {
      const snap = await getDocs(
        query(
          collection(db, 'aiChatHistory', student.id, 'messages'),
          where('mode', '==', mode),
        ),
      )
      await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)))
    } catch {
      // non-critical
    }
  }

  // ── Copy message ─────────────────────────────────────────────────────────────
  async function copyMessage(id: string, content: string) {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(id)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      // not supported
    }
  }

  // ── Generate practice questions ──────────────────────────────────────────────
  async function generatePracticeQuestions() {
    if (loading || generatingPractice) return
    setGeneratingPractice(true)
    setPracticeQs(null)

    const prompt = `Generate exactly 5 practice questions for ${modeConfig.label} mode.
Format each question as:
Q[number]: [question text]

Keep questions varied and appropriate for JLPT N5/N4 or the current subject level.
Do not include answers yet — just the questions.`

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: prompt,
    }
    const apiMessages = [
      ...messages
        .filter((m) => m.id !== 'greeting')
        .map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: prompt },
    ]

    try {
      const reply = await chatRequest(apiMessages, modeConfig.systemPrompt)

      // Parse questions from response
      const lines = reply.split('\n').filter((l) => /^Q\d/.test(l.trim()))
      const parsed: PracticeQuestion[] = lines.slice(0, 5).map((line, i) => ({
        id: `pq-${i}`,
        question: line.replace(/^Q\d+[.:]\s*/, '').trim(),
        userAnswer: '',
        submitted: false,
      }))

      if (parsed.length > 0) {
        setPracticeQs(parsed)
      } else {
        // Fallback: show raw response as a message
        setMessages((prev) => [
          ...prev,
          userMsg,
          { id: `a-${Date.now()}`, role: 'assistant', content: reply },
        ])
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: 'Could not generate practice questions. Please try again.',
        },
      ])
    } finally {
      setGeneratingPractice(false)
    }
  }

  // ── Submit practice answers ──────────────────────────────────────────────────
  async function submitPracticeAnswers() {
    if (!practiceQs || loading) return
    const answered = practiceQs.filter((q) => q.userAnswer.trim())
    if (answered.length === 0) return

    const feedbackPrompt = `Here are the student's answers to the practice questions. Please check each one and give brief feedback:

${practiceQs
  .map((q, i) => `Q${i + 1}: ${q.question}\nStudent's answer: ${q.userAnswer || '(no answer)'}`)
  .join('\n\n')}

For each question: state if correct/incorrect, give the right answer, and a brief explanation. Keep it concise and encouraging.`

    await sendMessage(feedbackPrompt)
    setPracticeQs(null)
  }

  if (!student) return null

  return (
    <div className="flex h-[calc(100vh-5rem)] flex-col gap-0 overflow-hidden">
      {/* ── Mode selector ── */}
      <div className="shrink-0 border-b border-[#DDE3EC] bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="flex gap-2 overflow-x-auto px-4 py-3 scrollbar-none">
          {STUDY_MODE_CONFIGS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => void changeMode(m.id)}
              disabled={loading}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                mode === m.id
                  ? 'bg-[#E8A020] text-white shadow-sm'
                  : 'border border-[#DDE3EC] bg-white text-gray-600 hover:border-[#E8A020] hover:text-[#E8A020] dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300'
              }`}
            >
              <span className={`ti ${m.icon} text-sm`} />
              {m.label}
            </button>
          ))}
        </div>
        <div className="px-4 pb-2">
          <p className="text-xs text-gray-400">{modeConfig.description}</p>
        </div>
      </div>

      {/* ── Main layout ── */}
      <div className="flex min-h-0 flex-1 gap-4 overflow-hidden p-4">
        {/* Suggested questions sidebar */}
        <aside className="hidden w-56 shrink-0 flex-col gap-2 overflow-y-auto lg:flex">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Try asking
          </h3>
          {modeConfig.suggestions.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => void sendMessage(q)}
              disabled={loading}
              className="rounded-xl border border-[#DDE3EC] px-3 py-2 text-left text-xs text-[#0D1B2A] transition-colors hover:border-[#E8A020] hover:bg-[#F5F7FB] disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              {q}
            </button>
          ))}

          {modeConfig.hasPracticeQuestions && (
            <button
              type="button"
              onClick={() => void generatePracticeQuestions()}
              disabled={loading || generatingPractice}
              className="mt-2 flex items-center justify-center gap-1.5 rounded-xl bg-[#0B3D6B] px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-[#0a3460] disabled:opacity-50"
            >
              {generatingPractice ? (
                <span className="ti ti-loader-2 animate-spin" />
              ) : (
                <span className="ti ti-list-check" />
              )}
              Generate Practice Questions
            </button>
          )}
        </aside>

        {/* Chat pane */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[#DDE3EC] bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#DDE3EC] px-4 py-3 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <span className={`ti ${modeConfig.icon} text-[#E8A020] text-lg`} />
              <span className="font-jakarta text-sm font-bold text-[#0B3D6B] dark:text-white">
                {modeConfig.label}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {/* Mobile: practice questions */}
              {modeConfig.hasPracticeQuestions && (
                <button
                  type="button"
                  onClick={() => void generatePracticeQuestions()}
                  disabled={loading || generatingPractice}
                  className="flex items-center gap-1 rounded-full border border-[#DDE3EC] px-3 py-1 text-xs font-medium text-[#0B3D6B] hover:border-[#E8A020] hover:bg-[#F5F7FB] disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 lg:hidden"
                >
                  {generatingPractice ? (
                    <span className="ti ti-loader-2 animate-spin" />
                  ) : (
                    <span className="ti ti-list-check" />
                  )}
                  Practice
                </button>
              )}
              <button
                type="button"
                onClick={() => void clearChat()}
                disabled={loading}
                className="flex items-center gap-1 rounded-full border border-[#DDE3EC] px-3 py-1 text-xs font-medium text-gray-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:border-gray-600 dark:text-gray-400"
              >
                <span className="ti ti-trash text-xs" />
                Clear
              </button>
            </div>
          </div>

          {/* Mobile suggestions */}
          <div className="flex gap-2 overflow-x-auto border-b border-[#DDE3EC] px-3 py-2 scrollbar-none dark:border-gray-700 lg:hidden">
            {modeConfig.suggestions.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => void sendMessage(q)}
                disabled={loading}
                className="shrink-0 rounded-full border border-[#DDE3EC] px-3 py-1 text-xs text-gray-700 hover:border-[#E8A020] disabled:opacity-50 dark:border-gray-600 dark:text-gray-300"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Messages */}
          <div className="flex-1 space-y-3 overflow-y-auto bg-[#F5F7FB] p-4 dark:bg-gray-900/50">
            {historyLoading ? (
              <div className="flex items-center justify-center py-8">
                <span className="ti ti-loader-2 animate-spin text-2xl text-[#0B3D6B]" />
              </div>
            ) : (
              <>
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`group flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className="relative max-w-[85%]">
                      <div
                        className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                          m.role === 'user'
                            ? 'rounded-br-sm bg-[#0B3D6B] text-white whitespace-pre-wrap'
                            : 'rounded-bl-sm border border-gray-100 bg-white text-gray-800 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100'
                        }`}
                      >
                        {m.role === 'user' ? m.content : (
                          <div
                            className="prose-sm max-w-none text-sm leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }}
                          />
                        )}
                      </div>
                      {m.role === 'assistant' && (
                        <button
                          type="button"
                          onClick={() => void copyMessage(m.id, m.content)}
                          className="absolute -bottom-2 right-1 flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100 dark:border-gray-600 dark:bg-gray-700"
                          title="Copy"
                        >
                          <span
                            className={`ti ${copied === m.id ? 'ti-check text-emerald-500' : 'ti-copy text-gray-400'} text-xs`}
                          />
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {/* Streaming token display */}
                {loading && streamingText && (
                  <div className="flex justify-start">
                    <div className="max-w-[85%] rounded-2xl rounded-bl-sm border border-gray-100 bg-white px-4 py-2.5 text-sm leading-relaxed text-gray-800 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
                      <div
                        className="prose-sm max-w-none text-sm leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(streamingText) }}
                      />
                      <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-[#E8A020]" />
                    </div>
                  </div>
                )}

                {/* Typing indicator (before first token) */}
                {loading && !streamingText && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl rounded-bl-sm border border-gray-100 bg-white px-4 py-3 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                      <span className="flex gap-1">
                        {[0, 150, 300].map((delay) => (
                          <span
                            key={delay}
                            className="h-2 w-2 animate-bounce rounded-full bg-gray-400"
                            style={{ animationDelay: `${delay}ms` }}
                          />
                        ))}
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Practice questions panel */}
          {practiceQs && (
            <div className="border-t border-[#DDE3EC] bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-semibold text-[#0B3D6B] dark:text-white">
                  Practice Questions — answer below
                </h3>
                <button
                  type="button"
                  onClick={() => setPracticeQs(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="ti ti-x text-sm" />
                </button>
              </div>
              <div className="max-h-40 space-y-2 overflow-y-auto">
                {practiceQs.map((q, i) => (
                  <div
                    key={q.id}
                    className="rounded-xl border border-[#DDE3EC] bg-[#F5F7FB] px-3 py-2 dark:border-gray-600 dark:bg-gray-700"
                  >
                    <p className="mb-1 text-xs font-medium text-gray-700 dark:text-gray-200">
                      {i + 1}. {q.question}
                    </p>
                    <input
                      className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs outline-none focus:border-[#0B3D6B] dark:border-gray-500 dark:bg-gray-800 dark:text-white"
                      placeholder="Your answer..."
                      value={q.userAnswer}
                      onChange={(e) =>
                        setPracticeQs((prev) =>
                          prev?.map((pq) =>
                            pq.id === q.id ? { ...pq, userAnswer: e.target.value } : pq,
                          ) ?? null
                        )
                      }
                    />
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => void submitPracticeAnswers()}
                disabled={loading}
                className="mt-2 w-full rounded-xl bg-[#E8A020] py-2 text-xs font-semibold text-white hover:bg-[#d4911c] disabled:opacity-50"
              >
                Submit Answers for Feedback
              </button>
            </div>
          )}

          {/* Input bar */}
          <div className="flex gap-2 border-t border-[#DDE3EC] bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void sendMessage(input)
                }
              }}
              placeholder={`Ask about ${modeConfig.label.toLowerCase()}...`}
              disabled={loading}
              className="flex-1 rounded-full border border-[#DDE3EC] px-4 py-2 text-sm outline-none transition-colors focus:border-[#0B3D6B] disabled:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
            />
            <button
              type="button"
              onClick={() => void sendMessage(input)}
              disabled={loading || !input.trim()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E8A020] text-white transition-colors hover:bg-[#d4911c] disabled:opacity-50"
              aria-label="Send"
            >
              <span className="ti ti-send text-sm" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
