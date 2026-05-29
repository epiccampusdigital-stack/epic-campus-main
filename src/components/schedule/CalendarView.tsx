'use client'

import { useMemo, useState } from 'react'
import {
  dateToISO,
  formatSessionDate,
  formatSessionTime,
  getDaysInMonth,
  getSessionColor,
  getSessionTypeLabel,
  getStatusColor,
  getStatusLabel,
  groupSessionsByDate,
  isToday,
} from '@/lib/schedule/helpers'
import type { ScheduleSession } from '@/types'

interface CalendarViewProps {
  sessions: ScheduleSession[]
  loading?: boolean
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function CalendarView({ sessions, loading }: CalendarViewProps) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState<string>(
    today.toISOString().slice(0, 10),
  )

  const grouped = useMemo(() => groupSessionsByDate(sessions), [sessions])

  const monthLabel = new Date(year, month, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  const daysInMonth = getDaysInMonth(year, month)
  const firstDayOfWeek = new Date(year, month, 1).getDay()

  const calendarCells = useMemo(() => {
    const cells: { day: number | null; iso: string | null }[] = []
    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push({ day: null, iso: null })
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, iso: dateToISO(year, month, d) })
    }
    return cells
  }, [year, month, daysInMonth, firstDayOfWeek])

  const selectedSessions = grouped[selectedDate] ?? []

  function prevMonth() {
    if (month === 0) {
      setMonth(11)
      setYear((y) => y - 1)
    } else {
      setMonth((m) => m - 1)
    }
  }

  function nextMonth() {
    if (month === 11) {
      setMonth(0)
      setYear((y) => y + 1)
    } else {
      setMonth((m) => m + 1)
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse rounded-xl border border-[#DDE3EC] bg-white p-6">
        <div className="mb-4 h-8 w-48 rounded bg-[#DDE3EC]" />
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="h-16 rounded bg-[#DDE3EC]" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="rounded-xl border border-[#DDE3EC] bg-white p-5">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-jakarta text-lg font-bold text-[#0B3D6B]">{monthLabel}</h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={prevMonth}
              className="rounded-lg border border-[#DDE3EC] p-2 text-[#0B3D6B] hover:bg-[#F5F7FB]"
              aria-label="Previous month"
            >
              <span className="ti ti-chevron-left" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => {
                setYear(today.getFullYear())
                setMonth(today.getMonth())
                setSelectedDate(today.toISOString().slice(0, 10))
              }}
              className="rounded-lg border border-[#DDE3EC] px-3 py-2 font-inter text-xs font-medium text-[#5A6A7A] hover:bg-[#F5F7FB]"
            >
              Today
            </button>
            <button
              type="button"
              onClick={nextMonth}
              className="rounded-lg border border-[#DDE3EC] p-2 text-[#0B3D6B] hover:bg-[#F5F7FB]"
              aria-label="Next month"
            >
              <span className="ti ti-chevron-right" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="mb-2 grid grid-cols-7 gap-1">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="py-2 text-center font-jakarta text-xs font-semibold uppercase text-[#5A6A7A]"
            >
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {calendarCells.map((cell, idx) => {
            if (!cell.day || !cell.iso) {
              return <div key={`empty-${idx}`} className="min-h-[72px]" />
            }

            const daySessions = grouped[cell.iso] ?? []
            const selected = cell.iso === selectedDate
            const todayCell = isToday(cell.iso)

            return (
              <button
                key={cell.iso}
                type="button"
                onClick={() => setSelectedDate(cell.iso!)}
                className={`min-h-[72px] rounded-lg border p-2 text-left transition-colors ${
                  selected
                    ? 'border-[#0B3D6B] bg-[#0B3D6B]/5 ring-1 ring-[#0B3D6B]'
                    : 'border-transparent hover:border-[#DDE3EC] hover:bg-[#F5F7FB]'
                } ${todayCell ? 'font-bold' : ''}`}
              >
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-sm ${
                    todayCell ? 'bg-[#E8A020] text-[#0B3D6B]' : 'text-[#0D1B2A]'
                  }`}
                >
                  {cell.day}
                </span>
                {daySessions.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {daySessions.slice(0, 4).map((s) => (
                      <span
                        key={s.id}
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: getSessionColor(s.type) }}
                        title={getSessionTypeLabel(s.type)}
                      />
                    ))}
                    {daySessions.length > 4 && (
                      <span className="text-[10px] text-[#5A6A7A]">
                        +{daySessions.length - 4}
                      </span>
                    )}
                  </div>
                )}
              </button>
            )
          })}
        </div>

        <div className="mt-4 flex flex-wrap gap-4 border-t border-[#DDE3EC] pt-4">
          {(['class', 'consultation', 'exam'] as const).map((t) => (
            <div key={t} className="flex items-center gap-2 text-xs text-[#5A6A7A]">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: getSessionColor(t) }}
              />
              {getSessionTypeLabel(t)}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-[#DDE3EC] bg-white p-5">
        <h3 className="font-jakarta text-sm font-bold text-[#0B3D6B]">
          {formatSessionDate(selectedDate)}
        </h3>
        <p className="mt-1 font-inter text-xs text-[#5A6A7A]">
          {selectedSessions.length} session{selectedSessions.length !== 1 ? 's' : ''}
        </p>

        <div className="mt-4 space-y-3">
          {selectedSessions.length === 0 ? (
            <p className="font-inter text-sm text-[#5A6A7A]">No sessions on this day.</p>
          ) : (
            selectedSessions.map((s) => (
              <div
                key={s.id}
                className="rounded-lg border border-[#DDE3EC] p-3"
                style={{ borderLeftWidth: 4, borderLeftColor: getSessionColor(s.type) }}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-jakarta text-sm font-semibold text-[#0D1B2A]">
                    {getSessionTypeLabel(s.type)}
                  </p>
                  <span
                    className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${getStatusColor(s.status)}`}
                  >
                    {getStatusLabel(s.status)}
                  </span>
                </div>
                <p className="mt-1 font-inter text-xs text-[#5A6A7A]">
                  {formatSessionTime(s.startTime, s.endTime)}
                </p>
                <p className="mt-1 font-inter text-xs text-[#5A6A7A]">
                  {s.courseName} · {s.staffName}
                </p>
                {s.location && (
                  <p className="mt-1 truncate font-inter text-xs text-[#5A6A7A]">
                    📍 {s.location}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
