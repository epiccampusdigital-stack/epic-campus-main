export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

export async function GET() {
  const anthropicKey = process.env.ANTHROPIC_API_KEY ?? ''
  return NextResponse.json({
    hasAnthropicKey: !!anthropicKey && anthropicKey !== 'your_anthropic_api_key_here',
    anthropicKeyLength: anthropicKey.length,
    anthropicKeyPrefix: anthropicKey ? anthropicKey.slice(0, 12) + '...' : 'missing',
    nodeEnv: process.env.NODE_ENV,
    hasFirebaseProjectId: !!process.env.FB_PROJECT_ID || !!process.env.FIREBASE_PROJECT_ID,
    hasTwilio: !!process.env.TWILIO_ACCOUNT_SID,
  })
}
