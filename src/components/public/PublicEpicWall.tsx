'use client'

import { useEffect, useState } from 'react'
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { getInitials } from '@/lib/students/helpers'
import type { EpicWallComment, EpicWallPost, EpicWallReactionType } from '@/types'

const POST_TYPES = [
  { value: 'general', label: 'General', icon: 'ti-pencil', color: 'text-[#0B3D6B] dark:text-blue-300' },
  { value: 'achievement', label: 'Achievement', icon: 'ti-trophy', color: 'text-amber-600' },
  { value: 'announcement', label: 'Announcement', icon: 'ti-speakerphone', color: 'text-purple-600' },
  { value: 'visa_approved', label: 'Visa Approved!', icon: 'ti-plane', color: 'text-emerald-600' },
  { value: 'departure', label: 'Departure', icon: 'ti-plane-departure', color: 'text-sky-600' },
  { value: 'class_photo', label: 'Class Photo', icon: 'ti-camera', color: 'text-pink-600' },
  { value: 'tip', label: 'Study Tip', icon: 'ti-bulb', color: 'text-yellow-600' },
  { value: 'event', label: 'Event', icon: 'ti-calendar-event', color: 'text-red-600' },
  { value: 'poll', label: 'Poll', icon: 'ti-chart-bar', color: 'text-indigo-600' },
] as const

const REACTION_CONFIG: Record<EpicWallReactionType, { icon: string; label: string }> = {
  like: { icon: '👍', label: 'Like' },
  celebrate: { icon: '🎉', label: 'Celebrate' },
  save: { icon: '🔖', label: 'Save' },
}

