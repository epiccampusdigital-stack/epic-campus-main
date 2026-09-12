'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { collection, deleteDoc, doc, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useManagement } from '@/components/layout/ManagementContext'
import WallComposer, {
  POST_TYPES,
  WALL_POSTS_COLLECTION,
  WallAvatar,
} from '@/components/wall/WallComposer'
import { ROLE_LABELS } from '@/lib/constants/roles'
import type { EpicWallPost } from '@/types'

function timeAgo(ts: EpicWallPost['createdAt'] | undefined): string {
  const date = ts?.toDate?.()
  if (!date) return ''
  const diff = (Date.now() - date.getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function AdminEpicWallPage() {
  const router = useRouter()
  const { user, loading: authLoading, hasRole } = useManagement()
  const [posts, setPosts] = useState<EpicWallPost[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const allowed = hasRole('admin') || hasRole('owner')

  useEffect(() => {
    if (authLoading || !user) return
    if (!allowed) router.replace('/dashboard')
  }, [authLoading, user, allowed, router])

  useEffect(() => {
    if (authLoading || !user || !allowed) return
    const q = query(
      collection(db, WALL_POSTS_COLLECTION),
      orderBy('createdAt', 'desc'),
      limit(50),
    )
    const unsub = onSnapshot(
      q,
      (snap) => {
        setPosts(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<EpicWallPost, 'id'>) })))
        setLoading(false)
      },
      (err) => {
        console.error('[AdminEpicWall] feed', err)
        setLoading(false)
        toast.error('Could not load the wall feed.')
      },
    )
    return () => unsub()
  }, [authLoading, user, allowed])

  async function handleDeletePost(postId: string) {
    if (!window.confirm('Delete this post from the Epic Wall? This cannot be undone.')) return
    setDeletingId(postId)
    try {
      await deleteDoc(doc(db, WALL_POSTS_COLLECTION, postId))
      toast.success('Post deleted')
    } catch (err) {
      console.error('[AdminEpicWall] delete', err)
      toast.error('Failed to delete post')
    } finally {
      setDeletingId(null)
    }
  }

  if (authLoading || !user || !allowed) return null

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="font-jakarta text-2xl font-bold text-[#0B3D6B] dark:text-white">Epic Wall</h1>
        <p className="mt-1 text-sm text-[#5A6A7A] dark:text-white/50">
          Publish announcements to every student, and moderate what is on the wall.
        </p>
      </div>

      {/* Post creator — the same composer the student portal uses */}
      <WallComposer
        author={{
          uid: user.uid,
          name: user.displayName || user.email,
          role: user.role,
        }}
        onPosted={(msg) => toast.success(msg)}
        onError={(msg) => toast.error(msg)}
        placeholder="Post an announcement to the Epic Wall..."
      />

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-[#DDE3EC] dark:bg-white/10" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-2xl border border-[#DDE3EC] bg-white py-16 text-center dark:border-white/[0.08] dark:bg-white/[0.04]">
          <span className="ti ti-mood-empty text-4xl text-[#DDE3EC] dark:text-white/20" />
          <p className="mt-3 text-sm text-[#5A6A7A] dark:text-white/50">No posts on the wall yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => {
            const typeConfig = POST_TYPES.find((t) => t.value === post.type)
            return (
              <div
                key={post.id}
                className="overflow-hidden rounded-2xl border border-[#DDE3EC] bg-white shadow-sm dark:border-white/[0.08] dark:bg-white/[0.08]"
              >
                <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
                  <div className="flex items-start gap-3">
                    <WallAvatar name={post.authorName} photoUrl={post.authorPhotoUrl} size="md" />
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-[#0D1B2A] dark:text-white">{post.authorName}</p>
                        <span className="rounded-full bg-[#F5F7FB] px-2 py-0.5 text-[10px] font-semibold text-[#5A6A7A] dark:bg-white/[0.06] dark:text-white/60">
                          {ROLE_LABELS[post.authorRole] ?? post.authorRole}
                        </span>
                        {typeConfig && (
                          <span className={`flex items-center gap-1 rounded-full bg-[#F5F7FB] px-2 py-0.5 text-[10px] font-semibold dark:bg-white/[0.06] ${typeConfig.color}`}>
                            <span className={`ti ${typeConfig.icon}`} />
                            {typeConfig.label}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#5A6A7A] dark:text-white/40">{timeAgo(post.createdAt)}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={deletingId === post.id}
                    onClick={() => void handleDeletePost(post.id)}
                    aria-label="Delete post"
                    className="rounded-lg p-1.5 text-[#5A6A7A] hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-500/10"
                  >
                    <span className="ti ti-trash text-base" />
                  </button>
                </div>

                {post.content && (
                  <p className="whitespace-pre-wrap px-4 pb-3 text-sm text-[#0D1B2A] dark:text-white/90">
                    {post.content}
                  </p>
                )}

                {post.achievementBadge && (
                  <div className="px-4 pb-3">
                    <span className="rounded-xl border border-[#E8A020] bg-[#E8A020]/10 px-3 py-1.5 text-xs font-semibold text-[#E8A020]">
                      {post.achievementBadge}
                    </span>
                  </div>
                )}

                {post.photoUrls && post.photoUrls.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 px-4 pb-4">
                    {post.photoUrls.map((url, i) => (
                      <img key={i} src={url} alt="" className="h-20 w-full rounded-xl object-cover" />
                    ))}
                  </div>
                )}

                <div className="flex gap-4 border-t border-[#DDE3EC] px-4 py-2 text-xs text-[#5A6A7A] dark:border-white/[0.08] dark:text-white/40">
                  <span>{post.likeCount ?? 0} likes</span>
                  <span>{post.celebrateCount ?? 0} celebrates</span>
                  <span>{post.commentCount ?? 0} comments</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
