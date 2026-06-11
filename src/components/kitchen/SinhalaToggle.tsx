'use client'

import { useKitchenSinhala } from '@/lib/kitchen/useKitchenSinhala'

export default function SinhalaToggle() {
  const { sinhala, toggleSinhala } = useKitchenSinhala()

  return (
    <div className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="text-2xl" aria-hidden="true">
          🇱🇰
        </span>
        <div>
          <p className="text-sm font-semibold text-[#0D1B2A] dark:text-white">Show Sinhala names</p>
          <p className="text-xs text-gray-500 dark:text-white/50">සිංහල නම් පෙන්වන්න</p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={sinhala}
        onClick={() => toggleSinhala(!sinhala)}
        className={`relative inline-flex h-7 w-14 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none ${
          sinhala ? 'bg-[#E8A020]' : 'bg-gray-300 dark:bg-gray-600'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${
            sinhala ? 'translate-x-8' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  )
}
