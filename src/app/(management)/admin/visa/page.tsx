'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { collection, doc, getDocs, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useManagement } from '@/components/layout/ManagementContext'
import type { VisaApplication, VisaApplicationStatus, VisaDocumentItem } from '@/types'

const STAGES: { id: VisaApplicationStatus; label: string; emoji: string }[] = [
  { id: 'documents', label: 'Documents', emoji: '📋' },
  { id: 'submitted', label: 'Submitted', emoji: '📤' },
  { id: 'processing', label: 'Processing', emoji: '⏳' },
  { id: 'approved', label: 'Approved', emoji: '✅' },
  { id: 'rejected', label: 'Rejected', emoji: '❌' },
]

const DEFAULT_DOCS = [
  'Passport',
  'Birth Certificate',
  'Medical Report',
  'Bank Statement',
  'Police Clearance',
]

function parseVisaApplication(id: string, data: Record<string, unknown>): VisaApplication {
  const rawDocs = Array.isArray(data.documents) ? data.documents : []
  const documents: VisaDocumentItem[] = rawDocs.length
    ? rawDocs.map((d) => {
        const item = d as Record<string, unknown>
        return {
          name: String(item.name ?? ''),
          uploaded: Boolean(item.uploaded),
          verified: Boolean(item.verified),
        }
      })
    : DEFAULT_DOCS.map((name) => ({ name, uploaded: false, verified: false }))

  return {
    id,
    studentId: String(data.studentId ?? ''),
    studentName: String(data.studentName ?? ''),
    program: String(data.program ?? ''),
    visaType: String(data.visaType ?? ''),
    status: (data.status as VisaApplicationStatus) ?? 'documents',
    documents,
    submittedAt: data.submittedAt ? String(data.submittedAt) : undefined,
    updatedAt: String(data.updatedAt ?? new Date().toISOString()),
    notes: String(data.notes ?? ''),
    whatsappPhone: data.whatsappPhone ? String(data.whatsappPhone) : undefined,
  }
}

async function notifyVisaUpdate(app: VisaApplication, status: VisaApplicationStatus) {
  const phone = app.whatsappPhone
  if (!phone) return
  void fetch('/api/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'visa',
      phone,
      name: app.studentName,
      data: { status },
    }),
  })
}

