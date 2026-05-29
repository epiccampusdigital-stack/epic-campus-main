'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function MyVisaRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/student/visa')
  }, [router])

  return (
    <div className="flex items-center justify-center py-20">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0B3D6B]/20 border-t-[#0B3D6B]" />
    </div>
  )
}
