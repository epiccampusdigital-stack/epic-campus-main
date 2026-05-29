'use client'

import { useEffect, useState } from 'react'
import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { COURSES } from '@/lib/constants/courses'
import { useManagement } from '@/components/layout/ManagementContext'
import { logAuditEvent } from '@/lib/audit/helpers'
import { LEAD_SOURCES } from '@/lib/crm/helpers'
import { generateStudentCode } from '@/lib/students/helpers'
import type { CourseId, Lead, LeadSource, LeadStatus } from '@/types'

export interface LeadFormValues {
  name: string
  phone: string
  email: string
  address: string
  inquiryDate: string
  courseId: CourseId | ''
  intakeDate: string
  budget: string
  educationLevel: string
  source: LeadSource
  agentName: string
  commissionRate: string
  referralName: string
  status: LeadStatus
  lastContact: string
  nextFollowUp: string
  notes: string
  convertToStudent: boolean
}

const EMPTY: LeadFormValues = {
  name: '',
  phone: '',
  email: '',
  address: '',
  inquiryDate: new Date().toISOString().slice(0, 10),
  courseId: '',
  intakeDate: '',
  budget: '',
  educationLevel: '',
  source: 'walk-in',
  agentName: '',
  commissionRate: '',
  referralName: '',
  status: 'new',
  lastContact: '',
  nextFollowUp: '',
  notes: '',
  convertToStudent: false,
}

