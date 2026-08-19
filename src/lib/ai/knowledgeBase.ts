import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/client'

/**
 * AI Knowledge Base — structured content blocks that later phases assemble into
 * the WhatsApp / voice agent system prompts.
 *
 * "Training" the agent here means editing this content. No model fine-tuning is
 * involved: these blocks are read at prompt-build time, nothing is baked into
 * model weights.
 */
export const KB_COLLECTION = 'aiKnowledgeBase'

/**
 * Previous version of a block, written on every save. This phase only surfaces
 * the most recent entry per block, but rows are appended (never overwritten) so
 * the full-version-history phase can read the same collection unchanged.
 */
export const KB_HISTORY_COLLECTION = 'aiKnowledgeBase_history'

export type KnowledgeCategory =
  | 'programs'
  | 'pricing'
  | 'faqs'
  | 'policies'
  | 'objection_handling'
  | 'sales_approach'

export const KNOWLEDGE_CATEGORIES: KnowledgeCategory[] = [
  'programs',
  'pricing',
  'faqs',
  'policies',
  'objection_handling',
  'sales_approach',
]

export const CATEGORY_LABELS: Record<KnowledgeCategory, string> = {
  programs: 'Programs',
  pricing: 'Pricing',
  faqs: 'FAQs',
  policies: 'Policies',
  objection_handling: 'Objection Handling',
  sales_approach: 'Sales Approach',
}

export const CATEGORY_ICONS: Record<KnowledgeCategory, string> = {
  programs: 'ti-school',
  pricing: 'ti-tag',
  faqs: 'ti-help-circle',
  policies: 'ti-file-text',
  objection_handling: 'ti-message-2-share',
  sales_approach: 'ti-target-arrow',
}

/** Shown under each category heading so staff know what belongs where. */
export const CATEGORY_HINTS: Record<KnowledgeCategory, string> = {
  programs: 'Pathways, durations, entry requirements, intake dates.',
  pricing: 'Course fees, instalment options, what each fee covers.',
  faqs: 'Questions leads ask repeatedly, with the approved answer.',
  policies: 'Refunds, deferrals, accommodation rules, attendance.',
  objection_handling: 'Common hesitations and how the agent should respond.',
  sales_approach: 'Tone, pacing, and how the agent should guide a conversation.',
}

export function isKnowledgeCategory(value: unknown): value is KnowledgeCategory {
  return KNOWLEDGE_CATEGORIES.includes(value as KnowledgeCategory)
}

export interface KnowledgeBlock {
  id: string
  category: KnowledgeCategory
  title: string
  /** Markdown / plain text. Fed verbatim into the agent prompt in a later phase. */
  content: string
  /** ISO string, or '' when the server timestamp has not resolved yet. */
  updatedAt: string
  /** uid of the staff member who last saved this block. */
  updatedBy: string
}

export interface KnowledgeBlockVersion {
  id: string
  originalDocId: string
  previousTitle: string
  previousContent: string
  replacedAt: string
  replacedBy: string
}

/** Firestore Timestamp | string | null → ISO string ('' when unresolved). */
function toIso(value: unknown): string {
  if (!value) return ''
  const ts = value as { toDate?: () => Date }
  if (typeof ts.toDate === 'function') return ts.toDate().toISOString()
  if (typeof value === 'string') return value
  return ''
}

function parseBlock(id: string, data: Record<string, unknown>): KnowledgeBlock {
  const category = data.category
  return {
    id,
    category: isKnowledgeCategory(category) ? category : 'faqs',
    title: String(data.title ?? ''),
    content: String(data.content ?? ''),
    updatedAt: toIso(data.updatedAt),
    updatedBy: String(data.updatedBy ?? ''),
  }
}

function parseVersion(id: string, data: Record<string, unknown>): KnowledgeBlockVersion {
  return {
    id,
    originalDocId: String(data.originalDocId ?? ''),
    previousTitle: String(data.previousTitle ?? ''),
    previousContent: String(data.previousContent ?? ''),
    replacedAt: toIso(data.replacedAt),
    replacedBy: String(data.replacedBy ?? ''),
  }
}

/**
 * Every block, sorted by category order then title. Sorting happens in memory
 * rather than via orderBy so no composite index is required — the knowledge base
 * is a small, hand-curated collection.
 */
export async function listKnowledgeBlocks(): Promise<KnowledgeBlock[]> {
  const snap = await getDocs(collection(db, KB_COLLECTION))
  return snap.docs
    .map((d) => parseBlock(d.id, d.data()))
    .sort((a, b) => {
      const byCategory =
        KNOWLEDGE_CATEGORIES.indexOf(a.category) - KNOWLEDGE_CATEGORIES.indexOf(b.category)
      return byCategory !== 0 ? byCategory : a.title.localeCompare(b.title)
    })
}

/**
 * Most recent archived version per block, keyed by originalDocId. Reduced in
 * memory so a single read covers every card's "Restore previous" state.
 */
export async function listLatestVersions(): Promise<Record<string, KnowledgeBlockVersion>> {
  const snap = await getDocs(collection(db, KB_HISTORY_COLLECTION))
  const latest: Record<string, KnowledgeBlockVersion> = {}
  for (const d of snap.docs) {
    const version = parseVersion(d.id, d.data())
    if (!version.originalDocId) continue
    const current = latest[version.originalDocId]
    if (!current || version.replacedAt > current.replacedAt) {
      latest[version.originalDocId] = version
    }
  }
  return latest
}

export async function createKnowledgeBlock(input: {
  category: KnowledgeCategory
  title: string
  content: string
  uid: string
}): Promise<string> {
  const ref = doc(collection(db, KB_COLLECTION))
  await setDoc(ref, {
    category: input.category,
    title: input.title.trim(),
    content: input.content.trim(),
    updatedAt: serverTimestamp(),
    updatedBy: input.uid,
  })
  return ref.id
}

/**
 * Archives the block's current title/content into history, then writes the new
 * values — both in one batch, so a block is never updated without its previous
 * version being kept.
 */
export async function saveKnowledgeBlock(input: {
  block: KnowledgeBlock
  title: string
  content: string
  uid: string
}): Promise<void> {
  const { block, uid } = input
  const batch = writeBatch(db)

  batch.set(doc(collection(db, KB_HISTORY_COLLECTION)), {
    originalDocId: block.id,
    previousTitle: block.title,
    previousContent: block.content,
    replacedAt: serverTimestamp(),
    replacedBy: uid,
  })

  batch.update(doc(db, KB_COLLECTION, block.id), {
    title: input.title.trim(),
    content: input.content.trim(),
    updatedAt: serverTimestamp(),
    updatedBy: uid,
  })

  await batch.commit()
}

/**
 * Puts an archived version back into the live block. The content being replaced
 * is itself archived first, so a restore can be undone by restoring again.
 */
export async function restoreKnowledgeBlock(input: {
  block: KnowledgeBlock
  version: KnowledgeBlockVersion
  uid: string
}): Promise<void> {
  await saveKnowledgeBlock({
    block: input.block,
    title: input.version.previousTitle || input.block.title,
    content: input.version.previousContent,
    uid: input.uid,
  })
}
