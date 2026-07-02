'use client'

interface CountStepperProps {
  value: string
  onChange: (value: string) => void
  step?: number
  min?: number
  inputClassName?: string
}

export default function CountStepper({
  value,
  onChange,
  step = 0.01,
  min = 0,
  inputClassName = '',
}: CountStepperProps) {
  const adjust = (delta: number) => {
    const current = parseFloat(value) || 0
    const next = Math.max(min, parseFloat((current + delta).toFixed(10)))
    onChange(next > 0 ? String(next) : '')
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => adjust(-step)}
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#DDE3EC] bg-[#F5F7FB] text-xl font-bold dark:border-gray-600 dark:bg-white/[0.06] md:h-12 md:w-12"
        aria-label="Decrease"
      >
        −
      </button>
      <input
        type="number"
        min={min}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`h-12 min-h-[48px] flex-1 rounded-xl border border-[#DDE3EC] bg-white text-center text-xl font-bold dark:border-gray-600 dark:bg-gray-900 dark:text-white ${inputClassName}`}
      />
      <button
        type="button"
        onClick={() => adjust(step)}
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#DDE3EC] bg-[#F5F7FB] text-xl font-bold dark:border-gray-600 dark:bg-white/[0.06]"
        aria-label="Increase"
      >
        +
      </button>
    </div>
  )
}
