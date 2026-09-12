// One-time backfill — creates batchSettings/{batchId} docs so existing students
// aren't locked out by the Account Activation default-false rule.
//
// Read-only dry-run by default. Pass --execute to actually write.
//
// Run (dry-run): node --env-file=.env.local scripts/backfill-batch-activation.mjs
// Run (write):   node --env-file=.env.local scripts/backfill-batch-activation.mjs --execute

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

// Firestore document ID constraints (see Firestore docs "Document IDs"):
// no "/" (path separator), not "." or "..", must not match __.*__, <=1500 bytes.
// "\\" is not actually special to Firestore, but a batchId containing it is
// almost certainly a data-entry mistake, so we flag it too rather than write it.
function getInvalidDocIdReason(id) {
  if (typeof id !== 'string' || id.length === 0) return 'empty or non-string batchId'
  if (/[/\\]/.test(id)) return 'contains "/" or "\\" (not allowed in a Firestore document ID)'
  if (id === '.' || id === '..') return 'document ID cannot be "." or ".."'
  if (/^__.*__$/.test(id)) return 'document ID cannot match the reserved pattern __.*__'
  if (Buffer.byteLength(id, 'utf8') > 1500) return 'document ID exceeds 1500 bytes'
  return null
}

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

async function main() {
  const args = process.argv.slice(2)
  const execute = args.includes('--execute')
  const dryRun = !execute

  const db = getFirestore(buildAdminApp())

  const [studentsSnap, batchSettingsSnap] = await Promise.all([
    db.collection('students').get(),
    db.collection('batchSettings').get(),
  ])

  const existingBatchSettingsIds = new Set(batchSettingsSnap.docs.map((d) => d.id))

  const batchIds = new Set()
  for (const doc of studentsSnap.docs) {
    const batchId = doc.data().batchId
    if (batchId) batchIds.add(batchId)
  }

  const sortedBatchIds = [...batchIds].sort()
  const missingSettings = sortedBatchIds.filter((id) => !existingBatchSettingsIds.has(id))
  const toSkip = sortedBatchIds.filter((id) => existingBatchSettingsIds.has(id))

  const toCreate = []
  const invalidSkip = []
  for (const id of missingSettings) {
    const reason = getInvalidDocIdReason(id)
    if (reason) invalidSkip.push({ id, reason })
    else toCreate.push(id)
  }

  console.log(`=== Batch Activation Backfill — ${dryRun ? 'DRY RUN (no writes)' : 'EXECUTE (writing)'} ===`)
  console.log(`Total student docs:              ${studentsSnap.size}`)
  console.log(`Distinct batchIds among students: ${sortedBatchIds.length}`)
  console.log(`Existing batchSettings docs:      ${batchSettingsSnap.size}`)
  console.log('')

  if (toSkip.length > 0) {
    console.log(`Skipping ${toSkip.length} batchId(s) that already have a batchSettings doc:`)
    for (const id of toSkip) console.log(`  - SKIP  ${id}`)
    console.log('')
  }

  if (invalidSkip.length > 0) {
    console.log(`Skipping ${invalidSkip.length} batchId(s) with an invalid Firestore document ID (not written, not normalized):`)
    for (const { id, reason } of invalidSkip) console.log(`  - SKIPPED-INVALID  ${JSON.stringify(id)}  ->  ${reason}`)
    console.log('')
  }

  console.log(`${dryRun ? 'Would create' : 'Creating'} ${toCreate.length} batchSettings doc(s):`)
  const nowIso = new Date().toISOString()

  if (dryRun) {
    for (const id of toCreate) {
      console.log(`  - WRITE batchSettings/${id}  ->  { batchId: '${id}', accountActivated: true, updatedAt: '${nowIso}', updatedBy: 'system-backfill' }`)
    }
  } else {
    let written = 0
    const failed = []
    for (const id of toCreate) {
      try {
        await db.collection('batchSettings').doc(id).set({
          batchId: id,
          accountActivated: true,
          updatedAt: nowIso,
          updatedBy: 'system-backfill',
        })
        console.log(`  - WROTE batchSettings/${id}`)
        written++
      } catch (err) {
        console.log(`  - FAILED batchSettings/${id}  ->  ${err.message}`)
        failed.push({ id, message: err.message })
      }
    }
    console.log('')
    console.log(`Total written: ${written}`)
    if (failed.length > 0) {
      console.log(`Total failed:  ${failed.length}`)
      for (const f of failed) console.log(`  - ${f.id}: ${f.message}`)
    }
  }

  console.log('')
  console.log(`${dryRun ? 'Would create' : 'Created'} count: ${toCreate.length}`)
  console.log(`Skipped (already existed) count: ${toSkip.length}`)
  console.log(`Skipped (invalid document ID) count: ${invalidSkip.length}`)

  if (invalidSkip.length > 0) {
    console.log('')
    console.log('=== SKIPPED-INVALID summary (needs manual decision) ===')
    for (const { id, reason } of invalidSkip) console.log(`  - ${JSON.stringify(id)}: ${reason}`)
  }

  if (dryRun) {
    console.log('')
    console.log('No writes were made. Re-run with --execute to apply.')
  }

  process.exit(0)
}

main().catch((err) => {
  console.error('Backfill failed:', err)
  process.exit(1)
})
