'use client'

import { useEffect, useState } from 'react'
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '@/lib/firebase/client'
import {
  STAFF_ROLES,
  formatSalary,
  getRoleLabel,
  sendStaffWhatsApp,
} from '@/lib/staff/helpers'
import { generateTempPassword, sendCredentialsEmail } from '@/lib/students/helpers'
import { useManagement } from '@/components/layout/ManagementContext'
import { logAuditEvent } from '@/lib/audit/helpers'
import toast from 'react-hot-toast'
import { LOCATION_LABELS } from '@/lib/students/helpers'
import type { SalaryType, StaffMember, StaffRole, StaffStatus, StudentLocation } from '@/types'

export interface StaffFormValues {
  displayName: string
  nic: string
  dateOfBirth: string
  phone: string
  email: string
  address: string
  role: StaffRole
  status: StaffStatus
  startDate: string
  salaryType: SalaryType
  baseSalary: string
  commissionRate: string
  locationAssigned: StudentLocation | ''
}

const EMPTY: StaffFormValues = {
  displayName: '',
  nic: '',
  dateOfBirth: '',
  phone: '',
  email: '',
  address: '',
  role: 'teacher',
  status: 'active',
  startDate: new Date().toISOString().slice(0, 10),
  salaryType: 'fixed',
  baseSalary: '',
  commissionRate: '',
  locationAssigned: '',
}

interface StaffFormProps {
  open: boolean
  onClose: () => void
  staff?: StaffMember | null
  readonly?: boolean
  onSaved: () => void
}

function staffToForm(s: StaffMember): StaffFormValues {
  return {
    displayName: s.displayName,
    nic: s.nic,
    dateOfBirth: s.dateOfBirth?.slice(0, 10) ?? '',
    phone: s.phone,
    email: s.email,
    address: s.address ?? '',
    role: s.role,
    status: s.status,
    startDate: s.startDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    salaryType: s.salaryType,
    baseSalary: s.baseSalary ? String(s.baseSalary) : '',
    commissionRate: s.commissionRate != null ? String(s.commissionRate) : '',
    locationAssigned: s.locationAssigned ?? '',
  }
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block font-inter text-xs font-medium uppercase tracking-wide text-[#5A6A7A]">
      {children}
    </label>
  )
}

function SectionTitle({ icon, title }: { icon: string; title: string }) {
  return (
    <h3 className="mb-4 flex items-center gap-2 font-jakarta text-sm font-bold text-[#0B3D6B]">
      <span className={`ti ${icon} text-lg`} aria-hidden="true" />
      {title}
    </h3>
  )
}

