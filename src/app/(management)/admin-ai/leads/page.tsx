'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase/client'
import { useManagement } from '@/components/layout/ManagementContext'
import {
  AI_LEAD_STATUS_COLORS,
  AI_LEAD_STATUS_LABELS,
  AI_LEAD_STATUSES,
  isAiLeadStatus,
  isAiManagedLeadId,
  isLeadScore,
  LEAD_SCORE_COLORS,
  LEAD_SCORE_LABELS,
  LEAD_SCORES,
  leadScoreRank,
  REGISTRATION_FEE_LKR,
  type AiLead,
  type AiLeadStatus,
  type LeadMessage,
  type LeadScore,
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

interface ConversionResult {
  leadId: string
  studentId: string
  studentCode: string
  email: string
  password: string
  created: boolean
}

const SELECT_CLASS =
  'rounded-lg border border-[#DDE3EC] dark:border-white/10 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-[#0D1B2A] dark:text-white focus:border-[#0B3D6B] focus:outline-none'

export default function AiLeadsPage() {
  const router = useRouter()
  const { user, loading: authLoading, hasRole } = useManagement()

  const [leads, setLeads] = useState<AiLead[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<LeadMessage[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [draft, setDraft] = useState('')
  const [replying, setReplying] = useState(false)
  const [togglingAi, setTogglingAi] = useState(false)
  const [converting, setConverting] = useState(false)
  const [conversion, setConversion] = useState<ConversionResult | null>(null)

  const [statusFilter, setStatusFilter] = useState<AiLeadStatus | 'all'>('all')
  const [scoreFilter, setScoreFilter] = useState<LeadScore | 'all' | 'unscored'>('all')
  const [channelFilter, setChannelFilter] = useState<string>('all')

  const threadEndRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user) return
    if (!(hasRole('admin') || hasRole('owner') || hasRole('ai_manager'))) {
      router.replace('/dashboard')
    }
  }, [user, authLoading, router, hasRole])

  const isAuthorized = Boolean(user) && (hasRole('admin') || hasRole('owner') || hasRole('ai_manager'))

  // ── Live lead list ──
  // A listener rather than a fetch: this page is a monitor, so a lead that
  // messages in (or a status the Stripe webhook settles) has to land without
  // anyone hitting refresh.
  useEffect(() => {
    if (authLoading || !isAuthorized) return

    const unsubscribe = onSnapshot(
      query(collection(db, 'leads'), orderBy('lastMessageAt', 'desc')),
      (snap) => {
        const rows: AiLead[] = snap.docs
          // Same split the CRM makes in reverse — 'wa-' docs are the AI's,
          // auto-id docs belong to the traditional CRM lead table.
          .filter((d) => isAiManagedLeadId(d.id))
          .map((d) => {
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
              convertedToStudentId: data.convertedToStudentId
                ? String(data.convertedToStudentId)
                : null,
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
        setLoading(false)
      },
      (err) => {
        console.error('[AiLeadsPage] leads listener', err)
        toast.error('Lost the live connection to leads. Reload the page.')
        setLoading(false)
      },
    )

    return unsubscribe
  }, [authLoading, isAuthorized])

  // The open thread reads from the live list rather than a frozen copy, so a
  // status change or an AI pause shows up in the header while it is open.
  const selected = useMemo(
    () => leads.find((l) => l.id === selectedId) ?? null,
    [leads, selectedId],
  )

  // ── Live thread ──
  useEffect(() => {
    if (!selectedId || !isAuthorized) {
      setMessages([])
      return
    }

    setMessagesLoading(true)
    const unsubscribe = onSnapshot(
      query(collection(db, 'leads', selectedId, 'messages'), orderBy('timestamp', 'asc')),
      (snap) => {
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
        setMessagesLoading(false)
      },
      (err) => {
        console.error('[AiLeadsPage] thread listener', err)
        toast.error('Could not load the conversation.')
        setMessagesLoading(false)
      },
    )

    return unsubscribe
  }, [selectedId, isAuthorized])

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ block: 'nearest' })
  }, [messages])

  const openThread = useCallback((lead: AiLead) => {
    setSelectedId(lead.id)
    setDraft('')
  }, [])

  const channelOptions = useMemo(() => {
    const set = new Set<string>()
    leads.forEach((l) => l.channels.forEach((c) => set.add(c)))
    return Array.from(set).sort()
  }, [leads])

  const visibleLeads = useMemo(
    () =>
      leads.filter((lead) => {
        if (statusFilter !== 'all' && lead.status !== statusFilter) return false
        if (scoreFilter === 'unscored' && lead.leadScore !== null) return false
        if (scoreFilter !== 'all' && scoreFilter !== 'unscored' && lead.leadScore !== scoreFilter)
          return false
        if (channelFilter !== 'all' && !lead.channels.includes(channelFilter)) return false
        return true
      }),
    [leads, statusFilter, scoreFilter, channelFilter],
  )

  const filtersActive =
    statusFilter !== 'all' || scoreFilter !== 'all' || channelFilter !== 'all'

  function clearFilters() {
    setStatusFilter('all')
    setScoreFilter('all')
    setChannelFilter('all')
  }

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

      // No reload needed — the listeners pick up the new status and message.
      toast.success('Payment link sent')
    } catch (err) {
      console.error('[AiLeadsPage] send payment link', err)
      toast.error(err instanceof Error ? err.message : 'Could not send the payment link.')
    } finally {
      setSending(false)
    }
  }

  /** Take over from / hand back to the AI. The write goes through the API so
   *  the audit trail is stamped server-side; the webhook reads aiPaused before
   *  it composes a reply, and the listener reflects the change straight away. */
  async function handleToggleAi(lead: AiLead, pause: boolean) {
    setTogglingAi(true)
    try {
      const token = await auth.currentUser?.getIdToken()
      const res = await fetch('/api/leads/toggle-ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ leadId: lead.id, aiPaused: pause }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Failed to update')

      toast.success(pause ? 'You are now handling this conversation' : 'AI resumed')
    } catch (err) {
      console.error('[AiLeadsPage] toggle ai', err)
      toast.error(
        err instanceof Error
          ? err.message
          : pause
            ? 'Could not pause the AI.'
            : 'Could not resume the AI.',
      )
    } finally {
      setTogglingAi(false)
    }
  }

  async function handleSendReply(lead: AiLead) {
    const text = draft.trim()
    if (!text) return

    setReplying(true)
    try {
      const token = await auth.currentUser?.getIdToken()
      const res = await fetch('/api/leads/send-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ leadId: lead.id, text }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Failed to send')

      setDraft('')
    } catch (err) {
      console.error('[AiLeadsPage] send reply', err)
      toast.error(err instanceof Error ? err.message : 'Could not send the message.')
    } finally {
      setReplying(false)
    }
  }

  async function handleConvert(lead: AiLead) {
    const confirmed = window.confirm(
      `Create a student account for ${lead.name || lead.phone}?\n\n` +
        `A Student ID and login are generated and the welcome message is sent on WhatsApp. ` +
        `This cannot be undone from here.`,
    )
    if (!confirmed) return

    setConverting(true)
    try {
      const token = await auth.currentUser?.getIdToken()
      const res = await fetch('/api/leads/convert-to-student', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ leadId: lead.id }),
      })
      const data = (await res.json()) as {
        error?: string
        studentId?: string
        studentCode?: string
        email?: string
        password?: string
        created?: boolean
      }
      if (!res.ok || !data.studentId) throw new Error(data.error ?? 'Failed to convert')

      setConversion({
        leadId: lead.id,
        studentId: data.studentId,
        studentCode: data.studentCode ?? '',
        email: data.email ?? '',
        password: data.password ?? '',
        created: data.created === true,
      })
      toast.success(`Student created${data.studentCode ? ` — ${data.studentCode}` : ''}`)
    } catch (err) {
      console.error('[AiLeadsPage] convert to student', err)
      toast.error(err instanceof Error ? err.message : 'Could not convert this lead.')
    } finally {
      setConverting(false)
    }
  }

  if (authLoading || !isAuthorized) return null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-jakarta text-2xl font-bold text-[#0D1B2A] dark:text-white">
            AI Leads
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[#5A6A7A] dark:text-white/50">
            WhatsApp conversations handled by the AI agent. Payment links and student
            accounts are created by staff only — the AI never creates one.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-lg border border-[#DDE3EC] dark:border-white/10 px-3 py-2 text-xs font-medium text-[#5A6A7A] dark:text-white/50">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          Live
        </span>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#DDE3EC] dark:border-white/10 bg-white dark:bg-slate-800 p-3">
        <label className="flex items-center gap-2 text-xs font-medium text-[#5A6A7A] dark:text-white/50">
          Status
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as AiLeadStatus | 'all')}
            className={SELECT_CLASS}
          >
            <option value="all">All</option>
            {AI_LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {AI_LEAD_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-xs font-medium text-[#5A6A7A] dark:text-white/50">
          Score
          <select
            value={scoreFilter}
            onChange={(e) => setScoreFilter(e.target.value as LeadScore | 'all' | 'unscored')}
            className={SELECT_CLASS}
          >
            <option value="all">All</option>
            {LEAD_SCORES.map((s) => (
              <option key={s} value={s}>
                {LEAD_SCORE_LABELS[s]}
              </option>
            ))}
            <option value="unscored">Not scored yet</option>
          </select>
        </label>

        <label className="flex items-center gap-2 text-xs font-medium text-[#5A6A7A] dark:text-white/50">
          Channel
          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className={SELECT_CLASS}
          >
            <option value="all">All</option>
            {channelOptions.map((c) => (
              <option key={c} value={c}>
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>
        </label>

        <span className="ml-auto text-xs text-[#5A6A7A] dark:text-white/40">
          {visibleLeads.length} of {leads.length}
        </span>
        {filtersActive && (
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-lg border border-[#DDE3EC] dark:border-white/10 px-3 py-2 text-xs font-medium text-[#0B3D6B] dark:text-white/70 hover:bg-[#F5F7FB] dark:hover:bg-white/5"
          >
            Clear
          </button>
        )}
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
          ) : visibleLeads.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-[#5A6A7A] dark:text-white/40">
              No leads match these filters.
            </p>
          ) : (
            <ul className="divide-y divide-[#DDE3EC] dark:divide-white/10">
              {visibleLeads.map((lead) => (
                <li key={lead.id}>
                  <button
                    type="button"
                    onClick={() => openThread(lead)}
                    className={`flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3.5 text-left hover:bg-[#F5F7FB] dark:hover:bg-white/5 ${
                      selectedId === lead.id ? 'bg-[#F5F7FB] dark:bg-white/5' : ''
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
                      {lead.convertedToStudentId && (
                        <span
                          className="ti ti-user-check text-emerald-600"
                          title="Already converted to a student"
                        />
                      )}
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
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${AI_LEAD_STATUS_COLORS[selected.status]}`}
                  >
                    {AI_LEAD_STATUS_LABELS[selected.status]}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleToggleAi(selected, !selected.aiPaused)}
                    disabled={togglingAi}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
                      selected.aiPaused
                        ? 'border-[#0B3D6B] text-[#0B3D6B] dark:border-white/20 dark:text-white hover:bg-[#F5F7FB] dark:hover:bg-white/5'
                        : 'border-[#E8A020] bg-[#E8A020] text-white hover:bg-[#d1901c]'
                    }`}
                  >
                    <span className={`ti ${selected.aiPaused ? 'ti-robot' : 'ti-hand-stop'}`} />
                    {selected.aiPaused ? 'Resume AI' : 'Take Over'}
                  </button>
                </div>
              </div>

              {selected.aiPaused && (
                <div className="flex items-center gap-2 border-b border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-2.5">
                  <span className="ti ti-player-pause text-[#E8A020]" />
                  <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                    AI paused — you&apos;re now handling this conversation.
                  </p>
                </div>
              )}

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

              {/* ── Enrollment handoff ── */}
              {selected.status === 'paid' && (
                <div className="border-b border-[#DDE3EC] dark:border-white/10 bg-emerald-50 dark:bg-emerald-900/20 p-4">
                  {selected.convertedToStudentId ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                        <span className="ti ti-user-check" />
                        Already converted to a student
                      </span>
                      <Link
                        href={`/students/${selected.convertedToStudentId}`}
                        className="text-xs font-semibold text-[#0B3D6B] dark:text-white underline underline-offset-2"
                      >
                        Open student record
                      </Link>
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-emerald-800 dark:text-emerald-300">
                        Registration fee paid. Converting creates the student account,
                        Student ID login and payment plan — pre-filled from this lead.
                      </p>
                      <button
                        type="button"
                        onClick={() => void handleConvert(selected)}
                        disabled={converting}
                        className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <span className="ti ti-user-plus" />
                        {converting ? 'Converting…' : 'Convert to Student'}
                      </button>
                    </>
                  )}

                  {/* Credentials are also WhatsApp'd, but surface them here in
                      case the Twilio send fails — this is the only other copy. */}
                  {conversion?.leadId === selected.id && conversion.created && (
                    <div className="mt-3 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-slate-900 p-3 text-xs text-[#0D1B2A] dark:text-white/80">
                      <p className="font-semibold text-[#0B3D6B] dark:text-white">
                        Login created
                      </p>
                      <p className="mt-1">
                        Student code: <span className="font-mono">{conversion.studentCode}</span>
                      </p>
                      <p>
                        Login email: <span className="font-mono">{conversion.email}</span>
                      </p>
                      <p>
                        Password: <span className="font-mono">{conversion.password}</span>
                      </p>
                    </div>
                  )}
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
                            ? m.sender === 'human'
                              ? 'bg-[#E8A020] text-white'
                              : 'bg-[#0B3D6B] text-white'
                            : 'border border-[#DDE3EC] dark:border-white/10 bg-white dark:bg-slate-900 text-[#0D1B2A] dark:text-white/80'
                        }`}
                      >
                        <span
                          className={`mb-1 block text-[10px] uppercase tracking-wide ${
                            m.direction === 'outbound' ? 'text-white/70' : 'text-[#5A6A7A] dark:text-white/40'
                          }`}
                        >
                          {SENDER_LABELS[m.sender] ?? m.sender} · {formatWhen(m.timestamp)}
                        </span>
                        <span className="whitespace-pre-wrap">{m.text}</span>
                      </div>
                    </div>
                  ))
                )}
                <div ref={threadEndRef} />
              </div>

              {/* ── Human composer — only once the AI has been taken over ── */}
              {selected.aiPaused ? (
                <div className="border-t border-[#DDE3EC] dark:border-white/10 p-3">
                  <div className="flex items-end gap-2">
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          void handleSendReply(selected)
                        }
                      }}
                      rows={2}
                      maxLength={1600}
                      placeholder="Type a WhatsApp reply… (Enter to send, Shift+Enter for a new line)"
                      className="min-h-[44px] flex-1 resize-y rounded-lg border border-[#DDE3EC] dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-[#0D1B2A] dark:text-white placeholder:text-[#5A6A7A]/60 focus:border-[#0B3D6B] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => void handleSendReply(selected)}
                      disabled={replying || !draft.trim()}
                      className="inline-flex items-center gap-2 rounded-lg bg-[#0B3D6B] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0f4c81] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className="ti ti-send" />
                      {replying ? 'Sending…' : 'Send'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="border-t border-[#DDE3EC] dark:border-white/10 px-4 py-3">
                  <p className="text-xs text-[#5A6A7A] dark:text-white/40">
                    The AI is handling this conversation. Use{' '}
                    <span className="font-semibold">Take Over</span> to reply yourself.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
