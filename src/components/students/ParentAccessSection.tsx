'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from 'firebase/firestore'
import { auth, db } from '@/lib/firebase/client'
import { generateParentAccessCode, parseParentAccount } from '@/lib/parent/helpers'
import { useManagement } from '@/components/layout/ManagementContext'
import type { ParentAccount, Student } from '@/types'

interface ParentAccessSectionProps {
  student: Student
  onUpdated: () => void
}

export default function ParentAccessSection({
  student,
  onUpdated,
}: ParentAccessSectionProps) {
  const { user } = useManagement()
  const [code, setCode] = useState(student.parentAccessCode ?? '')
  const [enabled, setEnabled] = useState(student.parentAccessEnabled !== false)
  const [linkedParent, setLinkedParent] = useState<ParentAccount | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isAdmin = user?.role === 'admin' || user?.role === 'owner'

  const loadParent = useCallback(async () => {
    setLoading(true)
    try {
      const snap = await getDocs(
        query(collection(db, 'parentAccounts'), where('studentId', '==', student.id)),
      )
      if (!snap.empty) {
        const d = snap.docs[0]
        setLinkedParent(parseParentAccount(d.id, d.data() as Record<string, unknown>))
      } else {
        setLinkedParent(null)
      }
    } catch (err) {
      console.error('[ParentAccess]', err)
    } finally {
      setLoading(false)
    }
  }, [student.id])

  useEffect(() => {
    setCode(student.parentAccessCode ?? '')
    setEnabled(student.parentAccessEnabled !== false)
    void loadParent()
  }, [student.parentAccessCode, student.parentAccessEnabled, student.id, loadParent])

  useEffect(() => {
    if (student.parentAccessCode || loading || saving) return

    async function ensureCode() {
      const newCode = generateParentAccessCode()
      setSaving(true)
      try {
        await updateDoc(doc(db, 'students', student.id), {
          parentAccessCode: newCode,
          parentAccessEnabled: true,
        })
        setCode(newCode)
        setEnabled(true)
        onUpdated()
      } catch (err) {
        console.error('[ParentAccess] ensure code', err)
      } finally {
        setSaving(false)
      }
    }

    void ensureCode()
  }, [student.parentAccessCode, student.id, loading, saving, onUpdated])

  async function patchStudent(fields: Record<string, unknown>) {
    setSaving(true)
    setError('')
    try {
      await updateDoc(doc(db, 'students', student.id), fields)
      onUpdated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle() {
    const next = !enabled
    setEnabled(next)
    await patchStudent({ parentAccessEnabled: next })
  }

  async function handleRegenerate() {
    const newCode = generateParentAccessCode()
    setCode(newCode)
    await patchStudent({ parentAccessCode: newCode, parentAccessEnabled: true })
    setEnabled(true)
  }

  async function handleRemoveAccess() {
    if (!isAdmin) return
    if (
      !window.confirm(
        'Remove parent access? This deletes the linked parent login. This cannot be undone.',
      )
    ) {
      return
    }

    setSaving(true)
    setError('')
    try {
      const token = await auth.currentUser?.getIdToken()
      if (!token) throw new Error('Not signed in')

      const res = await fetch('/api/parent/remove-access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ studentId: student.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to remove access')

      setLinkedParent(null)
      setEnabled(false)
      onUpdated()
      await loadParent()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove access')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-[#DDE3EC] bg-[#F5F7FB] p-6">
      <h3 className="font-jakarta text-sm font-bold uppercase tracking-wide text-[#0B3D6B]">
        Parent Access
      </h3>
      <p className="mt-2 font-inter text-sm text-[#5A6A7A]">
        Share this code with the parent. They create an account at{' '}
        <span className="font-medium text-[#0B3D6B]">epiccampus.lk/parent-register</span>{' '}
        using this code to link to this student.
      </p>

      {error && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <div>
          <p className="text-xs font-medium uppercase text-[#5A6A7A]">Access code</p>
          <p className="mt-1 font-mono text-3xl font-bold tracking-[0.3em] text-[#0B3D6B]">
            {code || (saving ? '…' : '------')}
          </p>
        </div>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={enabled}
            disabled={saving}
            onChange={() => void handleToggle()}
            className="h-4 w-4 rounded border-[#DDE3EC] text-[#E8A020] focus:ring-[#E8A020]"
          />
          <span className="font-inter text-sm font-medium text-[#0D1B2A]">
            Parent access enabled
          </span>
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => void handleRegenerate()}
          className="inline-flex items-center gap-2 rounded-lg border border-[#0B3D6B] px-4 py-2 font-jakarta text-sm font-semibold text-[#0B3D6B] hover:bg-[#0B3D6B]/5 disabled:opacity-60"
        >
          <span className="ti ti-refresh" aria-hidden="true" />
          Regenerate Code
        </button>
        {isAdmin && linkedParent && (
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleRemoveAccess()}
            className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-4 py-2 font-jakarta text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
          >
            <span className="ti ti-unlink" aria-hidden="true" />
            Remove Parent Access
          </button>
        )}
      </div>

      <div className="mt-4 rounded-lg border border-[#DDE3EC] bg-white p-4">
        <p className="text-xs font-medium uppercase text-[#5A6A7A]">Linked parent</p>
        {loading ? (
          <p className="mt-2 text-sm text-[#5A6A7A]">Loading…</p>
        ) : linkedParent ? (
          <dl className="mt-2 space-y-1">
            <div className="flex justify-between gap-4 text-sm">
              <dt className="text-[#5A6A7A]">Name</dt>
              <dd className="font-medium text-[#0D1B2A]">{linkedParent.parentName}</dd>
            </div>
            <div className="flex justify-between gap-4 text-sm">
              <dt className="text-[#5A6A7A]">Email</dt>
              <dd className="font-medium text-[#0D1B2A]">{linkedParent.email}</dd>
            </div>
            {linkedParent.phone && (
              <div className="flex justify-between gap-4 text-sm">
                <dt className="text-[#5A6A7A]">Phone</dt>
                <dd className="font-medium text-[#0D1B2A]">{linkedParent.phone}</dd>
              </div>
            )}
          </dl>
        ) : (
          <p className="mt-2 text-sm text-[#5A6A7A]">No parent account linked yet.</p>
        )}
      </div>
    </div>
  )
}
