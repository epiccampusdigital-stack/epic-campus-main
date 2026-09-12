// Read-only report — NOT a migration. Writes nothing.
//
// 1. Lists every student under each of a given set of "known near-duplicate"
//    batchId strings, in full detail.
// 2. Scans all distinct batchIds for OTHER pairs/groups that look like the same
//    batch under different formatting, using two heuristics:
//      a) strip everything except letters/digits, lowercase -> exact match
//      b) strip a leading "batch"/"badge" word + all non-digits, parse as int
//         -> exact match (catches "02" vs "2" vs "Batch 02" vs "Batch 2")
//    These are candidates for human review, not confirmed duplicates.
//
// Run: node --env-file=.env.local scripts/report-batch-id-variants.mjs

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

function buildAdminApp() {
  if (getApps().length > 0) return getApps()[0]

  const projectId =
    process.env.FB_PROJECT_ID ??
    process.env.FIREBASE_ADMIN_PROJECT_ID ??
    process.env.FIREBASE_PROJECT_ID
  const clientEmail =
    process.env.FB_CLIENT_EMAIL ??
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL ??
    process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = (
    process.env.FB_PRIVATE_KEY ??
    process.env.FIREBASE_ADMIN_PRIVATE_KEY ??
    process.env.FIREBASE_PRIVATE_KEY
  )
    ?.replace(/\\n/g, '\n')
    ?.replace(/^["']|["']$/g, '')

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Firebase Admin credentials missing from environment')
  }

  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) })
}

const KNOWN_VARIANTS = ['2026 May', '2026 may', '2026- may', '2026-May', '2026-may', '2026/may']

function normalizeStrict(batchId) {
  return batchId.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function normalizeNumeric(batchId) {
  const withoutFiller = batchId.toLowerCase().replace(/batch|badge/g, '')
  const alnum = withoutFiller.replace(/[^a-z0-9]/g, '')
  // if anything other than digits survives (e.g. "may", "march", "december"),
  // this isn't just a formatting difference on a bare batch number — skip it,
  // otherwise "2026 May" and "2026 - December" would falsely collide on "2026"
  if (!/^[0-9]+$/.test(alnum)) return null
  if (alnum.length > 4) return null
  return String(parseInt(alnum, 10))
}

function formatDate(value) {
  if (!value) return '(no date on record)'
  if (typeof value === 'string') return value
  if (typeof value?.toDate === 'function') return value.toDate().toISOString().slice(0, 10)
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value)
}

async function main() {
  const db = getFirestore(buildAdminApp())
  const studentsSnap = await db.collection('students').get()

  const students = studentsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))

  console.log('=== Part 1: requested near-duplicate variants (2026 May group) ===\n')

  let totalInGroup = 0
  for (const variant of KNOWN_VARIANTS) {
    const matches = students.filter((s) => s.batchId === variant)
    totalInGroup += matches.length
    console.log(`batchId: "${variant}"  —  ${matches.length} student(s)`)
    for (const s of matches) {
      const enrolled = formatDate(s.enrollmentDate ?? s.createdAt)
      console.log(`    - ${s.name ?? '(no name)'}  |  id=${s.id}  |  studentCode=${s.studentCode ?? '(none)'}  |  courseId=${s.courseId ?? '(none)'}  |  enrolled=${enrolled}`)
    }
    if (matches.length === 0) console.log('    (no students)')
    console.log('')
  }
  console.log(`Total students across the 6 listed variants: ${totalInGroup}\n`)

  console.log('=== Part 2: other candidate duplicate batchIds among all 31 ===\n')

  const distinctBatchIds = [...new Set(students.map((s) => s.batchId).filter(Boolean))].sort()

  const strictGroups = new Map()
  const numericGroups = new Map()
  for (const id of distinctBatchIds) {
    const strictKey = normalizeStrict(id)
    if (!strictGroups.has(strictKey)) strictGroups.set(strictKey, [])
    strictGroups.get(strictKey).push(id)

    const numKey = normalizeNumeric(id)
    if (numKey !== null) {
      if (!numericGroups.has(numKey)) numericGroups.set(numKey, [])
      numericGroups.get(numKey).push(id)
    }
  }

  function reportGroup(label, variants) {
    console.log(`${label}`)
    for (const id of variants) {
      const matches = students.filter((s) => s.batchId === id)
      const courseIds = [...new Set(matches.map((s) => s.courseId).filter(Boolean))]
      const dates = matches
        .map((s) => formatDate(s.enrollmentDate ?? s.createdAt))
        .filter((d) => d !== '(no date on record)')
        .sort()
      const dateRange = dates.length ? `${dates[0]} .. ${dates[dates.length - 1]}` : '(no dates)'
      console.log(`    - "${id}"  —  ${matches.length} student(s)  |  courseIds: ${courseIds.join(', ') || '(none)'}  |  enrolled range: ${dateRange}`)
    }
    console.log('')
  }

  let candidateCount = 0
  const alreadyReported = new Set()

  for (const [, variants] of strictGroups) {
    if (variants.length > 1) {
      candidateCount++
      reportGroup(`Candidate group (formatting-only match) #${candidateCount}: ${JSON.stringify(variants)}`, variants)
      variants.forEach((v) => alreadyReported.add(v))
    }
  }

  for (const [numKey, variants] of numericGroups) {
    if (variants.length > 1) {
      // skip if this exact set was already fully reported as a strict group
      const allAlreadyReported = variants.every((v) => alreadyReported.has(v))
      if (allAlreadyReported) continue
      candidateCount++
      reportGroup(`Candidate group (batch-number match, normalizes to "${numKey}") #${candidateCount}: ${JSON.stringify(variants)}`, variants)
    }
  }

  if (candidateCount === 0) {
    console.log('No other candidate duplicates found by these heuristics.')
  } else {
    console.log(`Total other candidate duplicate groups flagged: ${candidateCount}`)
  }

  console.log('\n=== Part 3: manually-flagged candidates the heuristics missed ===\n')
  console.log('These mix a batch number with an embedded date, so the numeric heuristic')
  console.log('(which caps at 4 digits to avoid false hits) does not catch them:\n')
  reportGroup(
    'Manual candidate: possibly all "Batch 28, started 2026-05-09": ["28","28 badge /2026","Batch 28 2026.05.09","2026.05.09"]',
    ['28', '28 badge /2026', 'Batch 28 2026.05.09', '2026.05.09'],
  )
  console.log('Note: "28 badge /2026" likely has a typo — "badge" for "batch".\n')

  console.log('(Heuristic output — human judgement required. Not all flagged groups are necessarily the same real-world batch, and this pass may miss duplicates that don\'t share digits or formatting patterns.)')

  process.exit(0)
}

main().catch((err) => {
  console.error('Report failed:', err)
  process.exit(1)
})
