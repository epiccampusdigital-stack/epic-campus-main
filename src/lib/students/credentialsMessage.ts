// Shared helpers for sending student login credentials over WhatsApp.
// Used by /api/students/send-credentials and /api/students/reset-and-send.

/** Normalizes a Sri Lankan phone number to +94 E.164 form.
 *  0xxxxxxxxx -> +94xxxxxxxxx ; 94xxxxxxxxx -> +94xxxxxxxxx ; +94... -> unchanged. */
export function normalizeLkPhone(raw: string): string {
  const cleaned = (raw ?? '').replace(/[^\d+]/g, '')
  if (!cleaned) return ''
  if (cleaned.startsWith('+94')) return cleaned
  if (cleaned.startsWith('94')) return `+${cleaned}`
  if (cleaned.startsWith('0')) return `+94${cleaned.slice(1)}`
  if (cleaned.startsWith('+')) return cleaned
  return `+94${cleaned}`
}

export interface CredentialsMessageInput {
  studentName: string
  email: string
  password: string
  studentCode: string
}

export function buildCredentialsMessage(input: CredentialsMessageInput): string {
  const { studentName, email, password, studentCode } = input
  return (
    `🎓 Welcome to EPIC Campus!\n\n` +
    `Dear ${studentName},\n\n` +
    `Your student portal account is ready. Here are your login details:\n\n` +
    `🌐 Portal: epiccampus.live\n` +
    `📧 Email: ${email}\n` +
    `🔑 Password: ${password}\n` +
    `🪪 Student Code: ${studentCode}\n\n` +
    `Please login and change your password after first login.\n\n` +
    `For support: +94 91 222 83 83\n` +
    `EPIC Campus — We Create Your Future`
  )
}
