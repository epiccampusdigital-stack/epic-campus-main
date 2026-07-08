'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useStudentPortal } from '@/components/student/StudentContext'

type SessionType = 'class' | 'exam' | 'workshop' | 'other'
type StoredStatus = 'scheduled' | 'completed' | 'cancelled'
type DisplayStatus = 'upcoming' | 'today' | 'completed' | 'cancelled'
type ScheduleView = 'month' | 'week' | 'list'

interface Session {
  id: string
  title: string
  date: string
  startTime: string
  endTime: string
  type: SessionType
  location: string
  teacherName: string
  courseId: string
  notes?: string
  joinLink?: string
  /** Optional — not all session docs carry an explicit status; derived from date when absent. */
  status?: StoredStatus
}

const TYPE_ICONS: Record<SessionType, string> = {
  class: 'ti-book', exam: 'ti-pencil', workshop: 'ti-tools', other: 'ti-calendar',
}

// bg/text drive the agenda status pill; border adds the gold outline for "today";
// barColor drives the session card's left accent bar and the week-view session chips.
const STATUS_CONFIG: Record<DisplayStatus, { label: string; bg: string; text: string; border: string; barColor: string }> = {
  upcoming:  { label: 'Upcoming',  bg: 'bg-blue-50 dark:bg-blue-900/30',       text: 'text-blue-700 dark:text-blue-300',      border: 'border border-transparent', barColor: 'border-l-[#0B3D6B]' },
  today:     { label: 'Today',     bg: 'bg-[#E8A020]/10',                     text: 'text-[#E8A020]',                        border: 'border border-[#E8A020]',   barColor: 'border-l-[#E8A020]' },
  completed: { label: 'Completed', bg: 'bg-green-50 dark:bg-emerald-900/20',  text: 'text-green-700 dark:text-emerald-400',  border: 'border border-transparent', barColor: 'border-l-gray-300 dark:border-l-gray-600' },
  cancelled: { label: 'Cancelled', bg: 'bg-red-50 dark:bg-red-900/20',        text: 'text-red-600 dark:text-red-400',        border: 'border border-transparent', barColor: 'border-l-red-400 dark:border-l-red-500' },
}

// ── Helpers ──────────────────────────────────────────────────────────────────
// NOTE: dates are formatted from local Date fields (getFullYear/getMonth/getDate),
// never via toISOString() — that round-trips through UTC and shifts the date by
// one day in positive-offset zones like Asia/Colombo (UTC+5:30).
function toLocalISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function isoToday() { return toLocalISODate(new Date()) }

function addMonths(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setMonth(d.getMonth() + n)
  return toLocalISODate(d)
}

function addDaysIso(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return toLocalISODate(d)
}

/** Sunday of the week containing `iso` — matches the Sun-first WEEKDAYS_SHORT order. */
function startOfWeek(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() - d.getDay())
  return toLocalISODate(d)
}

function firstOfMonth(iso: string): string {
  return iso.slice(0, 8) + '01'
}

function monthKey(iso: string): string {
  return iso.slice(0, 7)
}

