import { initializeApp, getApps, cert, App } from 'firebase-admin/app'
import { getAuth, Auth } from 'firebase-admin/auth'
import { getFirestore, Firestore } from 'firebase-admin/firestore'

export const dynamic = 'force-dynamic'

// Lazy factory — only runs when first property is accessed (at request time, not build time)
function buildAdminApp(): App {
  if (getApps().length > 0) return getApps()[0]

  const projectId = process.env.FB_PROJECT_ID
  const clientEmail = process.env.FB_CLIENT_EMAIL
  const privateKey = process.env.FB_PRIVATE_KEY
    ?.replace(/\\n/g, '\n')
    ?.replace(/^["']|["']$/g, '')

  if (!projectId || !clientEmail || !privateKey) {
    console.error('Missing Firebase Admin env vars:', {
      hasProjectId: !!projectId,
      hasClientEmail: !!clientEmail,
      hasPrivateKey: !!privateKey,
    })
    throw new Error('Firebase Admin credentials missing')
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  })
}

// Creates a Proxy that defers initialization until the first property access.
// This prevents module-level code from running at Next.js build time.
function createLazy<T extends object>(factory: () => T): T {
  let instance: T | undefined
  return new Proxy({} as T, {
    get(_target, prop, _receiver) {
      if (!instance) instance = factory()
      const val = Reflect.get(instance as object, prop)
      if (typeof val === 'function') return (val as (...args: unknown[]) => unknown).bind(instance)
      return val
    },
    set(_target, prop, value) {
      if (!instance) instance = factory()
      return Reflect.set(instance as object, prop, value)
    },
  })
}

export const adminApp  = createLazy<App>(() => buildAdminApp())
export const adminAuth = createLazy<Auth>(() => getAuth(buildAdminApp()))
export const adminDb   = createLazy<Firestore>(() => getFirestore(buildAdminApp()))
