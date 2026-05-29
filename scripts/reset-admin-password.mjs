import { initializeApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'

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

const passwords = [
  'EpicAdmin2026!',
  'admin123',
  'Admin123!',
  'Epic2026!',
]

for (const pwd of passwords) {
  try {
    const { user } = await signInWithEmailAndPassword(
      auth, 'admin@epiccampus.lk', pwd
    )
    console.log('✅ Correct password:', pwd)
    console.log('🆔 UID:', user.uid)
    process.exit(0)
  } catch {
    console.log('❌ Wrong:', pwd)
  }
}

console.log('No password matched')
process.exit(1)
