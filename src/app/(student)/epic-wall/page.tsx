'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage'
import { db, storage } from '@/lib/firebase/client'
import { useStudentPortal } from '@/components/student/StudentContext'
import WallComposer, {
  POST_TYPES,
  WallAvatar as Avatar,
  canModerateWall,
} from '@/components/wall/WallComposer'
import type {
  EpicWallComment,
  EpicWallPost,
  EpicWallReactionType,
  EpicWallStory,
} from '@/types'

const REACTION_CONFIG: Record<EpicWallReactionType, { icon: string; label: string; color: string }> = {
  like: { icon: '👍', label: 'Like', color: 'text-[#0B3D6B] dark:text-blue-300' },
  celebrate: { icon: '🎉', label: 'Celebrate', color: 'text-amber-500' },
  save: { icon: '🔖', label: 'Save', color: 'text-purple-500' },
}

function timeAgo(ts: any): string {
  if (!ts?.toDate) return ''
  const diff = (Date.now() - ts.toDate().getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

// ── Instagram-style full-screen story viewer ──────────────────────────────────
const STORY_DURATION = 5000

function StoryViewer({
  stories,
  initialIndex,
  onClose,
}: {
  stories: EpicWallStory[]
  initialIndex: number
  onClose: () => void
}) {
  const [index, setIndex] = useState(initialIndex)
  const [progress, setProgress] = useState(0)
  const [paused, setPaused] = useState(false)
  const pausedRef = useRef(false)
  const downRef = useRef<{ x: number; t: number } | null>(null)

  const goNext = useCallback(() => {
    setIndex((i) => {
      if (i >= stories.length - 1) {
        onClose()
        return i
      }
      return i + 1
    })
  }, [stories.length, onClose])

  const goPrev = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1))
  }, [])

  const goNextRef = useRef(goNext)
  useEffect(() => { goNextRef.current = goNext }, [goNext])
  useEffect(() => { pausedRef.current = paused }, [paused])

  // Auto-advance with a smooth progress bar; pauses while held.
  useEffect(() => {
    setProgress(0)
    let raf = 0
    let last: number | null = null
    let acc = 0
    const step = (ts: number) => {
      if (last === null) last = ts
      const dt = ts - last
      last = ts
      if (!pausedRef.current) {
        acc += dt
        setProgress(Math.min(100, (acc / STORY_DURATION) * 100))
        if (acc >= STORY_DURATION) {
          goNextRef.current()
          return
        }
      }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [index])

  // Keyboard: ← → navigate, Escape closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') goNext()
      else if (e.key === 'ArrowLeft') goPrev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goNext, goPrev, onClose])

  function onPointerDown(e: React.PointerEvent) {
    downRef.current = { x: e.clientX, t: Date.now() }
    setPaused(true)
  }
  function onPointerUp(e: React.PointerEvent) {
    setPaused(false)
    const d = downRef.current
    downRef.current = null
    if (!d) return
    const dx = e.clientX - d.x
    const dt = Date.now() - d.t
    if (Math.abs(dx) > 60) {
      if (dx < 0) goNext()
      else goPrev()
      return
    }
    if (dt < 250) {
      const el = e.currentTarget as HTMLElement
      const localX = e.clientX - el.getBoundingClientRect().left
      if (localX < el.clientWidth / 2) goPrev()
      else goNext()
    }
  }

  const story = stories[index]
  if (!story) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black" onClick={onClose}>
      {/* Desktop prev arrow */}
      <button
        type="button"
        aria-label="Previous story"
        onClick={(e) => { e.stopPropagation(); goPrev() }}
        className="absolute left-4 z-10 hidden h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 sm:flex"
      >
        <span className="ti ti-chevron-left text-2xl" />
      </button>

      <div
        onClick={(e) => e.stopPropagation()}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        className="relative h-screen w-full max-w-[390px] select-none overflow-hidden bg-black sm:h-[min(844px,100vh)] sm:rounded-xl"
      >
        <img
          src={story.photoUrl}
          alt=""
          draggable={false}
          className="h-full w-full object-cover object-center"
        />

        {/* Top gradient overlay */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/50 to-transparent" />

        {/* Progress bars */}
        <div className="absolute inset-x-0 top-0 z-10 flex gap-1 px-2 pt-2">
          {stories.map((_, i) => (
            <div key={i} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30">
              <div
                className="h-full bg-white"
                style={{ width: i < index ? '100%' : i === index ? `${progress}%` : '0%' }}
              />
            </div>
          ))}
        </div>

        {/* Author row */}
        <div className="absolute inset-x-0 top-4 z-10 flex items-center gap-2 px-3">
          <Avatar name={story.authorName} photoUrl={story.authorPhotoUrl ?? undefined} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{story.authorName}</p>
            <p className="text-[11px] text-white/70">{timeAgo(story.createdAt)}</p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={(e) => { e.stopPropagation(); onClose() }}
            className="text-white"
          >
            <span className="ti ti-x text-2xl" />
          </button>
        </div>

        {/* Caption */}
        {story.caption && (
          <div className="pointer-events-none absolute inset-x-0 bottom-8 px-6 text-center">
            <p className="text-sm text-white drop-shadow">{story.caption}</p>
          </div>
        )}
      </div>

      {/* Desktop next arrow */}
      <button
        type="button"
        aria-label="Next story"
        onClick={(e) => { e.stopPropagation(); goNext() }}
        className="absolute right-4 z-10 hidden h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 sm:flex"
      >
        <span className="ti ti-chevron-right text-2xl" />
      </button>
    </div>
  )
}

