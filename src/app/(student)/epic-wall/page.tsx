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
import { getInitials } from '@/lib/students/helpers'
import type {
  EpicWallComment,
  EpicWallPost,
  EpicWallReactionType,
  EpicWallStory,
} from '@/types'

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

const ACHIEVEMENT_BADGES = [
  '🎌 Passed JLPT N5', '🎌 Passed JLPT N4', '🎌 Passed JLPT N3',
  '🇰🇷 Passed TOPIK I', '🇰🇷 Passed TOPIK II',
  '✈️ Visa Approved', '🛫 Departed to Japan', '🛫 Departed to Korea',
  '📚 IELTS 6.0+', '📚 IELTS 6.5+', '📚 IELTS 7.0+',
  '🏆 Top of Class', '🎓 Course Complete', '⭐ Perfect Attendance',
  '🇯🇵 Started Working in Japan', '🇰🇷 Started Working in Korea',
] as const

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

export default function EpicWallPage() {
  const { student, user } = useStudentPortal()
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

  // Post creator state
  const [creatorOpen, setCreatorOpen] = useState(false)
  const [postType, setPostType] = useState<string>('general')
  const [postContent, setPostContent] = useState('')
  const [postPhotos, setPostPhotos] = useState<File[]>([])
  const [postPhotosPreviews, setPostPhotosPreviews] = useState<string[]>([])
  const [postVideoUrl, setPostVideoUrl] = useState('')
  const [pollOptions, setPollOptions] = useState(['', ''])
  const [achievementBadge, setAchievementBadge] = useState('')
  const [uploading, setUploading] = useState(false)
  const [posting, setPosting] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)

  // Story creator state
  const [storyCreatorOpen, setStoryCreatorOpen] = useState(false)
  const [storyFile, setStoryFile] = useState<File | null>(null)
  const [storyPreview, setStoryPreview] = useState<string | null>(null)
  const [storyCaption, setStoryCaption] = useState('')
  const [postingStory, setPostingStory] = useState(false)
  const [viewingStory, setViewingStory] = useState<EpicWallStory | null>(null)

  const isStaff = user?.role === 'admin' || user?.role === 'owner' || user?.role === 'teacher' || user?.role === 'reception'
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

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, 4)
    setPostPhotos(files)
    setPostPhotosPreviews(files.map((f) => URL.createObjectURL(f)))
  }

  async function handlePost() {
    if (!user || !postContent.trim()) return
    setPosting(true)
    try {
      let photoUrls: string[] = []
      if (postPhotos.length > 0) {
        setUploading(true)
        photoUrls = await Promise.all(
          postPhotos.map(async (file) => {
            const path = `epicWall/${user.uid}/${Date.now()}_${file.name}`
            const storageRef = ref(storage, path)
            const task = uploadBytesResumable(storageRef, file)
            await new Promise<void>((res, rej) => task.on('state_changed', null, rej, res))
            return getDownloadURL(storageRef)
          }),
        )
        setUploading(false)
      }

      const pollVotesInit: Record<string, number> = {}
      if (postType === 'poll') {
        pollOptions.filter(Boolean).forEach((_, i) => { pollVotesInit[i] = 0 })
      }

      await addDoc(collection(db, 'epicWallPosts'), {
        authorId: user.uid,
        authorName,
        authorPhotoUrl: authorPhoto ?? null,
        authorRole: user.role ?? 'student',
        type: postType,
        content: postContent.trim(),
        photoUrls: photoUrls.length > 0 ? photoUrls : [],
        videoUrl: postVideoUrl.trim() || null,
        pollOptions: postType === 'poll' ? pollOptions.filter(Boolean) : [],
        pollVotes: postType === 'poll' ? pollVotesInit : {},
        achievementBadge: postType === 'achievement' ? achievementBadge : null,
        likeCount: 0,
        celebrateCount: 0,
        commentCount: 0,
        saveCount: 0,
        createdAt: serverTimestamp(),
      })

      setCreatorOpen(false)
      setPostContent('')
      setPostPhotos([])
      setPostPhotosPreviews([])
      setPostVideoUrl('')
      setPollOptions(['', ''])
      setAchievementBadge('')
      setPostType('general')
      showToast('Post shared to Epic Wall!')
    } catch (err) {
      console.error('[EpicWall post]', err)
      showToast('Failed to post — please try again')
    } finally {
      setPosting(false)
      setUploading(false)
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
        {stories.map((story) => (
          <button
            key={story.id}
            type="button"
            onClick={() => setViewingStory(story)}
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

      {/* Post creator trigger */}
      <button
        type="button"
        onClick={() => setCreatorOpen(true)}
        className="flex w-full items-center gap-3 rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] px-4 py-3 text-left"
      >
        <Avatar name={authorName} photoUrl={authorPhoto} size="md" />
        <span className="flex-1 rounded-full border border-[#DDE3EC] dark:border-white/[0.08] bg-[#F5F7FB] dark:bg-white/[0.08] px-4 py-2 text-sm text-[#5A6A7A] dark:text-white/40">
          Share something with Epic Campus...
        </span>
      </button>

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

      {/* Post creator modal */}
      {creatorOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={() => !posting && setCreatorOpen(false)} />
          <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
            <div className="w-full max-w-lg rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[#0d1a2e] shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-[#0d1a2e] px-5 py-4">
                <h2 className="font-jakarta font-bold text-[#0B3D6B] dark:text-white">Create Post</h2>
                <button type="button" onClick={() => setCreatorOpen(false)} className="rounded-lg p-1.5 text-[#5A6A7A]">
                  <span className="ti ti-x text-lg" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {/* Author */}
                <div className="flex items-center gap-3">
                  <Avatar name={authorName} photoUrl={authorPhoto} size="md" />
                  <div>
                    <p className="font-semibold text-sm text-[#0D1B2A] dark:text-white">{authorName}</p>
                    <p className="text-xs text-[#5A6A7A] dark:text-white/50 capitalize">{user.role}</p>
                  </div>
                </div>

                {/* Post type selector */}
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {POST_TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setPostType(t.value)}
                      className={`shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                        postType === t.value
                          ? 'bg-[#0B3D6B] text-white'
                          : 'border border-[#DDE3EC] dark:border-white/20 text-[#5A6A7A] dark:text-white/60'
                      }`}
                    >
                      <span className={`ti ${t.icon}`} />
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Achievement badge selector */}
                {postType === 'achievement' && (
                  <div>
                    <label className="mb-2 block text-xs font-medium text-[#5A6A7A] dark:text-white/50">Select Badge</label>
                    <div className="flex flex-wrap gap-2">
                      {ACHIEVEMENT_BADGES.map((badge) => (
                        <button
                          key={badge}
                          type="button"
                          onClick={() => setAchievementBadge(badge)}
                          className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all ${
                            achievementBadge === badge
                              ? 'border-[#E8A020] bg-[#E8A020]/10 text-[#E8A020]'
                              : 'border-[#DDE3EC] dark:border-white/20 text-[#5A6A7A] dark:text-white/60'
                          }`}
                        >
                          {badge}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Content */}
                <textarea
                  value={postContent}
                  onChange={(e) => setPostContent(e.target.value)}
                  placeholder={
                    postType === 'achievement' ? 'Share your achievement story...'
                    : postType === 'visa_approved' ? 'Share the great news...'
                    : postType === 'tip' ? 'Share a helpful study tip...'
                    : postType === 'poll' ? 'Ask your question...'
                    : "What's on your mind?"
                  }
                  rows={4}
                  className="w-full resize-none rounded-xl border border-[#DDE3EC] dark:border-white/20 bg-[#F5F7FB] dark:bg-white/[0.06] px-4 py-3 text-sm text-[#0D1B2A] dark:text-white outline-none focus:border-[#E8A020]"
                />

                {/* Poll options */}
                {postType === 'poll' && (
                  <div className="space-y-2">
                    {pollOptions.map((opt, i) => (
                      <input
                        key={i}
                        value={opt}
                        onChange={(e) => setPollOptions((p) => p.map((o, j) => j === i ? e.target.value : o))}
                        placeholder={`Option ${i + 1}`}
                        className="w-full rounded-xl border border-[#DDE3EC] dark:border-white/20 bg-[#F5F7FB] dark:bg-white/[0.06] px-4 py-2.5 text-sm dark:text-white outline-none"
                      />
                    ))}
                    {pollOptions.length < 4 && (
                      <button
                        type="button"
                        onClick={() => setPollOptions((p) => [...p, ''])}
                        className="text-xs text-[#E8A020] font-semibold"
                      >
                        + Add option
                      </button>
                    )}
                  </div>
                )}

                {/* Video URL */}
                <div>
                  <input
                    value={postVideoUrl}
                    onChange={(e) => setPostVideoUrl(e.target.value)}
                    placeholder="YouTube link (optional)"
                    className="w-full rounded-xl border border-[#DDE3EC] dark:border-white/20 bg-[#F5F7FB] dark:bg-white/[0.06] px-4 py-2.5 text-sm dark:text-white outline-none focus:border-[#E8A020]"
                  />
                </div>

                {/* Photo upload */}
                <div>
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="flex items-center gap-2 rounded-xl border border-dashed border-[#DDE3EC] dark:border-white/20 px-4 py-2.5 text-sm font-medium text-[#5A6A7A] dark:text-white/60 hover:border-[#E8A020] w-full justify-center"
                  >
                    <span className="ti ti-photo" />
                    Add Photos (up to 4)
                  </button>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handlePhotoSelect}
                  />
                  {postPhotosPreviews.length > 0 && (
                    <div className="mt-2 grid grid-cols-4 gap-2">
                      {postPhotosPreviews.map((url, i) => (
                        <div key={i} className="relative">
                          <img src={url} alt="" className="h-16 w-full rounded-xl object-cover" />
                          <button
                            type="button"
                            onClick={() => {
                              setPostPhotos((p) => p.filter((_, j) => j !== i))
                              setPostPhotosPreviews((p) => p.filter((_, j) => j !== i))
                            }}
                            className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] text-white"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="sticky bottom-0 border-t border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-[#0d1a2e] px-5 py-4">
                <button
                  type="button"
                  disabled={posting || !postContent.trim()}
                  onClick={() => void handlePost()}
                  className="w-full rounded-xl bg-[#E8A020] py-3 text-sm font-bold text-[#0B3D6B] hover:bg-[#d4911c] disabled:opacity-50"
                >
                  {uploading ? 'Uploading photos…' : posting ? 'Posting…' : 'Share Post'}
                </button>
              </div>
            </div>
          </div>
        </>
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
      {viewingStory && (
        <div className="fixed inset-0 z-50 bg-black" onClick={() => setViewingStory(null)}>
          <button type="button" className="absolute right-4 top-4 z-10 text-white" onClick={() => setViewingStory(null)}>
            <span className="ti ti-x text-2xl" />
          </button>
          <img
            src={viewingStory.photoUrl}
            alt=""
            className="h-full w-full object-contain"
          />
          <div className="absolute bottom-8 left-0 right-0 px-6 text-center">
            <p className="font-semibold text-white">{viewingStory.authorName}</p>
            {viewingStory.caption && (
              <p className="mt-1 text-sm text-white/80">{viewingStory.caption}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
