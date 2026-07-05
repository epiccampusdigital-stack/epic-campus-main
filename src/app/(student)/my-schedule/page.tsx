'use client'

import { useEffect, useMemo, useState } from 'react'
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useStudentPortal } from '@/components/student/StudentContext'

type ViewMode = 'day' | 'week' | 'month'
type SessionType = 'class' | 'exam' | 'workshop' | 'other'

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
}

// ── Colour config ────────────────────────────────────────────────────────────
const TYPE_CONFIG: Record<SessionType, { bg: string; text: string; border: string; dot: string }> = {
  class:    { bg: 'bg-[#0B3D6B]/10 dark:bg-[#0B3D6B]/30', text: 'text-[#0B3D6B] dark:text-blue-300',   border: 'border-[#0B3D6B]/30', dot: 'bg-[#0B3D6B]' },
  exam:     { bg: 'bg-red-50 dark:bg-red-900/20',           text: 'text-red-700 dark:text-red-400',       border: 'border-red-200 dark:border-red-800',     dot: 'bg-red-500' },
  workshop: { bg: 'bg-purple-50 dark:bg-purple-900/20',     text: 'text-purple-700 dark:text-purple-400', border: 'border-purple-200 dark:border-purple-800', dot: 'bg-purple-500' },
  other:    { bg: 'bg-[#F5F7FB] dark:bg-white/[0.06]',      text: 'text-[#5A6A7A] dark:text-white/60',   border: 'border-[#DDE3EC] dark:border-white/20',   dot: 'bg-[#5A6A7A]' },
}
const TYPE_ICONS: Record<SessionType, string> = {
  class: 'ti-book', exam: 'ti-pencil', workshop: 'ti-tools', other: 'ti-calendar',
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function isoToday() { return new Date().toISOString().slice(0, 10) }

function startOfWeek(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  const day = d.getDay()
  d.setDate(d.getDate() - day)
  return d.toISOString().slice(0, 10)
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function addMonths(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00')
  d.setMonth(d.getMonth() + n)
  return d.toISOString().slice(0, 10)
}

function fmtDay(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function fmtMonthYear(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    month: 'long', year: 'numeric',
  })
}

function fmtShortDay(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric',
  })
}

function daysInMonth(iso: string): number {
  const d = new Date(iso + 'T00:00:00')
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
}

function firstDayOfMonthWeekday(iso: string): number {
  const d = new Date(iso + 'T00:00:00')
  return new Date(d.getFullYear(), d.getMonth(), 1).getDay()
}

