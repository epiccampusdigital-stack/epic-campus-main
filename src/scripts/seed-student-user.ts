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

async function seedStudentUser() {
  const auth = getAuth()
  const db = getFirestore()

  const email = 'student@epiccampus.lk'
  const password = 'Student@2026'
  const displayName = 'Demo Student'
  const year = new Date().getFullYear()

  try {
    let uid: string

    try {
      const existing = await auth.getUserByEmail(email)
      uid = existing.uid
      await auth.updateUser(uid, { password, displayName, emailVerified: true })
      console.log('Updated existing auth user:', uid)
    } catch {
      const user = await auth.createUser({
        email,
        password,
        displayName,
        emailVerified: true,
      })
      uid = user.uid
      console.log('Created auth user:', uid)
    }

    await auth.setCustomUserClaims(uid, { role: 'student' })
    console.log('Set role claim: student')

    const studentDocId = uid
    const studentCode = `EC-${year}-${uid.slice(0, 4).toUpperCase()}`

    await db.collection('users').doc(uid).set(
      {
        uid,
        email,
        displayName,
        name: displayName,
        role: 'student',
        studentId: studentDocId,
        branchId: 'galle-main',
        status: 'active',
        createdAt: new Date().toISOString(),
      },
      { merge: true },
    )
    console.log('Upserted users doc')

    await db.collection('students').doc(studentDocId).set(
      {
        uid,
        email,
        name: displayName,
        studentCode,
        mobile: '0771234567',
        courseId: 'japan-ssw',
        batchId: 'batch-demo-01',
        branchId: 'galle-main',
        location: 'ahangama',
        status: 'active',
        paymentStatus: 'pending',
        visaStatus: 'not-started',
        feeCurrency: 'LKR',
        enrollmentDate: new Date().toISOString().slice(0, 10),
        createdAt: new Date().toISOString(),
        createdBy: 'seed-script',
      },
      { merge: true },
    )
    console.log('Upserted students doc')

    console.log('---')
    console.log('Student account ready!')
    console.log('Email:', email)
    console.log('Password:', password)
    console.log('UID / student doc id:', uid)
    console.log('Student code:', studentCode)
    console.log('---')
  } catch (error) {
    console.error('Error seeding student user:', error)
    process.exit(1)
  }

  process.exit(0)
}

void seedStudentUser()
