// Read-only report — NOT a migration. Writes nothing.
//
// Counts student docs and projects how many would resolve to INACTIVE under
// the planned Account Activation resolution rule:
//   if student.accountActivationOverride !== null/undefined -> use it (true/false)
//   else if batchSettings/{batchId} doc exists               -> use its accountActivated
//   else                                                      -> FALSE (default)
//
// Run: node --env-file=.env.local scripts/report-account-activation.mjs

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

async function main() {
  const db = getFirestore(buildAdminApp())

  const [studentsSnap, batchSettingsSnap] = await Promise.all([
    db.collection('students').get(),
    db.collection('batchSettings').get(),
  ])

  const batchSettingsById = new Map()
  for (const doc of batchSettingsSnap.docs) {
    batchSettingsById.set(doc.id, doc.data())
  }

  let totalStudents = studentsSnap.size
  let overrideTrue = 0
  let overrideFalse = 0
  let inheritedFromBatch = 0
  let inheritedActive = 0
  let inheritedInactive = 0
  let defaultedInactive = 0 // no override, no batchSettings doc at all
  const batchIdsSeen = new Set()
  const batchIdsMissingSettings = new Set()

  for (const doc of studentsSnap.docs) {
    const data = doc.data()
    const override = data.accountActivationOverride
    const batchId = data.batchId
    if (batchId) batchIdsSeen.add(batchId)

    if (override === true) {
      overrideTrue++
      continue
    }
    if (override === false) {
      overrideFalse++
      continue
    }

    // override is null/undefined -> inherit from batchSettings/{batchId}
    const settings = batchId ? batchSettingsById.get(batchId) : undefined
    if (settings) {
      inheritedFromBatch++
      if (settings.accountActivated === true) inheritedActive++
      else inheritedInactive++
    } else {
      defaultedInactive++
      if (batchId) batchIdsMissingSettings.add(batchId)
    }
  }

  const totalInactive = overrideFalse + inheritedInactive + defaultedInactive
  const totalActive = overrideTrue + inheritedActive

  console.log('=== Account Activation — projected resolution report ===')
  console.log(`Total student docs:              ${totalStudents}`)
  console.log(`batchSettings docs found:         ${batchSettingsSnap.size}`)
  console.log(`Distinct batchIds among students: ${batchIdsSeen.size}`)
  console.log('')
  console.log(`  override=true  (force ACTIVE):   ${overrideTrue}`)
  console.log(`  override=false (force INACTIVE): ${overrideFalse}`)
  console.log(`  inherited from batchSettings:    ${inheritedFromBatch} (active: ${inheritedActive}, inactive: ${inheritedInactive})`)
  console.log(`  no override + no batchSettings doc -> defaulted INACTIVE: ${defaultedInactive}`)
  console.log('')
  console.log(`RESOLVES TO ACTIVE on deploy:   ${totalActive}`)
  console.log(`RESOLVES TO INACTIVE on deploy: ${totalInactive}`)
  console.log('')
  console.log(`batchIds with no matching batchSettings doc: ${batchIdsMissingSettings.size}`)

  process.exit(0)
}

main().catch((err) => {
  console.error('Report failed:', err)
  process.exit(1)
})
