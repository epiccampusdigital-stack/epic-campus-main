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
    const { amount, currency, description } = await req.json() as {
      amount: number
      currency: 'USD' | 'LKR'
      description: string
    }

    const accessToken = await getAccessToken()

    // PayPal only supports USD for sandbox — convert LKR if needed
    const paypalCurrency = 'USD'
    const paypalAmount = currency === 'LKR'
      ? (amount * 0.0033).toFixed(2)
      : amount.toFixed(2)

    const res = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          amount: {
            currency_code: paypalCurrency,
            value: paypalAmount,
          },
          description,
        }],
        application_context: {
          brand_name: 'EPIC Campus',
          landing_page: 'NO_PREFERENCE',
          user_action: 'PAY_NOW',
          return_url: 'https://www.epiccampus.live/student/payments?status=success',
          cancel_url: 'https://www.epiccampus.live/student/payments?status=cancelled',
        },
      }),
    })

    const order = await res.json() as { id: string; status: string }
    return NextResponse.json({ orderId: order.id })
  } catch (err) {
    console.error('[PayPal CreateOrder]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
