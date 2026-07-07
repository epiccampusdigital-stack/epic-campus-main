'use client'

import { useRef, useState } from 'react'
import { addDoc, collection } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase/client'
import { useManagement } from '@/components/layout/ManagementContext'

// ── Collection targets ────────────────────────────────────────────────────────
const IMPORT_TARGETS = [
  {
    id: 'utilityBills',
    label: 'Utility Bills',
    collection: 'utilityBills',
    icon: 'ti-bolt',
    color: 'text-amber-600',
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-800',
    description: 'CEB & water bills per house per month',
    aiPrompt: `You are a data extraction assistant for EPIC Campus management system.
Extract utility bill data from the provided text and return ONLY a JSON array.
Each object must have these exact fields:
- houseName (string) — the house or property name
- month (string) — month name e.g. "June"
- year (number) — e.g. 2026
- ceb (number) — CEB electricity bill in LKR, 0 if none, negative if credit
- water (number) — water bill in LKR, 0 if none
- notes (string) — any extra info, empty string if none

Rules:
- If CEB shows multiple amounts for one house, sum them
- If a value shows as "-Rs. X" it is a negative/credit number
- Campus water bill and campus CEB are separate entries from house bills
- Return ONLY the JSON array, no explanation, no markdown, no backticks
Example output:
[{"houseName":"Home 01","month":"June","year":2026,"ceb":1400,"water":3200,"notes":""}]`,
  },
  {
    id: 'students',
    label: 'Students',
    collection: 'students',
    icon: 'ti-users',
    color: 'text-[#0B3D6B]',
    bg: 'bg-[#0B3D6B]/10 dark:bg-[#0B3D6B]/30',
    border: 'border-[#0B3D6B]/30',
    description: 'Bulk import student records',
    aiPrompt: `You are a data extraction assistant for EPIC Campus management system.
Extract student data from the provided text and return ONLY a JSON array.
Each object must have these exact fields:
- name (string) — full name
- email (string) — email address, empty string if not provided
- phone (string) — phone number, empty string if not provided
- courseId (string) — one of: japan-ssw, korea, china, ielts, nvq — infer from context
- location (string) — one of: Ahangama, Galle, Waduraba, Pinnaduwa
- nationality (string) — default "Sri Lankan"
- status (string) — always "active"

Return ONLY the JSON array, no explanation, no markdown, no backticks.`,
  },
  {
    id: 'sessions',
    label: 'Class Sessions',
    collection: 'sessions',
    icon: 'ti-calendar',
    color: 'text-purple-600',
    bg: 'bg-purple-50 dark:bg-purple-900/20',
    border: 'border-purple-200 dark:border-purple-800',
    description: 'Schedule sessions for student calendars',
    aiPrompt: `You are a data extraction assistant for EPIC Campus management system.
Extract class session data from the provided text and return ONLY a JSON array.
Each object must have these exact fields:
- title (string) — session/class title
- date (string) — ISO format YYYY-MM-DD
- startTime (string) — HH:MM format
- endTime (string) — HH:MM format, empty string if not provided
- courseId (string) — one of: japan-ssw, korea, china, ielts, nvq
- teacherName (string) — teacher name, empty string if not provided
- location (string) — room or location name
- type (string) — one of: class, exam, workshop, other
- notes (string) — any extra info, empty string if none

Return ONLY the JSON array, no explanation, no markdown, no backticks.`,
  },
  {
    id: 'payments',
    label: 'Payment Plans',
    collection: 'payments',
    icon: 'ti-credit-card',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    border: 'border-emerald-200 dark:border-emerald-800',
    description: 'Installment schedules for students',
    aiPrompt: `You are a data extraction assistant for EPIC Campus management system.
Extract payment plan data from the provided text and return ONLY a JSON array.
Each object must have these exact fields:
- studentName (string) — student full name
- totalFee (number) — total fee in LKR
- currency (string) — always "LKR"
- installments (array) — array of objects with: id (string like "inst_1"), label (string), amount (number), dueDate (string YYYY-MM-DD)

Return ONLY the JSON array, no explanation, no markdown, no backticks.`,
  },
  {
    id: 'examQuestions',
    label: 'Exam Questions',
    collection: 'examQuestions',
    icon: 'ti-pencil',
    color: 'text-red-600',
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800',
    description: 'Bulk import MCQ questions for exam papers',
    aiPrompt: `You are a data extraction assistant for EPIC Campus management system.
Extract exam question data from the provided text and return ONLY a JSON array.
Each object must have these exact fields:
- paperId (string) — exam paper ID, use "pending" if not provided
- sectionId (string) — section ID, use "pending" if not provided
- order (number) — question order number
- questionText (string) — the full question text
- questionTextJP (string) — Japanese version if present, empty string if not
- questionTextEN (string) — English version if present, empty string if not
- languageMode (string) — one of: en, jp, both
- options (array) — array of objects with index (1,2,3) and text (string)
- correctIndex (number) — 1, 2, or 3
- audioPlayLimit (number) — 2 for listening questions, 0 for others

Return ONLY the JSON array, no explanation, no markdown, no backticks.`,
  },
  {
    id: 'accommodations',
    label: 'Houses',
    collection: 'accommodations',
    icon: 'ti-home',
    color: 'text-blue-600',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800',
    description: 'Rented houses — landlord, rent, lease',
    aiPrompt: `You are a data extraction assistant for EPIC Campus management system.
Extract accommodation house data and return ONLY a JSON array.
Each object must have these exact fields:
- name (string) — house name e.g. "Home 01"
- address (string) — full address, empty string if not provided
- landlordName (string) — landlord full name
- landlordPhone (string) — landlord phone number
- monthlyRent (number) — monthly rent in LKR
- leaseStart (string) — lease start date YYYY-MM-DD, empty if not provided
- leaseEnd (string) — lease end date YYYY-MM-DD, empty if not provided
- location (string) — one of: Ahangama, Galle, Waduraba, Pinnaduwa
- capacity (number) — max number of students, default 4
- notes (string) — any extra info, empty string if none

Return ONLY the JSON array, no explanation, no markdown, no backticks.`,
  },
  {
    id: 'users',
    label: 'Staff',
    collection: 'users',
    icon: 'ti-id-badge',
    color: 'text-indigo-600',
    bg: 'bg-indigo-50 dark:bg-indigo-900/20',
    border: 'border-indigo-200 dark:border-indigo-800',
    description: 'Teachers, reception, admin staff',
    aiPrompt: `You are a data extraction assistant for EPIC Campus management system.
Extract staff member data and return ONLY a JSON array.
Each object must have these exact fields:
- name (string) — full name
- email (string) — email address
- phone (string) — phone number, empty string if not provided
- role (string) — one of: teacher, reception, accountant, admin, examCoordinator, kitchen, agent
- location (string) — one of: Ahangama, Galle, Waduraba, Pinnaduwa
- subjects (string) — subjects taught e.g. "Japanese, JLPT N4", empty string if not teacher
- status (string) — always "active"
- joinDate (string) — YYYY-MM-DD format, empty string if not provided

Return ONLY the JSON array, no explanation, no markdown, no backticks.`,
  },
  {
    id: 'visaDocuments',
    label: 'Visa Docs',
    collection: 'visaDocuments',
    icon: 'ti-file-certificate',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    border: 'border-emerald-200 dark:border-emerald-800',
    description: 'Student visa document checklist status',
    aiPrompt: `You are a data extraction assistant for EPIC Campus management system.
Extract visa document checklist data and return ONLY a JSON array.
Each object must have these exact fields:
- studentName (string) — student full name
- studentId (string) — student ID if provided, empty string if not
- docKey (string) — one of: passport, nic, birthCertificate, policeClearance, medicalCertificate, photos, bankStatement, jftCertificate, sswCertificate, coe
- docLabel (string) — human readable label e.g. "Passport", "Police Clearance Report"
- status (string) — one of: pending, submitted, approved, rejected
- expiryDate (string) — YYYY-MM-DD if applicable, empty string if not
- notes (string) — any notes, empty string if none

Return ONLY the JSON array, no explanation, no markdown, no backticks.`,
  },
  {
    id: 'kitchenInventory',
    label: 'Kitchen',
    collection: 'kitchenInventory',
    icon: 'ti-tools-kitchen-2',
    color: 'text-orange-600',
    bg: 'bg-orange-50 dark:bg-orange-900/20',
    border: 'border-orange-200 dark:border-orange-800',
    description: 'Kitchen inventory stock items',
    aiPrompt: `You are a data extraction assistant for EPIC Campus management system.
Extract kitchen inventory data and return ONLY a JSON array.
Each object must have these exact fields:
- name (string) — item name e.g. "Rice", "Coconut Oil"
- category (string) — one of: rice-grains, vegetables, fruits, meat-fish, dairy-eggs, spices-condiments, oil-ghee, beverages, cleaning, other
- quantity (number) — current stock quantity (decimal allowed e.g. 2.5)
- unit (string) — unit of measurement e.g. "kg", "L", "pcs", "g"
- reorderLevel (number) — minimum stock level before reorder alert
- costPerUnit (number) — cost per unit in LKR, 0 if not provided
- supplier (string) — supplier name, empty string if not provided
- notes (string) — any notes, empty string if none

Return ONLY the JSON array, no explanation, no markdown, no backticks.`,
  },
  {
    id: 'agents',
    label: 'Agents',
    collection: 'agents',
    icon: 'ti-user-star',
    color: 'text-pink-600',
    bg: 'bg-pink-50 dark:bg-pink-900/20',
    border: 'border-pink-200 dark:border-pink-800',
    description: 'Recruitment agents and commissions',
    aiPrompt: `You are a data extraction assistant for EPIC Campus management system.
Extract agent data and return ONLY a JSON array.
Each object must have these exact fields:
- name (string) — agent full name
- phone (string) — phone number
- email (string) — email address, empty string if not provided
- location (string) — city or district they operate in
- commissionRate (number) — commission percentage e.g. 10 for 10%
- commissionType (string) — one of: per-student, percentage, fixed
- studentsReferred (number) — number of students referred so far, default 0
- totalEarned (number) — total commission earned in LKR, default 0
- status (string) — one of: active, inactive
- notes (string) — any notes, empty string if none

Return ONLY the JSON array, no explanation, no markdown, no backticks.`,
  },
] as const

