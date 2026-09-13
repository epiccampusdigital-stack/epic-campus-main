// Read-only report — NOT a migration. Writes nothing.
//
// For every students/{docId} doc, resolves the student's Firebase Auth UID
// (from the doc's own `uid` field, falling back to an Auth lookup by
// loginEmail/email) and compares it against the Firestore document ID —
// the assumption several JP online-course code paths (student-facing
// Firestore security rules, resolveStudentAccess) currently rely on.
//
// Run: node --env-file=.env.local scripts/report-student-uid-mismatch.mjs

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'

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

// loginEmail is the actual Firebase Auth login email ({idNumber}@epiccampus.lk);
// personalEmail is contact-only and is never used for auth, so it's
// deliberately not tried here. `email` is a legacy/generic fallback field
// some older docs use in loginEmail's place.
function candidateEmails(data) {
  return [data.loginEmail, data.email].filter((v) => typeof v === 'string' && v.trim())
}

async function resolveUid(auth, data) {
  if (data.uid && typeof data.uid === 'string' && data.uid.trim()) {
    return { uid: data.uid.trim(), source: 'uid field' }
  }

  for (const email of candidateEmails(data)) {
    try {
      const userRecord = await auth.getUserByEmail(email.trim())
      return { uid: userRecord.uid, source: `Auth lookup (${email.trim()})` }
    } catch {
      // Not found under this email — try the next candidate.
    }
  }

  return null
}

// Simple bounded-concurrency map so a large students collection doesn't fire
// hundreds of simultaneous Auth lookups at once.
async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length)
  let nextIndex = 0

  async function worker() {
    for (;;) {
      const i = nextIndex++
      if (i >= items.length) return
      results[i] = await fn(items[i], i)
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

async function main() {
  const app = buildAdminApp()
  const db = getFirestore(app)
  const auth = getAuth(app)

  const studentsSnap = await db.collection('students').get()
  const totalStudents = studentsSnap.size

  let matchCount = 0
  let mismatchCount = 0
  let unresolvedCount = 0
  let resolvedViaField = 0
  let resolvedViaEmail = 0

  const mismatches = []
  const unresolved = []

  await mapWithConcurrency(studentsSnap.docs, 20, async (doc) => {
    const data = doc.data()
    const name = String(data.name ?? '(no name)')
    const resolved = await resolveUid(auth, data)

    if (!resolved) {
      unresolvedCount++
      unresolved.push({ name, docId: doc.id })
      return
    }

    if (resolved.source === 'uid field') resolvedViaField++
    else resolvedViaEmail++

    if (resolved.uid === doc.id) {
      matchCount++
    } else {
      mismatchCount++
      mismatches.push({ name, docId: doc.id, uid: resolved.uid, source: resolved.source })
    }
  })

  console.log('=== Student doc ID vs Firebase Auth UID — mismatch report ===')
  console.log(`Total student docs:        ${totalStudents}`)
  console.log(`docId === uid (match):     ${matchCount}`)
  console.log(`docId !== uid (mismatch):  ${mismatchCount}`)
  console.log(`No resolvable UID:         ${unresolvedCount}`)
  console.log('')
  console.log(`Resolved via stored uid field:   ${resolvedViaField}`)
  console.log(`Resolved via Auth email lookup:  ${resolvedViaEmail}`)

  if (mismatches.length > 0) {
    console.log('')
    console.log('--- Mismatching students (name | docId | resolved uid | resolved via) ---')
    for (const m of mismatches) {
      console.log(`${m.name} | ${m.docId} | ${m.uid} | ${m.source}`)
    }
  }

  if (unresolved.length > 0) {
    console.log('')
    console.log('--- No resolvable UID (name | docId) ---')
    for (const u of unresolved) {
      console.log(`${u.name} | ${u.docId}`)
    }
  }

  process.exit(0)
}

main().catch((err) => {
  console.error('Report failed:', err)
  process.exit(1)
})
