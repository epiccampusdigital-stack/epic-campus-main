'use client'

import { useEffect } from 'react'

interface KitchenBottomSheetProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  footer?: React.ReactNode
}

export default function KitchenBottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
}: KitchenBottomSheetProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open) return null

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 md:bg-black/40 ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={`fixed z-50 flex flex-col bg-white shadow-2xl transition-transform duration-300 ease-out dark:bg-[#0d1a2e] ${
          open ? 'translate-y-0' : 'translate-y-full md:translate-y-0 md:translate-x-full'
        } inset-0 md:inset-y-0 md:left-auto md:right-0 md:w-[500px] md:max-w-[500px]`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex shrink-0 flex-col border-b border-[#DDE3EC] dark:border-white/[0.06]">
          <div className="flex justify-center pt-3 md:hidden">
            <div className="h-1 w-8 rounded-full bg-gray-300 dark:bg-gray-600" />
          </div>
          <div className="flex items-center justify-between px-4 py-3 md:px-5 md:py-4">
            <h3 className="text-base font-bold text-[#0D1B2A] md:text-lg dark:text-white">
              {title}
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="flex h-11 w-11 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 dark:hover:bg-white/[0.06]"
              aria-label="Close"
            >
              <span className="ti ti-x text-2xl" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-5">{children}</div>

        {footer && (
          <div className="shrink-0 border-t border-[#DDE3EC] p-4 md:p-5 dark:border-white/[0.06]">
            {footer}
          </div>
        )}
      </div>
    </>
  )
}
