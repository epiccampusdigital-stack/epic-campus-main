'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useManagement } from '@/components/layout/ManagementContext'

interface Activity {
  time: string
  activity: string
  notes: string
}

interface LessonPlan {
  sessionId: string
  title: string
  date: string
  course: string
  duration: string
  objectives: string[]
  materials: string[]
  activities: Activity[]
  homework: string
  notes: string
}

export default function LessonPlanPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const router = useRouter()
  const { user } = useManagement()

  const [plan, setPlan] = useState<LessonPlan>({
    sessionId: sessionId ?? '',
    title: '',
    date: new Date().toISOString().slice(0, 10),
    course: '',
    duration: '60',
    objectives: [''],
    materials: [''],
    activities: [{ time: '0:00', activity: '', notes: '' }],
    homework: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!sessionId) return
    try {
      const snap = await getDoc(doc(db, 'lessonPlans', sessionId))
      if (snap.exists()) setPlan(snap.data() as LessonPlan)
      else {
        const sessionSnap = await getDoc(doc(db, 'sessions', sessionId)).catch(() => null)
        if (sessionSnap?.exists()) {
          const s = sessionSnap.data()
          const scheduledAt = s.scheduledAt
          const scheduledDate =
            typeof scheduledAt === 'object' && scheduledAt !== null && 'toDate' in scheduledAt
              ? (scheduledAt as { toDate: () => Date }).toDate().toISOString().slice(0, 10)
              : String(scheduledAt ?? '').slice(0, 10)
          setPlan(prev => ({
            ...prev,
            title: prev.title || String(s.topic ?? ''),
            date: prev.date || scheduledDate || prev.date,
            duration: prev.duration || String(s.duration ?? prev.duration),
          }))
        }
      }
    } catch (err) {
      console.error('[LessonPlan]', err)
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => { void load() }, [load])

  async function save() {
    if (!sessionId || !user) return
    setSaving(true)
    try {
      await setDoc(doc(db, 'lessonPlans', sessionId), {
        ...plan,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error('[SaveLessonPlan]', err)
    } finally {
      setSaving(false)
    }
  }

  const inputClass = 'w-full rounded-xl border border-[#DDE3EC] dark:border-white/20 bg-[#F5F7FB] dark:bg-white/[0.04] px-3 py-2.5 text-sm text-[#0D1B2A] dark:text-white outline-none focus:border-[#E8A020]'

  if (!user) return null
  if (loading) return <div className="animate-pulse h-64 rounded-2xl bg-[#DDE3EC] dark:bg-white/10" />

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <button type="button" onClick={() => router.push('/sessions')}
            className="flex items-center gap-2 text-sm font-semibold text-[#5A6A7A] hover:text-[#0B3D6B] dark:text-white/50 mb-2">
            <span className="ti ti-arrow-left" /> Back to Sessions
          </button>
          <h1 className="font-jakarta text-2xl font-bold text-[#0D1B2A] dark:text-white">Lesson Plan</h1>
        </div>
        <button type="button" disabled={saving} onClick={() => void save()}
          className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition-all ${saved ? 'bg-emerald-500 text-white' : 'bg-[#E8A020] text-[#0B3D6B]'} disabled:opacity-40`}>
          {saving ? <><span className="ti ti-loader animate-spin" /> Saving...</> :
           saved ? <><span className="ti ti-check" /> Saved!</> :
           <><span className="ti ti-device-floppy" /> Save Plan</>}
        </button>
      </div>

      {/* Session Details */}
      <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-5 space-y-4">
        <h2 className="font-jakarta font-bold text-[#0B3D6B] dark:text-white">Session Details</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="mb-1 block text-xs font-bold text-[#5A6A7A] dark:text-white/50">Lesson Title</label>
            <input type="text" value={plan.title} onChange={e => setPlan(p => ({ ...p, title: e.target.value }))}
              placeholder="e.g. Introduction to Japanese Greetings" className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-[#5A6A7A] dark:text-white/50">Date</label>
            <input type="date" value={plan.date} onChange={e => setPlan(p => ({ ...p, date: e.target.value }))} className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-[#5A6A7A] dark:text-white/50">Duration (mins)</label>
            <input type="number" value={plan.duration} onChange={e => setPlan(p => ({ ...p, duration: e.target.value }))} className={inputClass} />
          </div>
        </div>
      </div>

      {/* Objectives */}
      <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-jakarta font-bold text-[#0B3D6B] dark:text-white">Learning Objectives</h2>
          <button type="button" onClick={() => setPlan(p => ({ ...p, objectives: [...p.objectives, ''] }))}
            className="text-xs font-semibold text-[#E8A020] hover:underline">+ Add</button>
        </div>
        {plan.objectives.map((obj, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-[#0B3D6B] text-xs font-black text-white">{i + 1}</span>
            <input type="text" value={obj}
              onChange={e => setPlan(p => ({ ...p, objectives: p.objectives.map((o, j) => j === i ? e.target.value : o) }))}
              placeholder="Students will be able to..." className={`flex-1 ${inputClass}`} />
            {plan.objectives.length > 1 && (
              <button type="button" onClick={() => setPlan(p => ({ ...p, objectives: p.objectives.filter((_, j) => j !== i) }))}
                className="shrink-0 text-red-400 hover:text-red-600"><span className="ti ti-x text-sm" /></button>
            )}
          </div>
        ))}
      </div>

      {/* Materials */}
      <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-jakarta font-bold text-[#0B3D6B] dark:text-white">Materials Needed</h2>
          <button type="button" onClick={() => setPlan(p => ({ ...p, materials: [...p.materials, ''] }))}
            className="text-xs font-semibold text-[#E8A020] hover:underline">+ Add</button>
        </div>
        {plan.materials.map((mat, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="ti ti-circle-check text-[#E8A020] shrink-0" />
            <input type="text" value={mat}
              onChange={e => setPlan(p => ({ ...p, materials: p.materials.map((m, j) => j === i ? e.target.value : m) }))}
              placeholder="e.g. Irodori textbook p.45, flashcards" className={`flex-1 ${inputClass}`} />
            {plan.materials.length > 1 && (
              <button type="button" onClick={() => setPlan(p => ({ ...p, materials: p.materials.filter((_, j) => j !== i) }))}
                className="shrink-0 text-red-400 hover:text-red-600"><span className="ti ti-x text-sm" /></button>
            )}
          </div>
        ))}
      </div>

      {/* Activities */}
      <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-jakarta font-bold text-[#0B3D6B] dark:text-white">Class Activities</h2>
          <button type="button" onClick={() => setPlan(p => ({ ...p, activities: [...p.activities, { time: '', activity: '', notes: '' }] }))}
            className="text-xs font-semibold text-[#E8A020] hover:underline">+ Add Activity</button>
        </div>
        {plan.activities.map((act, i) => (
          <div key={i} className="rounded-xl border border-[#DDE3EC] dark:border-white/20 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <input type="text" value={act.time}
                onChange={e => setPlan(p => ({ ...p, activities: p.activities.map((a, j) => j === i ? { ...a, time: e.target.value } : a) }))}
                placeholder="0:00" className="w-20 rounded-xl border border-[#DDE3EC] dark:border-white/20 bg-[#F5F7FB] dark:bg-white/[0.04] px-3 py-2 text-sm text-[#0D1B2A] dark:text-white outline-none focus:border-[#E8A020]" />
              <input type="text" value={act.activity}
                onChange={e => setPlan(p => ({ ...p, activities: p.activities.map((a, j) => j === i ? { ...a, activity: e.target.value } : a) }))}
                placeholder="Activity name" className={`flex-1 ${inputClass}`} />
              {plan.activities.length > 1 && (
                <button type="button" onClick={() => setPlan(p => ({ ...p, activities: p.activities.filter((_, j) => j !== i) }))}
                  className="shrink-0 text-red-400 hover:text-red-600"><span className="ti ti-x text-sm" /></button>
              )}
            </div>
            <input type="text" value={act.notes}
              onChange={e => setPlan(p => ({ ...p, activities: p.activities.map((a, j) => j === i ? { ...a, notes: e.target.value } : a) }))}
              placeholder="Notes or instructions..." className={inputClass} />
          </div>
        ))}
      </div>

      {/* Homework */}
      <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-5 space-y-3">
        <h2 className="font-jakarta font-bold text-[#0B3D6B] dark:text-white">Homework Assignment</h2>
        <textarea value={plan.homework} onChange={e => setPlan(p => ({ ...p, homework: e.target.value }))}
          rows={3} placeholder="Homework for students..." className={`${inputClass} resize-none`} />
      </div>

      {/* Notes */}
      <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-5 space-y-3">
        <h2 className="font-jakarta font-bold text-[#0B3D6B] dark:text-white">Teacher Notes (Private)</h2>
        <textarea value={plan.notes} onChange={e => setPlan(p => ({ ...p, notes: e.target.value }))}
          rows={3} placeholder="Private notes for this lesson..." className={`${inputClass} resize-none`} />
      </div>
    </div>
  )
}
