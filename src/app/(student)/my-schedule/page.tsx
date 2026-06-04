'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/** Legacy route — redirects to dedicated consultation booking page */
export default function MySchedulePage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/book-consultation')
  }, [router])
  return null
}
