'use client'

import { LOCATION_OPTIONS } from '@/lib/locations/helpers'
import type { StudentLocation } from '@/types'

interface LocationFilterSelectProps {
  value: StudentLocation | ''
  onChange: (value: StudentLocation | '') => void
  className?: string
  id?: string
}

export default function LocationFilterSelect({
  value,
  onChange,
  className = 'rounded-lg border border-[#DDE3EC] bg-white px-3 py-2.5 font-inter text-sm text-[#0D1B2A] outline-none focus:border-[#E8A020] dark:border-gray-600 dark:bg-gray-900 dark:text-white',
  id,
}: LocationFilterSelectProps) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value as StudentLocation | '')}
      className={className}
      aria-label="Filter by location"
    >
      {LOCATION_OPTIONS.map((loc) => (
        <option key={loc.id || 'all'} value={loc.id}>
          {loc.label}
        </option>
      ))}
    </select>
  )
}
