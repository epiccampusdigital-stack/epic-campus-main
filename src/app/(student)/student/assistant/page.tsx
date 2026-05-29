'use client'

import { useEffect, useRef, useState } from 'react'
import { COURSE_MAP } from '@/lib/constants/courses'
import { useStudentPortal } from '@/components/student/StudentContext'
import type { CourseId } from '@/types'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

const STUDY_PROMPTS: Record<string, string> = {
  'japan-ssw': `You are a Japanese language and SSW exam tutor for EPIC Campus students.
Help students with: JLPT N5/N4/N3 grammar, vocabulary, kanji, listening comprehension, SSW skills test preparation, Japanese workplace culture, and understanding their exam results and mistakes.
Be encouraging, patient, and use simple examples. When explaining Japanese, show: Japanese text (hiragana/katakana/kanji) | Romaji | English meaning.
For exam mistakes, explain WHY the answer was wrong, not just what the correct answer is.`,

  'korea-d2d4': `You are a Korean language and TOPIK exam tutor for EPIC Campus students.
Help students with: Korean alphabet (Hangul), TOPIK Level 1-4 preparation, Korean grammar, vocabulary, Korean university life tips, and D-4/D-2 visa questions.
Be encouraging and patient. Show Korean text alongside romanization and English meaning when explaining vocabulary.`,

  ielts: `You are an IELTS preparation tutor for EPIC Campus students.
Help students with: IELTS Academic Reading strategies, Writing Task 1 (graphs/charts) and Task 2 (essays), Listening techniques, Speaking fluency and vocabulary.
Give specific band score improvement tips. Review essay drafts if students share them. Point out specific grammar and vocabulary improvements.`,

  default: `You are a helpful study assistant for EPIC Campus students in Sri Lanka.
Help with general study skills, English language improvement, and questions about studying abroad in Japan, Korea, or China.`,
}

const SUGGESTED_QUESTIONS: Record<string, string[]> = {
  'japan-ssw': [
    'Explain JLPT N4 て-form',
    'What is SSW Truck Driving exam?',
    "How do I say 'I work in logistics' in Japanese?",
    'Explain particle は vs が',
  ],
  'korea-d2d4': [
    'Teach me Hangul basics',
    'What is TOPIK Level 2?',
    'How do I count in Korean?',
    'Explain Korean honorifics',
  ],
  ielts: [
    'Review my Task 2 essay',
    'How to improve Band score from 6 to 7?',
    'Explain academic vocabulary',
    'Writing Task 1 tips',
  ],
  default: [
    'How to improve English?',
    'Study tips for exams',
    'About studying in Korea',
    'About working in Japan',
  ],
}

const GREETINGS: Record<string, string> = {
  'japan-ssw':
    "Hi! I'm your Japanese language & SSW study assistant. Ask me about JLPT, kanji, grammar, or workplace Japanese.",
  'korea-d2d4':
    "Hi! I'm your Korean language tutor. Ask me about Hangul, TOPIK, grammar, or studying in Korea.",
  ielts:
    "Hi! I'm your IELTS preparation tutor. Ask me about Reading, Writing, Listening, or Speaking strategies.",
  default:
    "Hi! I'm your EPIC Campus study assistant. Ask me anything about your program or study skills.",
}

function resolvePromptKey(courseId: CourseId): string {
  if (courseId in STUDY_PROMPTS) return courseId
  if (courseId.startsWith('nvq')) return 'default'
  if (courseId === 'china') return 'default'
  return 'default'
}

