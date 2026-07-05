import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const PAYPAL_BASE = process.env.NEXT_PUBLIC_PAYPAL_MODE === 'sandbox'
  ? 'https://api-m.sandbox.paypal.com'
  : 'https://api-m.paypal.com'

async function getAccessToken(): Promise<string> {
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID!
  const secret = process.env.PAYPAL_SECRET!
  const auth = Buffer.from(`${clientId}:${secret}`).toString('base64')
  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })
  const data = await res.json() as { access_token: string }
  return data.access_token
}

export async function POST(req: NextRequest) {
  try {
    const { orderId } = await req.json() as { orderId: string }
    const accessToken = await getAccessToken()

    const res = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    const capture = await res.json() as { status: string; id: string }
    return NextResponse.json({ status: capture.status, captureId: capture.id })
  } catch (err) {
    console.error('[PayPal CaptureOrder]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
