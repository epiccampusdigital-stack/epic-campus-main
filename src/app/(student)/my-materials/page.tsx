'use client'

import { useEffect, useState } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { getMaterialsForCourse } from '@/lib/student/portal'
import type { MaterialItem } from '@/lib/student/portal'
import { useStudentPortal } from '@/components/student/StudentContext'

const TYPE_STYLES: Record<MaterialItem['type'], string> = {
  PDF: 'bg-red-50 text-red-700 border-red-200',
  Video: 'bg-purple-50 text-purple-700 border-purple-200',
  Link: 'bg-blue-50 text-blue-700 border-blue-200',
}

export default function MyMaterialsPage() {
  const { student } = useStudentPortal()
  const [firestoreMaterials, setFirestoreMaterials] = useState<MaterialItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!student) return

    async function load() {
      setLoading(true)
      try {
        const snap = await getDocs(
          query(
            collection(db, 'materials'),
            where('courseId', '==', student!.courseId),
          ),
        ).catch(() => ({ docs: [] }))

        const fromDb = snap.docs.map((d) => {
          const data = d.data()
          return {
            id: d.id,
            title: String(data.title ?? 'Material'),
            description: String(data.description ?? ''),
            type: (data.type as MaterialItem['type']) ?? 'PDF',
            url: String(data.url ?? '#'),
          }
        })
        setFirestoreMaterials(fromDb)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [student])

  if (!student) return null

  const staticMaterials = getMaterialsForCourse(student.courseId)
  const materials = firestoreMaterials.length > 0 ? firestoreMaterials : staticMaterials

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
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {materials.map((m) => (
            <div
              key={m.id}
              className="flex flex-col rounded-xl border border-[#DDE3EC] bg-white p-5"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <h3 className="font-jakarta font-bold text-[#0D1B2A]">{m.title}</h3>
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${TYPE_STYLES[m.type]}`}
                >
                  {m.type}
                </span>
              </div>
              <p className="mb-4 flex-1 text-sm text-[#5A6A7A]">{m.description}</p>
              <a
                href={m.url}
                target={m.url.startsWith('http') ? '_blank' : undefined}
                rel={m.url.startsWith('http') ? 'noopener noreferrer' : undefined}
                className="inline-flex w-fit items-center gap-2 rounded-lg bg-[#0B3D6B] px-4 py-2 font-jakarta text-sm font-semibold text-white hover:bg-[#0f4c81]"
              >
                <span className={`ti ${m.type === 'Video' ? 'ti-player-play' : 'ti-download'}`} aria-hidden="true" />
                {m.type === 'Link' ? 'Open' : m.type === 'Video' ? 'Watch' : 'Download'}
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
