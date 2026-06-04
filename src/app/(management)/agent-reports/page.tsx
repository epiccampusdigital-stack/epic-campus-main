'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import {
  computeAgentReports,
  formatAgentMoney,
} from '@/lib/agent/reports'
import { currentMonthKey, getMonthPickerOptions } from '@/lib/dashboard/helpers'
import LocationFilterSelect from '@/components/ui/LocationFilterSelect'
import { useManagement } from '@/components/layout/ManagementContext'
import { parsePayment } from '@/lib/payments/helpers'
import { parseStudent, LOCATION_STYLES, LOCATION_LABELS } from '@/lib/students/helpers'
import { ROLE_LABELS } from '@/lib/constants/roles'
import type { Payment, Role, Student, StudentLocation } from '@/types'

export default function AgentReportsPage() {
  const { user } = useManagement()
  const [students, setStudents] = useState<Student[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [agentRoles, setAgentRoles] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [monthFilter, setMonthFilter] = useState(currentMonthKey())
  const [locationFilter, setLocationFilter] = useState<StudentLocation | ''>('')
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null)

  useEffect(() => {
    if (user && (user.role === 'reception' || user.role === 'teacher')) {
      if (user.locationAssigned) setLocationFilter(user.locationAssigned)
    }
  }, [user])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [studentsSnap, paymentsSnap, usersSnap] = await Promise.all([
        getDocs(collection(db, 'students')),
        getDocs(collection(db, 'payments')),
        getDocs(collection(db, 'users')),
      ])
      setStudents(
        studentsSnap.docs.map((d) =>
          parseStudent(d.id, d.data() as Record<string, unknown>),
        ),
      )
      setPayments(
        paymentsSnap.docs.map((d) =>
          parsePayment(d.id, d.data() as Record<string, unknown>),
        ),
      )
      const roles = new Map<string, string>()
      for (const d of usersSnap.docs) {
        const role = String(d.data().role ?? '')
        roles.set(d.id, ROLE_LABELS[role as Role] ?? role)
      }
      setAgentRoles(roles)
    } catch (err) {
      console.error('[AgentReports]', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const rows = useMemo(
    () =>
      computeAgentReports(students, payments, monthFilter, locationFilter, agentRoles),
    [students, payments, monthFilter, locationFilter, agentRoles],
  )

  const monthOptions = useMemo(() => getMonthPickerOptions(12), [])

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-jakarta text-2xl font-bold text-[#0D1B2A] dark:text-white">
          Agent Reports
        </h2>
        <p className="mt-1 font-inter text-sm text-[#5A6A7A]">
          Student enrollments by agent
        </p>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-[#DDE3EC] bg-white p-4 dark:border-gray-600 dark:bg-gray-800 sm:flex-row sm:flex-wrap sm:items-end">
        <div>
          <label className="mb-1.5 block font-inter text-xs font-medium uppercase tracking-wide text-[#5A6A7A]">
            Month
          </label>
          <select
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="rounded-lg border border-[#DDE3EC] bg-white px-3 py-2.5 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
          >
            {monthOptions.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block font-inter text-xs font-medium uppercase tracking-wide text-[#5A6A7A]">
            Location
          </label>
          <LocationFilterSelect value={locationFilter} onChange={setLocationFilter} />
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-xl bg-[#DDE3EC]/60" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-center text-sm text-[#5A6A7A]">No agent data for this filter.</p>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {rows
              .filter((r) => r.agentId !== '__unassigned__')
              .map((r) => (
                <div
                  key={r.agentId}
                  className="rounded-xl border border-[#DDE3EC] border-l-[3px] border-l-[#E8A020] bg-white p-5 dark:bg-gray-800"
                >
                  <p className="font-jakarta font-bold text-[#0B3D6B] dark:text-white">
                    {r.agentName}
                  </p>
                  <p className="text-xs text-[#5A6A7A]">
                    {r.agentRole ?? 'Staff'} · {r.locationLabel}
                  </p>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-xs text-[#5A6A7A]">Total students</dt>
                      <dd className="font-bold text-[#0D1B2A] dark:text-white">{r.totalStudents}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-[#5A6A7A]">This month</dt>
                      <dd className="font-bold text-[#0D1B2A] dark:text-white">
                        {r.studentsThisMonth}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-[#5A6A7A]">Collected (month)</dt>
                      <dd className="font-bold text-[#0B3D6B]">
                        {formatAgentMoney(r.totalCollected)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-[#5A6A7A]">Outstanding</dt>
                      <dd className="font-bold text-amber-700">
                        {formatAgentMoney(r.outstanding)}
                      </dd>
                    </div>
                  </dl>
                </div>
              ))}
          </section>

          <section className="overflow-hidden rounded-xl border border-[#DDE3EC] bg-white dark:border-gray-600 dark:bg-gray-800">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[#DDE3EC] bg-[#F5F7FB] dark:bg-gray-900">
                    {[
                      'Agent',
                      'Students This Month',
                      'Total Students',
                      'Total Collected',
                      'Outstanding',
                      'Location',
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-xs font-semibold uppercase text-[#5A6A7A]"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <Fragment key={r.agentId}>
                      <tr
                        className="cursor-pointer border-b border-[#DDE3EC] hover:bg-[#F5F7FB]/60 dark:border-gray-600"
                        onClick={() =>
                          setExpandedAgent((prev) =>
                            prev === r.agentId ? null : r.agentId,
                          )
                        }
                      >
                        <td className="px-4 py-3 font-medium text-[#0B3D6B]">
                          {r.agentName}
                          {r.agentRole && (
                            <span className="ml-2 text-xs text-[#5A6A7A]">({r.agentRole})</span>
                          )}
                        </td>
                        <td className="px-4 py-3">{r.studentsThisMonth}</td>
                        <td className="px-4 py-3">{r.totalStudents}</td>
                        <td className="px-4 py-3 font-medium text-[#0B3D6B]">
                          {formatAgentMoney(r.totalCollected)}
                        </td>
                        <td className="px-4 py-3 text-amber-700">
                          {formatAgentMoney(r.outstanding)}
                        </td>
                        <td className="px-4 py-3">
                          {r.location ? (
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs ${LOCATION_STYLES[r.location]}`}
                            >
                              {LOCATION_LABELS[r.location]}
                            </span>
                          ) : (
                            r.locationLabel
                          )}
                        </td>
                      </tr>
                      {expandedAgent === r.agentId && r.students.length > 0 && (
                        <tr className="bg-[#F5F7FB] dark:bg-gray-900">
                          <td colSpan={6} className="px-4 py-4">
                            <p className="mb-2 text-xs font-semibold uppercase text-[#5A6A7A]">
                              Students
                            </p>
                            <ul className="divide-y divide-[#DDE3EC] rounded-lg border border-[#DDE3EC] bg-white dark:divide-gray-600 dark:border-gray-600 dark:bg-gray-800">
                              {r.students.map((s) => (
                                <li
                                  key={s.id}
                                  className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                                >
                                  <span className="font-medium text-[#0D1B2A] dark:text-white">
                                    {s.name}{' '}
                                    <span className="text-[#5A6A7A]">({s.studentCode})</span>
                                  </span>
                                  {s.location && (
                                    <span
                                      className={`rounded-full border px-2 py-0.5 text-xs ${LOCATION_STYLES[s.location]}`}
                                    >
                                      {LOCATION_LABELS[s.location]}
                                    </span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
