import { initializeApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
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

try {
  const { user } = await signInWithEmailAndPassword(
    auth,
    'admin@epiccampus.lk',
    'EpicAdmin2026!'
  )

  await setDoc(doc(db, 'users', user.uid), {
    uid: user.uid,
    email: 'admin@epiccampus.lk',
    displayName: 'Ishara Wewalwala',
    role: 'admin',
    branchId: 'galle-main',
    createdAt: new Date().toISOString(),
  })

  console.log('✅ Admin Firestore doc created')
  console.log('🆔 UID:', user.uid)
  console.log('📧 Email: admin@epiccampus.lk')
  console.log('🔑 Password: EpicAdmin2026!')
  process.exit(0)
} catch (err) {
  console.error('❌ Error:', err.message)
  process.exit(1)
}