type TargetId = typeof IMPORT_TARGETS[number]['id']

// ── AI parse via server route (keeps API key server-side) ─────────────────────
async function parseWithAI(
  rawText: string,
  systemPrompt: string
): Promise<Record<string, unknown>[]> {
  const response = await fetch('/api/import-ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rawText, systemPrompt }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`AI API error: ${err}`)
  }

  const data = await response.json() as { text?: string; error?: string }
  if (data.error) throw new Error(data.error)

  const text = data.text ?? ''
  const cleaned = text
    .replace(/```json/g, '')
    .replace(/```/g, '')
    .trim()

  try {
    const parsed = JSON.parse(cleaned) as unknown
    return Array.isArray(parsed) ? parsed as Record<string, unknown>[] : [parsed as Record<string, unknown>]
  } catch {
    throw new Error(`AI returned invalid JSON: ${cleaned.slice(0, 200)}`)
  }
}

// ── File upload types ─────────────────────────────────────────────────────────
interface Detection {
  fileName: string
  type: string
  confidence: number
  suggestedCollection: string
  detectedFields: string[]
  recordCount: number
  error?: string
}
interface FileResult {
  success: boolean
  fileName: string
  detectedType: string
  confidence: number
  totalRows: number
  imported: number
  failed: number
  skipped: number
  errors: { row: number; reason: string }[]
  collection: string
}
const ACCEPTED = '.csv,.xlsx,.xls,.pdf,.json,.txt'
const TYPE_LABELS: Record<string, string> = {
  students: 'Student Data',
  exam_results: 'Exam Results',
  payments: 'Payments',
  sessions: 'Class Sessions',
  attendance: 'Attendance',
  inventory: 'Inventory',
  unknown: 'Unrecognised',
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function UniversalImportPage() {
  const { user } = useManagement()
  const [targetId, setTargetId] = useState<TargetId>('utilityBills')

  // File-upload flow state
  const [files, setFiles] = useState<File[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [detecting, setDetecting] = useState(false)
  const [detections, setDetections] = useState<Detection[] | null>(null)
  const [importingName, setImportingName] = useState<string | null>(null)
  const [fileResults, setFileResults] = useState<Record<string, FileResult>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [rawText, setRawText] = useState('')
  const [aiParsed, setAiParsed] = useState<Record<string, unknown>[]>([])
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState('')
  const [aiLog, setAiLog] = useState('')
  const [result, setResult] = useState<{ success: number; errors: string[] } | null>(null)
  const [toast, setToast] = useState('')

  const target = IMPORT_TARGETS.find(t => t.id === targetId)!

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 4000)
  }

  // ── File upload flow ───────────────────────────────────────────────────────
  function addFiles(list: FileList | null) {
    if (!list) return
    const incoming = Array.from(list)
    setFiles(prev => {
      const merged = [...prev]
      for (const f of incoming) {
        if (!merged.some(m => m.name === f.name && m.size === f.size)) merged.push(f)
      }
      return merged.slice(0, 5)
    })
    setDetections(null)
    setFileResults({})
  }

  function removeFile(name: string) {
    setFiles(prev => prev.filter(f => f.name !== name))
    setDetections(null)
    setFileResults({})
  }

  async function analyzeFiles() {
    if (files.length === 0) return
    setDetecting(true)
    setDetections(null)
    setFileResults({})
    try {
      const token = await auth.currentUser?.getIdToken()
      const fd = new FormData()
      fd.append('mode', 'detect')
      files.forEach(f => fd.append('files', f))
      const res = await fetch('/api/import-ai', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })
      const data = await res.json() as { detections?: Detection[]; error?: string }
      if (!res.ok) {
        showToast(data.error ?? 'Analysis failed')
        return
      }
      setDetections(data.detections ?? [])
    } catch (err) {
      console.error('[analyzeFiles]', err)
      showToast('Analysis failed — check your connection')
    } finally {
      setDetecting(false)
    }
  }

  async function importFile(det: Detection) {
    const file = files.find(f => f.name === det.fileName)
    if (!file) return
    setImportingName(det.fileName)
    try {
      const token = await auth.currentUser?.getIdToken()
      const fd = new FormData()
      fd.append('mode', 'import')
      fd.append('files', file)
      fd.append('type', det.type)
      fd.append('confidence', String(det.confidence))
      const res = await fetch('/api/import-ai', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      })
      const data = await res.json() as FileResult & { error?: string }
      if (!res.ok && !data.fileName) {
        showToast(data.error ?? 'Import failed')
        return
      }
      setFileResults(prev => ({ ...prev, [det.fileName]: data }))
      showToast(data.success ? `${data.imported} imported from ${det.fileName}` : `${data.imported} imported, ${data.failed} failed`)
    } catch (err) {
      console.error('[importFile]', err)
      showToast('Import failed — check your connection')
    } finally {
      setImportingName(null)
    }
  }

  // ── Step 1: AI Parse ───────────────────────────────────────────────────────
  async function handleAIParse() {
    if (!rawText.trim()) return
    setParsing(true)
    setAiParsed([])
    setResult(null)
    setAiLog('🤖 Sending to AI for parsing...')

    try {
      setAiLog('🤖 AI is reading your data...')
      const rows = await parseWithAI(rawText, target.aiPrompt)
      setAiParsed(rows)
      setAiLog(`✅ AI extracted ${rows.length} records — review below before importing`)
      showToast(`AI found ${rows.length} records ✓`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setAiLog(`❌ AI parsing failed: ${msg}`)
      showToast('AI parsing failed — check the log')
    } finally {
      setParsing(false)
    }
  }

  // ── Step 2: Import to Firestore ────────────────────────────────────────────
  async function handleImport() {
    if (!user || aiParsed.length === 0) return
    setImporting(true)
    setImportProgress('')
    const errors: string[] = []
    let success = 0

    try {
      const now = new Date().toISOString()
      const total = aiParsed.length

      for (let i = 0; i < aiParsed.length; i++) {
        const row = aiParsed[i]
        setImportProgress(`Importing ${i + 1} of ${total}…`)
        try {
          await addDoc(collection(db, target.collection), {
            ...row,
            importedAt: now,
            importedBy: user.uid,
          })
          success++
        } catch (err) {
          console.error('[Import row error]', err, row)
          errors.push(`Row ${i + 1} failed: ${JSON.stringify(row).slice(0, 80)}`)
        }
      }
    } catch (err) {
      console.error('[Import error]', err)
      errors.push(`Import error: ${String(err)}`)
    } finally {
      setImporting(false)
      setImportProgress('')
      setResult({ success, errors })
      if (errors.length === 0) {
        showToast(`✅ ${success} records imported to Firestore!`)
      } else {
        showToast(`⚠️ ${success} imported, ${errors.length} failed`)
      }
    }
  }

  // ── Edit a parsed row ──────────────────────────────────────────────────────
  function updateRow(idx: number, field: string, value: string) {
    setAiParsed(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], [field]: value }
      return next
    })
  }

  function deleteRow(idx: number) {
    setAiParsed(prev => prev.filter((_, i) => i !== idx))
  }

  if (!user) return null

  return (
    <div className="space-y-6 pb-16">
      {toast && (
        <div className="fixed bottom-6 right-4 z-50 rounded-xl bg-[#0B3D6B] px-5 py-3 text-sm font-medium text-white shadow-lg animate-fade-in">
          {toast}
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="font-jakarta text-2xl font-bold text-[#0D1B2A] dark:text-white">
          AI Data Importer
        </h1>
        <p className="text-sm text-[#5A6A7A] dark:text-white/50">
          Upload files or paste any data — AI detects the type and imports it accurately
        </p>
      </div>

      {/* ── FILE UPLOAD ──────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#E8A020] text-[10px] font-bold text-white">
            <span className="ti ti-upload" />
          </div>
          <h2 className="font-jakarta font-bold text-[#0D1B2A] dark:text-white">Upload Files</h2>
        </div>

        {/* Drop zone */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click() }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files) }}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-all ${
            dragOver
              ? 'border-[#E8A020] bg-[#E8A020]/10'
              : 'border-[#E8A020]/40 bg-[#E8A020]/[0.03] hover:border-[#E8A020] hover:bg-[#E8A020]/[0.06]'
          }`}
        >
          <span className="ti ti-cloud-upload text-4xl text-[#E8A020]" />
          <p className="text-sm font-bold text-[#0D1B2A] dark:text-white">Drag files here or click to browse</p>
          <p className="text-xs text-[#5A6A7A] dark:text-white/50">CSV, Excel (.xlsx), JSON, PDF · up to 5 files, 10MB each</p>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED}
            multiple
            className="hidden"
            onChange={(e) => { addFiles(e.target.files); e.target.value = '' }}
          />
        </div>

        {/* Selected file chips */}
        {files.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {files.map((f) => (
              <span key={f.name} className="flex items-center gap-2 rounded-xl border border-[#DDE3EC] dark:border-white/[0.1] bg-[#F5F7FB] dark:bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-[#0D1B2A] dark:text-white">
                <span className="ti ti-file-text text-[#0B3D6B] dark:text-[#E8A020]" />
                <span className="max-w-[180px] truncate">{f.name}</span>
                <span className="text-[10px] text-[#5A6A7A] dark:text-white/40">{(f.size / 1024).toFixed(0)} KB</span>
                <button type="button" onClick={() => removeFile(f.name)} className="text-[#5A6A7A] hover:text-red-500">
                  <span className="ti ti-x text-xs" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Analyze button */}
        {files.length > 0 && (
          <button
            type="button"
            onClick={() => void analyzeFiles()}
            disabled={detecting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#E8A020] py-3.5 text-sm font-bold text-[#0B3D6B] disabled:opacity-40 hover:bg-[#F5B942] transition-all sm:w-auto sm:px-8"
          >
            {detecting ? (
              <><span className="ti ti-loader animate-spin" /> AI is analysing your files…</>
            ) : (
              <><span className="ti ti-sparkles" /> Analyse {files.length} File{files.length > 1 ? 's' : ''}</>
            )}
          </button>
        )}

        {/* Detection results + per-file import */}
        {detections && detections.length > 0 && (
          <div className="space-y-3 pt-1">
            {detections.map((det) => {
              const result = fileResults[det.fileName]
              const unknown = det.type === 'unknown' || !!det.error
              return (
                <div key={det.fileName} className="rounded-xl border border-[#DDE3EC] dark:border-white/[0.08] bg-[#F5F7FB]/60 dark:bg-white/[0.02] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-semibold text-[#0D1B2A] dark:text-white">
                        <span className="ti ti-file-text text-[#0B3D6B] dark:text-[#E8A020]" />
                        <span className="truncate">{det.fileName}</span>
                        <span className="ti ti-arrow-right text-[#5A6A7A]" />
                        <span className={unknown ? 'text-red-500' : 'text-[#0B3D6B] dark:text-[#E8A020]'}>
                          {TYPE_LABELS[det.type] ?? det.type}
                        </span>
                      </p>
                      {det.error ? (
                        <p className="mt-1 text-xs text-red-500">{det.error}</p>
                      ) : (
                        <p className="mt-1 text-xs text-[#5A6A7A] dark:text-white/50">
                          {det.suggestedCollection && <>→ <span className="font-mono">{det.suggestedCollection}</span> · </>}
                          {det.recordCount > 0 && <>~{det.recordCount} records · </>}
                          confidence {det.confidence}%
                        </p>
                      )}
                    </div>
                    {!unknown && !result && (
                      <button
                        type="button"
                        onClick={() => void importFile(det)}
                        disabled={importingName === det.fileName}
                        className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-40 hover:bg-emerald-700"
                      >
                        {importingName === det.fileName
                          ? <><span className="ti ti-loader animate-spin" /> Importing…</>
                          : <><span className="ti ti-cloud-upload" /> Confirm &amp; Import</>}
                      </button>
                    )}
                  </div>

                  {/* Per-file result */}
                  {result && (
                    <div className={`mt-3 rounded-lg px-3 py-2 text-xs ${
                      result.failed === 0
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                        : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
                    }`}>
                      <p className="font-bold">
                        {result.imported} imported
                        {result.skipped > 0 && ` · ${result.skipped} skipped (already exist)`}
                        {result.failed > 0 && ` · ${result.failed} failed`}
                        {` · into ${result.collection}`}
                      </p>
                      {result.errors.length > 0 && (
                        <ul className="mt-1.5 space-y-0.5">
                          {result.errors.slice(0, 8).map((e, i) => (
                            <li key={i} className="font-mono text-[11px] text-red-600 dark:text-red-400">Row {e.row}: {e.reason}</li>
                          ))}
                          {result.errors.length > 8 && <li className="text-[11px]">…and {result.errors.length - 8} more</li>}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Divider between file upload and paste flow */}
      <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-widest text-[#5A6A7A] dark:text-white/40">
        <div className="h-px flex-1 bg-[#DDE3EC] dark:bg-white/[0.08]" />
        or paste raw data
        <div className="h-px flex-1 bg-[#DDE3EC] dark:bg-white/[0.08]" />
      </div>

      {/* Target selector */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-5">
        {IMPORT_TARGETS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTargetId(t.id as TargetId)
              setRawText('')
              setAiParsed([])
              setResult(null)
              setAiLog('')
            }}
            className={`rounded-2xl border p-4 text-left transition-all ${
              targetId === t.id
                ? `${t.bg} ${t.border} shadow-sm ring-2 ring-[#E8A020]/40`
                : 'border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] hover:border-[#E8A020]'
            }`}
          >
            <span className={`ti ${t.icon} text-xl ${targetId === t.id ? t.color : 'text-[#5A6A7A] dark:text-white/40'}`} />
            <p className={`mt-2 text-xs font-bold ${targetId === t.id ? t.color : 'text-[#0D1B2A] dark:text-white'}`}>
              {t.label}
            </p>
            <p className="mt-0.5 text-[10px] text-[#5A6A7A] dark:text-white/40 leading-relaxed">
              {t.description}
            </p>
          </button>
        ))}
      </div>

      {/* Step 1 — Paste raw data */}
      <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#0B3D6B] text-[10px] font-bold text-white">1</div>
              <h2 className="font-jakarta font-bold text-[#0D1B2A] dark:text-white">
                Paste Your Raw Data
              </h2>
            </div>
            <p className="mt-1 text-xs text-[#5A6A7A] dark:text-white/50 ml-8">
              Copy from Excel, PDF, WhatsApp, email — paste anything. AI will figure it out.
            </p>
          </div>
          {/* Quick load June data for utility bills */}
          {targetId === 'utilityBills' && (
            <button
              type="button"
              onClick={() => setRawText(`UTILITY DETAILS - JUNE 2026

