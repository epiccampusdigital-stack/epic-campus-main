'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'

export default function ExamCodePage() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    if (code.length !== 4) { setError('Please enter a 4-digit code'); return }
    setLoading(true)
    setError('')
    try {
      const now = new Date().toISOString()
      const snap = await getDocs(
        query(
          collection(db, 'examPapers'),
          where('accessCode', '==', code),
          where('isLive', '==', true),
        )
      )
      if (snap.empty) {
        setError('Invalid code. Please check with your teacher.')
        setLoading(false)
        return
      }
      const paper = snap.docs[0]
      const data = paper.data()
      // Check code hasn't expired
      if (data.codeExpiresAt && data.codeExpiresAt < now) {
        setError('This code has expired. Ask your teacher for the new code.')
        setLoading(false)
        return
      }
      router.push(`/exams/${paper.id}`)
    } catch (err) {
      console.error('[ExamCode]', err)
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0B3D6B]">
            <span className="ti ti-lock-open text-2xl text-[#E8A020]" />
          </div>
          <h1 className="font-jakarta text-2xl font-bold text-[#0B3D6B] dark:text-white">Enter Exam Code</h1>
          <p className="mt-1 text-sm text-[#5A6A7A] dark:text-white/50">Ask your teacher for today&apos;s 4-digit code</p>
        </div>

        <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-6 space-y-4">
          <div>
            <label className="mb-2 block text-xs font-bold uppercase text-[#5A6A7A] dark:text-white/50 tracking-wider">
              4-Digit Code
            </label>
            <input
              type="number"
              maxLength={4}
              value={code}
              onChange={e => {
                const val = e.target.value.slice(0, 4)
                setCode(val)
                setError('')
              }}
              onKeyDown={e => e.key === 'Enter' && void handleSubmit()}
              placeholder="0000"
              className="w-full rounded-xl border-2 border-[#DDE3EC] dark:border-white/20 bg-[#F5F7FB] dark:bg-white/[0.04] px-4 py-4 text-center font-mono text-4xl font-black text-[#0B3D6B] dark:text-white outline-none focus:border-[#E8A020] tracking-[0.5em]"
            />
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          <button
            type="button"
            disabled={code.length !== 4 || loading}
            onClick={() => void handleSubmit()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#E8A020] py-4 text-base font-bold text-[#0B3D6B] disabled:opacity-40"
          >
            {loading ? <><span className="ti ti-loader animate-spin" /> Checking...</> : <><span className="ti ti-arrow-right" /> Enter Exam</>}
          </button>
        </div>
      </div>
    </div>
  )
}
