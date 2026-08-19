'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { collection, getDocs, orderBy, query } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase/client'
import { useManagement } from '@/components/layout/ManagementContext'
import {
  AI_LEAD_STATUS_COLORS,
  AI_LEAD_STATUS_LABELS,
  isAiLeadStatus,
  isLeadScore,
  LEAD_SCORE_COLORS,
  LEAD_SCORE_LABELS,
  leadScoreRank,
  REGISTRATION_FEE_LKR,
  type AiLead,
  type AiLeadStatus,
  type LeadMessage,
  type MessageSender,
} from '@/lib/leads/aiLeads'

function toIso(value: unknown): string {
  if (!value) return ''
  const ts = value as { toDate?: () => Date }
  if (typeof ts.toDate === 'function') return ts.toDate().toISOString()
  if (typeof value === 'string') return value
  return ''
}

function formatWhen(iso: string): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const SENDER_LABELS: Record<MessageSender, string> = {
  ai: 'AI',
  human: 'Staff',
  lead: 'Lead',
}

export default function AiLeadsPage() {
  const router = useRouter()
  const { user, loading: authLoading, hasRole } = useManagement()

  const [leads, setLeads] = useState<AiLead[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<AiLead | null>(null)
  const [messages, setMessages] = useState<LeadMessage[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!user) return
    if (!(hasRole('admin') || hasRole('owner'))) {
      router.replace('/dashboard')
    }
  }, [user, authLoading, router, hasRole])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const snap = await getDocs(query(collection(db, 'leads'), orderBy('lastMessageAt', 'desc')))
      const rows: AiLead[] = snap.docs.map((d) => {
        const data = d.data()
        const status = data.status
        const score = data.leadScore
        return {
          id: d.id,
          phone: String(data.phone ?? ''),
          name: String(data.name ?? ''),
          programInterest: String(data.programInterest ?? data.program ?? ''),
          qualificationAnswers: (data.qualificationAnswers ?? {}) as Record<string, string>,
          status: isAiLeadStatus(status) ? status : ('new' as AiLeadStatus),
          leadScore: isLeadScore(score) ? score : null,
          channels: Array.isArray(data.channels) ? data.channels.map(String) : [],
          aiPaused: data.aiPaused === true,
          createdAt: toIso(data.createdAt),
          lastMessageAt: toIso(data.lastMessageAt),
          updatedAt: toIso(data.updatedAt),
        }
      })

      // Work-queue order: hottest first, then most recently active.
      rows.sort((a, b) => {
        const byScore = leadScoreRank(a.leadScore) - leadScoreRank(b.leadScore)
        if (byScore !== 0) return byScore
        return b.lastMessageAt.localeCompare(a.lastMessageAt)
      })

      setLeads(rows)
    } catch (err) {
      console.error('[AiLeadsPage] load', err)
      toast.error('Could not load leads. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authLoading || !user || !(hasRole('admin') || hasRole('owner'))) return
    void load()
  }, [authLoading, user, hasRole, load])

  const openThread = useCallback(async (lead: AiLead) => {
    setSelected(lead)
    setMessagesLoading(true)
    setMessages([])
    try {
      const snap = await getDocs(
        query(collection(db, 'leads', lead.id, 'messages'), orderBy('timestamp', 'asc')),
      )
      setMessages(
        snap.docs.map((d) => {
          const data = d.data()
          return {
            id: d.id,
            channel: 'whatsapp' as const,
            direction: data.direction === 'outbound' ? 'outbound' : 'inbound',
            text: String(data.text ?? ''),
            sender: (data.sender ?? 'lead') as MessageSender,
            timestamp: toIso(data.timestamp),
          }
        }),
      )
    } catch (err) {
      console.error('[AiLeadsPage] thread', err)
      toast.error('Could not load the conversation.')
    } finally {
      setMessagesLoading(false)
    }
  }, [])

  async function handleSendPaymentLink(lead: AiLead) {
    const confirmed = window.confirm(
      `Send a LKR ${REGISTRATION_FEE_LKR.toLocaleString('en-LK')} registration payment link to ${lead.name || lead.phone} on WhatsApp?`,
    )
    if (!confirmed) return

    setSending(true)
    try {
      const token = await auth.currentUser?.getIdToken()
      const res = await fetch('/api/leads/send-payment-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ leadId: lead.id }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Failed to send')

      toast.success('Payment link sent')
      await load()
      await openThread({ ...lead, status: 'payment_sent' })
    } catch (err) {
      console.error('[AiLeadsPage] send payment link', err)
      toast.error(err instanceof Error ? err.message : 'Could not send the payment link.')
    } finally {
      setSending(false)
    }
  }

  const isAuthorized = user && (hasRole('admin') || hasRole('owner'))
  if (authLoading || !isAuthorized) return null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-jakarta text-2xl font-bold text-[#0D1B2A] dark:text-white">
            AI Leads
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[#5A6A7A] dark:text-white/50">
            WhatsApp conversations handled by the AI agent. Payment links are sent by staff
            only — the AI never sends one.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-[#DDE3EC] dark:border-white/10 px-4 py-2 text-sm font-medium text-[#0B3D6B] dark:text-white/70 hover:bg-[#F5F7FB] dark:hover:bg-white/5 disabled:opacity-60"
        >
          <span className="ti ti-refresh" /> Refresh
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* ── Lead list ── */}
        <div className="overflow-hidden rounded-xl border border-[#DDE3EC] dark:border-white/10 bg-white dark:bg-slate-800">
          {loading ? (
            <div className="animate-pulse divide-y divide-[#DDE3EC] dark:divide-white/10">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="px-4 py-4">
                  <div className="h-3 w-full rounded bg-[#DDE3EC] dark:bg-white/10" />
                </div>
              ))}
            </div>
          ) : leads.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-[#5A6A7A] dark:text-white/40">
              No leads yet. They appear here as soon as someone messages the WhatsApp line.
            </p>
          ) : (
            <ul className="divide-y divide-[#DDE3EC] dark:divide-white/10">
              {leads.map((lead) => (
                <li key={lead.id}>
                  <button
                    type="button"
                    onClick={() => void openThread(lead)}
                    className={`flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-[#F5F7FB] dark:hover:bg-white/5 ${
                      selected?.id === lead.id ? 'bg-[#F5F7FB] dark:bg-white/5' : ''
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-[#0D1B2A] dark:text-white">
                        {lead.name || lead.phone || 'Unknown lead'}
                      </p>
                      <p className="truncate text-xs text-[#5A6A7A] dark:text-white/40">
                        {lead.phone}
                        {lead.programInterest && <> · {lead.programInterest}</>}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {lead.aiPaused && (
                        <span
                          className="ti ti-player-pause text-[#E8A020]"
                          title="AI paused — human handling"
                        />
                      )}
                      {lead.leadScore && (
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${LEAD_SCORE_COLORS[lead.leadScore]}`}
                        >
                          {LEAD_SCORE_LABELS[lead.leadScore]}
                        </span>
                      )}
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${AI_LEAD_STATUS_COLORS[lead.status]}`}
                      >
                        {AI_LEAD_STATUS_LABELS[lead.status]}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── Thread ── */}
        <div className="rounded-xl border border-[#DDE3EC] dark:border-white/10 bg-white dark:bg-slate-800">
          {!selected ? (
            <p className="px-6 py-12 text-center text-sm text-[#5A6A7A] dark:text-white/40">
              Select a lead to read the conversation.
            </p>
          ) : (
            <div className="flex h-full flex-col">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#DDE3EC] dark:border-white/10 p-4">
                <div>
                  <h2 className="font-jakarta text-base font-bold text-[#0B3D6B] dark:text-white">
                    {selected.name || selected.phone}
                  </h2>
                  <p className="text-xs text-[#5A6A7A] dark:text-white/40">
                    {selected.phone}
                    {selected.programInterest && <> · {selected.programInterest}</>}
                  </p>
                  {Object.keys(selected.qualificationAnswers).length > 0 && (
                    <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                      {Object.entries(selected.qualificationAnswers).map(([k, v]) => (
                        <div key={k} className="text-[11px] text-[#5A6A7A] dark:text-white/40">
                          <dt className="inline font-semibold capitalize">
                            {k.replace(/([A-Z])/g, ' $1').trim()}:
                          </dt>{' '}
                          <dd className="inline">{v}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
                <span
                  className={`inline-flex shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${AI_LEAD_STATUS_COLORS[selected.status]}`}
                >
                  {AI_LEAD_STATUS_LABELS[selected.status]}
                </span>
              </div>

              {selected.status === 'ready_for_payment' && (
                <div className="border-b border-[#DDE3EC] dark:border-white/10 bg-[#F5F7FB] dark:bg-white/5 p-4">
                  <p className="text-xs text-[#5A6A7A] dark:text-white/50">
                    The AI has paused on this lead and is waiting for a human to send the
                    registration payment link.
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleSendPaymentLink(selected)}
                    disabled={sending}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#0B3D6B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f4c81] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="ti ti-send" />
                    {sending
                      ? 'Sending…'
                      : `Send Payment Link (LKR ${REGISTRATION_FEE_LKR.toLocaleString('en-LK')})`}
                  </button>
                </div>
              )}

              <div className="max-h-[60vh] flex-1 space-y-3 overflow-y-auto p-4">
                {messagesLoading ? (
                  <p className="text-xs text-[#5A6A7A] dark:text-white/40">Loading…</p>
                ) : messages.length === 0 ? (
                  <p className="text-xs text-[#5A6A7A] dark:text-white/40">No messages yet.</p>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex ${m.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                          m.direction === 'outbound'
                            ? 'bg-[#0B3D6B] text-white'
                            : 'border border-[#DDE3EC] dark:border-white/10 bg-white dark:bg-slate-900 text-[#0D1B2A] dark:text-white/80'
                        }`}
                      >
                        <span
                          className={`mb-1 block text-[10px] uppercase tracking-wide ${
                            m.direction === 'outbound' ? 'text-white/60' : 'text-[#5A6A7A] dark:text-white/40'
                          }`}
                        >
                          {SENDER_LABELS[m.sender] ?? m.sender} · {formatWhen(m.timestamp)}
                        </span>
                        <span className="whitespace-pre-wrap">{m.text}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
