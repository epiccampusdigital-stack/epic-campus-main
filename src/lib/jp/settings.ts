import { adminDb } from '@/lib/firebase/admin'
import type { JpSettings } from '@/types'

// Admin-SDK only — jpSettings/{docId} write access under firestore.rules is
// admin/owner only, so writes are always staff-triggered via an API route.
// Reads are allowed for any signed-in user under those rules, but this
// module is only imported from server code (API routes); the checkout page
// reads settings through one of those routes rather than the client SDK.

const SETTINGS_DOC_ID = 'config'

const DEFAULT_SETTINGS: JpSettings = {
  postageFlatLKR: 0,
  bankName: '',
  bankAccountName: '',
  bankAccountNumber: '',
  bankBranch: '',
  dispatchPromiseText: 'Study pack posted within one week',
  refundPolicyText: '',
  updatedAt: new Date(0).toISOString(),
}

function settingsRef() {
  return adminDb.collection('jpSettings').doc(SETTINGS_DOC_ID)
}

export async function getJpSettings(): Promise<JpSettings> {
  const snap = await settingsRef().get()
  if (!snap.exists) return DEFAULT_SETTINGS
  const data = snap.data() as Record<string, unknown>
  return {
    postageFlatLKR: Number(data.postageFlatLKR ?? DEFAULT_SETTINGS.postageFlatLKR),
    bankName: String(data.bankName ?? DEFAULT_SETTINGS.bankName),
    bankAccountName: String(data.bankAccountName ?? DEFAULT_SETTINGS.bankAccountName),
    bankAccountNumber: String(data.bankAccountNumber ?? DEFAULT_SETTINGS.bankAccountNumber),
    bankBranch: String(data.bankBranch ?? DEFAULT_SETTINGS.bankBranch),
    dispatchPromiseText: String(data.dispatchPromiseText ?? DEFAULT_SETTINGS.dispatchPromiseText),
    refundPolicyText: String(data.refundPolicyText ?? DEFAULT_SETTINGS.refundPolicyText),
    updatedAt: String(data.updatedAt ?? DEFAULT_SETTINGS.updatedAt),
  }
}

export async function updateJpSettings(partial: Partial<Omit<JpSettings, 'updatedAt'>>): Promise<JpSettings> {
  const current = await getJpSettings()
  const updated: JpSettings = { ...current, ...partial, updatedAt: new Date().toISOString() }
  await settingsRef().set(updated, { merge: true })
  return updated
}
