'use client'

import { useEffect, useState } from 'react'
import {
  CATEGORY_HINTS,
  CATEGORY_LABELS,
  type KnowledgeBlock,
  type KnowledgeCategory,
} from '@/lib/ai/knowledgeBase'

interface Props {
  open: boolean
  /** null = creating a new block in `category` */
  block: KnowledgeBlock | null
  category: KnowledgeCategory
  saving: boolean
  onClose: () => void
  onSave: (values: { title: string; content: string }) => void
}

const inputClass =
  'w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-[#0D1B2A] dark:text-white outline-none focus:border-[#E8A020]'

export default function KnowledgeBlockModal({
  open,
  block,
  category,
  saving,
  onClose,
  onSave,
}: Props) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')

  useEffect(() => {
    if (!open) return
    setTitle(block?.title ?? '')
    setContent(block?.content ?? '')
  }, [open, block])

  if (!open) return null

  const canSave = title.trim().length > 0 && content.trim().length > 0 && !saving

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-jakarta text-lg font-bold text-[#0B3D6B] dark:text-white">
              {block ? 'Edit Content Block' : 'New Content Block'}
            </h2>
            <p className="mt-1 text-xs text-[#5A6A7A] dark:text-white/50">
              {CATEGORY_LABELS[category]} — {CATEGORY_HINTS[category]}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-[#5A6A7A] hover:bg-[#F5F7FB] dark:hover:bg-white/10"
            aria-label="Close"
          >
            <span className="ti ti-x" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-gray-300">
              Title *
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Japan SSW — entry requirements"
              className={inputClass}
            />
          </div>

          <div>
            <div className="mb-1 flex items-end justify-between">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-300">
                Content *
              </label>
              <span className="text-[11px] text-[#5A6A7A] dark:text-white/40">
                {content.length.toLocaleString()} characters
              </span>
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={14}
              placeholder={'Write in plain text or Markdown.\n\n- Keep facts specific (dates, fees, durations)\n- Write it the way you want the agent to say it'}
              className={`${inputClass} resize-y font-mono text-[13px] leading-relaxed`}
            />
            <p className="mt-1.5 text-[11px] text-[#5A6A7A] dark:text-white/40">
              Markdown supported. This text is given to the AI agent as-is — no model
              retraining happens, so edits take effect on the next conversation.
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-[#DDE3EC] dark:border-white/10 px-4 py-2 text-sm font-medium text-[#5A6A7A] dark:text-white/70 hover:bg-[#F5F7FB] dark:hover:bg-white/5 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave({ title, content })}
            disabled={!canSave}
            className="rounded-lg bg-[#0B3D6B] px-5 py-2 text-sm font-semibold text-white hover:bg-[#0f4c81] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Saving…' : block ? 'Save changes' : 'Create block'}
          </button>
        </div>
      </div>
    </div>
  )
}
