'use client'

import { useState, useRef, useEffect } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const SYSTEM_PROMPT = `You are the EPIC Campus AI assistant. EPIC Campus is a leading overseas education and employment institute in Sri Lanka, founded in 2011, located at No. 59/2, Sri Dewamitta Road, China Garden, Galle, Sri Lanka.

PROGRAMS:
- Japan SSW Program: Work in Japan via Specified Skilled Worker visa. No degree needed for many categories. Jobs: Truck Driving, Construction, Manufacturing, Agriculture, Caregiving, Airport Handling. Language: JLPT N5→N3. Duration: 3-9 months training. 1,500+ students placed. 98% success rate.
- Korea D-4→D-2 Program: Study in Korea. After O/L: 1-year Korean language then D-4 visa. After A/L: direct degree. TOPIK Level 2+ required. Bank statement ~USD 10,000. Full and partial scholarships available.
- China Program: Study at top Chinese universities. Full scholarships available (tuition + accommodation + stipend). Popular fields: Medicine, Business, IT, Engineering. HSK preparation provided.
- IELTS Residential Program: 10-day intensive residential program. Target Band 6.0-7.0+. Daily mock exams. Dedicated IELTS site: epicielts.live
- NVQ Programs: TVEC-approved (Reg: A13430, valid Jul 2027). Categories: IT, Hospitality, Caregiving, Construction, Logistics, Business. NVQ Level 3, 3-6 months.

CONTACT: Phone: +94 91 222 83 83 | +94 76 254 8383 | Email: info@epiccampus.lk | Website: epiccampus.live
SOCIAL: Facebook: Epiccampus | Instagram: Epicampusdigital | TikTok: Epic_campus

FEES: Do not quote exact fees — tell students to contact EPIC Campus directly for current fee structures.

BEHAVIOR:
- Be warm, helpful, professional
- Answer questions about programs, requirements, visa processes, scholarships
- For anything you are unsure about, say "Please contact us at info@epiccampus.lk or call +94 91 222 83 83"
- Keep responses concise — 2-4 sentences unless more detail is needed
- Always end with an offer to help further or a call to action`

export default function ChatBot() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        "Hi! 👋 I'm the EPIC Campus assistant. Ask me about our Japan, Korea, China, IELTS, or NVQ programs — I'm here to help!",
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function send() {
    if (!input.trim() || loading) return
    const userMsg: Message = { role: 'user', content: input.trim() }
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
          system: SYSTEM_PROMPT,
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await response.json()
      const reply =
        data.content?.[0]?.text ||
        'Sorry, I could not get a response. Please contact info@epiccampus.lk'
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            'Connection error. Please contact us at info@epiccampus.lk or call +94 91 222 83 83',
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-6 z-50 flex h-[500px] w-80 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl sm:w-96">
          <div className="flex items-center justify-between bg-[#0B3D6B] px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E8A020] text-sm font-bold text-white">
                E
              </div>
              <div>
                <div className="text-sm font-semibold text-white">EPIC Campus Assistant</div>
                <div className="text-xs text-green-300">● Online</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xl text-white/70 hover:text-white"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto bg-gray-50 p-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
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

          <div className="flex gap-2 border-t border-gray-200 bg-white p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder="Ask about our programs..."
              className="flex-1 rounded-full border border-gray-200 px-4 py-2 text-sm outline-none transition-colors focus:border-[#0B3D6B]"
            />
            <button
              type="button"
              onClick={send}
              disabled={loading || !input.trim()}
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#E8A020] text-white transition-colors hover:bg-[#d4911c] disabled:opacity-50"
            >
              ➤
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#0B3D6B] text-2xl text-white shadow-lg transition-all hover:scale-110 hover:bg-[#0a3460]"
      >
        {open ? '✕' : '💬'}
      </button>
    </>
  )
}
