'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
  orderBy,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { COURSE_MAP } from '@/lib/constants/courses'
import { parsePayment } from '@/lib/payments/helpers'
import StudentFeePanel from '@/components/payments/StudentFeePanel'
import { parseAttendance } from '@/lib/attendance/helpers'
import StudentAgentSection from '@/components/students/StudentAgentSection'
import ParentAccessSection from '@/components/students/ParentAccessSection'
import StudentForm from '@/components/students/StudentForm'
import {
  parseStudent,
  STATUS_STYLES,
  PAYMENT_STATUS_STYLES,
  VISA_STATUS_STYLES,
  getInitials,
  formatDate,
  LOCATION_LABELS,
} from '@/lib/students/helpers'
import type { ExamResult, Payment, Student, StudentDocument, AttendanceRecord } from '@/types'

const RELATIONSHIP_STYLES: Record<string, string> = {
  Father: 'bg-blue-50 text-blue-700 border-blue-200',
  Mother: 'bg-pink-50 text-pink-700 border-pink-200',
  Spouse: 'bg-purple-50 text-purple-700 border-purple-200',
  Sibling: 'bg-teal-50 text-teal-700 border-teal-200',
  Guardian: 'bg-amber-50 text-amber-700 border-amber-200',
  Other: 'bg-gray-50 text-gray-700 border-gray-200',
}

type TabId = 'overview' | 'payments' | 'attendance' | 'exams' | 'documents' | 'visa'

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: 'ti-user' },
  { id: 'payments', label: 'Payments', icon: 'ti-credit-card' },
  { id: 'attendance', label: 'Attendance', icon: 'ti-calendar-check' },
  { id: 'exams', label: 'Exams', icon: 'ti-certificate' },
  { id: 'documents', label: 'Documents', icon: 'ti-files' },
  { id: 'visa', label: 'Visa', icon: 'ti-plane' },
]

function parseExamResult(id: string, data: Record<string, unknown>): ExamResult {
  return {
    id,
    examId: String(data.examId ?? ''),
    studentId: String(data.studentId ?? ''),
    score: data.score != null ? Number(data.score) : undefined,
    band: data.band ? String(data.band) : undefined,
    level: data.level ? String(data.level) : undefined,
    status: (data.status as ExamResult['status']) ?? 'pending',
    notes: data.notes ? String(data.notes) : undefined,
    createdAt: String(data.createdAt ?? new Date().toISOString()),
    createdBy: String(data.createdBy ?? ''),
  }
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
      <dt className="font-inter text-sm text-[#5A6A7A]">{label}</dt>
      <dd className="font-inter text-sm font-medium text-[#0D1B2A] sm:text-right">
        {value || '—'}
      </dd>
    </div>
  )
}

