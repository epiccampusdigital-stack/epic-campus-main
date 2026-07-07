export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { adminAuth, adminDb } from '@/lib/firebase/admin'

const MODEL = 'claude-sonnet-4-6'
const MAX_FILES = 5
const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10MB
// Cap how much text we hand to the model so a large file can't blow the context window.
const DETECT_SAMPLE_CHARS = 4000
const EXTRACT_MAX_CHARS = 30000

// ── Anthropic call (shared) ────────────────────────────────────────────────────
async function callClaude(apiKey: string, system: string, userText: string, maxTokens = 4000): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: userText }],
    }),
  })
  if (!res.ok) {
    throw new Error(`AI API error: ${await res.text()}`)
  }
  const data = (await res.json()) as { content?: { type: string; text: string }[] }
  return data.content?.[0]?.text ?? ''
}

function parseJsonFromText<T>(text: string): T {
  const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim()
  return JSON.parse(cleaned) as T
}

// ── File → text extraction ─────────────────────────────────────────────────────
async function extractText(file: File): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const name = file.name.toLowerCase()
  try {
    if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      const buf = Buffer.from(await file.arrayBuffer())
      const wb = XLSX.read(buf, { type: 'buffer' })
      const first = wb.SheetNames[0]
      if (!first) return { ok: false, error: 'Spreadsheet has no sheets' }
      const csv = XLSX.utils.sheet_to_csv(wb.Sheets[first])
      return { ok: true, text: csv }
    }
    if (name.endsWith('.pdf')) {
      try {
        const buf = Buffer.from(await file.arrayBuffer())
        // Import the internal lib entry directly — pdf-parse's index.js has a debug
        // block that reads a bundled sample PDF and throws inside serverless bundles.
        // The `string`-typed specifier keeps TS from resolving/type-checking the path.
        const spec: string = 'pdf-parse/lib/pdf-parse.js'
        const mod = (await import(spec)) as { default?: (b: Buffer) => Promise<{ text?: string }> }
        const pdfParse = mod.default
        if (!pdfParse) {
          return { ok: false, error: 'PDF parser unavailable — please export as CSV/Excel or paste the text.' }
        }
        const data = await pdfParse(buf)
        const text = String(data?.text ?? '').trim()
        if (!text) {
          return { ok: false, error: 'No extractable text found in this PDF (it may be a scanned image).' }
        }
        return { ok: true, text }
      } catch (err) {
        return {
          ok: false,
          error: `PDF could not be read: ${err instanceof Error ? err.message : String(err)}. Try exporting as CSV/Excel or pasting the text.`,
        }
      }
    }
    // csv / json / txt / anything text-like
    const text = await file.text()
    return { ok: true, text }
  } catch (err) {
    return { ok: false, error: `Could not read file: ${err instanceof Error ? err.message : String(err)}` }
  }
}

// ── Type registry: detection collection + extraction prompt + field mapping ─────
type ImportType = 'students' | 'exam_results' | 'payments' | 'sessions' | 'attendance' | 'inventory'

const TYPE_COLLECTION: Record<ImportType, string> = {
  students: 'students',
  exam_results: 'examAttempts',
  payments: 'payments',
  sessions: 'schedule',
  attendance: 'attendance',
  inventory: 'kitchenInventory',
}

const EXTRACT_PROMPTS: Record<ImportType, string> = {
  students:
    `Extract student records from the content and return ONLY a JSON array. Each object: { "displayName": string, "email": string, "phone": string, "nic": string, "courseId": string, "address": string, "dateOfBirth": string, "status": "active" }. Map columns like name/full_name/student_name→displayName, email/email_address→email, phone/mobile/contact→phone, nic/national_id→nic, course/program→courseId, address→address, dob/date_of_birth/birthday→dateOfBirth. Use "" for missing values. Return ONLY the JSON array — no markdown, no explanation.`,
  exam_results:
    `Extract exam result records and return ONLY a JSON array. Each object: { "studentEmail": string, "studentId": string, "paperId": string, "score": number, "date": string }. Map student_id/email→studentEmail or studentId, paper_id/exam→paperId, score/marks→score, date→date. Use "" or 0 for missing. Return ONLY the JSON array.`,
  payments:
    `Extract payment records and return ONLY a JSON array. Each object: { "studentEmail": string, "studentId": string, "amount": number, "date": string, "method": string, "status": string }. Map student_id/email→studentEmail or studentId, amount→amount, date→date, method→method, status→status. Use "" or 0 for missing. Return ONLY the JSON array.`,
  sessions:
    `Extract class session records and return ONLY a JSON array. Each object: { "title": string, "date": string, "startTime": string, "endTime": string, "courseId": string, "teacherName": string, "location": string, "type": string }. Map title→title, date→date (YYYY-MM-DD), time→startTime, teacher→teacherName, course→courseId, location→location. Use "" for missing. Return ONLY the JSON array.`,
  attendance:
    `Extract attendance records and return ONLY a JSON array. Each object: { "studentEmail": string, "studentId": string, "date": string, "status": string }. status must be one of present/absent/late. Map student_id/email→studentEmail or studentId, date→date, status→status. Use "" for missing. Return ONLY the JSON array.`,
  inventory:
    `Extract inventory records and return ONLY a JSON array. Each object: { "name": string, "quantity": number, "unit": string, "category": string }. Map item_name/name→name, quantity→quantity, unit→unit, category→category. Use "" or 0 for missing. Return ONLY the JSON array.`,
}

