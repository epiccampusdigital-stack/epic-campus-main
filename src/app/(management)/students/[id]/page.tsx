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
  where,
  orderBy,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { COURSE_MAP } from '@/lib/constants/courses'
import { parsePayment, formatAmount } from '@/lib/payments/helpers'
import { parseAttendance } from '@/lib/attendance/helpers'
import StudentForm from '@/components/students/StudentForm'
import {
  parseStudent,
  STATUS_STYLES,
  PAYMENT_STATUS_STYLES,
  VISA_STATUS_STYLES,
  getInitials,
  formatDate,
} from '@/lib/students/helpers'
import type { ExamResult, Payment, Student, StudentDocument, AttendanceRecord } from '@/types'

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
        )}

        {tab === 'payments' && (
          <div>
            {payments.length === 0 ? (
              <p className="py-8 text-center text-sm text-[#5A6A7A]">No payment records yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#DDE3EC] text-xs uppercase text-[#5A6A7A]">
                      <th className="pb-3 pr-4">Receipt</th>
                      <th className="pb-3 pr-4">Type</th>
                      <th className="pb-3 pr-4">Amount</th>
                      <th className="pb-3 pr-4">Method</th>
                      <th className="pb-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#DDE3EC]">
                    {payments.map((p) => (
                      <tr key={p.id}>
                        <td className="py-3 pr-4 font-medium">{p.receiptNumber || p.id.slice(0, 8)}</td>
                        <td className="py-3 pr-4 capitalize text-[#5A6A7A]">{p.type}</td>
                        <td className="py-3 pr-4 font-medium">{formatAmount(p.amount, p.currency)}</td>
                        <td className="py-3 pr-4 capitalize text-[#5A6A7A]">{p.method.replace('-', ' ')}</td>
                        <td className="py-3">
                          <span className="capitalize">{p.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
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
