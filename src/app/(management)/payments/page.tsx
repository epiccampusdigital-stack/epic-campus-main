'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  Timestamp,
} from 'firebase/firestore'
import toast from 'react-hot-toast'
import { db } from '@/lib/firebase/client'
import { COURSE_MAP, COURSES } from '@/lib/constants/courses'
import { FIRESTORE_LIST_LIMIT } from '@/lib/constants/firestore'
import { formatLKR } from '@/lib/utils/formatCurrency'
import { formatPaymentDate } from '@/lib/payments/helpers'
import { parseStudent } from '@/lib/students/helpers'
import { useManagement } from '@/components/layout/ManagementContext'
import type {
  CourseId,
  PaymentInstallment,
  Student,
  StudentPaymentPlan,
} from '@/types'

const PAGE_SIZE = 12
const INSTALLMENT_COUNTS = [1, 2, 3, 4, 6, 12] as const

type PaymentPlanStatus = 'paid' | 'partial' | 'unpaid' | 'overdue' | 'no-plan'

interface StudentPlanRow {
  student: Student
  plan?: StudentPaymentPlan
  totalFee: number
  totalPaid: number
  installmentCount: number
  paidCount: number
  progress: number
  status: PaymentPlanStatus
  nextUnpaid?: PaymentInstallment
  isOverdue: boolean
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date)
  result.setMonth(result.getMonth() + months)
  return result
}

function parsePaymentPlan(
  id: string,
  data: Record<string, unknown>,
): StudentPaymentPlan | null {
  if (!data || typeof data !== 'object') return null
  const installments = Array.isArray(data.installments)
    ? data.installments.map((inst, index) => {
        const raw = inst as Record<string, unknown>
        return {
          id: String(raw.id ?? `inst-${index + 1}`),
          label: String(raw.label ?? `Installment ${index + 1}`),
          amount: Number(raw.amount ?? 0),
          dueDate: raw.dueDate instanceof Timestamp
            ? raw.dueDate.toDate().toISOString()
            : String(raw.dueDate ?? ''),
          paidAt: raw.paidAt instanceof Timestamp
            ? raw.paidAt.toDate().toISOString()
            : raw.paidAt
            ? String(raw.paidAt)
            : undefined,
          paidBy: raw.paidBy ? String(raw.paidBy) : undefined,
        }
      })
    : []

  if (!data.studentId || !Array.isArray(data.installments)) return null

  return {
    id,
    studentId: String(data.studentId),
    studentName: String(data.studentName ?? ''),
    program: String(data.program ?? ''),
    branch: String(data.branch ?? ''),
    totalFee: Number(data.totalFee ?? 0),
    currency: 'LKR',
    installments,
    createdAt:
      data.createdAt instanceof Timestamp
        ? data.createdAt.toDate().toISOString()
        : String(data.createdAt ?? new Date().toISOString()),
  }
}

function planStatus(plan?: StudentPaymentPlan): PaymentPlanStatus {
  if (!plan) return 'no-plan'
  const total = plan.installments.length
  const paid = plan.installments.filter((installment) => installment.paidAt).length
  const now = new Date()
  const hasOverdue = plan.installments.some((installment) => {
    if (installment.paidAt) return false
    const due = new Date(installment.dueDate)
    return due < now
  })
  if (total === 0) return 'unpaid'
  if (paid === total) return 'paid'
  if (hasOverdue) return 'overdue'
  if (paid > 0) return 'partial'
  return 'unpaid'
}

function formatStatusLabel(status: PaymentPlanStatus): string {
  switch (status) {
    case 'paid':
      return 'Paid'
    case 'partial':
      return 'Partial'
    case 'overdue':
      return 'Overdue'
    case 'unpaid':
      return 'Unpaid'
    default:
      return 'No plan'
  }
}

function statusClasses(status: PaymentPlanStatus): string {
  switch (status) {
    case 'paid':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'partial':
      return 'bg-amber-50 text-amber-700 border-amber-200'
    case 'overdue':
      return 'bg-red-50 text-red-700 border-red-200'
    case 'unpaid':
      return 'bg-orange-50 text-orange-700 border-orange-200'
    default:
      return 'bg-gray-50 text-gray-600 border-gray-200'
  }
}

