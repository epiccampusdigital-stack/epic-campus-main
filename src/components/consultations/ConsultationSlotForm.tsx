'use client'

import { useEffect, useState } from 'react'
import { createConsultationSlot } from '@/lib/consultations/helpers'
import type { StaffMember } from '@/types'

interface ConsultationSlotFormProps {
  open: boolean
  staff: StaffMember[]
  onClose: () => void
  onSaved: () => void
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block font-inter text-xs font-medium uppercase tracking-wide text-[#5A6A7A]">
      {children}
    </label>
  )
}

export default function ConsultationSlotForm({
  open,
  staff,
  onClose,
  onSaved,
}: ConsultationSlotFormProps) {
  const [staffId, setStaffId] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('09:30')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setStaffId(staff[0]?.id ?? '')
      setDate(new Date().toISOString().slice(0, 10))
      setStartTime('09:00')
      setEndTime('09:30')
      setError('')
    }
  }, [open, staff])

  if (!open) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const member = staff.find((s) => s.id === staffId)
    if (!member) {
      setError('Select a staff member.')
      return
    }
    if (!date || !startTime || !endTime) {
      setError('Date and times are required.')
      return
    }
    if (startTime >= endTime) {
      setError('End time must be after start time.')
      return
    }

    setSaving(true)
    setError('')
    try {
      await createConsultationSlot({
        date,
        startTime,
        endTime,
        staffId: member.id,
        staffName: member.displayName,
      })
      onSaved()
      onClose()
    } catch (err) {
      console.error('[ConsultationSlotForm]', err)
      setError('Failed to save slot.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-[#0D1B2A]/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#DDE3EC] px-6 py-4">
          <h2 className="font-jakarta text-lg font-bold text-[#0B3D6B]">Add Consultation Slot</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[#5A6A7A] hover:bg-[#F5F7FB]"
            aria-label="Close"
          >
            <span className="ti ti-x text-xl" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto">
          <div className="space-y-4 px-6 py-5">
            <div>
              <FieldLabel>Staff member</FieldLabel>
              <select
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 text-sm"
                required
              >
                <option value="">Select staff…</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.displayName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <FieldLabel>Date</FieldLabel>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 text-sm"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>Start time</FieldLabel>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 text-sm"
                  required
                />
              </div>
              <div>
                <FieldLabel>End time</FieldLabel>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full rounded-lg border border-[#DDE3EC] px-3 py-2.5 text-sm"
                  required
                />
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>

          <div className="mt-auto border-t border-[#DDE3EC] px-6 py-4">
            <button
              type="submit"
              disabled={saving || staff.length === 0}
              className="w-full rounded-full bg-[#E8A020] px-6 py-3 font-jakarta text-sm font-bold text-[#0B3D6B] hover:bg-[#F5B942] disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save Slot'}
            </button>
          </div>
        </form>
      </aside>
    </>
  )
}
