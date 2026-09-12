import { NextRequest, NextResponse } from 'next/server'
import { verifyJpRole } from '@/lib/jp/serverAuth'
import { listJpLessons, upsertJpLesson, deleteJpLesson } from '@/lib/jp/courses'
import type { JpLesson } from '@/types'

export const dynamic = 'force-dynamic'

const READ_ROLES = ['admin', 'owner', 'teacher']
const WRITE_ROLES = ['admin', 'owner']

export async function GET(req: NextRequest) {
  if (!(await verifyJpRole(req, READ_ROLES))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const courseId = req.nextUrl.searchParams.get('courseId')
  const moduleId = req.nextUrl.searchParams.get('moduleId')
  if (!courseId || !moduleId) {
    return NextResponse.json({ error: 'courseId and moduleId are required' }, { status: 400 })
  }

  try {
    const lessons = await listJpLessons(courseId, moduleId)
    return NextResponse.json({ lessons })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load lessons'
    console.error('[api/jp/lessons GET]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  if (!(await verifyJpRole(req, WRITE_ROLES))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { courseId, moduleId, lesson } = (await req.json()) as {
      courseId: string
      moduleId: string
      lesson: JpLesson
    }
    if (!courseId || !moduleId || !lesson?.id) {
      return NextResponse.json({ error: 'courseId, moduleId and lesson.id are required' }, { status: 400 })
    }
    await upsertJpLesson(courseId, moduleId, lesson)
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save lesson'
    console.error('[api/jp/lessons POST]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await verifyJpRole(req, WRITE_ROLES))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const courseId = req.nextUrl.searchParams.get('courseId')
  const moduleId = req.nextUrl.searchParams.get('moduleId')
  const lessonId = req.nextUrl.searchParams.get('lessonId')
  if (!courseId || !moduleId || !lessonId) {
    return NextResponse.json({ error: 'courseId, moduleId and lessonId are required' }, { status: 400 })
  }

  try {
    await deleteJpLesson(courseId, moduleId, lessonId)
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete lesson'
    console.error('[api/jp/lessons DELETE]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