export default function StaffForm({
  open,
  onClose,
  staff,
  readonly = false,
  onSaved,
}: StaffFormProps) {
  const { user } = useManagement()
  const [form, setForm] = useState<StaffFormValues>(EMPTY)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isEdit = !!staff && !readonly
  const isView = !!staff && readonly

  useEffect(() => {
    if (open) {
      setForm(staff ? staffToForm(staff) : EMPTY)
      setPhotoFile(null)
      setPhotoPreview(staff?.photoUrl ?? null)
      setError('')
    }
  }, [open, staff])

  function setField<K extends keyof StaffFormValues>(key: K, value: StaffFormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function uploadPhoto(staffDocId: string): Promise<string | undefined> {
    if (!photoFile) return staff?.photoUrl
    const storageRef = ref(storage, `staff/${staffDocId}/photo-${Date.now()}`)
    await uploadBytes(storageRef, photoFile)
    return getDownloadURL(storageRef)
  }

  async function createAuthAccount(
    staffDocId: string,
    email: string,
    displayName: string,
  ): Promise<string> {
    const password = generateTempPassword()
    const res = await fetch('/api/staff/create-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        displayName,
        role: form.role,
        phone: form.phone.trim(),
        nic: form.nic.trim(),
        dateOfBirth: form.dateOfBirth || null,
        address: form.address.trim() || null,
        photoUrl: null,
        branchId: user?.branchId ?? 'galle-main',
        startDate: form.startDate || null,
        salaryType: form.salaryType,
        baseSalary: form.baseSalary ? Number(form.baseSalary) : 0,
        commissionRate:
          (form.role === 'agent' || form.salaryType === 'commission') && form.commissionRate
            ? Number(form.commissionRate)
            : null,
        status: 'active',
        locationAssigned: form.locationAssigned || null,
        pendingDocId: staffDocId,
      }),
    })
    if (!res.ok) {
      const data = (await res.json()) as { error?: string }
      throw new Error(data.error ?? 'Failed to create login account')
    }
    const data = (await res.json()) as { uid: string }
    await sendCredentialsEmail(email, displayName, password)
    return data.uid
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || readonly) return

    if (!form.email.trim()) {
      setError('Email is required for staff accounts')
      return
    }

    setSaving(true)
    setError('')

    try {
      const staffDocId = staff?.id ?? doc(collection(db, 'users')).id
      const photoUrl = await uploadPhoto(staffDocId)

      const payload = {
        displayName: form.displayName.trim(),
        nic: form.nic.trim(),
        dateOfBirth: form.dateOfBirth || null,
        phone: form.phone.trim(),
        email: form.email.trim(),
        address: form.address.trim() || null,
        photoUrl: photoUrl ?? null,
        role: form.role,
        status: form.status,
        branchId: user.branchId ?? 'galle-main',
        startDate: form.startDate || null,
        salaryType: form.salaryType,
        baseSalary: form.baseSalary ? Number(form.baseSalary) : 0,
        commissionRate:
          (form.role === 'agent' || form.salaryType === 'commission') && form.commissionRate
            ? Number(form.commissionRate)
            : null,
        locationAssigned: form.locationAssigned || null,
        updatedAt: serverTimestamp(),
      }

      if (isEdit && staff) {
        await updateDoc(doc(db, 'users', staff.id), payload)
        const uidTarget = staff.uid && staff.uid !== staff.id ? staff.uid : null
        if (uidTarget) {
          await updateDoc(doc(db, 'users', uidTarget), {
            locationAssigned: form.locationAssigned || null,
            ...(photoUrl ? { photoUrl } : {}),
          }).catch(() => {})
        }
      } else if (form.status === 'active') {
        const uid = await createAuthAccount(staffDocId, form.email.trim(), form.displayName.trim())
        if (photoUrl) {
          await updateDoc(doc(db, 'users', uid), { photoUrl })
        }
      } else {
        await setDoc(doc(db, 'users', staffDocId), {
          ...payload,
          uid: null,
          createdAt: serverTimestamp(),
        })
      }

      if (form.phone.trim()) {
        await sendStaffWhatsApp(
          form.phone.trim(),
          `Welcome to Epic Campus! Your staff profile has been ${form.status === 'active' ? 'created' : 'submitted for approval'}.`,
        )
      }

      await logAuditEvent({
        userId: user.uid,
        userEmail: user.email,
        userRole: user.role,
        action: isEdit ? 'updated' : 'created',
        entityType: 'staff',
        entityId: staff?.id ?? staffDocId,
        details: `${isEdit ? 'Updated' : 'Added'} staff member ${form.displayName.trim()}`,
      })

      toast.success(isEdit ? 'Staff updated' : 'Staff saved')
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save staff member')
      toast.error('Something went wrong. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  const inputClass =
    'w-full rounded-lg border border-[#DDE3EC] bg-white px-3 py-2.5 font-inter text-base text-[#0D1B2A] outline-none focus:border-[#E8A020] sm:text-sm disabled:bg-[#F5F7FB] disabled:text-[#5A6A7A]'

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-[#0D1B2A]/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-white/90 dark:bg-[#0d1a2e]/90 backdrop-blur-2xl border-l border-white/80 dark:border-white/[0.08] shadow-2xl"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-[#DDE3EC] px-6 py-4">
          <div>
            <h2 className="font-jakarta text-lg font-bold text-[#0D1B2A]">
              {isView ? 'Staff Profile' : isEdit ? 'Edit Staff' : 'Invite / Add Staff'}
            </h2>
            {staff && (
              <p className="text-xs text-[#5A6A7A]">{getRoleLabel(staff.role)}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[#5A6A7A] hover:bg-[#F5F7FB]"
            aria-label="Close"
          >
            <span className="ti ti-x text-xl" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {error && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <SectionTitle icon="ti-user" title="Personal Info" />
            <div className="mb-6 space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#0B3D6B] text-lg font-bold text-white">
                  {photoPreview ? (
                    <img src={photoPreview} alt="" className="h-full w-full object-cover" />
                  ) : (
                    form.displayName.slice(0, 2).toUpperCase() || '?'
                  )}
                </div>
                {!isView && (
                  <div>
                    <FieldLabel>Profile Photo</FieldLabel>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                      className="font-inter text-sm text-[#5A6A7A]"
                    />
                  </div>
                )}
              </div>

              <div>
                <FieldLabel>Full Name *</FieldLabel>
                <input
                  type="text"
                  value={form.displayName}
                  onChange={(e) => setField('displayName', e.target.value)}
                  required
                  disabled={isView}
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel>NIC</FieldLabel>
                  <input
                    type="text"
                    value={form.nic}
                    onChange={(e) => setField('nic', e.target.value)}
                    disabled={isView}
                    className={inputClass}
                  />
                </div>
                <div>
                  <FieldLabel>Date of Birth</FieldLabel>
                  <input
                    type="date"
                    value={form.dateOfBirth}
                    onChange={(e) => setField('dateOfBirth', e.target.value)}
                    disabled={isView}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel>Phone *</FieldLabel>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setField('phone', e.target.value)}
                    required
                    disabled={isView}
                    className={inputClass}
                  />
                </div>
                <div>
                  <FieldLabel>Email *</FieldLabel>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setField('email', e.target.value)}
                    required
                    disabled={isView}
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <FieldLabel>Address</FieldLabel>
                <textarea
                  value={form.address}
                  onChange={(e) => setField('address', e.target.value)}
                  rows={2}
                  disabled={isView}
                  className={`${inputClass} resize-none`}
                />
              </div>
            </div>

            <SectionTitle icon="ti-shield-lock" title="Role & Access" />
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel>Role *</FieldLabel>
                  <select
                    value={form.role}
                    onChange={(e) => setField('role', e.target.value as StaffRole)}
                    required
                    disabled={isView}
                    className={inputClass}
                  >
                    {STAFF_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {getRoleLabel(r)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <FieldLabel>Status</FieldLabel>
                  <select
                    value={form.status}
                    onChange={(e) => setField('status', e.target.value as StaffStatus)}
                    disabled={isView}
                    className={inputClass}
                  >
                    <option value="active">Active — creates login account immediately</option>
                    <option value="pending">Pending — no login until approved</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              </div>
              {form.status === 'active' && !isEdit && (
                <p className="mt-1.5 text-xs text-emerald-600 flex items-center gap-1">
                  <span className="ti ti-info-circle" />
                  A login account will be created and credentials emailed automatically.
                </p>
              )}
              {form.status === 'pending' && !isEdit && (
                <p className="mt-1.5 text-xs text-amber-600 flex items-center gap-1">
                  <span className="ti ti-info-circle" />
                  Staff will be saved without a login. Use Approve on the staff list to activate later.
                </p>
              )}

              <div>
                <FieldLabel>Start Date</FieldLabel>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setField('startDate', e.target.value)}
                  disabled={isView}
                  className={inputClass}
                />
              </div>

              <div>
                <FieldLabel>Assigned location</FieldLabel>
                <select
                  value={form.locationAssigned}
                  onChange={(e) =>
                    setField('locationAssigned', e.target.value as StudentLocation | '')
                  }
                  disabled={isView}
                  className={inputClass}
                >
                  <option value="">Not set</option>
                  {(Object.keys(LOCATION_LABELS) as StudentLocation[]).map((loc) => (
                    <option key={loc} value={loc}>
                      {LOCATION_LABELS[loc]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel>Salary Type</FieldLabel>
                  <select
                    value={form.salaryType}
                    onChange={(e) => setField('salaryType', e.target.value as SalaryType)}
                    disabled={isView}
                    className={inputClass}
                  >
                    <option value="fixed">Fixed (monthly)</option>
                    <option value="hourly">Hourly</option>
                    <option value="commission">Commission</option>
                  </select>
                </div>
                <div>
                  <FieldLabel>Base Salary (LKR)</FieldLabel>
                  <input
                    type="number"
                    min="0"
                    value={form.baseSalary}
                    onChange={(e) => setField('baseSalary', e.target.value)}
                    disabled={isView}
                    className={inputClass}
                  />
                </div>
              </div>

              {(form.salaryType === 'commission' || form.role === 'agent') && (
                <div>
                  <FieldLabel>Commission Rate (%)</FieldLabel>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={form.commissionRate}
                    onChange={(e) => setField('commissionRate', e.target.value)}
                    disabled={isView}
                    className={inputClass}
                  />
                </div>
              )}

              {isView && form.baseSalary && (
                <p className="rounded-lg bg-[#F5F7FB] px-3 py-2 text-sm text-[#0B3D6B]">
                  {formatSalary(Number(form.baseSalary), form.salaryType)}
                  {form.salaryType === 'commission' && form.commissionRate
                    ? ` · ${form.commissionRate}% commission`
                    : ''}
                </p>
              )}
            </div>
          </div>

          {!isView && (
            <div className="flex gap-3 border-t border-[#DDE3EC] px-6 py-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg border border-[#DDE3EC] py-2.5 font-jakarta text-sm font-semibold text-[#5A6A7A] hover:bg-[#F5F7FB]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-lg bg-[#E8A020] py-2.5 font-jakarta text-sm font-bold text-[#0B3D6B] hover:bg-[#F5B942] disabled:opacity-60"
              >
                {saving ? 'Saving…' : isEdit ? 'Update Staff' : 'Save Staff'}
              </button>
            </div>
          )}

          {isView && (
            <div className="border-t border-[#DDE3EC] px-6 py-4">
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-lg border border-[#DDE3EC] py-2.5 font-jakarta text-sm font-semibold text-[#5A6A7A] hover:bg-[#F5F7FB]"
              >
                Close
              </button>
            </div>
          )}
        </form>
      </aside>
    </>
  )
}
