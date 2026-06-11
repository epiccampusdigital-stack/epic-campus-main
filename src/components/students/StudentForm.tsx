'use client'

import { useEffect, useState } from 'react'
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '@/lib/firebase/client'
import { COURSES } from '@/lib/constants/courses'
import {
  generateStudentCode,
  generateTempPassword,
  sendWhatsAppNotification,
  sendCredentialsEmail,
} from '@/lib/students/helpers'
import { generateParentAccessCode } from '@/lib/parent/helpers'
import { useManagement } from '@/components/layout/ManagementContext'
import { logAuditEvent } from '@/lib/audit/helpers'
import {
  AGENT_ROLES,
  BATCH_DURATION_LABELS,
  computeBatchEndDate,
  defaultFeeSchedule,
  LOCATION_LABELS,
} from '@/lib/students/helpers'
import type { BatchDuration, CourseId, Student, StudentLocation } from '@/types'

export type GuardianRelationship = 'Father' | 'Mother' | 'Spouse' | 'Sibling' | 'Guardian' | 'Other'

export interface StudentFormValues {
  name: string
  nic: string
  dateOfBirth: string
  mobile: string
  email: string
  address: string
  courseId: CourseId | ''
  batchId: string
  batchDuration: BatchDuration | ''
  batchCustomDays: string
  batchStartDate: string
  location: StudentLocation | ''
  agentId: string
  referredByStaffId: string
  enrollmentDate: string
  expectedCompletionDate: string
  feeAmount: string
  feeCurrency: 'LKR' | 'USD'
  paymentStatus: 'paid' | 'partial' | 'pending'
  status: Student['status']
  visaStatus: NonNullable<Student['visaStatus']>
  notes: string
  // Guardian / Parent
  guardianName: string
  guardianRelationship: GuardianRelationship
  guardianPhone: string
  guardianEmail: string
  guardianAddress: string
  guardianPortalEnabled: boolean
  guardianPortalCode: string
}

function makeEmptyForm(): StudentFormValues {
  return {
    name: '',
    nic: '',
    dateOfBirth: '',
    mobile: '',
    email: '',
    address: '',
    courseId: '',
    batchId: '',
    batchDuration: '90days',
    batchCustomDays: '',
    batchStartDate: new Date().toISOString().slice(0, 10),
    location: 'ahangama',
    agentId: '',
    referredByStaffId: '',
    enrollmentDate: new Date().toISOString().slice(0, 10),
    expectedCompletionDate: '',
    feeAmount: '',
    feeCurrency: 'LKR',
    paymentStatus: 'pending',
    status: 'pending',
    visaStatus: 'not-started',
    notes: '',
    guardianName: '',
    guardianRelationship: 'Father',
    guardianPhone: '',
    guardianEmail: '',
    guardianAddress: '',
    guardianPortalEnabled: true,
    guardianPortalCode: String(Math.floor(100000 + Math.random() * 900000)),
  }
}

interface StudentFormProps {
  open: boolean
  onClose: () => void
  student?: Student | null
  onSaved: () => void
}