function GuardianCard({
  student,
  guardian,
  onEdit,
}: {
  student: Student
  guardian: NonNullable<Student['guardian']>
  onEdit: () => void
}) {
  const [copied, setCopied] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<'sent' | 'error' | null>(null)

  function copyCode() {
    if (guardian.parentPortalCode) {
      void navigator.clipboard.writeText(guardian.parentPortalCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  async function sendPortalCode() {
    if (!guardian.phone || !guardian.parentPortalCode) return
    setSending(true)
    setSendResult(null)
    try {
      const res = await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'guardian-portal',
          phone: guardian.phone,
          name: guardian.name,
          data: {
            studentName: student.name,
            code: guardian.parentPortalCode,
            portalUrl: 'epiccampus.live/parent-register',
          },
        }),
      })
      setSendResult(res.ok ? 'sent' : 'error')
    } catch {
      setSendResult('error')
    } finally {
      setSending(false)
      setTimeout(() => setSendResult(null), 4000)
    }
  }

  return (
    <div className="rounded-xl border border-[#DDE3EC] bg-[#F5F7FB] p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-jakarta text-sm font-bold uppercase tracking-wide text-[#0B3D6B]">
          Guardian / Parent
        </h3>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#DDE3EC] px-3 py-1.5 font-jakarta text-xs font-semibold text-[#5A6A7A] hover:bg-white"
        >
          <span className="ti ti-pencil" />
          Edit
        </button>
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-jakarta text-base font-bold text-[#0D1B2A]">{guardian.name}</p>
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                RELATIONSHIP_STYLES[guardian.relationship] ?? 'bg-gray-50 text-gray-700 border-gray-200'
              }`}
            >
              {guardian.relationship}
            </span>
          </div>

          {guardian.phone && (
            <p className="flex items-center gap-1.5 font-inter text-sm text-[#0D1B2A]">
              <span className="ti ti-phone text-[#0B3D6B]" />
              <a href={`tel:${guardian.phone}`} className="hover:text-[#0B3D6B] hover:underline">
                {guardian.phone}
              </a>
            </p>
          )}

          {guardian.email && (
            <p className="flex items-center gap-1.5 font-inter text-sm text-[#0D1B2A]">
              <span className="ti ti-mail text-[#0B3D6B]" />
              <a href={`mailto:${guardian.email}`} className="hover:text-[#0B3D6B] hover:underline">
                {guardian.email}
              </a>
            </p>
          )}

          {guardian.address && (
            <p className="flex items-start gap-1.5 font-inter text-sm text-[#5A6A7A]">
              <span className="ti ti-map-pin mt-0.5 shrink-0 text-[#0B3D6B]" />
              {guardian.address}
            </p>
          )}
        </div>

        {/* Portal code */}
        {guardian.parentPortalEnabled && guardian.parentPortalCode && (
          <div className="w-full rounded-lg border border-[#E8A020]/30 bg-white p-4 sm:w-auto sm:min-w-[200px]">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[#5A6A7A]">
              Parent Portal Code
            </p>
            <div className="flex items-center gap-2">
              <span className="font-mono text-2xl font-bold tracking-[0.2em] text-[#0B3D6B]">
                {guardian.parentPortalCode}
              </span>
              <button
                type="button"
                onClick={copyCode}
                className="rounded p-1 text-[#5A6A7A] hover:text-[#0B3D6B]"
                title="Copy code"
              >
                <span className={`ti ${copied ? 'ti-check text-green-600' : 'ti-copy'} text-sm`} />
              </button>
            </div>
            <p className="mt-1 text-[10px] text-[#5A6A7A]">epiccampus.live/parent-register</p>

            <button
              type="button"
              disabled={sending || !guardian.phone}
              onClick={() => void sendPortalCode()}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-1.5 font-jakarta text-xs font-semibold text-white hover:bg-[#20c05a] disabled:opacity-60"
            >
              <span className="ti ti-brand-whatsapp text-sm" />
              {sending ? 'Sending…' : 'Send via WhatsApp'}
            </button>
            {sendResult === 'sent' && (
              <p className="mt-1 text-[10px] font-medium text-green-600">Sent to {guardian.phone}</p>
            )}
            {sendResult === 'error' && (
              <p className="mt-1 text-[10px] font-medium text-red-600">Failed to send — check Twilio config</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function StudentProfilePage() {
  const params = useParams()
  const router = useRouter()
  const studentId = params.id as string

  const [student, setStudent] = useState<Student | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [examResults, setExamResults] = useState<ExamResult[]>([])
  const [documents, setDocuments] = useState<StudentDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabId>('overview')
  const [formOpen, setFormOpen] = useState(false)

  // Fee schedule state
  const [feeSchedule, setFeeSchedule] = useState<{
    registrationFee: number
    courseFee: number
    otherFees: { label: string; amount: number }[]
    currency: string
  }>({ registrationFee: 25000, courseFee: 60000, otherFees: [], currency: 'LKR' })
  const [feeSaving, setFeeSaving] = useState(false)
  const [feeSaved, setFeeSaved] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const studentSnap = await getDoc(doc(db, 'students', studentId))
      if (!studentSnap.exists()) {
        setStudent(null)
        return
      }
      const s = parseStudent(studentSnap.id, studentSnap.data() as Record<string, unknown>)
      setStudent(s)
      const rawFs = (studentSnap.data() as Record<string, unknown>).feeSchedule as Record<string, unknown> | undefined
      if (rawFs) {
        setFeeSchedule({
          registrationFee: Number(rawFs.registrationFee ?? 25000),
          courseFee: Number(rawFs.courseFee ?? 60000),
          otherFees: Array.isArray(rawFs.otherFees)
            ? (rawFs.otherFees as { label: string; amount: number }[])
            : [],
          currency: String(rawFs.currency ?? 'LKR'),
        })
      }

      const [paymentsSnap, attendanceSnap, examsSnap, docsSnap] = await Promise.all([
        getDocs(
          query(
            collection(db, 'payments'),
            where('studentId', '==', studentId),
            orderBy('createdAt', 'desc'),
          ),
        ).catch(() => getDocs(query(collection(db, 'payments'), where('studentId', '==', studentId)))),
        getDocs(
          query(
            collection(db, 'attendance'),
            where('studentId', '==', studentId),
            orderBy('date', 'desc'),
          ),
        ).catch(() => ({ docs: [] })),
        getDocs(
          query(collection(db, 'examResults'), where('studentId', '==', studentId)),
        ),
        getDocs(collection(db, 'students', studentId, 'documents')),
      ])

      setPayments(
        paymentsSnap.docs.map((d) =>
          parsePayment(d.id, d.data() as Record<string, unknown>),
        ),
      )
      setAttendance(
        attendanceSnap.docs.map((d) =>
          parseAttendance(d.id, d.data() as Record<string, unknown>),
        ),
      )
      setExamResults(
        examsSnap.docs.map((d) =>
          parseExamResult(d.id, d.data() as Record<string, unknown>),
        ),
      )
      setDocuments(
        docsSnap.docs.map((d) => ({
          id: d.id,
          name: String(d.data().name ?? 'Document'),
          url: String(d.data().url ?? ''),
          uploadedAt: String(d.data().uploadedAt ?? ''),
        })),
      )
    } catch (err) {
      console.error('[StudentProfile]', err)
    } finally {
      setLoading(false)
    }
  }, [studentId])

  useEffect(() => {
    loadData()
  }, [loadData])

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-32 rounded-xl bg-[#DDE3EC]" />
        <div className="h-10 w-64 rounded bg-[#DDE3EC]" />
        <div className="h-64 rounded-xl bg-[#DDE3EC]" />
      </div>
    )
  }

  if (!student) {
    return (
      <div className="rounded-xl border border-[#DDE3EC] bg-white p-12 text-center">
        <p className="font-jakarta text-lg font-bold text-[#0D1B2A]">Student not found</p>
        <Link
          href="/students"
          className="mt-4 inline-block text-sm font-medium text-[#0B3D6B] hover:text-[#E8A020]"
        >
          ← Back to students
        </Link>
      </div>
    )
  }

  const course = COURSE_MAP[student.courseId]
  const visaTimeline = [
    { status: 'not-started' as const, label: 'Application not started', date: student.createdAt },
    ...(student.visaStatus !== 'not-started'
      ? [{ status: student.visaStatus!, label: `Visa ${student.visaStatus?.replace('-', ' ')}`, date: student.enrollmentDate ?? student.createdAt }]
      : []),
  ]

  return (
    <div className="space-y-6">
      <Link
        href="/students"
        className="inline-flex items-center gap-1 font-inter text-sm text-[#5A6A7A] hover:text-[#0B3D6B]"
      >
        <span className="ti ti-arrow-left" aria-hidden="true" />
        Back to students
      </Link>

      <div className="rounded-xl border border-[#DDE3EC] bg-white p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            {student.photoUrl ? (
              <img
                src={student.photoUrl}
                alt={student.name}
                className="h-20 w-20 rounded-full object-cover ring-4 ring-[#E8A020]/30"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#0B3D6B] text-2xl font-bold text-white">
                {getInitials(student.name)}
              </div>
            )}
            <div>
              <h2 className="font-jakarta text-2xl font-bold text-[#0D1B2A]">{student.name}</h2>
              <p className="text-sm text-[#5A6A7A]">{student.studentCode}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-[#DDE3EC] bg-[#F5F7FB] px-2.5 py-0.5 text-xs font-medium text-[#0B3D6B]">
                  {course?.flag} {course?.label}
                </span>
                <span
                  className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[student.status]}`}
                >
                  {student.status}
                </span>
                {student.paymentStatus && (
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${PAYMENT_STATUS_STYLES[student.paymentStatus]}`}
                  >
                    {student.paymentStatus}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-[#0B3D6B] px-4 py-2 font-jakarta text-sm font-semibold text-[#0B3D6B] hover:bg-[#0B3D6B]/5"
            >
              <span className="ti ti-pencil" aria-hidden="true" />
              Edit
            </button>
            <button
              type="button"
              onClick={() => router.push('/payments')}
              className="inline-flex items-center gap-2 rounded-lg bg-[#E8A020] px-4 py-2 font-jakarta text-sm font-bold text-[#0B3D6B] hover:bg-[#F5B942]"
            >
              <span className="ti ti-plus" aria-hidden="true" />
              Add Payment
            </button>
          </div>
        </div>
      </div>

      <div className="border-b border-[#DDE3EC]">
        <nav className="-mb-px flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 font-inter text-sm font-medium transition-colors ${
                tab === t.id
                  ? 'border-[#E8A020] text-[#0B3D6B]'
                  : 'border-transparent text-[#5A6A7A] hover:text-[#0B3D6B]'
              }`}
            >
              <span className={`ti ${t.icon}`} aria-hidden="true" />
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="rounded-xl border border-[#DDE3EC] bg-white p-6">
        {tab === 'overview' && (
          <div className="space-y-6">
            <StudentAgentSection student={student} onUpdated={loadData} />

            {/* Guardian card */}
            {student.guardian ? (
              <GuardianCard
                student={student}
                guardian={student.guardian}
                onEdit={() => setFormOpen(true)}
              />
            ) : (
              <div className="rounded-xl border border-dashed border-[#DDE3EC] p-5 text-center">
                <span className="ti ti-user-heart mb-2 block text-2xl text-[#DDE3EC]" />
                <p className="font-inter text-sm text-[#5A6A7A]">No guardian details added</p>
                <button
                  type="button"
                  onClick={() => setFormOpen(true)}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-[#0B3D6B] px-3 py-1.5 font-jakarta text-xs font-semibold text-[#0B3D6B] hover:bg-[#0B3D6B]/5"
                >
                  <span className="ti ti-plus" />
                  Add Guardian Details
                </button>
              </div>
            )}

            <ParentAccessSection student={student} onUpdated={loadData} />

            {/* Fee Schedule */}
            <div className="rounded-lg border border-[#DDE3EC] p-5">
              <h3 className="mb-4 font-jakarta text-sm font-bold uppercase tracking-wide text-[#0B3D6B]">
                Fee Schedule (LKR)
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#5A6A7A]">Registration Fee (LKR)</label>
                  <input
                    type="number"
                    value={feeSchedule.registrationFee}
                    onChange={(e) => setFeeSchedule((f) => ({ ...f, registrationFee: Number(e.target.value) }))}
                    className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm focus:border-[#0B3D6B] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#5A6A7A]">Course Fee (LKR)</label>
                  <input
                    type="number"
                    value={feeSchedule.courseFee}
                    onChange={(e) => setFeeSchedule((f) => ({ ...f, courseFee: Number(e.target.value) }))}
                    className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm focus:border-[#0B3D6B] focus:outline-none"
                  />
                </div>
              </div>
              {feeSchedule.otherFees.length > 0 && (
                <div className="mt-3 space-y-2">
                  {feeSchedule.otherFees.map((f, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        value={f.label}
                        onChange={(e) => setFeeSchedule((fs) => {
                          const arr = [...fs.otherFees]; arr[i] = { ...arr[i], label: e.target.value }; return { ...fs, otherFees: arr }
                        })}
                        placeholder="Fee label"
                        className="flex-1 rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm focus:border-[#0B3D6B] focus:outline-none"
                      />
                      <input
                        type="number"
                        value={f.amount}
                        onChange={(e) => setFeeSchedule((fs) => {
                          const arr = [...fs.otherFees]; arr[i] = { ...arr[i], amount: Number(e.target.value) }; return { ...fs, otherFees: arr }
                        })}
                        placeholder="Amount"
                        className="w-32 rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm focus:border-[#0B3D6B] focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setFeeSchedule((fs) => ({ ...fs, otherFees: fs.otherFees.filter((_, j) => j !== i) }))}
                        className="rounded-lg px-2 text-red-400 hover:text-red-600"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setFeeSchedule((f) => ({ ...f, otherFees: [...f.otherFees, { label: '', amount: 0 }] }))}
                  className="text-xs font-medium text-[#0B3D6B] hover:underline"
                >
                  + Add fee item
                </button>
                <div className="ml-auto flex items-center gap-3">
                  {feeSaved && <span className="text-xs text-green-600">✓ Saved</span>}
                  <button
                    type="button"
                    disabled={feeSaving}
                    onClick={async () => {
                      setFeeSaving(true)
                      try {
                        await updateDoc(doc(db, 'students', studentId), { feeSchedule: { ...feeSchedule, currency: 'LKR' } })
                        setFeeSaved(true)
                        setTimeout(() => setFeeSaved(false), 3000)
                      } finally {
                        setFeeSaving(false)
                      }
                    }}
                    className="rounded-lg bg-[#0B3D6B] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0B3D6B]/90 disabled:opacity-60"
                  >
                    {feeSaving ? 'Saving…' : 'Save Fee Schedule'}
                  </button>
                </div>
              </div>
            </div>
            <div className="grid gap-8 lg:grid-cols-2">
            <div>
              <h3 className="mb-4 font-jakarta text-sm font-bold uppercase tracking-wide text-[#0B3D6B]">
                Personal Information
              </h3>
              <dl className="space-y-3">
                <InfoRow label="NIC" value={student.nic} />
                <InfoRow label="Date of Birth" value={formatDate(student.dateOfBirth)} />
                <InfoRow label="Phone" value={student.mobile} />
                <InfoRow label="Email" value={student.email} />
                <InfoRow label="Address" value={student.address} />
              </dl>
            </div>
            <div>
              <h3 className="mb-4 font-jakarta text-sm font-bold uppercase tracking-wide text-[#0B3D6B]">
                Enrollment Details
              </h3>
              <dl className="space-y-3">
                <InfoRow label="Course" value={course?.label} />
                <InfoRow label="Batch" value={student.batchId} />
                <InfoRow
                  label="Batch period"
                  value={
                    student.batchStartDate && student.batchEndDate
                      ? `${formatDate(student.batchStartDate)} → ${formatDate(student.batchEndDate)}`
                      : undefined
                  }
                />
                <InfoRow
                  label="Location"
                  value={
                    student.location ? LOCATION_LABELS[student.location] : undefined
                  }
                />
                <InfoRow label="Enrolled" value={formatDate(student.enrollmentDate)} />
                <InfoRow label="Expected Completion" value={formatDate(student.expectedCompletionDate)} />
                <InfoRow
                  label="Fee"
                  value={
                    student.feeAmount != null
                      ? `${student.feeCurrency ?? 'LKR'} ${student.feeAmount.toLocaleString()}`
                      : undefined
                  }
                />
                <InfoRow label="Branch" value={student.branchId} />
              </dl>
              {student.notes && (
                <div className="mt-6 rounded-lg bg-[#F5F7FB] p-4">
                  <p className="text-xs font-medium uppercase text-[#5A6A7A]">Notes</p>
                  <p className="mt-1 text-sm text-[#0D1B2A]">{student.notes}</p>
                </div>
              )}
            </div>
          </div>
          </div>
        )}

        {tab === 'payments' && (
          <StudentFeePanel student={student} payments={payments} onUpdated={loadData} />
        )}

        {tab === 'attendance' && (
          <div>
            {attendance.length === 0 ? (
              <p className="py-8 text-center text-sm text-[#5A6A7A]">
                No attendance records yet. Records will appear here once marked.
              </p>
            ) : (
              <ul className="divide-y divide-[#DDE3EC]">
                {attendance.map((a) => (
                  <li key={a.id} className="flex items-center justify-between py-3">
                    <span className="text-sm text-[#0D1B2A]">{formatDate(a.date)}</span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                        a.status === 'present'
                          ? 'bg-emerald-50 text-emerald-700'
                          : a.status === 'absent'
                            ? 'bg-red-50 text-red-700'
                            : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {a.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === 'exams' && (
          <div>
            {examResults.length === 0 ? (
              <p className="py-8 text-center text-sm text-[#5A6A7A]">No exam results recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#DDE3EC] text-xs uppercase text-[#5A6A7A]">
                      <th className="pb-3 pr-4">Exam</th>
                      <th className="pb-3 pr-4">Score / Band</th>
                      <th className="pb-3">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DDE3EC]">
                    {examResults.map((r) => (
                      <tr key={r.id}>
                        <td className="py-3 pr-4 font-medium">{r.examId}</td>
                        <td className="py-3 pr-4 text-[#5A6A7A]">
                          {r.score ?? r.band ?? r.level ?? '—'}
                        </td>
                        <td className="py-3 capitalize">{r.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'documents' && (
          <div>
            {student.photoUrl && (
              <div className="mb-4 flex items-center gap-3 rounded-lg border border-[#DDE3EC] p-3">
                <span className="ti ti-photo text-[#0B3D6B]" aria-hidden="true" />
                <a
                  href={student.photoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-[#0B3D6B] hover:underline"
                >
                  Profile Photo
                </a>
              </div>
            )}
            {documents.length === 0 ? (
              <p className="py-8 text-center text-sm text-[#5A6A7A]">
                No documents uploaded yet.
              </p>
            ) : (
              <ul className="divide-y divide-[#DDE3EC]">
                {documents.map((d) => (
                  <li key={d.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <span className="ti ti-file text-[#0B3D6B]" aria-hidden="true" />
                      <span className="text-sm font-medium text-[#0D1B2A]">{d.name}</span>
                    </div>
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-[#0B3D6B] hover:text-[#E8A020]"
                    >
                      View
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === 'visa' && (
          <div>
            <div className="mb-4">
              <span
                className={`inline-flex rounded-full border px-3 py-1 text-sm font-medium capitalize ${VISA_STATUS_STYLES[student.visaStatus ?? 'not-started']}`}
              >
                {student.visaStatus?.replace('-', ' ') ?? 'not started'}
              </span>
            </div>
            <ol className="relative ml-3 border-l-2 border-[#DDE3EC] pl-6">
              {visaTimeline.map((event, i) => (
                <li key={i} className="mb-6 last:mb-0">
                  <span className="absolute -left-[9px] flex h-4 w-4 items-center justify-center rounded-full bg-[#E8A020] ring-4 ring-white" />
                  <p className="font-medium capitalize text-[#0D1B2A]">{event.label}</p>
                  <p className="text-xs text-[#5A6A7A]">{formatDate(event.date)}</p>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      <StudentForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        student={student}
        onSaved={loadData}
      />
    </div>
  )
}
