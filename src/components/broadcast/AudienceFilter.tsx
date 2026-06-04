'use client'

import { COURSES } from '@/lib/constants/courses'
import { LOCATION_LABELS } from '@/lib/students/helpers'
import type { BroadcastFilters, StudentLocation } from '@/types'

const VISA_OPTIONS = [
  { value: 'not-started', label: 'Not started' },
  { value: 'in-progress', label: 'In progress' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

const PAYMENT_OPTIONS = [
  { value: 'paid', label: 'Paid' },
  { value: 'partial', label: 'Partial' },
  { value: 'unpaid', label: 'Unpaid' },
] as const

const BATCH_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'overdue', label: 'Overdue' },
] as const

interface AudienceFilterProps {
  audience: 'all' | 'filtered'
  onAudienceChange: (v: 'all' | 'filtered') => void
  filters: BroadcastFilters
  onFiltersChange: (f: BroadcastFilters) => void
}

function MultiCheckbox<T extends string>({
  label,
  options,
  selected,
  onChange,
}: {
  label: string
  options: { value: T; label: string }[]
  selected: T[]
  onChange: (next: T[]) => void
}) {
  function toggle(value: T) {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value))
    } else {
      onChange([...selected, value])
    }
  }

  return (
    <div>
      <p className="mb-2 font-inter text-xs font-semibold uppercase tracking-wide text-[#5A6A7A]">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <label
            key={opt.value}
            className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${
              selected.includes(opt.value)
                ? 'border-[#0B3D6B] bg-[#0B3D6B]/5 text-[#0B3D6B]'
                : 'border-[#DDE3EC] text-[#5A6A7A] hover:border-[#0B3D6B]/40'
            }`}
          >
            <input
              type="checkbox"
              className="sr-only"
              checked={selected.includes(opt.value)}
              onChange={() => toggle(opt.value)}
            />
            {opt.label}
          </label>
        ))}
      </div>
    </div>
  )
}

export default function AudienceFilter({
  audience,
  onAudienceChange,
  filters,
  onFiltersChange,
}: AudienceFilterProps) {
  const locations = (filters.location ?? []) as StudentLocation[]
  const courses = filters.course ?? []
  const visaStatuses = filters.visaStatus ?? []
  const batchStatuses = filters.batchStatus ?? []

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => onAudienceChange('all')}
          className={`rounded-lg px-4 py-2 font-jakarta text-sm font-semibold ${
            audience === 'all'
              ? 'bg-[#0B3D6B] text-white'
              : 'border border-[#DDE3EC] text-[#5A6A7A]'
          }`}
        >
          All Students
        </button>
        <button
          type="button"
          onClick={() => onAudienceChange('filtered')}
          className={`rounded-lg px-4 py-2 font-jakarta text-sm font-semibold ${
            audience === 'filtered'
              ? 'bg-[#0B3D6B] text-white'
              : 'border border-[#DDE3EC] text-[#5A6A7A]'
          }`}
        >
          Filter Students
        </button>
      </div>

      {audience === 'filtered' && (
        <div className="space-y-4 rounded-xl border border-[#DDE3EC] bg-[#F5F7FB] p-4">
          <MultiCheckbox
            label="Location"
            options={(Object.keys(LOCATION_LABELS) as StudentLocation[]).map((id) => ({
              value: id,
              label: LOCATION_LABELS[id],
            }))}
            selected={locations}
            onChange={(next) => onFiltersChange({ ...filters, location: next })}
          />
          <MultiCheckbox
            label="Course / Program"
            options={COURSES.map((c) => ({ value: c.id, label: c.label }))}
            selected={courses}
            onChange={(next) => onFiltersChange({ ...filters, course: next })}
          />
          <MultiCheckbox
            label="Visa status"
            options={VISA_OPTIONS}
            selected={visaStatuses}
            onChange={(next) => onFiltersChange({ ...filters, visaStatus: next })}
          />
          <div>
            <p className="mb-2 font-inter text-xs font-semibold uppercase tracking-wide text-[#5A6A7A]">
              Payment status
            </p>
            <select
              value={filters.paymentStatus ?? ''}
              onChange={(e) =>
                onFiltersChange({
                  ...filters,
                  paymentStatus: e.target.value
                    ? (e.target.value as BroadcastFilters['paymentStatus'])
                    : undefined,
                })
              }
              className="w-full max-w-xs rounded-lg border border-[#DDE3EC] bg-white px-3 py-2 text-sm"
            >
              <option value="">Any</option>
              {PAYMENT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <MultiCheckbox
            label="Batch status"
            options={[...BATCH_OPTIONS]}
            selected={batchStatuses}
            onChange={(next) => onFiltersChange({ ...filters, batchStatus: next })}
          />
        </div>
      )}
    </div>
  )
}