function studentToForm(s: Student): StudentFormValues {
  return {
    name: s.name,
    nic: s.nic,
    dateOfBirth: s.dateOfBirth?.slice(0, 10) ?? '',
    mobile: s.mobile,
    email: s.email ?? '',
    address: s.address ?? '',
    courseId: s.courseId,
    batchId: s.batchId,
    batchDuration: s.batchDuration ?? '90days',
    batchCustomDays: s.batchCustomDays != null ? String(s.batchCustomDays) : '',
    batchStartDate: s.batchStartDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    location: s.location ?? 'ahangama',
    agentId: s.agentId ?? '',
    referredByStaffId: s.referredByStaffId ?? '',
    enrollmentDate: s.enrollmentDate?.slice(0, 10) ?? '',
    expectedCompletionDate: s.expectedCompletionDate?.slice(0, 10) ?? '',
    feeAmount: s.feeAmount != null ? String(s.feeAmount) : '',
    feeCurrency: s.feeCurrency ?? 'LKR',
    paymentStatus: s.paymentStatus ?? 'pending',
    status: s.status,
    visaStatus: s.visaStatus ?? 'not-started',
    notes: s.notes ?? '',
    guardianName: s.guardian?.name ?? '',
    guardianRelationship: s.guardian?.relationship ?? 'Father',
    guardianPhone: s.guardian?.phone ?? '',
    guardianEmail: s.guardian?.email ?? '',
    guardianAddress: s.guardian?.address ?? '',
    guardianPortalEnabled: s.guardian?.parentPortalEnabled ?? true,
    guardianPortalCode: s.guardian?.parentPortalCode ?? String(Math.floor(100000 + Math.random() * 900000)),
  }
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block font-inter text-xs font-medium uppercase tracking-wide text-[#5A6A7A]">
      {children}
    </label>
  )
}

function TextInput({
  value,
  onChange,
  type = 'text',
  placeholder,
  required,
  min,
}: {
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  required?: boolean
  min?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      min={min}
      className="w-full rounded-lg border border-[#DDE3EC] bg-white px-3 py-2.5 font-inter text-base text-[#0D1B2A] outline-none transition-colors focus:border-[#E8A020] sm:text-sm"
    />
  )
}

