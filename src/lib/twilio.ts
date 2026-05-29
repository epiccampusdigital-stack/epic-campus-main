import twilio from 'twilio'

const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const from = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886'

export async function sendWhatsApp(to: string, message: string): Promise<boolean> {
  if (!accountSid || !authToken || accountSid.startsWith('ACxxxx')) {
    console.log('[Twilio] Not configured — skipping WhatsApp send')
    return false
  }
  try {
    const client = twilio(accountSid, authToken)
    const normalized = to.replace(/\s+/g, '').replace(/^\+/, '')
    await client.messages.create({
      from,
      to: `whatsapp:+${normalized.replace(/^whatsapp:/, '')}`,
      body: message,
    })
    console.log(`[Twilio] WhatsApp sent to ${to}`)
    return true
  } catch (err) {
    console.error('[Twilio] Failed to send WhatsApp:', err)
    return false
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
