'use client'

import { useEffect, useRef, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { auth, db, storage } from '@/lib/firebase/client'
import { useRouter } from 'next/navigation'

interface StudyMaterial {
  id: string
  title: string
  description: string
  courseId: string
  type: 'PDF' | 'Link' | 'Video'
  url: string
  createdAt: string
  createdBy: string
}

const COURSES = [
  { value: 'all', label: 'All Courses' },
  { value: 'japan-ssw', label: 'Japan SSW' },
  { value: 'korea', label: 'Korea' },
  { value: 'china', label: 'China' },
  { value: 'ielts', label: 'IELTS' },
  { value: 'nvq', label: 'NVQ' },
]

const TYPE_STYLES: Record<string, string> = {
  PDF: 'bg-red-50 text-red-700 border-red-200',
  Video: 'bg-purple-50 text-purple-700 border-purple-200',
  Link: 'bg-blue-50 text-blue-700 border-blue-200',
}

const ALLOWED_ADMIN_ROLES = ['admin', 'owner', 'teacher']

export default function MaterialsPage() {
  const router = useRouter()
  const [materials, setMaterials] = useState<StudyMaterial[]>([])
  const [loading, setLoading] = useState(true)
  const [courseFilter, setCourseFilter] = useState('')
  const [slideOpen, setSlideOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [userEmail, setUserEmail] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    title: '',
    description: '',
    courseId: 'japan-ssw',
    type: 'PDF' as 'PDF' | 'Link' | 'Video',
    url: '',
  })
  const [editId, setEditId] = useState<string | null>(null)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) { router.replace('/login'); return }
      const token = await u.getIdTokenResult()
      const role = token.claims.role as string
      if (!ALLOWED_ADMIN_ROLES.includes(role)) { router.replace('/dashboard'); return }
      setUserEmail(u.email ?? '')
    })
    return () => unsub()
  }, [router])

  async function loadMaterials() {
    setLoading(true)
    try {
      const snap = await getDocs(query(collection(db, 'studyMaterials'), orderBy('createdAt', 'desc')))
      setMaterials(snap.docs.map((d) => {
        const data = d.data()
        return {
          id: d.id,
          title: String(data.title ?? ''),
          description: String(data.description ?? ''),
          courseId: String(data.courseId ?? 'all'),
          type: (data.type as StudyMaterial['type']) ?? 'PDF',
          url: String(data.url ?? ''),
          createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? '',
          createdBy: String(data.createdBy ?? ''),
        }
      }))
    } catch (err) {
      console.error('[Materials]', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadMaterials() }, [])

  function resetForm() {
    setForm({ title: '', description: '', courseId: 'japan-ssw', type: 'PDF', url: '' })
    setEditId(null)
    setUploadProgress(null)
  }

  function openAdd() { resetForm(); setSlideOpen(true) }

  function openEdit(m: StudyMaterial) {
    setForm({ title: m.title, description: m.description, courseId: m.courseId, type: m.type, url: m.url })
    setEditId(m.id)
    setSlideOpen(true)
  }

  async function uploadFile(file: File, courseId: string): Promise<string> {
    const path = `study-materials/${courseId}/${Date.now()}-${file.name}`
    const storageRef = ref(storage, path)
    return new Promise((resolve, reject) => {
      const task = uploadBytesResumable(storageRef, file)
      task.on(
        'state_changed',
        (snap) => setUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
        reject,
        async () => { resolve(await getDownloadURL(task.snapshot.ref)) },
      )
    })
  }

  async function handleSave() {
    if (!form.title.trim()) return
    setSaving(true)
    try {
      let url = form.url
      if (form.type === 'PDF' && fileRef.current?.files?.[0]) {
        url = await uploadFile(fileRef.current.files[0], form.courseId)
      }
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        courseId: form.courseId,
        type: form.type,
        url,
        createdBy: userEmail,
      }
      if (editId) {
        await updateDoc(doc(db, 'studyMaterials', editId), payload)
      } else {
        await addDoc(collection(db, 'studyMaterials'), { ...payload, createdAt: serverTimestamp() })
      }
      await loadMaterials()
      setSlideOpen(false)
      resetForm()
    } catch (err) {
      console.error('[Materials save]', err)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this material?')) return
    await deleteDoc(doc(db, 'studyMaterials', id))
    setMaterials((prev) => prev.filter((m) => m.id !== id))
  }

  const filtered = courseFilter ? materials.filter((m) => m.courseId === courseFilter) : materials

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-jakarta text-2xl font-bold text-[#0D1B2A]">Study Materials</h2>
          <p className="text-sm text-[#5A6A7A]">Upload and manage resources for students</p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="inline-flex items-center gap-2 rounded-lg bg-[#E8A020] px-4 py-2 font-jakarta text-sm font-bold text-[#0B3D6B] hover:bg-[#F5B942]"
        >
          <span className="ti ti-plus" /> Add Material
        </button>
      </div>

      <div className="flex gap-2">
        <select
          value={courseFilter}
          onChange={(e) => setCourseFilter(e.target.value)}
          className="rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm"
        >
          <option value="">All Courses</option>
          {COURSES.filter((c) => c.value !== 'all').map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#DDE3EC] bg-white">
        {loading ? (
          <div className="animate-pulse divide-y divide-[#DDE3EC]">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 px-4 py-4"><div className="h-3 w-full rounded bg-[#DDE3EC]" /></div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-[#5A6A7A]">No materials yet. Click &quot;Add Material&quot; to upload one.</p>
        ) : (
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="border-b border-[#DDE3EC] bg-[#F5F7FB]">
              <tr>
                {['Title', 'Course', 'Type', 'Date', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 font-jakarta text-xs font-semibold uppercase tracking-wide text-[#5A6A7A]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DDE3EC]">
              {filtered.map((m) => (
                <tr key={m.id} className="hover:bg-[#F5F7FB]/60">
                  <td className="px-4 py-3 font-medium text-[#0D1B2A]">{m.title}</td>
                  <td className="px-4 py-3 text-[#5A6A7A]">
                    {COURSES.find((c) => c.value === m.courseId)?.label ?? m.courseId}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${TYPE_STYLES[m.type]}`}>
                      {m.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#5A6A7A]">
                    {m.createdAt ? new Date(m.createdAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      <button type="button" onClick={() => openEdit(m)}
                        className="text-xs font-semibold text-[#0B3D6B] hover:underline">Edit</button>
                      <button type="button" onClick={() => handleDelete(m.id)}
                        className="text-xs font-semibold text-red-500 hover:underline">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Slide-over form */}
      {slideOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setSlideOpen(false)} aria-hidden="true" />
          <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white/90 dark:bg-[#0d1a2e]/90 backdrop-blur-2xl border-l border-white/80 dark:border-white/[0.08] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#DDE3EC] px-6 py-4">
              <h2 className="font-jakarta text-lg font-bold text-[#0B3D6B]">
                {editId ? 'Edit Material' : 'Add Material'}
              </h2>
              <button type="button" onClick={() => setSlideOpen(false)} className="text-[#5A6A7A] hover:text-[#0B3D6B]">✕</button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-6">
              <div>
                <label className="mb-1 block text-xs font-medium text-[#5A6A7A]">Title *</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm focus:border-[#0B3D6B] focus:outline-none"
                  placeholder="Material title"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#5A6A7A]">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm focus:border-[#0B3D6B] focus:outline-none"
                  placeholder="Optional description"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#5A6A7A]">Course</label>
                <select
                  value={form.courseId}
                  onChange={(e) => setForm((f) => ({ ...f, courseId: e.target.value }))}
                  className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm focus:border-[#0B3D6B] focus:outline-none"
                >
                  {COURSES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[#5A6A7A]">Type</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as 'PDF' | 'Link' | 'Video', url: '' }))}
                  className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm focus:border-[#0B3D6B] focus:outline-none"
                >
                  <option value="PDF">PDF</option>
                  <option value="Link">Link</option>
                  <option value="Video">Video</option>
                </select>
              </div>
              {form.type === 'PDF' ? (
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#5A6A7A]">Upload PDF</label>
                  <input ref={fileRef} type="file" accept=".pdf" className="w-full text-sm text-[#5A6A7A]" />
                  {editId && form.url && (
                    <p className="mt-1 text-xs text-gray-400">Current: <a href={form.url} target="_blank" rel="noopener noreferrer" className="text-[#0B3D6B] hover:underline">View existing</a></p>
                  )}
                  {uploadProgress !== null && (
                    <div className="mt-2 h-1.5 w-full rounded-full bg-gray-100">
                      <div className="h-1.5 rounded-full bg-[#E8A020] transition-all" style={{ width: `${uploadProgress}%` }} />
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#5A6A7A]">
                    {form.type === 'Video' ? 'Video URL' : 'Link URL'}
                  </label>
                  <input
                    value={form.url}
                    onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                    className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm focus:border-[#0B3D6B] focus:outline-none"
                    placeholder="https://..."
                  />
                </div>
              )}
            </div>
            <div className="border-t border-[#DDE3EC] px-6 py-4">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !form.title.trim()}
                className="w-full rounded-lg bg-[#0B3D6B] px-4 py-2.5 font-jakarta text-sm font-semibold text-white hover:bg-[#0B3D6B]/90 disabled:opacity-60"
              >
                {saving ? 'Saving…' : editId ? 'Update Material' : 'Add Material'}
              </button>
            </div>
          </aside>
        </>
      )}
    </div>
  )
}