'use client'

import { COURSE_MAP } from '@/lib/constants/courses'
import { getCourseBadge } from '@/lib/student/portal'
import type { AttendanceRecord, Payment, Student } from '@/types'

interface DashboardHeroProps {
  student: Student
  attendance: AttendanceRecord[]
  payments: Payment[]
  examCount: number
}

function getAttendancePct(attendance: AttendanceRecord[]): number {
  if (attendance.length === 0) return 0
  const present = attendance.filter(
    (a) => a.status === 'present' || a.status === 'late'
  ).length
  return Math.round((present / attendance.length) * 100)
}

function getPaymentStatus(payments: Payment[]): {
  label: string
  color: string
} {
  if (payments.length === 0) return {
    label: 'Not Set Up',
    color: 'text-white/60'
  }
  const unpaid = payments.filter(
    (p) => p.status === 'pending' || p.status === 'partial'
  ).length
  if (unpaid === 0) return {
    label: 'All Paid',
    color: 'text-emerald-400'
  }
  return {
    label: `${unpaid} Due`,
    color: 'text-amber-400'
  }
}

function ProgressRing({ pct }: { pct: number }) {
  const r = 22
  const circ = 2 * Math.PI * r
  const fill = (pct / 100) * circ
  return (
    <svg width="56" height="56" viewBox="0 0 56 56">
      <circle
        cx="28" cy="28" r={r}
        fill="none" stroke="#DDE3EC" strokeWidth="6"
      />
      <circle
        cx="28" cy="28" r={r}
        fill="none" stroke="#E8A020" strokeWidth="6"
        strokeDasharray={`${fill} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 28 28)"
      />
      <text
        x="50%" y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="11"
        fontWeight="700"
        fill="#ffffff"
        fontFamily="Arial, sans-serif"
      >
        {pct}%
      </text>
    </svg>
  )
}

export default function DashboardHero({
  student,
  attendance,
  payments,
  examCount,
}: DashboardHeroProps) {
  const course = COURSE_MAP[student.courseId]
  const courseLabel = course?.label ??
    getCourseBadge(student.courseId)
  const courseFlag = course?.flag ?? ''
  const attendancePct = getAttendancePct(attendance)
  const paymentStatus = getPaymentStatus(payments)
  const firstName = student.name.split(' ')[0]

  const daysLeft = student.expectedCompletionDate
    ? Math.max(0, Math.ceil(
        (new Date(student.expectedCompletionDate).getTime() -
          Date.now()) / 86400000
      ))
    : null

  return (
    <div
      style={{ background: '#0B3D6B' }}
      className="rounded-2xl p-5 sm:p-6 
        text-white overflow-hidden relative"
    >
      <div style={{
        position: 'absolute', top: -40, right: -40,
        width: 160, height: 160, borderRadius: '50%',
        background: 'rgba(232,160,32,0.10)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', top: 20, right: -20,
        width: 80, height: 80, borderRadius: '50%',
        background: 'rgba(232,160,32,0.07)',
        pointerEvents: 'none',
      }} />

      <div className="flex items-start 
        justify-between gap-3 mb-5">
        <div>
          <p className="text-white/60 text-xs 
            font-medium mb-0.5">
            Welcome back
          </p>
          <h1 className="font-jakarta text-2xl 
            font-bold text-white leading-tight">
            {firstName}!
          </h1>
          <div className="mt-2 inline-flex 
            items-center gap-1.5 rounded-full 
            bg-white/10 px-3 py-1">
            {courseFlag && (
              <span className="text-sm">
                {courseFlag}
              </span>
            )}
            <span className="text-xs font-semibold 
              text-[#E8A020]">
              {courseLabel}
            </span>
          </div>
        </div>
        <div className="flex flex-col 
          items-center gap-1 shrink-0">
          <div className="rounded-xl 
            bg-white/10 p-2">
            <ProgressRing pct={attendancePct} />
          </div>
          <span className="text-[10px] 
            text-white/50 font-medium">
            Attendance
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-gradient-to-br from-emerald-500/25 to-teal-500/10
          px-3 py-2.5 text-center">
          <p className="font-jakarta text-xl
            font-bold text-white">
            {attendance.length}
          </p>
          <p className="text-[10px] text-white/50
            mt-0.5 font-medium">
            Classes
          </p>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-[#0B3D6B]/40 to-[#1A6BAD]/25
          px-3 py-2.5 text-center">
          <p className="font-jakarta text-xl
            font-bold text-white">
            {examCount}
          </p>
          <p className="text-[10px] text-white/50
            mt-0.5 font-medium">
            Exams Done
          </p>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-amber-500/25 to-orange-500/10
          px-3 py-2.5 text-center">
          <p className={`font-jakarta text-xl
            font-bold ${paymentStatus.color}`}>
            {paymentStatus.label}
          </p>
          <p className="text-[10px] text-white/50
            mt-0.5 font-medium">
            Payments
          </p>
        </div>
      </div>

      {payments.length === 0 && (
        <div className="mt-3 flex items-center
          gap-2 rounded-xl bg-white/10 px-3 py-2">
          <span className="ti ti-info-circle
            text-[#E8A020]" aria-hidden="true" />
          <span className="text-xs text-white/70">
            No payment plan set up yet — contact reception
          </span>
        </div>
      )}

      {examCount === 0 && (
        <div className="mt-3 flex items-center
          gap-2 rounded-xl bg-white/10 px-3 py-2">
          <span className="ti ti-info-circle
            text-[#E8A020]" aria-hidden="true" />
          <span className="text-xs text-white/70">
            No exams taken yet — check the Exams section
          </span>
        </div>
      )}

      {daysLeft !== null && (
        <div className="mt-3 flex items-center 
          gap-2 rounded-xl bg-white/10 px-3 py-2">
          <span className="ti ti-calendar-check 
            text-[#E8A020]" aria-hidden="true" />
          <span className="text-xs text-white/70">
            {daysLeft > 0
              ? `${daysLeft} days until completion`
              : 'Completion date reached!'}
          </span>
        </div>
      )}
    </div>
  )
}
