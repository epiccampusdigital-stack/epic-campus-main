'use client'

const SECTION_LABELS: Record<string, { jp: string; en: string }> = {
  reading:   { jp: '読む',  en: 'Reading'   },
  listening: { jp: '聞く',  en: 'Listening' },
  writing:   { jp: '書く',  en: 'Writing'   },
  speaking:  { jp: '話す',  en: 'Speaking'  },
  results:   { jp: '結果',  en: 'Results'   },
}

interface ExamTopbarProps {
  paperCode: string
  section: 'reading' | 'listening' | 'writing' | 'speaking' | 'results'
  timeLeft?: number
  totalTime?: number
  currentQ?: number
  totalQ?: number
  onSubmit?: () => void
}

export default function ExamTopbar({
  paperCode,
  section,
  timeLeft,
  currentQ,
  totalQ,
}: ExamTopbarProps) {
  const sectionLabel = SECTION_LABELS[section] ?? { jp: '', en: section }

  const timerClass =
    timeLeft === undefined
      ? ''
      : timeLeft > 300
        ? 'bg-white/10 text-white'
        : timeLeft >= 60
          ? 'bg-amber-500/20 text-amber-200'
          : 'bg-red-500/25 text-red-200 animate-pulse'

  return (
    <header className="bg-[#0B3D6B] h-[52px] px-5 flex items-center justify-between sticky top-0 z-50">
      {/* Left: brand + paper info */}
      <div className="flex items-center gap-3">
        <span className="text-[#E8A020] font-semibold text-sm font-['Noto_Sans_JP'] tracking-wide">
          EPIC
        </span>
        <span className="text-white/30 text-xs">|</span>
        <span className="text-white/70 text-xs font-medium">{paperCode}</span>
      </div>

      {/* Center: progress bar + count */}
      {totalQ != null && currentQ != null && (
        <div className="flex items-center gap-3 flex-1 mx-8 max-w-xs">
          <div className="flex-1 h-[3px] bg-white/15 rounded-full">
            <div
              className="h-[3px] bg-[#E8A020] rounded-full transition-all duration-300"
              style={{ width: `${Math.round((currentQ / totalQ) * 100)}%` }}
            />
          </div>
          <span className="text-white/50 text-[11px] tabular-nums whitespace-nowrap">
            {currentQ} / {totalQ}
          </span>
        </div>
      )}

      {/* Right: section pill + timer */}
      <div className="flex items-center gap-2">
        <span className="rounded-full px-3 py-1 text-[11px] font-medium
                         bg-[#E8A020]/15 border border-[#E8A020]/30 text-[#E8A020]">
          {sectionLabel.jp} {sectionLabel.en}
        </span>
        {timeLeft !== undefined && (
          <span className={`rounded-full px-4 py-1 text-[13px] font-medium tabular-nums ${timerClass}`}>
            ⏱ {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
          </span>
        )}
      </div>
    </header>
  )
}
