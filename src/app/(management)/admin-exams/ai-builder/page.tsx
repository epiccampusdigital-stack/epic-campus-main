'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { collection, addDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useManagement } from '@/components/layout/ManagementContext'

interface GeneratedQuestion {
  questionText: string
  questionTextJP?: string
  options: { index: number; text: string }[]
  correctIndex: number
  explanation?: string
}

interface ExamPaper {
  id: string
  title: string
}

export default function AIQuestionBuilderPage() {
  const { user } = useManagement()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [mode, setMode] = useState<'topic' | 'document'>('topic')
  const [topic, setTopic] = useState('')
  const [subject, setSubject] = useState('japanese-language')
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium')
  const [count, setCount] = useState('5')
  const [language, setLanguage] = useState<'en' | 'jp' | 'both'>('both')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [generating, setGenerating] = useState(false)
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([])
  const [selectedPaper, setSelectedPaper] = useState('')
  const [papers, setPapers] = useState<ExamPaper[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getDocs(collection(db, 'examPapers')).then(snap => {
      setPapers(snap.docs.map(d => ({ id: d.id, title: String(d.data().title ?? '') })))
    }).catch(() => {})
  }, [])

  async function generateQuestions() {
    if (mode === 'topic' && !topic.trim()) { setError('Please enter a topic'); return }
    if (mode === 'document' && !uploadedFile) { setError('Please upload a document'); return }
    setGenerating(true)
    setError('')
    setQuestions([])

    try {
      let messageContent: { type: string; source?: { type: string; media_type: string; data: string }; text?: string }[]

      if (mode === 'document' && uploadedFile) {
        const arrayBuffer = await uploadedFile.arrayBuffer()
        const uint8Array = new Uint8Array(arrayBuffer)
        let binary = ''
        uint8Array.forEach(byte => { binary += String.fromCharCode(byte) })
        const base64Data = btoa(binary)
        const mediaType = uploadedFile.type || 'application/pdf'
        messageContent = [
          { type: 'document', source: { type: 'base64', media_type: mediaType, data: base64Data } },
          { type: 'text', text: `Generate ${count} multiple choice exam questions from this document. Each question must have exactly 3 options numbered 1, 2, 3. Difficulty: ${difficulty}. ${language === 'both' ? 'Show both English and Japanese versions.' : language === 'jp' ? 'Japanese only.' : 'English only.'} Return ONLY a valid JSON array, no markdown, no explanation: [{"questionText":"...","questionTextJP":"...","options":[{"index":1,"text":"..."},{"index":2,"text":"..."},{"index":3,"text":"..."}],"correctIndex":1,"explanation":"..."}]` }
        ]
      } else {
        messageContent = [
          { type: 'text', text: `Generate ${count} multiple choice exam questions about "${topic}" for ${subject} students. Difficulty: ${difficulty}. ${language === 'both' ? 'Show both English and Japanese.' : language === 'jp' ? 'Japanese only.' : 'English only.'} Each question must have exactly 3 options numbered 1, 2, 3. Return ONLY a valid JSON array, no markdown, no other text: [{"questionText":"English question","questionTextJP":"日本語の問題","options":[{"index":1,"text":"Option A"},{"index":2,"text":"Option B"},{"index":3,"text":"Option C"}],"correctIndex":2,"explanation":"Why this is correct"}]` }
        ]
      }

      const res = await fetch('/api/admin-exams/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: messageContent }),
      })

      const data = await res.json() as { text?: string; error?: string }
      if (!res.ok || data.error) {
        throw new Error(data.error ?? 'Generation failed')
      }
      const text = data.text ?? ''
      const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const parsed = JSON.parse(clean) as GeneratedQuestion[]
      setQuestions(parsed)
    } catch (err) {
      console.error('[AIBuilder]', err)
      setError('Failed to generate questions. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  async function saveToExamPaper() {
    if (!selectedPaper || questions.length === 0 || !user) return
    setSaving(true)
    try {
      const sectionSnap = await getDocs(
        query(collection(db, 'examSections'), where('paperId', '==', selectedPaper))
      )
      const sectionId = sectionSnap.docs[0]?.id ?? ''
      const existingQ = await getDocs(
        query(collection(db, 'examQuestions'), where('paperId', '==', selectedPaper))
      )
      let order = existingQ.size + 1
      for (const q of questions) {
        await addDoc(collection(db, 'examQuestions'), {
          paperId: selectedPaper,
          sectionId,
          order: order++,
          questionText: q.questionText,
          questionTextJP: q.questionTextJP ?? '',
          options: q.options,
          correctIndex: q.correctIndex,
          explanation: q.explanation ?? '',
          audioPlayLimit: 0,
          createdAt: serverTimestamp(),
          createdBy: user.uid,
          source: 'ai-generated',
        })
      }
      setSaved(true)
      setTimeout(() => router.push('/admin-exams'), 2000)
    } catch (err) {
      console.error('[SaveQ]', err)
      setError('Failed to save questions')
    } finally {
      setSaving(false)
    }
  }

  function updateQuestion(i: number, field: keyof GeneratedQuestion, value: unknown) {
    setQuestions(prev => prev.map((q, idx) => idx === i ? { ...q, [field]: value } : q))
  }

  function updateOption(qi: number, oi: number, text: string) {
    setQuestions(prev => prev.map((q, i) => i === qi ? {
      ...q, options: q.options.map((o, j) => j === oi ? { ...o, text } : o)
    } : q))
  }

  if (!user) return null

  const inputClass = 'w-full rounded-xl border border-[#DDE3EC] dark:border-white/20 bg-[#F5F7FB] dark:bg-white/[0.04] px-3 py-2.5 text-sm text-[#0D1B2A] dark:text-white outline-none focus:border-[#E8A020]'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-jakarta text-2xl font-bold text-[#0D1B2A] dark:text-white flex items-center gap-2">
            <span className="ti ti-sparkles text-[#E8A020]" /> AI Question Builder
          </h1>
          <p className="text-sm text-[#5A6A7A] dark:text-white/50">Generate exam questions using AI from topics or uploaded documents</p>
        </div>
        <button type="button" onClick={() => router.push('/admin-exams')}
          className="flex items-center gap-2 rounded-xl border border-[#DDE3EC] dark:border-white/20 px-4 py-2 text-sm font-semibold text-[#5A6A7A] dark:text-white/60">
          <span className="ti ti-arrow-left" /> Back
        </button>
      </div>

      <div className="flex gap-3">
        {[
          { value: 'topic', label: '💬 From Topic', desc: 'Type any subject or topic' },
          { value: 'document', label: '📄 From Document', desc: 'Upload PDF, image, or textbook page' },
        ].map(m => (
          <button key={m.value} type="button" onClick={() => setMode(m.value as 'topic' | 'document')}
            className={`flex-1 rounded-2xl border-2 p-4 text-left transition-all ${mode === m.value ? 'border-[#E8A020] bg-[#E8A020]/10' : 'border-[#DDE3EC] dark:border-white/20 bg-white dark:bg-white/[0.04]'}`}>
            <p className="font-jakarta font-bold text-[#0B3D6B] dark:text-white">{m.label}</p>
            <p className="text-xs text-[#5A6A7A] dark:text-white/50 mt-0.5">{m.desc}</p>
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-5 space-y-4">
        {mode === 'topic' ? (
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-[#5A6A7A] dark:text-white/50">Topic *</label>
              <input type="text" value={topic} onChange={e => setTopic(e.target.value)}
                placeholder="e.g. Japanese workplace greetings, Hiragana reading, N5 vocabulary..."
                className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-[#5A6A7A] dark:text-white/50">Subject</label>
                <select value={subject} onChange={e => setSubject(e.target.value)} className={inputClass}>
                  <option value="japanese-language">Japanese Language</option>
                  <option value="korean-language">Korean Language</option>
                  <option value="chinese-language">Chinese Language</option>
                  <option value="ielts">IELTS Preparation</option>
                  <option value="workplace-japanese">Workplace Japanese</option>
                  <option value="japanese-culture">Japanese Culture & Rules</option>
                  <option value="general">General Knowledge</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold text-[#5A6A7A] dark:text-white/50">Language Mode</label>
                <select value={language} onChange={e => setLanguage(e.target.value as 'en' | 'jp' | 'both')} className={inputClass}>
                  <option value="both">Both EN + JP</option>
                  <option value="en">English Only</option>
                  <option value="jp">Japanese Only</option>
                </select>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <label className="mb-1.5 block text-xs font-bold text-[#5A6A7A] dark:text-white/50">Upload Document *</label>
            <div onClick={() => fileInputRef.current?.click()}
              className="cursor-pointer rounded-xl border-2 border-dashed border-[#DDE3EC] dark:border-white/20 p-8 text-center hover:border-[#E8A020] transition-all">
              <span className="ti ti-upload text-3xl text-[#DDE3EC] dark:text-white/20" />
              <p className="mt-2 text-sm font-semibold text-[#5A6A7A] dark:text-white/50">
                {uploadedFile ? `✅ ${uploadedFile.name}` : 'Click to upload PDF or image'}
              </p>
              <p className="text-xs text-[#5A6A7A]/60 mt-1">Irodori textbook pages, worksheets, study materials</p>
            </div>
            <input ref={fileInputRef} type="file" accept="application/pdf,image/*"
              onChange={e => setUploadedFile(e.target.files?.[0] ?? null)} className="hidden" />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-bold text-[#5A6A7A] dark:text-white/50">Number of Questions</label>
            <select value={count} onChange={e => setCount(e.target.value)} className={inputClass}>
              <option value="3">3 questions</option>
              <option value="5">5 questions</option>
              <option value="10">10 questions</option>
              <option value="15">15 questions</option>
              <option value="20">20 questions</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold text-[#5A6A7A] dark:text-white/50">Difficulty</label>
            <select value={difficulty} onChange={e => setDifficulty(e.target.value as 'easy' | 'medium' | 'hard')} className={inputClass}>
              <option value="easy">Easy — Basic recall</option>
              <option value="medium">Medium — Understanding</option>
              <option value="hard">Hard — Application</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">{error}</div>
        )}

        <button type="button" disabled={generating} onClick={() => void generateQuestions()}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0B3D6B] to-[#1A6BAD] py-3.5 text-sm font-bold text-white disabled:opacity-40">
          {generating ? <><span className="ti ti-loader animate-spin" /> Generating with AI...</> : <><span className="ti ti-sparkles" /> Generate {count} Questions</>}
        </button>
      </div>

      {questions.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-jakarta font-bold text-[#0B3D6B] dark:text-white">{questions.length} Questions Generated — Review & Edit</h2>
            <p className="text-xs text-[#5A6A7A] dark:text-white/50">Click any field to edit</p>
          </div>

          {questions.map((q, qi) => (
            <div key={qi} className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0B3D6B] text-xs font-black text-white">{qi + 1}</span>
                <button type="button" onClick={() => setQuestions(prev => prev.filter((_, i) => i !== qi))}
                  className="text-red-400 hover:text-red-600"><span className="ti ti-trash text-sm" /></button>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-[#5A6A7A] dark:text-white/50">Question (English)</label>
                <textarea value={q.questionText} onChange={e => updateQuestion(qi, 'questionText', e.target.value)}
                  rows={2} className={`${inputClass} resize-none`} />
              </div>
              {q.questionTextJP !== undefined && (
                <div>
                  <label className="mb-1 block text-xs font-bold text-[#5A6A7A] dark:text-white/50">Question (Japanese)</label>
                  <textarea value={q.questionTextJP} onChange={e => updateQuestion(qi, 'questionTextJP', e.target.value)}
                    rows={2} className={`${inputClass} resize-none`} />
                </div>
              )}
              <div className="space-y-2">
                <label className="text-xs font-bold text-[#5A6A7A] dark:text-white/50">Options — click radio to set correct answer</label>
                {q.options.map((opt, oi) => (
                  <div key={oi} className={`flex items-center gap-3 rounded-xl border-2 p-3 transition-all ${q.correctIndex === opt.index ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20' : 'border-[#DDE3EC] dark:border-white/20'}`}>
                    <input type="radio" name={`correct-${qi}`} checked={q.correctIndex === opt.index}
                      onChange={() => updateQuestion(qi, 'correctIndex', opt.index)}
                      className="h-4 w-4 shrink-0 accent-emerald-600" />
                    <span className="shrink-0 text-xs font-bold text-[#5A6A7A]">{opt.index}.</span>
                    <input type="text" value={opt.text} onChange={e => updateOption(qi, oi, e.target.value)}
                      className="flex-1 bg-transparent text-sm text-[#0D1B2A] dark:text-white outline-none" />
                    {q.correctIndex === opt.index && <span className="ti ti-check text-emerald-600 shrink-0" />}
                  </div>
                ))}
              </div>
              {q.explanation && (
                <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2">
                  <p className="text-xs font-bold text-amber-700 dark:text-amber-400 mb-0.5">AI Explanation</p>
                  <p className="text-xs text-amber-700 dark:text-amber-400">{q.explanation}</p>
                </div>
              )}
            </div>
          ))}

          <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-5 space-y-3">
            <h3 className="font-jakarta font-bold text-[#0B3D6B] dark:text-white">Save to Exam Paper</h3>
            <select value={selectedPaper} onChange={e => setSelectedPaper(e.target.value)} className={inputClass}>
              <option value="">Select exam paper...</option>
              {papers.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
            {saved ? (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700 text-center">
                ✅ {questions.length} questions saved! Redirecting...
              </div>
            ) : (
              <button type="button" disabled={!selectedPaper || saving} onClick={() => void saveToExamPaper()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#E8A020] py-3 text-sm font-bold text-[#0B3D6B] disabled:opacity-40">
                {saving ? <><span className="ti ti-loader animate-spin" /> Saving...</> : <><span className="ti ti-device-floppy" /> Save {questions.length} Questions to Paper</>}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
