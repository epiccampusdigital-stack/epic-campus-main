'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { collection, getDocs } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase/client'
import {
  computeStaffStats,
  getRoleLabel,
  parseStaff,
  staffHasRole,
  STAFF_ROLES,
} from '@/lib/staff/helpers'
import { sendCredentialsEmail } from '@/lib/students/helpers'
import { logAuditEvent } from '@/lib/audit/helpers'
import StaffForm from '@/components/staff/StaffForm'
import StaffTable, {
  PendingStaffBanner,
  StaffTableEmpty,
  StaffTableMeta,
} from '@/components/staff/StaffTable'
import { useManagement } from '@/components/layout/ManagementContext'
import type { StaffMember, StaffRole, StaffStatus } from '@/types'

const PAGE_SIZE = 10

function StatCard({
  label,
  value,
  sub,
  loading,
}: {
  label: string
  value: string
  sub?: string
  loading?: boolean
}) {
  return (
    <div className="rounded-xl border border-[#DDE3EC] bg-white p-5">
      <p className="font-inter text-xs font-medium uppercase tracking-wide text-[#5A6A7A]">
        {label}
      </p>
      {loading ? (
        <div className="mt-2 h-8 w-16 animate-pulse rounded bg-[#DDE3EC]" />
      ) : (
        <>
          <p className="mt-1 font-jakarta text-2xl font-bold text-[#0B3D6B]">{value}</p>
          {sub && <p className="mt-1 font-inter text-xs text-[#5A6A7A]">{sub}</p>}
        </>
      )}
    </div>
  )
}

