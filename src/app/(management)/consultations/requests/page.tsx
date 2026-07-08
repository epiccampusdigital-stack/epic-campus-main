'use client'

import ConsultationRequestsPanel from '@/components/consultations/ConsultationRequestsPanel'

export default function ConsultationRequestsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-jakarta text-2xl font-bold text-[#0D1B2A] dark:text-white">
          Consultation Requests
        </h1>
        <p className="text-sm text-[#5A6A7A] dark:text-white/50">
          Student booking requests — confirm or reject
        </p>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-[#0B3D6B]/20 bg-[#0B3D6B]/5 px-4 py-3 text-sm font-medium text-[#0B3D6B] dark:border-white/10 dark:bg-white/[0.04] dark:text-white/70">
        <span className="ti ti-info-circle text-base shrink-0" aria-hidden="true" />
        These requests also appear in the Consultations page → Student Requests tab.
      </div>

      <ConsultationRequestsPanel />
    </div>
  )
}
