'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
} from 'firebase/firestore'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '@/lib/firebase/client'
import ExamImageUpload from '@/components/exam/ExamImageUpload'
import type { ExamPaper, ListeningQuestion, ReadingQuestion, SpeakingPrompt, WritingTask } from '@/types'

type Section = 'reading' | 'listening' | 'writing' | 'speaking'

interface Props {
  paper: ExamPaper
  open: boolean
  onClose: () => void
}

const LETTERS = ['A', 'B', 'C', 'D']

const WRITING_TYPES = ['MESSAGE', 'DESCRIPTION', 'EMAIL', 'ESSAY']
const SPEAKING_TYPES = ['INTRODUCTION', 'QUESTION_ANSWER', 'PICTURE_DESCRIPTION', 'OPINION', 'ROLEPLAY']
const PREP_TIMES = [15, 20, 30]
const SPEAK_TIMES = [45, 60, 75, 90, 120]

function newId(prefix: string) {
  return `${prefix}-${Date.now()}`
}

// ── empty form helpers ───────────────────────────────────────────────────────

function emptyReading(next: number): Omit<ReadingQuestion, 'id'> {
  return {
    questionNumber: next,
    passageText: '',
    passageContext: '',
    questionText: '',
    options: ['', '', '', ''],
    correctAnswer: 'A',
    explanation: '',
    imageUrl: '',
  }
}

function emptyListening(next: number): Omit<ListeningQuestion, 'id'> {
  return {
    questionNumber: next,
    audioUrl: null,
    questionText: '',
    options: ['', '', '', ''],
    correctAnswer: 'A',
    explanation: '',
    transcript: '',
    playLimit: 2,
  }
}

function emptyWriting(next: number): Omit<WritingTask, 'id'> {
  return {
    taskNumber: next,
    taskType: 'MESSAGE',
    prompt: '',
    instruction: '',
    minimumCharacters: 50,
    maximumCharacters: 200,
    minWords: 10,
    timeMinutes: 30,
    imageUrl: '',
    exampleAnswer: '',
  }
}

function emptySpeaking(next: number): Omit<SpeakingPrompt, 'id'> {
  return {
    partNumber: next,
    promptType: 'INTRODUCTION',
    prompt: '',
    promptText: '',
    japaneseCue: '',
    preparationTime: 20,
    prepTime: 20,
    speakingTime: 60,
    timeLimit: 60,
    imageUrl: '',
  }
}

// ── sub-components ───────────────────────────────────────────────────────────

interface ReadingFormProps {
  paperId: string
  initial: Omit<ReadingQuestion, 'id'>
  onSave: (q: Omit<ReadingQuestion, 'id'>) => Promise<void>
  onCancel: () => void
  saving: boolean
}

