'use client'

import { useEffect, useState } from 'react'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { auth, db, storage } from '@/lib/firebase/client'
import { COURSES, COURSE_MAP } from '@/lib/constants/courses'
import {
  generateStudentCode,
  generateFriendlyPassword,
  sendWhatsAppNotification,
  sendCredentialsEmail,
} from '@/lib/students/helpers'
import { generateParentAccessCode } from '@/lib/parent/helpers'
import { useManagement } from '@/components/layout/ManagementContext'
import { logAuditEvent } from '@/lib/audit/helpers'
import { buildAutoInstallments, PLAN_SOURCE } from '@/lib/payments/autoInstallments'
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
  /** 9-digit numeric Student ID — the login username (→ {idNumber}@epiccampus.lk). */
  idNumber: string
  email: string
  password: string
  address: string
  courseId: CourseId | ''
  batchId: string
  batchDuration: BatchDuration | ''
  batchCustomDays: string
  batchStartDate: string
  location: StudentLocation | ''
  agentId: string
  referredByStaffId: string
  houseId: string
  enrollmentDate: string
  expectedCompletionDate: string
  feeAmount: string
  feeCurrency: 'LKR' | 'USD'
  paymentStatus: 'paid' | 'partial' | 'pending'
  paidAmount: string
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

/** Generates a random 9-digit numeric Student ID (100000000–999999999). Used as
 *  the login username via {idNumber}@epiccampus.lk. Uniqueness is re-checked
 *  against existing students at submit time. */
function generateIdNumber(): string {
  return String(Math.floor(100000000 + Math.random() * 900000000))
}

const LOGIN_EMAIL_DOMAIN = 'epiccampus.lk'

