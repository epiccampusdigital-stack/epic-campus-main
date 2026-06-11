export interface ReportPeriod {
  type: 'weekly' | 'monthly'
  startDate: string
  endDate: string
  label: string
  filenameSlug: string
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function toIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function formatShortDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

export function getCurrentWeekPeriod(ref = new Date()): ReportPeriod {
  const d = new Date(ref)
  d.setHours(12, 0, 0, 0)
  const day = d.getDay()
  const diffToMon = day === 0 ? -6 : 1 - day
  const mon = new Date(d)
  mon.setDate(d.getDate() + diffToMon)
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  const startDate = toIso(mon)
  const endDate = toIso(sun)
  return {
    type: 'weekly',
    startDate,
    endDate,
    label: `Week of ${formatShortDate(startDate)}–${formatShortDate(endDate)} ${sun.getFullYear()}`,
    filenameSlug: `Week-${startDate}-to-${endDate}`,
  }
}

export function getMonthPeriod(ref = new Date()): ReportPeriod {
  const y = ref.getFullYear()
  const m = ref.getMonth()
  const start = new Date(y, m, 1)
  const end = new Date(y, m + 1, 0)
  const startDate = toIso(start)
  const endDate = toIso(end)
  const monthLabel = start.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  return {
    type: 'monthly',
    startDate,
    endDate,
    label: monthLabel,
    filenameSlug: `${y}-${pad(m + 1)}`,
  }
}

export function getWeeksInRange(startDate: string, endDate: string): ReportPeriod[] {
  const weeks: ReportPeriod[] = []
  let cursor = new Date(`${startDate}T12:00:00`)
  const end = new Date(`${endDate}T12:00:00`)
  while (cursor <= end) {
    weeks.push(getCurrentWeekPeriod(cursor))
    cursor = new Date(cursor)
    cursor.setDate(cursor.getDate() + 7)
  }
  const seen = new Set<string>()
  return weeks.filter((w) => {
    if (seen.has(w.startDate)) return false
    seen.add(w.startDate)
    return w.startDate <= endDate && w.endDate >= startDate
  })
}
