'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useManagement } from '@/components/layout/ManagementContext'
import TeacherSessionForm from '@/components/sessions/TeacherSessionForm'
import SessionsTable from '@/components/sessions/SessionsTable'
import { fetchTeacherSessions } from '@/lib/sessions/helpers'
import type { TeacherSession } from '@/types'

export default function SessionsPage() {
  const { user } = useManagement()
  const searchParams = useSearchParams()
  const startId = searchParams.get('start')

  const [sessions, setSessions] = useState<TeacherSession[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editSession, setEditSession] = useState<TeacherSession | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      setSessions(await fetchTeacherSessions(user.uid))
    } catch (err) {
      console.error('[SessionsPage]', err)
      setSessions([])
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  if (!user) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-48 rounded bg-[#DDE3EC] dark:bg-gray-700" />
        <div className="h-64 rounded-xl bg-[#DDE3EC] dark:bg-gray-700" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-jakarta text-2xl font-bold text-[#0D1B2A] dark:text-white">Sessions</h2>
          <p className="font-inter text-sm text-[#5A6A7A]">
            One-on-one discussions with students about exams and course progress
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditSession(null)
            setFormOpen(true)
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-[#E8A020] px-5 py-2.5 font-jakarta text-sm font-bold text-[#0B3D6B] hover:bg-[#F5B942]"
        >
          <span className="ti ti-plus" aria-hidden="true" />
          Add Session
        </button>
      </div>

      {startId && (
        <div className="rounded-lg border border-[#E8A020]/40 bg-[#E8A020]/10 px-4 py-3 text-sm text-[#0B3D6B]">
          Starting session — mark complete from the table when finished.
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-[#DDE3EC] bg-white dark:border-gray-600 dark:bg-gray-800">
        <SessionsTable
          sessions={sessions}
          loading={loading}
          autoOpenSessionId={startId}
          onAdd={() => {
            setEditSession(null)
            setFormOpen(true)
          }}
          onEdit={(s) => {
            setEditSession(s)
            setFormOpen(true)
          }}
          onRefresh={load}
        />
      </div>

      <TeacherSessionForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditSession(null)
        }}
        session={editSession}
        teacherId={user.uid}
        teacherName={user.displayName || user.email}
        onSaved={load}
      />
    </div>
  )
}