function makeEmptyForm(): StudentFormValues {
  return {
    name: '',
    nic: '',
    dateOfBirth: '',
    mobile: '',
    idNumber: generateIdNumber(),
    email: '',
    password: generateFriendlyPassword(),
    address: '',
    courseId: '',
    batchId: '',
    batchDuration: '90days',
    batchCustomDays: '',
    batchStartDate: new Date().toISOString().slice(0, 10),
    location: 'ahangama',
    agentId: '',
    referredByStaffId: '',
    houseId: '',
    enrollmentDate: new Date().toISOString().slice(0, 10),
    expectedCompletionDate: '',
    feeAmount: '',
    feeCurrency: 'LKR',
    paymentStatus: 'pending',
    paidAmount: '',
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
    idNumber: s.idNumber ?? generateIdNumber(),
    email: s.personalEmail ?? s.email ?? '',
    password: generateFriendlyPassword(),
    address: s.address ?? '',
    courseId: s.courseId,
    batchId: s.batchId,
    batchDuration: s.batchDuration ?? '90days',
    batchCustomDays: s.batchCustomDays != null ? String(s.batchCustomDays) : '',
    batchStartDate: s.batchStartDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    location: s.location ?? 'ahangama',
    agentId: s.agentId ?? '',
    referredByStaffId: s.referredByStaffId ?? '',
    houseId: (s as unknown as Record<string, unknown>).houseId
      ? String((s as unknown as Record<string, unknown>).houseId)
      : '',
    enrollmentDate: s.enrollmentDate?.slice(0, 10) ?? '',
    expectedCompletionDate: s.expectedCompletionDate?.slice(0, 10) ?? '',
    feeAmount: s.feeAmount != null ? String(s.feeAmount) : '',
    feeCurrency: s.feeCurrency ?? 'LKR',
    paymentStatus: s.paymentStatus ?? 'pending',
    paidAmount: s.paidAmount != null ? String(s.paidAmount) : '',
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

/** Keeps the payments/{studentId} plan doc (read by the Payments and Payment
 *  Tracker pages) in sync with the fee/payment-status fields on this form.
 *  Skipped entirely when there's no fee, and left untouched if a plan already
 *  exists that wasn't created by this same auto-sync (e.g. a manually configured
 *  multi-installment schedule) — so we never clobber real payment history. */
async function syncPaymentPlan(params: {
  studentDocId: string
  studentName: string
  studentCode: string
  courseId: CourseId | ''
  location: string
  branchId: string
  feeAmount: number
  feeCurrency: 'LKR' | 'USD'
  paymentStatus: StudentFormValues['paymentStatus']
  paidAmount: number
}): Promise<void> {
  if (params.feeAmount <= 0) return
  const planRef = doc(db, 'payments', params.studentDocId)
  const existing = await getDoc(planRef)
  if (existing.exists() && existing.data().source !== PLAN_SOURCE.STUDENT_FORM) {
    return
  }

  await setDoc(planRef, {
    studentId: params.studentDocId,
    studentName: params.studentName,
    studentCode: params.studentCode,
    courseId: params.courseId,
    program: params.courseId ? (COURSE_MAP[params.courseId]?.label ?? params.courseId) : '',
    location: params.location,
    branch: params.branchId,
    totalFee: params.feeAmount,
    currency: params.feeCurrency,
    installments: buildAutoInstallments(params.feeAmount, params.paymentStatus, params.paidAmount),
    source: PLAN_SOURCE.STUDENT_FORM,
    createdAt: existing.exists() ? (existing.data().createdAt ?? serverTimestamp()) : serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
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
  const [houses, setHouses] = useState<{ id: string; name: string; capacity: number }[]>([])
  const [guardianSectionOpen, setGuardianSectionOpen] = useState(false)
  // After a new student's login account is created, show their credentials so
  // reception can send them — the generated password isn't stored anywhere else.
  const [createdCreds, setCreatedCreds] = useState<{
    name: string
    studentCode: string
    idNumber: string
    email: string
    password: string
    phone: string
  } | null>(null)
  const [whatsAppState, setWhatsAppState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [copied, setCopied] = useState(false)

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
      // Load active houses for the accommodation assignment dropdown.
      void getDocs(query(collection(db, 'accommodations'), where('status', '==', 'active')))
        .then((snap) => {
          setHouses(
            snap.docs
              .map((d) => ({
                id: d.id,
                name: String(d.data().name ?? ''),
                capacity: Number(d.data().capacity ?? 0),
              }))
              .sort((a, b) => a.name.localeCompare(b.name)),
          )
        })
        .catch(() => setHouses([]))
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
    loginEmail: string,
    idNumber: string,
    personalEmail: string,
    name: string,
    password: string,
  ): Promise<{ uid: string; password: string; created: boolean } | undefined> {
    const token = await auth.currentUser?.getIdToken()
    const res = await fetch('/api/students/create-account', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        email: loginEmail,
        loginEmail,
        idNumber,
        personalEmail: personalEmail || null,
        password,
        displayName: name,
        studentId: studentDocId,
      }),
    })
    if (!res.ok) {
      const data = (await res.json()) as { error?: string }
      throw new Error(data.error ?? 'Failed to create login account')
    }
    // The API echoes back the password it actually set (and whether a brand-new
    // account was created vs. an existing one reused).
    const data = (await res.json()) as { uid: string; password?: string; created?: boolean }
    const effectivePassword = data.password ?? password
    // Welcome email goes to the student's REAL address only — the synthetic login
    // email ({id}@epiccampus.lk) is not a real mailbox. Skip when none on file.
    if (personalEmail) await sendCredentialsEmail(personalEmail, name, effectivePassword)
    return { uid: data.uid, password: effectivePassword, created: data.created ?? true }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    if (!form.mobile.trim()) {
      setError('Phone number is required — reception must enter a phone number so login credentials can be sent via WhatsApp.')
      return
    }
    setSaving(true)
    setError('')

    let pendingCreds: {
      name: string
      studentCode: string
      idNumber: string
      email: string
      password: string
      phone: string
    } | null = null

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

      const feeAmountNum = form.feeAmount ? Number(form.feeAmount) : 0
      const paidAmountNum = form.paymentStatus === 'partial' ? (Number(form.paidAmount) || 0) : 0
      const pendingAmountNum =
        form.paymentStatus === 'paid'
          ? 0
          : form.paymentStatus === 'partial'
            ? Math.max(0, feeAmountNum - paidAmountNum)
            : feeAmountNum

      // form.email now holds the PERSONAL email. The doc's `email` field is the auth
      // identity — on edit we must preserve the existing login email (synthetic for
      // ID-login students), never overwrite it with the personal address. On create
      // it's overridden with the generated login email below.
      const personalEmailValue = form.email.trim() || null
      const emailForDoc = isEdit
        ? (student?.loginEmail ?? student?.email ?? personalEmailValue)
        : personalEmailValue

      const payload = {
        name: form.name.trim(),
        nic: form.nic.trim(),
        dateOfBirth: form.dateOfBirth || null,
        mobile: form.mobile.trim(),
        email: emailForDoc,
        personalEmail: personalEmailValue,
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
        houseId: form.houseId || null,
        branchId: user.branchId ?? 'galle-main',
        enrollmentDate: form.enrollmentDate || null,
        expectedCompletionDate: form.expectedCompletionDate || null,
        feeAmount: form.feeAmount ? Number(form.feeAmount) : 0,
        feeCurrency: form.feeCurrency,
        registrationFee: form.feeAmount ? Number(form.feeAmount) : 0,
        paymentStatus: form.paymentStatus,
        paidAmount: paidAmountNum,
        pendingAmount: pendingAmountNum,
        status: form.status,
        visaStatus: form.visaStatus,
        notes: form.notes.trim() || null,
        guardian: guardianPayload,
        updatedAt: serverTimestamp(),
      }

      if (isEdit) {
        await updateDoc(doc(db, 'students', studentDocId), payload)
        try {
          await syncPaymentPlan({
            studentDocId,
            studentName: form.name.trim(),
            studentCode: student?.studentCode ?? '',
            courseId: form.courseId,
            location: form.location || 'ahangama',
            branchId: user.branchId ?? 'galle-main',
            feeAmount: feeAmountNum,
            feeCurrency: form.feeCurrency,
            paymentStatus: form.paymentStatus,
            paidAmount: paidAmountNum,
          })
        } catch (planErr) {
          console.warn('[StudentForm] Payment plan sync skipped:', planErr)
        }
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

        // Ensure the 9-digit Student ID is unique before it becomes the login username.
        const existingIds = new Set(
          allSnap.docs.map((d) => String(d.data().idNumber ?? '')).filter(Boolean),
        )
        let finalIdNumber = form.idNumber
        while (existingIds.has(finalIdNumber)) finalIdNumber = generateIdNumber()
        const loginEmail = `${finalIdNumber}@${LOGIN_EMAIL_DOMAIN}`
        const personalEmail = form.email.trim()

        await setDoc(doc(db, 'students', studentDocId), {
          ...payload,
          studentCode,
          idNumber: finalIdNumber,
          loginEmail,
          // payload already carries personalEmail (= form.email). Auth identity is the
          // synthetic login email, keeping createStudentAccount's email-based dedup
          // aligned with the Firebase Auth account.
          email: loginEmail,
          uid: null,
          feeSchedule: defaultFeeSchedule(),
          parentAccessCode: generateParentAccessCode(),
          parentAccessEnabled: true,
          createdAt: serverTimestamp(),
          createdBy: user.uid,
        })

        try {
          await syncPaymentPlan({
            studentDocId,
            studentName: form.name.trim(),
            studentCode,
            courseId: form.courseId,
            location: form.location || 'ahangama',
            branchId: user.branchId ?? 'galle-main',
            feeAmount: feeAmountNum,
            feeCurrency: form.feeCurrency,
            paymentStatus: form.paymentStatus,
            paidAmount: paidAmountNum,
          })
        } catch (planErr) {
          console.warn('[StudentForm] Payment plan sync skipped:', planErr)
        }

        // Every student now gets a login — the Student ID is the username, so no
        // typed email is required.
        try {
          const authResult = await createAuthAccount(
            studentDocId,
            loginEmail,
            finalIdNumber,
            personalEmail,
            form.name.trim(),
            form.password.trim() || generateFriendlyPassword(),
          )
          if (authResult?.uid) {
            await updateDoc(doc(db, 'students', studentDocId), { uid: authResult.uid })
            // Only surface credentials for a genuinely new account — an existing
            // account's real password wasn't changed, so showing one would mislead.
            if (authResult.created) {
              pendingCreds = {
                name: form.name.trim(),
                studentCode,
                idNumber: finalIdNumber,
                email: loginEmail,
                password: authResult.password,
                phone: form.mobile.trim(),
              }
            }
          }
        } catch (authErr) {
          // Surface the failure instead of silently swallowing it — otherwise
          // reception thinks the login was created when it wasn't.
          console.error('[StudentForm] Account creation failed:', authErr)
          setError('Failed to create login account. Please try again.')
          return
        }

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
      if (pendingCreds) {
        // Keep the credentials on screen until reception explicitly closes them.
        setWhatsAppState('idle')
        setCopied(false)
        setCreatedCreds(pendingCreds)
      } else {
        onClose()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save student')
    } finally {
      setSaving(false)
    }
  }

  function sendCredsWhatsApp() {
    if (!createdCreds) return
    if (!createdCreds.phone) {
      setWhatsAppState('error')
      return
    }
    // Normalise to an international number for wa.me (Sri Lanka: leading 0 → 94).
    const phone = createdCreds.phone.replace(/\D/g, '').replace(/^0/, '94')
    const text =
      `Welcome to EPIC Campus! Your login:\n` +
      `Student ID: ${createdCreds.idNumber}\n` +
      `Login Email: ${createdCreds.email}\n` +
      `Password: ${createdCreds.password}\n` +
      `Login at: https://www.epiccampus.live`
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
    setWhatsAppState('sent')
  }

  async function copyCreds() {
    if (!createdCreds) return
    const text =
      `EPIC Campus login details\n` +
      `Name: ${createdCreds.name}\n` +
      `Student Code: ${createdCreds.studentCode}\n` +
      `Student ID (login): ${createdCreds.idNumber}\n` +
      `Portal: www.epiccampus.live\n` +
      `Login Email: ${createdCreds.email}\n` +
      `Password: ${createdCreds.password}`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard blocked — ignore */
    }
  }

  function closeCredsModal() {
    setCreatedCreds(null)
    onClose()
  }

  // Credentials modal survives even after the form aside is dismissed.
  if (!open && !createdCreds) return null

  return (
    <>
      {open && (
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
                  <FieldLabel>Phone (WhatsApp) <span className="text-red-500">*</span></FieldLabel>
                  <TextInput
                    value={form.mobile}
                    onChange={(v) => setField('mobile', v)}
                    placeholder="07XXXXXXXX"
                    required
                  />
                  {!form.mobile.trim() && (
                    <p className="mt-1 text-xs font-medium text-red-500">
                      Required to send login credentials via WhatsApp
                    </p>
                  )}
                </div>
                <div>
                  <FieldLabel>Personal Email (optional)</FieldLabel>
                  <TextInput
                    type="email"
                    value={form.email}
                    onChange={(v) => setField('email', v)}
                    placeholder="student@email.com"
                  />
                  <p className="mt-1 text-xs text-[#5A6A7A]">
                    Contact email only — NOT the login. Students log in with their Student ID (below). A Gmail address here also lets them sign in with Google.
                  </p>
                </div>
              </div>

              {!isEdit && (
                <div className="rounded-lg border border-[#DDE3EC] bg-[#F5F7FB] p-4">
                  <FieldLabel>Login ID (Student ID)</FieldLabel>
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex-1 rounded-lg border border-[#DDE3EC] bg-white px-3 py-2.5 font-mono text-base font-bold tracking-wider text-[#0B3D6B]">
                      {form.idNumber}
                    </div>
                    <button
                      type="button"
                      onClick={() => setField('idNumber', generateIdNumber())}
                      className="shrink-0 rounded-lg border border-[#DDE3EC] bg-white px-3 py-2.5 text-sm font-semibold text-[#0B3D6B] hover:bg-[#F5F7FB]"
                      title="Generate a new Student ID"
                    >
                      <span className="ti ti-refresh mr-1" aria-hidden="true" />
                      New ID
                    </button>
                  </div>
                  <FieldLabel>Login Email (auto-generated)</FieldLabel>
                  <div className="mb-3 w-full rounded-lg border border-[#DDE3EC] bg-white px-3 py-2.5 font-mono text-sm text-[#5A6A7A]">
                    {form.idNumber}@{LOGIN_EMAIL_DOMAIN}
                  </div>
                  <FieldLabel>Login Password</FieldLabel>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={form.password}
                      onChange={(e) => setField('password', e.target.value)}
                      placeholder="Auto-generated password"
                      className="flex-1 rounded-lg border border-[#DDE3EC] bg-white px-3 py-2.5 font-mono text-base font-semibold text-[#0B3D6B] outline-none focus:border-[#E8A020] sm:text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setField('password', generateFriendlyPassword())}
                      className="shrink-0 rounded-lg border border-[#DDE3EC] bg-white px-3 py-2.5 text-sm font-semibold text-[#0B3D6B] hover:bg-[#F5F7FB]"
                      title="Generate a new password"
                    >
                      <span className="ti ti-refresh mr-1" aria-hidden="true" />
                      Generate Password
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard?.writeText(form.password).catch(() => {})
                      }}
                      className="shrink-0 rounded-lg border border-[#DDE3EC] bg-white p-2.5 text-[#5A6A7A] hover:bg-[#F5F7FB]"
                      title="Copy password"
                      aria-label="Copy password"
                    >
                      <span className="ti ti-copy" aria-hidden="true" />
                    </button>
                  </div>
                  <p className="mt-1.5 text-xs text-[#5A6A7A]">
                    Share this password with the student. They can change it from their portal.
                  </p>
                </div>
              )}

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

              {form.paymentStatus === 'partial' && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <FieldLabel>Amount Paid *</FieldLabel>
                    <TextInput
                      type="number"
                      value={form.paidAmount}
                      onChange={(v) => setField('paidAmount', v)}
                      placeholder="0"
                      required
                    />
                  </div>
                  <div>
                    <FieldLabel>Pending Amount</FieldLabel>
                    <div className="w-full rounded-lg border border-[#DDE3EC] bg-[#F5F7FB] px-3 py-2.5 font-inter text-base font-bold text-[#E8A020] sm:text-sm">
                      {form.feeCurrency}{' '}
                      {Math.max(
                        0,
                        (Number(form.feeAmount) || 0) - (Number(form.paidAmount) || 0),
                      ).toLocaleString()}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <SectionTitle icon="ti-home" title="Accommodation" />
            <div className="mb-6">
              <FieldLabel>Assigned House</FieldLabel>
              <SelectInput
                value={form.houseId}
                onChange={(v) => setField('houseId', v)}
              >
                <option value="">Not assigned</option>
                {houses.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name} (capacity {h.capacity})
                  </option>
                ))}
              </SelectInput>
              <p className="mt-1 text-xs text-[#5A6A7A]">
                Assign the student to a boarding house — appears on their dashboard.
              </p>
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
      )}

      {/* Success — show generated login credentials for a newly created student */}
      {createdCreds && (
        <>
          <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm" aria-hidden="true" />
          <div className="fixed left-1/2 top-1/2 z-[60] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white dark:bg-[#1A1535] p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                <span className="ti ti-circle-check text-2xl text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h2 className="font-jakarta text-lg font-bold text-[#0D1B2A] dark:text-white">Student account created</h2>
                <p className="text-xs text-[#5A6A7A] dark:text-white/50">Share these login details with the student.</p>
              </div>
            </div>

            <div className="space-y-2 rounded-xl bg-[#F5F7FB] dark:bg-white/[0.04] px-4 py-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-[#5A6A7A] dark:text-white/50">Name</span>
                <span className="font-semibold text-[#0D1B2A] dark:text-white">{createdCreds.name}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-[#5A6A7A] dark:text-white/50">Student Code</span>
                <span className="font-mono font-semibold text-[#0D1B2A] dark:text-white">{createdCreds.studentCode}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-[#5A6A7A] dark:text-white/50">Login ID</span>
                <span className="font-mono text-base font-bold text-[#0B3D6B] dark:text-[#E8A020]">{createdCreds.idNumber}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-[#5A6A7A] dark:text-white/50">Login Email</span>
                <span className="font-semibold text-[#0D1B2A] dark:text-white break-all">{createdCreds.email}</span>
              </div>
              <div className="flex justify-between gap-3 border-t border-[#DDE3EC] dark:border-white/[0.08] pt-2">
                <span className="text-[#5A6A7A] dark:text-white/50">Password</span>
                <span className="font-mono text-base font-bold text-[#0B3D6B] dark:text-[#E8A020]">{createdCreds.password}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-[#5A6A7A] dark:text-white/50">Login URL</span>
                <span className="font-semibold text-[#0D1B2A] dark:text-white break-all">epiccampus.live/login</span>
              </div>
            </div>

            <div className="mt-3 rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
              Note: Student must have WhatsApp active on this number.
            </div>

            {whatsAppState === 'sent' && (
              <p className="mt-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">✓ Opened WhatsApp with the message ready to send</p>
            )}
            {whatsAppState === 'error' && (
              <p className="mt-2 text-xs font-semibold text-red-600 dark:text-red-400">
                No phone number on file — copy the details instead.
              </p>
            )}

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => void copyCreds()}
                className="flex-1 rounded-xl border border-gray-200 dark:border-white/10 py-2.5 text-sm font-semibold text-gray-700 dark:text-white/70 hover:bg-gray-50 dark:hover:bg-white/[0.06]"
              >
                <span className="ti ti-copy mr-1" /> {copied ? 'Copied!' : 'Copy credentials'}
              </button>
              <button
                type="button"
                disabled={whatsAppState === 'sending'}
                onClick={() => void sendCredsWhatsApp()}
                className="flex-[2] rounded-xl bg-green-600 py-2.5 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50"
              >
                {whatsAppState === 'sending' ? (
                  <><span className="ti ti-loader animate-spin mr-1" /> Sending…</>
                ) : (
                  <><span className="ti ti-brand-whatsapp mr-1" /> Send via WhatsApp</>
                )}
              </button>
            </div>

            <button
              type="button"
              onClick={closeCredsModal}
              className="mt-3 w-full rounded-xl py-2 text-sm font-semibold text-[#5A6A7A] dark:text-white/60 hover:bg-[#F5F7FB] dark:hover:bg-white/[0.06]"
            >
              Close
            </button>
          </div>
        </>
      )}
    </>
  )
}
