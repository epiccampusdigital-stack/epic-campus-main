'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminMessagesRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/messages')
  }, [router])
  return (
    <div className="flex h-48 items-center justify-center text-sm text-[#5A6A7A]">
      Redirecting to Messages…
    </div>
  )
}
