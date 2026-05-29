import { initializeApp, getApps, cert, type ServiceAccount } from 'firebase-admin/app'
import { getFirestore }                                      from 'firebase-admin/firestore'
import { getAuth }                                             from 'firebase-admin/auth'

function getServiceAccount(): ServiceAccount {
  const projectId = process.env.FB_PROJECT_ID
  const clientEmail = process.env.FB_CLIENT_EMAIL
  const privateKey = process.env.FB_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Missing Firebase Admin credentials. Set FB_PROJECT_ID, FB_CLIENT_EMAIL, and FB_PRIVATE_KEY.',
    )
  }

  return { projectId, clientEmail, privateKey }
}

if (!getApps().length) {
  initializeApp({ credential: cert(getServiceAccount()) })
}

export const adminDb   = getFirestore()
export const adminAuth = getAuth()
