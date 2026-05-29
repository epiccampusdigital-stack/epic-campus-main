'use client'

interface QuestionPaletteProps {
  total: number
  currentIndex: number
  answered: Set<number>
  onSelect: (index: number) => void
  startNumber?: number
}

export default function QuestionPalette({
  total,
  currentIndex,
  answered,
  onSelect,
  startNumber = 1,
}: QuestionPaletteProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {Array.from({ length: total }, (_, i) => {
        const num = startNumber + i
        const isCurrent = i === currentIndex
        const isAnswered = answered.has(i)
        return (
          <button
            key={i}
            type="button"
            onClick={() => onSelect(i)}
            className={`h-9 w-9 rounded-lg border text-sm font-semibold transition-colors ${
              isCurrent
                ? 'border-[#E8A020] bg-[#E8A020] text-[#0B3D6B]'
                : isAnswered
                  ? 'border-[#0B3D6B] bg-[#0B3D6B] text-white'
                  : 'border-[#DDE3EC] bg-white text-[#5A6A7A] hover:border-[#0B3D6B]'
            }`}
          >
            {num}
          </button>
        )
      })}
    </div>
  )
}