export default function StaffPage() {
  const { user, hasRole } = useManagement()
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<StaffRole | ''>('')
  const [statusFilter, setStatusFilter] = useState<StaffStatus | ''>('')
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [editStaff, setEditStaff] = useState<StaffMember | null>(null)
  const [viewStaff, setViewStaff] = useState<StaffMember | null>(null)
  const [approvingId, setApprovingId] = useState<string | null>(null)

  const loadStaff = useCallback(async () => {
    setLoading(true)
    try {
      const [usersSnap, staffSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'staff')).catch(() => null),
      ])
      const allDocs = [...usersSnap.docs, ...(staffSnap?.docs ?? [])]
      const members = allDocs
        .map((d) => parseStaff(d.id, d.data() as Record<string, unknown>))
        .filter((s): s is StaffMember => s !== null)
        .filter((s, i, arr) => arr.findIndex(x => x.email === s.email) === i)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      setStaff(members)
    } catch (err) {
      console.error('[StaffPage]', err)
      setStaff([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadStaff()
  }, [loadStaff])

  const stats = useMemo(() => computeStaffStats(staff), [staff])

  const pendingStaff = useMemo(
    () => staff.filter((s) => s.status === 'pending'),
    [staff],
  )

  const roleBreakdown = useMemo(() => {
    return Object.entries(stats.byRole)
      .filter(([, count]) => count > 0)
      .map(([role, count]) => `${getRoleLabel(role as StaffRole)}: ${count}`)
      .join(' · ')
  }, [stats.byRole])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return staff.filter((s) => {
      if (roleFilter && !staffHasRole(s, roleFilter)) return false
      if (statusFilter && s.status !== statusFilter) return false
      if (!q) return true
      return (
        s.displayName.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.phone.includes(q)
      )
    })
  }, [staff, search, roleFilter, statusFilter])

  useEffect(() => {
    setPage(1)
  }, [search, roleFilter, statusFilter])

  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, page])

  function openAdd() {
    setEditStaff(null)
    setViewStaff(null)
    setFormOpen(true)
  }

  function openEdit(member: StaffMember) {
    setEditStaff(member)
    setViewStaff(null)
    setFormOpen(true)
  }

  function openView(member: StaffMember) {
    setViewStaff(member)
    setEditStaff(null)
    setFormOpen(true)
  }

  async function handleApprove(member: StaffMember) {
    if (!user) return
    if (!['admin', 'owner'].includes(user.role)) return
    if (!window.confirm(`Approve ${member.displayName} as ${member.role}? This will create their login account.`)) return
    setApprovingId(member.id)
    try {
      const token = await auth.currentUser?.getIdToken()
      const res = await fetch('/api/staff/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ staffId: member.id, approvedBy: user.uid }),
      })
      const data = (await res.json()) as { error?: string; password?: string; uid?: string }
      if (!res.ok) throw new Error(data.error ?? 'Approval failed')

      // The account is already created at this point — send credentials in a
      // separate try so an email failure doesn't read as the approval failing.
      let emailFailed = false
      if (data.password && member.email) {
        try {
          await sendCredentialsEmail(member.email, member.displayName, data.password)
        } catch (emailErr) {
          console.error('[StaffPage] credentials email failed:', emailErr)
          emailFailed = true
        }
      }

      await logAuditEvent({
        userId: user.uid,
        userEmail: user.email,
        userRole: user.role,
        action: 'approved',
        entityType: 'staff',
        entityId: data.uid ?? member.id,
        details: `Approved staff member ${member.displayName}`,
      })

      await loadStaff()

      if (emailFailed) {
        toast.success('Account approved')
        // react-hot-toast has no .warning — use a warning icon to convey it.
        toast('Credentials email may not have sent — check manually', { icon: '⚠️' })
      } else {
        toast.success('Staff account approved and credentials sent')
      }
    } catch (err) {
      console.error('[StaffPage] approve failed:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to approve staff')
    } finally {
      setApprovingId(null)
    }
  }

  async function handleDelete(member: StaffMember) {
    if (!user || !(hasRole('admin') || hasRole('owner'))) return
    if (!confirm(`Delete ${member.displayName}? This will remove their account.`)) return
    try {
      const token = await auth.currentUser?.getIdToken()
      const res = await fetch('/api/staff/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ staffId: member.id, uid: member.uid }),
      })
      if (res.ok) {
        toast.success('Staff account deleted')
        void loadStaff()
      } else {
        toast.error('Failed to delete')
      }
    } catch (err) {
      console.error('[DeleteStaff]', err)
      toast.error('Failed to delete')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-jakarta text-2xl font-bold text-[#0D1B2A]">Staff</h2>
          <p className="font-inter text-sm text-[#5A6A7A]">Manage team members</p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#E8A020] px-5 py-2.5 font-jakarta text-sm font-bold text-[#0B3D6B] transition-colors hover:bg-[#F5B942]"
        >
          <span className="ti ti-plus" aria-hidden="true" />
          Invite / Add Staff
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Staff" value={String(stats.total)} loading={loading} />
        <StatCard label="Active" value={String(stats.active)} loading={loading} />
        <StatCard label="Pending Approval" value={String(stats.pending)} loading={loading} />
        <StatCard
          label="By Role"
          value={String(stats.rolesWithStaff)}
          sub={roleBreakdown || 'No roles assigned'}
          loading={loading}
        />
      </div>

      {!loading && pendingStaff.length > 0 && (
        <PendingStaffBanner
          pending={pendingStaff}
          onApprove={handleApprove}
          approvingId={approvingId}
        />
      )}

      <div className="rounded-xl border border-[#DDE3EC] dark:border-white/10 bg-white dark:bg-[#1A1535] p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="relative md:col-span-1">
            <span
              className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-[#5A6A7A] dark:text-white/40"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or email…"
              className="w-full rounded-lg border border-[#DDE3EC] dark:border-white/10 bg-white dark:bg-[#1A1535] py-2.5 pl-10 pr-3 font-inter text-base text-[#0D1B2A] dark:text-white outline-none focus:border-[#E8A020] dark:focus:border-[#E8A020] sm:text-sm"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as StaffRole | '')}
            className="rounded-lg border border-[#DDE3EC] dark:border-white/10 bg-white dark:bg-[#1A1535] px-3 py-2.5 font-inter text-sm text-[#0D1B2A] dark:text-white outline-none focus:border-[#E8A020] dark:focus:border-[#E8A020]"
          >
            <option value="">All roles</option>
            {STAFF_ROLES.map((r) => (
              <option key={r} value={r}>
                {getRoleLabel(r)}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StaffStatus | '')}
            className="rounded-lg border border-[#DDE3EC] dark:border-white/10 bg-white dark:bg-[#1A1535] px-3 py-2.5 font-inter text-sm text-[#0D1B2A] dark:text-white outline-none focus:border-[#E8A020] dark:focus:border-[#E8A020]"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </div>

      {!loading && filtered.length === 0 ? (
        <StaffTableEmpty onAdd={openAdd} />
      ) : (
        <>
          <StaffTable
            staff={paginated}
            loading={loading}
            onView={openView}
            onEdit={openEdit}
            onApprove={handleApprove}
            onDelete={handleDelete}
            approvingId={approvingId}
          />
          {!loading && filtered.length > 0 && (
            <StaffTableMeta
              total={filtered.length}
              page={page}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          )}
        </>
      )}

      <StaffForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditStaff(null)
          setViewStaff(null)
        }}
        staff={viewStaff ?? editStaff}
        readonly={!!viewStaff}
        onSaved={loadStaff}
      />
    </div>
  )
}
