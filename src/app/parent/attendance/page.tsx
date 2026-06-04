'use client'

import { useEffect, useState } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { parseAttendance } from '@/lib/attendance/helpers'
import { attendanceThisMonth } from '@/lib/parent/helpers'
import { formatDate } from '@/lib/students/helpers'
import { useParentPortal } from '@/components/parent/ParentContext'
import type { AttendanceRecord } from '@/types'

export default function ParentAttendancePage() {
  const { student } = useParentPortal()
  const [records, setRecords] = useState<AttendanceRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const snap = await getDocs(
          query(collection(db, 'attendance'), where('studentId', '==', student.id)),
        )
        setRecords(
          snap.docs
            .map((d) => parseAttendance(d.id, d.data() as Record<string, unknown>))
            .sort((a, b) => b.date.localeCompare(a.date)),
        )
      } catch (err) {
        console.error('[ParentAttendance]', err)
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [student.id])

  const month = attendanceThisMonth(records)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-jakarta text-2xl font-bold text-[#0D1B2A]">Attendance</h2>
        <p className="text-sm text-[#5A6A7A]">{student.name}&apos;s class attendance</p>
      </div>

      <div className="rounded-xl border border-[#DDE3EC] bg-white p-5">
        <p className="text-xs font-medium uppercase text-[#5A6A7A]">This month</p>
        <p className="mt-1 font-jakarta text-2xl font-bold text-[#0B3D6B]">
          {loading ? '…' : `${month.present} / ${month.total}`}
        </p>
        <p className="text-sm text-[#5A6A7A]">Present / total sessions</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#DDE3EC] bg-white">
        {loading ? (
          <p className="px-6 py-12 text-center text-sm text-[#5A6A7A]">Loading…</p>
        ) : records.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-[#5A6A7A]">
            No attendance records yet.
          </p>
        ) : (
          <ul className="divide-y divide-[#DDE3EC]">
            {records.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between px-4 py-3 text-sm"
              >
                <span className="text-[#0D1B2A]">{formatDate(r.date)}</span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                    r.status === 'present' || r.status === 'late'
                      ? 'bg-emerald-50 text-emerald-700'
                      : r.status === 'excused'
                        ? 'bg-blue-50 text-blue-700'
                        : 'bg-red-50 text-red-700'
                  }`}
                >
                  {r.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
