import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

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
)?.replace(/\\n/g, '\n')

if (!projectId || !clientEmail || !privateKey) {
  console.error('Missing Firebase Admin credentials in environment')
  process.exit(1)
}

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  })
}

async function seedKitchenUser() {
  const auth = getAuth()
  const db = getFirestore()

  const email = 'kitchen@epiccampus.lk'
  const password = 'Kitchen@2026'
  const displayName = 'Kitchen Staff'

  try {
    try {
      const existing = await auth.getUserByEmail(email)
      await auth.deleteUser(existing.uid)
      await db.collection('users').doc(existing.uid).delete().catch(() => {})
      console.log('Deleted existing kitchen user')
    } catch {
      // User doesn't exist yet
    }

    const user = await auth.createUser({
      email,
      password,
      displayName,
      emailVerified: true,
    })

    console.log('Created auth user:', user.uid)

    await auth.setCustomUserClaims(user.uid, { role: 'kitchen' })
    console.log('Set role claim: kitchen')

    await db.collection('users').doc(user.uid).set({
      uid: user.uid,
      email,
      displayName,
      name: displayName,
      role: 'kitchen',
      status: 'active',
      locationAssigned: 'ahangama',
      branchId: 'galle-main',
      createdAt: new Date().toISOString(),
      isStaff: true,
    })

    console.log('Created Firestore user document')
    console.log('---')
    console.log('Kitchen staff account created successfully!')
    console.log('Email:', email)
    console.log('Password:', password)
    console.log('Role: kitchen')
    console.log('---')
  } catch (error) {
    console.error('Error seeding kitchen user:', error)
    process.exit(1)
  }

  process.exit(0)
}

void seedKitchenUser()
