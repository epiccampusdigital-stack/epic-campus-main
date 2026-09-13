import { NextRequest, NextResponse } from 'next/server'
import { verifyJpRole, verifySignedIn } from '@/lib/jp/serverAuth'
import { getJpSettings, updateJpSettings } from '@/lib/jp/settings'

export const dynamic = 'force-dynamic'

// Any signed-in user reads (the checkout page needs postage/bank details);
// only admin/owner can edit — matches firestore.rules for jpSettings.
export async function GET(req: NextRequest) {
  const uid = await verifySignedIn(req)
  if (!uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const settings = await getJpSettings()
    return NextResponse.json({ settings })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load settings'
    console.error('[api/jp/settings GET]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const staff = await verifyJpRole(req, ['admin', 'owner'])
  if (!staff) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const settings = await updateJpSettings(body)
    return NextResponse.json({ settings })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update settings'
    console.error('[api/jp/settings POST]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
