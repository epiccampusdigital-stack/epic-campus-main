'use client'

import { useEffect, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { useStudentPortal } from '@/components/student/StudentContext'

interface MaterialItem {
  id: string
  title: string
  description: string
  type: 'PDF' | 'Video' | 'Link'
  url: string
}

const TYPE_STYLES: Record<MaterialItem['type'], string> = {
  PDF: 'bg-red-50 text-red-700 border-red-200',
  Video: 'bg-purple-50 text-purple-700 border-purple-200',
  Link: 'bg-blue-50 text-blue-700 border-blue-200',
}

export default function MyMaterialsPage() {
  const { student } = useStudentPortal()
  const [materials, setMaterials] = useState<MaterialItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!student) return

    async function load() {
      setLoading(true)
      try {
        const snap = await getDocs(collection(db, 'materials'))
        const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Record<string, unknown> & { id: string }))
        const filtered = all.filter(
          (m) =>
            !m.courseId ||
            m.courseId === 'all' ||
            m.courseId === student?.courseId,
        )
        setMaterials(
          filtered.map((data) => ({
            id: data.id,
            title: String(data.title ?? 'Material'),
            description: String(data.description ?? ''),
            type: (data.type as MaterialItem['type']) ?? 'PDF',
            url: String(data.url ?? '#'),
          })),
        )
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [student])

  if (!student) return null

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-jakarta text-2xl font-bold text-[#0D1B2A]">Study Materials</h2>
        <p className="text-sm text-[#5A6A7A]">Resources for your course</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-xl bg-[#DDE3EC]" />
          ))}
        </div>
      ) : materials.length === 0 ? (
        <div className="rounded-xl border border-[#DDE3EC] bg-white px-6 py-16 text-center">
          <span className="ti ti-book-off text-4xl text-[#DDE3EC]" aria-hidden="true" />
          <p className="mt-3 font-jakarta font-semibold text-[#0D1B2A]">No study materials available yet.</p>
          <p className="mt-1 text-sm text-[#5A6A7A]">Check back soon — your teachers will upload resources here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {materials.map((m) => (
            <div key={m.id} className="flex flex-col rounded-xl border border-[#DDE3EC] bg-white p-5">
              <div className="mb-2 flex items-start justify-between gap-2">
                <h3 className="font-jakarta font-bold text-[#0D1B2A]">{m.title}</h3>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${TYPE_STYLES[m.type]}`}>
                  {m.type}
                </span>
              </div>
              <p className="mb-4 flex-1 text-sm text-[#5A6A7A]">{m.description}</p>
              <a
                href={m.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-fit items-center gap-2 rounded-lg bg-[#0B3D6B] px-4 py-2 font-jakarta text-sm font-semibold text-white hover:bg-[#0f4c81]"
              >
                <span className={`ti ${m.type === 'Video' ? 'ti-player-play' : m.type === 'Link' ? 'ti-external-link' : 'ti-download'}`} aria-hidden="true" />
                {m.type === 'Link' ? 'Open' : m.type === 'Video' ? 'Watch' : 'Download'}
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
