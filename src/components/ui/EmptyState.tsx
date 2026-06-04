'use client'

interface EmptyStateProps {
  icon: string
  title: string
  subtitle: string
  actionLabel?: string
  onAction?: () => void
}

export default function EmptyState({
  icon,
  title,
  subtitle,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#DDE3EC] bg-white px-6 py-16 text-center dark:border-gray-600 dark:bg-gray-800">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#0B3D6B]/10 dark:bg-[#0B3D6B]/30">
        <span className={`ti ${icon} text-3xl text-[#0B3D6B] dark:text-[#E8A020]`} aria-hidden="true" />
      </div>
      <h3 className="font-jakarta text-lg font-bold text-[#0D1B2A] dark:text-white">{title}</h3>
      <p className="mt-2 max-w-sm font-inter text-sm text-[#5A6A7A] dark:text-gray-400">{subtitle}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#E8A020] px-5 py-2.5 font-jakarta text-sm font-bold text-[#0B3D6B] transition-colors hover:bg-[#F5B942]"
        >
          <span className="ti ti-plus" aria-hidden="true" />
          {actionLabel}
        </button>
      )}
    </div>
  )
}