function SelectInput({
  value,
  onChange,
  children,
  required,
}: {
  value: string
  onChange: (v: string) => void
  children: React.ReactNode
  required?: boolean
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      className="w-full rounded-lg border border-[#DDE3EC] bg-white px-3 py-2.5 font-inter text-base text-[#0D1B2A] outline-none focus:border-[#E8A020] sm:text-sm"
    >
      {children}
    </select>
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

export default function StudentForm({
  open,
  onClose,
  student,
  onSaved,
}: StudentFormProps) {
  const { user } = useManagement()
  const [form, setForm] = useState<StudentFormValues>(makeEmptyForm())
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [agents, setAgents] = useState<{ uid: string; displayName: string; commissionRate?: number }[]>([])
  const [guardianSectionOpen, setGuardianSectionOpen] = useState(false)

  const isEdit = !!student

  const computedBatchEnd =
    form.batchStartDate && form.batchDuration
      ? computeBatchEndDate(
          form.batchStartDate,
          form.batchDuration as BatchDuration,
          form.batchDuration === 'custom' ? Number(form.batchCustomDays) || undefined : undefined,
        )
      : ''

  useEffect(() => {
    if (open) {
      setForm(student ? studentToForm(student) : makeEmptyForm())
      setPhotoFile(null)
      setPhotoPreview(student?.photoUrl ?? null)
      setError('')
      setGuardianSectionOpen(!!student?.guardian?.name)
      void getDocs(collection(db, 'users')).then((snap) => {
        const list = snap.docs
          .filter((d) =>
            (AGENT_ROLES as readonly string[]).includes(String(d.data().role ?? '')),
          )
          .map((d) => ({
            uid: d.id,
            displayName: String(d.data().displayName ?? d.data().email ?? 'Staff'),
            commissionRate: d.data().commissionRate != null ? Number(d.data().commissionRate) : undefined,
          }))
          .sort((a, b) => a.displayName.localeCompare(b.displayName))
        setAgents(list)
      })
    }
  }, [open, student])

  function setField<K extends keyof StudentFormValues>(
    key: K,
    value: StudentFormValues[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function uploadPhoto(studentDocId: string): Promise<string | undefined> {
    if (!photoFile) return student?.photoUrl
    const storageRef = ref(storage, `students/${studentDocId}/photo-${Date.now()}`)
    await uploadBytes(storageRef, photoFile)
    return getDownloadURL(storageRef)
  }

  async function createAuthAccount(
    studentDocId: string,
    email: string,
    name: string,
  ): Promise<string | undefined> {
    const password = generateTempPassword()
    const res = await fetch('/api/students/create-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, displayName: name, studentId: studentDocId }),
    })
    if (!res.ok) {
      const data = (await res.json()) as { error?: string }
      throw new Error(data.error ?? 'Failed to create login account')
    }
    const data = (await res.json()) as { uid: string }
    await sendCredentialsEmail(email, name, password)
    return data.uid
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    setError('')

    try {
      const studentDocId = student?.id ?? doc(collection(db, 'students')).id
      const photoUrl = await uploadPhoto(studentDocId)

      const selectedAgent = agents.find((a) => a.uid === form.agentId)
      const selectedReferralStaff = agents.find((a) => a.uid === form.referredByStaffId)
      const batchDuration = (form.batchDuration || '90days') as BatchDuration
      const batchEndIso = form.batchStartDate
        ? computeBatchEndDate(
            form.batchStartDate,
            batchDuration,
            batchDuration === 'custom' ? Number(form.batchCustomDays) || undefined : undefined,
          )
        : null
      const batchStartTs = form.batchStartDate
        ? Timestamp.fromDate(new Date(form.batchStartDate))
        : null
      const batchEndTs = batchEndIso ? Timestamp.fromDate(new Date(batchEndIso)) : null

      const guardianPayload =
        form.guardianName.trim()
          ? {
              name: form.guardianName.trim(),
              relationship: form.guardianRelationship,
              phone: form.guardianPhone.trim(),
              email: form.guardianEmail.trim() || null,
              address: form.guardianAddress.trim() || null,
              parentPortalEnabled: form.guardianPortalEnabled,
              parentPortalCode: form.guardianPortalEnabled ? form.guardianPortalCode : null,
            }
          : null

      const payload = {
        name: form.name.trim(),
        nic: form.nic.trim(),
        dateOfBirth: form.dateOfBirth || null,
        mobile: form.mobile.trim(),
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        photoUrl: photoUrl ?? null,
        courseId: form.courseId,
        batchId: form.batchId.trim(),
        batchDuration,
        batchCustomDays:
          batchDuration === 'custom' && form.batchCustomDays
            ? Number(form.batchCustomDays)
            : null,
        batchStartDate: batchStartTs,
        batchEndDate: batchEndTs,
        location: form.location || 'ahangama',
        agentId: form.agentId || null,
        agentName: selectedAgent?.displayName ?? null,
        referredByStaffId: form.referredByStaffId || null,
        referredByStaffName: selectedReferralStaff?.displayName ?? null,
        branchId: user.branchId ?? 'galle-main',
        enrollmentDate: form.enrollmentDate || null,
        expectedCompletionDate: form.expectedCompletionDate || null,
        feeAmount: form.feeAmount ? Number(form.feeAmount) : 0,
        feeCurrency: form.feeCurrency,
        registrationFee: form.feeAmount ? Number(form.feeAmount) : 0,
        paymentStatus: form.paymentStatus,
        status: form.status,
        visaStatus: form.visaStatus,
        notes: form.notes.trim() || null,
        guardian: guardianPayload,
        updatedAt: serverTimestamp(),
      }

      if (isEdit) {
        await updateDoc(doc(db, 'students', studentDocId), payload)
        if (
          student &&
          student.visaStatus !== form.visaStatus &&
          form.mobile.trim()
        ) {
          void fetch('/api/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'visa',
              phone: form.mobile.trim(),
              name: form.name.trim(),
              data: { status: form.visaStatus },
            }),
          })
        }
        // Write guardian portal code if newly added or changed
        if (guardianPayload?.parentPortalEnabled && guardianPayload.parentPortalCode) {
          await setDoc(doc(db, 'parentPortalCodes', guardianPayload.parentPortalCode), {
            code: guardianPayload.parentPortalCode,
            studentId: studentDocId,
            studentName: form.name.trim(),
            createdAt: serverTimestamp(),
            isActive: true,
          })
        }
        await logAuditEvent({
          userId: user.uid,
          userEmail: user.email,
          userRole: user.role,
          action: 'updated',
          entityType: 'student',
          entityId: studentDocId,
          details: `Updated student ${form.name.trim()}`,
        })
      } else {
        const allSnap = await getDocs(collection(db, 'students'))
        const studentCode = await generateStudentCode(allSnap.size)
        let uid: string | undefined

        if (form.email.trim()) {
          try {
            uid = await createAuthAccount(studentDocId, form.email.trim(), form.name.trim())
          } catch (authErr) {
            console.warn('[StudentForm] Auth account skipped:', authErr)
          }
        }

        await setDoc(doc(db, 'students', studentDocId), {
          ...payload,
          studentCode,
          uid: uid ?? null,
          feeSchedule: defaultFeeSchedule(),
          parentAccessCode: generateParentAccessCode(),
          parentAccessEnabled: true,
          createdAt: serverTimestamp(),
          createdBy: user.uid,
        })

        if (form.mobile.trim()) {
          await sendWhatsAppNotification(
            form.mobile.trim(),
            `Welcome to Epic Campus! Your student ID is ${studentCode}. We will contact you shortly.`,
          )
          void fetch('/api/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'enrollment',
              phone: form.mobile.trim(),
              name: form.name.trim(),
              data: {
                program:
                  COURSES.find((c) => c.id === form.courseId)?.label ?? form.courseId,
              },
            }),
          })
        }

        // Write guardian portal code
        if (guardianPayload?.parentPortalEnabled && guardianPayload.parentPortalCode) {
          await setDoc(doc(db, 'parentPortalCodes', guardianPayload.parentPortalCode), {
            code: guardianPayload.parentPortalCode,
            studentId: studentDocId,
            studentName: form.name.trim(),
            createdAt: serverTimestamp(),
            isActive: true,
          })
        }

        await logAuditEvent({
          userId: user.uid,
          userEmail: user.email,
          userRole: user.role,
          action: 'student_registered',
          entityType: 'student',
          entityId: studentDocId,
          details: `Registered ${form.name.trim()} (${studentCode})`,
        })
      }

      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save student')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

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
        aria-labelledby="student-form-title"
      >
        <div className="flex items-center justify-between border-b border-[#DDE3EC] px-6 py-4">
          <div>
            <h2
              id="student-form-title"
              className="font-jakarta text-lg font-bold text-[#0D1B2A]"
            >
              {isEdit ? 'Edit Student' : 'Add Student'}
            </h2>
            {student?.studentCode && (
              <p className="text-xs text-[#5A6A7A]">{student.studentCode}</p>
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
                    form.name.slice(0, 2).toUpperCase() || '?'
                  )}
                </div>
                <div>
                  <FieldLabel>Profile Photo</FieldLabel>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="font-inter text-sm text-[#5A6A7A] file:mr-3 file:rounded-lg file:border-0 file:bg-[#0B3D6B] file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white"
                  />
                </div>
              </div>
              <div>
                <FieldLabel>Full Name *</FieldLabel>
                <TextInput
                  value={form.name}
                  onChange={(v) => setField('name', v)}
                  placeholder="Full name"
                  required
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel>NIC Number *</FieldLabel>
                  <TextInput
                    value={form.nic}
                    onChange={(v) => setField('nic', v)}
                    placeholder="NIC / Passport"
                    required
                  />
                </div>
                <div>
                  <FieldLabel>Date of Birth</FieldLabel>
                  <TextInput
                    type="date"
                    value={form.dateOfBirth}
                    onChange={(v) => setField('dateOfBirth', v)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel>Phone (WhatsApp) *</FieldLabel>
                  <TextInput
                    value={form.mobile}
                    onChange={(v) => setField('mobile', v)}
                    placeholder="07XXXXXXXX"
                    required
                  />
                </div>
                <div>
                  <FieldLabel>Email</FieldLabel>
                  <TextInput
                    type="email"
                    value={form.email}
                    onChange={(v) => setField('email', v)}
                    placeholder="student@email.com"
                  />
                </div>
              </div>
              <div>
                <FieldLabel>Address</FieldLabel>
                <textarea
                  value={form.address}
                  onChange={(e) => setField('address', e.target.value)}
                  rows={2}
                  className="w-full resize-none rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-base text-[#0D1B2A] outline-none focus:border-[#E8A020] sm:text-sm"
                  placeholder="Full address"
                />
              </div>
            </div>

            {/* Guardian / Parent Details — collapsible */}
            <div className="mb-6">
              <button
                type="button"
                onClick={() => setGuardianSectionOpen((v) => !v)}
                className="flex w-full items-center justify-between rounded-lg border border-[#DDE3EC] bg-[#F5F7FB] px-4 py-3 text-left"
              >
                <span className="flex items-center gap-2 font-jakarta text-sm font-bold text-[#0B3D6B]">
                  <span className="ti ti-user-heart text-lg" aria-hidden="true" />
                  Guardian / Parent Details
                  {form.guardianName && (
                    <span className="ml-1 rounded-full bg-[#0B3D6B] px-2 py-0.5 text-[10px] font-semibold text-white">
                      {form.guardianName}
                    </span>
                  )}
                </span>
                <span
                  className={`ti ${guardianSectionOpen ? 'ti-chevron-up' : 'ti-chevron-down'} text-[#5A6A7A]`}
                  aria-hidden="true"
                />
              </button>

              {guardianSectionOpen && (
                <div className="mt-3 space-y-4 rounded-lg border border-[#DDE3EC] p-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <FieldLabel>Guardian Full Name *</FieldLabel>
                      <TextInput
                        value={form.guardianName}
                        onChange={(v) => setField('guardianName', v)}
                        placeholder="Full name"
                      />
                    </div>
                    <div>
                      <FieldLabel>Relationship *</FieldLabel>
                      <SelectInput
                        value={form.guardianRelationship}
                        onChange={(v) => setField('guardianRelationship', v as typeof form.guardianRelationship)}
                      >
                        {(['Father', 'Mother', 'Spouse', 'Sibling', 'Guardian', 'Other'] as const).map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </SelectInput>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <FieldLabel>Phone Number *</FieldLabel>
                      <TextInput
                        type="tel"
                        value={form.guardianPhone}
                        onChange={(v) => setField('guardianPhone', v)}
                        placeholder="07XXXXXXXX"
                      />
                    </div>
                    <div>
                      <FieldLabel>Email Address</FieldLabel>
                      <TextInput
                        type="email"
                        value={form.guardianEmail}
                        onChange={(v) => setField('guardianEmail', v)}
                        placeholder="guardian@email.com"
                      />
                    </div>
                  </div>
                  <div>
                    <FieldLabel>Address</FieldLabel>
                    <textarea
                      value={form.guardianAddress}
                      onChange={(e) => setField('guardianAddress', e.target.value)}
                      rows={2}
                      className="w-full resize-none rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-base text-[#0D1B2A] outline-none focus:border-[#E8A020] sm:text-sm"
                      placeholder="Guardian address"
                    />
                  </div>

                  {/* Parent portal toggle + code */}
                  <div className="rounded-lg bg-[#F5F7FB] p-4">
                    <label className="flex cursor-pointer items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setField('guardianPortalEnabled', !form.guardianPortalEnabled)}
                        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                          form.guardianPortalEnabled ? 'bg-[#0B3D6B]' : 'bg-gray-300'
                        }`}
                        aria-checked={form.guardianPortalEnabled}
                        role="switch"
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                            form.guardianPortalEnabled ? 'translate-x-4' : 'translate-x-1'
                          }`}
                        />
                      </button>
                      <span className="font-inter text-sm font-medium text-[#0D1B2A]">
                        Enable parent portal access
                      </span>
                    </label>

                    {form.guardianPortalEnabled && (
                      <div className="mt-3">
                        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[#5A6A7A]">
                          Parent Portal Code
                        </p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 rounded-lg border border-[#E8A020]/40 bg-white px-4 py-2">
                            <span className="font-mono text-xl font-bold tracking-[0.25em] text-[#0B3D6B]">
                              {form.guardianPortalCode}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setField(
                                'guardianPortalCode',
                                String(Math.floor(100000 + Math.random() * 900000)),
                              )
                            }
                            className="rounded-lg border border-[#DDE3EC] p-2 text-[#5A6A7A] hover:bg-[#F5F7FB]"
                            title="Regenerate code"
                          >
                            <span className="ti ti-refresh text-base" aria-hidden="true" />
                          </button>
                        </div>
                        <p className="mt-1.5 text-xs text-[#5A6A7A]">
                          Share this code with the parent to access the parent portal
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <SectionTitle icon="ti-school" title="Program Info" />
            <div className="mb-6 space-y-4">
              <div>
                <FieldLabel>Course *</FieldLabel>
                <SelectInput
                  value={form.courseId}
                  onChange={(v) => setField('courseId', v as CourseId)}
                  required
                >
                  <option value="">Select course</option>
                  {COURSES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.flag} {c.label}
                    </option>
                  ))}
                </SelectInput>
              </div>
              <div>
                <FieldLabel>Batch Name / ID *</FieldLabel>
                <TextInput
                  value={form.batchId}
                  onChange={(v) => setField('batchId', v)}
                  placeholder="e.g. Batch 12"
                  required
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel>Batch Duration *</FieldLabel>
                  <SelectInput
                    value={form.batchDuration}
                    onChange={(v) => setField('batchDuration', v as BatchDuration)}
                    required
                  >
                    {(Object.keys(BATCH_DURATION_LABELS) as BatchDuration[]).map((d) => (
                      <option key={d} value={d}>
                        {BATCH_DURATION_LABELS[d]}
                      </option>
                    ))}
                  </SelectInput>
                </div>
                {form.batchDuration === 'custom' && (
                  <div>
                    <FieldLabel>Custom Days *</FieldLabel>
                    <TextInput
                      type="number"
                      min="1"
                      value={form.batchCustomDays}
                      onChange={(v) => setField('batchCustomDays', v)}
                      placeholder="e.g. 60"
                      required
                    />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel>Batch Start Date *</FieldLabel>
                  <TextInput
                    type="date"
                    value={form.batchStartDate}
                    onChange={(v) => setField('batchStartDate', v)}
                    required
                  />
                </div>
                <div>
                  <FieldLabel>Batch End Date (auto)</FieldLabel>
                  <input
                    type="text"
                    readOnly
                    value={computedBatchEnd || '—'}
                    className="w-full cursor-not-allowed rounded-lg border border-[#DDE3EC] bg-[#F5F7FB] px-3 py-2.5 font-inter text-sm text-[#5A6A7A]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel>Location *</FieldLabel>
                  <SelectInput
                    value={form.location}
                    onChange={(v) => setField('location', v as StudentLocation)}
                    required
                  >
                    {(Object.keys(LOCATION_LABELS) as StudentLocation[]).map((loc) => (
                      <option key={loc} value={loc}>
                        {LOCATION_LABELS[loc]}
                      </option>
                    ))}
                  </SelectInput>
                </div>
                <div>
                  <FieldLabel>Agent</FieldLabel>
                  <SelectInput
                    value={form.agentId}
                    onChange={(v) => setField('agentId', v)}
                  >
                    <option value="">Select agent</option>
                    {agents.map((a) => (
                      <option key={a.uid} value={a.uid}>
                        {a.displayName}
                        {a.commissionRate != null ? ` (${a.commissionRate}% commission)` : ''}
                      </option>
                    ))}
                  </SelectInput>
                  {form.agentId && (() => {
                    const ag = agents.find((a) => a.uid === form.agentId)
                    return ag?.commissionRate != null ? (
                      <p className="mt-1 text-xs text-emerald-700">
                        Commission rate: {ag.commissionRate}%
                      </p>
                    ) : null
                  })()}
                </div>
                <div>
                  <FieldLabel>Referred by (staff)</FieldLabel>
                  <SelectInput
                    value={form.referredByStaffId}
                    onChange={(v) => setField('referredByStaffId', v)}
                  >
                    <option value="">None</option>
                    {agents
                      .filter((a) => a.uid !== form.agentId)
                      .map((a) => (
                        <option key={a.uid} value={a.uid}>
                          {a.displayName}
                          {a.commissionRate != null ? ` (${a.commissionRate}% referral)` : ''}
                        </option>
                      ))}
                  </SelectInput>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel>Enrollment Date</FieldLabel>
                  <TextInput
                    type="date"
                    value={form.enrollmentDate}
                    onChange={(v) => setField('enrollmentDate', v)}
                  />
                </div>
                <div>
                  <FieldLabel>Expected Completion</FieldLabel>
                  <TextInput
                    type="date"
                    value={form.expectedCompletionDate}
                    onChange={(v) => setField('expectedCompletionDate', v)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <FieldLabel>Fee Amount</FieldLabel>
                  <TextInput
                    type="number"
                    value={form.feeAmount}
                    onChange={(v) => setField('feeAmount', v)}
                    placeholder="0"
                  />
                </div>
                <div>
                  <FieldLabel>Currency</FieldLabel>
                  <SelectInput
                    value={form.feeCurrency}
                    onChange={(v) => setField('feeCurrency', v as 'LKR' | 'USD')}
                  >
                    <option value="LKR">LKR</option>
                    <option value="USD">USD</option>
                  </SelectInput>
                </div>
              </div>
              <div>
                <FieldLabel>Payment Status</FieldLabel>
                <SelectInput
                  value={form.paymentStatus}
                  onChange={(v) =>
                    setField('paymentStatus', v as StudentFormValues['paymentStatus'])
                  }
                >
                  <option value="pending">Pending</option>
                  <option value="partial">Partial</option>
                  <option value="paid">Paid</option>
                </SelectInput>
              </div>
            </div>

            <SectionTitle icon="ti-file-description" title="Status & Documents" />
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel>Student Status</FieldLabel>
                  <SelectInput
                    value={form.status}
                    onChange={(v) => setField('status', v as Student['status'])}
                  >
                    <option value="pending">Pending</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="withdrawn">Withdrawn</option>
                  </SelectInput>
                </div>
                <div>
                  <FieldLabel>Visa Status</FieldLabel>
                  <SelectInput
                    value={form.visaStatus}
                    onChange={(v) =>
                      setField('visaStatus', v as NonNullable<Student['visaStatus']>)
                    }
                  >
                    <option value="not-started">Not Started</option>
                    <option value="in-progress">In Progress</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </SelectInput>
                </div>
              </div>
              <div>
                <FieldLabel>Notes</FieldLabel>
                <textarea
                  value={form.notes}
                  onChange={(e) => setField('notes', e.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-base text-[#0D1B2A] outline-none focus:border-[#E8A020] sm:text-sm"
                  placeholder="Internal notes about this student…"
                />
              </div>
            </div>
          </div>

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
              className="flex-1 rounded-lg bg-[#E8A020] py-2.5 font-jakarta text-sm font-bold text-[#0B3D6B] transition-colors hover:bg-[#F5B942] disabled:opacity-60"
            >
              {saving ? 'Saving…' : isEdit ? 'Update Student' : 'Save Student'}
            </button>
          </div>
        </form>
      </aside>
    </>
  )
}
