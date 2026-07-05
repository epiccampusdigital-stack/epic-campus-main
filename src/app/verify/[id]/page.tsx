'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { collection, documentId, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'

export default function VerifyPage() {
  const { id } = useParams<{ id: string }>()

  // Detect type based on ID format
  const isCertificate = id?.startsWith('EC-')

  if (isCertificate) {
    return <VerifyCertificate certNumber={id} />
  }
  return <VerifyStudent studentId={id} />
}

interface Certificate {
  studentName: string
  courseId: string
  courseName: string
  batch: string
  certificateNumber: string
  completionDate: string
  issuedAt: string
  status: 'active' | 'revoked'
}

const COURSE_EMOJIS: Record<string, string> = {
  'japan-ssw': '🇯🇵', 'korea': '🇰🇷', 'china': '🇨🇳', 'ielts': '📝', 'nvq': '🎓',
}

function VerifyCertificate({ certNumber }: { certNumber: string }) {
  const [cert, setCert] = useState<Certificate | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    async function load() {
      if (!certNumber) return
      try {
        const snap = await getDocs(query(collection(db, 'certificates'), where('certificateNumber', '==', certNumber)))
        if (snap.empty) { setNotFound(true) }
        else { setCert(snap.docs[0].data() as Certificate) }
      } catch { setNotFound(true) }
      finally { setLoading(false) }
    }
    void load()
  }, [certNumber])

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-[#F5F7FB]">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#0B3D6B] border-t-transparent" />
    </div>
  )

  if (notFound) return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F5F7FB] p-4 text-center">
      <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
        <span className="ti ti-certificate-off text-4xl text-red-500" />
      </div>
      <h1 className="font-jakarta text-2xl font-bold text-[#0B3D6B]">Certificate Not Found</h1>
      <p className="mt-2 text-sm text-[#5A6A7A]">Certificate <span className="font-mono font-bold">{certNumber}</span> could not be verified.</p>
      <a href="https://www.epiccampus.live" className="mt-6 inline-block rounded-xl bg-[#0B3D6B] px-6 py-3 text-sm font-bold text-white">Visit EPIC Campus</a>
    </div>
  )

  const isRevoked = cert?.status === 'revoked'

  return (
    <div className="min-h-screen bg-[#F5F7FB] p-4">
      <div className="mx-auto max-w-lg space-y-6 py-8">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0B3D6B]">
            <span className="font-jakarta text-2xl font-black text-white">E</span>
          </div>
          <h1 className="font-jakarta text-xl font-bold text-[#0B3D6B]">EPIC Campus</h1>
          <p className="text-xs text-[#5A6A7A]">Certificate Verification</p>
        </div>

        <div className={`rounded-2xl p-5 text-center border ${isRevoked ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
          <span className={`ti ${isRevoked ? 'ti-x text-red-600' : 'ti-circle-check text-emerald-600'} text-3xl`} />
          <p className={`mt-2 font-jakarta text-lg font-bold ${isRevoked ? 'text-red-700' : 'text-emerald-700'}`}>
            {isRevoked ? 'Certificate Revoked' : '✓ Certificate Verified'}
          </p>
          <p className={`mt-1 text-sm ${isRevoked ? 'text-red-600' : 'text-emerald-600'}`}>
            {isRevoked ? 'This certificate has been revoked.' : 'This is an authentic EPIC Campus certificate.'}
          </p>
        </div>

        {cert && (
          <div className="rounded-2xl border border-[#DDE3EC] bg-white p-6 space-y-4">
            <h2 className="font-jakarta font-bold text-[#0B3D6B] border-b border-[#DDE3EC] pb-3">Certificate Details</h2>
            {[
              { label: 'Student Name', value: cert.studentName },
              { label: 'Course', value: `${COURSE_EMOJIS[cert.courseId] ?? '🎓'} ${cert.courseName}` },
              { label: 'Batch', value: cert.batch },
              { label: 'Completion Date', value: cert.completionDate },
              { label: 'Certificate No.', value: cert.certificateNumber },
              { label: 'Issued By', value: 'EPIC Campus (Pvt) Ltd, Sri Lanka' },
            ].map(item => (
              <div key={item.label} className="flex items-start justify-between gap-4">
                <p className="text-xs font-bold uppercase text-[#5A6A7A] tracking-wider shrink-0">{item.label}</p>
                <p className="text-sm font-semibold text-[#0D1B2A] text-right">{item.value}</p>
              </div>
            ))}
          </div>
        )}

        <p className="text-center text-xs text-[#5A6A7A]">
          Verified {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}<br />
          info@epiccampus.lk | +94 91 222 83 83
        </p>
      </div>
    </div>
  )
}

function VerifyStudent({ studentId }: { studentId: string }) {
  const [student, setStudent] = useState<{ name: string; studentCode: string; courseId: string; status: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const snap = await getDocs(query(collection(db, 'students'), where('studentCode', '==', studentId)))
        if (snap.empty) {
          const snap2 = await getDocs(query(collection(db, 'students'), where(documentId(), '==', studentId)))
          if (snap2.empty) { setNotFound(true) }
          else { setStudent(snap2.docs[0].data() as { name: string; studentCode: string; courseId: string; status: string }) }
        } else {
          setStudent(snap.docs[0].data() as { name: string; studentCode: string; courseId: string; status: string })
        }
      } catch { setNotFound(true) }
      finally { setLoading(false) }
    }
    void load()
  }, [studentId])

  const COURSE_LABELS: Record<string, string> = {
    'japan-ssw': '🇯🇵 Japan SSW', 'korea': '🇰🇷 Korea',
    'china': '🇨🇳 China', 'ielts': '📝 IELTS', 'nvq': '🎓 NVQ',
  }

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-[#F5F7FB]">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#0B3D6B] border-t-transparent" />
    </div>
  )

  if (notFound) return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F5F7FB] p-4 text-center">
      <span className="ti ti-user-off text-5xl text-[#DDE3EC]" />
      <h1 className="mt-4 font-jakarta text-2xl font-bold text-[#0B3D6B]">Student Not Found</h1>
      <p className="mt-2 text-sm text-[#5A6A7A]">No student found with ID: {studentId}</p>
    </div>
  )

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F5F7FB] p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0B3D6B]">
            <span className="font-jakarta text-2xl font-black text-white">E</span>
          </div>
          <h1 className="font-jakarta text-xl font-bold text-[#0B3D6B]">EPIC Campus</h1>
          <p className="text-xs text-[#5A6A7A]">Student Verification</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center">
          <span className="ti ti-circle-check text-3xl text-emerald-600" />
          <p className="mt-2 font-jakarta text-lg font-bold text-emerald-700">✓ Verified Student</p>
        </div>
        <div className="rounded-2xl border border-[#DDE3EC] bg-white p-6 space-y-3">
          {[
            { label: 'Name', value: student?.name ?? '—' },
            { label: 'Student Code', value: student?.studentCode ?? studentId },
            { label: 'Course', value: COURSE_LABELS[student?.courseId ?? ''] ?? student?.courseId ?? '—' },
            { label: 'Status', value: student?.status ?? 'active' },
            { label: 'Institution', value: 'EPIC Campus (Pvt) Ltd, Sri Lanka' },
          ].map(item => (
            <div key={item.label} className="flex justify-between">
              <span className="text-xs font-bold uppercase text-[#5A6A7A]">{item.label}</span>
              <span className="text-sm font-semibold text-[#0D1B2A] capitalize">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
