'use client'

import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { auth } from '@/lib/firebase/client'
import type { JpCourse, JpLesson, JpModule } from '@/types'

interface CourseBuilderProps {
  courseId: string
  /** Admin/owner get full CRUD + video upload; teacher gets a read-only view. */
  canEdit: boolean
}

interface BunnyVideoInfo {
  guid: string
  title: string
  status: 'queued' | 'processing' | 'encoding' | 'finished' | 'resolution_finished' | 'failed' | 'unknown'
  length: number
  thumbnailFileName: string | null
}

interface UploadState {
  phase: 'uploading' | 'processing' | 'done' | 'error'
  progress: number
  error?: string
}

interface LessonFormState {
  title: string
  type: JpLesson['type']
  order: number
  releaseWeek: number
  isFreePreview: boolean
  description: string
}

const DEFAULT_COURSE_FORM = {
  title: 'JFT Foundation',
  level: 'JFT-Basic / N5',
  priceLKR: 25000,
  durationMonths: 5,
  published: false,
}

const EMPTY_LESSON_FORM: LessonFormState = {
  title: '',
  type: 'video',
  order: 1,
  releaseWeek: 1,
  isFreePreview: false,
  description: '',
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

async function apiCall<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const token = await auth.currentUser?.getIdToken()
  const headers = new Headers(init?.headers)
  headers.set('Authorization', `Bearer ${token ?? ''}`)
  const res = await fetch(path, { ...init, headers })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((data as { error?: string })?.error ?? `Request failed (${res.status})`)
  }
  return data as T
}

function uploadFileWithProgress(
  uploadUrl: string,
  accessKey: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', uploadUrl, true)
    xhr.setRequestHeader('AccessKey', accessKey)
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100)
        resolve()
      } else {
        reject(new Error(`Bunny upload failed (${xhr.status})`))
      }
    }
    xhr.onerror = () => reject(new Error('Bunny upload failed — network error'))
    xhr.send(file)
  })
}

