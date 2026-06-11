import { Timestamp } from 'firebase/firestore'

export function formatDate(date: Date | string | Timestamp | undefined | null): string {
  if (!date) return '—'
  const d =
    date instanceof Timestamp
      ? date.toDate()
      : date instanceof Date
        ? date
        : new Date(date)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}
