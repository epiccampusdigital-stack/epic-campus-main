'use client'

import Link from 'next/link'
import { formatAttendanceDate } from '@/components/attendance/AttendanceTable'
import { COURSE_MAP } from '@/lib/constants/courses'
import { formatAmount } from '@/lib/payments/helpers'
import {
  daysUntil,
  getAttendanceRate,
  getChinaStep,
  getDashboardKind,
  getJapanStep,
  getKoreaStep,
  getNvqStep,
} from '@/lib/student/portal'
import type { AttendanceRecord, Payment, Student } from '@/types'

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#DDE3EC] bg-white p-4">
      <p className="font-inter text-xs font-medium uppercase tracking-wide text-[#5A6A7A]">
        {label}
      </p>
      <p className="mt-1 font-jakarta text-xl font-bold text-[#0B3D6B]">{value}</p>
    </div>
  )
}

function ProgressSteps({
  steps,
  current,
}: {
  steps: string[]
  current: number
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[#DDE3EC] bg-white p-4">
      <div className="flex min-w-[640px] items-center gap-2">
        {steps.map((step, i) => (
          <div key={step} className="flex flex-1 items-center gap-2">
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                i <= current
                  ? 'bg-[#E8A020] text-[#0B3D6B]'
                  : 'bg-[#DDE3EC] text-[#5A6A7A]'
              }`}
            >
              {i + 1}
            </div>
            <span
              className={`text-xs font-medium sm:text-sm ${
                i === current ? 'text-[#0B3D6B]' : 'text-[#5A6A7A]'
              }`}
            >
              {step}
            </span>
            {i < steps.length - 1 && (
              <div className={`h-0.5 flex-1 ${i < current ? 'bg-[#E8A020]' : 'bg-[#DDE3EC]'}`} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function QuickLinks() {
  const links = [
    { href: '/my-materials', label: 'Study Materials', icon: 'ti-books' },
    { href: '/my-results', label: 'Practice Tests', icon: 'ti-certificate' },
    { href: '/my-visa', label: 'Visa Status', icon: 'ti-plane' },
  ]
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className="flex items-center gap-3 rounded-xl border border-[#DDE3EC] bg-white p-4 transition-colors hover:border-[#E8A020]"
        >
          <span className={`ti ${l.icon} text-2xl text-[#0B3D6B]`} aria-hidden="true" />
          <span className="font-jakarta text-sm font-semibold text-[#0D1B2A]">{l.label}</span>
        </Link>
      ))}
    </div>
  )
}

function RecentAttendance({ records }: { records: AttendanceRecord[] }) {
  if (records.length === 0) {
    return (
      <p className="text-sm text-[#5A6A7A]">No attendance records yet.</p>
    )
  }
  return (
    <ul className="divide-y divide-[#DDE3EC] rounded-xl border border-[#DDE3EC] bg-white">
      {records.map((r) => (
        <li key={r.id} className="flex items-center justify-between px-4 py-3 text-sm">
          <span className="text-[#0D1B2A]">{formatAttendanceDate(r.date)}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
              r.status === 'present'
                ? 'bg-emerald-50 text-emerald-700'
                : r.status === 'late'
                  ? 'bg-amber-50 text-amber-800'
                  : 'bg-red-50 text-red-700'
            }`}
          >
            {r.status}
          </span>
        </li>
      ))}
    </ul>
  )
}

interface CourseDashboardProps {
  student: Student
  attendance: AttendanceRecord[]
  examCount: number
  payments: Payment[]
}

export default function CourseDashboard({
  student,
  attendance,
  examCount,
  payments,
}: CourseDashboardProps) {
  const kind = getDashboardKind(student.courseId)
  const rate = getAttendanceRate(attendance)
  const recent = attendance.slice(0, 5)
  const daysLeft = daysUntil(student.expectedCompletionDate)
  const course = COURSE_MAP[student.courseId]

  if (kind === 'japan') {
    const step = getJapanStep(student)
    return (
      <div className="space-y-6">
        <div>
          <div className="mb-1 h-[3px] w-16 rounded-full" style={{ background: 'linear-gradient(90deg, #bc002d, #0B3D6B)' }} />
          <h2 className="font-jakarta text-2xl font-bold text-[#0D1B2A] dark:text-white/90">
            Your Japan Journey
          </h2>
          <p className="text-sm text-[#5A6A7A]">{course?.label}</p>
        </div>
        <ProgressSteps
          steps={[
            'Language Training',
            'Skill Exam',
            'Job Matching',
            'Visa',
            'Departure',
          ]}
          current={step}
        />
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatCard label="JLPT Level Progress" value={student.visaStatus === 'approved' ? 'N4 Ready' : 'N5 In Progress'} />
          <StatCard label="Exam Attempts" value={String(examCount)} />
          <StatCard label="Attendance Rate" value={rate} />
          <StatCard label="Days Until Departure" value={daysLeft != null ? String(Math.max(daysLeft, 0)) : 'TBD'} />
        </div>
        <div>
          <h3 className="mb-3 font-jakarta font-bold text-[#0B3D6B]">Recent Attendance</h3>
          <RecentAttendance records={recent} />
        </div>
        <QuickLinks />
      </div>
    )
  }

  if (kind === 'korea') {
    const step = getKoreaStep(student)
    return (
      <div className="space-y-6">
        <div>
          <div className="mb-1 h-[3px] w-16 rounded-full" style={{ background: 'linear-gradient(90deg, #003478, #cd2e3a)' }} />
          <h2 className="font-jakarta text-2xl font-bold text-[#0D1B2A] dark:text-white/90">
            Your Korea Journey
          </h2>
          <p className="text-sm text-[#5A6A7A]">{course?.label}</p>
        </div>
        <ProgressSteps
          steps={[
            'Language Study',
            'TOPIK Exam',
            'University Application',
            'Visa',
            'Departure',
          ]}
          current={step}
        />
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatCard label="TOPIK Level" value="Level 2 Target" />
          <StatCard label="Application Status" value={student.visaStatus === 'in-progress' ? 'In Progress' : 'Pending'} />
          <StatCard label="Documents Submitted" value={student.paymentStatus === 'paid' ? 'Complete' : 'Partial'} />
          <StatCard label="Days Until Intake" value={daysLeft != null ? String(Math.max(daysLeft, 0)) : 'TBD'} />
        </div>
        <div className="rounded-xl border border-[#DDE3EC] bg-white p-5">
          <h3 className="font-jakarta font-bold text-[#0B3D6B]">Scholarship Status</h3>
          <p className="mt-2 text-sm text-[#5A6A7A]">
            {student.notes?.includes('scholarship')
              ? student.notes
              : 'Not yet applied — speak with your coordinator for GKS/CSC options.'}
          </p>
        </div>
        <div>
          <h3 className="mb-3 font-jakarta font-bold text-[#0B3D6B]">Recent Attendance</h3>
          <RecentAttendance records={recent} />
        </div>
      </div>
    )
  }

  if (kind === 'china') {
    const step = getChinaStep(student)
    return (
      <div className="space-y-6">
        <div>
          <div className="mb-1 h-[3px] w-16 rounded-full" style={{ background: 'linear-gradient(90deg, #de2910, #ffde00)' }} />
          <h2 className="font-jakarta text-2xl font-bold text-[#0D1B2A] dark:text-white/90">
            Your China Journey
          </h2>
          <p className="text-sm text-[#5A6A7A]">{course?.label}</p>
        </div>
        <ProgressSteps
          steps={['HSK Prep', 'Application', 'Scholarship Result', 'Visa', 'Departure']}
          current={step}
        />
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatCard label="HSK Level" value="HSK 1–2 Target" />
          <StatCard label="Scholarship Status" value="Pending Review" />
          <StatCard label="Application Status" value={student.status === 'active' ? 'Active' : student.status} />
          <StatCard label="Days Until Intake" value={daysLeft != null ? String(Math.max(daysLeft, 0)) : 'TBD'} />
        </div>
      </div>
    )
  }

  if (kind === 'ielts') {
    return (
      <div className="space-y-6">
        <div>
          <div className="mb-1 h-[3px] w-16 rounded-full" style={{ background: 'linear-gradient(90deg, #003087, #CF142B)' }} />
          <h2 className="font-jakarta text-2xl font-bold text-[#0D1B2A] dark:text-white/90">
            Your IELTS Journey
          </h2>
          <p className="text-sm text-[#5A6A7A]">{course?.label}</p>
        </div>
        <div className="rounded-xl border border-[#E8A020]/40 bg-amber-50 p-5">
          <p className="font-jakarta font-semibold text-[#0B3D6B]">
            Your IELTS training is managed at epicielts.live
          </p>
          <p className="mt-1 text-sm text-[#5A6A7A]">
            Access mock tests, band tracking, and residential schedules on the dedicated portal.
          </p>
          <a
            href="https://epicielts.live"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#E8A020] px-5 py-2.5 font-jakarta text-sm font-bold text-[#0B3D6B] hover:bg-[#F5B942]"
          >
            Go to IELTS Portal
            <span className="ti ti-external-link" aria-hidden="true" />
          </a>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <StatCard label="Attendance Rate" value={rate} />
          <StatCard label="Payments" value={String(payments.length)} />
          <StatCard label="Visa Status" value={student.visaStatus?.replace('-', ' ') ?? 'Not started'} />
        </div>
        <div>
          <h3 className="mb-3 font-jakarta font-bold text-[#0B3D6B]">Recent Attendance</h3>
          <RecentAttendance records={recent} />
        </div>
        <QuickLinks />
      </div>
    )
  }

  if (kind === 'nvq') {
    const step = getNvqStep(student)
    return (
      <div className="space-y-6">
        <div>
          <h2 className="font-jakarta text-2xl font-bold text-[#0D1B2A]">
            {course?.flag ?? '🎓'} Your NVQ Journey
          </h2>
          <p className="text-sm text-[#5A6A7A]">{course?.label}</p>
        </div>
        <ProgressSteps
          steps={['Enrollment', 'Training', 'Assessment', 'Certification', 'Employment']}
          current={step}
        />
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatCard label="Modules Completed" value={student.status === 'completed' ? 'All' : 'In Progress'} />
          <StatCard label="Assessment Score" value={examCount > 0 ? 'Recorded' : 'Pending'} />
          <StatCard label="Certification Status" value={student.status === 'completed' ? 'Certified' : 'In Training'} />
          <StatCard label="Employment Readiness" value={student.status === 'completed' ? 'Ready' : 'Building Skills'} />
        </div>
        <div>
          <h3 className="mb-3 font-jakarta font-bold text-[#0B3D6B]">Recent Attendance</h3>
          <RecentAttendance records={recent} />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-jakarta text-2xl font-bold text-[#0D1B2A]">
          Welcome, {student.name.split(' ')[0]}!
        </h2>
        <p className="text-sm text-[#5A6A7A]">{course?.label ?? student.courseId}</p>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Student ID" value={student.studentCode} />
        <StatCard label="Status" value={student.status} />
        <StatCard label="Attendance Rate" value={rate} />
        <StatCard label="Balance Due" value={formatAmount(student.registrationFee, student.feeCurrency ?? 'LKR')} />
      </div>
      <QuickLinks />
    </div>
  )
}
