import { COURSE_MAP } from '@/lib/constants/courses'
import { adminDb } from '@/lib/firebase/admin'
import { LOCATION_LABELS } from '@/lib/students/helpers'
import type { CourseId, StudentLocation } from '@/types'

interface VerifyPageProps {
  params: { studentId: string }
}

function locationLabel(location?: StudentLocation): string {
  if (location && LOCATION_LABELS[location]) {
    return `${LOCATION_LABELS[location]} Campus`
  }
  return 'Epic Campus'
}

export default async function VerifyStudentPage({ params }: VerifyPageProps) {
  const snap = await adminDb.collection('students').doc(params.studentId).get()
  const today = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  if (!snap.exists) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl border border-[#DDE3EC] bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <span className="ti ti-x text-3xl text-red-600" aria-hidden="true" />
          </div>
          <h1 className="font-jakarta text-xl font-bold text-[#0D1B2A]">Student not found</h1>
          <p className="mt-3 text-sm text-[#5A6A7A]">
            Please contact Epic Campus:{' '}
            <a href="tel:+94912228383" className="font-semibold text-[#0B3D6B]">
              +94 91 222 83 83
            </a>
          </p>
        </div>
      </div>
    )
  }

  const data = snap.data()!
  const name = String(data.name ?? 'Student')
  const courseId = String(data.courseId ?? '') as CourseId
  const course = COURSE_MAP[courseId]?.label ?? courseId
  const studentCode = String(data.studentCode ?? '—')
  const status = String(data.status ?? 'pending')
  const isActive = status === 'active'
  const location = locationLabel(data.location as StudentLocation | undefined)

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-[#DDE3EC] bg-white p-8 text-center shadow-sm">
        <p className="font-jakarta text-lg font-bold text-[#0B3D6B]">
          EPiC <span className="text-[#E8A020]">campus</span>
        </p>

        <div className="mx-auto mt-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
          <span className="ti ti-check text-3xl text-emerald-600" aria-hidden="true" />
        </div>

        <h1 className="mt-5 font-jakarta text-2xl font-bold text-[#0B3D6B]">{name}</h1>

        <span className="mt-3 inline-flex rounded-full bg-[#E8A020] px-3 py-1 text-xs font-bold text-[#0B3D6B]">
          {course}
        </span>

        <p className="mt-4 font-mono text-sm text-[#5A6A7A]">{studentCode}</p>
        <p className="mt-1 text-sm text-[#5A6A7A]">{location}</p>

        <span
          className={`mt-4 inline-flex rounded-full px-3 py-1 text-xs font-bold capitalize ${
            isActive
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-red-100 text-red-700'
          }`}
        >
          {isActive ? 'Active' : 'Inactive'}
        </span>

        <p className="mt-6 text-xs text-gray-400">Verified by Epic Campus</p>
        <p className="mt-1 text-xs text-gray-400">{today}</p>
      </div>
    </div>
  )
}