function isoOfDay(monthIso: string, day: number): string {
  const d = new Date(monthIso + 'T00:00:00')
  return new Date(d.getFullYear(), d.getMonth(), day).toISOString().slice(0, 10)
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
  const cfg = TYPE_CONFIG[session.type ?? 'class']
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
          {/* Type badge */}
          <div className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 ${cfg.bg} ${cfg.border}`}>
            <span className={`ti ${TYPE_ICONS[session.type ?? 'class']} ${cfg.text}`} />
            <span className={`text-xs font-bold capitalize ${cfg.text}`}>{session.type ?? 'class'}</span>
          </div>

          {/* Title */}
          <h3 className="font-jakarta text-xl font-bold text-[#0D1B2A] dark:text-white">{session.title}</h3>

          {/* Details grid */}
          <div className="space-y-3">
            {[
              { icon: 'ti-calendar', label: 'Date', value: fmtDay(session.date) },
              { icon: 'ti-clock', label: 'Time', value: session.startTime ? `${session.startTime}${session.endTime ? ` – ${session.endTime}` : ''}` : 'TBC' },
              { icon: 'ti-map-pin', label: 'Location', value: session.location || '—' },
              { icon: 'ti-user', label: 'Teacher', value: session.teacherName || '—' },
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

          {/* Notes */}
          {session.notes && (
            <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3">
              <p className="text-xs font-bold text-amber-700 dark:text-amber-400 mb-1">Notes</p>
              <p className="text-sm text-amber-800 dark:text-amber-300">{session.notes}</p>
            </div>
          )}

          {/* Join link */}
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

        {/* Add to calendar */}
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
            Works with Google Calendar, Apple Calendar & Outlook
          </p>
        </div>
      </div>
    </>
  )
}

// ── Session card (compact) ────────────────────────────────────────────────────
function SessionCard({ session, past, onClick }: { session: Session; past: boolean; onClick: () => void }) {
  const cfg = TYPE_CONFIG[session.type ?? 'class']
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-2xl border p-4 transition-all hover:shadow-sm ${
        past
          ? 'border-[#DDE3EC] dark:border-white/[0.06] bg-[#F5F7FB]/50 dark:bg-white/[0.02] opacity-60'
          : `${cfg.bg} ${cfg.border} hover:scale-[1.01]`
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${past ? 'bg-[#DDE3EC] dark:bg-white/10' : cfg.bg} border ${past ? 'border-[#DDE3EC]' : cfg.border}`}>
          <span className={`ti ${TYPE_ICONS[session.type ?? 'class']} text-base ${past ? 'text-[#5A6A7A]' : cfg.text}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`font-semibold text-sm truncate ${past ? 'text-[#5A6A7A] dark:text-white/40' : 'text-[#0D1B2A] dark:text-white'}`}>
            {session.title}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-[#5A6A7A] dark:text-white/40">
            {session.startTime && (
              <span className="flex items-center gap-1">
                <span className="ti ti-clock" />
                {session.startTime}{session.endTime ? ` – ${session.endTime}` : ''}
              </span>
            )}
            {session.location && (
              <span className="flex items-center gap-1">
                <span className="ti ti-map-pin" />
                {session.location}
              </span>
            )}
            {session.teacherName && (
              <span className="flex items-center gap-1">
                <span className="ti ti-user" />
                {session.teacherName}
              </span>
            )}
          </div>
          {session.notes && (
            <p className="mt-1 text-xs text-[#5A6A7A] dark:text-white/30 truncate">{session.notes}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${past ? 'bg-[#DDE3EC] dark:bg-white/10 text-[#5A6A7A]' : `${cfg.bg} ${cfg.text}`}`}>
            {session.type ?? 'class'}
          </span>
          {session.joinLink && !past && (
            <span className="ti ti-video text-xs text-emerald-500" />
          )}
        </div>
      </div>
    </button>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function MySchedulePage() {
  const { student } = useStudentPortal()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [anchor, setAnchor] = useState(isoToday())
  const [selected, setSelected] = useState<Session | null>(null)

  // Load sessions for this student's course
  useEffect(() => {
    if (!student) return
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        // Try course-filtered query first, fallback to all
        const snap = await getDocs(
          query(
            collection(db, 'sessions'),
            where('courseId', '==', student!.courseId ?? ''),
            orderBy('date', 'asc'),
          ),
        ).catch(() =>
          getDocs(query(collection(db, 'sessions'), orderBy('date', 'asc')))
        )
        if (!cancelled) {
          setSessions(
            snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Session, 'id'>) }))
          )
        }
      } catch (err) {
        console.error('[MySchedule]', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [student])

  const today = isoToday()

  // ── Derived date ranges ────────────────────────────────────────────────────
  const weekStart = useMemo(() => startOfWeek(anchor), [anchor])
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const monthAnchor = useMemo(() => anchor.slice(0, 8) + '01', [anchor])

  // ── Session lookup map ─────────────────────────────────────────────────────
  const byDate = useMemo(() => {
    const map: Record<string, Session[]> = {}
    sessions.forEach(s => {
      if (!map[s.date]) map[s.date] = []
      map[s.date].push(s)
    })
    return map
  }, [sessions])

  // ── Navigation ─────────────────────────────────────────────────────────────
  function goBack() {
    if (viewMode === 'day') setAnchor(a => addDays(a, -1))
    else if (viewMode === 'week') setAnchor(a => addDays(a, -7))
    else setAnchor(a => addMonths(a, -1))
  }
  function goForward() {
    if (viewMode === 'day') setAnchor(a => addDays(a, 1))
    else if (viewMode === 'week') setAnchor(a => addDays(a, 7))
    else setAnchor(a => addMonths(a, 1))
  }
  function goToday() { setAnchor(isoToday()) }

  // ── Header label ───────────────────────────────────────────────────────────
  const headerLabel = useMemo(() => {
    if (viewMode === 'day') return fmtDay(anchor)
    if (viewMode === 'week') {
      const end = addDays(weekStart, 6)
      const s = new Date(weekStart + 'T00:00:00')
      const e = new Date(end + 'T00:00:00')
      return `${s.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${e.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
    }
    return fmtMonthYear(anchor)
  }, [viewMode, anchor, weekStart])

  if (loading) {
    return (
      <div className="animate-pulse space-y-4 pb-24">
        <div className="h-10 w-64 rounded-xl bg-[#DDE3EC] dark:bg-white/10" />
        <div className="h-64 rounded-2xl bg-[#DDE3EC] dark:bg-white/10" />
      </div>
    )
  }

  const sessionsOnDay = (iso: string) => byDate[iso] ?? []

  return (
    <div className="space-y-4 pb-24 md:pb-6">
      {/* Page header */}
      <div>
        <h1 className="font-jakarta text-2xl font-bold text-[#0D1B2A] dark:text-white">My Schedule</h1>
        <p className="text-sm text-[#5A6A7A] dark:text-white/50">Classes, exams and workshops</p>
      </div>

      {/* Controls: view mode + nav */}
      <div className="flex flex-wrap items-center gap-3">
        {/* View mode tabs */}
        <div className="flex rounded-xl border border-[#DDE3EC] dark:border-white/20 overflow-hidden">
          {(['day', 'week', 'month'] as const).map(v => (
            <button
              key={v}
              type="button"
              onClick={() => setViewMode(v)}
              className={`px-4 py-2 text-sm font-semibold capitalize transition-all ${
                viewMode === v
                  ? 'bg-[#0B3D6B] text-white'
                  : 'bg-white dark:bg-white/[0.04] text-[#5A6A7A] dark:text-white/60 hover:bg-[#F5F7FB] dark:hover:bg-white/[0.08]'
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={goBack}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#DDE3EC] dark:border-white/20 text-[#5A6A7A] dark:text-white/60 hover:bg-[#F5F7FB] dark:hover:bg-white/[0.06]"
          >
            <span className="ti ti-chevron-left" />
          </button>
          <button
            type="button"
            onClick={goToday}
            className="rounded-xl border border-[#DDE3EC] dark:border-white/20 px-3 py-1.5 text-xs font-semibold text-[#5A6A7A] dark:text-white/60 hover:bg-[#F5F7FB] dark:hover:bg-white/[0.06]"
          >
            Today
          </button>
          <button
            type="button"
            onClick={goForward}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#DDE3EC] dark:border-white/20 text-[#5A6A7A] dark:text-white/60 hover:bg-[#F5F7FB] dark:hover:bg-white/[0.06]"
          >
            <span className="ti ti-chevron-right" />
          </button>
        </div>

        {/* Date label */}
        <p className="text-sm font-semibold text-[#0D1B2A] dark:text-white">{headerLabel}</p>

        {/* Session count */}
        <span className="ml-auto rounded-full bg-[#F5F7FB] dark:bg-white/[0.06] px-3 py-1 text-xs font-semibold text-[#5A6A7A] dark:text-white/50">
          {sessions.length} session{sessions.length !== 1 ? 's' : ''} total
        </span>
      </div>

      {/* ── DAY VIEW ─────────────────────────────────────────────────────────── */}
      {viewMode === 'day' && (
        <div className="space-y-3">
          <div className={`flex items-center gap-2 rounded-xl px-4 py-2.5 ${
            anchor === today
              ? 'bg-[#E8A020]/10 border border-[#E8A020]/30'
              : 'bg-[#F5F7FB] dark:bg-white/[0.04] border border-[#DDE3EC] dark:border-white/[0.08]'
          }`}>
            {anchor === today && (
              <span className="rounded-full bg-[#E8A020] px-2 py-0.5 text-[10px] font-bold text-white">TODAY</span>
            )}
            <span className="text-sm font-semibold text-[#0D1B2A] dark:text-white">{fmtDay(anchor)}</span>
          </div>

          {sessionsOnDay(anchor).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0B3D6B]/10 dark:bg-white/[0.06]">
                <span className="ti ti-calendar-off text-[28px] text-[#0B3D6B] dark:text-white/30" />
              </div>
              <h3 className="font-jakarta text-[18px] font-bold text-[#0B3D6B] dark:text-white mb-2">
                No sessions scheduled yet
              </h3>
              <p className="max-w-xs text-[14px] text-[#5A6A7A] dark:text-white/40 leading-relaxed">
                Your upcoming classes and sessions will appear here once your teacher schedules them.
              </p>
            </div>
          ) : (
            sessionsOnDay(anchor)
              .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''))
              .map(s => (
                <SessionCard key={s.id} session={s} past={s.date < today} onClick={() => setSelected(s)} />
              ))
          )}
        </div>
      )}

      {/* ── WEEK VIEW ────────────────────────────────────────────────────────── */}
      {viewMode === 'week' && (
        <div className="space-y-3">
          {/* Week day strip */}
          <div className="grid grid-cols-7 gap-1">
            {weekDays.map(iso => {
              const count = sessionsOnDay(iso).length
              const isAnchor = iso === anchor
              const isTdy = iso === today
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => { setAnchor(iso); setViewMode('day') }}
                  className={`flex flex-col items-center rounded-xl py-2 transition-all ${
                    isTdy
                      ? 'bg-[#E8A020] text-white'
                      : isAnchor
                      ? 'bg-[#0B3D6B] text-white'
                      : 'bg-[#F5F7FB] dark:bg-white/[0.04] text-[#5A6A7A] dark:text-white/60 hover:bg-[#DDE3EC]/50'
                  }`}
                >
                  <span className="text-[10px] font-bold">{WEEKDAYS_SHORT[new Date(iso + 'T00:00:00').getDay()]}</span>
                  <span className="text-base font-black">{new Date(iso + 'T00:00:00').getDate()}</span>
                  {count > 0 && (
                    <span className={`mt-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold ${
                      isTdy ? 'bg-white text-[#E8A020]' : 'bg-[#E8A020] text-white'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Sessions for each day of the week */}
          <div className="space-y-4">
            {weekDays.map(iso => {
              const daySessions = sessionsOnDay(iso).sort((a, b) =>
                (a.startTime ?? '').localeCompare(b.startTime ?? '')
              )
              if (daySessions.length === 0) return null
              return (
                <div key={iso}>
                  <div className={`mb-2 flex items-center gap-2 ${
                    iso === today ? 'text-[#E8A020]' : 'text-[#5A6A7A] dark:text-white/50'
                  }`}>
                    {iso === today && (
                      <span className="rounded-full bg-[#E8A020] px-2 py-0.5 text-[10px] font-bold text-white">TODAY</span>
                    )}
                    <span className="text-xs font-semibold">{fmtShortDay(iso)}</span>
                  </div>
                  <div className="space-y-2">
                    {daySessions.map(s => (
                      <SessionCard key={s.id} session={s} past={iso < today} onClick={() => setSelected(s)} />
                    ))}
                  </div>
                </div>
              )
            })}
            {weekDays.every(iso => sessionsOnDay(iso).length === 0) && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0B3D6B]/10 dark:bg-white/[0.06]">
                  <span className="ti ti-calendar-off text-[28px] text-[#0B3D6B] dark:text-white/30" />
                </div>
                <h3 className="font-jakarta text-[18px] font-bold text-[#0B3D6B] dark:text-white mb-2">
                  No sessions scheduled yet
                </h3>
                <p className="max-w-xs text-[14px] text-[#5A6A7A] dark:text-white/40 leading-relaxed">
                  Your upcoming classes and sessions will appear here once your teacher schedules them.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MONTH VIEW ───────────────────────────────────────────────────────── */}
      {viewMode === 'month' && (
        <div className="space-y-3">
          {/* Grid header */}
          <div className="grid grid-cols-7 gap-1">
            {WEEKDAYS_SHORT.map(d => (
              <div key={d} className="py-1 text-center text-[10px] font-bold uppercase text-[#5A6A7A] dark:text-white/40">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Empty cells before month starts */}
            {Array.from({ length: firstDayOfMonthWeekday(monthAnchor) }, (_, i) => (
              <div key={`empty-${i}`} className="h-14 rounded-xl" />
            ))}
            {/* Day cells */}
            {Array.from({ length: daysInMonth(monthAnchor) }, (_, i) => {
              const iso = isoOfDay(monthAnchor, i + 1)
              const daySessions = sessionsOnDay(iso)
              const isTdy = iso === today
              const isPast = iso < today
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => { setAnchor(iso); setViewMode('day') }}
                  className={`relative flex h-14 flex-col items-start rounded-xl p-1.5 transition-all ${
                    isTdy
                      ? 'bg-[#E8A020] text-white shadow-md'
                      : isPast
                      ? 'bg-[#F5F7FB]/50 dark:bg-white/[0.02] text-[#5A6A7A]/50 dark:text-white/20'
                      : 'bg-white dark:bg-white/[0.04] text-[#0D1B2A] dark:text-white hover:border-[#E8A020] border border-[#DDE3EC] dark:border-white/[0.08]'
                  }`}
                >
                  <span className={`text-xs font-bold ${isTdy ? 'text-white' : ''}`}>{i + 1}</span>
                  <div className="mt-auto flex gap-0.5 flex-wrap">
                    {daySessions.slice(0, 3).map(s => (
                      <div
                        key={s.id}
                        className={`h-1.5 w-1.5 rounded-full ${
                          isTdy ? 'bg-white' : TYPE_CONFIG[s.type ?? 'class'].dot
                        }`}
                      />
                    ))}
                    {daySessions.length > 3 && (
                      <span className={`text-[8px] font-bold ${isTdy ? 'text-white' : 'text-[#5A6A7A]'}`}>+{daySessions.length - 3}</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Sessions for selected anchor day (click any day to see) */}
          {sessionsOnDay(anchor).length > 0 && (
            <div className="space-y-2 pt-2">
              <p className="text-xs font-bold uppercase tracking-wider text-[#5A6A7A] dark:text-white/50">
                {fmtShortDay(anchor)}
              </p>
              {sessionsOnDay(anchor)
                .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''))
                .map(s => (
                  <SessionCard key={s.id} session={s} past={anchor < today} onClick={() => setSelected(s)} />
                ))}
            </div>
          )}
        </div>
      )}

      {/* Session detail panel */}
      {selected && <SessionPanel session={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