function buildInstallments(
  totalFee: number,
  count: number,
  firstDueDate: string,
): PaymentInstallment[] {
  const amounts: number[] = []
  const base = Math.floor(totalFee / count)
  let remainder = totalFee - base * count

  for (let index = 0; index < count; index += 1) {
    const amount = base + (remainder > 0 ? 1 : 0)
    amounts.push(amount)
    remainder -= amount > base ? 1 : 0
  }

  const startDate = new Date(firstDueDate)
  return amounts.map((amount, index) => {
    const due = addMonths(startDate, index)
    return {
      id: `inst-${index + 1}`,
      label: index === 0 ? 'Registration' : `Installment ${index + 1}`,
      amount,
      dueDate: due.toISOString(),
      paidAt: undefined,
      paidBy: undefined,
    }
  })
}

function getStudentRow(
  student: Student,
  plan?: StudentPaymentPlan,
): StudentPlanRow {
  const installments = plan?.installments ?? []
  const paidCount = installments.filter((installment) => installment.paidAt).length
  const totalPaid = installments.reduce(
    (sum, installment) => sum + (installment.paidAt ? installment.amount : 0),
    0,
  )
  const totalFee = plan?.totalFee ?? 0
  const progress = totalFee === 0 ? 0 : Math.round((paidCount / Math.max(1, installments.length)) * 100)
  const status = planStatus(plan)
  const now = new Date()
  const nextUnpaid = installments
    .filter((installment) => !installment.paidAt)
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0]
  const isOverdue = installments.some((installment) => {
    if (installment.paidAt) return false
    return new Date(installment.dueDate) < now
  })

  return {
    student,
    plan,
    totalFee,
    totalPaid,
    installmentCount: installments.length,
    paidCount,
    progress,
    status,
    nextUnpaid,
    isOverdue,
  }
}

