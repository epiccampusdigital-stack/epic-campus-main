'use client'

import ConsultationBooking from '@/components/schedule/ConsultationBooking'

export default function MySchedulePage() {
  return (
    <div className="space-y-2">
      <h1 className="font-jakarta text-2xl font-bold text-[#0B3D6B]">Book Consultation</h1>
      <p className="font-inter text-sm text-[#5A6A7A]">
        View available slots and request a consultation with staff.
      </p>
      <ConsultationBooking />
    </div>
  )
}