function ReadingForm({ paperId, initial, onSave, onCancel, saving }: ReadingFormProps) {
  const [q, setQ] = useState(initial)
  const tempId = `temp-reading-${q.questionNumber}`

  return (
    <div className="space-y-3 rounded-xl border border-[#DDE3EC] bg-[#F5F7FB] p-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-[#5A6A7A]">Q#</label>
          <input
            type="number"
            value={q.questionNumber}
            onChange={(e) => setQ({ ...q, questionNumber: Number(e.target.value) })}
            className="mt-1 w-full rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-[#5A6A7A]">Group type</label>
          <select
            value={q.groupType ?? 'MULTIPLE_CHOICE'}
            onChange={(e) => setQ({ ...q, groupType: e.target.value })}
            className="mt-1 w-full rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm"
          >
            {['MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_BLANK'].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-[#5A6A7A]">Passage (Japanese — optional)</label>
        <textarea
          value={q.passageText}
          onChange={(e) => setQ({ ...q, passageText: e.target.value })}
          rows={3}
          placeholder="日本語のパッセージ..."
          className="mt-1 w-full rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm font-['Noto_Sans_JP']"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-[#5A6A7A]">Passage context / translation (optional)</label>
        <input
          value={q.passageContext ?? ''}
          onChange={(e) => setQ({ ...q, passageContext: e.target.value })}
          className="mt-1 w-full rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-[#5A6A7A]">Question text</label>
        <input
          value={q.questionText}
          onChange={(e) => setQ({ ...q, questionText: e.target.value })}
          className="mt-1 w-full rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-[#5A6A7A]">Answer options (A–D)</label>
        <div className="mt-1 space-y-1.5">
          {LETTERS.map((l, i) => (
            <div key={l} className="flex items-center gap-2">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold border flex-shrink-0
                ${q.correctAnswer === l ? 'bg-[#0B3D6B] text-white border-[#0B3D6B]' : 'border-gray-300 text-gray-400'}`}>
                {l}
              </span>
              <input
                value={q.options[i] ?? ''}
                onChange={(e) => {
                  const opts = [...q.options]
                  opts[i] = e.target.value
                  setQ({ ...q, options: opts })
                }}
                placeholder={`Option ${l}`}
                className="flex-1 rounded-lg border border-[#DDE3EC] px-3 py-1.5 text-sm"
              />
              <input
                type="radio"
                name={`correct-${tempId}`}
                checked={q.correctAnswer === l}
                onChange={() => setQ({ ...q, correctAnswer: l })}
                className="accent-[#0B3D6B]"
                title={`Mark ${l} as correct`}
              />
            </div>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-gray-400">Radio button = correct answer</p>
      </div>

      <div>
        <label className="text-xs font-medium text-[#5A6A7A]">Explanation (optional)</label>
        <input
          value={q.explanation ?? ''}
          onChange={(e) => setQ({ ...q, explanation: e.target.value })}
          className="mt-1 w-full rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-[#5A6A7A]">Question image (optional)</label>
        <ExamImageUpload
          paperId={paperId}
          questionId={tempId}
          section="reading"
          existingUrl={q.imageUrl}
          onUploaded={(url) => setQ({ ...q, imageUrl: url })}
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-lg border border-[#DDE3EC] py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={saving || !q.questionText.trim()}
          onClick={() => onSave(q)}
          className="flex-1 rounded-lg bg-[#0B3D6B] py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-[#0B3D6B]/90"
        >
          {saving ? 'Saving…' : 'Save question'}
        </button>
      </div>
    </div>
  )
}

interface ListeningFormProps {
  paperId: string
  initial: Omit<ListeningQuestion, 'id'>
  questionId: string
  onSave: (q: Omit<ListeningQuestion, 'id'>) => Promise<void>
  onCancel: () => void
  saving: boolean
}

function ListeningForm({ paperId, initial, questionId, onSave, onCancel, saving }: ListeningFormProps) {
  const [q, setQ] = useState(initial)
  const [audioUploading, setAudioUploading] = useState(false)
  const [audioError, setAudioError] = useState('')

  async function handleAudioFile(file: File) {
    if (!file.name.match(/\.(mp3|wav)$/i)) {
      setAudioError('Only .mp3 files allowed')
      return
    }
    setAudioUploading(true)
    setAudioError('')
    try {
      const path = `exam-audio/${paperId}/${questionId}.mp3`
      const sRef = storageRef(storage, path)
      await uploadBytes(sRef, file)
      const url = await getDownloadURL(sRef)
      setQ((prev) => ({ ...prev, audioUrl: url }))
    } catch (err) {
      setAudioError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setAudioUploading(false)
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-[#DDE3EC] bg-[#F5F7FB] p-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-[#5A6A7A]">Q#</label>
          <input
            type="number"
            value={q.questionNumber}
            onChange={(e) => setQ({ ...q, questionNumber: Number(e.target.value) })}
            className="mt-1 w-full rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-[#5A6A7A]">Play limit</label>
          <input
            type="number"
            min={1}
            max={5}
            value={q.playLimit ?? 2}
            onChange={(e) => setQ({ ...q, playLimit: Number(e.target.value) })}
            className="mt-1 w-full rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-[#5A6A7A]">Audio file (.mp3)</label>
        <div className="mt-1">
          {q.audioUrl ? (
            <div className="space-y-2">
              <audio controls src={q.audioUrl} className="w-full">
                <track kind="captions" />
              </audio>
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-[#0B3D6B] hover:underline">
                <span className="ti ti-upload" aria-hidden="true" />
                Replace audio
                <input type="file" accept=".mp3,audio/mpeg" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAudioFile(f); e.target.value = '' }} />
              </label>
            </div>
          ) : (
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-200 py-4 text-sm text-gray-400 hover:border-[#0B3D6B]/40 hover:text-[#0B3D6B] transition-colors">
              {audioUploading ? (
                <><span className="h-4 w-4 animate-spin rounded-full border-2 border-[#0B3D6B] border-t-transparent" />Uploading…</>
              ) : (
                <><span className="ti ti-music text-base" aria-hidden="true" />Click to upload .mp3</>
              )}
              <input type="file" accept=".mp3,audio/mpeg" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAudioFile(f); e.target.value = '' }} />
            </label>
          )}
          {audioError && <p className="mt-1 text-xs text-red-600">{audioError}</p>}
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-[#5A6A7A]">Question text</label>
        <input
          value={q.questionText}
          onChange={(e) => setQ({ ...q, questionText: e.target.value })}
          className="mt-1 w-full rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-[#5A6A7A]">Answer options (A–D)</label>
        <div className="mt-1 space-y-1.5">
          {LETTERS.map((l, i) => (
            <div key={l} className="flex items-center gap-2">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold border flex-shrink-0
                ${q.correctAnswer === l ? 'bg-[#0B3D6B] text-white border-[#0B3D6B]' : 'border-gray-300 text-gray-400'}`}>
                {l}
              </span>
              <input
                value={q.options[i] ?? ''}
                onChange={(e) => {
                  const opts = [...q.options]
                  opts[i] = e.target.value
                  setQ({ ...q, options: opts })
                }}
                placeholder={`Option ${l}`}
                className="flex-1 rounded-lg border border-[#DDE3EC] px-3 py-1.5 text-sm"
              />
              <input
                type="radio"
                name={`correct-l-${questionId}`}
                checked={q.correctAnswer === l}
                onChange={() => setQ({ ...q, correctAnswer: l })}
                className="accent-[#0B3D6B]"
                title={`Mark ${l} as correct`}
              />
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-[#5A6A7A]">Audio transcript (for teacher reference)</label>
        <textarea
          value={q.transcript ?? ''}
          onChange={(e) => setQ({ ...q, transcript: e.target.value })}
          rows={2}
          placeholder="What the audio says..."
          className="mt-1 w-full rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel}
          className="flex-1 rounded-lg border border-[#DDE3EC] py-2 text-sm text-gray-600 hover:bg-gray-50">
          Cancel
        </button>
        <button type="button" disabled={saving || !q.questionText.trim()} onClick={() => onSave(q)}
          className="flex-1 rounded-lg bg-[#0B3D6B] py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-[#0B3D6B]/90">
          {saving ? 'Saving…' : 'Save question'}
        </button>
      </div>
    </div>
  )
}

interface WritingFormProps {
  paperId: string
  initial: Omit<WritingTask, 'id'>
  onSave: (t: Omit<WritingTask, 'id'>) => Promise<void>
  onCancel: () => void
  saving: boolean
}

function WritingForm({ paperId, initial, onSave, onCancel, saving }: WritingFormProps) {
  const [t, setT] = useState(initial)
  const tempId = `temp-writing-${t.taskNumber}`

  return (
    <div className="space-y-3 rounded-xl border border-[#DDE3EC] bg-[#F5F7FB] p-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-[#5A6A7A]">Task #</label>
          <input type="number" value={t.taskNumber}
            onChange={(e) => setT({ ...t, taskNumber: Number(e.target.value) })}
            className="mt-1 w-full rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-[#5A6A7A]">Task type</label>
          <select value={t.taskType ?? 'MESSAGE'} onChange={(e) => setT({ ...t, taskType: e.target.value })}
            className="mt-1 w-full rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm">
            {WRITING_TYPES.map((tp) => <option key={tp} value={tp}>{tp}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-[#5A6A7A]">Instruction text</label>
        <textarea
          value={t.instruction ?? t.prompt ?? ''}
          onChange={(e) => setT({ ...t, instruction: e.target.value, prompt: e.target.value })}
          rows={3}
          placeholder="Write a message to your Japanese friend about..."
          className="mt-1 w-full rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-[#5A6A7A]">Min characters</label>
          <input type="number" min={1}
            value={t.minimumCharacters ?? (t.minWords * 3)}
            onChange={(e) => {
              const v = Number(e.target.value)
              setT({ ...t, minimumCharacters: v, minWords: Math.ceil(v / 3) })
            }}
            className="mt-1 w-full rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-[#5A6A7A]">Max characters</label>
          <input type="number" min={1}
            value={t.maximumCharacters ?? 200}
            onChange={(e) => setT({ ...t, maximumCharacters: Number(e.target.value) })}
            className="mt-1 w-full rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm" />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-[#5A6A7A]">Task image (optional, for "describe this image" tasks)</label>
        <ExamImageUpload paperId={paperId} questionId={tempId} section="writing"
          existingUrl={t.imageUrl} onUploaded={(url) => setT({ ...t, imageUrl: url })} />
      </div>

      <div>
        <label className="text-xs font-medium text-[#5A6A7A]">Example answer (teacher reference only)</label>
        <textarea
          value={t.exampleAnswer ?? ''}
          onChange={(e) => setT({ ...t, exampleAnswer: e.target.value })}
          rows={2}
          placeholder="Model answer..."
          className="mt-1 w-full rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel}
          className="flex-1 rounded-lg border border-[#DDE3EC] py-2 text-sm text-gray-600 hover:bg-gray-50">
          Cancel
        </button>
        <button type="button" disabled={saving || !(t.instruction ?? t.prompt ?? '').trim()} onClick={() => onSave(t)}
          className="flex-1 rounded-lg bg-[#0B3D6B] py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-[#0B3D6B]/90">
          {saving ? 'Saving…' : 'Save task'}
        </button>
      </div>
    </div>
  )
}

interface SpeakingFormProps {
  paperId: string
  initial: Omit<SpeakingPrompt, 'id'>
  onSave: (p: Omit<SpeakingPrompt, 'id'>) => Promise<void>
  onCancel: () => void
  saving: boolean
}

function SpeakingForm({ paperId, initial, onSave, onCancel, saving }: SpeakingFormProps) {
  const [p, setP] = useState(initial)
  const tempId = `temp-speaking-${p.partNumber}`

  return (
    <div className="space-y-3 rounded-xl border border-[#DDE3EC] bg-[#F5F7FB] p-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-[#5A6A7A]">Part #</label>
          <input type="number" value={p.partNumber}
            onChange={(e) => setP({ ...p, partNumber: Number(e.target.value) })}
            className="mt-1 w-full rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-[#5A6A7A]">Prompt type</label>
          <select value={p.promptType ?? 'INTRODUCTION'} onChange={(e) => setP({ ...p, promptType: e.target.value })}
            className="mt-1 w-full rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm">
            {SPEAKING_TYPES.map((tp) => <option key={tp} value={tp}>{tp}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-[#5A6A7A]">Prompt text (English)</label>
        <textarea
          value={p.promptText ?? p.prompt ?? ''}
          onChange={(e) => setP({ ...p, promptText: e.target.value, prompt: e.target.value })}
          rows={2}
          placeholder="Please introduce yourself..."
          className="mt-1 w-full rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-[#5A6A7A]">Japanese cue (optional)</label>
        <input
          value={p.japaneseCue ?? ''}
          onChange={(e) => setP({ ...p, japaneseCue: e.target.value })}
          placeholder="自己紹介をしてください"
          className="mt-1 w-full rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm font-['Noto_Sans_JP']"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-[#5A6A7A]">Prep time (s)</label>
          <select value={p.preparationTime ?? p.prepTime ?? 20}
            onChange={(e) => {
              const v = Number(e.target.value)
              setP({ ...p, preparationTime: v, prepTime: v })
            }}
            className="mt-1 w-full rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm">
            {PREP_TIMES.map((s) => <option key={s} value={s}>{s}s</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-[#5A6A7A]">Speaking time (s)</label>
          <select value={p.speakingTime ?? p.timeLimit ?? 60}
            onChange={(e) => {
              const v = Number(e.target.value)
              setP({ ...p, speakingTime: v, timeLimit: v })
            }}
            className="mt-1 w-full rounded-lg border border-[#DDE3EC] px-3 py-2 text-sm">
            {SPEAK_TIMES.map((s) => <option key={s} value={s}>{s}s</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-[#5A6A7A]">Image (optional, for picture description)</label>
        <ExamImageUpload paperId={paperId} questionId={tempId} section="speaking"
          existingUrl={p.imageUrl} onUploaded={(url) => setP({ ...p, imageUrl: url })} />
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel}
          className="flex-1 rounded-lg border border-[#DDE3EC] py-2 text-sm text-gray-600 hover:bg-gray-50">
          Cancel
        </button>
        <button type="button" disabled={saving || !(p.promptText ?? p.prompt ?? '').trim()} onClick={() => onSave(p)}
          className="flex-1 rounded-lg bg-[#0B3D6B] py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-[#0B3D6B]/90">
          {saving ? 'Saving…' : 'Save prompt'}
        </button>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function QuestionEditor({ paper, open, onClose }: Props) {
  const [section, setSection] = useState<Section>('reading')
  const [readingQs, setReadingQs] = useState<ReadingQuestion[]>([])
  const [listeningQs, setListeningQs] = useState<ListeningQuestion[]>([])
  const [writingTasks, setWritingTasks] = useState<WritingTask[]>([])
  const [speakingPrompts, setSpeakingPrompts] = useState<SpeakingPrompt[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [error, setError] = useState('')

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [rSnap, lSnap, wSnap, sSnap] = await Promise.all([
        getDocs(collection(db, 'examPapers', paper.id, 'readingQuestions')),
        getDocs(collection(db, 'examPapers', paper.id, 'listeningQuestions')),
        getDocs(collection(db, 'examPapers', paper.id, 'writingTasks')),
        getDocs(collection(db, 'examPapers', paper.id, 'speakingPrompts')),
      ])
      setReadingQs(rSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as ReadingQuestion)
        .sort((a, b) => a.questionNumber - b.questionNumber))
      setListeningQs(lSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as ListeningQuestion)
        .sort((a, b) => a.questionNumber - b.questionNumber))
      setWritingTasks(wSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as WritingTask)
        .sort((a, b) => a.taskNumber - b.taskNumber))
      setSpeakingPrompts(sSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as SpeakingPrompt)
        .sort((a, b) => a.partNumber - b.partNumber))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load questions')
    } finally {
      setLoading(false)
    }
  }, [paper.id])

  useEffect(() => {
    if (open) {
      setShowAddForm(false)
      setSection('reading')
      loadAll()
    }
  }, [open, loadAll])

  if (!open) return null

  // ── save handlers ──────────────────────────────────────────────────────────

  async function saveReading(q: Omit<ReadingQuestion, 'id'>) {
    setSaving(true)
    try {
      const id = newId('reading')
      await setDoc(doc(db, 'examPapers', paper.id, 'readingQuestions', id), { id, ...q })
      setShowAddForm(false)
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function saveListening(q: Omit<ListeningQuestion, 'id'>) {
    setSaving(true)
    try {
      const id = newId('listening')
      await setDoc(doc(db, 'examPapers', paper.id, 'listeningQuestions', id), { id, ...q })
      setShowAddForm(false)
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function saveWriting(t: Omit<WritingTask, 'id'>) {
    setSaving(true)
    try {
      const id = newId('writing')
      await setDoc(doc(db, 'examPapers', paper.id, 'writingTasks', id), {
        id,
        ...t,
        timeMinutes: paper.writingMinutes,
      })
      setShowAddForm(false)
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function saveSpeaking(p: Omit<SpeakingPrompt, 'id'>) {
    setSaving(true)
    try {
      const id = newId('speaking')
      await setDoc(doc(db, 'examPapers', paper.id, 'speakingPrompts', id), { id, ...p })
      setShowAddForm(false)
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function deleteItem(sub: string, id: string) {
    if (!confirm('Delete this item?')) return
    try {
      await deleteDoc(doc(db, 'examPapers', paper.id, sub, id))
      await loadAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  // ── next question numbers ──────────────────────────────────────────────────

  const nextReadingNum = (readingQs.at(-1)?.questionNumber ?? 0) + 1
  const nextListeningNum = (listeningQs.at(-1)?.questionNumber ?? 0) + 1
  const nextWritingNum = (writingTasks.at(-1)?.taskNumber ?? 0) + 1
  const nextSpeakingNum = (speakingPrompts.at(-1)?.partNumber ?? 0) + 1
  const newListeningId = newId('listening')

  const SECTION_TABS: { key: Section; label: string; count: number }[] = [
    { key: 'reading', label: 'Reading', count: readingQs.length },
    { key: 'listening', label: 'Listening', count: listeningQs.length },
    { key: 'writing', label: 'Writing', count: writingTasks.length },
    { key: 'speaking', label: 'Speaking', count: speakingPrompts.length },
  ]

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} aria-hidden="true" />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-3xl flex-col bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#DDE3EC] px-6 py-4">
          <div>
            <h2 className="font-jakarta text-lg font-bold text-[#0B3D6B]">Edit Questions</h2>
            <p className="text-sm text-[#5A6A7A]">{paper.code} · {paper.title}</p>
          </div>
          <button type="button" onClick={onClose}
            className="text-2xl leading-none text-[#5A6A7A] hover:text-[#0B3D6B]">×</button>
        </div>

        {/* Section tabs */}
        <div className="flex border-b border-[#DDE3EC]">
          {SECTION_TABS.map(({ key, label, count }) => (
            <button
              key={key}
              type="button"
              onClick={() => { setSection(key); setShowAddForm(false) }}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors
                ${section === key
                  ? 'border-[#E8A020] text-[#0B3D6B]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              {label}
              <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
                {count}
              </span>
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
          )}

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-[#DDE3EC]" />
              ))}
            </div>
          ) : (
            <>
              {/* Reading list */}
              {section === 'reading' && (
                <div className="space-y-3">
                  {readingQs.length === 0 && !showAddForm && (
                    <p className="py-8 text-center text-sm text-gray-400">No reading questions yet. Add one below.</p>
                  )}
                  {readingQs.map((q) => (
                    <div key={q.id} className="flex items-start gap-3 rounded-xl border border-[#DDE3EC] bg-white p-4">
                      <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#0B3D6B]/10 text-[11px] font-bold text-[#0B3D6B]">
                        {q.questionNumber}
                      </span>
                      <div className="flex-1 min-w-0">
                        {q.passageText && (
                          <p className="truncate text-xs text-gray-400 font-['Noto_Sans_JP'] mb-1">{q.passageText}</p>
                        )}
                        <p className="text-sm text-gray-800 truncate">{q.questionText}</p>
                        <p className="text-xs text-green-600 mt-0.5">✓ {q.correctAnswer} · {q.options[LETTERS.indexOf(q.correctAnswer)]}</p>
                      </div>
                      <button type="button" onClick={() => deleteItem('readingQuestions', q.id)}
                        className="text-xs text-red-500 hover:underline flex-shrink-0">Delete</button>
                    </div>
                  ))}
                  {showAddForm ? (
                    <ReadingForm paperId={paper.id} initial={emptyReading(nextReadingNum)}
                      onSave={saveReading} onCancel={() => setShowAddForm(false)} saving={saving} />
                  ) : (
                    <button type="button" onClick={() => setShowAddForm(true)}
                      className="w-full rounded-xl border-2 border-dashed border-[#0B3D6B]/20 py-3 text-sm text-[#0B3D6B] hover:border-[#0B3D6B]/40 transition-colors">
                      + Add Reading Question
                    </button>
                  )}
                </div>
              )}

              {/* Listening list */}
              {section === 'listening' && (
                <div className="space-y-3">
                  {listeningQs.length === 0 && !showAddForm && (
                    <p className="py-8 text-center text-sm text-gray-400">No listening questions yet. Add one below.</p>
                  )}
                  {listeningQs.map((q) => (
                    <div key={q.id} className="flex items-start gap-3 rounded-xl border border-[#DDE3EC] bg-white p-4">
                      <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#0B3D6B]/10 text-[11px] font-bold text-[#0B3D6B]">
                        {q.questionNumber}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {q.audioUrl
                            ? <span className="text-[10px] text-green-600 font-medium">🎵 Audio uploaded</span>
                            : <span className="text-[10px] text-amber-600 font-medium">⚠ No audio</span>}
                        </div>
                        <p className="text-sm text-gray-800 truncate">{q.questionText}</p>
                        <p className="text-xs text-green-600 mt-0.5">✓ {q.correctAnswer}</p>
                      </div>
                      <button type="button" onClick={() => deleteItem('listeningQuestions', q.id)}
                        className="text-xs text-red-500 hover:underline flex-shrink-0">Delete</button>
                    </div>
                  ))}
                  {showAddForm ? (
                    <ListeningForm paperId={paper.id} questionId={newListeningId}
                      initial={emptyListening(nextListeningNum)}
                      onSave={saveListening} onCancel={() => setShowAddForm(false)} saving={saving} />
                  ) : (
                    <button type="button" onClick={() => setShowAddForm(true)}
                      className="w-full rounded-xl border-2 border-dashed border-[#0B3D6B]/20 py-3 text-sm text-[#0B3D6B] hover:border-[#0B3D6B]/40 transition-colors">
                      + Add Listening Question
                    </button>
                  )}
                </div>
              )}

              {/* Writing list */}
              {section === 'writing' && (
                <div className="space-y-3">
                  {writingTasks.length === 0 && !showAddForm && (
                    <p className="py-8 text-center text-sm text-gray-400">No writing tasks yet. Add one below.</p>
                  )}
                  {writingTasks.map((t) => (
                    <div key={t.id} className="flex items-start gap-3 rounded-xl border border-[#DDE3EC] bg-white p-4">
                      <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#E8A020]/15 text-[11px] font-bold text-[#E8A020]">
                        {t.taskNumber}
                      </span>
                      <div className="flex-1 min-w-0">
                        {t.taskType && (
                          <span className="text-[10px] text-gray-400 uppercase tracking-wide">{t.taskType}</span>
                        )}
                        <p className="text-sm text-gray-800 truncate">{t.instruction ?? t.prompt}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {t.minimumCharacters ?? (t.minWords * 3)}–{t.maximumCharacters ?? 200} chars
                        </p>
                      </div>
                      <button type="button" onClick={() => deleteItem('writingTasks', t.id)}
                        className="text-xs text-red-500 hover:underline flex-shrink-0">Delete</button>
                    </div>
                  ))}
                  {showAddForm ? (
                    <WritingForm paperId={paper.id} initial={emptyWriting(nextWritingNum)}
                      onSave={saveWriting} onCancel={() => setShowAddForm(false)} saving={saving} />
                  ) : (
                    <button type="button" onClick={() => setShowAddForm(true)}
                      className="w-full rounded-xl border-2 border-dashed border-[#0B3D6B]/20 py-3 text-sm text-[#0B3D6B] hover:border-[#0B3D6B]/40 transition-colors">
                      + Add Writing Task
                    </button>
                  )}
                </div>
              )}

              {/* Speaking list */}
              {section === 'speaking' && (
                <div className="space-y-3">
                  {speakingPrompts.length === 0 && !showAddForm && (
                    <p className="py-8 text-center text-sm text-gray-400">No speaking prompts yet. Add one below.</p>
                  )}
                  {speakingPrompts.map((p) => (
                    <div key={p.id} className="flex items-start gap-3 rounded-xl border border-[#DDE3EC] bg-white p-4">
                      <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-purple-100 text-[11px] font-bold text-purple-600">
                        {p.partNumber}
                      </span>
                      <div className="flex-1 min-w-0">
                        {p.promptType && (
                          <span className="text-[10px] text-gray-400 uppercase tracking-wide">{p.promptType}</span>
                        )}
                        <p className="text-sm text-gray-800 truncate">{p.promptText ?? p.prompt}</p>
                        {p.japaneseCue && (
                          <p className="text-xs text-gray-400 font-['Noto_Sans_JP'] truncate mt-0.5">{p.japaneseCue}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-0.5">
                          Prep: {p.preparationTime ?? p.prepTime}s · Speaking: {p.speakingTime ?? p.timeLimit}s
                        </p>
                      </div>
                      <button type="button" onClick={() => deleteItem('speakingPrompts', p.id)}
                        className="text-xs text-red-500 hover:underline flex-shrink-0">Delete</button>
                    </div>
                  ))}
                  {showAddForm ? (
                    <SpeakingForm paperId={paper.id} initial={emptySpeaking(nextSpeakingNum)}
                      onSave={saveSpeaking} onCancel={() => setShowAddForm(false)} saving={saving} />
                  ) : (
                    <button type="button" onClick={() => setShowAddForm(true)}
                      className="w-full rounded-xl border-2 border-dashed border-[#0B3D6B]/20 py-3 text-sm text-[#0B3D6B] hover:border-[#0B3D6B]/40 transition-colors">
                      + Add Speaking Prompt
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </aside>
    </>
  )
}
