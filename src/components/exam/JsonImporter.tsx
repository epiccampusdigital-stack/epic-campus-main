'use client'

import { useState } from 'react'
import {
  codeToPaperId,
  fetchExamPapers,
  importExamPaper,
  type ExamImportPayload,
} from '@/lib/exam/helpers'

const SAMPLE_TEMPLATE: ExamImportPayload = {
  code: 'J-001',
  title: 'Irodori Starter A1',
  level: 'A1',
  language: 'bilingual',
  courseIds: ['japan-ssw'],
  timeLimits: { reading: 60, listening: 30, writing: 45, speaking: 15 },
  readingQuestions: [
    {
      groupType: 'MULTIPLE_CHOICE',
      groupInstruction: 'Choose the correct answer.',
      questions: [
        {
          questionNumber: 1,
          passageText: 'えきの まえに コンビニが あります。',
          questionText: 'Where is the convenience store?',
          options: ['Near the station', 'Near the school', 'Near the hospital', 'Near the park'],
          correctAnswer: 'A',
          explanation: 'えきの まえに means in front of the station',
        },
      ],
    },
  ],
  listeningQuestions: [
    {
      groupType: 'MULTIPLE_CHOICE',
      groupInstruction: 'Choose the correct answer.',
      audioUrl: null,
      questions: [
        {
          questionNumber: 1,
          questionText: 'What does the woman want to buy?',
          options: ['A book', 'A pen', 'A bag', 'A phone'],
          correctAnswer: 'C',
        },
      ],
    },
  ],
  writingTasks: [
    { taskNumber: 1, prompt: 'Write a short message to your friend.', minWords: 50 },
    { taskNumber: 2, prompt: 'Describe your daily routine.', minWords: 150 },
  ],
  speakingPrompts: [
    { partNumber: 1, prompt: 'Tell me about your family.', prepTime: 0, timeLimit: 60 },
    { partNumber: 2, prompt: 'Describe your hometown.', prepTime: 60, timeLimit: 120 },
    { partNumber: 3, prompt: 'What do you like about learning Japanese?', prepTime: 0, timeLimit: 90 },
  ],
}

function validatePayload(
  data: ExamImportPayload,
  existingCodes: string[],
): string[] {
  const errors: string[] = []

  if (!data.code?.trim()) errors.push('Missing required field: code')
  if (!data.title?.trim()) errors.push('Missing required field: title')
  if (!data.level?.trim()) errors.push('Missing required field: level')

  if (data.code && existingCodes.includes(data.code.toUpperCase())) {
    errors.push(`Paper code "${data.code}" already exists`)
  }

  if (data.readingQuestions != null && !Array.isArray(data.readingQuestions)) {
    errors.push('readingQuestions must be an array')
  }
  if (data.listeningQuestions != null && !Array.isArray(data.listeningQuestions)) {
    errors.push('listeningQuestions must be an array')
  }

  const validateMcqGroup = (
    groups: ExamImportPayload['readingQuestions'],
    section: string,
  ) => {
    groups?.forEach((group, gi) => {
      if (group.groupType === 'MULTIPLE_CHOICE') {
        group.questions?.forEach((q, qi) => {
          if (!q.correctAnswer) {
            errors.push(`${section} group ${gi + 1} question ${qi + 1}: missing correctAnswer`)
          }
          if (!q.options || q.options.length < 2) {
            errors.push(
              `${section} group ${gi + 1} question ${qi + 1}: MULTIPLE_CHOICE needs ≥ 2 options`,
            )
          }
        })
      }
    })
  }

  validateMcqGroup(data.readingQuestions, 'Reading')
  validateMcqGroup(data.listeningQuestions, 'Listening')

  return errors
}

interface JsonImporterProps {
  onImported?: () => void
}

export default function JsonImporter({ onImported }: JsonImporterProps) {
  const [jsonText, setJsonText] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [validated, setValidated] = useState(false)
  const [parsed, setParsed] = useState<ExamImportPayload | null>(null)
  const [importing, setImporting] = useState(false)
  const [success, setSuccess] = useState<{ code: string; count: number } | null>(null)

  const handleValidate = async () => {
    setSuccess(null)
    setValidated(false)
    setParsed(null)

    let data: ExamImportPayload
    try {
      data = JSON.parse(jsonText) as ExamImportPayload
    } catch {
      setErrors(['Invalid JSON syntax — check brackets, commas, and quotes'])
      return
    }

    const papers = await fetchExamPapers()
    const existingCodes = papers.map((p) => p.code.toUpperCase())
    const validationErrors = validatePayload(data, existingCodes)

    if (validationErrors.length > 0) {
      setErrors(validationErrors)
      return
    }

    setErrors([])
    setParsed(data)
    setValidated(true)
  }

  const handleImport = async () => {
    if (!parsed || importing) return
    setImporting(true)
    setSuccess(null)
    try {
      const paperId = await importExamPaper(parsed)
      const reading = parsed.readingQuestions?.flatMap((g) => g.questions) ?? []
      const listening = parsed.listeningQuestions?.flatMap((g) => g.questions) ?? []
      const count =
        reading.length +
        listening.length +
        (parsed.writingTasks?.length ?? 0) +
        (parsed.speakingPrompts?.length ?? 0)
      setSuccess({ code: parsed.code, count })
      setJsonText('')
      setValidated(false)
      setParsed(null)
      onImported?.()
      void paperId
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Import failed'])
    } finally {
      setImporting(false)
    }
  }

  const handleDownloadTemplate = () => {
    const blob = new Blob([JSON.stringify(SAMPLE_TEMPLATE, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'japanese-exam-template.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="rounded-xl border border-[#DDE3EC] bg-white p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-jakarta font-bold text-[#0B3D6B]">Import exam paper JSON</h2>
          <p className="mt-1 text-sm text-[#5A6A7A]">
            Paste Irodori / JLPT paper JSON, validate, then import to Firestore
          </p>
        </div>
        <button
          type="button"
          onClick={handleDownloadTemplate}
          className="rounded-lg border border-[#DDE3EC] px-4 py-2 text-sm font-semibold text-[#0B3D6B] hover:bg-[#F5F7FB]"
        >
          Download template
        </button>
      </div>

      <textarea
        value={jsonText}
        onChange={(e) => {
          setJsonText(e.target.value)
          setValidated(false)
          setErrors([])
          setSuccess(null)
        }}
        placeholder="Paste JSON here…"
        rows={16}
        className="w-full rounded-lg border border-[#DDE3EC] bg-[#1e1e2e] p-4 font-mono text-sm text-green-300 placeholder:text-gray-500 focus:border-[#0B3D6B] focus:outline-none"
        spellCheck={false}
      />

      {errors.length > 0 && (
        <ul className="mt-4 space-y-1 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errors.map((e) => (
            <li key={e}>• {e}</li>
          ))}
        </ul>
      )}

      {success && (
        <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          Imported <strong>{success.code}</strong> ({codeToPaperId(success.code)}) with{' '}
          <strong>{success.count}</strong> questions/tasks
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleValidate}
          className="rounded-lg bg-[#0B3D6B] px-5 py-2.5 text-sm font-bold text-white"
        >
          Validate
        </button>
        <button
          type="button"
          onClick={handleImport}
          disabled={!validated || importing}
          className="rounded-lg bg-[#E8A020] px-5 py-2.5 text-sm font-bold text-[#0B3D6B] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {importing ? 'Importing…' : 'Import to Firestore'}
        </button>
      </div>
    </div>
  )
}
