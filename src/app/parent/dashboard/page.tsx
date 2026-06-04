'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { parseAttendance } from '@/lib/attendance/helpers'
import { parsePayment } from '@/lib/payments/helpers'
import {
  attendanceThisMonth,
  examResultsSummary,
  paymentDueSummary,
  visaStatusLabel,
} from '@/lib/parent/helpers'
import { useParentPortal } from '@/components/parent/ParentContext'
import type { AttendanceRecord, ExamResult, Payment } from '@/types'

function SummaryCard({
  label,
  value,
  sub,
  href,
}: {
  label: string
  value: string
  sub?: string
  href: string
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-[#DDE3EC] bg-white p-5 transition-shadow hover:shadow-md"
    >
      <p className="font-inter text-xs font-medium uppercase tracking-wide text-[#5A6A7A]">
        {label}
      </p>
      <p className="mt-1 font-jakarta text-2xl font-bold text-[#0B3D6B]">{value}</p>
      {sub && <p className="mt-1 text-xs text-[#5A6A7A]">{sub}</p>}
      <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#E8A020]">
        View details
        <span className="ti ti-arrow-right" aria-hidden="true" />
      </span>
    </Link>
  )
}

export default function ParentDashboardPage() {
  const { parent, student } = useParentPortal()
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [examResults, setExamResults] = useState<ExamResult[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [attSnap, paySnap, examSnap] = await Promise.all([
          getDocs(
            query(collection(db, 'attendance'), where('studentId', '==', student.id)),
          ).catch(() => ({ docs: [] })),
          getDocs(
            query(collection(db, 'payments'), where('studentId', '==', student.id)),
          ),
          getDocs(
            query(collection(db, 'examResults'), where('studentId', '==', student.id)),
          ).catch(() => ({ docs: [] })),
        ])

        setAttendance(
          attSnap.docs
            .map((d) => parseAttendance(d.id, d.data() as Record<string, unknown>))
            .sort((a, b) => b.date.localeCompare(a.date)),
        )
        setPayments(
          paySnap.docs.map((d) =>
            parsePayment(d.id, d.data() as Record<string, unknown>),
          ),
        )
        setExamResults(
          examSnap.docs.map((d) => ({
            id: d.id,
            examId: String(d.data().examId ?? ''),
            studentId: String(d.data().studentId ?? ''),
            score: d.data().score != null ? Number(d.data().score) : undefined,
            band: d.data().band ? String(d.data().band) : undefined,
            level: d.data().level ? String(d.data().level) : undefined,
            status: (d.data().status as ExamResult['status']) ?? 'pending',
            notes: d.data().notes ? String(d.data().notes) : undefined,
            createdAt: String(d.data().createdAt ?? ''),
            createdBy: String(d.data().createdBy ?? ''),
          })),
        )
      } catch (err) {
        console.error('[ParentDashboard]', err)
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [student.id])

  const monthAtt = attendanceThisMonth(attendance)
  const exams = examResultsSummary(examResults)
  const fees = paymentDueSummary(student, payments)

  const recentActivity = [
    ...attendance.slice(0, 3).map((a) => ({
      id: `att-${a.id}`,
      text: `Attendance: ${a.status} on ${a.date}`,
      date: a.date,
    })),
    ...payments.slice(0, 3).map((p) => ({
      id: `pay-${p.id}`,
      text: `Payment ${p.status}: ${p.receiptNumber}`,
      date: p.paymentDate,
    })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-jakarta text-2xl font-bold text-[#0D1B2A]">
          Welcome, {parent?.parentName ?? 'Parent'}
        </h1>
        <p className="text-sm text-[#5A6A7A]">Viewing: {student.name}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Attendance this month"
          value={loading ? '…' : `${monthAtt.present} / ${monthAtt.total}`}
          sub="Present / sessions"
          href="/parent/attendance"
        />
        <SummaryCard
          label="Exam results"
          value={loading ? '…' : `${exams.passed} / ${exams.total}`}
          sub="Passed / papers"
          href="/parent/results"
        />
        <SummaryCard
          label="Payment status"
          value={loading ? '…' : `${fees.paid} / ${fees.due}`}
          sub="Paid / total fee items"
          href="/parent/payments"
        />
        <SummaryCard
          label="Visa status"
          value={loading ? '…' : visaStatusLabel(student.visaStatus)}
          href="/parent/visa"
        />
      </div>

      <div className="rounded-xl border border-[#DDE3EC] bg-white p-6">
        <h2 className="font-jakarta text-sm font-bold uppercase tracking-wide text-[#0B3D6B]">
          Recent activity
        </h2>
        {loading ? (
          <p className="mt-4 text-sm text-[#5A6A7A]">Loading…</p>
        ) : recentActivity.length === 0 ? (
          <p className="mt-4 text-sm text-[#5A6A7A]">No recent activity yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-[#DDE3EC]">
            {recentActivity.map((item) => (
              <li key={item.id} className="py-3 text-sm text-[#0D1B2A]">
                {item.text}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
