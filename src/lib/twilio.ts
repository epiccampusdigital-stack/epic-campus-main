import twilio from 'twilio'

const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const from = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886'

export function normalizeWhatsAppNumber(phone: string): string {
  let digits = phone.replace(/\s+/g, '').replace(/^whatsapp:/i, '')
  if (digits.startsWith('+')) digits = digits.slice(1)
  if (digits.startsWith('0')) digits = `94${digits.slice(1)}`
  if (!digits.startsWith('94') && digits.length === 9) digits = `94${digits}`
  return digits
}

export async function sendWhatsApp(
  to: string,
  message: string,
  mediaUrl?: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!accountSid || !authToken || accountSid.startsWith('ACxxxx')) {
    console.log('[Twilio] Not configured — skipping WhatsApp send')
    return { ok: false, error: 'Twilio not configured' }
  }
  try {
    const client = twilio(accountSid, authToken)
    const normalized = normalizeWhatsAppNumber(to)
    const payload: {
      from: string
      to: string
      body: string
      mediaUrl?: string[]
    } = {
      from,
      to: `whatsapp:+${normalized}`,
      body: message,
    }
    if (mediaUrl) {
      payload.mediaUrl = [mediaUrl]
    }
    await client.messages.create(payload)
    console.log(`[Twilio] WhatsApp sent to ${to}`)
    return { ok: true }
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Send failed'
    console.error('[Twilio] Failed to send WhatsApp:', err)
    return { ok: false, error }
  }
}

export const MESSAGES = {
  paymentReceived: (name: string, amount: string) =>
    `Hi ${name}, EPIC Campus has received your payment of ${amount}. Thank you! For queries: info@epiccampus.lk`,

  examResult: (name: string, paper: string, score: string) =>
    `Hi ${name}, your ${paper} exam result is ready on the EPIC Campus portal. Score: ${score}. Log in at epiccampus.live`,

  visaUpdate: (name: string, status: string) =>
    `Hi ${name}, your visa application status has been updated to: ${status}. Log in to your EPIC Campus portal for details.`,

  enrollmentConfirmed: (name: string, program: string) =>
    `Welcome to EPIC Campus, ${name}! Your enrollment in ${program} is confirmed. We will be in touch shortly. Info: info@epiccampus.lk`,
}