export default function AdminVisaPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useManagement()
  const [applications, setApplications] = useState<VisaApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<VisaApplication | null>(null)
  const [editNotes, setEditNotes] = useState('')
  const [editStatus, setEditStatus] = useState<VisaApplicationStatus>('documents')
  const [editDocs, setEditDocs] = useState<VisaDocumentItem[]>([])
  const [saving, setSaving] = useState(false)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user) return
    if (user.role !== 'admin' && user.role !== 'owner') {
      router.replace('/dashboard')
    }
  }, [user, authLoading, router])

  const loadApplications = useCallback(async () => {
    setLoading(true)
    try {
      const snap = await getDocs(collection(db, 'visaApplications'))
      const apps = snap.docs
        .map((d) => parseVisaApplication(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      setApplications(apps)
    } catch (err) {
      console.error('[AdminVisa]', err)
      setApplications([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authLoading || !user || (user.role !== 'admin' && user.role !== 'owner')) return
    loadApplications()
  }, [user, authLoading, loadApplications])

  function openDetail(app: VisaApplication) {
    setSelected(app)
    setEditNotes(app.notes)
    setEditStatus(app.status)
    setEditDocs(app.documents.map((d) => ({ ...d })))
  }

  async function updateStatus(appId: string, newStatus: VisaApplicationStatus) {
    const app = applications.find((a) => a.id === appId)
    if (!app || app.status === newStatus) return

    const now = new Date().toISOString()
    const patch: Record<string, unknown> = { status: newStatus, updatedAt: now }
    if (newStatus === 'submitted' && !app.submittedAt) {
      patch.submittedAt = now
    }

    await updateDoc(doc(db, 'visaApplications', appId), patch)

    const updated = { ...app, status: newStatus, updatedAt: now, submittedAt: patch.submittedAt as string | undefined ?? app.submittedAt }
    setApplications((prev) => prev.map((a) => (a.id === appId ? updated : a)))
    if (selected?.id === appId) {
      setEditStatus(newStatus)
      setSelected(updated)
    }
    void notifyVisaUpdate(updated, newStatus)
  }

  function handleDragStart(e: React.DragEvent, appId: string) {
    e.dataTransfer.setData('text/plain', appId)
    e.dataTransfer.effectAllowed = 'move'
    setDraggingId(appId)
  }

  function handleDragEnd() {
    setDraggingId(null)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  async function handleDrop(e: React.DragEvent, status: VisaApplicationStatus) {
    e.preventDefault()
    const appId = e.dataTransfer.getData('text/plain')
    setDraggingId(null)
    if (appId) await updateStatus(appId, status)
  }

  async function handleSaveDetail() {
    if (!selected) return
    setSaving(true)
    try {
      const now = new Date().toISOString()
      const patch: Record<string, unknown> = {
        notes: editNotes,
        status: editStatus,
        documents: editDocs,
        updatedAt: now,
      }
      if (editStatus === 'submitted' && !selected.submittedAt) {
        patch.submittedAt = now
      }

      await updateDoc(doc(db, 'visaApplications', selected.id), patch)

      const updated: VisaApplication = {
        ...selected,
        notes: editNotes,
        status: editStatus,
        documents: editDocs,
        updatedAt: now,
        submittedAt: patch.submittedAt as string | undefined ?? selected.submittedAt,
      }

      setApplications((prev) => prev.map((a) => (a.id === selected.id ? updated : a)))
      if (editStatus !== selected.status) {
        void notifyVisaUpdate(updated, editStatus)
      }
      setSelected(updated)
    } catch (err) {
      console.error('[AdminVisa] save', err)
    } finally {
      setSaving(false)
    }
  }

  function toggleDoc(index: number, field: 'uploaded' | 'verified') {
    setEditDocs((prev) =>
      prev.map((d, i) => {
        if (i !== index) return d
        if (field === 'verified') {
          return { ...d, verified: !d.verified, uploaded: !d.verified ? true : d.uploaded }
        }
        return { ...d, uploaded: !d.uploaded, verified: d.uploaded ? false : d.verified }
      }),
    )
  }

  const isAuthorized = user && (user.role === 'admin' || user.role === 'owner')

  if (authLoading || !isAuthorized) return null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-jakarta text-2xl font-bold text-[#0D1B2A]">Visa Applications</h1>
        <p className="mt-1 text-sm text-[#5A6A7A]">Drag cards between stages to update status</p>
        <div className="mt-3 h-1 w-16 rounded-full bg-[#E8A020]" />
      </div>

      {loading ? (
        <div className="grid grid-cols-5 gap-3">
          {STAGES.map((s) => (
            <div key={s.id} className="h-64 animate-pulse rounded-xl bg-[#DDE3EC]/60" />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto pb-2">
          <div className="flex min-w-[900px] gap-3">
            {STAGES.map((stage) => {
              const columnApps = applications.filter((a) => a.status === stage.id)
              return (
                <div
                  key={stage.id}
                  className="flex min-h-[420px] w-56 shrink-0 flex-col rounded-xl border border-[#DDE3EC] bg-[#F5F7FB]"
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, stage.id)}
                >
                  <div className="border-b border-[#DDE3EC] px-3 py-3">
                    <p className="font-jakarta text-sm font-bold text-[#0B3D6B]">
                      {stage.emoji} {stage.label}
                    </p>
                    <p className="text-xs text-[#5A6A7A]">{columnApps.length} application(s)</p>
                  </div>
                  <div className="flex-1 space-y-2 p-2">
                    {columnApps.map((app) => (
                      <div
                        key={app.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, app.id)}
                        onDragEnd={handleDragEnd}
                        onClick={() => openDetail(app)}
                        className={`cursor-grab rounded-lg border border-[#DDE3EC] bg-white p-3 shadow-sm transition-opacity active:cursor-grabbing ${
                          draggingId === app.id ? 'opacity-50' : 'hover:border-[#E8A020]'
                        }`}
                      >
                        <p className="font-jakarta text-sm font-semibold text-[#0D1B2A]">
                          {app.studentName}
                        </p>
                        <p className="mt-1 truncate text-xs text-[#5A6A7A]">{app.program}</p>
                        <p className="mt-1 text-xs text-[#5A6A7A]">{app.visaType || 'Visa'}</p>
                      </div>
                    ))}
                    {columnApps.length === 0 && (
                      <p className="py-8 text-center text-xs text-[#5A6A7A]">Drop here</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Detail panel */}
      {selected && (
        <>
          <div
            className="fixed inset-0 z-40 bg-[#0D1B2A]/40 backdrop-blur-sm"
            onClick={() => setSelected(null)}
            aria-hidden="true"
          />
          <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-[#DDE3EC] bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-[#DDE3EC] px-5 py-4">
              <div>
                <h2 className="font-jakarta text-lg font-bold text-[#0D1B2A]">{selected.studentName}</h2>
                <p className="text-sm text-[#5A6A7A]">{selected.program}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg p-2 text-[#5A6A7A] hover:bg-[#F5F7FB]"
                aria-label="Close"
              >
                <span className="ti ti-x text-xl" aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              <div>
                <label className="mb-1.5 block font-jakarta text-xs font-semibold uppercase tracking-wide text-[#5A6A7A]">
                  Status
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as VisaApplicationStatus)}
                  className="w-full rounded-lg border border-[#DDE3EC] bg-white px-3 py-2 font-inter text-sm text-[#0D1B2A] focus:border-[#E8A020] focus:outline-none"
                >
                  {STAGES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.emoji} {s.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <h3 className="mb-3 font-jakarta text-sm font-bold text-[#0B3D6B]">Documents</h3>
                <ul className="space-y-2">
                  {editDocs.map((doc, i) => (
                    <li
                      key={doc.name}
                      className="rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm"
                    >
                      <p className="mb-2 font-medium text-[#0D1B2A]">{doc.name}</p>
                      <div className="flex gap-4">
                        <label className="flex cursor-pointer items-center gap-2 text-[#5A6A7A]">
                          <input
                            type="checkbox"
                            checked={doc.uploaded}
                            onChange={() => toggleDoc(i, 'uploaded')}
                            className="accent-[#0B3D6B]"
                          />
                          Uploaded
                        </label>
                        <label className="flex cursor-pointer items-center gap-2 text-[#5A6A7A]">
                          <input
                            type="checkbox"
                            checked={doc.verified}
                            onChange={() => toggleDoc(i, 'verified')}
                            className="accent-[#E8A020]"
                          />
                          Verified
                        </label>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <label className="mb-1.5 block font-jakarta text-xs font-semibold uppercase tracking-wide text-[#5A6A7A]">
                  Notes
                </label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={5}
                  className="w-full resize-y rounded-lg border border-[#DDE3EC] px-3 py-2 font-inter text-sm text-[#0D1B2A] focus:border-[#E8A020] focus:outline-none"
                  placeholder="Internal notes visible to student when saved…"
                />
              </div>
            </div>

            <div className="border-t border-[#DDE3EC] p-5">
              <button
                type="button"
                onClick={handleSaveDetail}
                disabled={saving}
                className="w-full rounded-lg bg-[#0B3D6B] py-3 font-jakarta text-sm font-bold text-white hover:bg-[#094a82] disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </aside>
        </>
      )}
    </div>
  )
}
