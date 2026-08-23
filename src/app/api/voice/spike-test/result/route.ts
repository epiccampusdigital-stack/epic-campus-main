export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'

/**
 * THROWAWAY SPIKE — Gather result handler. See ../route.ts for the why.
 *
 * Twilio POSTs the speech result here as form-encoded fields. We log the raw
 * transcription + confidence (that's the STT evidence) and read the text back
 * with <Say> (that's the TTS evidence — if the read-back sounds like what you
 * said, both halves work). Then hang up. No writes anywhere.
 */

const DEFAULT_LANGUAGE = 'si-LK'

const SINHALA = {
  /** "You said:" */
  youSaid: 'ඔබ කීවේ:',
  /** "I could not understand. Thank you, goodbye." */
  notUnderstood: 'මට තේරුම් ගත නොහැකි විය. ස්තූතියි, ආයුබෝවන්.',
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function twiml(xml: string) {
  return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?>${xml}`, {
    status: 200,
    headers: { 'Content-Type': 'text/xml; charset=utf-8' },
  })
}

export async function POST(req: NextRequest) {
  const q = req.nextUrl.searchParams
  const sayLang = q.get('say') || DEFAULT_LANGUAGE
  const voice = q.get('voice') || ''

  const params: Record<string, string> = {}
  try {
    const form = await req.formData()
    form.forEach((value, key) => {
      params[key] = String(value)
    })
  } catch (err) {
    console.error('[voice spike result] Could not parse form body', err)
    return twiml(`<Response><Say language="en-US">Could not read the result.</Say><Hangup/></Response>`)
  }

  const transcript = params.SpeechResult ?? ''
  const confidence = params.Confidence ?? ''

  // The whole point of the spike — this is the evidence to review afterwards.
  console.log('[voice spike result] ===== SINHALA STT RESULT =====')
  console.log('[voice spike result] CallSid      :', params.CallSid ?? '(none)')
  console.log('[voice spike result] From         :', params.From ?? '(none)')
  console.log('[voice spike result] SpeechResult :', JSON.stringify(transcript))
  console.log('[voice spike result] Confidence   :', confidence || '(none)')
  console.log('[voice spike result] Codepoints   :', transcript ? Array.from(transcript).length : 0)
  // Sinhala is U+0D80–U+0DFF. If this is false but SpeechResult is non-empty,
  // Twilio transcribed to Latin script (or fell back to another language).
  console.log('[voice spike result] Has Sinhala chars:', /[඀-෿]/.test(transcript))
  console.log('[voice spike result] All params   :', JSON.stringify(params, null, 2))
  console.log('[voice spike result] ==============================')

  const sayAttrs = `language="${escapeXml(sayLang)}"${voice ? ` voice="${escapeXml(voice)}"` : ''}`

  if (!transcript) {
    return twiml(`<Response>
  <Say language="en-US">No transcription was returned.</Say>
  <Say ${sayAttrs}>${escapeXml(SINHALA.notUnderstood)}</Say>
  <Hangup/>
</Response>`)
  }

  return twiml(`<Response>
  <Say language="en-US">Step three. Reading your words back. Confidence ${escapeXml(confidence || 'unknown')}.</Say>
  <Say ${sayAttrs}>${escapeXml(SINHALA.youSaid)} ${escapeXml(transcript)}</Say>
  <Hangup/>
</Response>`)
}
