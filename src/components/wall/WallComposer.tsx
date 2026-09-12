'use client'

import { useRef, useState } from 'react'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage'
import { db, storage } from '@/lib/firebase/client'
import { getInitials } from '@/lib/students/helpers'

/** Firestore collection backing the Epic Wall feed. */
export const WALL_POSTS_COLLECTION = 'epicWallPosts'

/** Storage prefix for wall post images — shared by every portal that composes a post. */
export const WALL_STORAGE_PREFIX = 'epicWall'

/**
 * Roles that may publish to the Epic Wall from a staff portal and delete any post.
 * Students always post as themselves and may delete their own posts.
 */
export const WALL_STAFF_ROLES = ['admin', 'owner', 'teacher', 'reception'] as const

export function canModerateWall(role: string | undefined | null): boolean {
  return !!role && (WALL_STAFF_ROLES as readonly string[]).includes(role)
}

export const POST_TYPES = [
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

export const ACHIEVEMENT_BADGES = [
  '🎌 Passed JLPT N5', '🎌 Passed JLPT N4', '🎌 Passed JLPT N3',
  '🇰🇷 Passed TOPIK I', '🇰🇷 Passed TOPIK II',
  '✈️ Visa Approved', '🛫 Departed to Japan', '🛫 Departed to Korea',
  '📚 IELTS 6.0+', '📚 IELTS 6.5+', '📚 IELTS 7.0+',
  '🏆 Top of Class', '🎓 Course Complete', '⭐ Perfect Attendance',
  '🇯🇵 Started Working in Japan', '🇰🇷 Started Working in Korea',
] as const

export function WallAvatar({
  name,
  photoUrl,
  size = 'sm',
}: {
  name: string
  photoUrl?: string
  size?: 'sm' | 'md' | 'lg'
}) {
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

/** Who the post is attributed to. Supplied by each portal from its own auth context. */
export interface WallAuthor {
  uid: string
  name: string
  photoUrl?: string
  role: string
}

interface WallComposerProps {
  author: WallAuthor
  /** Called with a success message once the post is written. */
  onPosted?: (message: string) => void
  /** Called with a failure message if the upload or write fails. */
  onError?: (message: string) => void
  /** Placeholder shown on the collapsed trigger card. */
  placeholder?: string
}

/**
 * The single Epic Wall post composer. Used by the student portal (/epic-wall) and the
 * management portal (/admin/epic-wall) — the role arrives via `author`, so the app has
 * exactly one create-post form and one image upload path.
 */
export default function WallComposer({
  author,
  onPosted,
  onError,
  placeholder = 'Share something with Epic Campus...',
}: WallComposerProps) {
  const [open, setOpen] = useState(false)
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

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, 4)
    setPostPhotos(files)
    setPostPhotosPreviews(files.map((f) => URL.createObjectURL(f)))
  }

  async function handlePost() {
    if (!postContent.trim()) return
    setPosting(true)
    try {
      let photoUrls: string[] = []
      if (postPhotos.length > 0) {
        setUploading(true)
        photoUrls = await Promise.all(
          postPhotos.map(async (file) => {
            const path = `${WALL_STORAGE_PREFIX}/${author.uid}/${Date.now()}_${file.name}`
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

      await addDoc(collection(db, WALL_POSTS_COLLECTION), {
        authorId: author.uid,
        authorName: author.name,
        authorPhotoUrl: author.photoUrl ?? null,
        authorRole: author.role,
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

      setOpen(false)
      setPostContent('')
      setPostPhotos([])
      setPostPhotosPreviews([])
      setPostVideoUrl('')
      setPollOptions(['', ''])
      setAchievementBadge('')
      setPostType('general')
      onPosted?.('Post shared to Epic Wall!')
    } catch (err) {
      console.error('[EpicWall post]', err)
      onError?.('Failed to post — please try again')
    } finally {
      setPosting(false)
      setUploading(false)
    }
  }

  return (
    <>
      {/* Post creator trigger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] px-4 py-3 text-left"
      >
        <WallAvatar name={author.name} photoUrl={author.photoUrl} size="md" />
        <span className="flex-1 rounded-full border border-[#DDE3EC] dark:border-white/[0.08] bg-[#F5F7FB] dark:bg-white/[0.08] px-4 py-2 text-sm text-[#5A6A7A] dark:text-white/40">
          {placeholder}
        </span>
      </button>

      {/* Post creator modal */}
      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={() => !posting && setOpen(false)} />
          <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
            <div className="w-full max-w-lg rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[#0d1a2e] shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-[#0d1a2e] px-5 py-4">
                <h2 className="font-jakarta font-bold text-[#0B3D6B] dark:text-white">Create Post</h2>
                <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-[#5A6A7A]">
                  <span className="ti ti-x text-lg" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {/* Author */}
                <div className="flex items-center gap-3">
                  <WallAvatar name={author.name} photoUrl={author.photoUrl} size="md" />
                  <div>
                    <p className="font-semibold text-sm text-[#0D1B2A] dark:text-white">{author.name}</p>
                    <p className="text-xs text-[#5A6A7A] dark:text-white/50 capitalize">{author.role}</p>
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
    </>
  )
}
