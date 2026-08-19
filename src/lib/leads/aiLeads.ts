/**
 * Shared types and helpers for AI-handled leads.
 *
 * Client-safe: this module must not import server-only packages (twilio,
 * firebase-admin) because the Owner/Admin leads page bundles it.
 */

export type AiLeadStatus =
  | 'new'
  | 'qualifying'
  | 'ready_for_payment'
  | 'payment_sent'
  | 'paid'
  | 'lost'

export const AI_LEAD_STATUSES: AiLeadStatus[] = [
  'new',
  'qualifying',
  'ready_for_payment',
  'payment_sent',
  'paid',
  'lost',
]

export const AI_LEAD_STATUS_LABELS: Record<AiLeadStatus, string> = {
  new: 'New',
  qualifying: 'Qualifying',
  ready_for_payment: 'Ready for Payment',
  payment_sent: 'Payment Sent',
  paid: 'Paid',
  lost: 'Lost',
}

/** Badge classes, matching the palette used by the CRM lead table. */
export const AI_LEAD_STATUS_COLORS: Record<AiLeadStatus, string> = {
  new: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800',
  qualifying:
    'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-800',
  ready_for_payment:
    'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-800',
  payment_sent:
    'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-800',
  paid: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800',
  lost: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800',
}

export function isAiLeadStatus(value: unknown): value is AiLeadStatus {
  return AI_LEAD_STATUSES.includes(value as AiLeadStatus)
}

/** How promising the lead looks. Re-assessed by the AI on every turn. */
export type LeadScore = 'hot' | 'warm' | 'cold'

export const LEAD_SCORES: LeadScore[] = ['hot', 'warm', 'cold']

export const LEAD_SCORE_LABELS: Record<LeadScore, string> = {
  hot: 'Hot',
  warm: 'Warm',
  cold: 'Cold',
}

export const LEAD_SCORE_COLORS: Record<LeadScore, string> = {
  hot: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800',
  warm: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800',
  cold: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-white/10 dark:text-white/60 dark:border-white/10',
}

export function isLeadScore(value: unknown): value is LeadScore {
  return LEAD_SCORES.includes(value as LeadScore)
}

/**
 * Sort weight for the work queue — hot first. Leads with no score yet (created
 * before the AI has replied) sort below cold rather than above hot.
 */
export function leadScoreRank(score: LeadScore | null): number {
  if (!score) return LEAD_SCORES.length
  return LEAD_SCORES.indexOf(score)
}

export type MessageSender = 'ai' | 'human' | 'lead'
export type MessageDirection = 'inbound' | 'outbound'

export interface LeadMessage {
  id: string
  channel: 'whatsapp'
  direction: MessageDirection
  text: string
  sender: MessageSender
  timestamp: string
}

export interface AiLead {
  id: string
  phone: string
  name: string
  programInterest: string
  qualificationAnswers: Record<string, string>
  status: AiLeadStatus
  /** null until the AI has taken a turn on this lead. */
  leadScore: LeadScore | null
  channels: string[]
  aiPaused: boolean
  /**
   * How many automated follow-ups have been sent to a lead who went quiet.
   * Absent on leads created before re-engagement existed — treat as 0.
   */
  reengagementCount?: number
  createdAt: string
  lastMessageAt: string
  updatedAt: string
}

/**
 * Deterministic document id for a lead, derived from its normalized phone.
 * `digits` must already be normalized (see normalizeWhatsAppNumber in
 * @/lib/twilio) — e.g. '94771234567' produces 'wa-94771234567'.
 *
 * The prefix keeps AI leads distinguishable from the auto-id lead docs the CRM
 * contact form already writes into this same collection.
 */
export function leadIdFromNormalizedPhone(digits: string): string {
  return `wa-${digits}`
}

/**
 * True for leads owned by the AI agent rather than the traditional CRM.
 *
 * Keyed on the document id, not `source`: 'whatsapp' is a source staff can pick
 * by hand in the CRM lead form, so it would also match legitimate CRM leads.
 * Firestore auto-ids are 20 alphanumeric characters with no hyphen, so the
 * 'wa-' prefix cannot collide with a CRM-created lead.
 */
export function isAiManagedLeadId(id: string): boolean {
  return id.startsWith('wa-')
}

/** LKR registration/application fee, matching the enrollment checkout flow. */
export const REGISTRATION_FEE_LKR = 25_000
