import { initializeApp } from 'firebase/app'
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth'
import { getFirestore, doc, setDoc } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)
const auth = getAuth(app)
const db = getFirestore(app)

const USERS = [
  {
    email: 'reception@epiccampus.lk',
    password: 'EpicRecept2026!',
    displayName: 'Reception Staff',
    role: 'reception',
  },
  {
    email: 'teacher@epiccampus.lk',
    password: 'EpicTeach2026!',
    displayName: 'Demo Teacher',
    role: 'teacher',
  },
  {
    email: 'accounts@epiccampus.lk',
    password: 'EpicAcct2026!',
    displayName: 'Accountant',
    role: 'accountant',
  },
  {
    email: 'student@epiccampus.lk',
    password: 'EpicStudent2026!',
    displayName: 'Senal Yathnake',
    role: 'student',
  },
  {
    email: 'kitchen@epiccampus.lk',
    password: 'Kitchen@2026',
    displayName: 'Kitchen Staff',
    role: 'kitchen',
  },
]

for (const user of USERS) {
  try {
    const { user: created } = await createUserWithEmailAndPassword(
      auth,
      user.email,
      user.password,
    )

    await setDoc(doc(db, 'users', created.uid), {
      uid: created.uid,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      branchId: 'galle-main',
      status: 'active',
      createdAt: new Date().toISOString(),
    })

    console.log('✅ Created:', user.email, '| UID:', created.uid)
  } catch (err) {
    if (err.message.includes('email-already-in-use')) {
      console.log('⚠️ Already exists:', user.email)
    } else {
      console.error('❌ Failed:', user.email, err.message)
    }
  }
}

console.log('\n📋 All accounts:')
console.log('Admin:      admin@epiccampus.lk / EpicAdmin2026!')
console.log('Reception:  reception@epiccampus.lk / EpicRecept2026!')
console.log('Teacher:    teacher@epiccampus.lk / EpicTeach2026!')
console.log('Accountant: accounts@epiccampus.lk / EpicAcct2026!')
console.log('Student:    student@epiccampus.lk / EpicStudent2026!')
console.log('Kitchen:    kitchen@epiccampus.lk / Kitchen@2026')
process.exit(0)