interface LeadFormProps {
  open: boolean
  onClose: () => void
  lead?: Lead | null
  onSaved: () => void
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block font-inter text-xs font-medium uppercase tracking-wide text-[#5A6A7A]">
      {children}
    </label>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 font-jakarta text-sm font-bold text-[#0B3D6B]">
      {children}
    </h3>
  )
}

function leadToForm(l: Lead): LeadFormValues {
  return {
    name: l.name,
    phone: l.phone,
    email: l.email ?? '',
    address: l.address ?? '',
    inquiryDate: l.inquiryDate?.slice(0, 10) ?? l.createdAt.slice(0, 10),
    courseId: l.courseId,
    intakeDate: l.intakeDate?.slice(0, 10) ?? '',
    budget: l.budget ?? '',
    educationLevel: l.educationLevel ?? '',
    source: l.source,
    agentName: l.agentName ?? '',
    commissionRate: l.commissionRate != null ? String(l.commissionRate) : '',
    referralName: l.referralName ?? '',
    status: l.status,
    lastContact: l.lastContact?.slice(0, 10) ?? '',
    nextFollowUp: l.nextFollowUp?.slice(0, 10) ?? '',
    notes: l.notes ?? '',
    convertToStudent: false,
  }
}

export default function LeadForm({ open, onClose, lead, onSaved }: LeadFormProps) {
  const { user } = useManagement()
  const [form, setForm] = useState<LeadFormValues>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isEdit = !!lead

  useEffect(() => {
    if (open) {
      setForm(lead ? leadToForm(lead) : EMPTY)
      setError('')
    }
  }, [open, lead])

  function setField<K extends keyof LeadFormValues>(
    key: K,
    value: LeadFormValues[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function convertToStudent(leadId: string, values: LeadFormValues) {
    if (!user || !values.courseId) return undefined
    const studentDocId = doc(collection(db, 'students')).id
    const allSnap = await getDocs(collection(db, 'students'))
    const studentCode = await generateStudentCode(allSnap.size)
    const fee = values.budget ? Number(values.budget.replace(/[^\d]/g, '')) || 0 : 0

    await setDoc(doc(db, 'students', studentDocId), {
      name: values.name.trim(),
      mobile: values.phone.trim(),
      email: values.email.trim() || null,
      address: values.address.trim() || null,
      nic: '',
      courseId: values.courseId,
      batchId: '',
      branchId: user.branchId ?? 'galle-main',
      registrationFee: fee || 25000,
      feeAmount: fee || 25000,
      feeCurrency: 'LKR',
      status: 'pending',
      paymentStatus: 'pending',
      notes: values.notes.trim() || null,
      createdAt: serverTimestamp(),
      createdBy: user.uid,
      studentCode,
    })

    await logAuditEvent({
      userId: user.uid,
      userEmail: user.email,
      userRole: user.role,
      action: 'student_registered',
      entityType: 'student',
      entityId: studentDocId,
      details: `Converted lead ${values.name.trim()} to student ${studentCode}`,
    })

    return studentDocId
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    if (!form.courseId) {
      setError('Please select a course of interest.')
      return
    }

    setSaving(true)
    setError('')

    try {
      const leadId = lead?.id ?? doc(collection(db, 'leads')).id
      let convertedToStudentId = lead?.convertedToStudentId

      const shouldConvert =
        form.status === 'enrolled' &&
        form.convertToStudent &&
        !convertedToStudentId

      if (shouldConvert) {
        convertedToStudentId = await convertToStudent(leadId, form)
      }

      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        inquiryDate: form.inquiryDate || null,
        courseId: form.courseId,
        intakeDate: form.intakeDate || null,
        budget: form.budget.trim() || null,
        educationLevel: form.educationLevel.trim() || null,
        source: form.source,
        agentName:
          form.source === 'agent' ? form.agentName.trim() || null : null,
        commissionRate:
          form.source === 'agent' && form.commissionRate
            ? Number(form.commissionRate)
            : null,
        referralName:
          form.source === 'referral' ? form.referralName.trim() || null : null,
        status: form.status,
        lastContact: form.lastContact || null,
        nextFollowUp: form.nextFollowUp || null,
        notes: form.notes.trim() || null,
        convertedToStudentId: convertedToStudentId ?? null,
        branchId: user.branchId ?? 'galle-main',
      }

      if (isEdit) {
        await updateDoc(doc(db, 'leads', leadId), payload)
        await logAuditEvent({
          userId: user.uid,
          userEmail: user.email,
          userRole: user.role,
          action: 'updated',
          entityType: 'lead',
          entityId: leadId,
          details: `Updated lead ${form.name.trim()}`,
        })
      } else {
        await setDoc(doc(db, 'leads', leadId), {
          ...payload,
          createdAt: serverTimestamp(),
          createdBy: user.uid,
        })
        await logAuditEvent({
          userId: user.uid,
          userEmail: user.email,
          userRole: user.role,
          action: 'created',
          entityType: 'lead',
          entityId: leadId,
          details: `Created lead ${form.name.trim()}`,
        })
      }

      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save lead')
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
      >
        <div className="flex items-center justify-between border-b border-[#DDE3EC] px-6 py-4">
          <h2 className="font-jakarta text-lg font-bold text-[#0D1B2A]">
            {isEdit ? 'Edit Lead' : 'Add Lead'}
          </h2>
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

            <SectionTitle>Personal Info</SectionTitle>
            <div className="mb-5 space-y-4">
              <div>
                <FieldLabel>Full Name *</FieldLabel>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setField('name', e.target.value)}
                  required
                  className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-sm outline-none focus:border-[#E8A020]"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Phone (WhatsApp) *</FieldLabel>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setField('phone', e.target.value)}
                    required
                    className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-sm outline-none focus:border-[#E8A020]"
                  />
                </div>
                <div>
                  <FieldLabel>Email</FieldLabel>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setField('email', e.target.value)}
                    className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-sm outline-none focus:border-[#E8A020]"
                  />
                </div>
              </div>
              <div>
                <FieldLabel>Address</FieldLabel>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setField('address', e.target.value)}
                  className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-sm outline-none focus:border-[#E8A020]"
                />
              </div>
              <div>
                <FieldLabel>Date of Inquiry</FieldLabel>
                <input
                  type="date"
                  value={form.inquiryDate}
                  onChange={(e) => setField('inquiryDate', e.target.value)}
                  className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-sm outline-none focus:border-[#E8A020]"
                />
              </div>
            </div>

            <SectionTitle>Program Interest</SectionTitle>
            <div className="mb-5 space-y-4">
              <div>
                <FieldLabel>Course of Interest *</FieldLabel>
                <select
                  value={form.courseId}
                  onChange={(e) =>
                    setField('courseId', e.target.value as CourseId)
                  }
                  required
                  className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-sm outline-none focus:border-[#E8A020]"
                >
                  <option value="">Select course</option>
                  {COURSES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.flag} {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Preferred Intake</FieldLabel>
                  <input
                    type="date"
                    value={form.intakeDate}
                    onChange={(e) => setField('intakeDate', e.target.value)}
                    className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-sm outline-none focus:border-[#E8A020]"
                  />
                </div>
                <div>
                  <FieldLabel>Budget Range</FieldLabel>
                  <input
                    type="text"
                    value={form.budget}
                    onChange={(e) => setField('budget', e.target.value)}
                    placeholder="e.g. 50,000 - 100,000 LKR"
                    className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-sm outline-none focus:border-[#E8A020]"
                  />
                </div>
              </div>
              <div>
                <FieldLabel>Current Education Level</FieldLabel>
                <input
                  type="text"
                  value={form.educationLevel}
                  onChange={(e) => setField('educationLevel', e.target.value)}
                  placeholder="O/L, A/L, Diploma, Degree…"
                  className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-sm outline-none focus:border-[#E8A020]"
                />
              </div>
            </div>

            <SectionTitle>Source &amp; Agent</SectionTitle>
            <div className="mb-5 space-y-4">
              <div>
                <FieldLabel>Lead Source</FieldLabel>
                <select
                  value={form.source}
                  onChange={(e) =>
                    setField('source', e.target.value as LeadSource)
                  }
                  className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-sm outline-none focus:border-[#E8A020]"
                >
                  {LEAD_SOURCES.map((s) => (
                    <option key={s} value={s}>
                      {s === 'walk-in'
                        ? 'Walk-in'
                        : s.charAt(0).toUpperCase() + s.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              {form.source === 'agent' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <FieldLabel>Agent Name</FieldLabel>
                    <input
                      type="text"
                      value={form.agentName}
                      onChange={(e) => setField('agentName', e.target.value)}
                      className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-sm outline-none focus:border-[#E8A020]"
                    />
                  </div>
                  <div>
                    <FieldLabel>Commission Rate (%)</FieldLabel>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={form.commissionRate}
                      onChange={(e) => setField('commissionRate', e.target.value)}
                      className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-sm outline-none focus:border-[#E8A020]"
                    />
                  </div>
                </div>
              )}
              {form.source === 'referral' && (
                <div>
                  <FieldLabel>Referral Name</FieldLabel>
                  <input
                    type="text"
                    value={form.referralName}
                    onChange={(e) => setField('referralName', e.target.value)}
                    className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-sm outline-none focus:border-[#E8A020]"
                  />
                </div>
              )}
            </div>

            <SectionTitle>Follow-up</SectionTitle>
            <div className="mb-5 space-y-4">
              <div>
                <FieldLabel>Status</FieldLabel>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setField('status', e.target.value as LeadStatus)
                  }
                  className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-sm outline-none focus:border-[#E8A020]"
                >
                  <option value="new">New Inquiry</option>
                  <option value="contacted">Contacted</option>
                  <option value="interested">Interested</option>
                  <option value="applied">Applied</option>
                  <option value="enrolled">Enrolled</option>
                  <option value="lost">Lost</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Last Contact</FieldLabel>
                  <input
                    type="date"
                    value={form.lastContact}
                    onChange={(e) => setField('lastContact', e.target.value)}
                    className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-sm outline-none focus:border-[#E8A020]"
                  />
                </div>
                <div>
                  <FieldLabel>Next Follow-up</FieldLabel>
                  <input
                    type="date"
                    value={form.nextFollowUp}
                    onChange={(e) => setField('nextFollowUp', e.target.value)}
                    className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-sm outline-none focus:border-[#E8A020]"
                  />
                </div>
              </div>
              <div>
                <FieldLabel>Notes</FieldLabel>
                <textarea
                  value={form.notes}
                  onChange={(e) => setField('notes', e.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-sm outline-none focus:border-[#E8A020]"
                />
              </div>
              {form.status === 'enrolled' && !lead?.convertedToStudentId && (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.convertToStudent}
                    onChange={(e) => setField('convertToStudent', e.target.checked)}
                    className="rounded border-[#DDE3EC] text-[#E8A020] focus:ring-[#E8A020]"
                  />
                  <span className="font-inter text-sm text-[#0D1B2A]">
                    Convert to student record
                  </span>
                </label>
              )}
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
              className="flex-1 rounded-lg bg-[#E8A020] py-2.5 font-jakarta text-sm font-bold text-[#0B3D6B] hover:bg-[#F5B942] disabled:opacity-60"
            >
              {saving ? 'Saving…' : isEdit ? 'Update Lead' : 'Save Lead'}
            </button>
          </div>
        </form>
      </aside>
    </>
  )
}