function fmtMonthYear(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

/** e.g. "July 6 – 12, 2026"; handles a week that spans two months/years. */
function fmtWeekRange(weekStartIso: string): string {
  const start = new Date(weekStartIso + 'T00:00:00')
  const end = new Date(addDaysIso(weekStartIso, 6) + 'T00:00:00')
  const startMonth = start.toLocaleDateString('en-GB', { month: 'long' })
  const endMonth = end.toLocaleDateString('en-GB', { month: 'long' })
  if (start.getFullYear() !== end.getFullYear()) {
    return `${startMonth} ${start.getDate()}, ${start.getFullYear()} – ${endMonth} ${end.getDate()}, ${end.getFullYear()}`
  }
  if (startMonth !== endMonth) {
    return `${startMonth} ${start.getDate()} – ${endMonth} ${end.getDate()}, ${end.getFullYear()}`
  }
  return `${startMonth} ${start.getDate()} – ${end.getDate()}, ${end.getFullYear()}`
}

/** e.g. "Monday, 7 July" — no year, matches the agenda group header format. */
function fmtGroupHeader(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

function fmtDay(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function computeStatus(session: Session, today: string): DisplayStatus {
  if (session.status === 'cancelled') return 'cancelled'
  if (session.date === today) return 'today'
  if (session.date > today) return 'upcoming'
  return 'completed'
}

interface MonthCell {
  iso: string
  day: number
  inMonth: boolean
}

/** Full weeks (5 or 6 rows) covering the given month, including muted lead/trail days. */
function buildMonthGrid(monthIso: string): MonthCell[] {
  const first = new Date(monthIso + 'T00:00:00')
  const year = first.getFullYear()
  const month = first.getMonth()
  const firstWeekday = new Date(year, month, 1).getDay()
  const totalDays = new Date(year, month + 1, 0).getDate()
  const prevMonthDays = new Date(year, month, 0).getDate()

  const cells: MonthCell[] = []
  for (let i = firstWeekday - 1; i >= 0; i--) {
    const day = prevMonthDays - i
    cells.push({ iso: toLocalISODate(new Date(year, month - 1, day)), day, inMonth: false })
  }
  for (let day = 1; day <= totalDays; day++) {
    cells.push({ iso: toLocalISODate(new Date(year, month, day)), day, inMonth: true })
  }
  let trailDay = 1
  while (cells.length % 7 !== 0) {
    cells.push({ iso: toLocalISODate(new Date(year, month + 1, trailDay)), day: trailDay, inMonth: false })
    trailDay++
  }
  return cells
}

interface WeekCell {
  iso: string
  day: number
  weekday: string
}

/** The 7 days (Sun→Sat) of the week starting at `weekStartIso`. */
function buildWeekGrid(weekStartIso: string): WeekCell[] {
  const cells: WeekCell[] = []
  for (let i = 0; i < 7; i++) {
    const iso = addDaysIso(weekStartIso, i)
    const d = new Date(iso + 'T00:00:00')
    cells.push({ iso, day: d.getDate(), weekday: WEEKDAYS_SHORT[d.getDay()] })
  }
  return cells
}

// ── ICS export ───────────────────────────────────────────────────────────────
function downloadICS(session: Session) {
  const toICSDate = (date: string, time: string) => {
    const [y, m, day] = date.split('-')
    const [h, min] = (time || '09:00').split(':')
    return `${y}${m}${day}T${h.padStart(2, '0')}${(min || '00').padStart(2, '0')}00`
  }
  const start = toICSDate(session.date, session.startTime)
  const end = toICSDate(session.date, session.endTime || session.startTime)
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//EPIC Campus//Schedule//EN',
    'BEGIN:VEVENT',
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${session.title}`,
    `DESCRIPTION:${session.notes ?? ''}${session.joinLink ? '\\nJoin: ' + session.joinLink : ''}`,
    `LOCATION:${session.location ?? ''}`,
    `ORGANIZER;CN=${session.teacherName ?? 'EPIC Campus'}:MAILTO:info@epiccampus.lk`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
  const blob = new Blob([ics], { type: 'text/calendar' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${session.title.replace(/\s+/g, '-')}.ics`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Session detail panel ─────────────────────────────────────────────────────
function SessionPanel({ session, onClose }: { session: Session; onClose: () => void }) {
  const status = computeStatus(session, isoToday())
  const cfg = STATUS_CONFIG[status]
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col bg-white dark:bg-[#0d1a2e] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#DDE3EC] dark:border-white/[0.08] px-5 py-4">
          <h2 className="font-jakarta font-bold text-[#0B3D6B] dark:text-white">Session Details</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-[#5A6A7A] hover:bg-[#F5F7FB] dark:hover:bg-white/[0.06]">
            <span className="ti ti-x text-lg" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 ${cfg.bg} ${cfg.border}`}>
            <span className={`ti ${TYPE_ICONS[session.type ?? 'class']} ${cfg.text}`} />
            <span className={`text-xs font-bold ${cfg.text}`}>{cfg.label}</span>
          </div>

          <h3 className="font-jakarta text-xl font-bold text-[#0D1B2A] dark:text-white">{session.title}</h3>

          <div className="space-y-3">
            {[
              { icon: 'ti-calendar', label: 'Date', value: fmtDay(session.date) },
              { icon: 'ti-clock', label: 'Time', value: session.startTime ? `${session.startTime}${session.endTime ? ` – ${session.endTime}` : ''}` : 'TBC' },
              ...(session.location ? [{ icon: 'ti-map-pin', label: 'Location', value: session.location }] : []),
              ...(session.teacherName ? [{ icon: 'ti-user', label: 'Teacher', value: session.teacherName }] : []),
            ].map(item => (
              <div key={item.label} className="flex items-start gap-3 rounded-xl bg-[#F5F7FB] dark:bg-white/[0.04] px-4 py-3">
                <span className={`ti ${item.icon} mt-0.5 text-[#E8A020]`} />
                <div>
                  <p className="text-xs font-medium text-[#5A6A7A] dark:text-white/50">{item.label}</p>
                  <p className="text-sm font-semibold text-[#0D1B2A] dark:text-white">{item.value}</p>
                </div>
              </div>
            ))}
          </div>

          {session.notes && (
            <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3">
              <p className="text-xs font-bold text-amber-700 dark:text-amber-400 mb-1">Notes</p>
              <p className="text-sm text-amber-800 dark:text-amber-300">{session.notes}</p>
            </div>
          )}

          {session.joinLink && (
            <a
              href={session.joinLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-xl bg-[#0B3D6B] px-4 py-3 text-sm font-bold text-white hover:bg-[#1A6BAD] transition-all"
            >
              <span className="ti ti-video" />
              Join Online Session
              <span className="ti ti-external-link ml-auto" />
            </a>
          )}
        </div>

        <div className="border-t border-[#DDE3EC] dark:border-white/[0.08] p-5">
          <button
            type="button"
            onClick={() => downloadICS(session)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#E8A020] py-3 text-sm font-bold text-[#0B3D6B] hover:bg-[#d4911c]"
          >
            <span className="ti ti-calendar-plus" />
            Add to My Calendar
          </button>
          <p className="mt-2 text-center text-xs text-[#5A6A7A] dark:text-white/40">
            Works with Google Calendar, Apple Calendar &amp; Outlook
          </p>
        </div>
      </div>
    </>
  )
}

// ── Agenda session card ──────────────────────────────────────────────────────
function SessionCard({ session, today, onClick }: { session: Session; today: string; onClick: () => void }) {
  const status = computeStatus(session, today)
  const cfg = STATUS_CONFIG[status]
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[44px] w-full rounded-xl border-l-4 ${cfg.barColor} bg-white dark:bg-gray-800 p-4 text-left shadow-sm transition-shadow hover:shadow-md`}
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        {session.startTime && (
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {session.startTime}{session.endTime ? ` – ${session.endTime}` : ''}
          </span>
        )}
        <span className="truncate text-base font-semibold text-gray-900 dark:text-white">{session.title}</span>
      </div>
      <div className="mt-1 space-y-0.5">
        {session.teacherName && (
          <p className="text-sm text-gray-500 dark:text-gray-400">Teacher: {session.teacherName}</p>
        )}
        {session.location ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">{session.location}</p>
        ) : session.joinLink ? (
          <p className="flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400">
            <span className="ti ti-video" /> Online
          </p>
        ) : null}
      </div>
      <div className="mt-2">
        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${cfg.bg} ${cfg.text} ${cfg.border}`}>
          {cfg.label}
        </span>
      </div>
    </button>
  )
}

// ── Month grid (left panel — month view) ─────────────────────────────────────
function MonthGrid({
  cells, today, selectedDate, byDate, onSelect,
}: {
  cells: MonthCell[]
  today: string
  selectedDate: string | null
  byDate: Record<string, Session[]>
  onSelect: (iso: string) => void
}) {
  return (
    <div>
      <div className="grid grid-cols-7">
        {WEEKDAYS_SHORT.map(d => (
          <div key={d} className="py-1.5 text-center text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map(cell => {
          const isTdy = cell.iso === today
          const isSelected = cell.iso === selectedDate
          const hasSessions = (byDate[cell.iso]?.length ?? 0) > 0

          if (!cell.inMonth) {
            return (
              <div key={cell.iso} className="flex min-h-[44px] sm:min-h-[48px] items-start justify-center pt-2">
                <span className="text-sm text-gray-300 dark:text-gray-600">{cell.day}</span>
              </div>
            )
          }

          return (
            <button
              key={cell.iso}
              type="button"
              onClick={() => onSelect(cell.iso)}
              className="relative flex min-h-[44px] sm:min-h-[48px] flex-col items-center justify-start gap-0.5 rounded-xl pt-1.5 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full text-base font-medium ${
                  isSelected
                    ? 'bg-[#0B3D6B] text-white'
                    : isTdy
                      ? 'bg-[#E8A020] text-white'
                      : 'text-gray-900 dark:text-white'
                }`}
              >
                {cell.day}
              </span>
              <span className={`h-1.5 w-1.5 rounded-full ${hasSessions ? 'bg-[#0B3D6B] dark:bg-[#1A6BAD]' : 'bg-transparent'}`} />
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Week grid (left panel — week view) ───────────────────────────────────────
function WeekGrid({
  cells, today, selectedDate, byDate, onSelect,
}: {
  cells: WeekCell[]
  today: string
  selectedDate: string | null
  byDate: Record<string, Session[]>
  onSelect: (iso: string) => void
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {cells.map(cell => {
        const isTdy = cell.iso === today
        const isSelected = cell.iso === selectedDate
        const daySessions = (byDate[cell.iso] ?? [])
          .slice()
          .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''))

        return (
          <button
            key={cell.iso}
            type="button"
            onClick={() => onSelect(cell.iso)}
            className={`flex min-h-[44px] w-[92px] shrink-0 flex-col items-stretch gap-1 rounded-xl p-2 text-left transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 ${
              isSelected ? 'bg-[#0B3D6B]/5 dark:bg-[#0B3D6B]/20' : ''
            }`}
          >
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {cell.weekday}
              </span>
              <span
                className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                  isTdy ? 'bg-[#E8A020] text-white' : 'text-gray-900 dark:text-white'
                }`}
              >
                {cell.day}
              </span>
            </div>
            <div className="mt-1 space-y-1">
              {daySessions.slice(0, 3).map(s => {
                const status = computeStatus(s, today)
                return (
                  <div
                    key={s.id}
                    className={`truncate rounded-md border-l-2 ${STATUS_CONFIG[status].barColor} bg-gray-50 dark:bg-white/[0.06] px-1.5 py-1 text-[9px] font-medium text-gray-700 dark:text-white/70`}
                  >
                    {s.startTime ? `${s.startTime} ` : ''}{s.title}
                  </div>
                )
              })}
              {daySessions.length > 3 && (
                <p className="text-center text-[9px] text-gray-400 dark:text-gray-500">+{daySessions.length - 3} more</p>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function MySchedulePage() {
  const { student } = useStudentPortal()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<ScheduleView>('month')
  const [monthAnchor, setMonthAnchor] = useState(() => firstOfMonth(isoToday()))
  const [weekAnchor, setWeekAnchor] = useState(() => startOfWeek(isoToday()))
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selected, setSelected] = useState<Session | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const groupRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const courseId = student?.courseId ?? ''
  const noCourse = !courseId
  const [showAll, setShowAll] = useState(false)
  // Filter to the student's course by default; skip the filter if they opt to see
  // everything, or if no course is set on their profile.
  const filterByCourse = !noCourse && !showAll

  // Load sessions — scoped to the student's course unless "show all" is active.
  useEffect(() => {
    if (!student) return
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const base = collection(db, 'sessions')
        const q = filterByCourse
          ? query(base, where('courseId', '==', courseId), orderBy('date', 'asc'))
          : query(base, orderBy('date', 'asc'))
        const snap = await getDocs(q)
        if (!cancelled) {
          setSessions(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Session, 'id'>) })))
        }
      } catch (err) {
        console.error('[MySchedule]', err)
        if (!cancelled) setSessions([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [student, courseId, filterByCourse])

  const today = isoToday()

  const byDate = useMemo(() => {
    const map: Record<string, Session[]> = {}
    sessions.forEach(s => {
      if (!map[s.date]) map[s.date] = []
      map[s.date].push(s)
    })
    return map
  }, [sessions])

  const monthCells = useMemo(() => buildMonthGrid(monthAnchor), [monthAnchor])
  const weekCells = useMemo(() => buildWeekGrid(weekAnchor), [weekAnchor])

  const sessionsThisMonth = useMemo(
    () => sessions.filter(s => monthKey(s.date) === monthKey(monthAnchor)),
    [sessions, monthAnchor],
  )

  const sessionsThisWeek = useMemo(() => {
    const weekEnd = addDaysIso(weekAnchor, 6)
    return sessions.filter(s => s.date >= weekAnchor && s.date <= weekEnd)
  }, [sessions, weekAnchor])

  const upcomingSessions = useMemo(
    () => sessions.filter(s => s.date >= today),
    [sessions, today],
  )

  // Chronological agenda groups for the current view's scope (month / week / all-upcoming),
  // narrowed further to a single day when one is selected (month & week views only).
  const agendaGroups = useMemo(() => {
    const base = view === 'list' ? upcomingSessions : view === 'week' ? sessionsThisWeek : sessionsThisMonth
    const scoped = (view !== 'list' && selectedDate) ? base.filter(s => s.date === selectedDate) : base
    const dates = Array.from(new Set(scoped.map(s => s.date))).sort()
    return dates.map(date => ({
      date,
      items: (byDate[date] ?? []).slice().sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? '')),
    }))
  }, [view, upcomingSessions, sessionsThisWeek, sessionsThisMonth, selectedDate, byDate])

  function goPrevMonth() {
    setMonthAnchor(a => addMonths(a, -1))
    setSelectedDate(null)
  }
  function goNextMonth() {
    setMonthAnchor(a => addMonths(a, 1))
    setSelectedDate(null)
  }
  function goThisMonth() {
    setMonthAnchor(firstOfMonth(today))
    setSelectedDate(null)
  }

  function goPrevWeek() {
    setWeekAnchor(a => addDaysIso(a, -7))
    setSelectedDate(null)
  }
  function goNextWeek() {
    setWeekAnchor(a => addDaysIso(a, 7))
    setSelectedDate(null)
  }
  function goThisWeek() {
    setWeekAnchor(startOfWeek(today))
    setSelectedDate(null)
  }

  function goPrev() {
    if (view === 'week') goPrevWeek()
    else if (view === 'month') goPrevMonth()
  }
  function goNext() {
    if (view === 'week') goNextWeek()
    else if (view === 'month') goNextMonth()
  }
  function goToday() {
    if (view === 'week') { goThisWeek(); return }
    if (view === 'month') { goThisMonth(); return }
    // List view has no month/week to page — jump the agenda to today's group instead.
    const el = groupRefs.current[today]
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    else listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function selectDay(iso: string) {
    setSelectedDate(prev => (prev === iso ? null : iso))
    requestAnimationFrame(() => {
      listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  function selectView(v: ScheduleView) {
    setView(v)
    setSelectedDate(null)
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4 pb-24">
        <div className="h-10 w-64 rounded-xl bg-[#DDE3EC] dark:bg-white/10" />
        <div className="h-64 rounded-2xl bg-[#DDE3EC] dark:bg-white/10" />
      </div>
    )
  }

  return (
    <div className="pb-24 md:pb-6">
      {/* Page header */}
      <div className="mb-4">
        <h1 className="font-jakarta text-2xl font-bold text-[#0D1B2A] dark:text-white">My Schedule</h1>
        <p className="text-sm text-[#5A6A7A] dark:text-white/50">Classes, exams and workshops</p>
      </div>

      {noCourse && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm font-medium text-amber-800 dark:text-amber-300">
          <span className="ti ti-info-circle text-base shrink-0" />
          No course assigned — showing all sessions
        </div>
      )}

      <>
          {/* ── TOP CONTROLS BAR ─────────────────────────────────────────── */}
          <div className="sticky top-0 z-20 flex min-h-[64px] flex-wrap items-center justify-between gap-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={goToday}
                className="flex h-11 items-center justify-center rounded-lg border border-gray-300 dark:border-gray-600 px-4 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Today
              </button>
              <button
                type="button"
                onClick={goPrev}
                disabled={view === 'list'}
                aria-label="Previous"
                className="flex h-10 w-10 items-center justify-center rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:pointer-events-none"
              >
                <span className="ti ti-chevron-left text-lg" />
              </button>
              <button
                type="button"
                onClick={goNext}
                disabled={view === 'list'}
                aria-label="Next"
                className="flex h-10 w-10 items-center justify-center rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:pointer-events-none"
              >
                <span className="ti ti-chevron-right text-lg" />
              </button>
              <span className="font-jakarta text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                {view === 'week' ? fmtWeekRange(weekAnchor) : view === 'month' ? fmtMonthYear(monthAnchor) : 'Upcoming'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {courseId && (
                <button
                  type="button"
                  onClick={() => setShowAll(v => !v)}
                  title={showAll ? 'Showing every course' : 'Showing only your course'}
                  className={`flex h-11 items-center gap-1.5 rounded-lg border px-3 text-xs sm:text-sm font-semibold transition-colors ${
                    showAll
                      ? 'border-[#E8A020] bg-[#E8A020]/10 text-[#E8A020]'
                      : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  <span className="ti ti-filter" />
                  {showAll ? 'All sessions' : 'My course'}
                </button>
              )}
              <div className="flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700">
                {(['month', 'week', 'list'] as const).map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => selectView(v)}
                    className={`h-11 rounded-md px-3 sm:px-4 text-xs sm:text-sm font-semibold capitalize transition-colors ${
                      view === v
                        ? 'bg-[#0B3D6B] text-white'
                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── PANELS ───────────────────────────────────────────────────── */}
          <div className="flex flex-col md:flex-row">
            {view !== 'list' && (
              <>
                <div className="w-full md:w-[380px] lg:w-[420px] md:shrink-0 bg-white dark:bg-gray-900 p-4">
                  {view === 'month' ? (
                    <MonthGrid cells={monthCells} today={today} selectedDate={selectedDate} byDate={byDate} onSelect={selectDay} />
                  ) : (
                    <WeekGrid cells={weekCells} today={today} selectedDate={selectedDate} byDate={byDate} onSelect={selectDay} />
                  )}
                </div>
                <div className="hidden md:block w-px shrink-0 bg-gray-200 dark:bg-gray-700" />
              </>
            )}

            {/* Agenda (right panel) */}
            <div ref={listRef} className="min-w-0 flex-1 bg-white dark:bg-gray-900 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  {selectedDate && view !== 'list'
                    ? fmtGroupHeader(selectedDate)
                    : view === 'week'
                      ? fmtWeekRange(weekAnchor)
                      : view === 'month'
                        ? fmtMonthYear(monthAnchor)
                        : 'Upcoming'}
                </p>
                {selectedDate && view !== 'list' && (
                  <button
                    type="button"
                    onClick={() => setSelectedDate(null)}
                    className="whitespace-nowrap text-xs font-semibold text-[#0B3D6B] dark:text-[#E8A020] hover:underline"
                  >
                    ← Show full {view === 'week' ? 'week' : 'month'}
                  </button>
                )}
              </div>

              {agendaGroups.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0B3D6B]/10 dark:bg-white/[0.06]">
                    <span className="ti ti-calendar text-[28px] text-[#0B3D6B] dark:text-white/30" />
                  </div>
                  <h3 className="font-jakarta text-[18px] font-bold text-[#0B3D6B] dark:text-white mb-2">
                    No sessions scheduled
                  </h3>
                  <p className="max-w-xs text-[14px] text-[#5A6A7A] dark:text-white/40 leading-relaxed">
                    Your upcoming classes will appear here once your teacher schedules them.
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  {agendaGroups.map(group => (
                    <div key={group.date} ref={(el) => { groupRefs.current[group.date] = el }}>
                      {/* Sticky only from md up — the top controls bar can wrap to two
                          lines on mobile, so its height (and a safe offset here) isn't
                          predictable below that breakpoint. */}
                      <div className="relative md:sticky md:top-[68px] z-10 -mx-1 flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-1 py-2">
                        {group.date === today && (
                          <span className="rounded-full bg-[#E8A020] px-2 py-0.5 text-[10px] font-bold text-white">TODAY</span>
                        )}
                        <span className="text-xs font-bold uppercase tracking-wide text-[#E8A020]">
                          {fmtGroupHeader(group.date)}
                        </span>
                      </div>
                      <div className="space-y-2 pt-2">
                        {group.items.map(s => (
                          <SessionCard key={s.id} session={s} today={today} onClick={() => setSelected(s)} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
      </>

      {/* Session detail panel */}
      {selected && <SessionPanel session={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
