import { NextRequest, NextResponse } from 'next/server'
import { verifyJpRole } from '@/lib/jp/serverAuth'
import { getJpCourse, upsertJpCourse } from '@/lib/jp/courses'
import type { JpCourse } from '@/types'

export const dynamic = 'force-dynamic'

const READ_ROLES = ['admin', 'owner', 'teacher']
const WRITE_ROLES = ['admin', 'owner']

export async function GET(req: NextRequest) {
  if (!(await verifyJpRole(req, READ_ROLES))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const courseId = req.nextUrl.searchParams.get('courseId')
  if (!courseId) {
    return NextResponse.json({ error: 'courseId is required' }, { status: 400 })
  }

  try {
    const course = await getJpCourse(courseId)
    return NextResponse.json({ course })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load course'
    console.error('[api/jp/course GET]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  if (!(await verifyJpRole(req, WRITE_ROLES))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { course } = (await req.json()) as { course: JpCourse }
    if (!course?.id) {
      return NextResponse.json({ error: 'course.id is required' }, { status: 400 })
    }
    await upsertJpCourse(course)
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save course'
    console.error('[api/jp/course POST]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
