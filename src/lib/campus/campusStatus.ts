import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'

/** Firestore `in` operator accepts at most 10 values per query. */
const IN_CHUNK_SIZE = 10

export interface CampusStatus {
  /** Batch ids admin has marked as currently on campus. Empty = "all batches". */
  activeBatchIds: string[]
  updatedAt: unknown
  updatedBy: string
}

export interface ActiveCampusStudents {
  count: number
  studentIds: string[]
}

export interface CampusBatchSummary {
  batchId: string
  studentCount: number
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size))
  }
  return out
}

/**
 * Reads settings/campusStatus. Returns null when the doc has never been written
 * (i.e. admin has not yet chosen which batches are on campus).
 */
export async function getCampusStatus(): Promise<CampusStatus | null> {
  const snap = await getDoc(doc(db, 'settings', 'campusStatus'))
  if (!snap.exists()) return null
  const data = snap.data()
  const raw = Array.isArray(data.activeBatchIds) ? data.activeBatchIds : []
  return {
    activeBatchIds: raw.map((b: unknown) => String(b)).filter((b) => b !== ''),
    updatedAt: data.updatedAt ?? null,
    updatedBy: String(data.updatedBy ?? ''),
  }
}

/**
 * Head-count of students actually on campus right now.
 *
 * When admin has selected batches, only active students in those batches count.
 * When no selection exists (doc missing or empty list) this falls back to every
 * active student — the pre-feature behaviour, so kitchen counts never silently
 * drop to zero before admin configures the page.
 */
export async function getActiveCampusStudentCount(): Promise<ActiveCampusStudents> {
  const status = await getCampusStatus()
  const activeBatchIds = status?.activeBatchIds ?? []

  if (activeBatchIds.length === 0) {
    const snap = await getDocs(query(collection(db, 'students'), where('status', '==', 'active')))
    const studentIds = snap.docs.map((d) => d.id)
    return { count: studentIds.length, studentIds }
  }

  const seen = new Set<string>()
  const groups = chunk(activeBatchIds, IN_CHUNK_SIZE)
  const snaps = await Promise.all(
    groups.map((group) =>
      getDocs(
        query(
          collection(db, 'students'),
          where('status', '==', 'active'),
          where('batchId', 'in', group),
        ),
      ),
    ),
  )
  for (const snap of snaps) {
    for (const d of snap.docs) seen.add(d.id)
  }
  const studentIds = Array.from(seen)
  return { count: studentIds.length, studentIds }
}

/**
 * Every batch that currently has at least one active student, with its head
 * count. Drives the admin batch picker.
 */
export async function getDistinctActiveBatches(): Promise<CampusBatchSummary[]> {
  const snap = await getDocs(query(collection(db, 'students'), where('status', '==', 'active')))
  const counts = new Map<string, number>()
  for (const d of snap.docs) {
    const batchId = String(d.data().batchId ?? '').trim()
    if (!batchId) continue
    counts.set(batchId, (counts.get(batchId) ?? 0) + 1)
  }
  return Array.from(counts.entries())
    .map(([batchId, studentCount]) => ({ batchId, studentCount }))
    .sort((a, b) => a.batchId.localeCompare(b.batchId))
}
