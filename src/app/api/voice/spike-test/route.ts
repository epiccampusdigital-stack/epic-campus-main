export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'

/**
 * THROWAWAY SPIKE — does Twilio do Sinhala end-to-end?
 *
 * Answers one question only: does <Say> speak Sinhala, and does
 * <Gather input="speech"> transcribe it. No conversation logic, no lead
 * capture, no Firestore, no Claude. Delete once the question is answered.
 *
 * Point a Twilio number's Voice webhook at:
 *   https://www.epiccampus.live/api/voice/spike-test
 *
 * The language codes are query params so variants can be tried by editing the
 * webhook URL instead of redeploying:
 *   ?say=si-LK&gather=si-LK          (default)
 *   ?say=si_LK   ?say=si   ?say=SI-LK    — casing/format variants
 *   ?voice=Polly.Aditi                   — force a specific voice
 *   ?model=googlev2_long                 — force a Gather speech model
 *
 * Heads-up before you burn a call on it: Twilio's <Say> voice list has no
 * Sinhala voice at all, while Google STT v2 (what Gather sits on) does list
 * si-LK. So the expected result is "STT yes, TTS no". The English beacons
 * below exist to prove that split by ear — if you hear "Step one" and then
 * silence, Sinhala TTS is the thing that failed, not the webhook.
 */

const DEFAULT_LANGUAGE = 'si-LK'
const RESULT_PATH = '/api/voice/spike-test/result'

const SINHALA = {
  /** "Hello! This is an EPIC Campus voice test." */
  greeting: 'ආයුබෝවන්! මෙය EPIC Campus හඬ පරීක්ෂණයකි.',
  /** "Please say something in Sinhala after the beep." */
  prompt: 'සංඥා නාදයෙන් පසු, කරුණාකර සිංහලෙන් යමක් කියන්න.',
  /** "Nothing was heard. Thank you, goodbye." */
  noInput: 'කිසිවක් ඇසුණේ නැත. ස්තූතියි, ආයුබෝවන්.',
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

function handle(req: NextRequest) {
  const q = req.nextUrl.searchParams
  const sayLang = q.get('say') || DEFAULT_LANGUAGE
  const gatherLang = q.get('gather') || sayLang
  const voice = q.get('voice') || ''
  const speechModel = q.get('model') || ''

  console.log('[voice spike] Inbound call — TwiML config', {
    sayLanguage: sayLang,
    gatherLanguage: gatherLang,
    voice: voice || '(default)',
    speechModel: speechModel || '(default)',
  })

  const sayAttrs = `language="${escapeXml(sayLang)}"${voice ? ` voice="${escapeXml(voice)}"` : ''}`
  // Language codes ride along to the result route so the read-back speaks with
  // whatever variant this call is testing.
  const action = `${RESULT_PATH}?say=${encodeURIComponent(sayLang)}${voice ? `&voice=${encodeURIComponent(voice)}` : ''}`

  const xml = `<Response>
  <Say language="en-US">Step one. Sinhala greeting.</Say>
  <Say ${sayAttrs}>${escapeXml(SINHALA.greeting)}</Say>
  <Say language="en-US">Step two. Speak Sinhala after the beep.</Say>
  <Gather input="speech" language="${escapeXml(gatherLang)}"${speechModel ? ` speechModel="${escapeXml(speechModel)}"` : ''} action="${escapeXml(action)}" method="POST" speechTimeout="auto" timeout="7">
    <Say ${sayAttrs}>${escapeXml(SINHALA.prompt)}</Say>
  </Gather>
  <Say language="en-US">No speech detected. Ending test.</Say>
  <Say ${sayAttrs}>${escapeXml(SINHALA.noInput)}</Say>
  <Hangup/>
</Response>`

  return twiml(xml)
}

export async function POST(req: NextRequest) {
  return handle(req)
}

/** So the TwiML can be eyeballed in a browser without placing a call. */
export async function GET(req: NextRequest) {
  return handle(req)
}