No | Home | CEB | Water Bill
1 | Home 01 | Rs. 1,400.00 | Rs. 3,200.00
2 | Home 08 | Rs. 4,300.00 | Rs. 7,500.00
3 | Home 19 | Rs. 11,000.00 | Rs. 4,600.00
4 | Home 20 | Rs. 27,200.00 | Rs. 14,500.00
5 | Home 24 | Rs. 12,500.00 | Rs. 3,500.00
6 | Home 25 | -Rs. 9,020.00 | Rs. 15,000.00
7 | Home 26 | | Rs. 3,500.00
8 | Home 27 | Rs. 500.00 | Rs. 25,000.00
9 | Home 33 | Rs. 6,500.00 | Rs. 8,700.00
10 | Home 41 | Rs. 7,600.00 | Rs. 9,700.00
11 | Home 42 | Rs. 73,000.00 | Rs. 13,500.00
12 | Campus water bill | Rs. 138,500.00 + Rs. 87,000.00 | Rs. 419,250.00
13 | Hampton Hall | Rs. 1,000.00 | Rs. 13,100.00

Total | Rs. 361,480.00 | Rs. 541,050.00`)}
              className="shrink-0 flex items-center gap-1.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs font-bold text-amber-700 dark:text-amber-400 hover:bg-amber-100"
            >
              <span className="ti ti-bolt" />
              Load June 2026 Bills
            </button>
          )}
        </div>

        <textarea
          value={rawText}
          onChange={e => { setRawText(e.target.value); setAiParsed([]); setResult(null) }}
          placeholder={`Paste anything here — Excel data, PDF text, table, list...\n\nExamples:\n• Copy a table from Excel and paste\n• Copy text from a PDF\n• Type raw data like: "Home 01, June, CEB 1400, Water 3200"`}
          rows={12}
          className="w-full rounded-xl border border-[#DDE3EC] dark:border-white/20 bg-[#F5F7FB] dark:bg-white/[0.04] p-4 text-sm text-[#0D1B2A] dark:text-white outline-none focus:border-[#E8A020] resize-none font-mono"
        />

        <button
          type="button"
          onClick={() => void handleAIParse()}
          disabled={!rawText.trim() || parsing}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0B3D6B] py-3.5 text-sm font-bold text-white disabled:opacity-40 hover:bg-[#1A6BAD] transition-all"
        >
          {parsing ? (
            <>
              <span className="ti ti-loader animate-spin" />
              AI is reading your data...
            </>
          ) : (
            <>
              <span className="ti ti-sparkles" />
              Parse with AI — Extract {target.label}
            </>
          )}
        </button>

        {/* AI log */}
        {aiLog && (
          <div className={`rounded-xl px-4 py-3 text-xs font-medium ${
            aiLog.startsWith('✅')
              ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
              : aiLog.startsWith('❌')
              ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
              : 'bg-[#0B3D6B]/10 dark:bg-[#0B3D6B]/30 text-[#0B3D6B] dark:text-blue-300'
          }`}>
            {aiLog}
          </div>
        )}
      </div>

      {/* Step 2 — Review + edit AI output */}
      {aiParsed.length > 0 && (
        <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#DDE3EC] dark:border-white/[0.08]">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#E8A020] text-[10px] font-bold text-white">2</div>
              <h3 className="font-jakarta font-bold text-[#0D1B2A] dark:text-white">
                Review AI Output — {aiParsed.length} records
              </h3>
            </div>
            <span className="rounded-full bg-amber-100 dark:bg-amber-900/30 px-2.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400">
              Click any cell to edit
            </span>
          </div>

          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-[#DDE3EC] dark:border-white/[0.08] bg-[#F5F7FB] dark:bg-[#0d1a2e]">
                  {aiParsed.length > 0 && Object.keys(aiParsed[0]).filter(k => typeof aiParsed[0][k] !== 'object').map(h => (
                    <th key={h} className="px-3 py-2.5 text-left font-bold text-[#5A6A7A] dark:text-white/50 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-left font-bold text-[#5A6A7A] dark:text-white/50">
                    <span className="ti ti-trash" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {aiParsed.map((row, i) => (
                  <tr key={i} className="border-b border-[#DDE3EC]/50 dark:border-white/[0.04] hover:bg-[#F5F7FB]/50 dark:hover:bg-white/[0.02]">
                    {Object.entries(row).filter(([, v]) => typeof v !== 'object').map(([key, val]) => (
                      <td key={key} className="px-2 py-1.5">
                        <input
                          type="text"
                          value={String(val ?? '')}
                          onChange={e => updateRow(i, key, e.target.value)}
                          className="w-full min-w-[80px] rounded-lg border border-transparent bg-transparent px-2 py-1 text-[#0D1B2A] dark:text-white hover:border-[#DDE3EC] dark:hover:border-white/20 focus:border-[#E8A020] outline-none transition-all"
                        />
                      </td>
                    ))}
                    <td className="px-2 py-1.5">
                      <button
                        type="button"
                        onClick={() => deleteRow(i)}
                        className="rounded-lg p-1 text-[#5A6A7A] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <span className="ti ti-trash text-xs" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Step 3 — Import */}
          <div className="border-t border-[#DDE3EC] dark:border-white/[0.08] p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white">3</div>
              <button
                type="button"
                onClick={() => void handleImport()}
                disabled={importing || aiParsed.length === 0}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white disabled:opacity-40 hover:bg-emerald-700 transition-all"
              >
                {importing ? (
                  <>
                    <span className="ti ti-loader animate-spin" />
                    {importProgress || 'Importing to Firestore...'}
                  </>
                ) : (
                  <>
                    <span className="ti ti-cloud-upload" />
                    Import {aiParsed.length} Records to {target.label}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className={`rounded-2xl border p-5 ${
          result.errors.length === 0
            ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20'
            : 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20'
        }`}>
          <div className="flex items-start gap-3">
            <span className={`ti text-2xl shrink-0 ${
              result.errors.length === 0
                ? 'ti-circle-check text-emerald-600'
                : 'ti-alert-triangle text-amber-600'
            }`} />
            <div>
              <p className={`font-bold text-sm ${
                result.errors.length === 0
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-amber-700 dark:text-amber-400'
              }`}>
                {result.errors.length === 0
                  ? `✅ All ${result.success} records imported successfully into ${target.label}!`
                  : `⚠️ ${result.success} imported, ${result.errors.length} failed`}
              </p>
              <p className="text-xs text-[#5A6A7A] dark:text-white/50 mt-1">
                Records are now live in Firestore and visible in the {target.label} section of the management portal.
              </p>
              {result.errors.length > 0 && (
                <div className="mt-3 space-y-1">
                  {result.errors.map((e, i) => (
                    <p key={i} className="font-mono text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded px-3 py-1.5">
                      {e}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* How it works */}
      {aiParsed.length === 0 && !parsing && (
        <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-5">
          <h3 className="font-jakarta font-bold text-[#0D1B2A] dark:text-white mb-4">
            How it works
          </h3>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                step: '1',
                icon: 'ti-clipboard-text',
                title: 'Paste anything',
                desc: 'Copy from Excel, PDF, WhatsApp message, email, or just type raw data. No special format needed.',
                color: 'bg-[#0B3D6B]',
              },
              {
                step: '2',
                icon: 'ti-sparkles',
                title: 'AI extracts data',
                desc: 'Claude AI reads your data and converts it to the exact format needed for Firestore — accurately.',
                color: 'bg-[#E8A020]',
              },
              {
                step: '3',
                icon: 'ti-cloud-upload',
                title: 'Review & import',
                desc: 'Check the extracted records, edit any mistakes, then click import. Done.',
                color: 'bg-emerald-600',
              },
            ].map(item => (
              <div key={item.step} className="flex gap-3">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${item.color} text-white text-sm`}>
                  <span className={`ti ${item.icon}`} />
                </div>
                <div>
                  <p className="text-sm font-bold text-[#0D1B2A] dark:text-white">{item.title}</p>
                  <p className="text-xs text-[#5A6A7A] dark:text-white/50 mt-0.5 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