async function pollVideoStatus(
  guid: string,
  onTick: (info: BunnyVideoInfo) => void,
  { intervalMs = 5000, timeoutMs = 20 * 60 * 1000 }: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<BunnyVideoInfo | null> {
  const start = Date.now()
  let last: BunnyVideoInfo | null = null
  for (;;) {
    try {
      const info = await apiCall<BunnyVideoInfo>(`/api/jp/video-status?guid=${encodeURIComponent(guid)}`)
      last = info
      onTick(info)
      if (info.status === 'finished' || info.status === 'failed') return info
    } catch (err) {
      console.error('[CourseBuilder] poll video status', err)
    }
    if (Date.now() - start > timeoutMs) return last
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
}

function statusLabel(status: BunnyVideoInfo['status']): string {
  switch (status) {
    case 'queued': return 'Queued'
    case 'processing': return 'Processing'
    case 'encoding': return 'Encoding'
    case 'finished': return 'Finished'
    case 'resolution_finished': return 'Finished (resolution)'
    case 'failed': return 'Failed'
    default: return 'Unknown'
  }
}

function statusBadgeClasses(status: BunnyVideoInfo['status']): string {
  if (status === 'finished' || status === 'resolution_finished') {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200'
  }
  if (status === 'failed') {
    return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-200'
  }
  return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200'
}

function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return '—'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${String(secs).padStart(2, '0')}`
}

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isValidBunnyGuid(value: string): boolean {
  return GUID_PATTERN.test(value.trim())
}

const inputClasses =
  'w-full rounded-lg border border-[#DDE3EC] bg-white px-3 py-2 font-inter text-sm text-[#0D1B2A] focus:border-[#1A6BAD] focus:outline-none disabled:bg-[#F5F7FB] disabled:text-[#5A6A7A] dark:border-white/10 dark:bg-slate-900 dark:text-white'
const labelClasses = 'font-inter text-xs font-medium uppercase tracking-wide text-[#5A6A7A] dark:text-white/50'
const cardClasses = 'rounded-xl border border-[#DDE3EC] bg-white p-5 dark:border-white/10 dark:bg-slate-800'

function Spinner() {
  return (
    <div className="flex h-24 items-center justify-center">
      <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-[#0B3D6B] border-t-[#E8A020]" />
    </div>
  )
}

export default function CourseBuilder({ courseId, canEdit }: CourseBuilderProps) {
  const [course, setCourse] = useState<JpCourse | null>(null)
  const [courseLoading, setCourseLoading] = useState(true)
  const [courseForm, setCourseForm] = useState(DEFAULT_COURSE_FORM)
  const [courseSaving, setCourseSaving] = useState(false)

  const [modules, setModules] = useState<JpModule[]>([])
  const [modulesLoading, setModulesLoading] = useState(false)
  const [newModuleTitle, setNewModuleTitle] = useState('')
  const [newModuleOrder, setNewModuleOrder] = useState(1)
  const [addingModule, setAddingModule] = useState(false)
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null)
  const [editModuleTitle, setEditModuleTitle] = useState('')
  const [editModuleOrder, setEditModuleOrder] = useState(1)
  const [moduleBusyId, setModuleBusyId] = useState<string | null>(null)
  const [confirmDeleteModuleId, setConfirmDeleteModuleId] = useState<string | null>(null)

  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set())
  const [lessonsByModule, setLessonsByModule] = useState<Record<string, JpLesson[]>>({})
  const [lessonsLoading, setLessonsLoading] = useState<Record<string, boolean>>({})
  const [videoInfoByGuid, setVideoInfoByGuid] = useState<Record<string, BunnyVideoInfo>>({})

  const [lessonFormModuleId, setLessonFormModuleId] = useState<string | null>(null)
  const [lessonFormEditingId, setLessonFormEditingId] = useState<string | null>(null)
  const [lessonForm, setLessonForm] = useState<LessonFormState>(EMPTY_LESSON_FORM)
  const [savingLesson, setSavingLesson] = useState(false)
  const [lessonBusyId, setLessonBusyId] = useState<string | null>(null)
  const [confirmDeleteLesson, setConfirmDeleteLesson] = useState<{ moduleId: string; lessonId: string } | null>(null)
  const [uploadState, setUploadState] = useState<Record<string, UploadState>>({})
  const [attachGuidInput, setAttachGuidInput] = useState<Record<string, string>>({})
  const [attachBusy, setAttachBusy] = useState<Record<string, boolean>>({})
  const [attachError, setAttachError] = useState<Record<string, string | undefined>>({})

  const [previewModal, setPreviewModal] = useState<{ open: boolean; loading: boolean; embedUrl: string | null; error: string | null }>({
    open: false,
    loading: false,
    embedUrl: null,
    error: null,
  })

  const refreshVideoStatus = useCallback(async (guid: string) => {
    try {
      const info = await apiCall<BunnyVideoInfo>(`/api/jp/video-status?guid=${encodeURIComponent(guid)}`)
      setVideoInfoByGuid((prev) => ({ ...prev, [guid]: info }))
    } catch (err) {
      console.error('[CourseBuilder] refresh video status', err)
    }
  }, [])

  const loadCourse = useCallback(async () => {
    setCourseLoading(true)
    try {
      const data = await apiCall<{ course: JpCourse | null }>(`/api/jp/course?courseId=${encodeURIComponent(courseId)}`)
      setCourse(data.course)
      if (data.course) {
        setCourseForm({
          title: data.course.title,
          level: data.course.level,
          priceLKR: data.course.priceLKR,
          durationMonths: data.course.durationMonths,
          published: data.course.published,
        })
      }
    } catch (err) {
      console.error('[CourseBuilder] load course', err)
      toast.error('Could not load course.')
    } finally {
      setCourseLoading(false)
    }
  }, [courseId])

  useEffect(() => {
    void loadCourse()
  }, [loadCourse])

  const loadModules = useCallback(async () => {
    setModulesLoading(true)
    try {
      const data = await apiCall<{ modules: JpModule[] }>(`/api/jp/modules?courseId=${encodeURIComponent(courseId)}`)
      setModules(data.modules)
    } catch (err) {
      console.error('[CourseBuilder] load modules', err)
      toast.error('Could not load modules.')
    } finally {
      setModulesLoading(false)
    }
  }, [courseId])

  useEffect(() => {
    if (course) void loadModules()
  }, [course, loadModules])

  const loadLessons = useCallback(
    async (moduleId: string) => {
      setLessonsLoading((prev) => ({ ...prev, [moduleId]: true }))
      try {
        const data = await apiCall<{ lessons: JpLesson[] }>(
          `/api/jp/lessons?courseId=${encodeURIComponent(courseId)}&moduleId=${encodeURIComponent(moduleId)}`,
        )
        setLessonsByModule((prev) => ({ ...prev, [moduleId]: data.lessons }))
        data.lessons
          .filter((l) => l.bunnyVideoId)
          .forEach((l) => void refreshVideoStatus(l.bunnyVideoId as string))
      } catch (err) {
        console.error('[CourseBuilder] load lessons', err)
        toast.error('Could not load lessons.')
      } finally {
        setLessonsLoading((prev) => ({ ...prev, [moduleId]: false }))
      }
    },
    [courseId, refreshVideoStatus],
  )

  async function handleCreateOrSaveCourse() {
    setCourseSaving(true)
    try {
      const payload: JpCourse = {
        id: courseId,
        title: courseForm.title.trim() || DEFAULT_COURSE_FORM.title,
        level: courseForm.level.trim(),
        priceLKR: Number(courseForm.priceLKR) || 0,
        durationMonths: Number(courseForm.durationMonths) || 0,
        published: courseForm.published,
        createdAt: course?.createdAt ?? new Date().toISOString(),
      }
      await apiCall('/api/jp/course', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ course: payload }),
      })
      const wasNew = !course
      setCourse(payload)
      toast.success(wasNew ? 'Course created' : 'Course updated')
    } catch (err) {
      console.error('[CourseBuilder] save course', err)
      toast.error(err instanceof Error ? err.message : 'Could not save course.')
    } finally {
      setCourseSaving(false)
    }
  }

  async function handleAddModule() {
    if (!newModuleTitle.trim()) return
    setAddingModule(true)
    try {
      const module: JpModule = {
        id: generateId('mod'),
        title: newModuleTitle.trim(),
        order: Number(newModuleOrder) || modules.length + 1,
        createdAt: new Date().toISOString(),
      }
      await apiCall('/api/jp/modules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId, module }),
      })
      setNewModuleTitle('')
      setNewModuleOrder(modules.length + 2)
      toast.success('Module added')
      await loadModules()
    } catch (err) {
      console.error('[CourseBuilder] add module', err)
      toast.error(err instanceof Error ? err.message : 'Could not add module.')
    } finally {
      setAddingModule(false)
    }
  }

  function startEditModule(module: JpModule) {
    setEditingModuleId(module.id)
    setEditModuleTitle(module.title)
    setEditModuleOrder(module.order)
  }

  async function handleSaveModuleEdit(module: JpModule) {
    setModuleBusyId(module.id)
    try {
      const updated: JpModule = {
        ...module,
        title: editModuleTitle.trim() || module.title,
        order: Number(editModuleOrder) || module.order,
      }
      await apiCall('/api/jp/modules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId, module: updated }),
      })
      setEditingModuleId(null)
      toast.success('Module updated')
      await loadModules()
    } catch (err) {
      console.error('[CourseBuilder] edit module', err)
      toast.error(err instanceof Error ? err.message : 'Could not update module.')
    } finally {
      setModuleBusyId(null)
    }
  }

  async function handleDeleteModule(moduleId: string) {
    setModuleBusyId(moduleId)
    try {
      await apiCall(
        `/api/jp/modules?courseId=${encodeURIComponent(courseId)}&moduleId=${encodeURIComponent(moduleId)}`,
        { method: 'DELETE' },
      )
      setConfirmDeleteModuleId(null)
      toast.success('Module deleted')
      await loadModules()
    } catch (err) {
      console.error('[CourseBuilder] delete module', err)
      toast.error(err instanceof Error ? err.message : 'Could not delete module.')
    } finally {
      setModuleBusyId(null)
    }
  }

  async function toggleModule(moduleId: string) {
    setExpandedModules((prev) => {
      const next = new Set(prev)
      if (next.has(moduleId)) next.delete(moduleId)
      else next.add(moduleId)
      return next
    })
    if (!lessonsByModule[moduleId]) {
      await loadLessons(moduleId)
    }
  }

  function openAddLessonForm(moduleId: string) {
    const existingLessons = lessonsByModule[moduleId] ?? []
    setLessonFormModuleId(moduleId)
    setLessonFormEditingId(null)
    setLessonForm({ ...EMPTY_LESSON_FORM, order: existingLessons.length + 1 })
  }

  function openEditLessonForm(moduleId: string, lesson: JpLesson) {
    setLessonFormModuleId(moduleId)
    setLessonFormEditingId(lesson.id)
    setLessonForm({
      title: lesson.title,
      type: lesson.type,
      order: lesson.order,
      releaseWeek: lesson.releaseWeek,
      isFreePreview: lesson.isFreePreview,
      description: lesson.description ?? '',
    })
  }

  function closeLessonForm() {
    setLessonFormModuleId(null)
    setLessonFormEditingId(null)
  }

  async function handleSaveLesson(moduleId: string) {
    if (!lessonForm.title.trim()) {
      toast.error('Lesson title is required.')
      return
    }
    setSavingLesson(true)
    try {
      const existing = lessonFormEditingId
        ? (lessonsByModule[moduleId] ?? []).find((l) => l.id === lessonFormEditingId)
        : null
      const lesson: JpLesson = {
        id: existing?.id ?? generateId('lesson'),
        title: lessonForm.title.trim(),
        order: Number(lessonForm.order) || 1,
        type: lessonForm.type,
        bunnyVideoId: lessonForm.type === 'video' ? existing?.bunnyVideoId ?? null : null,
        durationSec: lessonForm.type === 'video' ? existing?.durationSec ?? null : null,
        isFreePreview: lessonForm.isFreePreview,
        releaseWeek: Number(lessonForm.releaseWeek) || 1,
        description: lessonForm.description.trim() || null,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
      }
      await apiCall('/api/jp/lessons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId, moduleId, lesson }),
      })
      toast.success(existing ? 'Lesson updated' : 'Lesson added')
      await loadLessons(moduleId)
      // Stay in edit mode on the saved lesson so the video picker (if type is
      // 'video') becomes available immediately without another click.
      setLessonFormModuleId(moduleId)
      setLessonFormEditingId(lesson.id)
    } catch (err) {
      console.error('[CourseBuilder] save lesson', err)
      toast.error(err instanceof Error ? err.message : 'Could not save lesson.')
    } finally {
      setSavingLesson(false)
    }
  }

  async function handleDeleteLesson(moduleId: string, lessonId: string) {
    setLessonBusyId(lessonId)
    try {
      await apiCall(
        `/api/jp/lessons?courseId=${encodeURIComponent(courseId)}&moduleId=${encodeURIComponent(moduleId)}&lessonId=${encodeURIComponent(lessonId)}`,
        { method: 'DELETE' },
      )
      setConfirmDeleteLesson(null)
      if (lessonFormEditingId === lessonId) closeLessonForm()
      toast.success('Lesson deleted')
      await loadLessons(moduleId)
    } catch (err) {
      console.error('[CourseBuilder] delete lesson', err)
      toast.error(err instanceof Error ? err.message : 'Could not delete lesson.')
    } finally {
      setLessonBusyId(null)
    }
  }

  // Shared by the upload flow (after the file lands on Bunny) and the
  // attach-existing-GUID flow (after we've confirmed the video exists) —
  // saves bunnyVideoId onto the lesson, then polls status the same way
  // regardless of how the video got onto Bunny in the first place.
  async function attachVideoAndTrack(moduleId: string, lesson: JpLesson, guid: string) {
    const updatedLesson: JpLesson = { ...lesson, bunnyVideoId: guid }
    await apiCall('/api/jp/lessons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId, moduleId, lesson: updatedLesson }),
    })
    await loadLessons(moduleId)

    setUploadState((prev) => ({ ...prev, [lesson.id]: { phase: 'processing', progress: 100 } }))

    const finalInfo = await pollVideoStatus(guid, (info) => {
      setVideoInfoByGuid((prev) => ({ ...prev, [guid]: info }))
    })

    if (finalInfo?.status === 'finished' || finalInfo?.status === 'resolution_finished') {
      setUploadState((prev) => ({ ...prev, [lesson.id]: { phase: 'done', progress: 100 } }))
      if (finalInfo.length) {
        try {
          await apiCall('/api/jp/lessons', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              courseId,
              moduleId,
              lesson: { ...updatedLesson, durationSec: finalInfo.length },
            }),
          })
          await loadLessons(moduleId)
        } catch (err) {
          console.error('[CourseBuilder] persist duration', err)
        }
      }
      toast.success('Video ready')
    } else {
      const message =
        finalInfo?.status === 'failed' ? 'Bunny reported the video failed to process.' : 'Timed out waiting for processing — check back later.'
      setUploadState((prev) => ({ ...prev, [lesson.id]: { phase: 'error', progress: 100, error: message } }))
      toast.error(message)
    }
  }

  async function handleVideoFileSelected(moduleId: string, lesson: JpLesson, file: File) {
    setUploadState((prev) => ({ ...prev, [lesson.id]: { phase: 'uploading', progress: 0 } }))
    try {
      const { guid, uploadUrl, accessKey } = await apiCall<{ guid: string; uploadUrl: string; accessKey: string }>(
        '/api/jp/video-upload',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: lesson.title }),
        },
      )

      await uploadFileWithProgress(uploadUrl, accessKey, file, (pct) => {
        setUploadState((prev) => ({ ...prev, [lesson.id]: { phase: 'uploading', progress: pct } }))
      })

      await attachVideoAndTrack(moduleId, lesson, guid)
    } catch (err) {
      console.error('[CourseBuilder] video upload', err)
      const message = err instanceof Error ? err.message : 'Video upload failed.'
      setUploadState((prev) => ({ ...prev, [lesson.id]: { phase: 'error', progress: prev[lesson.id]?.progress ?? 0, error: message } }))
      toast.error(message)
    }
  }

  async function handleAttachExistingVideo(moduleId: string, lesson: JpLesson) {
    const guid = (attachGuidInput[lesson.id] ?? '').trim()
    if (!isValidBunnyGuid(guid)) {
      setAttachError((prev) => ({ ...prev, [lesson.id]: 'Enter a valid Bunny video GUID (e.g. 3fa85f64-5717-4562-b3fc-2c963f66afa6).' }))
      return
    }
    setAttachError((prev) => ({ ...prev, [lesson.id]: undefined }))
    setAttachBusy((prev) => ({ ...prev, [lesson.id]: true }))
    try {
      let info: BunnyVideoInfo
      try {
        info = await apiCall<BunnyVideoInfo>(`/api/jp/video-status?guid=${encodeURIComponent(guid)}`)
      } catch (err) {
        const message = err instanceof Error ? err.message : ''
        setAttachError((prev) => ({
          ...prev,
          [lesson.id]: message.includes('404') ? 'No Bunny video found with that GUID.' : message || 'Could not look up that video.',
        }))
        return
      }

      setVideoInfoByGuid((prev) => ({ ...prev, [guid]: info }))
      setAttachGuidInput((prev) => ({ ...prev, [lesson.id]: '' }))
      await attachVideoAndTrack(moduleId, lesson, guid)
    } catch (err) {
      console.error('[CourseBuilder] attach existing video', err)
      toast.error(err instanceof Error ? err.message : 'Could not attach video.')
    } finally {
      setAttachBusy((prev) => ({ ...prev, [lesson.id]: false }))
    }
  }

  async function handlePreview(lessonId: string) {
    setPreviewModal({ open: true, loading: true, embedUrl: null, error: null })
    try {
      const data = await apiCall<{ embedUrl: string; expires: number }>('/api/jp/video-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId }),
      })
      setPreviewModal({ open: true, loading: false, embedUrl: data.embedUrl, error: null })
    } catch (err) {
      setPreviewModal({
        open: true,
        loading: false,
        embedUrl: null,
        error: err instanceof Error ? err.message : 'Could not load preview.',
      })
    }
  }

  function closePreview() {
    setPreviewModal({ open: false, loading: false, embedUrl: null, error: null })
  }

  if (courseLoading) return <Spinner />

  if (!course) {
    if (!canEdit) {
      return (
        <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#DDE3EC] text-center dark:border-white/10">
          <span className="ti ti-book-2 text-2xl text-[#5A6A7A]" aria-hidden="true" />
          <p className="font-inter text-sm text-[#5A6A7A] dark:text-white/50">Course not set up yet.</p>
        </div>
      )
    }
    return (
      <div className={cardClasses}>
        <p className="font-jakarta text-sm font-bold text-[#0B3D6B] dark:text-white">Set up the JFT Foundation course</p>
        <p className="mt-1 font-inter text-xs text-[#5A6A7A] dark:text-white/50">
          This course doesn&apos;t exist in Firestore yet — create it to start building modules and lessons.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className={labelClasses}>Title</label>
            <input
              type="text"
              value={courseForm.title}
              onChange={(e) => setCourseForm((f) => ({ ...f, title: e.target.value }))}
              className={inputClasses}
            />
          </div>
          <div className="space-y-1.5">
            <label className={labelClasses}>Level</label>
            <input
              type="text"
              value={courseForm.level}
              onChange={(e) => setCourseForm((f) => ({ ...f, level: e.target.value }))}
              className={inputClasses}
            />
          </div>
          <div className="space-y-1.5">
            <label className={labelClasses}>Price (LKR)</label>
            <input
              type="number"
              value={courseForm.priceLKR}
              onChange={(e) => setCourseForm((f) => ({ ...f, priceLKR: Number(e.target.value) }))}
              className={inputClasses}
            />
          </div>
          <div className="space-y-1.5">
            <label className={labelClasses}>Duration (months)</label>
            <input
              type="number"
              value={courseForm.durationMonths}
              onChange={(e) => setCourseForm((f) => ({ ...f, durationMonths: Number(e.target.value) }))}
              className={inputClasses}
            />
          </div>
        </div>
        <label className="mt-4 flex items-center gap-2 font-inter text-sm text-[#0D1B2A] dark:text-white">
          <input
            type="checkbox"
            checked={courseForm.published}
            onChange={(e) => setCourseForm((f) => ({ ...f, published: e.target.checked }))}
            className="h-4 w-4 rounded border-[#DDE3EC]"
          />
          Published
        </label>
        <button
          type="button"
          disabled={courseSaving}
          onClick={handleCreateOrSaveCourse}
          className="mt-5 rounded-lg bg-[#E8A020] px-4 py-2 font-jakarta text-sm font-bold text-[#0B3D6B] hover:bg-[#F5B942] disabled:opacity-50"
        >
          {courseSaving ? 'Creating…' : 'Create course'}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className={cardClasses}>
        <div className="flex items-center justify-between">
          <p className="font-jakarta text-sm font-bold text-[#0B3D6B] dark:text-white">Course details</p>
          {!canEdit && (
            <span className="font-inter text-[11px] text-[#5A6A7A] dark:text-white/40">View only</span>
          )}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className={labelClasses}>Title</label>
            <input
              type="text"
              disabled={!canEdit}
              value={courseForm.title}
              onChange={(e) => setCourseForm((f) => ({ ...f, title: e.target.value }))}
              className={inputClasses}
            />
          </div>
          <div className="space-y-1.5">
            <label className={labelClasses}>Level</label>
            <input
              type="text"
              disabled={!canEdit}
              value={courseForm.level}
              onChange={(e) => setCourseForm((f) => ({ ...f, level: e.target.value }))}
              className={inputClasses}
            />
          </div>
          <div className="space-y-1.5">
            <label className={labelClasses}>Price (LKR)</label>
            <input
              type="number"
              disabled={!canEdit}
              value={courseForm.priceLKR}
              onChange={(e) => setCourseForm((f) => ({ ...f, priceLKR: Number(e.target.value) }))}
              className={inputClasses}
            />
          </div>
          <div className="space-y-1.5">
            <label className={labelClasses}>Duration (months)</label>
            <input
              type="number"
              disabled={!canEdit}
              value={courseForm.durationMonths}
              onChange={(e) => setCourseForm((f) => ({ ...f, durationMonths: Number(e.target.value) }))}
              className={inputClasses}
            />
          </div>
        </div>
        <label className="mt-4 flex items-center gap-2 font-inter text-sm text-[#0D1B2A] dark:text-white">
          <input
            type="checkbox"
            disabled={!canEdit}
            checked={courseForm.published}
            onChange={(e) => setCourseForm((f) => ({ ...f, published: e.target.checked }))}
            className="h-4 w-4 rounded border-[#DDE3EC]"
          />
          Published
        </label>
        {canEdit && (
          <button
            type="button"
            disabled={courseSaving}
            onClick={handleCreateOrSaveCourse}
            className="mt-5 rounded-lg bg-[#E8A020] px-4 py-2 font-jakarta text-sm font-bold text-[#0B3D6B] hover:bg-[#F5B942] disabled:opacity-50"
          >
            {courseSaving ? 'Saving…' : 'Save'}
          </button>
        )}
      </div>

      <div className={cardClasses}>
        <p className="font-jakarta text-sm font-bold text-[#0B3D6B] dark:text-white">Modules</p>

        {canEdit && (
          <div className="mt-3 flex flex-wrap items-end gap-2 border-b border-[#DDE3EC] pb-4 dark:border-white/10">
            <div className="flex-1 space-y-1.5">
              <label className={labelClasses}>New module title</label>
              <input
                type="text"
                value={newModuleTitle}
                onChange={(e) => setNewModuleTitle(e.target.value)}
                placeholder="e.g. Hiragana & Basic Greetings"
                className={inputClasses}
              />
            </div>
            <div className="w-24 space-y-1.5">
              <label className={labelClasses}>Order</label>
              <input
                type="number"
                value={newModuleOrder}
                onChange={(e) => setNewModuleOrder(Number(e.target.value))}
                className={inputClasses}
              />
            </div>
            <button
              type="button"
              disabled={addingModule || !newModuleTitle.trim()}
              onClick={handleAddModule}
              className="rounded-lg bg-[#1A6BAD] px-4 py-2 font-jakarta text-sm font-bold text-white hover:bg-[#155a94] disabled:opacity-50"
            >
              {addingModule ? 'Adding…' : 'Add module'}
            </button>
          </div>
        )}

        {modulesLoading ? (
          <Spinner />
        ) : modules.length === 0 ? (
          <p className="mt-4 font-inter text-sm text-[#5A6A7A] dark:text-white/50">No modules yet.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {modules
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((module) => {
                const isExpanded = expandedModules.has(module.id)
                const lessons = (lessonsByModule[module.id] ?? []).slice().sort((a, b) => a.order - b.order)
                const isEditingModule = editingModuleId === module.id

                return (
                  <div key={module.id} className="rounded-lg border border-[#DDE3EC] dark:border-white/10">
                    <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <button
                        type="button"
                        onClick={() => toggleModule(module.id)}
                        className="flex items-center gap-2 text-left"
                      >
                        <span
                          className={`ti ${isExpanded ? 'ti-chevron-down' : 'ti-chevron-right'} text-[#5A6A7A]`}
                          aria-hidden="true"
                        />
                        {isEditingModule ? (
                          <input
                            type="text"
                            value={editModuleTitle}
                            onChange={(e) => setEditModuleTitle(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className={`${inputClasses} !w-56`}
                          />
                        ) : (
                          <span className="font-jakarta text-sm font-semibold text-[#0D1B2A] dark:text-white">
                            {module.order}. {module.title}
                          </span>
                        )}
                      </button>

                      <div className="ml-auto flex items-center gap-2">
                        {canEdit && confirmDeleteModuleId !== module.id && (
                          <>
                            {isEditingModule ? (
                              <>
                                <input
                                  type="number"
                                  value={editModuleOrder}
                                  onChange={(e) => setEditModuleOrder(Number(e.target.value))}
                                  className={`${inputClasses} !w-20`}
                                />
                                <button
                                  type="button"
                                  disabled={moduleBusyId === module.id}
                                  onClick={() => handleSaveModuleEdit(module)}
                                  className="rounded-lg bg-[#E8A020] px-3 py-1.5 font-jakarta text-xs font-bold text-[#0B3D6B] hover:bg-[#F5B942] disabled:opacity-50"
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingModuleId(null)}
                                  className="font-inter text-xs text-[#5A6A7A] hover:text-[#0B3D6B] dark:text-white/50"
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => startEditModule(module)}
                                  className="font-inter text-xs text-[#1A6BAD] hover:underline"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteModuleId(module.id)}
                                  className="font-inter text-xs text-red-600 hover:underline dark:text-red-300"
                                >
                                  Delete
                                </button>
                              </>
                            )}
                          </>
                        )}
                        {canEdit && confirmDeleteModuleId === module.id && (
                          <div className="flex items-center gap-2">
                            <span className="font-inter text-xs text-[#5A6A7A] dark:text-white/50">
                              Delete this module and its lessons?
                            </span>
                            <button
                              type="button"
                              disabled={moduleBusyId === module.id}
                              onClick={() => handleDeleteModule(module.id)}
                              className="rounded-lg bg-red-600 px-3 py-1.5 font-jakarta text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
                            >
                              Confirm delete
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteModuleId(null)}
                              className="font-inter text-xs text-[#5A6A7A] hover:text-[#0B3D6B] dark:text-white/50"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-[#DDE3EC] bg-[#F5F7FB] px-4 py-4 dark:border-white/10 dark:bg-slate-900/40">
                        {lessonsLoading[module.id] ? (
                          <Spinner />
                        ) : (
                          <div className="space-y-2">
                            {lessons.length === 0 && (
                              <p className="font-inter text-sm text-[#5A6A7A] dark:text-white/50">No lessons yet.</p>
                            )}
                            {lessons.map((lesson) => {
                              const videoInfo = lesson.bunnyVideoId ? videoInfoByGuid[lesson.bunnyVideoId] : undefined
                              const upload = uploadState[lesson.id]
                              const isConfirmingDelete =
                                confirmDeleteLesson?.moduleId === module.id && confirmDeleteLesson.lessonId === lesson.id
                              const canPreview =
                                videoInfo?.status === 'finished' || videoInfo?.status === 'resolution_finished'

                              return (
                                <div
                                  key={lesson.id}
                                  className="rounded-lg border border-[#DDE3EC] bg-white px-3 py-2.5 dark:border-white/10 dark:bg-slate-800"
                                >
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-jakarta text-sm font-semibold text-[#0D1B2A] dark:text-white">
                                      {lesson.order}. {lesson.title}
                                    </span>
                                    <span className="rounded-full border border-[#DDE3EC] px-2 py-0.5 font-inter text-[11px] text-[#5A6A7A] dark:border-white/10 dark:text-white/50">
                                      {lesson.type}
                                    </span>
                                    <span className="font-inter text-[11px] text-[#5A6A7A] dark:text-white/50">
                                      Week {lesson.releaseWeek}
                                    </span>
                                    {lesson.isFreePreview && (
                                      <span className="rounded-full bg-[#E8A020]/15 px-2 py-0.5 font-inter text-[11px] font-medium text-[#0B3D6B] dark:text-[#E8A020]">
                                        Free preview
                                      </span>
                                    )}
                                    {lesson.type === 'video' && (
                                      <>
                                        {videoInfo ? (
                                          <span
                                            className={`inline-flex rounded-full border px-2 py-0.5 font-inter text-[11px] font-medium ${statusBadgeClasses(videoInfo.status)}`}
                                          >
                                            {statusLabel(videoInfo.status)}
                                          </span>
                                        ) : lesson.bunnyVideoId ? (
                                          <span className="font-inter text-[11px] text-[#5A6A7A] dark:text-white/40">
                                            Checking status…
                                          </span>
                                        ) : (
                                          <span className="font-inter text-[11px] text-[#5A6A7A] dark:text-white/40">
                                            No video
                                          </span>
                                        )}
                                        <span className="font-inter text-[11px] text-[#5A6A7A] dark:text-white/50">
                                          {formatDuration(lesson.durationSec ?? videoInfo?.length)}
                                        </span>
                                      </>
                                    )}

                                    <div className="ml-auto flex items-center gap-2">
                                      {canPreview && (
                                        <button
                                          type="button"
                                          onClick={() => handlePreview(lesson.id)}
                                          className="rounded-lg border border-[#1A6BAD] px-2.5 py-1 font-jakarta text-xs font-bold text-[#1A6BAD] hover:bg-[#1A6BAD]/10"
                                        >
                                          Preview
                                        </button>
                                      )}
                                      {canEdit && !isConfirmingDelete && (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() => openEditLessonForm(module.id, lesson)}
                                            className="font-inter text-xs text-[#1A6BAD] hover:underline"
                                          >
                                            Edit
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setConfirmDeleteLesson({ moduleId: module.id, lessonId: lesson.id })}
                                            className="font-inter text-xs text-red-600 hover:underline dark:text-red-300"
                                          >
                                            Delete
                                          </button>
                                        </>
                                      )}
                                      {canEdit && isConfirmingDelete && (
                                        <>
                                          <span className="font-inter text-xs text-[#5A6A7A] dark:text-white/50">Delete lesson?</span>
                                          <button
                                            type="button"
                                            disabled={lessonBusyId === lesson.id}
                                            onClick={() => handleDeleteLesson(module.id, lesson.id)}
                                            className="rounded-lg bg-red-600 px-2.5 py-1 font-jakarta text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
                                          >
                                            Confirm
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setConfirmDeleteLesson(null)}
                                            className="font-inter text-xs text-[#5A6A7A] hover:text-[#0B3D6B] dark:text-white/50"
                                          >
                                            Cancel
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </div>

                                  {lesson.description && (
                                    <p className="mt-1.5 font-inter text-xs text-[#5A6A7A] dark:text-white/50">{lesson.description}</p>
                                  )}

                                  {upload && (
                                    <div className="mt-2">
                                      {upload.phase === 'uploading' && (
                                        <div className="space-y-1">
                                          <div className="h-2 w-full overflow-hidden rounded-full bg-[#DDE3EC] dark:bg-white/10">
                                            <div
                                              className="h-full rounded-full bg-[#1A6BAD] transition-all"
                                              style={{ width: `${upload.progress}%` }}
                                            />
                                          </div>
                                          <p className="font-inter text-[11px] text-[#5A6A7A] dark:text-white/50">
                                            Uploading… {upload.progress}%
                                          </p>
                                        </div>
                                      )}
                                      {upload.phase === 'processing' && (
                                        <p className="font-inter text-[11px] text-[#5A6A7A] dark:text-white/50">
                                          Upload complete — waiting for Bunny to finish transcoding…
                                        </p>
                                      )}
                                      {upload.phase === 'done' && (
                                        <p className="font-inter text-[11px] text-emerald-600 dark:text-emerald-300">Video ready.</p>
                                      )}
                                      {upload.phase === 'error' && (
                                        <p className="font-inter text-[11px] text-red-600 dark:text-red-300">{upload.error}</p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {canEdit && lessonFormModuleId === module.id ? (
                          <div className="mt-4 rounded-lg border border-[#DDE3EC] bg-white p-4 dark:border-white/10 dark:bg-slate-800">
                            <p className="font-jakarta text-xs font-bold uppercase text-[#5A6A7A] dark:text-white/50">
                              {lessonFormEditingId ? 'Edit lesson' : 'New lesson'}
                            </p>
                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                              <div className="space-y-1.5 sm:col-span-2">
                                <label className={labelClasses}>Title</label>
                                <input
                                  type="text"
                                  value={lessonForm.title}
                                  onChange={(e) => setLessonForm((f) => ({ ...f, title: e.target.value }))}
                                  className={inputClasses}
                                />
                              </div>
                              <div className="space-y-1.5">
                                <label className={labelClasses}>Type</label>
                                <select
                                  value={lessonForm.type}
                                  onChange={(e) => setLessonForm((f) => ({ ...f, type: e.target.value as JpLesson['type'] }))}
                                  className={inputClasses}
                                >
                                  <option value="video">Video</option>
                                  <option value="material">Material</option>
                                  <option value="quiz">Quiz</option>
                                </select>
                              </div>
                              <div className="space-y-1.5">
                                <label className={labelClasses}>Order</label>
                                <input
                                  type="number"
                                  value={lessonForm.order}
                                  onChange={(e) => setLessonForm((f) => ({ ...f, order: Number(e.target.value) }))}
                                  className={inputClasses}
                                />
                              </div>
                              <div className="space-y-1.5">
                                <label className={labelClasses}>Release week</label>
                                <input
                                  type="number"
                                  min={1}
                                  value={lessonForm.releaseWeek}
                                  onChange={(e) => setLessonForm((f) => ({ ...f, releaseWeek: Number(e.target.value) }))}
                                  className={inputClasses}
                                />
                              </div>
                              <label className="flex items-center gap-2 pt-6 font-inter text-sm text-[#0D1B2A] dark:text-white">
                                <input
                                  type="checkbox"
                                  checked={lessonForm.isFreePreview}
                                  onChange={(e) => setLessonForm((f) => ({ ...f, isFreePreview: e.target.checked }))}
                                  className="h-4 w-4 rounded border-[#DDE3EC]"
                                />
                                Free preview
                              </label>
                              <div className="space-y-1.5 sm:col-span-2">
                                <label className={labelClasses}>Description (optional)</label>
                                <textarea
                                  value={lessonForm.description}
                                  onChange={(e) => setLessonForm((f) => ({ ...f, description: e.target.value }))}
                                  rows={2}
                                  className={inputClasses}
                                />
                              </div>
                            </div>

                            {lessonForm.type === 'video' && (
                              <div className="mt-3 rounded-lg border border-dashed border-[#DDE3EC] p-3 dark:border-white/10">
                                {lessonFormEditingId ? (
                                  <>
                                    <label className={labelClasses}>Video file</label>
                                    <input
                                      type="file"
                                      accept="video/*"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0]
                                        const editing = (lessonsByModule[module.id] ?? []).find((l) => l.id === lessonFormEditingId)
                                        if (file && editing) void handleVideoFileSelected(module.id, editing, file)
                                      }}
                                      className="mt-1 block w-full font-inter text-xs text-[#5A6A7A] dark:text-white/50"
                                    />
                                    <p className="mt-1 font-inter text-[11px] text-[#5A6A7A] dark:text-white/40">
                                      Uploads go straight to Bunny — any length or size is fine.
                                    </p>

                                    <div className="mt-3 border-t border-dashed border-[#DDE3EC] pt-3 dark:border-white/10">
                                      <label className={labelClasses}>Or attach an existing Bunny video</label>
                                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                        <input
                                          type="text"
                                          placeholder="Bunny video GUID"
                                          value={attachGuidInput[lessonFormEditingId] ?? ''}
                                          onChange={(e) => {
                                            const value = e.target.value
                                            const editingId = lessonFormEditingId
                                            setAttachGuidInput((prev) => ({ ...prev, [editingId]: value }))
                                            setAttachError((prev) => ({ ...prev, [editingId]: undefined }))
                                          }}
                                          className={`${inputClasses} min-w-[220px] flex-1`}
                                        />
                                        <button
                                          type="button"
                                          disabled={attachBusy[lessonFormEditingId] || !(attachGuidInput[lessonFormEditingId] ?? '').trim()}
                                          onClick={() => {
                                            const editing = (lessonsByModule[module.id] ?? []).find((l) => l.id === lessonFormEditingId)
                                            if (editing) void handleAttachExistingVideo(module.id, editing)
                                          }}
                                          className="rounded-lg border border-[#1A6BAD] px-3 py-2 font-jakarta text-xs font-bold text-[#1A6BAD] hover:bg-[#1A6BAD]/10 disabled:opacity-50"
                                        >
                                          {attachBusy[lessonFormEditingId] ? 'Attaching…' : 'Attach'}
                                        </button>
                                      </div>
                                      {attachError[lessonFormEditingId] && (
                                        <p className="mt-1 font-inter text-[11px] text-red-600 dark:text-red-300">
                                          {attachError[lessonFormEditingId]}
                                        </p>
                                      )}
                                    </div>
                                  </>
                                ) : (
                                  <p className="font-inter text-xs text-[#5A6A7A] dark:text-white/50">
                                    Save the lesson first, then attach a video.
                                  </p>
                                )}
                              </div>
                            )}

                            <div className="mt-4 flex items-center gap-2">
                              <button
                                type="button"
                                disabled={savingLesson}
                                onClick={() => handleSaveLesson(module.id)}
                                className="rounded-lg bg-[#E8A020] px-4 py-2 font-jakarta text-sm font-bold text-[#0B3D6B] hover:bg-[#F5B942] disabled:opacity-50"
                              >
                                {savingLesson ? 'Saving…' : lessonFormEditingId ? 'Save changes' : 'Save lesson'}
                              </button>
                              <button
                                type="button"
                                onClick={closeLessonForm}
                                className="font-inter text-xs text-[#5A6A7A] hover:text-[#0B3D6B] dark:text-white/50"
                              >
                                {lessonFormEditingId ? 'Done' : 'Cancel'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          canEdit && (
                            <button
                              type="button"
                              onClick={() => openAddLessonForm(module.id)}
                              className="mt-4 rounded-lg border border-[#1A6BAD] px-3 py-1.5 font-jakarta text-xs font-bold text-[#1A6BAD] hover:bg-[#1A6BAD]/10"
                            >
                              + Add lesson
                            </button>
                          )
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
          </div>
        )}
      </div>

      {previewModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-3xl rounded-xl bg-white p-4 dark:bg-slate-800">
            <div className="flex items-center justify-between pb-3">
              <p className="font-jakarta text-sm font-bold text-[#0B3D6B] dark:text-white">Video preview</p>
              <button
                type="button"
                onClick={closePreview}
                className="font-inter text-sm text-[#5A6A7A] hover:text-[#0B3D6B] dark:text-white/50"
              >
                Close
              </button>
            </div>
            {previewModal.loading && <Spinner />}
            {previewModal.error && (
              <p className="p-4 font-inter text-sm text-red-600 dark:text-red-300">{previewModal.error}</p>
            )}
            {previewModal.embedUrl && (
              <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
                <iframe
                  src={previewModal.embedUrl}
                  className="h-full w-full"
                  allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                  allowFullScreen
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