function timeAgo(ts: EpicWallPost['createdAt'] | undefined): string {
  if (!ts?.toDate) return ''
  const diff = (Date.now() - ts.toDate().getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function Avatar({ name, photoUrl, size = 'sm' }: { name: string; photoUrl?: string; size?: 'sm' | 'md' | 'lg' }) {
  const sz = size === 'lg' ? 'h-12 w-12 text-base' : size === 'md' ? 'h-10 w-10 text-sm' : 'h-8 w-8 text-xs'
  if (photoUrl) {
    return <img src={photoUrl} alt={name} className={`${sz} rounded-full object-cover shrink-0`} />
  }
  return (
    <div className={`${sz} rounded-full bg-[#0B3D6B] flex items-center justify-center font-bold text-white shrink-0`}>
      {getInitials(name)}
    </div>
  )
}

function getYouTubeEmbed(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/)
  return match ? `https://www.youtube.com/embed/${match[1]}` : null
}

export default function PublicEpicWall() {
  const [posts, setPosts] = useState<EpicWallPost[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set())
  const [comments, setComments] = useState<Record<string, EpicWallComment[]>>({})

  // Load newest posts once — public, read-only, no auth required.
  useEffect(() => {
    void getDocs(
      query(collection(db, 'epicWallPosts'), orderBy('createdAt', 'desc'), limit(50)),
    )
      .then((snap) => {
        setPosts(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<EpicWallPost, 'id'>) })))
      })
      .catch((err) => {
        console.error('[PublicEpicWall load]', err)
      })
      .finally(() => setLoading(false))
  }, [])

  async function loadComments(postId: string) {
    try {
      const snap = await getDocs(
        query(
          collection(db, 'epicWallComments'),
          where('postId', '==', postId),
          orderBy('createdAt', 'asc'),
        ),
      )
      setComments((p) => ({
        ...p,
        [postId]: snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<EpicWallComment, 'id'>) })),
      }))
    } catch (err) {
      console.error('[PublicEpicWall comments]', err)
    }
  }

  function toggleComments(postId: string) {
    setExpandedComments((p) => {
      const next = new Set(p)
      if (next.has(postId)) {
        next.delete(postId)
      } else {
        next.add(postId)
        if (!comments[postId]) void loadComments(postId)
      }
      return next
    })
  }

  // Hide only posts explicitly flagged private (isPublic === false). Existing posts
  // have no such field, so they all appear; a future isPublic:false hides one here
  // without any code change.
  const visiblePosts = posts.filter((p) => (p as { isPublic?: boolean }).isPublic !== false)

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-48 animate-pulse rounded-2xl bg-[#DDE3EC] dark:bg-white/10" />
        ))}
      </div>
    )
  }

  if (visiblePosts.length === 0) {
    return (
      <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] py-20 text-center">
        <span className="ti ti-camera text-5xl text-[#DDE3EC] dark:text-white/20" />
        <h2 className="mt-4 font-jakarta text-lg font-bold text-[#0D1B2A] dark:text-white">Nothing here yet</h2>
        <p className="mt-1.5 text-sm text-[#5A6A7A] dark:text-white/50">Our students&apos; stories will appear here soon.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {visiblePosts.map((post) => {
        const typeConfig = POST_TYPES.find((t) => t.value === post.type)
        const postComments = comments[post.id] ?? []
        const commentsOpen = expandedComments.has(post.id)
        const embedUrl = post.videoUrl ? getYouTubeEmbed(post.videoUrl) : null

        return (
          <div
            key={post.id}
            className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.08] shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden"
          >
            {/* Post header */}
            <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
              <div className="flex items-start gap-3">
                <Avatar name={post.authorName} photoUrl={post.authorPhotoUrl} size="md" />
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm text-[#0D1B2A] dark:text-white">
                      {post.authorName}
                    </p>
                    {typeConfig && (
                      <span className={`flex items-center gap-1 rounded-full bg-[#F5F7FB] dark:bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold ${typeConfig.color}`}>
                        <span className={`ti ${typeConfig.icon}`} />
                        {typeConfig.label}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#5A6A7A] dark:text-white/40">{timeAgo(post.createdAt)}</p>
                </div>
              </div>
            </div>

            {/* Achievement badge */}
            {post.achievementBadge && (
              <div className="mx-4 mb-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-2.5 text-center font-bold text-amber-700 dark:text-amber-400">
                {post.achievementBadge}
              </div>
            )}

            {/* Post content */}
            <div className="px-4 pb-3">
              <p className="text-sm text-[#0D1B2A] dark:text-white whitespace-pre-wrap leading-relaxed">
                {post.content}
              </p>
            </div>

            {/* Poll (read-only results) */}
            {post.type === 'poll' && post.pollOptions && post.pollOptions.length > 0 && (
              <div className="px-4 pb-3 space-y-2">
                {post.pollOptions.map((opt, idx) => {
                  const votes = (post.pollVotes as unknown as Record<string, number>)?.[idx] ?? 0
                  const total = Object.values(post.pollVotes ?? {}).reduce((s: number, v) => s + Number(v), 0)
                  const pct = total > 0 ? Math.round((votes / total) * 100) : 0
                  return (
                    <div
                      key={idx}
                      className="relative w-full overflow-hidden rounded-xl border border-[#DDE3EC] dark:border-white/20 px-4 py-2.5 text-left text-sm font-medium text-[#0D1B2A] dark:text-white"
                    >
                      <div
                        className="absolute inset-y-0 left-0 bg-[#E8A020]/10 dark:bg-[#E8A020]/20 rounded-xl"
                        style={{ width: `${pct}%` }}
                      />
                      <span className="relative flex items-center justify-between">
                        <span>{opt}</span>
                        <span className="text-xs text-[#5A6A7A] dark:text-white/50">{pct}%</span>
                      </span>
                    </div>
                  )
                })}
                <p className="text-xs text-[#5A6A7A] dark:text-white/40">
                  {Object.values(post.pollVotes ?? {}).reduce((s: number, v) => s + Number(v), 0)} votes
                </p>
              </div>
            )}

            {/* Photos */}
            {post.photoUrls && post.photoUrls.length > 0 && (
              <div className={`${post.photoUrls.length === 1 ? '' : 'grid grid-cols-2 gap-0.5'} overflow-hidden`}>
                {post.photoUrls.map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt=""
                    className={`w-full object-cover ${post.photoUrls!.length === 1 ? 'max-h-80' : 'h-40'}`}
                  />
                ))}
              </div>
            )}

            {/* Video embed */}
            {embedUrl && (
              <div className="aspect-video w-full overflow-hidden">
                <iframe
                  src={embedUrl}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}

            {/* Reaction counts (read-only) + view comments */}
            <div className="flex items-center gap-4 border-t border-[#DDE3EC] dark:border-white/[0.06] px-4 py-2.5">
              {(['like', 'celebrate', 'save'] as EpicWallReactionType[]).map((type) => {
                const cfg = REACTION_CONFIG[type]
                const count = type === 'like' ? post.likeCount : type === 'celebrate' ? post.celebrateCount : post.saveCount
                return (
                  <span
                    key={type}
                    className="flex items-center gap-1.5 text-sm font-semibold text-[#5A6A7A] dark:text-white/50"
                  >
                    <span>{cfg.icon}</span>
                    {count > 0 && <span>{count}</span>}
                    <span className="hidden sm:inline">{cfg.label}</span>
                  </span>
                )
              })}
              {post.commentCount > 0 && (
                <button
                  type="button"
                  onClick={() => toggleComments(post.id)}
                  className="ml-auto flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-[#5A6A7A] dark:text-white/50 hover:bg-[#F5F7FB] dark:hover:bg-white/[0.06]"
                >
                  <span className="ti ti-message" />
                  <span>{post.commentCount}</span>
                  <span>{commentsOpen ? 'Hide comments' : 'View comments'}</span>
                </button>
              )}
            </div>

            {/* Comments section (read-only) */}
            {commentsOpen && (
              <div className="border-t border-[#DDE3EC] dark:border-white/[0.06] px-4 pb-4 pt-3 space-y-3">
                {postComments.length === 0 ? (
                  <p className="text-xs text-[#5A6A7A] dark:text-white/40">Loading comments…</p>
                ) : (
                  postComments.map((c) => (
                    <div key={c.id} className="flex gap-2.5">
                      <Avatar name={c.authorName} photoUrl={c.authorPhotoUrl} size="sm" />
                      <div className="flex-1 rounded-xl bg-[#F5F7FB] dark:bg-white/[0.06] px-3 py-2">
                        <p className="text-xs font-semibold text-[#0D1B2A] dark:text-white">{c.authorName}</p>
                        <p className="text-xs text-[#5A6A7A] dark:text-white/70">{c.content}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