// Lowercase-key lookup helper for defensive server-side mapping.
function pick(row: Record<string, unknown>, keys: string[]): unknown {
  const lower: Record<string, unknown> = {}
  for (const k of Object.keys(row)) lower[k.toLowerCase().trim()] = row[k]
  for (const k of keys) {
    const v = lower[k]
    if (v !== undefined && v !== null && String(v).trim() !== '') return v
  }
  return undefined
}
const str = (v: unknown) => (v === undefined || v === null ? '' : String(v).trim())
const num = (v: unknown) => {
  const n = Number(String(v ?? '').replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

function mapRow(type: ImportType, row: Record<string, unknown>): Record<string, unknown> {
  switch (type) {
    case 'students':
      return {
        displayName: str(pick(row, ['displayname', 'name', 'full_name', 'student_name', 'fullname'])),
        email: str(pick(row, ['email', 'email_address', 'emailaddress'])).toLowerCase(),
        phone: str(pick(row, ['phone', 'mobile', 'contact', 'phone_number'])),
        nic: str(pick(row, ['nic', 'national_id', 'nationalid'])),
        courseId: str(pick(row, ['courseid', 'course', 'program', 'programme'])),
        address: str(pick(row, ['address'])),
        dateOfBirth: str(pick(row, ['dateofbirth', 'dob', 'date_of_birth', 'birthday'])),
        status: 'active',
      }
    case 'exam_results':
      return {
        studentEmail: str(pick(row, ['studentemail', 'email'])).toLowerCase(),
        studentId: str(pick(row, ['studentid', 'student_id'])),
        paperId: str(pick(row, ['paperid', 'paper_id', 'exam', 'paper'])),
        score: num(pick(row, ['score', 'marks', 'percentage'])),
        date: str(pick(row, ['date', 'completedat', 'completed_at'])),
      }
    case 'payments':
      return {
        studentEmail: str(pick(row, ['studentemail', 'email'])).toLowerCase(),
        studentId: str(pick(row, ['studentid', 'student_id'])),
        amount: num(pick(row, ['amount', 'total'])),
        paymentDate: str(pick(row, ['date', 'paymentdate', 'payment_date'])),
        method: str(pick(row, ['method', 'paymentmethod'])) || 'cash',
        status: str(pick(row, ['status'])) || 'paid',
        currency: 'LKR',
      }
    case 'sessions':
      return {
        title: str(pick(row, ['title', 'session', 'class'])),
        date: str(pick(row, ['date'])),
        startTime: str(pick(row, ['starttime', 'start_time', 'time'])),
        endTime: str(pick(row, ['endtime', 'end_time'])),
        courseId: str(pick(row, ['courseid', 'course', 'program'])),
        teacherName: str(pick(row, ['teachername', 'teacher'])),
        location: str(pick(row, ['location', 'room'])),
        type: str(pick(row, ['type'])) || 'class',
      }
    case 'attendance':
      return {
        studentEmail: str(pick(row, ['studentemail', 'email'])).toLowerCase(),
        studentId: str(pick(row, ['studentid', 'student_id'])),
        date: str(pick(row, ['date'])),
        status: (str(pick(row, ['status'])) || 'present').toLowerCase(),
      }
    case 'inventory':
      return {
        name: str(pick(row, ['name', 'item_name', 'itemname', 'item'])),
        quantity: num(pick(row, ['quantity', 'qty', 'stock'])),
        unit: str(pick(row, ['unit'])) || 'units',
        category: str(pick(row, ['category'])) || 'other',
      }
  }
}

// ── Auth: only admin/owner may run file imports ────────────────────────────────
async function verifyAdmin(req: NextRequest): Promise<boolean> {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return false
  try {
    const decoded = await adminAuth.verifyIdToken(token)
    const snap = await adminDb.collection('users').doc(decoded.uid).get()
    const role = String(snap.data()?.role ?? '')
    return role === 'admin' || role === 'owner'
  } catch {
    return false
  }
}

// ── POST ────────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey === 'your_anthropic_api_key_here' || apiKey.trim() === '') {
    return NextResponse.json({ error: 'AI not configured' }, { status: 500 })
  }

  const contentType = req.headers.get('content-type') || ''

  // ── Legacy JSON path (paste flow) — unchanged behaviour ──────────────────────
  if (contentType.includes('application/json')) {
    try {
      const body = (await req.json()) as { rawText: string; systemPrompt: string }
      const text = await callClaude(apiKey, body.systemPrompt, body.rawText)
      return NextResponse.json({ text })
    } catch (err) {
      console.error('[ImportAI json]', err)
      return NextResponse.json({ error: String(err) }, { status: 500 })
    }
  }

  // ── Multipart file path — admin/owner only ───────────────────────────────────
  if (!contentType.includes('multipart/form-data')) {
    return NextResponse.json({ error: 'Unsupported content type' }, { status: 415 })
  }
  if (!(await verifyAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const mode = String(form.get('mode') || 'detect')
  const files = form.getAll('files').filter((f): f is File => f instanceof File)

  if (files.length === 0) {
    return NextResponse.json({ error: 'No files provided' }, { status: 400 })
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: `Max ${MAX_FILES} files per upload` }, { status: 400 })
  }
  for (const f of files) {
    if (f.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: `${f.name} exceeds the 10MB limit` }, { status: 400 })
    }
  }

  // ── DETECT: classify each file, no writes ──────────────────────────────────
  if (mode === 'detect') {
    const detections = await Promise.all(
      files.map(async (file) => {
        const extracted = await extractText(file)
        if (!extracted.ok) {
          return { fileName: file.name, type: 'unknown', confidence: 0, suggestedCollection: '', detectedFields: [], recordCount: 0, error: extracted.error }
        }
        try {
          const system =
            `You are a data classifier for Epic Campus, a Sri Lankan overseas education institute. Analyze the file content and determine what type of data it contains and where it should be imported. Return JSON only: { "type": "students"|"exam_results"|"payments"|"sessions"|"attendance"|"inventory"|"unknown", "confidence": 0-100, "suggestedCollection": string, "detectedFields": string[], "recordCount": number }`
          const raw = await callClaude(apiKey, system, extracted.text.slice(0, DETECT_SAMPLE_CHARS), 1000)
          const parsed = parseJsonFromText<{
            type: string; confidence: number; suggestedCollection: string; detectedFields: string[]; recordCount: number
          }>(raw)
          return { fileName: file.name, ...parsed }
        } catch (err) {
          return { fileName: file.name, type: 'unknown', confidence: 0, suggestedCollection: '', detectedFields: [], recordCount: 0, error: err instanceof Error ? err.message : String(err) }
        }
      }),
    )
    return NextResponse.json({ detections })
  }

  // ── IMPORT: extract + write for a single confirmed file/type ────────────────
  const file = files[0]
  const type = String(form.get('type') || '') as ImportType
  const confidence = Number(form.get('confidence') || 0)

  if (!(type in TYPE_COLLECTION)) {
    return NextResponse.json({
      success: false, fileName: file.name, detectedType: type || 'unknown', confidence,
      totalRows: 0, imported: 0, failed: 0, skipped: 0, errors: [{ row: 0, reason: 'Unknown data type — cannot import. Please clarify the file contents.' }], collection: '',
    })
  }

  const extracted = await extractText(file)
  if (!extracted.ok) {
    return NextResponse.json({
      success: false, fileName: file.name, detectedType: type, confidence,
      totalRows: 0, imported: 0, failed: 0, skipped: 0, errors: [{ row: 0, reason: extracted.error }], collection: TYPE_COLLECTION[type],
    })
  }

  let rows: Record<string, unknown>[]
  try {
    const raw = await callClaude(apiKey, EXTRACT_PROMPTS[type], extracted.text.slice(0, EXTRACT_MAX_CHARS), 8000)
    const parsed = parseJsonFromText<unknown>(raw)
    rows = Array.isArray(parsed) ? (parsed as Record<string, unknown>[]) : [parsed as Record<string, unknown>]
  } catch (err) {
    return NextResponse.json({
      success: false, fileName: file.name, detectedType: type, confidence,
      totalRows: 0, imported: 0, failed: 0, skipped: 0,
      errors: [{ row: 0, reason: `AI extraction failed: ${err instanceof Error ? err.message : String(err)}` }],
      collection: TYPE_COLLECTION[type],
    })
  }

  const collection = TYPE_COLLECTION[type]
  const importedAt = new Date().toISOString()
  const errors: { row: number; reason: string }[] = []
  let imported = 0
  let skipped = 0

  for (let i = 0; i < rows.length; i++) {
    try {
      const mapped = mapRow(type, rows[i])

      // Students: upsert by email — skip when the email already exists.
      if (type === 'students') {
        const email = String(mapped.email || '').trim().toLowerCase()
        if (!mapped.displayName && !email) {
          errors.push({ row: i + 1, reason: 'Skipped — no name or email' })
          continue
        }
        if (email) {
          const existing = await adminDb.collection('students').where('email', '==', email).limit(1).get()
          if (!existing.empty) {
            skipped++
            continue
          }
        }
      }

      await adminDb.collection(collection).add({ ...mapped, importedAt })
      imported++
    } catch (err) {
      errors.push({ row: i + 1, reason: err instanceof Error ? err.message : String(err) })
    }
  }

  return NextResponse.json({
    success: errors.length === 0,
    fileName: file.name,
    detectedType: type,
    confidence,
    totalRows: rows.length,
    imported,
    failed: errors.length,
    skipped,
    errors,
    collection,
  })
}
