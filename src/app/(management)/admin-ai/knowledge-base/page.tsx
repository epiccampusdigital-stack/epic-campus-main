'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useManagement } from '@/components/layout/ManagementContext'
import KnowledgeBlockModal from '@/components/ai/KnowledgeBlockModal'
import {
  CATEGORY_HINTS,
  CATEGORY_ICONS,
  CATEGORY_LABELS,
  KNOWLEDGE_CATEGORIES,
  createKnowledgeBlock,
  listKnowledgeBlocks,
  listLatestVersions,
  restoreKnowledgeBlock,
  saveKnowledgeBlock,
  type KnowledgeBlock,
  type KnowledgeBlockVersion,
  type KnowledgeCategory,
} from '@/lib/ai/knowledgeBase'

const PREVIEW_LENGTH = 220

function formatWhen(iso: string): string {
  if (!iso) return 'Just now'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function preview(content: string): string {
  const flat = content.replace(/\s+/g, ' ').trim()
  return flat.length > PREVIEW_LENGTH ? `${flat.slice(0, PREVIEW_LENGTH)}…` : flat
}

export default function KnowledgeBasePage() {
  const router = useRouter()
  const { user, loading: authLoading, hasRole } = useManagement()

  const [blocks, setBlocks] = useState<KnowledgeBlock[]>([])
  const [versions, setVersions] = useState<Record<string, KnowledgeBlockVersion>>({})
  const [staffNames, setStaffNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [restoringId, setRestoringId] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<KnowledgeBlock | null>(null)
  const [modalCategory, setModalCategory] = useState<KnowledgeCategory>('programs')

  useEffect(() => {
    if (authLoading) return
    if (!user) return
    if (!(hasRole('admin') || hasRole('owner') || hasRole('ai_manager'))) {
      router.replace('/dashboard')
    }
  }, [user, authLoading, router, hasRole])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [blockList, versionMap, usersSnap] = await Promise.all([
        listKnowledgeBlocks(),
        listLatestVersions(),
        // Author names are cosmetic. Roles scoped to the AI console (ai_manager)
        // have no read access to the staff directory, so a denial here must
        // degrade to unnamed authors rather than fail the whole page load.
        getDocs(collection(db, 'users')).catch(() => null),
      ])
      const names: Record<string, string> = {}
      usersSnap?.docs.forEach((d) => {
        const data = d.data()
        names[d.id] = String(data.displayName ?? data.email ?? '')
      })
      setBlocks(blockList)
      setVersions(versionMap)
      setStaffNames(names)
    } catch (err) {
      console.error('[KnowledgeBasePage] load', err)
      toast.error('Could not load the knowledge base. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authLoading || !user || !(hasRole('admin') || hasRole('owner') || hasRole('ai_manager'))) return
    void load()
  }, [authLoading, user, hasRole, load])

  const grouped = useMemo(() => {
    const map = {} as Record<KnowledgeCategory, KnowledgeBlock[]>
    KNOWLEDGE_CATEGORIES.forEach((c) => {
      map[c] = []
    })
    blocks.forEach((b) => {
      map[b.category].push(b)
    })
    return map
  }, [blocks])

  function openCreate(category: KnowledgeCategory) {
    setEditing(null)
    setModalCategory(category)
    setModalOpen(true)
  }

  function openEdit(block: KnowledgeBlock) {
    setEditing(block)
    setModalCategory(block.category)
    setModalOpen(true)
  }

  async function handleSave(values: { title: string; content: string }) {
    if (!user) return
    setSaving(true)
    try {
      if (editing) {
        await saveKnowledgeBlock({
          block: editing,
          title: values.title,
          content: values.content,
          uid: user.uid,
        })
        toast.success('Block updated — previous version saved')
      } else {
        await createKnowledgeBlock({
          category: modalCategory,
          title: values.title,
          content: values.content,
          uid: user.uid,
        })
        toast.success('Block created')
      }
      setModalOpen(false)
      setEditing(null)
      await load()
    } catch (err) {
      console.error('[KnowledgeBasePage] save', err)
      toast.error('Could not save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleRestore(block: KnowledgeBlock) {
    if (!user) return
    const version = versions[block.id]
    if (!version) return
    const confirmed = window.confirm(
      `Restore the version saved on ${formatWhen(version.replacedAt)}? The current content will be kept in history.`,
    )
    if (!confirmed) return

    setRestoringId(block.id)
    try {
      await restoreKnowledgeBlock({ block, version, uid: user.uid })
      toast.success('Previous version restored')
      await load()
    } catch (err) {
      console.error('[KnowledgeBasePage] restore', err)
      toast.error('Could not restore. Please try again.')
    } finally {
      setRestoringId(null)
    }
  }

  const isAuthorized = user && (hasRole('admin') || hasRole('owner') || hasRole('ai_manager'))
  if (authLoading || !isAuthorized) return null

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-jakarta text-2xl font-bold text-[#0D1B2A] dark:text-white">
            AI Knowledge Base
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[#5A6A7A] dark:text-white/50">
            Content the AI sales agents use when answering leads. Editing a block changes
            what the agent knows on its next conversation — this is content management,
            not model training.
          </p>
        </div>
        <div className="rounded-xl border border-[#DDE3EC] dark:border-white/10 bg-white dark:bg-slate-800 px-4 py-3">
          <p className="font-inter text-xs font-medium uppercase tracking-wide text-[#5A6A7A] dark:text-white/50">
            Total blocks
          </p>
          <p className="mt-0.5 font-jakarta text-2xl font-bold text-[#0B3D6B] dark:text-[#E8A020]">
            {loading ? '—' : blocks.length}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-xl border border-[#DDE3EC] dark:border-white/10 bg-white dark:bg-slate-800"
            />
          ))}
        </div>
      ) : (
        KNOWLEDGE_CATEGORIES.map((category) => {
          const items = grouped[category]
          return (
            <section key={category} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DDE3EC] dark:border-white/10 pb-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0B3D6B] text-white">
                    <span className={`ti ${CATEGORY_ICONS[category]}`} />
                  </span>
                  <div>
                    <h2 className="font-jakarta text-base font-bold text-[#0D1B2A] dark:text-white">
                      {CATEGORY_LABELS[category]}
                      <span className="ml-2 rounded-full bg-[#F5F7FB] dark:bg-white/10 px-2 py-0.5 text-xs font-semibold text-[#5A6A7A] dark:text-white/60">
                        {items.length}
                      </span>
                    </h2>
                    <p className="text-xs text-[#5A6A7A] dark:text-white/40">
                      {CATEGORY_HINTS[category]}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openCreate(category)}
                  className="inline-flex items-center gap-2 rounded-lg border border-[#E8A020] px-3.5 py-2 text-sm font-semibold text-[#0B3D6B] dark:text-[#E8A020] hover:bg-[#E8A020]/10"
                >
                  <span className="ti ti-plus" /> Add block
                </button>
              </div>

              {items.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[#DDE3EC] dark:border-white/10 px-6 py-8 text-center text-sm text-[#5A6A7A] dark:text-white/40">
                  No {CATEGORY_LABELS[category].toLowerCase()} blocks yet.
                </p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {items.map((block) => {
                    const version = versions[block.id]
                    return (
                      <article
                        key={block.id}
                        className="flex flex-col rounded-xl border border-[#DDE3EC] dark:border-white/10 bg-white dark:bg-slate-800 p-5"
                      >
                        <button type="button" onClick={() => openEdit(block)} className="text-left">
                          <h3 className="font-jakarta text-base font-semibold text-[#0B3D6B] dark:text-white hover:underline">
                            {block.title || 'Untitled block'}
                          </h3>
                        </button>

                        <p className="mt-2 flex-1 text-sm leading-relaxed text-[#5A6A7A] dark:text-white/60">
                          {preview(block.content) || 'No content yet.'}
                        </p>

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#DDE3EC] dark:border-white/10 pt-3">
                          <p className="text-[11px] text-[#5A6A7A] dark:text-white/40">
                            Edited {formatWhen(block.updatedAt)}
                            {block.updatedBy && (
                              <> by {staffNames[block.updatedBy] || block.updatedBy}</>
                            )}
                          </p>
                          <div className="flex items-center gap-2">
                            {version && (
                              <button
                                type="button"
                                onClick={() => handleRestore(block)}
                                disabled={restoringId === block.id}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-[#DDE3EC] dark:border-white/10 px-3 py-1.5 text-xs font-medium text-[#5A6A7A] dark:text-white/70 hover:bg-[#F5F7FB] dark:hover:bg-white/5 disabled:opacity-60"
                                title={`Version saved ${formatWhen(version.replacedAt)}`}
                              >
                                <span className="ti ti-history" />
                                {restoringId === block.id ? 'Restoring…' : 'Restore previous'}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openEdit(block)}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B3D6B] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0f4c81]"
                            >
                              <span className="ti ti-edit" /> Edit
                            </button>
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </section>
          )
        })
      )}

      <KnowledgeBlockModal
        open={modalOpen}
        block={editing}
        category={modalCategory}
        saving={saving}
        onClose={() => {
          setModalOpen(false)
          setEditing(null)
        }}
        onSave={handleSave}
      />
    </div>
  )
}
