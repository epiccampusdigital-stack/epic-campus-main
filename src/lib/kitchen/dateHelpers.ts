export function normalizeKitchenDate(date: unknown): string {
  if (!date) return ''
  if (typeof date === 'string') return date.slice(0, 10)
  if (typeof date === 'object' && date !== null && 'toDate' in date) {
    const toDate = (date as { toDate?: () => Date }).toDate
    if (typeof toDate === 'function') {
      return toDate.call(date).toISOString().slice(0, 10)
    }
  }
  if (typeof date === 'object' && date !== null && 'seconds' in date) {
    return new Date((date as { seconds: number }).seconds * 1000).toISOString().slice(0, 10)
  }
  return String(date).slice(0, 10)
}

export function formatShortDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T12:00:00`)
  if (Number.isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function getWeekRange(refDate: string): { start: string; end: string; label: string } {
  const d = new Date(`${refDate.slice(0, 10)}T12:00:00`)
  const day = d.getDay()
  const diffToMon = day === 0 ? -6 : 1 - day
  const mon = new Date(d)
  mon.setDate(d.getDate() + diffToMon)
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  const start = mon.toISOString().slice(0, 10)
  const end = sun.toISOString().slice(0, 10)
  const label = `Week of ${formatShortDate(start).replace(/ \d{4}$/, '')}–${formatShortDate(end).slice(0, 6)} ${sun.getFullYear()}`
  return { start, end, label }
}

export function getMonthRange(refDate: string): { start: string; end: string; label: string } {
  const d = new Date(`${refDate.slice(0, 10)}T12:00:00`)
  const start = new Date(d.getFullYear(), d.getMonth(), 1)
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  const label = start.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    label,
  }
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}
