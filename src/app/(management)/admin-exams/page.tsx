'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import {
  getDownloadURL,
  ref as storageRef,
  uploadBytesResumable,
} from 'firebase/storage'
import hotToast from 'react-hot-toast'
import { db, storage } from '@/lib/firebase/client'
import { useManagement } from '@/components/layout/ManagementContext'

// ── Local types ──────────────────────────────────────────────────────────────
interface PaperDoc {
  id: string
  title: string
  description?: string
  categoryId: string
  totalQuestions: number
  timeLimitSeconds: number
  passMark: number
  isPublished: boolean
  order: number
  createdAt?: unknown
  createdBy?: string
  hasAudioCheck?: boolean
  scoringScale?: 250 | 100
  isLive?: boolean
  examDate?: string
  examTime?: string
  examCourseId?: string
  examBatch?: string
  accessCode?: string
  codeGeneratedAt?: string
  codeExpiresAt?: string
  paperType?: 'practice' | 'exam'
  shuffleEnabled?: boolean
  isUnlocked?: boolean
  unlockedAt?: unknown
}

interface SectionDoc {
  id: string
  paperId: string
  name: string
  order: number
  questionCount: number
}

interface QuestionDoc {
  id: string
  paperId: string
  sectionId: string
  order: number
  questionText: string
  questionImageUrl?: string
  questionAudioUrl?: string
  options: { index: number; text: string; imageUrl?: string }[]
  correctIndex: number
  languageMode?: 'en' | 'jp' | 'both'
  questionTextJP?: string
  questionTextEN?: string
  audioPlayLimit?: number
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const DEFAULT_SECTIONS = ['語彙・文法 (Vocab & Grammar)', '読解 (Reading)', '聴解 (Listening)']

// ── CSV parser ───────────────────────────────────────────────────────────────
// Expected columns: section,question_text,option_1,option_2,option_3,option_4,correct_index
// correct_index is 1-based (1,2,3, or 4)
function parseCSV(text: string): Omit<QuestionDoc, 'id' | 'paperId' | 'sectionId'>[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) return []
  const rows = lines.slice(1) // skip header
  return rows.map((line, i) => {
    const cols: string[] = []
    let cur = ''
    let inQ = false
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; continue }
      if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ''; continue }
      cur += ch
    }
    cols.push(cur.trim())
    const [, questionText = '', o1 = '', o2 = '', o3 = '', o4 = '', correctRaw = '1'] = cols
    const correctIndex = Math.max(1, Math.min(4, parseInt(correctRaw, 10) || 1))
    return {
      order: i + 1,
      questionText,
      options: [
        { index: 1, text: o1 },
        { index: 2, text: o2 },
        { index: 3, text: o3 },
        { index: 4, text: o4 },
      ].filter(o => o.text),
      correctIndex,
    }
  }).filter(q => q.questionText)
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ msg, onDone }: { msg: string; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t) }, [onDone])
  return (
    <div className="fixed bottom-6 right-4 z-50 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-medium text-white shadow-xl">
      {msg}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
const CATEGORY_LABELS: Record<string, string> = {
  'japan-ssw': 'Japan SSW',
  'jft-basic': 'JFT Basic',
  korea: 'Korea TOPIK',
  china: 'China',
  ielts: 'IELTS',
  nvq: 'NVQ',
  general: 'General',
}

export default function AdminExamsPage() {
  const { user, hasRole } = useManagement()
  const [papers, setPapers] = useState<PaperDoc[]>([])
  const [sections, setSections] = useState<SectionDoc[]>([])
  const [questions, setQuestions] = useState<QuestionDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [activeTab, setActiveTab] = useState<'papers' | 'questions'>('papers')
  const [selectedPaper, setSelectedPaper] = useState<PaperDoc | null>(null)

  // Read-only "View Questions" slide-over (separate state from the editor above).
  const [viewPaper, setViewPaper] = useState<PaperDoc | null>(null)
  const [viewSections, setViewSections] = useState<SectionDoc[]>([])
  const [viewQuestions, setViewQuestions] = useState<QuestionDoc[]>([])
  const [viewLoading, setViewLoading] = useState(false)

  const isExamAdmin = hasRole('admin') || hasRole('owner')
  const canViewPaper = (paper: PaperDoc) => isExamAdmin || paper.createdBy === user?.uid

  async function openViewQuestions(paper: PaperDoc) {
    setViewPaper(paper)
    setViewLoading(true)
    try {
      const [secSnap, qSnap] = await Promise.all([
        getDocs(query(collection(db, 'examSections'), where('paperId', '==', paper.id), orderBy('order', 'asc'))),
        getDocs(query(collection(db, 'examQuestions'), where('paperId', '==', paper.id), orderBy('order', 'asc'))),
      ])
      setViewSections(secSnap.docs.map((d) => ({ id: d.id, ...d.data() } as SectionDoc)))
      setViewQuestions(qSnap.docs.map((d) => ({ id: d.id, ...d.data() } as QuestionDoc)))
    } catch (err) {
      console.error('[AdminExams] view questions load failed:', err)
      setViewSections([])
      setViewQuestions([])
    } finally {
      setViewLoading(false)
    }
  }

  // Paper form
  const [paperForm, setPaperForm] = useState({
    title: '', description: '', categoryId: 'japan-ssw',
    totalQuestions: 48, timeLimitSeconds: 3600, passMark: 80, order: 1,
    hasAudioCheck: true, scoringScale: 250 as 250 | 100,
    paperType: 'practice' as 'practice' | 'exam',
    shuffleEnabled: false,
    isLive: false, examDate: '', examTime: '', examCourseId: '', examBatch: '',
  })
  const [editingPaper, setEditingPaper] = useState<PaperDoc | null>(null)
  const [savingPaper, setSavingPaper] = useState(false)

  // Live exam code panel
  const [liveCodePaper, setLiveCodePaper] = useState<PaperDoc | null>(null)
  const [currentCode, setCurrentCode] = useState<string>('')
  const [codeExpiry, setCodeExpiry] = useState<Date | null>(null)
  const [codeModalOpen, setCodeModalOpen] = useState(false)

  // Question form
  const [qForm, setQForm] = useState({
    sectionId: '',
    questionText: '',
    options: ['', '', '', ''],
    correctIndex: 1,
    languageMode: 'both' as 'en' | 'jp' | 'both',
    questionTextJP: '',
    questionTextEN: '',
    audioPlayLimit: 2,
  })
  const [qImageFile, setQImageFile] = useState<File | null>(null)
  const [qAudioFile, setQAudioFile] = useState<File | null>(null)
  const [savingQ, setSavingQ] = useState(false)
  const [editingQ, setEditingQ] = useState<QuestionDoc | null>(null)

  // CSV upload
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvSectionId, setCsvSectionId] = useState('')
  const [uploadingCsv, setUploadingCsv] = useState(false)
  const [csvPreview, setCsvPreview] = useState<ReturnType<typeof parseCSV>>([])
  const csvRef = useRef<HTMLInputElement>(null)

  // ── Load ────────────────────────────────────────────────────────────────────
  const loadPapers = useCallback(async () => {
    const snap = await getDocs(query(collection(db, 'examPapers'), orderBy('order', 'asc')))
    setPapers(snap.docs.map(d => ({ id: d.id, ...d.data() } as PaperDoc)))
  }, [])

  const loadSectionsAndQuestions = useCallback(async (paperId: string) => {
    const [secSnap, qSnap] = await Promise.all([
      getDocs(query(collection(db, 'examSections'), where('paperId', '==', paperId), orderBy('order', 'asc'))),
      getDocs(query(collection(db, 'examQuestions'), where('paperId', '==', paperId), orderBy('order', 'asc'))),
    ])
    const secs = secSnap.docs.map(d => ({ id: d.id, ...d.data() } as SectionDoc))
    setSections(secs)
    setQuestions(qSnap.docs.map(d => ({ id: d.id, ...d.data() } as QuestionDoc)))
    // Only set the section if none is selected yet
    if (secs.length > 0) setQForm(f => ({ ...f, sectionId: f.sectionId || secs[0].id }))
  }, [])

  useEffect(() => {
    void loadPapers().finally(() => setLoading(false))
  }, [loadPapers])

  useEffect(() => {
    if (selectedPaper) void loadSectionsAndQuestions(selectedPaper.id)
  }, [selectedPaper, loadSectionsAndQuestions])

  // ── Paper CRUD ──────────────────────────────────────────────────────────────
  async function handleSavePaper() {
    if (!user || !paperForm.title.trim()) return
    setSavingPaper(true)
    try {
      // totalQuestions is auto-maintained as questions are added/removed — never
      // write it from this form (set to 0 on create; left untouched on edit).
      const { totalQuestions: _ignoredTotalQuestions, ...paperFormRest } = paperForm
      const payload = {
        ...paperFormRest,
        isPublished: editingPaper?.isPublished ?? false,
        createdBy: user.uid,
        updatedAt: serverTimestamp(),
        isLive: paperForm.isLive ?? false,
        examDate: paperForm.examDate ?? null,
        examTime: paperForm.examTime ?? null,
        examCourseId: paperForm.examCourseId ?? null,
        examBatch: paperForm.examBatch ?? null,
      }
      if (editingPaper) {
        await updateDoc(doc(db, 'examPapers', editingPaper.id), payload)
        setToast('Paper updated')

        const existingScheduleSnap = await getDocs(
          query(collection(db, 'schedule'), where('paperId', '==', editingPaper.id))
        )
        if (paperForm.isLive && paperForm.examDate && paperForm.examTime) {
          const scheduleData = {
            title: paperForm.title + ' (Exam)',
            date: paperForm.examDate,
            startTime: paperForm.examTime,
            endTime: paperForm.examTime,
            type: 'exam',
            courseId: paperForm.examCourseId ?? '',
            batch: paperForm.examBatch ?? '',
            notes: 'Live exam — requires access code',
            paperId: editingPaper.id,
            updatedAt: serverTimestamp(),
          }
          if (existingScheduleSnap.empty) {
            await addDoc(collection(db, 'schedule'), { ...scheduleData, createdAt: serverTimestamp(), createdBy: user.uid })
          } else {
            await updateDoc(existingScheduleSnap.docs[0].ref, scheduleData)
          }
        } else if (!existingScheduleSnap.empty) {
          await Promise.all(existingScheduleSnap.docs.map(d => deleteDoc(d.ref)))
        }
      } else {
        const paperRef = await addDoc(collection(db, 'examPapers'), {
          ...payload,
          totalQuestions: 0,
          isPublished: false,
          isUnlocked: false,
          createdAt: serverTimestamp(),
        })
        setToast('Paper created')
        if (paperForm.isLive && paperForm.examDate && paperForm.examTime) {
          await addDoc(collection(db, 'schedule'), {
            title: paperForm.title + ' (Exam)',
            date: paperForm.examDate,
            startTime: paperForm.examTime,
            endTime: paperForm.examTime,
            type: 'exam',
            courseId: paperForm.examCourseId ?? '',
            batch: paperForm.examBatch ?? '',
            notes: 'Live exam — requires access code',
            paperId: paperRef.id,
            createdAt: serverTimestamp(),
            createdBy: user?.uid ?? '',
          })
        }
      }
      await loadPapers()
      setEditingPaper(null)
      setPaperForm({ title: '', description: '', categoryId: 'japan-ssw', totalQuestions: 48, timeLimitSeconds: 3600, passMark: 80, order: 1, hasAudioCheck: true, scoringScale: 250 as 250 | 100, paperType: 'practice' as 'practice' | 'exam', shuffleEnabled: false, isLive: false, examDate: '', examTime: '', examCourseId: '', examBatch: '' })
    } finally {
      setSavingPaper(false)
    }
  }

  async function handleTogglePublish(paper: PaperDoc) {
    const action = paper.isPublished ? 'unpublish' : 'publish'
    if (!window.confirm(`${action} this exam paper? Students will ${paper.isPublished ? 'no longer' : 'now'} be able to see it.`)) return
    await updateDoc(doc(db, 'examPapers', paper.id), { isPublished: !paper.isPublished })
    setToast(paper.isPublished ? 'Paper unpublished' : 'Paper published — students can now see it')
    await loadPapers()
  }

  async function handleToggleUnlock(paper: PaperDoc) {
    // Papers display as unlocked unless explicitly false (legacy papers have no field),
    // so toggle off the DISPLAYED state — otherwise a legacy paper's first click is a no-op.
    const nextUnlocked = paper.isUnlocked === false
    setPapers(prev => prev.map(p => (p.id === paper.id ? { ...p, isUnlocked: nextUnlocked } : p)))
    setToast(nextUnlocked ? 'Paper unlocked for students' : 'Paper locked')
    try {
      await updateDoc(doc(db, 'examPapers', paper.id), {
        isUnlocked: nextUnlocked,
        unlockedAt: serverTimestamp(),
      })
    } catch (err) {
      console.error('[AdminExams] toggle unlock failed:', err)
      setPapers(prev => prev.map(p => (p.id === paper.id ? { ...p, isUnlocked: paper.isUnlocked } : p)))
      setToast('Failed to update student access — please try again')
    }
  }

  async function handleDeletePaper(paper: PaperDoc) {
    if (!confirm(`Delete "${paper.title}" and all its questions? This cannot be undone.`)) return
    const [secSnap, qSnap] = await Promise.all([
      getDocs(query(collection(db, 'examSections'), where('paperId', '==', paper.id))),
      getDocs(query(collection(db, 'examQuestions'), where('paperId', '==', paper.id))),
    ])
    const batch = writeBatch(db)
    secSnap.docs.forEach(d => batch.delete(d.ref))
    qSnap.docs.forEach(d => batch.delete(d.ref))
    batch.delete(doc(db, 'examPapers', paper.id))
    await batch.commit()
    if (selectedPaper?.id === paper.id) setSelectedPaper(null)
    setToast('Paper deleted')
    await loadPapers()
  }

  // ── Live exam code ───────────────────────────────────────────────────────────
  function generateCode(): string {
    return String(Math.floor(10000 + Math.random() * 90000))
  }

  async function startLiveExam(paper: PaperDoc) {
    const code = generateCode()
    const now = new Date()
    const expiry = new Date(now.getTime() + 30 * 60 * 1000) // 30 mins
    setCurrentCode(code)
    setCodeExpiry(expiry)
    setLiveCodePaper(paper)
    setCodeModalOpen(true)
    // Save code to Firestore so students can validate
    await updateDoc(doc(db, 'examPapers', paper.id), {
      accessCode: code,
      codeGeneratedAt: now.toISOString(),
      codeExpiresAt: expiry.toISOString(),
    })
  }

  // ── Auto-create default sections ────────────────────────────────────────────
  async function ensureDefaultSections(paperId: string) {
    const snap = await getDocs(query(collection(db, 'examSections'), where('paperId', '==', paperId)))
    if (snap.empty) {
      const batch = writeBatch(db)
      DEFAULT_SECTIONS.forEach((name, i) => {
        const ref = doc(collection(db, 'examSections'))
        batch.set(ref, { paperId, name, order: i + 1, questionCount: 0 })
      })
      await batch.commit()
      await loadSectionsAndQuestions(paperId)
    }
  }

  // ── Question CRUD ───────────────────────────────────────────────────────────
  async function uploadFile(file: File, path: string) {
    const r = storageRef(storage, path)
    const task = uploadBytesResumable(r, file)
    await new Promise<void>((res, rej) => task.on('state_changed', null, rej, res))
    return getDownloadURL(r)
  }

  async function handleSaveQuestion() {
    if (!user || !selectedPaper || !qForm.questionText.trim() || !qForm.sectionId) return
    if (qForm.options.filter(Boolean).length < 2) { setToast('Add at least 2 options'); return }
    setSavingQ(true)
    const paper = selectedPaper
    try {
      const paperId = paper.id
      const qId = editingQ?.id ?? doc(collection(db, 'examQuestions')).id
      const ext = (f: File) => f.name.split('.').pop() ?? 'bin'
      const questionImageUrl = qImageFile
        ? await uploadFile(qImageFile, `examQuestions/${paperId}/${qId}/question.${ext(qImageFile)}`)
        : editingQ?.questionImageUrl
      const questionAudioUrl = qAudioFile
        ? await uploadFile(qAudioFile, `examQuestions/${paperId}/${qId}/audio.${ext(qAudioFile)}`)
        : editingQ?.questionAudioUrl

      const payload: Omit<QuestionDoc, 'id'> = {
        paperId,
        sectionId: qForm.sectionId,
        order: editingQ?.order ?? questions.length + 1,
        questionText: qForm.questionText.trim(),
        options: qForm.options.map((text, i) => ({ index: i + 1, text: text.trim() })).filter(o => o.text),
        correctIndex: qForm.correctIndex,
        languageMode: qForm.languageMode ?? 'both',
        ...(qForm.questionTextJP ? { questionTextJP: qForm.questionTextJP } : {}),
        ...(qForm.questionTextEN ? { questionTextEN: qForm.questionTextEN } : {}),
        audioPlayLimit: qForm.audioPlayLimit ?? 0,
        ...(questionImageUrl ? { questionImageUrl } : {}),
        ...(questionAudioUrl ? { questionAudioUrl } : {}),
      }

      if (editingQ) {
        await updateDoc(doc(db, 'examQuestions', editingQ.id), payload)
        setToast('Question updated')
      } else {
        await addDoc(collection(db, 'examQuestions'), payload)
        const secRef = doc(db, 'examSections', qForm.sectionId)
        const secQs = questions.filter(q => q.sectionId === qForm.sectionId)
        await updateDoc(secRef, { questionCount: secQs.length + 1 })
        await updateDoc(doc(db, 'examPapers', paperId), { totalQuestions: questions.length + 1 })
        setToast('Question added')
      }

      setEditingQ(null)
      setQForm(f => ({ ...f, questionText: '', options: ['', '', '', ''], correctIndex: 1, languageMode: 'both', questionTextJP: '', questionTextEN: '', audioPlayLimit: 2 }))
      setQImageFile(null)
      setQAudioFile(null)
      await loadSectionsAndQuestions(paperId)
    } finally {
      setSavingQ(false)
    }
  }

  async function handleDeleteQuestion(q: QuestionDoc) {
    const paper = selectedPaper
    if (!paper) return
    if (!window.confirm('Delete this question? This cannot be undone.')) return
    await deleteDoc(doc(db, 'examQuestions', q.id))
    await updateDoc(doc(db, 'examPapers', paper.id), { totalQuestions: Math.max(0, questions.length - 1) })
    const secQs = questions.filter(x => x.sectionId === q.sectionId && x.id !== q.id)
    await updateDoc(doc(db, 'examSections', q.sectionId), { questionCount: secQs.length })
    setToast('Question deleted')
    await loadSectionsAndQuestions(paper.id)
  }

  // ── CSV bulk upload ──────────────────────────────────────────────────────────
  function handleCsvChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCsvFile(file)
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      setCsvPreview(parseCSV(text))
    }
    reader.readAsText(file)
  }

  async function handleCsvUpload() {
    const paper = selectedPaper
    if (!csvFile || !paper || !csvSectionId || csvPreview.length === 0) return
    setUploadingCsv(true)
    try {
      const batch = writeBatch(db)
      const startOrder = questions.length
      csvPreview.forEach((q, i) => {
        const ref = doc(collection(db, 'examQuestions'))
        batch.set(ref, {
          paperId: paper.id,
          sectionId: csvSectionId,
          order: startOrder + i + 1,
          questionText: q.questionText,
          options: q.options,
          correctIndex: q.correctIndex,
        })
      })
      await batch.commit()
      await updateDoc(doc(db, 'examPapers', paper.id), {
        totalQuestions: questions.length + csvPreview.length,
      })
      const secQs = questions.filter(q => q.sectionId === csvSectionId)
      await updateDoc(doc(db, 'examSections', csvSectionId), {
        questionCount: secQs.length + csvPreview.length,
      })
      setCsvFile(null)
      setCsvPreview([])
      setCsvSectionId('')
      if (csvRef.current) csvRef.current.value = ''
      setToast(`${csvPreview.length} questions imported!`)
      await loadSectionsAndQuestions(paper.id)
    } finally {
      setUploadingCsv(false)
    }
  }

  const inputClass = 'w-full rounded-xl border border-[#DDE3EC] dark:border-white/20 bg-white dark:bg-white/[0.04] px-3 py-2.5 text-sm text-[#0D1B2A] dark:text-white outline-none focus:border-[#E8A020]'

  return (
    <div className="space-y-6">
      {toast && <Toast msg={toast} onDone={() => setToast('')} />}

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-jakarta text-2xl font-bold text-[#0D1B2A] dark:text-white">Exam Manager</h1>
          <p className="text-sm text-[#5A6A7A] dark:text-white/50">Build SSW / JFT exam papers for students</p>
        </div>
        <div className="flex gap-2">
          {(['papers', 'questions'] as const).map(tab => (
            <button key={tab} type="button" onClick={() => setActiveTab(tab)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold capitalize transition-all ${
                activeTab === tab ? 'bg-[#E8A020] text-white' : 'border border-[#DDE3EC] dark:border-white/20 text-[#5A6A7A] dark:text-white/60'
              }`}>
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* ── PAPERS TAB ──────────────────────────────────────────────────────── */}
      {activeTab === 'papers' && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Form */}
          <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-6 space-y-4">
            <h2 className="font-jakarta font-bold text-[#0B3D6B] dark:text-white">
              {editingPaper ? 'Edit Paper' : 'Create New Paper'}
            </h2>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#5A6A7A] dark:text-white/50">Paper Title *</label>
              <input value={paperForm.title} onChange={e => setPaperForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. JFT-Basic Paper 1" className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[#5A6A7A] dark:text-white/50">Description</label>
              <textarea value={paperForm.description} onChange={e => setPaperForm(f => ({ ...f, description: e.target.value }))}
                rows={2} className={`${inputClass} resize-none`} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-[#5A6A7A] dark:text-white/50">Category ID</label>
                <select value={paperForm.categoryId} onChange={e => setPaperForm(f => ({ ...f, categoryId: e.target.value }))} className={inputClass}>
                  <option value="japan-ssw">Japan SSW</option>
                  <option value="jft-basic">JFT Basic</option>
                  <option value="korea">Korea TOPIK</option>
                  <option value="china">China</option>
                  <option value="ielts">IELTS</option>
                  <option value="nvq">NVQ</option>
                  <option value="general">General</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#5A6A7A] dark:text-white/50">Display Order</label>
                <input type="number" min={1} value={paperForm.order}
                  onChange={e => setPaperForm(f => ({ ...f, order: Number(e.target.value) }))} className={inputClass} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-[#5A6A7A] dark:text-white/50">Time (min)</label>
                <input type="number" min={10} value={Math.round(paperForm.timeLimitSeconds / 60)}
                  onChange={e => setPaperForm(f => ({ ...f, timeLimitSeconds: Number(e.target.value) * 60 }))} className={inputClass} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#5A6A7A] dark:text-white/50">Pass %</label>
                <input type="number" min={1} max={100} value={paperForm.passMark}
                  onChange={e => setPaperForm(f => ({ ...f, passMark: Number(e.target.value) }))} className={inputClass} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-[#5A6A7A] dark:text-white/50">
                  Scoring Scale
                </label>
                <select
                  value={paperForm.scoringScale ?? 250}
                  onChange={e => setPaperForm(f => ({ ...f, scoringScale: Number(e.target.value) as 250 | 100 }))}
                  className={inputClass}
                >
                  <option value={250}>Out of 250 (JFT-Basic standard)</option>
                  <option value={100}>Out of 100</option>
                </select>
              </div>
              <div className="flex items-center gap-2 pt-5">
                <input
                  type="checkbox"
                  id="hasAudioCheck"
                  checked={paperForm.hasAudioCheck ?? true}
                  onChange={e => setPaperForm(f => ({ ...f, hasAudioCheck: e.target.checked }))}
                  className="h-4 w-4 accent-[#E8A020]"
                />
                <label htmlFor="hasAudioCheck" className="text-xs font-medium text-[#5A6A7A] dark:text-white/50">
                  Audio check before exam
                </label>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[#5A6A7A] dark:text-white/50">Paper Type</label>
              <div className="flex gap-2">
                {([
                  { value: 'practice', label: 'Practice' },
                  { value: 'exam', label: 'Exam' },
                ] as const).map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPaperForm(f => ({ ...f, paperType: opt.value }))}
                    className={`flex-1 rounded-xl px-3 py-2 text-sm font-bold transition-all ${
                      paperForm.paperType === opt.value
                        ? 'bg-[#0B3D6B] text-white'
                        : 'border border-[#DDE3EC] dark:border-white/20 text-[#5A6A7A] dark:text-white/60'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-[#5A6A7A] dark:text-white/40">
                Exam papers require a rolling access code; practice papers use the student-access toggle.
              </p>
            </div>

            {/* Shuffle Questions toggle — default OFF. Randomises question + option order per student. */}
            <div className="flex items-center justify-between gap-3 rounded-xl border border-[#DDE3EC] dark:border-white/20 px-3 py-2.5">
              <div>
                <p className="text-sm font-semibold text-[#0B3D6B] dark:text-white">Shuffle Questions</p>
                <p className="text-xs text-[#5A6A7A] dark:text-white/40">Randomise question &amp; option order for each student</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={paperForm.shuffleEnabled}
                onClick={() => setPaperForm(f => ({ ...f, shuffleEnabled: !f.shuffleEnabled }))}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                  paperForm.shuffleEnabled ? 'bg-[#E8A020]' : 'bg-[#DDE3EC] dark:bg-white/20'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                    paperForm.shuffleEnabled ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={paperForm.isLive ?? false}
                  onChange={e => setPaperForm(f => ({ ...f, isLive: e.target.checked }))}
                  className="h-4 w-4 rounded"
                />
                <span className="text-sm font-semibold text-[#0B3D6B] dark:text-white">
                  🔴 Live Exam (requires access code)
                </span>
              </label>
            </div>

            {paperForm.isLive && (
              <div className="space-y-3 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
                <p className="text-xs font-bold text-red-700 dark:text-red-400 uppercase">Live Exam Settings</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-[#5A6A7A]">Exam Date</label>
                    <input type="date" value={paperForm.examDate ?? ''} onChange={e => setPaperForm(f => ({ ...f, examDate: e.target.value }))}
                      className="w-full rounded-xl border border-[#DDE3EC] bg-white dark:bg-white/[0.04] px-3 py-2 text-sm dark:border-white/20 dark:text-white" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-[#5A6A7A]">Exam Time</label>
                    <input type="time" value={paperForm.examTime ?? ''} onChange={e => setPaperForm(f => ({ ...f, examTime: e.target.value }))}
                      className="w-full rounded-xl border border-[#DDE3EC] bg-white dark:bg-white/[0.04] px-3 py-2 text-sm dark:border-white/20 dark:text-white" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-bold text-[#5A6A7A]">Course</label>
                    <select value={paperForm.examCourseId ?? ''} onChange={e => setPaperForm(f => ({ ...f, examCourseId: e.target.value }))}
                      className="w-full rounded-xl border border-[#DDE3EC] bg-white dark:bg-white/[0.04] px-3 py-2 text-sm dark:border-white/20 dark:text-white">
                      <option value="">All courses</option>
                      <option value="japan-ssw">🇯🇵 Japan SSW</option>
                      <option value="korea">🇰🇷 Korea</option>
                      <option value="china">🇨🇳 China</option>
                      <option value="ielts">📝 IELTS</option>
                      <option value="nvq">🎓 NVQ</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-bold text-[#5A6A7A]">Batch (optional)</label>
                    <input type="text" value={paperForm.examBatch ?? ''} onChange={e => setPaperForm(f => ({ ...f, examBatch: e.target.value }))}
                      placeholder="e.g. Batch 1" className="w-full rounded-xl border border-[#DDE3EC] bg-white dark:bg-white/[0.04] px-3 py-2 text-sm dark:border-white/20 dark:text-white" />
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              {editingPaper && (
                <button type="button" onClick={() => { setEditingPaper(null); setPaperForm({ title: '', description: '', categoryId: 'japan-ssw', totalQuestions: 48, timeLimitSeconds: 3600, passMark: 80, order: 1, hasAudioCheck: true, scoringScale: 250 as 250 | 100, paperType: 'practice' as 'practice' | 'exam', shuffleEnabled: false, isLive: false, examDate: '', examTime: '', examCourseId: '', examBatch: '' }) }}
                  className="flex-1 rounded-xl border border-[#DDE3EC] dark:border-white/20 py-2.5 text-sm font-semibold text-[#5A6A7A] dark:text-white/60">
                  Cancel
                </button>
              )}
              <button type="button" disabled={savingPaper || !paperForm.title.trim()} onClick={() => void handleSavePaper()}
                className="flex-1 rounded-xl bg-[#E8A020] py-2.5 text-sm font-bold text-[#0B3D6B] hover:bg-[#d4911c] disabled:opacity-50">
                {savingPaper ? 'Saving…' : editingPaper ? 'Update Paper' : 'Create Paper'}
              </button>
            </div>
          </div>

          {/* Papers list */}
          <div className="space-y-3">
            <h2 className="font-jakarta font-bold text-[#0B3D6B] dark:text-white">
              Papers ({papers.length})
            </h2>
            {loading ? (
              [1,2].map(i => <div key={i} className="h-20 animate-pulse rounded-xl bg-[#DDE3EC] dark:bg-white/10" />)
            ) : papers.length === 0 ? (
              <div className="rounded-xl border border-[#DDE3EC] dark:border-white/[0.08] py-10 text-center text-sm text-[#5A6A7A]">
                No papers yet — create the first one
              </div>
            ) : (
              papers.map(paper => (
                <div key={paper.id} className="rounded-xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-jakarta font-bold text-[#0D1B2A] dark:text-white truncate">{paper.title}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          paper.isPublished ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-[#DDE3EC] dark:bg-white/20 text-[#5A6A7A] dark:text-white/40'
                        }`}>
                          {paper.isPublished ? 'Published' : 'Draft'}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          (paper.paperType ?? 'practice') === 'exam'
                            ? 'bg-[#E8A020] text-white'
                            : 'bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-white/50'
                        }`}>
                          {(paper.paperType ?? 'practice') === 'exam' ? 'EXAM' : 'PRACTICE'}
                        </span>
                        <span className="rounded-full bg-[#0B3D6B]/10 dark:bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-[#0B3D6B] dark:text-white/60">
                          {paper.totalQuestions} question{paper.totalQuestions === 1 ? '' : 's'}
                        </span>
                        {paper.shuffleEnabled && (
                          <span className="rounded-full bg-purple-100 dark:bg-purple-900/30 px-2 py-0.5 text-[10px] font-bold text-purple-700 dark:text-purple-400">
                            Shuffle ON
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#5A6A7A] dark:text-white/40 mt-0.5">
                        {paper.totalQuestions}Q · {Math.round((paper.timeLimitSeconds ?? 3600)/60)}min · Pass {paper.passMark}% · Order #{paper.order}
                      </p>
                      {/* Exam papers → rolling access-code generator. Practice papers → student-access toggle. */}
                      {(paper.paperType ?? 'practice') === 'exam' ? (
                        <ExamCodeSection
                          paper={paper}
                          onUpdated={(patch) =>
                            setPapers(prev => prev.map(p => (p.id === paper.id ? { ...p, ...patch } : p)))
                          }
                          onToast={setToast}
                        />
                      ) : (
                        <button
                          type="button"
                          role="switch"
                          aria-checked={paper.isUnlocked !== false}
                          onClick={() => void handleToggleUnlock(paper)}
                          title={paper.isUnlocked !== false
                            ? "Click to lock — students won't see this paper"
                            : 'Click to unlock — students can access this paper'}
                          className={`mt-2 inline-flex min-w-[160px] cursor-pointer items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold transition-all duration-200 hover:brightness-110 ${
                            paper.isUnlocked !== false
                              ? 'bg-emerald-500 text-white'
                              : 'bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-white/50'
                          }`}
                        >
                          <span className={`ti ${paper.isUnlocked !== false ? 'ti-lock-open' : 'ti-lock'}`} />
                          Student Access: {paper.isUnlocked !== false ? 'ON' : 'OFF'}
                        </button>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-1 flex-wrap justify-end items-center">
                      {paper.isLive && (
                        <button type="button" onClick={() => void startLiveExam(paper)}
                          className="rounded-lg bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700">
                          🔴 Start Live
                        </button>
                      )}
                      {paper.isLive && paper.examDate && (
                        <button
                          type="button"
                          onClick={async () => {
                            const res = await fetch('/api/twilio/exam-reminder', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ paperId: paper.id }),
                            })
                            const data = await res.json() as { success?: boolean; sent?: number; total?: number }
                            if (data.success) {
                              hotToast.success(`Reminders sent to ${data.sent ?? 0} students`)
                            } else {
                              hotToast.error('Failed to send reminders')
                            }
                          }}
                          className="flex items-center gap-1.5 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-3 py-1.5 text-xs font-bold text-amber-700 dark:text-amber-400"
                        >
                          <span className="ti ti-bell-ringing" /> Send Reminder
                        </button>
                      )}
                      {canViewPaper(paper) && (
                        <button type="button" onClick={() => void openViewQuestions(paper)}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#0B3D6B]/30 dark:border-white/20 bg-[#0B3D6B]/[0.04] dark:bg-white/[0.04] px-2 py-1 text-xs font-semibold text-[#0B3D6B] dark:text-white/70">
                          <span className="ti ti-eye" /> View Questions
                        </button>
                      )}
                      <Link
                        href={`/exam-results?paper=${paper.id}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#E8A020]/40 bg-[#E8A020]/10 px-2 py-1 text-xs font-semibold text-[#B4770F] dark:text-[#E8A020]"
                      >
                        <span className="ti ti-chart-bar" /> View Results
                      </Link>
                      <button type="button" onClick={() => { setSelectedPaper(paper); setActiveTab('questions'); void ensureDefaultSections(paper.id) }}
                        className="rounded-lg border border-[#DDE3EC] dark:border-white/20 px-2 py-1 text-xs font-semibold text-[#0B3D6B] dark:text-white/70">
                        Questions
                      </button>
                      <button type="button" onClick={() => void handleTogglePublish(paper)}
                        className={`rounded-lg px-2 py-1 text-xs font-semibold ${
                          paper.isPublished ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                        }`}>
                        {paper.isPublished ? 'Unpublish' : 'Publish'}
                      </button>
                      <button type="button" onClick={() => { setEditingPaper(paper); setPaperForm({ title: paper.title, description: paper.description ?? '', categoryId: paper.categoryId, totalQuestions: paper.totalQuestions, timeLimitSeconds: paper.timeLimitSeconds, passMark: paper.passMark, order: paper.order, hasAudioCheck: paper.hasAudioCheck ?? true, scoringScale: (paper.scoringScale ?? 250) as 250 | 100, paperType: (paper.paperType ?? 'practice') as 'practice' | 'exam', shuffleEnabled: paper.shuffleEnabled ?? false, isLive: paper.isLive ?? false, examDate: paper.examDate ?? '', examTime: paper.examTime ?? '', examCourseId: paper.examCourseId ?? '', examBatch: paper.examBatch ?? '' }) }}
                        className="rounded-lg border border-[#DDE3EC] dark:border-white/20 px-2 py-1 text-xs text-[#5A6A7A] dark:text-white/60">
                        Edit
                      </button>
                      <button type="button" onClick={() => void handleDeletePaper(paper)}
                        className="rounded-lg border border-red-200 dark:border-red-800 px-2 py-1 text-xs text-red-600 dark:text-red-400">
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── QUESTIONS TAB ───────────────────────────────────────────────────── */}
      {activeTab === 'questions' && (
        <div className="space-y-5">
          {/* Paper selector */}
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-xs font-medium text-[#5A6A7A] dark:text-white/50">Paper:</label>
            <select value={selectedPaper?.id ?? ''} onChange={e => {
              const p = papers.find(x => x.id === e.target.value) ?? null
              setSelectedPaper(p)
              if (p) void ensureDefaultSections(p.id)
            }} className="rounded-xl border border-[#DDE3EC] dark:border-white/20 bg-white dark:bg-white/[0.04] px-3 py-2 text-sm dark:text-white outline-none focus:border-[#E8A020]">
              <option value="">— Select a paper —</option>
              {papers.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
            {selectedPaper && (
              <span className="text-xs text-[#5A6A7A] dark:text-white/40">
                {questions.length} question{questions.length !== 1 ? 's' : ''} total
              </span>
            )}
          </div>

          {selectedPaper && (
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Left: Add / Edit question form */}
              <div className="space-y-4">
                <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-5 space-y-4">
                  <h2 className="font-jakarta font-bold text-[#0B3D6B] dark:text-white">
                    {editingQ ? 'Edit Question' : 'Add Question'}
                  </h2>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#5A6A7A] dark:text-white/50">Section *</label>
                    <select value={qForm.sectionId} onChange={e => setQForm(f => ({ ...f, sectionId: e.target.value }))} className={inputClass}>
                      <option value="">— Select section —</option>
                      {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#5A6A7A] dark:text-white/50">Question Text * (supports Japanese)</label>
                    <textarea value={qForm.questionText} onChange={e => setQForm(f => ({ ...f, questionText: e.target.value }))}
                      rows={3} placeholder="Enter question text in Japanese or English..."
                      className={`${inputClass} resize-none`}
                      style={{ fontFamily: "'Noto Sans JP', 'Hiragino Sans', 'Yu Gothic', sans-serif" }} />
                  </div>

                  {/* Language mode selector */}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#5A6A7A] dark:text-white/50">
                      Language Display *
                    </label>
                    <div className="flex gap-2">
                      {([
                        { value: 'both', label: 'EN + JP', icon: 'ti-language' },
                        { value: 'en', label: 'English Only', icon: 'ti-letter-e' },
                        { value: 'jp', label: 'Japanese Only', icon: 'ti-letter-j' },
                      ] as const).map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setQForm(f => ({ ...f, languageMode: opt.value }))}
                          className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all ${
                            qForm.languageMode === opt.value
                              ? 'bg-[#0B3D6B] text-white'
                              : 'border border-[#DDE3EC] dark:border-white/20 text-[#5A6A7A] dark:text-white/60'
                          }`}
                        >
                          <span className={`ti ${opt.icon}`} />
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Japanese question text */}
                  {(qForm.languageMode === 'jp' || qForm.languageMode === 'both') && (
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[#5A6A7A] dark:text-white/50">
                        Question Text (Japanese)
                      </label>
                      <textarea
                        value={qForm.questionTextJP ?? ''}
                        onChange={e => setQForm(f => ({ ...f, questionTextJP: e.target.value }))}
                        rows={2}
                        placeholder="日本語で質問を入力してください..."
                        className={`${inputClass} resize-none`}
                        style={{ fontFamily: "'Noto Sans JP', 'Hiragino Sans', 'Yu Gothic', sans-serif" }}
                      />
                    </div>
                  )}

                  {/* English question text */}
                  {(qForm.languageMode === 'en' || qForm.languageMode === 'both') && (
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[#5A6A7A] dark:text-white/50">
                        Question Text (English)
                      </label>
                      <textarea
                        value={qForm.questionTextEN ?? ''}
                        onChange={e => setQForm(f => ({ ...f, questionTextEN: e.target.value }))}
                        rows={2}
                        placeholder="Enter question in English..."
                        className={`${inputClass} resize-none`}
                      />
                    </div>
                  )}

                  {/* Audio play limit - only show if listening section */}
                  {(qForm.sectionId && sections.find(s => s.id === qForm.sectionId)?.name?.toLowerCase().includes('listen')) && (
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[#5A6A7A] dark:text-white/50">
                        Audio Play Limit
                      </label>
                      <select
                        value={qForm.audioPlayLimit ?? 2}
                        onChange={e => setQForm(f => ({ ...f, audioPlayLimit: Number(e.target.value) }))}
                        className={inputClass}
                      >
                        <option value={1}>1 play only</option>
                        <option value={2}>2 plays (JFT standard)</option>
                        <option value={3}>3 plays</option>
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="mb-2 block text-xs font-medium text-[#5A6A7A] dark:text-white/50">Answer Options</label>
                    <div className="space-y-2">
                      {qForm.options.map((opt, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold border-2 ${
                            qForm.correctIndex === i + 1 ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-[#DDE3EC] dark:border-white/30 text-[#5A6A7A]'
                          }`}>
                            {['A','B','C','D'][i]}
                          </div>
                          <input value={opt} onChange={e => setQForm(f => ({ ...f, options: f.options.map((o, j) => j === i ? e.target.value : o) }))}
                            placeholder={`Option ${['A','B','C','D'][i]}`}
                            className={inputClass}
                            style={{ fontFamily: "'Noto Sans JP', 'Hiragino Sans', 'Yu Gothic', sans-serif" }} />
                          <button type="button" onClick={() => setQForm(f => ({ ...f, correctIndex: i + 1 }))}
                            className={`shrink-0 rounded-lg px-2 py-1.5 text-[10px] font-bold transition-all ${
                              qForm.correctIndex === i + 1 ? 'bg-emerald-500 text-white' : 'border border-[#DDE3EC] dark:border-white/20 text-[#5A6A7A] dark:text-white/50'
                            }`}>
                            {qForm.correctIndex === i + 1 ? '✓ Correct' : 'Set correct'}
                          </button>
                        </div>
                      ))}
                    </div>
                    <p className="mt-1.5 text-xs text-[#5A6A7A] dark:text-white/40">Click &ldquo;Set correct&rdquo; to mark the right answer</p>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#5A6A7A] dark:text-white/50">Question Image (optional)</label>
                    <input type="file" accept="image/*" onChange={e => setQImageFile(e.target.files?.[0] ?? null)}
                      className="text-xs text-[#5A6A7A] dark:text-white/50" />
                    {(qImageFile ?? editingQ?.questionImageUrl) && (
                      <img src={qImageFile ? URL.createObjectURL(qImageFile) : editingQ?.questionImageUrl}
                        alt="" className="mt-2 max-h-48 rounded-xl object-contain border border-[#DDE3EC]" />
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#5A6A7A] dark:text-white/50">Question Audio (optional · max 3 plays for students)</label>
                    <input type="file" accept="audio/*" onChange={e => setQAudioFile(e.target.files?.[0] ?? null)}
                      className="text-xs text-[#5A6A7A] dark:text-white/50" />
                    {(qAudioFile || editingQ?.questionAudioUrl) && (
                      <audio
                        src={qAudioFile ? URL.createObjectURL(qAudioFile) : editingQ?.questionAudioUrl}
                        controls
                        className="mt-2 w-full rounded-xl"
                      />
                    )}
                  </div>

                  <div className="flex gap-3">
                    {editingQ && (
                      <button type="button" onClick={() => {
                        setEditingQ(null)
                        setQForm(f => ({ ...f, questionText: '', options: ['','','',''], correctIndex: 1, languageMode: 'both', questionTextJP: '', questionTextEN: '', audioPlayLimit: 2 }))
                        setQImageFile(null)
                        setQAudioFile(null)
                      }}
                        className="flex-1 rounded-xl border border-[#DDE3EC] dark:border-white/20 py-2.5 text-sm font-semibold text-[#5A6A7A] dark:text-white/60">
                        Cancel
                      </button>
                    )}
                    <button type="button" disabled={savingQ || !qForm.questionText.trim() || !qForm.sectionId}
                      onClick={() => void handleSaveQuestion()}
                      className="flex-1 rounded-xl bg-[#E8A020] py-2.5 text-sm font-bold text-[#0B3D6B] hover:bg-[#d4911c] disabled:opacity-50">
                      {savingQ ? 'Saving…' : editingQ ? 'Update Question' : 'Add Question'}
                    </button>
                  </div>
                </div>

                {/* CSV bulk upload */}
                <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="ti ti-table-import text-[#E8A020] text-lg" />
                    <h3 className="font-jakarta font-bold text-[#0B3D6B] dark:text-white">Bulk CSV Upload</h3>
                  </div>
                  <p className="text-xs text-[#5A6A7A] dark:text-white/50">
                    CSV format: <code className="rounded bg-[#F5F7FB] dark:bg-white/[0.06] px-1 py-0.5">section,question_text,option_1,option_2,option_3,option_4,correct_index</code>
                  </p>
                  <a href="data:text/csv;charset=utf-8,section%2Cquestion_text%2Coption_1%2Coption_2%2Coption_3%2Coption_4%2Ccorrect_index%0A%E8%AA%9E%E5%BD%99%2C%E4%BE%8B%E6%96%87%E3%81%A7%E3%81%99%2C%E9%81%B8%E6%8A%9E%E8%82%A21%2C%E9%81%B8%E6%8A%9E%E8%82%A22%2C%E9%81%B8%E6%8A%9E%E8%82%A23%2C%E9%81%B8%E6%8A%9E%E8%82%A24%2C1"
                    download="epic_exam_template.csv"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#F5F7FB] dark:bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-[#0B3D6B] dark:text-white/70">
                    <span className="ti ti-download" />
                    Download Template
                  </a>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#5A6A7A] dark:text-white/50">Target Section</label>
                    <select value={csvSectionId} onChange={e => setCsvSectionId(e.target.value)} className={inputClass}>
                      <option value="">— Select section —</option>
                      {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <input ref={csvRef} type="file" accept=".csv,text/csv" onChange={handleCsvChange}
                    className="text-xs text-[#5A6A7A] dark:text-white/50" />
                  {csvPreview.length > 0 && (
                    <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-4 py-2.5">
                      <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                        {csvPreview.length} questions detected — preview first 3:
                      </p>
                      {csvPreview.slice(0,3).map((q,i) => (
                        <p key={i} className="mt-1 text-xs text-emerald-600 dark:text-emerald-500 truncate">
                          {i+1}. {q.questionText}
                        </p>
                      ))}
                    </div>
                  )}
                  <button type="button"
                    disabled={uploadingCsv || csvPreview.length === 0 || !csvSectionId}
                    onClick={() => void handleCsvUpload()}
                    className="w-full rounded-xl bg-[#0B3D6B] py-2.5 text-sm font-bold text-white hover:bg-[#1A6BAD] disabled:opacity-50">
                    {uploadingCsv ? 'Importing…' : `Import ${csvPreview.length} Questions`}
                  </button>
                </div>
              </div>

              {/* Right: Questions list */}
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h2 className="font-jakarta font-bold text-[#0B3D6B] dark:text-white">
                    Questions ({questions.length})
                  </h2>
                  <div className="flex gap-1.5 overflow-x-auto">
                    {sections.map(s => (
                      <button key={s.id} type="button"
                        onClick={() => setQForm(f => ({ ...f, sectionId: s.id }))}
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold transition-all ${
                          qForm.sectionId === s.id ? 'bg-[#0B3D6B] text-white' : 'border border-[#DDE3EC] dark:border-white/20 text-[#5A6A7A] dark:text-white/50'
                        }`}>
                        {s.name.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                </div>

                {questions.length === 0 ? (
                  <div className="rounded-xl border border-[#DDE3EC] dark:border-white/[0.08] py-10 text-center text-sm text-[#5A6A7A] dark:text-white/40">
                    No questions yet — add one above or import CSV
                  </div>
                ) : (
                  questions
                    .filter(q => !qForm.sectionId || q.sectionId === qForm.sectionId)
                    .map((q, idx) => {
                      const section = sections.find(s => s.id === q.sectionId)
                      return (
                        <div key={q.id} className="rounded-xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0B3D6B] text-[9px] font-bold text-white">
                                  {idx + 1}
                                </span>
                                <span className="rounded-full bg-[#F5F7FB] dark:bg-white/[0.06] px-2 py-0.5 text-[10px] text-[#5A6A7A] dark:text-white/40">
                                  {section?.name ?? 'Unknown'}
                                </span>
                                {q.questionAudioUrl && <span className="ti ti-volume text-[#E8A020] text-xs" />}
                                {q.questionImageUrl && <span className="ti ti-photo text-[#1A6BAD] text-xs" />}
                              </div>
                              <p className="text-sm text-[#0D1B2A] dark:text-white line-clamp-2"
                                style={{ fontFamily: "'Noto Sans JP', 'Hiragino Sans', 'Yu Gothic', sans-serif" }}>
                                {q.questionText}
                              </p>
                              <div className="mt-1.5 flex gap-2 flex-wrap">
                                {q.options.map(o => (
                                  <span key={o.index} className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                    o.index === q.correctIndex
                                      ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                                      : 'bg-[#F5F7FB] dark:bg-white/[0.06] text-[#5A6A7A] dark:text-white/40'
                                  }`}>
                                    {['A','B','C','D'][o.index-1]}: {o.text.slice(0, 20)}{o.text.length > 20 ? '…' : ''}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div className="flex shrink-0 gap-1">
                              <button type="button" onClick={() => {
                                setEditingQ(q)
                                setQForm({
                                  sectionId: q.sectionId,
                                  questionText: q.questionText,
                                  options: q.options.map(o => o.text).concat(['','','','']).slice(0,4),
                                  correctIndex: q.correctIndex,
                                  languageMode: q.languageMode ?? 'both',
                                  questionTextJP: q.questionTextJP ?? '',
                                  questionTextEN: q.questionTextEN ?? '',
                                  audioPlayLimit: q.audioPlayLimit ?? 2,
                                })
                                setQImageFile(null)
                                setQAudioFile(null)
                              }} className="rounded-lg border border-[#DDE3EC] dark:border-white/20 px-2 py-1 text-xs text-[#5A6A7A] dark:text-white/60">
                                Edit
                              </button>
                              <button type="button" onClick={() => void handleDeleteQuestion(q)}
                                className="rounded-lg border border-red-200 dark:border-red-800 px-2 py-1 text-xs text-red-600 dark:text-red-400">
                                Del
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })
                )}
              </div>
            </div>
          )}

          {!selectedPaper && (
            <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] py-16 text-center">
              <span className="ti ti-file-text text-4xl text-[#DDE3EC]" />
              <p className="mt-3 text-sm text-[#5A6A7A] dark:text-white/50">Select a paper above to manage its questions</p>
              <button type="button" onClick={() => setActiveTab('papers')}
                className="mt-3 text-xs text-[#E8A020] font-semibold">
                Go to Papers tab →
              </button>
            </div>
          )}
        </div>
      )}

      {codeModalOpen && liveCodePaper && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-[#0B3D6B] p-8 shadow-2xl text-center">
            <p className="text-sm font-bold text-white/60 uppercase tracking-wider mb-2">Live Exam Code</p>
            <p className="text-sm text-white/70 mb-4">{liveCodePaper.title}</p>
            <div className="rounded-2xl bg-white/10 py-6 px-4 mb-4">
              <p className="font-mono text-6xl font-black text-[#E8A020] tracking-[0.3em]">{currentCode}</p>
            </div>
            {codeExpiry && (
              <CodeCountdown expiry={codeExpiry} onExpire={() => void startLiveExam(liveCodePaper)} />
            )}
            <p className="text-xs text-white/50 mt-2 mb-6">Code auto-refreshes every 30 minutes</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => void startLiveExam(liveCodePaper)}
                className="flex-1 rounded-xl bg-[#E8A020] py-3 text-sm font-bold text-[#0B3D6B]">
                🔄 New Code
              </button>
              <button type="button" onClick={() => setCodeModalOpen(false)}
                className="flex-1 rounded-xl bg-white/10 py-3 text-sm font-bold text-white">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── VIEW QUESTIONS SLIDE-OVER (read-only) ───────────────────────────── */}
      {viewPaper && (
        <>
          <div
            className="fixed inset-0 z-50 bg-[#0D1B2A]/40 backdrop-blur-sm"
            onClick={() => setViewPaper(null)}
            aria-hidden="true"
          />
          <aside
            className="fixed inset-y-0 right-0 z-[55] flex w-full max-w-[700px] flex-col border-l border-white/80 bg-white/95 shadow-2xl backdrop-blur-2xl dark:border-white/[0.08] dark:bg-[#0d1a2e]/95"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start justify-between gap-4 border-b border-[#DDE3EC] px-6 py-4 dark:border-white/[0.08]">
              <div className="min-w-0">
                <h2 className="font-jakarta text-lg font-bold text-[#0D1B2A] dark:text-white truncate">
                  {viewPaper.title}
                </h2>
                <p className="mt-0.5 text-xs text-[#5A6A7A] dark:text-white/50">
                  {CATEGORY_LABELS[viewPaper.categoryId] ?? viewPaper.categoryId} ·{' '}
                  {viewLoading ? 'Loading…' : `${viewQuestions.length} question${viewQuestions.length === 1 ? '' : 's'}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewPaper(null)}
                className="rounded-lg p-2 text-[#5A6A7A] hover:bg-[#F5F7FB] dark:text-white/60 dark:hover:bg-white/[0.06]"
                aria-label="Close"
              >
                <span className="ti ti-x text-xl" aria-hidden="true" />
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-5" style={{ maxHeight: 'calc(100vh - 120px)' }}>
              {viewLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-24 animate-pulse rounded-xl bg-[#DDE3EC] dark:bg-white/10" />
                  ))}
                </div>
              ) : viewQuestions.length === 0 ? (
                <div className="py-16 text-center text-sm text-[#5A6A7A] dark:text-white/40">
                  This paper has no questions yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {viewQuestions.map((q, idx) => {
                    const section = viewSections.find((s) => s.id === q.sectionId)
                    const isListening =
                      !!q.questionAudioUrl || !!section?.name?.toLowerCase().includes('listen')
                    const type = isListening ? 'Listening' : q.options.length === 0 ? 'Fill-in' : 'MCQ'
                    const totalQ = viewQuestions.length || viewPaper.totalQuestions || 1
                    const points = viewPaper.scoringScale
                      ? Math.round((viewPaper.scoringScale / totalQ) * 10) / 10
                      : 1
                    return (
                      <div
                        key={q.id}
                        className="rounded-xl border border-[#DDE3EC] bg-white p-4 dark:border-white/[0.08] dark:bg-white/[0.04]"
                      >
                        <div className="flex items-start gap-3">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0B3D6B] text-xs font-bold text-white">
                            {idx + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p
                              className="whitespace-pre-wrap break-words text-sm text-[#0D1B2A] dark:text-white"
                              style={{ fontFamily: "'Noto Sans JP', 'Hiragino Sans', 'Yu Gothic', sans-serif" }}
                            >
                              {q.questionText}
                            </p>

                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-[#F5F7FB] px-2 py-0.5 text-[10px] font-semibold text-[#5A6A7A] dark:bg-white/[0.06] dark:text-white/50">
                                Type: {type}
                              </span>
                              <span className="rounded-full bg-[#F5F7FB] px-2 py-0.5 text-[10px] font-semibold text-[#5A6A7A] dark:bg-white/[0.06] dark:text-white/50">
                                Points: {points}
                              </span>
                              {section && (
                                <span className="rounded-full bg-[#F5F7FB] px-2 py-0.5 text-[10px] text-[#5A6A7A] dark:bg-white/[0.06] dark:text-white/40">
                                  {section.name}
                                </span>
                              )}
                            </div>

                            {q.questionImageUrl && (
                              <img
                                src={q.questionImageUrl}
                                alt=""
                                className="mt-2 h-20 w-20 rounded-lg border border-[#DDE3EC] object-cover dark:border-white/[0.08]"
                              />
                            )}

                            {q.questionAudioUrl && (
                              <audio src={q.questionAudioUrl} controls className="mt-2 w-full" />
                            )}

                            {q.options.length > 0 && (
                              <div className="mt-3 space-y-1.5">
                                {q.options.map((o) => {
                                  const correct = o.index === q.correctIndex
                                  return (
                                    <div
                                      key={o.index}
                                      className={`flex items-start gap-2 rounded-lg border px-2.5 py-1.5 text-sm ${
                                        correct
                                          ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-300'
                                          : 'border-[#DDE3EC] text-[#0D1B2A] dark:border-white/[0.08] dark:text-white/80'
                                      }`}
                                    >
                                      <span className="font-bold">{['A', 'B', 'C', 'D', 'E', 'F'][o.index - 1] ?? o.index}.</span>
                                      <span
                                        className="min-w-0 flex-1 break-words"
                                        style={{ fontFamily: "'Noto Sans JP', 'Hiragino Sans', 'Yu Gothic', sans-serif" }}
                                      >
                                        {o.text}
                                      </span>
                                      {correct && (
                                        <span className="ti ti-circle-check shrink-0 text-emerald-600 dark:text-emerald-400" />
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </aside>
        </>
      )}
    </div>
  )
}

// ── Inline exam access-code generator shown on each EXAM paper card ─────────────
// Displays the current 5-digit code + a live MM:SS countdown, auto-refreshes the
// code when the 30-minute window elapses, and offers manual Regenerate / Revoke.
function ExamCodeSection({
  paper,
  onUpdated,
  onToast,
}: {
  paper: PaperDoc
  onUpdated: (patch: Partial<PaperDoc>) => void
  onToast: (msg: string) => void
}) {
  const [code, setCode] = useState(paper.accessCode ?? '')
  const [expiry, setExpiry] = useState<Date | null>(
    paper.codeExpiresAt ? new Date(paper.codeExpiresAt) : null,
  )
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [busy, setBusy] = useState(false)
  // Guards the auto-refresh so a single expiry can't fire repeated saves.
  const refreshingRef = useRef(false)

  // Re-sync when the underlying paper doc changes (e.g. after a reload).
  useEffect(() => {
    setCode(paper.accessCode ?? '')
    setExpiry(paper.codeExpiresAt ? new Date(paper.codeExpiresAt) : null)
  }, [paper.accessCode, paper.codeExpiresAt])

  const saveNewCode = useCallback(async (toastMsg: string) => {
    if (refreshingRef.current) return
    refreshingRef.current = true
    setBusy(true)
    try {
      const newCode = String(Math.floor(10000 + Math.random() * 90000))
      const now = new Date()
      const exp = new Date(now.getTime() + 30 * 60 * 1000) // 30 minutes
      await updateDoc(doc(db, 'examPapers', paper.id), {
        accessCode: newCode,
        codeGeneratedAt: now.toISOString(),
        codeExpiresAt: exp.toISOString(),
        isLive: true, // students validate against accessCode + isLive
      })
      setCode(newCode)
      setExpiry(exp)
      onUpdated({
        accessCode: newCode,
        codeGeneratedAt: now.toISOString(),
        codeExpiresAt: exp.toISOString(),
        isLive: true,
      })
      onToast(toastMsg)
    } catch (err) {
      console.error('[AdminExams] code save failed:', err)
      onToast('Failed to update code — please try again')
    } finally {
      setBusy(false)
      refreshingRef.current = false
    }
  }, [paper.id, onUpdated, onToast])

  const revoke = useCallback(async () => {
    if (busy) return
    setBusy(true)
    try {
      await updateDoc(doc(db, 'examPapers', paper.id), {
        accessCode: '',
        codeExpiresAt: new Date().toISOString(),
        isLive: false,
      })
      setCode('')
      setExpiry(null)
      onUpdated({ accessCode: '', isLive: false })
      onToast('Code revoked')
    } catch (err) {
      console.error('[AdminExams] revoke failed:', err)
      onToast('Failed to revoke — please try again')
    } finally {
      setBusy(false)
    }
  }, [busy, paper.id, onUpdated, onToast])

  // Live countdown; triggers a single auto-refresh at zero.
  useEffect(() => {
    if (!expiry || !code) { setSecondsLeft(0); return }
    function tick() {
      const diff = Math.max(0, Math.floor((expiry!.getTime() - Date.now()) / 1000))
      setSecondsLeft(diff)
      if (diff === 0 && !refreshingRef.current) {
        void saveNewCode('Code auto-refreshed')
      }
    }
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [expiry, code, saveNewCode])

  const mm = Math.floor(secondsLeft / 60)
  const ss = secondsLeft % 60
  const hasActiveCode = !!code && !!expiry && secondsLeft > 0

  return (
    <div className="mt-2 rounded-xl border-2 border-[#E8A020]/40 bg-[#E8A020]/[0.06] dark:bg-[#E8A020]/[0.08] p-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-[#B4770F] dark:text-[#E8A020]">Exam Code</p>
      {hasActiveCode ? (
        <>
          <p className="mt-1 font-mono text-3xl font-black tracking-[0.35em] text-[#0B3D6B] dark:text-[#E8A020]">
            {code}
          </p>
          <p className="mt-1 text-xs font-semibold text-[#5A6A7A] dark:text-white/60">
            Expires in: <span className="font-mono">{mm}:{ss.toString().padStart(2, '0')}</span>
          </p>
        </>
      ) : (
        <p className="mt-1 text-sm font-semibold text-[#5A6A7A] dark:text-white/50">
          No active code — generate one for students
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void saveNewCode('New code generated')}
          className="rounded-lg bg-[#E8A020] px-3 py-1.5 text-xs font-bold text-[#0B3D6B] hover:bg-[#d4911c] disabled:opacity-50"
        >
          {busy ? 'Working…' : hasActiveCode ? 'Regenerate Code' : 'Generate Code'}
        </button>
        {hasActiveCode && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void revoke()}
            className="rounded-lg border border-red-300 dark:border-red-800 px-3 py-1.5 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
          >
            Revoke
          </button>
        )}
      </div>
    </div>
  )
}

function CodeCountdown({ expiry, onExpire }: { expiry: Date; onExpire: () => void }) {
  const [secondsLeft, setSecondsLeft] = useState(0)
  useEffect(() => {
    function tick() {
      const diff = Math.max(0, Math.floor((expiry.getTime() - Date.now()) / 1000))
      setSecondsLeft(diff)
      if (diff === 0) onExpire()
    }
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [expiry, onExpire])
  const m = Math.floor(secondsLeft / 60)
  const s = secondsLeft % 60
  const pct = (secondsLeft / 1800) * 100
  return (
    <div className="space-y-2">
      <div className="h-2 rounded-full bg-white/20 overflow-hidden">
        <div className="h-full bg-[#E8A020] transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-sm font-mono font-bold text-white">
        {m}:{s.toString().padStart(2, '0')} remaining
      </p>
    </div>
  )
}