export default function EpicWallPage() {
  const { student, user, isAccountActive } = useStudentPortal()
  const [posts, setPosts] = useState<EpicWallPost[]>([])
  const [stories, setStories] = useState<EpicWallStory[]>([])
  const [loading, setLoading] = useState(true)
  const [myReactions, setMyReactions] = useState<Record<string, EpicWallReactionType>>({})
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set())
  const [comments, setComments] = useState<Record<string, EpicWallComment[]>>({})
  const [commentText, setCommentText] = useState<Record<string, string>>({})
  const [submittingComment, setSubmittingComment] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<string>('all')
  const [toast, setToast] = useState('')

  // Story creator state
  const [storyCreatorOpen, setStoryCreatorOpen] = useState(false)
  const [storyFile, setStoryFile] = useState<File | null>(null)
  const [storyPreview, setStoryPreview] = useState<string | null>(null)
  const [storyCaption, setStoryCaption] = useState('')
  const [postingStory, setPostingStory] = useState(false)
  const [storyViewerIndex, setStoryViewerIndex] = useState<number | null>(null)

  const isStaff = canModerateWall(user?.role)
  const authorName = student?.name ?? user?.displayName ?? user?.email ?? 'Student'
  const authorPhoto = student?.photoUrl ?? undefined

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  // Load posts (real-time)
  useEffect(() => {
    if (!user) return
    const q = query(
      collection(db, 'epicWallPosts'),
      orderBy('createdAt', 'desc'),
      limit(50),
    )
    const unsub = onSnapshot(q, (snap) => {
      setPosts(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<EpicWallPost, 'id'>) })))
      setLoading(false)
    })
    return () => unsub()
  }, [user])

  // Load stories
  useEffect(() => {
    if (!user) return
    void getDocs(
      query(collection(db, 'epicWallStories'), orderBy('createdAt', 'desc'), limit(20)),
    ).then((snap) => {
      setStories(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<EpicWallStory, 'id'>) })))
    })
  }, [user])

  // Load my reactions
  useEffect(() => {
    if (!user) return
    void getDocs(
      query(collection(db, 'epicWallReactions'), where('userId', '==', user.uid)),
    ).then((snap) => {
      const map: Record<string, EpicWallReactionType> = {}
      snap.docs.forEach((d) => {
        const data = d.data()
        map[data.postId as string] = data.type as EpicWallReactionType
      })
      setMyReactions(map)
    })
  }, [user])

  async function handleReaction(postId: string, type: EpicWallReactionType) {
    if (!user) return
    const reactionId = `${user.uid}_${postId}`
    const reactionRef = doc(db, 'epicWallReactions', reactionId)
    const postRef = doc(db, 'epicWallPosts', postId)

    try {
      // Read-then-write on local state is racy under rapid clicks / multi-tab use —
      // run the toggle as a transaction so the reaction doc and count fields stay consistent.
      const newType = await runTransaction(db, async (tx) => {
        const reactionSnap = await tx.get(reactionRef)
        const existingType = reactionSnap.exists()
          ? (reactionSnap.data().type as EpicWallReactionType)
          : undefined

        if (existingType === type) {
          tx.delete(reactionRef)
          tx.update(postRef, { [`${type}Count`]: increment(-1) })
          return undefined
        }

        if (existingType) {
          tx.update(postRef, { [`${existingType}Count`]: increment(-1) })
        }
        tx.set(reactionRef, {
          postId, userId: user.uid, type, createdAt: serverTimestamp(),
        })
        tx.update(postRef, { [`${type}Count`]: increment(1) })
        return type
      })

      setMyReactions((p) => {
        const n = { ...p }
        if (newType) n[postId] = newType
        else delete n[postId]
        return n
      })
    } catch (err) {
      console.error('[EpicWall reaction]', err)
    }
  }

  async function loadComments(postId: string) {
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

  async function submitComment(postId: string) {
    if (!user || !commentText[postId]?.trim()) return
    setSubmittingComment(postId)
    try {
      await addDoc(collection(db, 'epicWallComments'), {
        postId,
        authorId: user.uid,
        authorName,
        authorPhotoUrl: authorPhoto ?? null,
        content: commentText[postId].trim(),
        createdAt: serverTimestamp(),
      })
      await updateDoc(doc(db, 'epicWallPosts', postId), {
        commentCount: increment(1),
      })
      setCommentText((p) => ({ ...p, [postId]: '' }))
      void loadComments(postId)
    } catch (err) {
      console.error('[EpicWall comment]', err)
    } finally {
      setSubmittingComment(null)
    }
  }

  async function handleDeletePost(postId: string) {
    try {
      await deleteDoc(doc(db, 'epicWallPosts', postId))
      showToast('Post deleted')
    } catch (err) {
      console.error('[EpicWall delete]', err)
    }
  }

  async function handlePollVote(postId: string, optionIndex: number) {
    if (!user) return
    const reactionId = `poll_${user.uid}_${postId}`
    const snap = await getDocs(
      query(collection(db, 'epicWallReactions'), where('userId', '==', user.uid), where('postId', '==', postId)),
    )
    if (!snap.empty) { showToast('You already voted!'); return }
    await setDoc(doc(db, 'epicWallReactions', reactionId), {
      postId, userId: user.uid, type: 'poll', optionIndex, createdAt: serverTimestamp(),
    })
    await updateDoc(doc(db, 'epicWallPosts', postId), {
      [`pollVotes.${optionIndex}`]: increment(1),
    })
  }

  async function handlePostStory() {
    if (!user || !storyFile) return
    setPostingStory(true)
    try {
      const path = `epicStories/${user.uid}/${Date.now()}_${storyFile.name}`
      const storageRef = ref(storage, path)
      const task = uploadBytesResumable(storageRef, storyFile)
      await new Promise<void>((res, rej) => task.on('state_changed', null, rej, res))
      const url = await getDownloadURL(storageRef)
      await addDoc(collection(db, 'epicWallStories'), {
        authorId: user.uid,
        authorName,
        authorPhotoUrl: authorPhoto ?? null,
        authorRole: user.role ?? 'student',
        photoUrl: url,
        caption: storyCaption.trim() || null,
        createdAt: serverTimestamp(),
      })
      setStoryCreatorOpen(false)
      setStoryFile(null)
      setStoryPreview(null)
      setStoryCaption('')
      showToast('Story posted!')
      const storiesSnap = await getDocs(
        query(collection(db, 'epicWallStories'), orderBy('createdAt', 'desc'), limit(20)),
      )
      setStories(storiesSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<EpicWallStory, 'id'>) })))
    } catch (err) {
      console.error('[EpicWall story]', err)
      showToast('Failed to post story')
    } finally {
      setPostingStory(false)
    }
  }

  function getYouTubeEmbed(url: string): string | null {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/)
    return match ? `https://www.youtube.com/embed/${match[1]}` : null
  }

  const filteredPosts = filterType === 'all'
    ? posts
    : posts.filter((p) => p.type === filterType)

  if (!user) return null

  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-24 md:pb-6">
      {toast && (
        <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-medium text-white shadow-lg md:bottom-6">
          {toast}
        </div>
      )}

      {!isAccountActive && (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
          <span className="ti ti-lock mt-0.5 shrink-0" aria-hidden="true" />
          <p>Your account is pending activation. You can still make payments and book a consultation.</p>
        </div>
      )}

      {/* Stories row */}
      <div className="flex gap-3 overflow-x-auto pb-1 pt-1 scrollbar-hide touch-pan-x">
        <button
          type="button"
          onClick={() => setStoryCreatorOpen(true)}
          className="flex shrink-0 flex-col items-center gap-1"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-[#E8A020] bg-[#F5F7FB] dark:bg-white/[0.04]">
            <span className="ti ti-plus text-xl text-[#E8A020]" />
          </div>
          <span className="text-[10px] text-[#5A6A7A] dark:text-white/50">Add Story</span>
        </button>
        {stories.map((story, idx) => (
          <button
            key={story.id}
            type="button"
            onClick={() => setStoryViewerIndex(idx)}
            className="flex shrink-0 flex-col items-center gap-1"
          >
            <div className="h-16 w-16 rounded-full border-2 border-[#E8A020] p-0.5">
              <img
                src={story.photoUrl}
                alt={story.authorName}
                className="h-full w-full rounded-full object-cover"
              />
            </div>
            <span className="max-w-[64px] truncate text-[10px] text-[#5A6A7A] dark:text-white/50">
              {story.authorName.split(' ')[0]}
            </span>
          </button>
        ))}
      </div>

      {/* Post creator — shared composer, also used by the management portal */}
      <WallComposer
        author={{
          uid: user.uid,
          name: authorName,
          photoUrl: authorPhoto,
          role: user.role ?? 'student',
        }}
        onPosted={showToast}
        onError={showToast}
      />

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide touch-pan-x">
        <button
          type="button"
          onClick={() => setFilterType('all')}
          className={`shrink-0 ${
            filterType === 'all'
              ? 'rounded-full bg-[#E8A020] text-white font-bold px-4 py-1.5 text-sm shadow-sm'
              : 'rounded-full border border-[#DDE3EC] dark:border-white/[0.12] text-[#5A6A7A] dark:text-white/50 px-4 py-1.5 text-sm hover:border-[#0B3D6B] dark:hover:border-white/30 transition-all'
          }`}
        >
          All
        </button>
        {POST_TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setFilterType(t.value)}
            className={`shrink-0 capitalize ${
              filterType === t.value
                ? 'rounded-full bg-[#E8A020] text-white font-bold px-4 py-1.5 text-sm shadow-sm'
                : 'rounded-full border border-[#DDE3EC] dark:border-white/[0.12] text-[#5A6A7A] dark:text-white/50 px-4 py-1.5 text-sm hover:border-[#0B3D6B] dark:hover:border-white/30 transition-all'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Posts feed */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-2xl bg-[#DDE3EC] dark:bg-white/10" />
          ))}
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] py-16 text-center">
          <span className="ti ti-mood-empty text-4xl text-[#DDE3EC] dark:text-white/20" />
          <p className="mt-3 text-sm text-[#5A6A7A] dark:text-white/50">No posts yet — be the first!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPosts.map((post) => {
            const typeConfig = POST_TYPES.find((t) => t.value === post.type)
            const myReaction = myReactions[post.id]
            const postComments = comments[post.id] ?? []
            const commentsOpen = expandedComments.has(post.id)
            const canDelete = user.uid === post.authorId || isStaff
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
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => void handleDeletePost(post.id)}
                      className="rounded-lg p-1.5 text-[#5A6A7A] hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                    >
                      <span className="ti ti-trash text-sm" />
                    </button>
                  )}
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

                {/* Poll */}
                {post.type === 'poll' && post.pollOptions && post.pollOptions.length > 0 && (
                  <div className="px-4 pb-3 space-y-2">
                    {post.pollOptions.map((opt, idx) => {
                      const votes = (post.pollVotes as unknown as Record<string, number>)?.[idx] ?? 0
                      const total = Object.values(post.pollVotes ?? {}).reduce((s: number, v) => s + Number(v), 0)
                      const pct = total > 0 ? Math.round((votes / total) * 100) : 0
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => void handlePollVote(post.id, idx)}
                          className="relative w-full overflow-hidden rounded-xl border border-[#DDE3EC] dark:border-white/20 px-4 py-2.5 text-left text-sm font-medium text-[#0D1B2A] dark:text-white hover:border-[#E8A020]"
                        >
                          <div
                            className="absolute inset-y-0 left-0 bg-[#E8A020]/10 dark:bg-[#E8A020]/20 rounded-xl"
                            style={{ width: `${pct}%` }}
                          />
                          <span className="relative flex items-center justify-between">
                            <span>{opt}</span>
                            <span className="text-xs text-[#5A6A7A] dark:text-white/50">{pct}%</span>
                          </span>
                        </button>
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

                {/* Reaction bar */}
                <div className="flex items-center gap-4 border-t border-[#DDE3EC] dark:border-white/[0.06] px-4 py-2">
                  {(['like', 'celebrate', 'save'] as EpicWallReactionType[]).map((type) => {
                    const cfg = REACTION_CONFIG[type]
                    const count = type === 'like' ? post.likeCount : type === 'celebrate' ? post.celebrateCount : post.saveCount
                    const active = myReaction === type
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => void handleReaction(post.id, type)}
                        className={`flex items-center gap-1.5 rounded-full px-3 py-2.5 sm:py-2 text-sm font-semibold transition-all active:scale-95 min-h-[44px] sm:min-h-0 ${
                          active
                            ? 'bg-[#E8A020]/10 dark:bg-[#E8A020]/20 text-[#E8A020]'
                            : 'text-[#5A6A7A] dark:text-white/50 hover:bg-[#F5F7FB] dark:hover:bg-white/[0.06]'
                        }`}
                      >
                        <span>{cfg.icon}</span>
                        {count > 0 && <span>{count}</span>}
                        <span className="hidden sm:inline">{cfg.label}</span>
                      </button>
                    )
                  })}
                  <button
                    type="button"
                    onClick={() => toggleComments(post.id)}
                    className="ml-auto flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold text-[#5A6A7A] dark:text-white/50 hover:bg-[#F5F7FB] dark:hover:bg-white/[0.06] min-h-[44px] sm:min-h-0"
                  >
                    <span className="ti ti-message" />
                    {post.commentCount > 0 && <span>{post.commentCount}</span>}
                    <span>Comment</span>
                  </button>
                </div>

                {/* Comments section */}
                {commentsOpen && (
                  <div className="border-t border-[#DDE3EC] dark:border-white/[0.06] px-4 pb-4 pt-3 space-y-3">
                    {postComments.map((c) => (
                      <div key={c.id} className="flex gap-2.5">
                        <Avatar name={c.authorName} photoUrl={c.authorPhotoUrl} size="sm" />
                        <div className="flex-1 rounded-xl bg-[#F5F7FB] dark:bg-white/[0.06] px-3 py-2">
                          <p className="text-xs font-semibold text-[#0D1B2A] dark:text-white">{c.authorName}</p>
                          <p className="text-xs text-[#5A6A7A] dark:text-white/70">{c.content}</p>
                        </div>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <Avatar name={authorName} photoUrl={authorPhoto} size="sm" />
                      <div className="flex flex-1 items-center gap-2 rounded-xl border border-[#DDE3EC] dark:border-white/20 bg-white dark:bg-white/[0.06] px-3">
                        <input
                          value={commentText[post.id] ?? ''}
                          onChange={(e) => setCommentText((p) => ({ ...p, [post.id]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault()
                              void submitComment(post.id)
                            }
                          }}
                          placeholder="Write a comment…"
                          className="flex-1 bg-transparent py-2 text-xs text-[#0D1B2A] dark:text-white outline-none placeholder:text-[#5A6A7A] dark:placeholder:text-white/40"
                        />
                        <button
                          type="button"
                          disabled={submittingComment === post.id}
                          onClick={() => void submitComment(post.id)}
                          className="text-[#E8A020] disabled:opacity-50"
                        >
                          <span className="ti ti-send text-sm" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Story creator modal */}
      {storyCreatorOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={() => !postingStory && setStoryCreatorOpen(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#0d1a2e] p-6 shadow-2xl">
              <h2 className="font-jakarta font-bold text-[#0B3D6B] dark:text-white mb-4">Add Story</h2>
              {storyPreview ? (
                <div className="mb-4 relative">
                  <img src={storyPreview} alt="" className="w-full rounded-xl object-cover max-h-64" />
                  <button
                    type="button"
                    onClick={() => { setStoryFile(null); setStoryPreview(null) }}
                    className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-white text-xs"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <label className="mb-4 flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-[#DDE3EC] dark:border-white/20 py-8 hover:border-[#E8A020]">
                  <span className="ti ti-photo text-3xl text-[#5A6A7A] dark:text-white/40" />
                  <span className="text-sm text-[#5A6A7A] dark:text-white/50">Tap to select photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) { setStoryFile(file); setStoryPreview(URL.createObjectURL(file)) }
                    }}
                  />
                </label>
              )}
              <input
                value={storyCaption}
                onChange={(e) => setStoryCaption(e.target.value)}
                placeholder="Caption (optional)"
                className="mb-4 w-full rounded-xl border border-[#DDE3EC] dark:border-white/20 bg-[#F5F7FB] dark:bg-white/[0.06] px-4 py-2.5 text-sm dark:text-white outline-none"
              />
              <div className="flex gap-3">
                <button type="button" onClick={() => setStoryCreatorOpen(false)} className="flex-1 rounded-xl border border-[#DDE3EC] dark:border-white/20 py-2.5 text-sm text-[#5A6A7A] dark:text-white/60">
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!storyFile || postingStory}
                  onClick={() => void handlePostStory()}
                  className="flex-1 rounded-xl bg-[#E8A020] py-2.5 text-sm font-bold text-[#0B3D6B] disabled:opacity-50"
                >
                  {postingStory ? 'Posting…' : 'Post Story'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Story viewer */}
      {storyViewerIndex !== null && stories.length > 0 && (
        <StoryViewer
          stories={stories}
          initialIndex={storyViewerIndex}
          onClose={() => setStoryViewerIndex(null)}
        />
      )}
    </div>
  )
}
