export async function sendPortalNotification(payload: {
  type: 'payment' | 'exam' | 'visa' | 'enrollment'
  phone: string
  name: string
  data?: Record<string, string>
}) {
  try {
    await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch (err) {
    console.error('[sendPortalNotification]', err)
  }
}
