export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You are a Japanese language exam creator for the Irodori series at EPIC Campus, Sri Lanka.
Create exam questions for Sri Lankan students learning Japanese for the SSW (Specified Skilled Worker) program in Japan.
Always return valid JSON only — no markdown, no explanation text, no code blocks.
All questions must be appropriate for the specified JLPT/Irodori level.
For bilingual mode: include English translations in passageContext and instructions.
For Japanese only mode: use Japanese throughout.`

const TOPIC_DESCRIPTIONS: Record<string, string> = {
  'topic1': 'はじめての日本語 — Greetings, hiragana, basic self-introduction',
  'topic2': '私のこと — Self-introduction, family, nationality',
  'topic3': '好きな食べ物 — Food preferences, ordering at a restaurant',
  'topic4': '家と職場 — Home and workplace, daily routine',
  'topic5': '毎日の生活 — Daily life, schedule, time expressions',
  'topic6': '私の好きなこと — Hobbies, invitations, leisure activities',
  'topic7': '街を歩く — Transport, asking for directions',
  'topic8': '店で — Shopping, prices, transactions',
  'topic9': '休みの日に — Holidays, past/future plans, travel',
}

function buildPrompt(
  topic: string,
  level: string,
  section: string,
  count: number,
  language: string,
) {
  const topicDesc = TOPIC_DESCRIPTIONS[topic] ?? topic
  const bilingual = language === 'bilingual'

  if (section === 'reading') {
    return `Generate ${count} reading multiple-choice questions for JLPT/Irodori ${level} level.
Topic: ${topicDesc}
Language mode: ${bilingual ? 'Bilingual (Japanese passage with English context/translation)' : 'Japanese only'}

Return a JSON array with this exact structure for each question:
{
  "questionNumber": 1,
  "passageText": "Japanese passage here (keep under 60 characters for A1)",
  "passageContext": "${bilingual ? 'English translation or context' : ''}",
  "questionText": "question in ${bilingual ? 'English' : 'Japanese'}",
  "options": ["option A", "option B", "option C", "option D"],
  "correctAnswer": "A",
  "explanation": "brief explanation"
}`
  }

  if (section === 'listening') {
    return `Generate ${count} listening comprehension questions for JLPT/Irodori ${level} level.
Topic: ${topicDesc}
Language mode: ${bilingual ? 'Bilingual' : 'Japanese only'}

Return a JSON array:
{
  "questionNumber": 1,
  "transcript": "Full text of what would be spoken in the audio (in Japanese)",
  "questionText": "question in ${bilingual ? 'English' : 'Japanese'}",
  "options": ["option A", "option B", "option C", "option D"],
  "correctAnswer": "A",
  "explanation": "brief explanation"
}`
  }

  if (section === 'writing') {
    return `Generate ${count} writing task prompts for JLPT/Irodori ${level} level.
Topic: ${topicDesc}
Language mode: ${bilingual ? 'Bilingual' : 'Japanese only'}

Return a JSON array:
{
  "taskNumber": 1,
  "taskType": "MESSAGE",
  "instruction": "Clear writing instruction in ${bilingual ? 'English' : 'Japanese'}",
  "minimumCharacters": 30,
  "maximumCharacters": 100,
  "exampleAnswer": "A model answer in Japanese"
}`
  }

  if (section === 'speaking') {
    return `Generate ${count} speaking prompt(s) for JLPT/Irodori ${level} level.
Topic: ${topicDesc}
Language mode: ${bilingual ? 'Bilingual' : 'Japanese only'}

Return a JSON array:
{
  "partNumber": 1,
  "promptType": "INTRODUCTION",
  "promptText": "Speaking prompt in English",
  "japaneseCue": "日本語のヒント (optional)",
  "preparationTime": 20,
  "speakingTime": 60
}`
  }

  return 'Generate questions'
}

export async function POST(req: NextRequest) {
  try {
    const { topic, level, section, count, language } = await req.json() as {
      topic: string
      level: string
      section: string
      count: number
      language: string
    }

    const userPrompt = buildPrompt(topic, level, section, count, language)

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''
    const cleaned = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()
    const questions = JSON.parse(cleaned)

    return NextResponse.json({ questions, section })
  } catch (err) {
    console.error('[generate-questions]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Generation failed' },
      { status: 500 },
    )
  }
}
