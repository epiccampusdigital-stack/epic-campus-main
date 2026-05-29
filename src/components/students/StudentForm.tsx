'use client'

import { useEffect, useState } from 'react'
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  serverTimestamp,
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
import { useManagement } from '@/components/layout/ManagementContext'
import { logAuditEvent } from '@/lib/audit/helpers'
import type { CourseId, Student } from '@/types'

export interface StudentFormValues {
  name: string
  nic: string
  dateOfBirth: string
  mobile: string
  email: string
  address: string
  courseId: CourseId | ''
  batchId: string
  enrollmentDate: string
  expectedCompletionDate: string
  feeAmount: string
  feeCurrency: 'LKR' | 'USD'
  paymentStatus: 'paid' | 'partial' | 'pending'
  status: Student['status']
  visaStatus: NonNullable<Student['visaStatus']>
  notes: string
}

const EMPTY: StudentFormValues = {
  name: '',
  nic: '',
  dateOfBirth: '',
  mobile: '',
  email: '',
  address: '',
  courseId: '',
  batchId: '',
  enrollmentDate: new Date().toISOString().slice(0, 10),
  expectedCompletionDate: '',
  feeAmount: '',
  feeCurrency: 'LKR',
  paymentStatus: 'pending',
  status: 'pending',
  visaStatus: 'not-started',
  notes: '',
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
    enrollmentDate: s.enrollmentDate?.slice(0, 10) ?? '',
    expectedCompletionDate: s.expectedCompletionDate?.slice(0, 10) ?? '',
    feeAmount: s.feeAmount != null ? String(s.feeAmount) : '',
    feeCurrency: s.feeCurrency ?? 'LKR',
    paymentStatus: s.paymentStatus ?? 'pending',
    status: s.status,
    visaStatus: s.visaStatus ?? 'not-started',
    notes: s.notes ?? '',
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
}: {
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  required?: boolean
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
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
  const [form, setForm] = useState<StudentFormValues>(EMPTY)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isEdit = !!student

  useEffect(() => {
    if (open) {
      setForm(student ? studentToForm(student) : EMPTY)
      setPhotoFile(null)
      setPhotoPreview(student?.photoUrl ?? null)
      setError('')
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
        updatedAt: serverTimestamp(),
      }

      if (isEdit) {
        await updateDoc(doc(db, 'students', studentDocId), payload)
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
          createdAt: serverTimestamp(),
          createdBy: user.uid,
        })

        if (form.mobile.trim()) {
          await sendWhatsAppNotification(
            form.mobile.trim(),
            `Welcome to Epic Campus! Your student ID is ${studentCode}. We will contact you shortly.`,
          )
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
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-white shadow-2xl"
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
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel>Batch *</FieldLabel>
                  <TextInput
                    value={form.batchId}
                    onChange={(v) => setField('batchId', v)}
                    placeholder="e.g. Batch 12"
                    required
                  />
                </div>
                <div>
                  <FieldLabel>Enrollment Date</FieldLabel>
                  <TextInput
                    type="date"
                    value={form.enrollmentDate}
                    onChange={(v) => setField('enrollmentDate', v)}
                  />
                </div>
              </div>
              <div>
                <FieldLabel>Expected Completion</FieldLabel>
                <TextInput
                  type="date"
                  value={form.expectedCompletionDate}
                  onChange={(v) => setField('expectedCompletionDate', v)}
                />
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
