const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID ?? ''
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN ?? ''
const TWILIO_FROM = process.env.TWILIO_WHATSAPP_FROM ?? 'whatsapp:+14155238886'

export async function sendWhatsApp(to: string, message: string): Promise<boolean> {
  if (!TWILIO_SID || !TWILIO_TOKEN || TWILIO_SID.includes('xxx')) {
    console.warn('[Twilio] Credentials not configured — skipping WhatsApp')
    return false
  }
  try {
    const toNum = to.startsWith('whatsapp:') ? to : `whatsapp:${to.startsWith('+') ? to : '+' + to}`
    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`
    const body = new URLSearchParams({
      From: TWILIO_FROM,
      To: toNum,
      Body: message,
    })
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    })
    const data = await res.json() as { sid?: string; error_message?: string }
    if (data.sid) {
      console.log('[Twilio] Message sent:', data.sid)
      return true
    } else {
      console.error('[Twilio] Failed:', data.error_message)
      return false
    }
  } catch (err) {
    console.error('[Twilio] Error:', err)
    return false
  }
}

export async function sendOTP(to: string, otp: string): Promise<boolean> {
  const message = `Your EPIC Campus verification code is: *${otp}*\n\nThis code expires in 10 minutes. Do not share it with anyone.`
  return sendWhatsApp(to, message)
}

export function generateOTP(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export async function sendPaymentConfirmation(
  to: string,
  studentName: string,
  amount: number,
  installmentNo: number
): Promise<boolean> {
  const message = `✅ *Payment Confirmed — EPIC Campus*\n\nHi ${studentName},\n\nYour payment of *LKR ${amount.toLocaleString()}* for Installment ${installmentNo} has been verified and confirmed.\n\nThank you! 🎓\n_EPIC Campus_`
  return sendWhatsApp(to, message)
}

export async function sendExamReminder(
  to: string,
  studentName: string,
  examTitle: string,
  examDate: string,
  examTime: string
): Promise<boolean> {
  const message = `📝 *Exam Reminder — EPIC Campus*\n\nHi ${studentName},\n\nThis is a reminder that you have an exam tomorrow:\n\n*${examTitle}*\n📅 ${examDate}\n⏰ ${examTime}\n\nPlease be prepared and on time. Good luck! 💪\n_EPIC Campus_`
  return sendWhatsApp(to, message)
}

export async function sendCertificateIssued(
  to: string,
  studentName: string,
  courseName: string,
  certNumber: string
): Promise<boolean> {
  const message = `🎓 *Certificate Issued — EPIC Campus*\n\nCongratulations ${studentName}! 🎉\n\nYour certificate for *${courseName}* has been issued.\n\n🔍 Verify your certificate:\nhttps://www.epiccampus.live/verify/${certNumber}\n\nCertificate No: *${certNumber}*\n\nWell done! 🏆\n_EPIC Campus_`
  return sendWhatsApp(to, message)
}

export async function send2FACode(
  to: string,
  name: string,
  code: string
): Promise<boolean> {
  const message = `🔐 *EPIC Campus Login Code*\n\nHi ${name},\n\nYour login verification code is:\n\n*${code}*\n\nThis code expires in 5 minutes.\nIf you didn't request this, please contact admin immediately.\n_EPIC Campus_`
  return sendWhatsApp(to, message)
}
