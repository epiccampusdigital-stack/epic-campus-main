import { NextRequest, NextResponse } from 'next/server'
import { verifyJpRole } from '@/lib/jp/serverAuth'
import { listJpModules, upsertJpModule, deleteJpModule } from '@/lib/jp/courses'
import type { JpModule } from '@/types'

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
    const modules = await listJpModules(courseId)
    return NextResponse.json({ modules })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load modules'
    console.error('[api/jp/modules GET]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  if (!(await verifyJpRole(req, WRITE_ROLES))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { courseId, module } = (await req.json()) as { courseId: string; module: JpModule }
    if (!courseId || !module?.id) {
      return NextResponse.json({ error: 'courseId and module.id are required' }, { status: 400 })
    }
    await upsertJpModule(courseId, module)
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save module'
    console.error('[api/jp/modules POST]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await verifyJpRole(req, WRITE_ROLES))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const courseId = req.nextUrl.searchParams.get('courseId')
  const moduleId = req.nextUrl.searchParams.get('moduleId')
  if (!courseId || !moduleId) {
    return NextResponse.json({ error: 'courseId and moduleId are required' }, { status: 400 })
  }

  try {
    await deleteJpModule(courseId, moduleId)
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete module'
    console.error('[api/jp/modules DELETE]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
