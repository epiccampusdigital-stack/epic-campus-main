// One-time stopgap — sets accountActivationOverride: true on the 2 student docs
// whose batchId contains a "/" and therefore could not get a batchSettings doc
// (Firestore forbids "/" in document IDs). Does NOT touch batchId or batchSettings.
//
// Run: node --env-file=.env.local scripts/set-activation-override-slash-batches.mjs

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

const TARGET_BATCH_IDS = ['2026/may', '28 badge /2026']

async function main() {
  const db = getFirestore(buildAdminApp())
  const studentsSnap = await db.collection('students').get()

  const targets = studentsSnap.docs.filter((doc) => TARGET_BATCH_IDS.includes(doc.data().batchId))

  console.log(`Found ${targets.length} student doc(s) matching target batchIds: ${JSON.stringify(TARGET_BATCH_IDS)}`)

  for (const batchId of TARGET_BATCH_IDS) {
    const matches = targets.filter((doc) => doc.data().batchId === batchId)
    if (matches.length !== 1) {
      console.log(`  WARNING: expected exactly 1 student for batchId "${batchId}", found ${matches.length}`)
    }
  }
  console.log('')

  for (const doc of targets) {
    const data = doc.data()
    await doc.ref.update({ accountActivationOverride: true })
    console.log(`WROTE accountActivationOverride: true  ->  students/${doc.id}  (name: ${data.name ?? '(no name)'}, batchId: "${data.batchId}")`)
  }

  console.log('')
  console.log(`Total written: ${targets.length}`)

  process.exit(0)
}

main().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})
