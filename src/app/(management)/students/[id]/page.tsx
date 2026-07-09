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
import toast from 'react-hot-toast'
import { auth, db } from '@/lib/firebase/client'
import { COURSE_MAP } from '@/lib/constants/courses'
import { parsePayment } from '@/lib/payments/helpers'
import StudentFeePanel from '@/components/payments/StudentFeePanel'
import { parseAttendance } from '@/lib/attendance/helpers'
import StudentAgentSection from '@/components/students/StudentAgentSection'
import ParentAccessSection from '@/components/students/ParentAccessSection'
import StudentForm from '@/components/students/StudentForm'
import StudentIDCard from '@/components/students/StudentIDCard'
import WhatsAppFollowUpModal from '@/components/students/WhatsAppFollowUpModal'
import { useManagement } from '@/components/layout/ManagementContext'
import { studentToIdCardProps } from '@/lib/students/idCard'
import { downloadIDCard } from '@/lib/utils/downloadIDCard'
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

function generatePassword(): string {
  const animals = ['Tiger', 'Eagle', 'Panda', 'Cobra', 'Wolf', 'Falcon', 'Lion', 'Bear', 'Shark', 'Hawk']
  const words = ['Stone', 'River', 'Cloud', 'Storm', 'Fire', 'Moon', 'Star', 'Peak', 'Forest', 'Ocean']
  const num = Math.floor(10 + Math.random() * 90)
  return (
    animals[Math.floor(Math.random() * animals.length)] +
    num +
    words[Math.floor(Math.random() * words.length)]
  )
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
  const { user, hasRole } = useManagement()
  const studentId = params.id as string

  const [student, setStudent] = useState<Student | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [examResults, setExamResults] = useState<ExamResult[]>([])
  const [documents, setDocuments] = useState<StudentDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabId>('overview')
  const [formOpen, setFormOpen] = useState(false)
  const [idCardOpen, setIdCardOpen] = useState(false)
  const [idDownloading, setIdDownloading] = useState(false)
  const [followUpOpen, setFollowUpOpen] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [loginType, setLoginType] = useState<'id' | 'email' | 'username' | 'record' | 'nic'>('id')
  const [loginInput, setLoginInput] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginSaving, setLoginSaving] = useState(false)
  const [regNumber, setRegNumber] = useState('')
  const [studentIdNum, setStudentIdNum] = useState('')
  const [savingIds, setSavingIds] = useState(false)
  const [idSaveMsg, setIdSaveMsg] = useState('')
  // Last saved login credentials (read from the student doc for staff reference).
  const [savedLoginEmail, setSavedLoginEmail] = useState('')
  const [savedLastPassword, setSavedLastPassword] = useState('')
  const [savedLoginType, setSavedLoginType] = useState('')
  const [copiedField, setCopiedField] = useState<'email' | 'password' | null>(null)

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
      const studentData = studentSnap.data() as Record<string, unknown>
      const s = parseStudent(studentSnap.id, studentData)
      setStudent(s)
      setRegNumber(String(studentData.registrationNumber ?? ''))
      setStudentIdNum(String(studentData.studentId ?? ''))
      setSavedLoginEmail(String(studentData.loginEmail ?? ''))
      setSavedLastPassword(String(studentData.lastPassword ?? ''))
      setSavedLoginType(String(studentData.loginType ?? ''))
      const rawFs = studentData.feeSchedule as Record<string, unknown> | undefined
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
        ).catch((err) => { console.error('[StudentProfile] attendance', err); return { docs: [] } }),
        getDocs(
          query(collection(db, 'examResults'), where('studentId', '==', studentId)),
        ).catch((err) => { console.error('[StudentProfile] exams', err); return { docs: [] } }),
        getDocs(collection(db, 'students', studentId, 'documents'))
          .catch((err) => { console.error('[StudentProfile] documents', err); return { docs: [] } }),
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

  // The login email is derived from the Student ID ({idNumber}@epiccampus.lk); it
  // falls back to a stored loginEmail, then the legacy real email for older students.
  function deriveLoginEmail(s: Student | null): string {
    if (!s) return ''
    if (s.loginEmail) return s.loginEmail
    if (s.idNumber) return `${s.idNumber}@epiccampus.lk`
    return s.email ?? ''
  }

  // Option 4 ("ID from their student record"): prefer a stored idNumber, else the
  // student code with hyphens/spaces stripped (EC-2025-001 → EC20250001).
  function recordDerivedId(s: Student | null): string | null {
    if (!s) return null
    if (s.idNumber) return s.idNumber
    if (s.studentCode) return s.studentCode.replace(/[-\s]/g, '')
    return null
  }

  // The final Firebase Auth login email for whatever LOGIN TYPE is selected.
  function computeFinalLoginEmail(): string {
    const val = loginInput.trim()
    switch (loginType) {
      case 'email':
        return val.toLowerCase()
      case 'id':
        return val ? `${val}@epiccampus.lk` : ''
      case 'nic':
        return val ? `${val}@epiccampus.lk` : ''
      case 'username':
        return val ? `${val.toLowerCase()}@epiccampus.lk` : ''
      case 'record': {
        const rec = recordDerivedId(student)
        return rec ? `${rec}@epiccampus.lk` : ''
      }
      default:
        return ''
    }
  }

  function openLoginModal() {
    setLoginType('id')
    setLoginInput('')
    setLoginPassword(generatePassword())
    setShowLoginModal(true)
  }

  async function handleSaveLogin() {
    // Students added manually have no Firebase Auth account (no uid) yet — that's
    // fine: the set-login route creates one from studentId. Only require the doc.
    if (!student) return
    const finalLoginEmail = computeFinalLoginEmail()
    if (!finalLoginEmail) {
      toast.error(loginType === 'record' ? 'No ID found — choose another option' : 'Enter a login value')
      return
    }
    if ((loginType === 'id' || loginType === 'username' || loginType === 'nic') && /\s/.test(loginInput.trim())) {
      toast.error('Login value cannot contain spaces')
      return
    }
    if (loginPassword.trim().length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    setLoginSaving(true)
    try {
      const token = await auth.currentUser?.getIdToken()
      const res = await fetch('/api/students/set-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          uid: student.uid,
          loginEmail: finalLoginEmail,
          password: loginPassword.trim(),
          loginType,
          studentId: student.id,
        }),
      })
      const data = (await res.json()) as { success?: boolean; error?: string }
      if (data.success) {
        toast.success('Login created successfully')
        setShowLoginModal(false)
      } else {
        toast.error('Error: ' + (data.error ?? 'Unknown error'))
      }
    } catch {
      toast.error('Network error — try again')
    } finally {
      setLoginSaving(false)
    }
  }

  function copyField(field: 'email' | 'password', value: string) {
    if (!value) return
    void navigator.clipboard.writeText(value).catch(() => {})
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  // Credentials card visibility — front-desk roles only.
  const canSeeCredentials = hasRole('admin') || hasRole('owner') || hasRole('reception')

  const LOGIN_TYPE_LABELS: Record<string, string> = {
    id: 'Student ID Number',
    nic: 'National ID Card (NIC)',
    email: 'Gmail / Email',
    username: 'Name @ epiccampus.lk',
    record: 'Student record ID',
  }

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
              {(student.pendingAmount ?? 0) > 0 && (
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
                  <span className="ti ti-alert-triangle" aria-hidden="true" />
                  Payment Incomplete — {student.feeCurrency ?? 'LKR'} {student.pendingAmount!.toLocaleString()} pending
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setIdCardOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-[#DDE3EC] px-4 py-2 font-jakarta text-sm font-semibold text-[#0B3D6B] hover:bg-[#F5F7FB]"
            >
              <span className="ti ti-id-badge-2" aria-hidden="true" />
              ID Card
            </button>
            <button
              type="button"
              onClick={() => setFollowUpOpen(true)}
              disabled={!student.mobile}
              className="inline-flex items-center gap-2 rounded-lg border border-[#25D366] px-4 py-2 font-jakarta text-sm font-semibold text-[#128C7E] hover:bg-[#25D366]/10 disabled:opacity-50"
            >
              <span className="ti ti-brand-whatsapp" aria-hidden="true" />
              Send Follow-up
            </button>
            <button
              type="button"
              onClick={openLoginModal}
              className="inline-flex items-center gap-2 rounded-lg border border-[#25D366] px-4 py-2 font-jakarta text-sm font-semibold text-[#128C7E] hover:bg-[#25D366]/10 disabled:opacity-50"
            >
              <span className="ti ti-key" aria-hidden="true" />
              Set Login
            </button>
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
            <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-5">
              <h3 className="mb-4 font-jakarta text-sm font-bold uppercase tracking-wide text-[#0B3D6B] dark:text-white">
                Student Identifiers
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#5A6A7A] dark:text-white/50">
                    Registration Number
                  </label>
                  <input
                    value={regNumber}
                    onChange={(e) => setRegNumber(e.target.value)}
                    placeholder="e.g. REG-2024-001"
                    className="w-full rounded-xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.06] px-3 py-2 text-sm text-[#0D1B2A] dark:text-white outline-none focus:border-[#0B3D6B]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#5A6A7A] dark:text-white/50">
                    Student ID Number
                  </label>
                  <input
                    value={studentIdNum}
                    onChange={(e) => setStudentIdNum(e.target.value)}
                    placeholder="e.g. EC-2024-001"
                    className="w-full rounded-xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.06] px-3 py-2 text-sm text-[#0D1B2A] dark:text-white outline-none focus:border-[#0B3D6B]"
                  />
                </div>
                {idSaveMsg && (
                  <p className="text-xs text-emerald-600">{idSaveMsg}</p>
                )}
                <button
                  type="button"
                  disabled={savingIds}
                  onClick={async () => {
                    setSavingIds(true)
                    setIdSaveMsg('')
                    try {
                      await updateDoc(doc(db, 'students', studentId), {
                        registrationNumber: regNumber.trim() || null,
                        studentId: studentIdNum.trim() || null,
                      })
                      setIdSaveMsg('Identifiers saved successfully')
                      setTimeout(() => setIdSaveMsg(''), 3000)
                    } catch (err) {
                      console.error(err)
                      setIdSaveMsg('Failed to save — try again')
                    } finally {
                      setSavingIds(false)
                    }
                  }}
                  className="w-full rounded-xl bg-[#E8A020] py-2.5 text-sm font-bold text-[#0B3D6B] hover:bg-[#d4911c] disabled:opacity-50"
                >
                  {savingIds ? 'Saving…' : 'Save Identifiers'}
                </button>
              </div>
            </div>

            {/* Login Credentials — admin / owner / reception only */}
            {canSeeCredentials && (
              <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-5">
                <h3 className="mb-4 flex items-center gap-2 font-jakarta text-sm font-bold uppercase tracking-wide text-[#0B3D6B] dark:text-white">
                  <span className="ti ti-lock text-base" aria-hidden="true" /> Login Credentials
                </h3>
                <div className="space-y-3">
                  {/* Login Email */}
                  <div className="rounded-xl border border-[#DDE3EC] dark:border-white/[0.08] p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-[#5A6A7A] dark:text-white/40">Login Email</p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className={`min-w-0 truncate font-mono text-sm ${savedLoginEmail ? 'text-[#0D1B2A] dark:text-white' : 'text-[#5A6A7A] dark:text-white/40'}`}>
                        {savedLoginEmail || 'Not set yet'}
                      </span>
                      {savedLoginEmail && (
                        <button
                          type="button"
                          onClick={() => copyField('email', savedLoginEmail)}
                          className="shrink-0 rounded-lg border border-[#DDE3EC] dark:border-white/15 px-2.5 py-1 text-xs font-semibold text-[#0B3D6B] dark:text-white/70 hover:bg-[#F5F7FB] dark:hover:bg-white/[0.06]"
                        >
                          {copiedField === 'email' ? 'Copied!' : 'Copy'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Last Password Set */}
                  <div className="rounded-xl border border-[#DDE3EC] dark:border-white/[0.08] p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-[#5A6A7A] dark:text-white/40">Last Password Set</p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className={`min-w-0 truncate font-mono text-sm font-bold ${savedLastPassword ? 'text-[#0B3D6B] dark:text-[#E8A020]' : 'text-[#5A6A7A] dark:text-white/40'}`}>
                        {savedLastPassword || 'Not set yet'}
                      </span>
                      {savedLastPassword && (
                        <button
                          type="button"
                          onClick={() => copyField('password', savedLastPassword)}
                          className="shrink-0 rounded-lg border border-[#DDE3EC] dark:border-white/15 px-2.5 py-1 text-xs font-semibold text-[#0B3D6B] dark:text-white/70 hover:bg-[#F5F7FB] dark:hover:bg-white/[0.06]"
                        >
                          {copiedField === 'password' ? 'Copied!' : 'Copy'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Login Type (if recorded) */}
                  {savedLoginType && (
                    <div className="rounded-xl border border-[#DDE3EC] dark:border-white/[0.08] p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-[#5A6A7A] dark:text-white/40">Login Type</p>
                      <span className="mt-1 block text-sm text-[#0D1B2A] dark:text-white">
                        {LOGIN_TYPE_LABELS[savedLoginType] ?? savedLoginType}
                      </span>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={openLoginModal}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#0B3D6B] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0a3460]"
                >
                  <span className="ti ti-key" aria-hidden="true" /> Set / Reset Login
                </button>
              </div>
            )}

            <div className="grid gap-8 lg:grid-cols-2">
            <div>
              <h3 className="mb-4 font-jakarta text-sm font-bold uppercase tracking-wide text-[#0B3D6B]">
                Personal Information
              </h3>
              <dl className="space-y-3">
                <InfoRow label="NIC" value={student.nic} />
                <InfoRow label="Date of Birth" value={formatDate(student.dateOfBirth)} />
                <InfoRow label="Phone" value={student.mobile} />
                {student.idNumber && <InfoRow label="Login ID" value={student.idNumber} />}
                <InfoRow label="Login Email" value={deriveLoginEmail(student)} />
                <InfoRow
                  label="Personal Email"
                  value={student.personalEmail ?? (student.idNumber ? null : student.email)}
                />
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
                  label="Total Fee"
                  value={
                    student.feeAmount != null
                      ? `${student.feeCurrency ?? 'LKR'} ${student.feeAmount.toLocaleString()}`
                      : undefined
                  }
                />
                {student.paymentStatus === 'partial' && (
                  <InfoRow
                    label="Amount Paid"
                    value={`${student.feeCurrency ?? 'LKR'} ${(student.paidAmount ?? 0).toLocaleString()}`}
                  />
                )}
                {(student.pendingAmount ?? 0) > 0 && (
                  <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
                    <dt className="font-inter text-sm text-[#5A6A7A]">Pending Amount</dt>
                    <dd className="font-inter text-sm font-semibold text-red-600 dark:text-red-400 sm:text-right">
                      {student.feeCurrency ?? 'LKR'} {student.pendingAmount!.toLocaleString()}
                    </dd>
                  </div>
                )}
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

      {idCardOpen && student && (
        <>
          <div
            className="fixed inset-0 z-40 bg-[#0D1B2A]/40 backdrop-blur-sm"
            onClick={() => setIdCardOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="student-id-modal-title"
              className="w-full max-w-md rounded-xl border border-[#DDE3EC] bg-white p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h2
                id="student-id-modal-title"
                className="mb-4 text-center font-jakarta text-lg font-bold text-[#0D1B2A]"
              >
                Student ID Card
              </h2>
              <div className="flex justify-center overflow-x-auto rounded-xl bg-[#F5F7FB] p-4">
                <div id="admin-student-id-card">
                  <StudentIDCard {...studentToIdCardProps(student)} />
                </div>
              </div>
              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIdCardOpen(false)}
                  className="flex min-h-[44px] flex-1 items-center justify-center rounded-lg border border-[#DDE3EC] text-sm font-semibold text-[#5A6A7A]"
                >
                  Close
                </button>
                <button
                  type="button"
                  disabled={idDownloading}
                  onClick={async () => {
                    setIdDownloading(true)
                    try {
                      await downloadIDCard('admin-student-id-card', student.name)
                    } finally {
                      setIdDownloading(false)
                    }
                  }}
                  className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg bg-[#E8A020] text-sm font-bold text-[#0B3D6B] hover:bg-[#F5B942] disabled:opacity-60"
                >
                  <span className="ti ti-download" aria-hidden="true" />
                  {idDownloading ? 'Preparing…' : 'Download PNG'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <StudentForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        student={student}
        onSaved={loadData}
      />

      {showLoginModal && (
        <>
          <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
               onClick={() => setShowLoginModal(false)} />
          <div className="fixed left-1/2 top-1/2 z-[70] w-full max-w-md
                          -translate-x-1/2 -translate-y-1/2 rounded-2xl
                          bg-[#0D1B2A] p-6 shadow-2xl">

            <h2 className="text-lg font-bold text-white">Set Student Login</h2>
            <p className="mt-1 text-sm text-gray-400">
              Save credentials — student can log in immediately.
            </p>

            <div className="mt-4 space-y-3">
              {/* Login type selector */}
              <div>
                <label className="text-xs font-bold uppercase text-gray-400">Login Type</label>
                <select
                  value={loginType}
                  onChange={(e) => {
                    setLoginType(e.target.value as 'id' | 'email' | 'username' | 'record' | 'nic')
                    setLoginInput('')
                  }}
                  className="mt-1 w-full rounded-xl bg-[#0B3D6B] px-4 py-3 text-sm text-white outline-none"
                >
                  <option value="id">Student ID Number</option>
                  <option value="nic">National ID Card (NIC)</option>
                  <option value="email">Their Personal Gmail / Email</option>
                  <option value="username">Name @ epiccampus.lk</option>
                  <option value="record">ID from their student record</option>
                </select>
              </div>

              {/* NIC — login email + password both derive from the NIC number */}
              {loginType === 'nic' && (
                <div>
                  <label className="text-xs font-bold uppercase text-gray-400">NIC Number</label>
                  <input
                    type="text"
                    value={loginInput}
                    onChange={(e) => {
                      setLoginInput(e.target.value)
                      setLoginPassword(e.target.value) // NIC doubles as the password
                    }}
                    placeholder="e.g. 200012345678"
                    className="mt-1 w-full rounded-xl bg-[#0B3D6B] px-4 py-3 font-mono text-sm text-white outline-none placeholder:text-gray-500"
                  />
                  <p className="mt-1 text-xs text-gray-400">Student types their NIC as password</p>
                </div>
              )}

              {/* Conditional input per login type */}
              {loginType === 'id' && (
                <div>
                  <label className="text-xs font-bold uppercase text-gray-400">Student ID</label>
                  <input
                    type="text"
                    value={loginInput}
                    onChange={(e) => setLoginInput(e.target.value)}
                    placeholder="e.g. 200000001"
                    className="mt-1 w-full rounded-xl bg-[#0B3D6B] px-4 py-3 font-mono text-sm text-white outline-none placeholder:text-gray-500"
                  />
                </div>
              )}
              {loginType === 'email' && (
                <div>
                  <label className="text-xs font-bold uppercase text-gray-400">Email Address</label>
                  <input
                    type="email"
                    value={loginInput}
                    onChange={(e) => setLoginInput(e.target.value)}
                    placeholder="e.g. kasun@gmail.com"
                    className="mt-1 w-full rounded-xl bg-[#0B3D6B] px-4 py-3 font-mono text-sm text-white outline-none placeholder:text-gray-500"
                  />
                </div>
              )}
              {loginType === 'username' && (
                <div>
                  <label className="text-xs font-bold uppercase text-gray-400">Username</label>
                  <input
                    type="text"
                    value={loginInput}
                    onChange={(e) => setLoginInput(e.target.value)}
                    placeholder="e.g. kasun.silva"
                    className="mt-1 w-full rounded-xl bg-[#0B3D6B] px-4 py-3 font-mono text-sm text-white outline-none placeholder:text-gray-500"
                  />
                  <p className="mt-1 text-xs text-gray-400">Letters and dots only, no spaces</p>
                </div>
              )}

              {/* Read-only preview of the resolved login email */}
              <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm">
                {loginType === 'record' && !recordDerivedId(student) ? (
                  <span className="font-semibold text-amber-400">No ID found — choose another option</span>
                ) : (
                  <span className="text-gray-300">
                    Will log in as:{' '}
                    <span className="font-mono font-bold text-white break-all">
                      {computeFinalLoginEmail() || '—'}
                    </span>
                  </span>
                )}
              </div>

              {/* Password */}
              <div>
                <label className="text-xs font-bold uppercase text-gray-400">Password</label>
                <div className="mt-1 flex gap-2">
                  <input
                    type="text"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="flex-1 rounded-xl bg-[#0B3D6B] px-4 py-3 font-mono text-lg font-bold text-white outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setLoginPassword(generatePassword())}
                    className="rounded-xl bg-[#0B3D6B] px-3 text-white hover:bg-[#1A6BAD]"
                    title="Generate new password"
                  >
                    <span className="ti ti-refresh text-lg" />
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(
                    `EPIC Campus Login\nLogin: ${computeFinalLoginEmail()}\nPassword: ${loginPassword}\nSite: www.epiccampus.live`,
                  )
                  toast.success('Copied!')
                }}
                className="flex-1 rounded-xl border border-gray-600 py-3 text-sm font-semibold text-white hover:bg-white/5"
              >
                Copy
              </button>
              <button
                type="button"
                onClick={handleSaveLogin}
                disabled={loginSaving || !computeFinalLoginEmail() || !loginPassword}
                className="flex-1 rounded-xl bg-[#E8A020] py-3 text-sm font-bold text-[#0B3D6B] disabled:opacity-50"
              >
                {loginSaving ? 'Saving...' : 'Save & Activate'}
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowLoginModal(false)}
              className="absolute right-4 top-4 text-gray-400 hover:text-white"
            >
              <span className="ti ti-x text-lg" />
            </button>
          </div>
        </>
      )}

      <WhatsAppFollowUpModal
        student={
          student
            ? {
                id: student.id,
                name: student.name,
                phone: student.mobile,
                course: course?.label ?? student.courseId,
                riskFlags: [],
                recommendation: '',
              }
            : null
        }
        staffName={user?.displayName || user?.email || 'Epic Campus'}
        open={followUpOpen}
        onClose={() => setFollowUpOpen(false)}
        defaultMessageType="general"
      />
    </div>
  )
}
