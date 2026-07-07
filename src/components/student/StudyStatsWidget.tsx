'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { STUDY_MODES_BY_ID, type StudyModeConfig } from '@/lib/ai/studyModes'
import type { StudyMode, StudySession } from '@/types'

function parseSession(id: string, data: Record<string, unknown>): StudySession {
  function toIso(v: unknown): string {
    if (!v) return new Date().toISOString()
    if (typeof v === 'string') return v
    if (typeof v === 'object' && v !== null && 'seconds' in v)
      return new Date((v as { seconds: number }).seconds * 1000).toISOString()
    return new Date().toISOString()
  }
  return {
    id,
    studentId: String(data.studentId ?? ''),
    mode: (data.mode as StudyMode) ?? 'general',
    startedAt: toIso(data.startedAt),
    endedAt: data.endedAt ? toIso(data.endedAt) : undefined,
    messageCount: Number(data.messageCount ?? 0),
    practiceQuestionsAnswered: Number(data.practiceQuestionsAnswered ?? 0),
    practiceQuestionsCorrect: Number(data.practiceQuestionsCorrect ?? 0),
  }
}

function calcStreak(sessions: StudySession[]): number {
  const seen = new Set<string>()
  const uniqueDays = sessions
    .map((s) => s.startedAt.slice(0, 10))
    .filter((d) => {
      if (seen.has(d)) return false
      seen.add(d)
      return true
    })
    .sort((a, b) => b.localeCompare(a))

  if (uniqueDays.length === 0) return 0

  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  if (uniqueDays[0] !== today && uniqueDays[0] !== yesterday) return 0

  let streak = 0
  let expected = uniqueDays[0] === today ? today : yesterday

  for (const day of uniqueDays) {
    if (day === expected) {
      streak++
      expected = new Date(new Date(expected).getTime() - 86400000).toISOString().slice(0, 10)
    } else {
      break
    }
  }
  return streak
}

function calcWeekMinutes(sessions: StudySession[]): number {
  const weekAgo = Date.now() - 7 * 86400000
  return sessions
    .filter((s) => new Date(s.startedAt).getTime() > weekAgo && s.endedAt)
    .reduce((sum, s) => {
      const mins = Math.round(
        (new Date(s.endedAt!).getTime() - new Date(s.startedAt).getTime()) / 60000,
      )
      return sum + (mins > 0 ? mins : 0)
    }, 0)
}

function topMode(sessions: StudySession[]): StudyModeConfig | null {
  const counts: Partial<Record<StudyMode, number>> = {}
  for (const s of sessions) {
    counts[s.mode] = (counts[s.mode] ?? 0) + 1
  }
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
  return top ? (STUDY_MODES_BY_ID[top[0] as StudyMode] ?? null) : null
}

export default function StudyStatsWidget({ studentId }: { studentId: string }) {
  const [sessions, setSessions] = useState<StudySession[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!studentId) return
    getDocs(
      query(
        collection(db, 'studySessions'),
        where('studentId', '==', studentId),
        orderBy('startedAt', 'desc'),
      ),
    )
      .then((snap) =>
        setSessions(
          snap.docs.map((d) => parseSession(d.id, d.data() as Record<string, unknown>)),
        ),
      )
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [studentId])

  const streak = calcStreak(sessions)
  const weekMins = calcWeekMinutes(sessions)
  const best = topMode(sessions)

  if (loading) return null
  if (sessions.length === 0) {
    return (
      <div className="glass-card p-6 shadow-sm">
        <h2 className="mb-3 font-jakarta text-sm font-bold text-[#0B3D6B] dark:text-white">
          AI Study Assistant
        </h2>
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Start studying with the AI assistant to track your progress!
          </p>
          <Link
            href="/student/assistant"
            className="shrink-0 rounded-full bg-[#E8A020] px-4 py-2 text-xs font-semibold text-white hover:bg-[#d4911c]"
          >
            Start Now
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="glass-card p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-jakarta text-sm font-bold text-[#0B3D6B] dark:text-white">
          Study Progress
        </h2>
        <Link
          href="/student/assistant"
          className="text-xs font-medium text-[#E8A020] hover:underline"
        >
          Open Assistant →
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-[#F5F7FB] px-3 py-3 text-center dark:bg-white/[0.05]">
          <p className="font-jakarta text-2xl font-black text-[#0B3D6B] dark:text-[#E8A020]">
            {streak > 0 ? `🔥 ${streak}` : '—'}
          </p>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {streak === 1 ? 'Day streak' : 'Day streak'}
          </p>
        </div>

        <div className="rounded-xl bg-[#F5F7FB] px-3 py-3 text-center dark:bg-white/[0.05]">
          <p className="font-jakarta text-2xl font-black text-[#0B3D6B] dark:text-[#E8A020]">
            {weekMins >= 60 ? `${Math.round(weekMins / 60)}h` : `${weekMins}m`}
          </p>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">This week</p>
        </div>

        <div className="rounded-xl bg-[#F5F7FB] px-3 py-3 text-center dark:bg-white/[0.05]">
          <p className="text-lg">
            {best ? <span className={`ti ${best.icon} text-[#E8A020]`} /> : '—'}
          </p>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {best ? best.label : 'Top mode'}
          </p>
        </div>
      </div>
    </div>
  )
}