export default function PaymentsPage() {
  const router = useRouter()
  const { user, hasRole } = useManagement()
  const [students, setStudents] = useState<Student[]>([])
  const [plans, setPlans] = useState<StudentPaymentPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [branchFilter, setBranchFilter] = useState('')
  const [programFilter, setProgramFilter] = useState<CourseId | ''>('')
  const [statusFilter, setStatusFilter] = useState<PaymentPlanStatus | ''>('')
  const [page, setPage] = useState(1)
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null)
  const [selectedPlanIds, setSelectedPlanIds] = useState<string[]>([])
  const [setupPlanStudentId, setSetupPlanStudentId] = useState<string | null>(null)
  const [setupForm, setSetupForm] = useState({
    totalFee: '',
    installments: '3',
    firstDueDate: new Date().toISOString().slice(0, 10),
  })
  const [confirmBulkOpen, setConfirmBulkOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [addingInstallment, setAddingInstallment] = useState(false)
  const [installmentForm, setInstallmentForm] = useState({
    label: '',
    amount: '',
    dueDate: new Date().toISOString().slice(0, 10),
  })

  const canMarkPaid = user && (hasRole('admin') || hasRole('owner') || hasRole('accountant'))
  const canAddInstallment = user && (hasRole('admin') || hasRole('owner'))
  const canBulkPay = canMarkPaid
  const isViewOnly = hasRole('accountant') && !canMarkPaid
  // Forbidden only if every one of the user's roles is teacher/student — any other role grants access.
  const userRolesList = user?.roles ?? []
  const isForbiddenRole = userRolesList.length > 0 && userRolesList.every((r) => r === 'teacher' || r === 'student')

  useEffect(() => {
    if (isForbiddenRole) {
      router.replace('/dashboard')
    }
  }, [isForbiddenRole, router])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [studentsSnap, plansSnap] = await Promise.all([
        getDocs(query(collection(db, 'students'), limit(FIRESTORE_LIST_LIMIT))),
        getDocs(query(collection(db, 'payments'), limit(FIRESTORE_LIST_LIMIT))),
      ])

      setStudents(
        studentsSnap.docs.map((docSnapshot) =>
          parseStudent(docSnapshot.id, docSnapshot.data() as Record<string, unknown>),
        ),
      )

      setPlans(
        plansSnap.docs
          .map((docSnapshot) =>
            parsePaymentPlan(docSnapshot.id, docSnapshot.data() as Record<string, unknown>),
          )
          .filter((plan): plan is StudentPaymentPlan => plan !== null),
      )
    } catch (err) {
      console.error('[PaymentsPage] loadData', err)
      toast.error('Unable to load payment tracker data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const planMap = useMemo(() => {
    const map = new Map<string, StudentPaymentPlan>()
    for (const plan of plans) {
      map.set(plan.studentId, plan)
    }
    return map
  }, [plans])

  const rows = useMemo(
    () => students.map((student) => getStudentRow(student, planMap.get(student.id))),
    [students, planMap],
  )

  const branchOptions = useMemo(
    () => Array.from(new Set(students.map((student) => student.branchId).filter(Boolean))).sort(),
    [students],
  )

  const filteredRows = useMemo(() => {
    const lowerQuery = search.trim().toLowerCase()
    return rows.filter((row) => {
      if (branchFilter && row.student.branchId !== branchFilter) return false
      if (programFilter && row.student.courseId !== programFilter) return false
      if (statusFilter && row.status !== statusFilter) return false
      if (!lowerQuery) return true
      const programLabel = COURSE_MAP[row.student.courseId]?.label ?? row.student.courseId
      return (
        row.student.name.toLowerCase().includes(lowerQuery) ||
        programLabel.toLowerCase().includes(lowerQuery)
      )
    })
  }, [rows, search, branchFilter, programFilter, statusFilter])

  useEffect(() => {
    setPage(1)
  }, [search, branchFilter, programFilter, statusFilter])

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filteredRows.slice(start, start + PAGE_SIZE)
  }, [filteredRows, page])

  const selectedRows = useMemo(
    () => rows.filter((row) => selectedPlanIds.includes(row.plan?.id ?? '')),
    [rows, selectedPlanIds],
  )

  const selectedRow = useMemo(
    () => rows.find((row) => row.student.id === selectedStudentId) ?? null,
    [rows, selectedStudentId],
  )

  const updateStudentStatus = (plan?: StudentPaymentPlan): 'paid' | 'partial' | 'pending' => {
    if (!plan) return 'pending'
    const total = plan.installments.length
    const paid = plan.installments.filter((inst) => inst.paidAt).length
    if (total === 0) return 'pending'
    if (paid === total) return 'paid'
    if (paid > 0) return 'partial'
    return 'pending'
  }

  async function handleCreatePlan(studentId: string) {
    const student = students.find((s) => s.id === studentId)
    if (!student || !user) return
    const totalFee = Number(setupForm.totalFee)
    const count = Number(setupForm.installments)
    const firstDueDate = setupForm.firstDueDate

    if (!totalFee || totalFee <= 0) {
      toast.error('Enter a valid total fee amount.')
      return
    }

    if (!firstDueDate) {
      toast.error('Select a first due date.')
      return
    }

    const installments = buildInstallments(totalFee, count, firstDueDate)

    try {
      await setDoc(doc(db, 'payments', student.id), {
        studentId: student.id,
        studentName: student.name,
        courseId: student.courseId,
        program: COURSE_MAP[student.courseId]?.label ?? student.courseId,
        location: student.branchId ?? '',
        branch: student.branchId ?? '',
        totalFee,
        currency: 'LKR',
        installments,
        createdAt: serverTimestamp(),
      })

      await updateDoc(doc(db, 'students', student.id), {
        paymentStatus: 'pending',
        updatedAt: serverTimestamp(),
      })

      toast.success('Payment plan created.')
      setSetupPlanStudentId(null)
      setSetupForm({
        totalFee: '',
        installments: '3',
        firstDueDate: new Date().toISOString().slice(0, 10),
      })
      await loadData()
    } catch (err) {
      console.error('[PaymentsPage] createPlan', err)
      toast.error('Failed to create payment plan.')
    }
  }

  async function handleMarkInstallmentPaid(plan: StudentPaymentPlan, installmentId: string) {
    if (!user || !canMarkPaid) return
    setDetailLoading(true)
    try {
      const updatedInstallments = plan.installments.map((installment) =>
        installment.id === installmentId
          ? {
              ...installment,
              paidAt: new Date().toISOString(),
              paidBy: user.uid,
            }
          : installment,
      )

      await updateDoc(doc(db, 'payments', plan.id), {
        installments: plan.installments.map((installment) =>
          installment.id === installmentId
            ? {
                ...installment,
                paidAt: serverTimestamp(),
                paidBy: user.uid,
              }
            : installment,
        ),
      })

      const updatedPlan: StudentPaymentPlan = { ...plan, installments: updatedInstallments }
      const status = updateStudentStatus(updatedPlan)

      await updateDoc(doc(db, 'students', plan.studentId), {
        paymentStatus: status,
        updatedAt: serverTimestamp(),
      })

      setPlans((current) =>
        current.map((item) => (item.id === plan.id ? updatedPlan : item)),
      )
      toast.success('Installment marked paid.')
      await loadData()
    } catch (err) {
      console.error('[PaymentsPage] markInstallmentPaid', err)
      toast.error('Unable to update installment.')
    } finally {
      setDetailLoading(false)
    }
  }

  async function handleBulkMarkPaid() {
    if (!user || !canBulkPay) return
    setConfirmBulkOpen(false)
    setLoading(true)

    try {
      const batch = writeBatch(db)
      selectedRows.forEach((row) => {
        if (!row.plan || !row.nextUnpaid) return

        const updatedInstallments = row.plan.installments.map((installment) =>
          installment.id === row.nextUnpaid?.id
            ? {
                ...installment,
                paidAt: serverTimestamp(),
                paidBy: user.uid,
              }
            : installment,
        )

        batch.update(doc(db, 'payments', row.plan.id), {
          installments: updatedInstallments,
        })

        const newStatus = updateStudentStatus({ ...row.plan, installments: row.plan.installments.map((installment) =>
          installment.id === row.nextUnpaid?.id
            ? { ...installment, paidAt: new Date().toISOString() }
            : installment,
        ) })

        batch.update(doc(db, 'students', row.student.id), {
          paymentStatus: newStatus,
          updatedAt: serverTimestamp(),
        })
      })

      await batch.commit()
      setSelectedPlanIds([])
      toast.success(`Marked ${selectedRows.length} student${selectedRows.length === 1 ? '' : 's'} paid.`)
      await loadData()
    } catch (err) {
      console.error('[PaymentsPage] bulkMarkPaid', err)
      toast.error('Bulk payment update failed.')
    } finally {
      setLoading(false)
    }
  }

  async function handleAddInstallment(plan: StudentPaymentPlan) {
    if (!user || !canAddInstallment) return
    const amount = Number(installmentForm.amount)
    if (!installmentForm.label.trim() || !amount || !installmentForm.dueDate) {
      toast.error('Provide label, amount, and due date for the new installment.')
      return
    }

    setDetailLoading(true)
    try {
      const newInstallment: PaymentInstallment = {
        id: `inst-${Date.now()}`,
        label: installmentForm.label.trim(),
        amount,
        dueDate: new Date(installmentForm.dueDate).toISOString(),
        paidAt: undefined,
        paidBy: undefined,
      }
      const updatedInstallments = [...plan.installments, newInstallment]
      await updateDoc(doc(db, 'payments', plan.id), {
        installments: updatedInstallments,
        totalFee: plan.totalFee + amount,
      })
      await updateDoc(doc(db, 'students', plan.studentId), {
        paymentStatus: updateStudentStatus({ ...plan, installments: updatedInstallments }),
        updatedAt: serverTimestamp(),
      })

      setInstallmentForm({
        label: '',
        amount: '',
        dueDate: new Date().toISOString().slice(0, 10),
      })
      setAddingInstallment(false)
      toast.success('Installment added.')
      await loadData()
    } catch (err) {
      console.error('[PaymentsPage] addInstallment', err)
      toast.error('Failed to add installment.')
    } finally {
      setDetailLoading(false)
    }
  }

  const statusCounts = useMemo(() => {
    const counts = {
      paid: 0,
      partial: 0,
      unpaid: 0,
      overdue: 0,
      noPlan: 0,
    }
    rows.forEach((row) => {
      if (row.status === 'no-plan') counts.noPlan += 1
      else counts[row.status] += 1
    })
    return counts
  }, [rows])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-jakarta text-2xl font-bold text-[#0D1B2A]">Student Payment Tracker</h1>
          <p className="font-inter text-sm text-[#5A6A7A]">
            Track payment plans, mark installments paid, and manage student fee schedules.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {canBulkPay && selectedPlanIds.length > 0 && (
            <button
              type="button"
              onClick={() => setConfirmBulkOpen(true)}
              className="rounded-lg bg-[#E8A020] px-5 py-2.5 text-sm font-bold text-[#0B3D6B] hover:bg-[#F5B942]"
            >
              Mark selected as paid ({selectedPlanIds.length})
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-xl border border-[#DDE3EC] bg-white p-5 dark:bg-gray-800">
          <p className="text-xs font-medium uppercase tracking-wide text-[#5A6A7A]">Students</p>
          <p className="mt-2 text-2xl font-bold text-[#0B3D6B]">{students.length}</p>
        </div>
        <div className="rounded-xl border border-[#DDE3EC] bg-white p-5 dark:bg-gray-800">
          <p className="text-xs font-medium uppercase tracking-wide text-[#5A6A7A]">Payment plans</p>
          <p className="mt-2 text-2xl font-bold text-[#0B3D6B]">{plans.length}</p>
        </div>
        <div className="rounded-xl border border-[#DDE3EC] bg-white p-5 dark:bg-gray-800">
          <p className="text-xs font-medium uppercase tracking-wide text-[#5A6A7A]">Fully paid</p>
          <p className="mt-2 text-2xl font-bold text-[#0B3D6B]">{statusCounts.paid}</p>
        </div>
        <div className="rounded-xl border border-[#DDE3EC] bg-white p-5 dark:bg-gray-800">
          <p className="text-xs font-medium uppercase tracking-wide text-[#5A6A7A]">Partial</p>
          <p className="mt-2 text-2xl font-bold text-[#0B3D6B]">{statusCounts.partial}</p>
        </div>
        <div className="rounded-xl border border-[#DDE3EC] bg-white p-5 dark:bg-gray-800">
          <p className="text-xs font-medium uppercase tracking-wide text-[#5A6A7A]">Overdue</p>
          <p className="mt-2 text-2xl font-bold text-red-600">{statusCounts.overdue}</p>
        </div>
      </div>

      <div className="rounded-xl border border-[#DDE3EC] bg-white p-4 dark:bg-gray-800">
        <div className="grid gap-3 lg:grid-cols-4">
          <div className="relative lg:col-span-2">
            <span className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-[#5A6A7A]" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by student or program"
              className="w-full rounded-lg border border-[#DDE3EC] py-2.5 pl-10 pr-3 font-inter text-base outline-none focus:border-[#E8A020] sm:text-sm"
            />
          </div>
          <select
            value={programFilter}
            onChange={(e) => setProgramFilter(e.target.value as CourseId | '')}
            className="rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-sm outline-none focus:border-[#E8A020]"
          >
            <option value="">All programs</option>
            {COURSES.map((course) => (
              <option key={course.id} value={course.id}>
                {course.label}
              </option>
            ))}
          </select>
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-sm outline-none focus:border-[#E8A020]"
          >
            <option value="">All branches</option>
            {branchOptions.map((branch) => (
              <option key={branch} value={branch}>
                {branch}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as PaymentPlanStatus | '')}
            className="rounded-lg border border-[#DDE3EC] px-3 py-2.5 font-inter text-sm outline-none focus:border-[#E8A020]"
          >
            <option value="">All statuses</option>
            <option value="paid">Paid</option>
            <option value="partial">Partial</option>
            <option value="overdue">Overdue</option>
            <option value="unpaid">Unpaid</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#DDE3EC] bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#DDE3EC] bg-[#F5F7FB] dark:border-gray-700 dark:bg-gray-900">
                <th className="px-4 py-3 w-12" />
                <th className="px-4 py-3 font-jakarta text-xs font-semibold uppercase tracking-wide text-[#5A6A7A]">Student</th>
                <th className="px-4 py-3 font-jakarta text-xs font-semibold uppercase tracking-wide text-[#5A6A7A]">Program</th>
                <th className="px-4 py-3 font-jakarta text-xs font-semibold uppercase tracking-wide text-[#5A6A7A]">Branch</th>
                <th className="px-4 py-3 font-jakarta text-xs font-semibold uppercase tracking-wide text-[#5A6A7A]">Progress</th>
                <th className="px-4 py-3 font-jakarta text-xs font-semibold uppercase tracking-wide text-[#5A6A7A]">Paid / Fee</th>
                <th className="px-4 py-3 font-jakarta text-xs font-semibold uppercase tracking-wide text-[#5A6A7A]">Status</th>
                <th className="px-4 py-3 font-jakarta text-xs font-semibold uppercase tracking-wide text-[#5A6A7A]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DDE3EC] dark:divide-gray-700">
              {loading ? (
                Array.from({ length: 8 }).map((_, index) => (
                  <tr key={index} className="animate-pulse">
                    {Array.from({ length: 8 }).map((__, cellIndex) => (
                      <td key={cellIndex} className="h-12 px-4 py-3">
                        <div className="h-3 w-full rounded bg-[#DDE3EC]" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm text-[#5A6A7A]">
                    No students match the current filters.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row) => {
                  const selectable = !!row.plan && row.status !== 'paid'
                  const checked = row.plan ? selectedPlanIds.includes(row.plan.id) : false
                  return (
                    <tr key={row.student.id} className="group transition-colors hover:bg-[#F5F7FB]/70 dark:hover:bg-gray-700/40">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!selectable}
                          onChange={(event) => {
                            const planId = row.plan?.id
                            if (!planId) return
                            if (event.target.checked) {
                              setSelectedPlanIds((current) => [...current, planId])
                            } else {
                              setSelectedPlanIds((current) => current.filter((id) => id !== planId))
                            }
                          }}
                          className="h-4 w-4 rounded border-[#DDE3EC] text-[#E8A020] focus:ring-[#E8A020]"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-[#0D1B2A] dark:text-white">{row.student.name}</div>
                        <div className="text-xs text-[#5A6A7A] dark:text-gray-400">{row.student.studentCode}</div>
                      </td>
                      <td className="px-4 py-3 text-[#5A6A7A] dark:text-gray-300">
                        {COURSE_MAP[row.student.courseId]?.label ?? row.student.courseId}
                      </td>
                      <td className="px-4 py-3 text-[#5A6A7A] dark:text-gray-300">{row.student.branchId || 'N/A'}</td>
                      <td className="px-4 py-3">
                        <div className="mb-1 text-xs text-[#5A6A7A]">{row.paidCount}/{row.installmentCount} paid</div>
                        <div className="h-2 overflow-hidden rounded-full bg-[#E5E7EB] dark:bg-gray-700">
                          <div className="h-full rounded-full bg-[#E8A020]" style={{ width: `${row.progress}%` }} />
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-[#0B3D6B]">
                        {formatLKR(row.totalPaid)} / {formatLKR(row.totalFee)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold ${statusClasses(row.status)}`}>
                          {formatStatusLabel(row.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedStudentId(row.student.id)}
                            className="rounded-lg border border-[#DDE3EC] px-3 py-2 text-xs font-semibold text-[#0B3D6B] hover:bg-[#F5F7FB]"
                          >
                            View
                          </button>
                          {row.plan ? (
                            <button
                              type="button"
                              onClick={() => setSelectedStudentId(row.student.id)}
                              className="rounded-lg bg-[#E8A020] px-3 py-2 text-xs font-semibold text-[#0B3D6B] hover:bg-[#F5B942]"
                            >
                              Details
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setSetupPlanStudentId(row.student.id)}
                              className="rounded-lg border border-[#DDE3EC] px-3 py-2 text-xs font-semibold text-[#0B3D6B] hover:bg-[#F5F7FB]"
                            >
                              Set up plan
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {!loading && filteredRows.length > 0 && (
          <div className="border-t border-[#DDE3EC] px-4 py-4 dark:border-gray-700">
            <div className="flex flex-col gap-2 text-sm text-[#5A6A7A] sm:flex-row sm:items-center sm:justify-between">
              <p>
                Showing {(page - 1) * PAGE_SIZE + 1} - {Math.min(page * PAGE_SIZE, filteredRows.length)} of {filteredRows.length} students
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  className="rounded-lg border border-[#DDE3EC] bg-white px-3 py-1.5 text-sm text-[#0B3D6B] hover:bg-[#F5F7FB] disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="text-sm text-[#5A6A7A]">Page {page} of {Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))}</span>
                <button
                  type="button"
                  disabled={page >= Math.ceil(filteredRows.length / PAGE_SIZE)}
                  onClick={() => setPage((current) => Math.min(Math.ceil(filteredRows.length / PAGE_SIZE), current + 1))}
                  className="rounded-lg border border-[#DDE3EC] bg-white px-3 py-1.5 text-sm text-[#0B3D6B] hover:bg-[#F5F7FB] disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {selectedRow && (
        <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/30 px-4 py-6">
          <div className="w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl dark:bg-gray-900">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-[#0D1B2A]">{selectedRow.student.name}</h2>
                <p className="mt-1 text-sm text-[#5A6A7A]">{COURSE_MAP[selectedRow.student.courseId]?.label ?? selectedRow.student.courseId} | {selectedRow.student.branchId || 'Branch not set'}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStudentId(null)}
                className="rounded-full border border-[#DDE3EC] p-2 text-[#0B3D6B] hover:bg-[#F5F7FB]"
              >
                <span className="ti ti-x" />
              </button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-[#DDE3EC] bg-[#F5F7FB] p-4 dark:bg-gray-800">
                <p className="text-xs uppercase tracking-[0.16em] text-[#5A6A7A]">Plan status</p>
                <p className="mt-2 text-lg font-bold text-[#0B3D6B]">{formatStatusLabel(selectedRow.status)}</p>
              </div>
              <div className="rounded-2xl border border-[#DDE3EC] bg-[#F5F7FB] p-4 dark:bg-gray-800">
                <p className="text-xs uppercase tracking-[0.16em] text-[#5A6A7A]">Progress</p>
                <p className="mt-2 text-lg font-bold text-[#0B3D6B]">{selectedRow.progress}%</p>
              </div>
              <div className="rounded-2xl border border-[#DDE3EC] bg-[#F5F7FB] p-4 dark:bg-gray-800">
                <p className="text-xs uppercase tracking-[0.16em] text-[#5A6A7A]">Paid</p>
                <p className="mt-2 text-lg font-bold text-emerald-700">{formatLKR(selectedRow.totalPaid)}</p>
              </div>
              <div className="rounded-2xl border border-[#DDE3EC] bg-[#F5F7FB] p-4 dark:bg-gray-800">
                <p className="text-xs uppercase tracking-[0.16em] text-[#5A6A7A]">Total fee</p>
                <p className="mt-2 text-lg font-bold text-[#0B3D6B]">{formatLKR(selectedRow.totalFee)}</p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-[#DDE3EC] bg-white p-4 dark:bg-gray-950">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-bold text-[#0D1B2A]">Installment schedule</h3>
                {selectedRow.plan && canAddInstallment && (
                  <button
                    type="button"
                    onClick={() => setAddingInstallment((current) => !current)}
                    className="rounded-lg bg-[#E8A020] px-4 py-2 text-sm font-semibold text-[#0B3D6B] hover:bg-[#F5B942]"
                  >
                    {addingInstallment ? 'Cancel' : 'Add installment'}
                  </button>
                )}
              </div>

              {!selectedRow.plan ? (
                <div className="mt-5 rounded-2xl border border-dashed border-[#DDE3EC] p-6 text-center">
                  <p className="text-sm text-[#5A6A7A]">No payment plan is configured for this student.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSetupPlanStudentId(selectedRow.student.id)
                      setSelectedStudentId(null)
                    }}
                    className="mt-4 rounded-lg bg-[#E8A020] px-5 py-2.5 text-sm font-semibold text-[#0B3D6B] hover:bg-[#F5B942]"
                  >
                    Set up payment plan
                  </button>
                </div>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-[#DDE3EC] text-xs uppercase tracking-wide text-[#5A6A7A]">
                        <th className="px-4 py-3">Installment</th>
                        <th className="px-4 py-3">Amount</th>
                        <th className="px-4 py-3">Due date</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DDE3EC] dark:divide-gray-700">
                      {selectedRow.plan.installments.map((installment) => {
                        const paid = Boolean(installment.paidAt)
                        const dueDate = formatPaymentDate(installment.dueDate)
                        const overdue = !paid && new Date(installment.dueDate) < new Date()
                        const statusLabel = paid
                          ? `Paid ${formatPaymentDate(installment.paidAt ?? installment.dueDate)}`
                          : overdue
                          ? 'Overdue'
                          : 'Unpaid'

                        return (
                          <tr key={installment.id}>
                            <td className="px-4 py-3 font-medium text-[#0D1B2A]">{installment.label}</td>
                            <td className="px-4 py-3 text-[#0B3D6B]">{formatLKR(installment.amount)}</td>
                            <td className="px-4 py-3 text-[#5A6A7A]">{dueDate}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-semibold ${paid ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : overdue ? 'bg-red-50 text-red-700 border-red-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>
                                {statusLabel}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {canMarkPaid && !paid ? (
                                <button
                                  type="button"
                                  onClick={() => handleMarkInstallmentPaid(selectedRow.plan!, installment.id)}
                                  className="rounded-lg bg-[#E8A020] px-3 py-2 text-xs font-semibold text-[#0B3D6B] hover:bg-[#F5B942]"
                                  disabled={detailLoading}
                                >
                                  Mark paid
                                </button>
                              ) : (
                                <span className="text-xs text-[#5A6A7A]">{paid ? 'Paid' : isViewOnly ? 'Read only' : 'N/A'}</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {addingInstallment && selectedRow.plan && (
                <div className="mt-6 rounded-2xl border border-[#DDE3EC] bg-[#F5F7FB] p-5">
                  <h4 className="text-sm font-semibold text-[#0D1B2A]">New installment</h4>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <label className="block text-sm text-[#5A6A7A]">
                      Label
                      <input
                        value={installmentForm.label}
                        onChange={(e) => setInstallmentForm((current) => ({ ...current, label: e.target.value }))}
                        placeholder="Month 4"
                        className="mt-2 w-full rounded-lg border border-[#DDE3EC] bg-white px-3 py-2 text-sm outline-none focus:border-[#E8A020]"
                      />
                    </label>
                    <label className="block text-sm text-[#5A6A7A]">
                      Amount
                      <input
                        type="number"
                        value={installmentForm.amount}
                        onChange={(e) => setInstallmentForm((current) => ({ ...current, amount: e.target.value }))}
                        placeholder="8000"
                        className="mt-2 w-full rounded-lg border border-[#DDE3EC] bg-white px-3 py-2 text-sm outline-none focus:border-[#E8A020]"
                      />
                    </label>
                    <label className="block text-sm text-[#5A6A7A]">
                      Due date
                      <input
                        type="date"
                        value={installmentForm.dueDate}
                        onChange={(e) => setInstallmentForm((current) => ({ ...current, dueDate: e.target.value }))}
                        className="mt-2 w-full rounded-lg border border-[#DDE3EC] bg-white px-3 py-2 text-sm outline-none focus:border-[#E8A020]"
                      />
                    </label>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleAddInstallment(selectedRow.plan!)}
                      className="rounded-lg bg-[#0B3D6B] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0a2d57]"
                      disabled={detailLoading}
                    >
                      Save installment
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {setupPlanStudentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-6">
          <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl dark:bg-gray-900">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-[#0D1B2A]">Set up payment plan</h2>
                <p className="mt-1 text-sm text-[#5A6A7A]">Create installment terms for this student.</p>
              </div>
              <button
                type="button"
                onClick={() => setSetupPlanStudentId(null)}
                className="rounded-full border border-[#DDE3EC] p-2 text-[#0B3D6B] hover:bg-[#F5F7FB]"
              >
                <span className="ti ti-x" />
              </button>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm text-[#5A6A7A]">
                Total fee
                <input
                  type="number"
                  value={setupForm.totalFee}
                  onChange={(e) => setSetupForm((current) => ({ ...current, totalFee: e.target.value }))}
                  placeholder="90000"
                  className="mt-2 w-full rounded-lg border border-[#DDE3EC] bg-white px-3 py-2 text-sm outline-none focus:border-[#E8A020]"
                />
              </label>
              <label className="block text-sm text-[#5A6A7A]">
                Installments
                <select
                  value={setupForm.installments}
                  onChange={(e) => setSetupForm((current) => ({ ...current, installments: e.target.value }))}
                  className="mt-2 w-full rounded-lg border border-[#DDE3EC] bg-white px-3 py-2 text-sm outline-none focus:border-[#E8A020]"
                >
                  {INSTALLMENT_COUNTS.map((count) => (
                    <option key={count} value={String(count)}>{count}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm text-[#5A6A7A] sm:col-span-2">
                First due date
                <input
                  type="date"
                  value={setupForm.firstDueDate}
                  onChange={(e) => setSetupForm((current) => ({ ...current, firstDueDate: e.target.value }))}
                  className="mt-2 w-full rounded-lg border border-[#DDE3EC] bg-white px-3 py-2 text-sm outline-none focus:border-[#E8A020]"
                />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setSetupPlanStudentId(null)}
                className="rounded-lg border border-[#DDE3EC] px-5 py-2.5 text-sm font-semibold text-[#0B3D6B] hover:bg-[#F5F7FB]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleCreatePlan(setupPlanStudentId)}
                className="rounded-lg bg-[#0B3D6B] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0a2d57]"
              >
                Create plan
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmBulkOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-6">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl dark:bg-gray-900">
            <h3 className="text-lg font-bold text-[#0D1B2A]">Confirm bulk payment</h3>
            <p className="mt-3 text-sm text-[#5A6A7A]">
              Mark {selectedRows.length} student{selectedRows.length === 1 ? '' : 's'}' next unpaid installment as paid?
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmBulkOpen(false)}
                className="rounded-lg border border-[#DDE3EC] px-5 py-2.5 text-sm font-semibold text-[#0B3D6B] hover:bg-[#F5F7FB]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkMarkPaid}
                className="rounded-lg bg-[#E8A020] px-5 py-2.5 text-sm font-semibold text-[#0B3D6B] hover:bg-[#F5B942]"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
