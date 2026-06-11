'use client'

import { useKitchenSinhala } from '@/lib/kitchen/useKitchenSinhala'

export default function SinhalaToggle() {
  const { sinhala, toggleSinhala } = useKitchenSinhala()

  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/90 bg-white/65 px-4 py-3 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.05]">
      <span className="text-2xl" aria-hidden="true">
        🇱🇰
      </span>
      <div className="flex-1">
        <p className="text-sm font-semibold text-[#0D1B2A] dark:text-white">Show Sinhala names</p>
        <p className="text-xs text-gray-500 dark:text-white/50">සිංහල නම් පෙන්වන්න</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={sinhala}
        onClick={() => toggleSinhala(!sinhala)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
          sinhala ? 'bg-[#E8A020]' : 'bg-gray-300 dark:bg-gray-600'
        }`}
      >
        <span
          className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
            sinhala ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </label>
  )
}
