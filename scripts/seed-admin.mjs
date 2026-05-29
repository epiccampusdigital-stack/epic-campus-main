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

const ADMIN_EMAIL = 'admin@epiccampus.lk'
const ADMIN_PASSWORD = 'EpicAdmin2026!'

try {
  const { user } = await createUserWithEmailAndPassword(
    auth, ADMIN_EMAIL, ADMIN_PASSWORD
  )
  
  await setDoc(doc(db, 'users', user.uid), {
    uid: user.uid,
    email: ADMIN_EMAIL,
    displayName: 'Ishara Wewalwala',
    role: 'admin',
    branchId: 'galle-main',
    createdAt: new Date().toISOString(),
  })
  
  console.log('✅ Admin created:', ADMIN_EMAIL)
  console.log('🔑 Password:', ADMIN_PASSWORD)
  console.log('🆔 UID:', user.uid)
  process.exit(0)
} catch (err) {
  console.error('❌ Error:', err.message)
  process.exit(1)
}
