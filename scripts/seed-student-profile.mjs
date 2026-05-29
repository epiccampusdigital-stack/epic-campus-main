import { initializeApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import { getFirestore, doc, setDoc, collection, getDocs, query, where } from 'firebase/firestore'

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

// Sign in as student
const { user } = await signInWithEmailAndPassword(
  auth, 'student@epiccampus.lk', 'EpicStudent2026!'
)

// Create student profile document
await setDoc(doc(db, 'students', user.uid), {
  uid: user.uid,
  studentCode: 'EC-2026-002',
  displayName: 'Senal Yathnake',
  email: 'student@epiccampus.lk',
  phone: '+94771234567',
  courseId: 'japan-ssw',
  courseName: 'Japan SSW (Japanese Language)',
  batchName: 'Batch 31',
  status: 'active',
  visaStatus: 'not-started',
  paymentStatus: 'pending',
  enrollmentDate: new Date().toISOString(),
  branchId: 'galle-main',
  createdAt: new Date().toISOString(),
})

console.log('✅ Student profile created')
console.log('🆔 UID:', user.uid)
console.log('📧 Email: student@epiccampus.lk')
console.log('📚 Course: japan-ssw')
process.exit(0)
