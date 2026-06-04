'use client'

import StudentConsultationBooking from '@/components/consultations/StudentConsultationBooking'

export default function BookConsultationPage() {
  return (
    <div className="space-y-2">
      <h1 className="font-jakarta text-2xl font-bold text-[#0B3D6B]">
        Book a Consultation
      </h1>
      <StudentConsultationBooking />
    </div>
  )
}
