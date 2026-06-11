export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/admin'
import type { QuizAnswers, RecommendedPath } from '@/lib/public/destinationPickerLogic'

interface Body {
  name?: string
  phone?: string
  recommendedPath?: RecommendedPath
  quizAnswers?: QuizAnswers
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('94') && digits.length >= 11) return `+${digits}`
  if (digits.startsWith('0') && digits.length >= 10) return `+94${digits.slice(1)}`
  if (digits.length >= 9) return `+94${digits}`
  return phone.trim()
}

const PATH_TO_COURSE: Record<RecommendedPath, string> = {
  'japan-ssw': 'japan-ssw',
  korea: 'korea-d2d4',
  china: 'china',
  ielts: 'ielts',
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Body
    const name = body.name?.trim()
    const phone = body.phone?.trim()

    if (!name || name.length < 2) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }
    if (!phone || phone.replace(/\D/g, '').length < 9) {
      return NextResponse.json({ error: 'Valid phone number is required' }, { status: 400 })
    }

    const recommendedPath = body.recommendedPath ?? 'ielts'
    const courseId = PATH_TO_COURSE[recommendedPath] ?? 'ielts'
    const quizAnswers = body.quizAnswers ?? {}

    await adminDb.collection('leads').add({
      name,
      phone: normalizePhone(phone),
      courseId,
      recommendedPath,
      quizAnswers,
      source: 'destination-picker',
      status: 'new',
      branchId: 'galle-main',
      createdAt: FieldValue.serverTimestamp(),
      createdBy: 'destination-picker',
      notes: `Quiz recommendation: ${recommendedPath}. Goal: ${quizAnswers.goal ?? '—'}, Education: ${quizAnswers.education ?? '—'}, Timeline: ${quizAnswers.timeline ?? '—'}, English: ${quizAnswers.english ?? '—'}`,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[destination-picker lead]', error)
    return NextResponse.json({ error: 'Could not save your details' }, { status: 500 })
  }
}
