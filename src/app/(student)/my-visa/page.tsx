'use client'

import { useStudentPortal } from '@/components/student/StudentContext'

const VISA_STAGES = [
  { key: 'not_started', label: 'Not Started', icon: 'ti-clock' },
  { key: 'documents', label: 'Documents Prep', icon: 'ti-file-text' },
  { key: 'submitted', label: 'Submitted', icon: 'ti-send' },
  { key: 'in-progress', label: 'Processing', icon: 'ti-loader-2' },
  { key: 'approved', label: 'Approved', icon: 'ti-circle-check' },
]

export default function MyVisaPage() {
  const { student } = useStudentPortal()

  const currentStage = student?.visaStatus ?? 'not_started'
  const currentIdx = VISA_STAGES.findIndex((s) => s.key === currentStage)
  const activeIdx = currentIdx === -1 ? 0 : currentIdx

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-jakarta text-2xl font-bold text-[#0D1B2A] dark:text-white">
          Visa Status
        </h1>
        <p className="text-sm text-[#5A6A7A] dark:text-white/50">
          Track your visa application progress
        </p>
      </div>

      <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-jakarta font-bold text-[#0B3D6B] dark:text-[#E8A020]">
            Application Progress
          </h2>
          <span className="rounded-full bg-[#0B3D6B]/10 dark:bg-[#E8A020]/10 px-3 py-1 text-xs font-semibold text-[#0B3D6B] dark:text-[#E8A020] capitalize">
            {currentStage.replace(/-/g, ' ')}
          </span>
        </div>

        <div className="flex flex-col gap-4">
          {VISA_STAGES.map((stage, idx) => {
            const done = idx < activeIdx
            const active = idx === activeIdx
            return (
              <div key={stage.key} className="flex items-center gap-4">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    done
                      ? 'bg-emerald-500 text-white'
                      : active
                        ? 'bg-[#E8A020] text-[#0B3D6B]'
                        : 'bg-[#DDE3EC] dark:bg-white/10 text-[#5A6A7A] dark:text-white/40'
                  }`}
                >
                  <span className={`ti ${stage.icon}`} />
                </div>
                <div className="flex-1">
                  <p
                    className={`font-medium ${
                      active
                        ? 'text-[#0B3D6B] dark:text-[#E8A020]'
                        : done
                          ? 'text-emerald-600'
                          : 'text-[#5A6A7A] dark:text-white/40'
                    }`}
                  >
                    {stage.label}
                  </p>
                  {active && (
                    <p className="mt-0.5 text-xs text-[#5A6A7A] dark:text-white/40">
                      Current stage — contact admin for updates
                    </p>
                  )}
                </div>
                {done && <span className="ti ti-check text-emerald-500" />}
              </div>
            )
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-[#DDE3EC] dark:border-white/[0.08] bg-white dark:bg-white/[0.04] p-5">
        <h3 className="font-jakarta font-bold text-[#0B3D6B] dark:text-white mb-3">
          Need help?
        </h3>
        <p className="text-sm text-[#5A6A7A] dark:text-white/50">
          Contact your coordinator for visa updates or document requirements.
        </p>
        <a
          href="tel:+94762548383"
          className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#0B3D6B] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0a3460]"
        >
          <span className="ti ti-phone" />
          076 254 8383
        </a>
      </div>
    </div>
  )
}
