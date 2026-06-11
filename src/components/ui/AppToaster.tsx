'use client'

import { Toaster } from 'react-hot-toast'

export default function AppToaster() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        className: 'text-sm font-inter',
        success: { className: 'text-sm font-inter bg-emerald-50 text-emerald-900' },
        error: { className: 'text-sm font-inter bg-red-50 text-red-900' },
      }}
    />
  )
}
