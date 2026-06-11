'use client'

import { useEffect, useState } from 'react'
import { collection, doc, getDocs, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { AGENT_ROLES, STAFF_REFERRAL_ROLES } from '@/lib/students/helpers'
import { ROLE_LABELS } from '@/lib/constants/roles'
import { useManagement } from '@/components/layout/ManagementContext'
import type { Role, Student } from '@/types'

interface StudentAgentSectionProps {
  student: Student
  onUpdated: () => void
}

export default function StudentAgentSection({ student, onUpdated }: StudentAgentSectionProps) {
  const { user } = useManagement()
  const [agents, setAgents] = useState<{ uid: string; displayName: string; role: Role }[]>([])
  const [staffReferrers, setStaffReferrers] = useState<{ uid: string; displayName: string; role: Role }[]>([])
  const [agentRole, setAgentRole] = useState<string>('')
  const [changing, setChanging] = useState(false)
  const [changingReferral, setChangingReferral] = useState(false)
  const [pickId, setPickId] = useState(student.agentId ?? '')
  const [referralId, setReferralId] = useState(student.referredByStaffId ?? '')
  const [saving, setSaving] = useState(false)
  const [savingReferral, setSavingReferral] = useState(false)

  const isAdmin = user?.role === 'admin' || user?.role === 'owner'

  useEffect(() => {
    void getDocs(collection(db, 'users')).then((snap) => {
      const all = snap.docs.map((d) => ({
        uid: d.id,
        displayName: String(d.data().displayName ?? d.data().email ?? 'Staff'),
        role: d.data().role as Role,
      }))
      const agentList = all
        .filter((a) => (AGENT_ROLES as readonly string[]).includes(a.role))
        .sort((a, b) => a.displayName.localeCompare(b.displayName))
      const staffList = all
        .filter((a) => (STAFF_REFERRAL_ROLES as readonly string[]).includes(a.role))
        .sort((a, b) => a.displayName.localeCompare(b.displayName))
      setAgents(agentList)
      setStaffReferrers(staffList)
      if (student.agentId) {
        const match = agentList.find((a) => a.uid === student.agentId)
        setAgentRole(match ? ROLE_LABELS[match.role] ?? match.role : '')
      }
    })
  }, [student.agentId])

  async function handleSaveAgent() {
    if (!pickId) return
    const agent = agents.find((a) => a.uid === pickId)
    if (!agent) return
    setSaving(true)
    try {
      await updateDoc(doc(db, 'students', student.id), {
        agentId: agent.uid,
        agentName: agent.displayName,
      })
      setChanging(false)
      onUpdated()
    } catch (err) {
      console.error(err)
      alert('Could not update agent')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveReferral() {
    setSavingReferral(true)
    try {
      const staff = referralId ? staffReferrers.find((s) => s.uid === referralId) : null
      await updateDoc(doc(db, 'students', student.id), {
        referredByStaffId: staff?.uid ?? null,
        referredByStaffName: staff?.displayName ?? null,
      })
      setChangingReferral(false)
      onUpdated()
    } catch (err) {
      console.error(err)
      alert('Could not update staff referral')
    } finally {
      setSavingReferral(false)
    }
  }

  const registeredDate = student.enrollmentDate || student.createdAt

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#DDE3EC] bg-[#F5F7FB] p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-jakarta text-sm font-bold uppercase tracking-wide text-[#0B3D6B]">
            Agent
          </h3>
          {isAdmin && !changing && (
            <button
              type="button"
              onClick={() => {
                setPickId(student.agentId ?? '')
                setChanging(true)
              }}
              className="text-xs font-semibold text-[#0B3D6B] hover:text-[#E8A020]"
            >
              Change Agent
            </button>
          )}
        </div>

        {changing ? (
          <div className="space-y-3">
            <select
              value={pickId}
              onChange={(e) => setPickId(e.target.value)}
              className="w-full rounded-lg border border-[#DDE3EC] bg-white px-3 py-2 text-sm"
            >
              <option value="">Select agent</option>
              {agents.map((a) => (
                <option key={a.uid} value={a.uid}>
                  {a.displayName} ({ROLE_LABELS[a.role] ?? a.role})
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setChanging(false)}
                className="flex-1 rounded-lg border py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving || !pickId}
                onClick={() => void handleSaveAgent()}
                className="flex-1 rounded-lg bg-[#E8A020] py-2 text-sm font-bold text-[#0B3D6B] disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        ) : (
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-[#5A6A7A]">Agent</dt>
              <dd className="font-medium text-[#0D1B2A]">{student.agentName || '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[#5A6A7A]">Role</dt>
              <dd className="text-[#0D1B2A]">{agentRole || '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[#5A6A7A]">Registered</dt>
              <dd className="text-[#0D1B2A]">
                {registeredDate
                  ? new Date(registeredDate).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })
                  : '—'}
              </dd>
            </div>
          </dl>
        )}
      </div>

      <div className="rounded-xl border border-[#DDE3EC] bg-[#F5F7FB] p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-jakarta text-sm font-bold uppercase tracking-wide text-[#0B3D6B]">
            Referred by (staff)
          </h3>
          {isAdmin && !changingReferral && (
            <button
              type="button"
              onClick={() => {
                setReferralId(student.referredByStaffId ?? '')
                setChangingReferral(true)
              }}
              className="text-xs font-semibold text-[#0B3D6B] hover:text-[#E8A020]"
            >
              {student.referredByStaffId ? 'Change' : 'Set referral'}
            </button>
          )}
        </div>

        {changingReferral ? (
          <div className="space-y-3">
            <select
              value={referralId}
              onChange={(e) => setReferralId(e.target.value)}
              className="w-full rounded-lg border border-[#DDE3EC] bg-white px-3 py-2 text-sm"
            >
              <option value="">None</option>
              {staffReferrers.map((s) => (
                <option key={s.uid} value={s.uid}>
                  {s.displayName} ({ROLE_LABELS[s.role] ?? s.role})
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setChangingReferral(false)}
                className="flex-1 rounded-lg border py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingReferral}
                onClick={() => void handleSaveReferral()}
                className="flex-1 rounded-lg bg-[#E8A020] py-2 text-sm font-bold text-[#0B3D6B] disabled:opacity-60"
              >
                {savingReferral ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm font-medium text-[#0D1B2A]">
            {student.referredByStaffName || '—'}
          </p>
        )}
      </div>
    </div>
  )
}