export default function StudentAssistantPage() {
  const { student } = useStudentPortal()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const promptKey = student ? resolvePromptKey(student.courseId) : 'default'
  const systemPrompt = STUDY_PROMPTS[promptKey] ?? STUDY_PROMPTS.default
  const suggestions = SUGGESTED_QUESTIONS[promptKey] ?? SUGGESTED_QUESTIONS.default
  const programLabel = student ? (COURSE_MAP[student.courseId]?.label ?? student.courseId) : ''

  useEffect(() => {
    setMessages([
      {
        role: 'assistant',
        content: GREETINGS[promptKey] ?? GREETINGS.default,
      },
    ])
  }, [promptKey])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function sendMessage(text: string) {
    const trimmed = text.trim()
    if (!trimmed || loading) return

    const userMsg: ChatMessage = { role: 'user', content: trimmed }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setInput('')
    setLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          system: systemPrompt,
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await response.json()
      const reply =
        data.content?.[0]?.text ||
        'Sorry, I could not get a response. Please try again or contact info@epiccampus.lk'
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            'Connection error. Please try again or contact info@epiccampus.lk',
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  function handleNewConversation() {
    setMessages([
      {
        role: 'assistant',
        content: GREETINGS[promptKey] ?? GREETINGS.default,
      },
    ])
    setInput('')
  }

  if (!student) return null

  return (
    <div className="flex h-[calc(100vh-10rem)] flex-col gap-4 lg:flex-row">
      {/* Suggested questions — desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col rounded-2xl border border-[#DDE3EC] bg-white p-4 shadow-sm lg:flex">
        <h3 className="font-jakarta text-sm font-bold text-[#0B3D6B]">Suggested questions</h3>
        <div className="mt-3 flex flex-col gap-2">
          {suggestions.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => sendMessage(q)}
              disabled={loading}
              className="rounded-xl border border-[#DDE3EC] px-3 py-2 text-left text-xs text-[#0D1B2A] transition-colors hover:border-[#E8A020] hover:bg-[#F5F7FB] disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
      </aside>

      {/* Main chat */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-[#DDE3EC] bg-white shadow-sm">
        <div className="flex items-start justify-between gap-4 border-b border-[#DDE3EC] px-6 py-4">
          <div>
            <h2 className="font-jakarta text-lg font-bold text-[#0B3D6B]">AI Study Assistant</h2>
            <p className="text-sm text-[#5A6A7A]">{programLabel}</p>
          </div>
          <button
            type="button"
            onClick={handleNewConversation}
            className="shrink-0 rounded-full border border-[#DDE3EC] px-4 py-1.5 text-xs font-medium text-[#0B3D6B] transition-colors hover:border-[#E8A020] hover:bg-[#F5F7FB]"
          >
            New Conversation
          </button>
        </div>

        {/* Mobile suggestions */}
        <div className="flex gap-2 overflow-x-auto border-b border-[#DDE3EC] px-4 py-3 lg:hidden">
          {suggestions.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => sendMessage(q)}
              disabled={loading}
              className="shrink-0 rounded-full border border-[#DDE3EC] px-3 py-1 text-xs text-[#0D1B2A] hover:border-[#E8A020] disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto bg-[#F5F7FB] p-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'rounded-br-sm bg-[#0B3D6B] text-white'
                    : 'rounded-bl-sm border border-gray-100 bg-white text-gray-800 shadow-sm'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-sm border border-gray-100 bg-white px-4 py-2 shadow-sm">
                <span className="flex gap-1">
                  <span
                    className="h-2 w-2 animate-bounce rounded-full bg-gray-400"
                    style={{ animationDelay: '0ms' }}
                  />
                  <span
                    className="h-2 w-2 animate-bounce rounded-full bg-gray-400"
                    style={{ animationDelay: '150ms' }}
                  />
                  <span
                    className="h-2 w-2 animate-bounce rounded-full bg-gray-400"
                    style={{ animationDelay: '300ms' }}
                  />
                </span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="flex gap-2 border-t border-[#DDE3EC] bg-white p-4">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
            placeholder="Ask a study question..."
            className="flex-1 rounded-full border border-[#DDE3EC] px-4 py-2 text-sm outline-none transition-colors focus:border-[#0B3D6B]"
          />
          <button
            type="button"
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#E8A020] text-white transition-colors hover:bg-[#d4911c] disabled:opacity-50"
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  )
}
