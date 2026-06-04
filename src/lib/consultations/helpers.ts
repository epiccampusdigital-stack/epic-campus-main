import { Timestamp } from 'firebase/firestore'
import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import { parseStaff } from '@/lib/staff/helpers'
import type { StaffMember } from '@/types'

export type ConsultationBookingStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'completed'

export interface ConsultationSlot {
  id: string
  date: string
  startTime: string
  endTime: string
  staffId: string
  staffName: string
  isBooked: boolean
  bookedByStudentId?: string
  bookedByStudentName?: string
  createdAt: string
}

export interface ConsultationBooking {
  id: string
  slotId: string
  studentId: string
  studentName: string
  studentPhone: string
  staffId: string
  staffName: string
  date: string
  startTime: string
  endTime: string
  status: ConsultationBookingStatus
  notes: string
  createdAt: string
}

export const BOOKING_STATUS_BADGE: Record<
  ConsultationBookingStatus,
  string
> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  completed: 'bg-gray-100 text-gray-700',
}

function timestampToIso(value: unknown): string {
  if (!value) return new Date().toISOString()
  if (typeof value === 'string') return value
  if (value instanceof Timestamp) return value.toDate().toISOString()
  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString()
  }
  return String(value)
}

export function parseConsultationSlot(
  id: string,
  data: Record<string, unknown>,
): ConsultationSlot {
  return {
    id,
    date: String(data.date ?? '').slice(0, 10),
    startTime: String(data.startTime ?? ''),
    endTime: String(data.endTime ?? ''),
    staffId: String(data.staffId ?? ''),
    staffName: String(data.staffName ?? ''),
    isBooked: Boolean(data.isBooked),
    bookedByStudentId: data.bookedByStudentId
      ? String(data.bookedByStudentId)
      : undefined,
    bookedByStudentName: data.bookedByStudentName
      ? String(data.bookedByStudentName)
      : undefined,
    createdAt: timestampToIso(data.createdAt),
  }
}

export function parseConsultationBooking(
  id: string,
  data: Record<string, unknown>,
): ConsultationBooking {
  return {
    id,
    slotId: String(data.slotId ?? ''),
    studentId: String(data.studentId ?? ''),
    studentName: String(data.studentName ?? ''),
    studentPhone: String(data.studentPhone ?? ''),
    staffId: String(data.staffId ?? ''),
    staffName: String(data.staffName ?? ''),
    date: String(data.date ?? '').slice(0, 10),
    startTime: String(data.startTime ?? ''),
    endTime: String(data.endTime ?? ''),
    status: (data.status as ConsultationBookingStatus) ?? 'pending',
    notes: String(data.notes ?? ''),
    createdAt: timestampToIso(data.createdAt),
  }
}

export function formatConsultationDate(isoDate: string): string {
  if (!isoDate) return '—'
  return new Date(isoDate.slice(0, 10) + 'T12:00:00').toLocaleDateString('en-LK', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function formatTimeRange(start: string, end: string): string {
  return `${start} – ${end}`
}

export async function fetchStaffForConsultations(): Promise<StaffMember[]> {
  const snap = await getDocs(collection(db, 'users'))
  return snap.docs
    .map((d) => parseStaff(d.id, d.data() as Record<string, unknown>))
    .filter((s): s is StaffMember => s !== null && s.status === 'active')
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
}

export async function fetchConsultationSlots(): Promise<ConsultationSlot[]> {
  const snap = await getDocs(collection(db, 'consultationSlots'))
  return snap.docs
    .map((d) => parseConsultationSlot(d.id, d.data() as Record<string, unknown>))
    .sort((a, b) => {
      const dateCmp = a.date.localeCompare(b.date)
      if (dateCmp !== 0) return dateCmp
      return a.startTime.localeCompare(b.startTime)
    })
}

export async function fetchConsultationBookings(): Promise<ConsultationBooking[]> {
  const snap = await getDocs(collection(db, 'consultationBookings'))
  return snap.docs
    .map((d) => parseConsultationBooking(d.id, d.data() as Record<string, unknown>))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function createConsultationSlot(input: {
  date: string
  startTime: string
  endTime: string
  staffId: string
  staffName: string
}): Promise<string> {
  const ref = doc(collection(db, 'consultationSlots'))
  await setDoc(ref, {
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime,
    staffId: input.staffId,
    staffName: input.staffName,
    isBooked: false,
    bookedByStudentId: null,
    bookedByStudentName: null,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function deleteConsultationSlot(slotId: string): Promise<void> {
  const slotRef = doc(db, 'consultationSlots', slotId)
  await deleteDoc(slotRef)
}

export async function createConsultationBooking(input: {
  slot: ConsultationSlot
  studentId: string
  studentName: string
  studentPhone: string
  notes: string
}): Promise<string> {
  const bookingRef = doc(collection(db, 'consultationBookings'))
  await setDoc(bookingRef, {
    slotId: input.slot.id,
    studentId: input.studentId,
    studentName: input.studentName,
    studentPhone: input.studentPhone,
    staffId: input.slot.staffId,
    staffName: input.slot.staffName,
    date: input.slot.date,
    startTime: input.slot.startTime,
    endTime: input.slot.endTime,
    status: 'pending',
    notes: input.notes.trim(),
    createdAt: serverTimestamp(),
  })

  await updateDoc(doc(db, 'consultationSlots', input.slot.id), {
    isBooked: true,
    bookedByStudentId: input.studentId,
    bookedByStudentName: input.studentName,
  })

  return bookingRef.id
}

export async function approveConsultationBooking(
  booking: ConsultationBooking,
): Promise<void> {
  await updateDoc(doc(db, 'consultationBookings', booking.id), {
    status: 'approved',
  })
}

export async function rejectConsultationBooking(
  booking: ConsultationBooking,
): Promise<void> {
  await updateDoc(doc(db, 'consultationBookings', booking.id), {
    status: 'rejected',
  })

  await updateDoc(doc(db, 'consultationSlots', booking.slotId), {
    isBooked: false,
    bookedByStudentId: null,
    bookedByStudentName: null,
  })
}
